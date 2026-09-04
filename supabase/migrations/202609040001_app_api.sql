begin;

-- API transacional consumida pelo frontend. Todas as funcoes validam a sessao,
-- resolvem a organizacao do usuario e retornam o mesmo contrato JSON usado pelo
-- antigo Apps Script.

create or replace function public.app_require_organization(p_interface integer default null)
returns uuid
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_org uuid;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHORIZED' using errcode = '42501';
  end if;

  select p.organization_id into v_org
  from public.profiles p
  where p.user_id = auth.uid() and p.active
  limit 1;

  if v_org is null then
    raise exception 'UNAUTHORIZED' using errcode = '42501';
  end if;

  if p_interface is not null and not public.can_access_interface(v_org, p_interface) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  return v_org;
end;
$$;

create or replace function public.app_require_any_interface(p_interfaces integer[])
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_org uuid;
  v_interfaces integer[];
begin
  if auth.uid() is null then raise exception 'UNAUTHORIZED' using errcode = '42501'; end if;
  select p.organization_id, p.interfaces into v_org, v_interfaces
  from public.profiles p where p.user_id = auth.uid() and p.active limit 1;
  if v_org is null then raise exception 'UNAUTHORIZED' using errcode = '42501'; end if;
  if not (99 = any(v_interfaces) or v_interfaces && p_interfaces) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  return v_org;
end;
$$;

create or replace function public.app_public_contract_id(p_contract public.contracts)
returns text
language sql
immutable
set search_path = public
as $$
  select coalesce(nullif(p_contract.legacy_primary_id, ''), p_contract.id::text)
$$;

create or replace function public.app_contract_status_to_legacy(p_status public.contract_status)
returns text language sql immutable as $$
  select case p_status when 'CLOSED' then 'Encerrado' when 'RENEWED' then 'Renovado' else 'Ativo' end
$$;

create or replace function public.app_contract_status_from_legacy(p_status text)
returns public.contract_status language sql immutable as $$
  select case public.normalize_legacy_text(p_status)
    when 'encerrado' then 'CLOSED'::public.contract_status
    when 'renovado' then 'RENEWED'::public.contract_status
    else 'ACTIVE'::public.contract_status
  end
$$;

create or replace function public.app_charge_status_to_legacy(p_status public.charge_status)
returns text language sql immutable as $$
  select case p_status when 'PAID' then 'Pago' when 'CANCELLED' then 'Cancelado' else 'Pendente' end
$$;

create or replace function public.app_campaign_status_to_legacy(p_status public.campaign_status)
returns text language sql immutable as $$
  select case p_status
    when 'STARTED' then 'INICIADA'
    when 'COMPLETED' then 'CONCLUIDA'
    when 'CANCELLED' then 'CANCELADA'
    when 'ARCHIVED' then 'ARQUIVADA'
    else 'RASCUNHO'
  end
$$;

create or replace function public.app_recipient_status_to_legacy(p_status public.campaign_recipient_status)
returns text language sql immutable as $$
  select case p_status
    when 'WHATSAPP_OPENED' then 'WHATSAPP_ABERTO'
    when 'SEND_CONFIRMED' then 'ENVIO_CONFIRMADO'
    when 'IGNORED' then 'IGNORADO'
    when 'ERROR' then 'ERRO'
    else 'PENDENTE'
  end
$$;

create or replace function public.app_operation_claim(
  p_organization_id uuid,
  p_scope text,
  p_operation_id text,
  p_action text,
  p_target_type text,
  p_target_id text,
  p_requested_version integer,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
  v_existing public.idempotency_operations%rowtype;
begin
  if coalesce(trim(p_operation_id), '') = '' then
    return jsonb_build_object('error', 'Identificador da operacao ausente.', 'code', 'VALIDATION_ERROR');
  end if;

  v_hash := encode(extensions.digest(coalesce(p_payload, '{}'::jsonb)::text, 'sha256'), 'hex');

  insert into public.idempotency_operations (
    organization_id, operation_id, scope, action, target_type, target_id,
    requested_version, payload_hash, status
  ) values (
    p_organization_id, p_operation_id, p_scope, p_action, p_target_type,
    p_target_id, p_requested_version, v_hash, 'PENDING'
  )
  on conflict (organization_id, scope, operation_id) do nothing;

  if found then
    return null;
  end if;

  select * into v_existing
  from public.idempotency_operations
  where organization_id = p_organization_id
    and scope = p_scope
    and operation_id = p_operation_id
  for update;

  if v_existing.payload_hash is distinct from v_hash then
    return jsonb_build_object('error', 'A chave de idempotencia foi reutilizada com dados diferentes.', 'code', 'IDEMPOTENCY_KEY_REUSED');
  end if;

  if v_existing.status = 'SUCCESS' then
    return coalesce(v_existing.result, jsonb_build_object('success', true, 'status', 'already_updated'))
      || jsonb_build_object('status', 'already_updated');
  end if;

  if v_existing.status in ('CONFLICT', 'ERROR') then
    return coalesce(v_existing.result, jsonb_build_object('error', 'A operacao anterior falhou.', 'code', coalesce(v_existing.error_code, 'OPERATION_FAILED')));
  end if;

  return jsonb_build_object('error', 'A operacao ainda esta em processamento.', 'code', 'OPERATION_IN_PROGRESS');
end;
$$;

create or replace function public.app_operation_finish(
  p_organization_id uuid,
  p_scope text,
  p_operation_id text,
  p_status public.operation_status,
  p_result jsonb,
  p_result_version integer default null,
  p_error_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.idempotency_operations
  set status = p_status,
      result = p_result,
      result_version = p_result_version,
      error_code = p_error_code,
      updated_at = now()
  where organization_id = p_organization_id
    and scope = p_scope
    and operation_id = p_operation_id;
  return p_result;
end;
$$;

create or replace function public.app_resolve_contract(p_organization_id uuid, p_public_id text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select c.id
  from public.contracts c
  where c.organization_id = p_organization_id
    and (c.legacy_primary_id = p_public_id or c.id::text = p_public_id)
  order by (c.legacy_primary_id = p_public_id) desc
  limit 1
$$;

create or replace function public.app_upsert_person(
  p_organization_id uuid,
  p_name text,
  p_phone text,
  p_email text,
  p_birth text,
  p_legacy_data jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_name text := trim(coalesce(p_name, ''));
  v_normalized_name text := public.normalize_legacy_text(p_name);
  v_phone text := nullif(trim(coalesce(p_phone, '')), '');
  v_normalized_phone text := nullif(public.normalize_phone(p_phone), '');
  v_birth_day smallint;
  v_birth_month smallint;
begin
  if v_name = '' then return null; end if;

  if coalesce(p_birth, '') ~ '^\d{1,2}/\d{1,2}$' then
    v_birth_day := split_part(p_birth, '/', 1)::smallint;
    v_birth_month := split_part(p_birth, '/', 2)::smallint;
    if v_birth_day not between 1 and 31 or v_birth_month not between 1 and 12 then
      v_birth_day := null; v_birth_month := null;
    end if;
  end if;

  select p.id into v_id
  from public.people p
  where p.organization_id = p_organization_id
    and p.normalized_name = v_normalized_name
    and (v_normalized_phone is null or p.normalized_phone = v_normalized_phone)
  order by p.created_at
  limit 1;

  if v_id is null then
    insert into public.people (
      organization_id, display_name, normalized_name, phone, normalized_phone,
      email, birth_day, birth_month, legacy_data
    ) values (
      p_organization_id, v_name, v_normalized_name, v_phone, v_normalized_phone,
      nullif(trim(coalesce(p_email, '')), ''), v_birth_day, v_birth_month, coalesce(p_legacy_data, '{}'::jsonb)
    ) returning id into v_id;
  else
    update public.people
    set display_name = v_name,
        phone = v_phone,
        normalized_phone = v_normalized_phone,
        email = nullif(trim(coalesce(p_email, '')), ''),
        birth_day = v_birth_day,
        birth_month = v_birth_month,
        legacy_data = legacy_data || coalesce(p_legacy_data, '{}'::jsonb)
    where id = v_id;
  end if;

  return v_id;
end;
$$;

create or replace function public.app_get_cadastros()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.app_require_any_interface(array[1,2,4,5,6]);
  v_result jsonb;
begin
  select coalesce(jsonb_agg(item order by item->>'dataHora'), '[]'::jsonb) into v_result
  from (
    select jsonb_build_object(
      'id', public.app_public_contract_id(c),
      'dataHora', c.created_at,
      'contrato', c.contract_number,
      'nomeProp', coalesce(owner.display_name, ''),
      'telProp', coalesce(owner.phone, ''),
      'niverProp', case when owner.birth_day is null then '' else lpad(owner.birth_day::text, 2, '0') || '/' || lpad(owner.birth_month::text, 2, '0') end,
      'emailProp', coalesce(owner.email, ''),
      'nomeInq', coalesce(tenant.display_name, ''),
      'telInq', coalesce(tenant.phone, ''),
      'niverInq', case when tenant.birth_day is null then '' else lpad(tenant.birth_day::text, 2, '0') || '/' || lpad(tenant.birth_month::text, 2, '0') end,
      'emailInq', coalesce(tenant.email, ''),
      'inicioContrato', coalesce(c.starts_on::text, ''),
      'fimContrato', coalesce(c.ends_on::text, ''),
      'corretor', coalesce(c.agent, ''),
      'diaVencimento', coalesce(c.due_day, 1),
      'enderecoImovel', coalesce(prop.address, ''),
      'tipoImovel', coalesce(prop.property_type, ''),
      'valorAluguel', coalesce(c.rent_amount, 0),
      'comissao', coalesce(c.commission_amount, 0),
      'status', public.app_contract_status_to_legacy(c.status),
      'finalidade', coalesce(prop.purpose, ''),
      'condominio', coalesce(cond.name, ''),
      'version', c.version,
      'deletedAt', c.deleted_at,
      'renewedFromId', case when renewed.id is null then null else public.app_public_contract_id(renewed) end
    ) item
    from public.contracts c
    left join public.properties prop on prop.id = c.property_id
    left join public.condominiums cond on cond.id = prop.condominium_id
    left join public.contracts renewed on renewed.id = c.renewed_from_id
    left join lateral (
      select p.* from public.contract_parties cp join public.people p on p.id = cp.person_id
      where cp.contract_id = c.id and cp.role = 'OWNER'
      order by (public.app_public_contract_id(c) = any(cp.legacy_cadastro_ids)) desc, cp.created_at limit 1
    ) owner on true
    left join lateral (
      select p.* from public.contract_parties cp join public.people p on p.id = cp.person_id
      where cp.contract_id = c.id and cp.role = 'TENANT'
      order by (public.app_public_contract_id(c) = any(cp.legacy_cadastro_ids)) desc, cp.created_at limit 1
    ) tenant on true
    where c.organization_id = v_org and c.deleted_at is null
  ) rows;
  return v_result;
end;
$$;

create or replace function public.app_get_checklists()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.app_require_organization(4);
  v_result jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', public.app_public_contract_id(c),
    'contrato', c.contract_number,
    'prop_contratoEnviado', ch.owner_contract_sent,
    'prop_vistoriaEnviada', ch.owner_inspection_sent,
    'inq_manualEntregue', ch.tenant_manual_delivered,
    'inq_vistoriaAssinada', ch.tenant_inspection_signed,
    'inq_seguroIncendio', ch.tenant_fire_insurance,
    'documentos_json', coalesce(docs.value, '[]'::jsonb)::text,
    'version', ch.version,
    'operationId', coalesce(ch.last_operation_id, '')
  ) order by c.contract_number), '[]'::jsonb) into v_result
  from public.checklists ch
  join public.contracts c on c.id = ch.contract_id
  left join lateral (
    select jsonb_agg(jsonb_build_object(
      'id', coalesce(d.legacy_document_id, d.id::text),
      'nome', d.name,
      'categoria', coalesce(d.category, ''),
      'isFeito', d.status in ('DONE', 'NOT_APPLICABLE'),
      'pendencia', coalesce(d.issue_notes, ''),
      'status', case d.status when 'DONE' then 'Feito' when 'NOT_APPLICABLE' then 'Não se aplica' else 'Pendente' end
    ) order by d.sort_order, d.created_at) value
    from public.checklist_documents d where d.checklist_id = ch.id
  ) docs on true
  where ch.organization_id = v_org and c.deleted_at is null;
  return v_result;
end;
$$;

create or replace function public.app_get_tarefas()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.app_require_organization(2);
  v_result jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
    'idTarefa', coalesce(t.legacy_task_id, t.id::text),
    'contrato', coalesce(c.contract_number, t.legacy_data->>'contrato', ''),
    'tipo', t.task_type,
    'dataConclusao', coalesce(t.completed_at, t.created_at),
    'usuario', coalesce(t.completed_by, ''),
    'referencia', coalesce(t.reference, ''),
    'operationId', coalesce(t.operation_id, '')
  ) order by coalesce(t.completed_at, t.created_at)), '[]'::jsonb) into v_result
  from public.tasks t left join public.contracts c on c.id = t.contract_id
  where t.organization_id = v_org and t.deleted_at is null;
  return v_result;
end;
$$;

create or replace function public.app_get_condominios()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.app_require_any_interface(array[1,6]);
  v_result jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id::text, 'nome', name, 'nomeNormalizado', normalized_name,
    'ativo', active, 'createdAt', created_at
  ) order by name), '[]'::jsonb) into v_result
  from public.condominiums where organization_id = v_org;
  return v_result;
end;
$$;

create or replace function public.app_get_cobrancas()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.app_require_organization(5);
  v_result jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', coalesce(ch.legacy_charge_id, ch.id::text),
    'cadastroId', public.app_public_contract_id(c),
    'contrato', c.contract_number,
    'competencia', to_char(ch.competence, 'YYYY-MM'),
    'vencimento', ch.due_on::text,
    'valor', coalesce(ch.amount, 0),
    'statusPagamento', public.app_charge_status_to_legacy(ch.status),
    'pagoEm', coalesce(ch.paid_at::text, ''),
    'envioConfirmadoEm', coalesce(ch.delivery_confirmed_at::text, ''),
    'envioOperationId', coalesce(ch.delivery_operation_id, ''),
    'pagamentoOperationId', coalesce(ch.payment_operation_id, ''),
    'version', ch.version,
    'createdAt', ch.created_at,
    'updatedAt', ch.updated_at
  ) order by ch.due_on, c.contract_number), '[]'::jsonb) into v_result
  from public.charges ch join public.contracts c on c.id = ch.contract_id
  where ch.organization_id = v_org and c.deleted_at is null;
  return v_result;
end;
$$;

create or replace function public.app_get_campanhas()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.app_require_organization(6);
  v_result jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', coalesce(c.legacy_campaign_id, c.id::text),
    'nome', c.name,
    'descricao', coalesce(c.description, ''),
    'mensagemTemplate', c.message_template,
    'filtrosJson', c.filters::text,
    'status', public.app_campaign_status_to_legacy(c.status),
    'inicioEm', c.started_at,
    'fimEm', c.finished_at,
    'audienciaTotal', c.audience_total,
    'createdBy', coalesce(c.created_by, ''),
    'createdAt', c.created_at,
    'updatedAt', c.updated_at,
    'version', c.version,
    'operationId', coalesce(c.last_operation_id, ''),
    'ativa', c.active,
    'desativadaEm', c.deactivated_at
  ) order by c.created_at desc), '[]'::jsonb) into v_result
  from public.campaigns c where c.organization_id = v_org;
  return v_result;
end;
$$;

create or replace function public.app_get_campanha_destinatarios(p_campanha_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.app_require_organization(6);
  v_campaign uuid;
  v_result jsonb;
begin
  select id into v_campaign from public.campaigns
  where organization_id = v_org and (legacy_campaign_id = p_campanha_id or id::text = p_campanha_id) limit 1;
  if v_campaign is null then return '[]'::jsonb; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', r.id::text,
    'campanhaId', p_campanha_id,
    'contactKey', r.contact_key,
    'nome', r.name,
    'telefone', coalesce(r.phone, ''),
    'perfisJson', r.profiles::text,
    'cadastroIdsJson', coalesce(r.legacy_data->>'cadastroIdsJson', ids.value::text, '[]'),
    'contratosJson', coalesce(r.legacy_data->>'contratosJson', contracts.value::text, '[]'),
    'contextoJson', r.context::text,
    'mensagemRenderizada', r.rendered_message,
    'status', public.app_recipient_status_to_legacy(r.status),
    'whatsappAbertoEm', r.whatsapp_opened_at,
    'envioConfirmadoEm', r.send_confirmed_at,
    'ignoradoEm', r.ignored_at,
    'motivo', coalesce(r.reason, ''),
    'createdAt', r.created_at,
    'updatedAt', r.updated_at,
    'version', r.version,
    'operationId', coalesce(r.last_operation_id, '')
  ) order by r.created_at), '[]'::jsonb) into v_result
  from public.campaign_recipients r
  left join lateral (
    select jsonb_agg(public.app_public_contract_id(c) order by c.contract_number) value
    from public.campaign_recipient_contracts rc join public.contracts c on c.id = rc.contract_id
    where rc.recipient_id = r.id
  ) ids on true
  left join lateral (
    select jsonb_agg(c.contract_number order by c.contract_number) value
    from public.campaign_recipient_contracts rc join public.contracts c on c.id = rc.contract_id
    where rc.recipient_id = r.id
  ) contracts on true
  where r.organization_id = v_org and r.campaign_id = v_campaign;
  return v_result;
end;
$$;

create or replace function public.app_save_cadastro(p_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.app_require_organization(1);
  v_operation text := coalesce(p_data->>'operationId', p_data->>'id');
  v_claim jsonb;
  v_contract_id uuid;
  v_property_id uuid;
  v_condominium_id uuid;
  v_owner_id uuid;
  v_tenant_id uuid;
  v_renewed_id uuid;
  v_contract_number text := trim(coalesce(p_data->>'contrato', ''));
  v_public_id text := coalesce(nullif(p_data->>'id', ''), v_operation);
  v_version integer;
  v_result jsonb;
begin
  v_claim := public.app_operation_claim(v_org, 'CADASTRO_CREATE', v_operation, 'saveCadastro', 'contract', v_public_id, null, p_data - 'operationId');
  if v_claim is not null then return v_claim; end if;

  if v_contract_number = '' then
    v_result := jsonb_build_object('error', 'Informe o numero do contrato.', 'code', 'VALIDATION_ERROR');
    return public.app_operation_finish(v_org, 'CADASTRO_CREATE', v_operation, 'ERROR', v_result, null, 'VALIDATION_ERROR');
  end if;

  if exists(select 1 from public.contracts where organization_id = v_org and normalized_contract_number = public.normalize_legacy_text(v_contract_number)) then
    v_result := jsonb_build_object('error', 'Numero de contrato ja existe.', 'code', 'DUPLICATE_CONTRACT');
    return public.app_operation_finish(v_org, 'CADASTRO_CREATE', v_operation, 'ERROR', v_result, null, 'DUPLICATE_CONTRACT');
  end if;

  if nullif(trim(coalesce(p_data->>'condominio', '')), '') is not null then
    insert into public.condominiums (organization_id, name, normalized_name)
    values (v_org, trim(p_data->>'condominio'), public.normalize_legacy_text(p_data->>'condominio'))
    on conflict (organization_id, normalized_name) do update set name = excluded.name, active = true
    returning id into v_condominium_id;
  end if;

  insert into public.properties (organization_id, address, property_type, purpose, condominium_id, legacy_data)
  values (v_org, nullif(p_data->>'enderecoImovel', ''), nullif(p_data->>'tipoImovel', ''), nullif(p_data->>'finalidade', ''), v_condominium_id, p_data)
  returning id into v_property_id;

  if nullif(p_data->>'renewedFromId', '') is not null then
    v_renewed_id := public.app_resolve_contract(v_org, p_data->>'renewedFromId');
  end if;

  insert into public.contracts (
    organization_id, legacy_primary_id, contract_number, normalized_contract_number,
    property_id, agent, starts_on, ends_on, due_day, rent_amount, commission_amount,
    status, renewed_from_id, legacy_data
  ) values (
    v_org, v_public_id, v_contract_number, public.normalize_legacy_text(v_contract_number),
    v_property_id, nullif(p_data->>'corretor', ''), nullif(p_data->>'inicioContrato', '')::date,
    nullif(p_data->>'fimContrato', '')::date, coalesce(nullif(p_data->>'diaVencimento', '')::smallint, 1),
    coalesce(nullif(p_data->>'valorAluguel', '')::numeric, 0), coalesce(nullif(p_data->>'comissao', '')::numeric, 0),
    public.app_contract_status_from_legacy(p_data->>'status'), v_renewed_id, p_data
  ) returning id, version into v_contract_id, v_version;

  v_owner_id := public.app_upsert_person(v_org, p_data->>'nomeProp', p_data->>'telProp', p_data->>'emailProp', p_data->>'niverProp', p_data);
  v_tenant_id := public.app_upsert_person(v_org, p_data->>'nomeInq', p_data->>'telInq', p_data->>'emailInq', p_data->>'niverInq', p_data);
  if v_owner_id is not null then
    insert into public.contract_parties (organization_id, contract_id, person_id, role, legacy_cadastro_ids)
    values (v_org, v_contract_id, v_owner_id, 'OWNER', array[v_public_id]);
  end if;
  if v_tenant_id is not null then
    insert into public.contract_parties (organization_id, contract_id, person_id, role, legacy_cadastro_ids)
    values (v_org, v_contract_id, v_tenant_id, 'TENANT', array[v_public_id]);
  end if;

  insert into public.checklists (organization_id, contract_id) values (v_org, v_contract_id)
  on conflict (organization_id, contract_id) do nothing;

  if v_renewed_id is not null then
    update public.contracts set status = 'RENEWED', version = version + 1 where id = v_renewed_id and deleted_at is null;
  end if;

  v_result := jsonb_build_object('success', true, 'id', v_public_id, 'version', v_version);
  return public.app_operation_finish(v_org, 'CADASTRO_CREATE', v_operation, 'SUCCESS', v_result, v_version);
end;
$$;

create or replace function public.app_update_cadastro(p_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.app_require_organization(1);
  v_operation text := p_data->>'operationId';
  v_expected integer := coalesce((p_data->>'expectedVersion')::integer, (p_data->>'version')::integer, 1);
  v_contract public.contracts%rowtype;
  v_claim jsonb;
  v_condominium_id uuid;
  v_owner_id uuid;
  v_tenant_id uuid;
  v_result jsonb;
begin
  v_claim := public.app_operation_claim(v_org, 'CADASTRO_UPDATE', v_operation, 'updateCadastro', 'contract', p_data->>'id', v_expected, p_data - 'operationId');
  if v_claim is not null then return v_claim; end if;

  select * into v_contract from public.contracts
  where id = public.app_resolve_contract(v_org, p_data->>'id') for update;
  if v_contract.id is null or v_contract.deleted_at is not null then
    v_result := jsonb_build_object('error', 'Cadastro nao encontrado.', 'code', 'NOT_FOUND');
    return public.app_operation_finish(v_org, 'CADASTRO_UPDATE', v_operation, 'ERROR', v_result, null, 'NOT_FOUND');
  end if;
  if v_contract.version <> v_expected then
    v_result := jsonb_build_object('error', 'O cadastro foi alterado por outra pessoa.', 'code', 'CADASTRO_CONFLICT', 'currentVersion', v_contract.version);
    return public.app_operation_finish(v_org, 'CADASTRO_UPDATE', v_operation, 'CONFLICT', v_result, v_contract.version, 'CADASTRO_CONFLICT');
  end if;
  if exists(select 1 from public.contracts c where c.organization_id = v_org and c.normalized_contract_number = public.normalize_legacy_text(p_data->>'contrato') and c.id <> v_contract.id) then
    v_result := jsonb_build_object('error', 'Numero de contrato ja existe.', 'code', 'DUPLICATE_CONTRACT');
    return public.app_operation_finish(v_org, 'CADASTRO_UPDATE', v_operation, 'ERROR', v_result, v_contract.version, 'DUPLICATE_CONTRACT');
  end if;

  if nullif(trim(coalesce(p_data->>'condominio', '')), '') is not null then
    insert into public.condominiums (organization_id, name, normalized_name)
    values (v_org, trim(p_data->>'condominio'), public.normalize_legacy_text(p_data->>'condominio'))
    on conflict (organization_id, normalized_name) do update set name = excluded.name, active = true
    returning id into v_condominium_id;
  end if;

  if v_contract.property_id is null then
    insert into public.properties (organization_id, address, property_type, purpose, condominium_id, legacy_data)
    values (v_org, nullif(p_data->>'enderecoImovel', ''), nullif(p_data->>'tipoImovel', ''), nullif(p_data->>'finalidade', ''), v_condominium_id, p_data)
    returning id into v_contract.property_id;
  else
    update public.properties set
      address = nullif(p_data->>'enderecoImovel', ''), property_type = nullif(p_data->>'tipoImovel', ''),
      purpose = nullif(p_data->>'finalidade', ''), condominium_id = v_condominium_id,
      legacy_data = legacy_data || p_data
    where id = v_contract.property_id;
  end if;

  update public.contracts set
    contract_number = trim(p_data->>'contrato'),
    normalized_contract_number = public.normalize_legacy_text(p_data->>'contrato'),
    property_id = v_contract.property_id,
    agent = nullif(p_data->>'corretor', ''),
    starts_on = nullif(p_data->>'inicioContrato', '')::date,
    ends_on = nullif(p_data->>'fimContrato', '')::date,
    due_day = coalesce(nullif(p_data->>'diaVencimento', '')::smallint, 1),
    rent_amount = coalesce(nullif(p_data->>'valorAluguel', '')::numeric, 0),
    commission_amount = coalesce(nullif(p_data->>'comissao', '')::numeric, 0),
    status = public.app_contract_status_from_legacy(p_data->>'status'),
    version = version + 1,
    legacy_data = legacy_data || p_data
  where id = v_contract.id returning version into v_contract.version;

  v_owner_id := public.app_upsert_person(v_org, p_data->>'nomeProp', p_data->>'telProp', p_data->>'emailProp', p_data->>'niverProp', p_data);
  v_tenant_id := public.app_upsert_person(v_org, p_data->>'nomeInq', p_data->>'telInq', p_data->>'emailInq', p_data->>'niverInq', p_data);
  delete from public.contract_parties where contract_id = v_contract.id;
  if v_owner_id is not null then insert into public.contract_parties values (v_org, v_contract.id, v_owner_id, 'OWNER', array[public.app_public_contract_id(v_contract)], now()); end if;
  if v_tenant_id is not null then insert into public.contract_parties values (v_org, v_contract.id, v_tenant_id, 'TENANT', array[public.app_public_contract_id(v_contract)], now()); end if;

  v_result := jsonb_build_object('success', true, 'id', public.app_public_contract_id(v_contract), 'version', v_contract.version);
  return public.app_operation_finish(v_org, 'CADASTRO_UPDATE', v_operation, 'SUCCESS', v_result, v_contract.version);
end;
$$;

create or replace function public.app_delete_cadastro(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.app_require_organization(1);
  v_operation text := p_payload->>'operationId';
  v_expected integer := coalesce((p_payload->>'expectedVersion')::integer, 1);
  v_contract public.contracts%rowtype;
  v_claim jsonb;
  v_result jsonb;
begin
  v_claim := public.app_operation_claim(v_org, 'CADASTRO_ARCHIVE', v_operation, 'deleteCadastro', 'contract', p_payload->>'id', v_expected, p_payload - 'operationId');
  if v_claim is not null then return v_claim; end if;
  select * into v_contract from public.contracts where id = public.app_resolve_contract(v_org, p_payload->>'id') for update;
  if v_contract.id is null then
    v_result := jsonb_build_object('error', 'Cadastro nao encontrado.', 'code', 'NOT_FOUND');
    return public.app_operation_finish(v_org, 'CADASTRO_ARCHIVE', v_operation, 'ERROR', v_result, null, 'NOT_FOUND');
  end if;
  if v_contract.deleted_at is not null then
    v_result := jsonb_build_object('success', true, 'status', 'already_updated', 'id', p_payload->>'id', 'version', v_contract.version);
    return public.app_operation_finish(v_org, 'CADASTRO_ARCHIVE', v_operation, 'SUCCESS', v_result, v_contract.version);
  end if;
  if v_contract.version <> v_expected then
    v_result := jsonb_build_object('error', 'O cadastro foi alterado por outra pessoa.', 'code', 'CADASTRO_CONFLICT', 'currentVersion', v_contract.version);
    return public.app_operation_finish(v_org, 'CADASTRO_ARCHIVE', v_operation, 'CONFLICT', v_result, v_contract.version, 'CADASTRO_CONFLICT');
  end if;
  update public.contracts set deleted_at = now(), status = 'CLOSED', version = version + 1 where id = v_contract.id returning version into v_contract.version;
  v_result := jsonb_build_object('success', true, 'id', p_payload->>'id', 'version', v_contract.version);
  return public.app_operation_finish(v_org, 'CADASTRO_ARCHIVE', v_operation, 'SUCCESS', v_result, v_contract.version);
end;
$$;

create or replace function public.app_update_checklist(p_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.app_require_organization(4);
  v_contract_id uuid := public.app_resolve_contract(v_org, p_data->>'id');
  v_operation text := p_data->>'operationId';
  v_expected integer := coalesce((p_data->>'version')::integer, 1);
  v_checklist public.checklists%rowtype;
  v_claim jsonb;
  v_result jsonb;
  v_docs jsonb := '[]'::jsonb;
  v_doc jsonb;
  v_index integer := 0;
begin
  v_claim := public.app_operation_claim(v_org, 'CHECKLIST_UPDATE', v_operation, 'updateChecklist', 'checklist', p_data->>'id', v_expected, p_data - 'operationId');
  if v_claim is not null then return v_claim; end if;
  if v_contract_id is null then
    v_result := jsonb_build_object('error', 'Checklist nao encontrado.', 'code', 'NOT_FOUND');
    return public.app_operation_finish(v_org, 'CHECKLIST_UPDATE', v_operation, 'ERROR', v_result, null, 'NOT_FOUND');
  end if;
  insert into public.checklists (organization_id, contract_id) values (v_org, v_contract_id)
  on conflict (organization_id, contract_id) do nothing;
  select * into v_checklist from public.checklists where organization_id = v_org and contract_id = v_contract_id for update;
  if v_checklist.last_operation_id = v_operation then
    v_result := jsonb_build_object('success', true, 'status', 'already_updated', 'version', v_checklist.version);
    return public.app_operation_finish(v_org, 'CHECKLIST_UPDATE', v_operation, 'SUCCESS', v_result, v_checklist.version);
  end if;
  if v_checklist.version <> v_expected then
    v_result := jsonb_build_object('error', 'O checklist foi modificado por outra pessoa.', 'code', 'CHECKLIST_CONFLICT', 'currentVersion', v_checklist.version);
    return public.app_operation_finish(v_org, 'CHECKLIST_UPDATE', v_operation, 'CONFLICT', v_result, v_checklist.version, 'CHECKLIST_CONFLICT');
  end if;
  begin
    v_docs := coalesce(nullif(p_data->>'documentos_json', '')::jsonb, '[]'::jsonb);
    if jsonb_typeof(v_docs) <> 'array' then v_docs := '[]'::jsonb; end if;
  exception when others then
    v_result := jsonb_build_object('error', 'Lista de documentos invalida.', 'code', 'VALIDATION_ERROR');
    return public.app_operation_finish(v_org, 'CHECKLIST_UPDATE', v_operation, 'ERROR', v_result, v_checklist.version, 'VALIDATION_ERROR');
  end;

  update public.checklists set
    owner_contract_sent = coalesce((p_data->>'prop_contratoEnviado')::boolean, false),
    owner_inspection_sent = coalesce((p_data->>'prop_vistoriaEnviada')::boolean, false),
    tenant_manual_delivered = coalesce((p_data->>'inq_manualEntregue')::boolean, false),
    tenant_inspection_signed = coalesce((p_data->>'inq_vistoriaAssinada')::boolean, false),
    tenant_fire_insurance = coalesce((p_data->>'inq_seguroIncendio')::boolean, false),
    version = version + 1, last_operation_id = v_operation, legacy_data = legacy_data || p_data
  where id = v_checklist.id returning version into v_checklist.version;

  delete from public.checklist_documents where checklist_id = v_checklist.id;
  for v_doc in select value from jsonb_array_elements(v_docs) loop
    insert into public.checklist_documents (
      organization_id, checklist_id, legacy_document_id, name, category, status,
      issue_notes, sort_order, legacy_data
    ) values (
      v_org, v_checklist.id, nullif(v_doc->>'id', ''), coalesce(nullif(v_doc->>'nome', ''), 'Documento'),
      nullif(v_doc->>'categoria', ''),
      case when v_doc->>'status' = 'Não se aplica' then 'NOT_APPLICABLE'
           when v_doc->>'status' = 'Feito' or coalesce((v_doc->>'isFeito')::boolean, false) then 'DONE'
           else 'PENDING' end,
      nullif(v_doc->>'pendencia', ''), v_index, v_doc
    );
    v_index := v_index + 1;
  end loop;

  v_result := jsonb_build_object('success', true, 'id', p_data->>'id', 'version', v_checklist.version);
  return public.app_operation_finish(v_org, 'CHECKLIST_UPDATE', v_operation, 'SUCCESS', v_result, v_checklist.version);
end;
$$;

create or replace function public.app_save_tarefa(p_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.app_require_organization(2);
  v_operation text := p_data->>'operationId';
  v_claim jsonb;
  v_task_id uuid;
  v_contract_id uuid;
  v_completed_at timestamptz := now();
  v_result jsonb;
begin
  v_claim := public.app_operation_claim(v_org, 'TASK_CREATE', v_operation, 'saveTarefa', 'task', null, null, p_data - 'operationId');
  if v_claim is not null then return v_claim; end if;
  select id into v_contract_id from public.contracts where organization_id = v_org and normalized_contract_number = public.normalize_legacy_text(p_data->>'contrato') limit 1;
  insert into public.tasks (organization_id, contract_id, legacy_task_id, completed_at, task_type, completed_by, reference, operation_id, legacy_data)
  values (v_org, v_contract_id, v_operation, v_completed_at, coalesce(p_data->>'tipo', ''), p_data->>'usuario', p_data->>'referencia', v_operation, p_data)
  returning id into v_task_id;
  v_result := jsonb_build_object('success', true, 'id', v_task_id::text, 'dataConclusao', v_completed_at);
  return public.app_operation_finish(v_org, 'TASK_CREATE', v_operation, 'SUCCESS', v_result, null);
end;
$$;

create or replace function public.app_delete_tarefa(p_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_org uuid := public.app_require_organization(2); begin
  update public.tasks set deleted_at = coalesce(deleted_at, now())
  where organization_id = v_org and (legacy_task_id = p_id or id::text = p_id);
  return jsonb_build_object('success', true, 'id', p_id);
end;
$$;

create or replace function public.app_upsert_condominio(p_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.app_require_organization(1);
  v_name text := trim(coalesce(p_data->>'nome', ''));
  v_row public.condominiums%rowtype;
begin
  if v_name = '' then return jsonb_build_object('error', 'Informe o nome do condominio.', 'code', 'VALIDATION_ERROR'); end if;
  insert into public.condominiums (organization_id, name, normalized_name, active, legacy_data)
  values (v_org, v_name, public.normalize_legacy_text(v_name), coalesce((p_data->>'ativo')::boolean, true), p_data)
  on conflict (organization_id, normalized_name) do update set
    name = excluded.name, active = excluded.active, legacy_data = public.condominiums.legacy_data || excluded.legacy_data
  returning * into v_row;
  return jsonb_build_object('success', true, 'id', v_row.id::text, 'data', jsonb_build_object(
    'id', v_row.id::text, 'nome', v_row.name, 'nomeNormalizado', v_row.normalized_name,
    'ativo', v_row.active, 'createdAt', v_row.created_at
  ));
end;
$$;

create or replace function public.app_sync_cobrancas()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.app_require_organization(5);
  v_inserted integer;
begin
  with months as (
    select generate_series(date_trunc('month', current_date) - interval '2 months', date_trunc('month', current_date), interval '1 month')::date competence
  ), inserted as (
    insert into public.charges (organization_id, contract_id, competence, due_on, amount)
    select v_org, c.id, m.competence,
      make_date(extract(year from m.competence)::int, extract(month from m.competence)::int,
        least(coalesce(c.due_day, 1), extract(day from (m.competence + interval '1 month - 1 day'))::int)),
      c.rent_amount
    from public.contracts c cross join months m
    where c.organization_id = v_org and c.deleted_at is null and c.status = 'ACTIVE'
      and (c.starts_on is null or c.starts_on <= m.competence + interval '1 month - 1 day')
      and (c.ends_on is null or c.ends_on >= m.competence)
    on conflict (organization_id, contract_id, competence) do nothing
    returning 1
  ) select count(*) into v_inserted from inserted;
  return jsonb_build_object('success', true, 'status', 'synced', 'created', v_inserted);
end;
$$;

create or replace function public.app_upsert_cobranca(p_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.app_require_organization(5);
  v_charge public.charges%rowtype;
  v_operation text;
  v_scope text;
  v_expected integer := coalesce((p_data->>'version')::integer, 1);
  v_claim jsonb;
  v_result jsonb;
begin
  select * into v_charge from public.charges
  where organization_id = v_org and (legacy_charge_id = p_data->>'id' or id::text = p_data->>'id') for update;
  if v_charge.id is null then return jsonb_build_object('error', 'Cobranca nao encontrada.', 'code', 'NOT_FOUND'); end if;
  if p_data->>'statusPagamento' = 'Pago' then
    v_operation := p_data->>'pagamentoOperationId'; v_scope := 'CHARGE_PAYMENT';
  else
    v_operation := p_data->>'envioOperationId'; v_scope := 'CHARGE_DELIVERY';
  end if;
  v_claim := public.app_operation_claim(v_org, v_scope, v_operation, 'upsertCobranca', 'charge', p_data->>'id', v_expected, p_data - 'updatedAt' - 'pagoEm' - 'envioConfirmadoEm');
  if v_claim is not null then return v_claim; end if;
  if v_charge.version <> v_expected then
    v_result := jsonb_build_object('error', 'A cobranca foi alterada por outra pessoa.', 'code', 'COBRANCA_CONFLICT', 'currentVersion', v_charge.version);
    return public.app_operation_finish(v_org, v_scope, v_operation, 'CONFLICT', v_result, v_charge.version, 'COBRANCA_CONFLICT');
  end if;
  update public.charges set
    status = case p_data->>'statusPagamento' when 'Pago' then 'PAID'::public.charge_status when 'Cancelado' then 'CANCELLED'::public.charge_status else status end,
    paid_at = case when p_data->>'statusPagamento' = 'Pago' then coalesce(nullif(p_data->>'pagoEm', '')::timestamptz, now()) else paid_at end,
    delivery_confirmed_at = case when v_scope = 'CHARGE_DELIVERY'
      then case when nullif(p_data->>'envioConfirmadoEm', '') is null then null else (p_data->>'envioConfirmadoEm')::timestamptz end
      else delivery_confirmed_at end,
    delivery_operation_id = case when v_scope = 'CHARGE_DELIVERY' then v_operation else delivery_operation_id end,
    payment_operation_id = case when v_scope = 'CHARGE_PAYMENT' then v_operation else payment_operation_id end,
    version = version + 1, legacy_data = legacy_data || p_data
  where id = v_charge.id returning * into v_charge;
  v_result := jsonb_build_object('success', true, 'id', p_data->>'id', 'version', v_charge.version);
  return public.app_operation_finish(v_org, v_scope, v_operation, 'SUCCESS', v_result, v_charge.version);
end;
$$;

create or replace function public.app_save_campanha(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.app_require_organization(6);
  v_operation text := p_payload->>'operationId';
  v_claim jsonb;
  v_id uuid;
  v_public_id text := coalesce(nullif(p_payload->>'id', ''), v_operation);
  v_result jsonb;
begin
  v_claim := public.app_operation_claim(v_org, 'CAMPAIGN_CREATE', v_operation, 'saveCampanha', 'campaign', v_public_id, null, p_payload - 'operationId');
  if v_claim is not null then return v_claim; end if;
  if nullif(trim(p_payload->>'nome'), '') is null or nullif(trim(p_payload->>'mensagemTemplate'), '') is null then
    v_result := jsonb_build_object('error', 'Nome e mensagem sao obrigatorios.', 'code', 'VALIDATION_ERROR');
    return public.app_operation_finish(v_org, 'CAMPAIGN_CREATE', v_operation, 'ERROR', v_result, null, 'VALIDATION_ERROR');
  end if;
  insert into public.campaigns (organization_id, legacy_campaign_id, name, description, message_template, filters, created_by, last_operation_id)
  values (v_org, v_public_id, trim(p_payload->>'nome'), p_payload->>'descricao', p_payload->>'mensagemTemplate', coalesce(nullif(p_payload->>'filtrosJson', '')::jsonb, '{}'::jsonb), auth.uid()::text, v_operation)
  returning id into v_id;
  v_result := jsonb_build_object('success', true, 'id', v_public_id, 'version', 1);
  return public.app_operation_finish(v_org, 'CAMPAIGN_CREATE', v_operation, 'SUCCESS', v_result, 1);
end;
$$;

create or replace function public.app_change_campanha(p_action text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.app_require_organization(6);
  v_operation text := p_payload->>'operationId';
  v_expected integer := coalesce((p_payload->>'expectedVersion')::integer, 1);
  v_campaign public.campaigns%rowtype;
  v_scope text := 'CAMPAIGN_' || upper(p_action);
  v_claim jsonb;
  v_result jsonb;
begin
  v_claim := public.app_operation_claim(v_org, v_scope, v_operation, p_action, 'campaign', p_payload->>'id', v_expected, p_payload - 'operationId');
  if v_claim is not null then return v_claim; end if;
  select * into v_campaign from public.campaigns
  where organization_id = v_org and (legacy_campaign_id = p_payload->>'id' or id::text = p_payload->>'id') for update;
  if v_campaign.id is null then
    v_result := jsonb_build_object('error', 'Campanha nao encontrada.', 'code', 'NOT_FOUND');
    return public.app_operation_finish(v_org, v_scope, v_operation, 'ERROR', v_result, null, 'NOT_FOUND');
  end if;
  if v_campaign.version <> v_expected then
    v_result := jsonb_build_object('error', 'A campanha foi modificada por outra pessoa.', 'code', 'CAMPAIGN_CONFLICT', 'currentVersion', v_campaign.version);
    return public.app_operation_finish(v_org, v_scope, v_operation, 'CONFLICT', v_result, v_campaign.version, 'CAMPAIGN_CONFLICT');
  end if;

  if p_action = 'updateCampanha' then
    if v_campaign.status <> 'DRAFT' then
      v_result := jsonb_build_object('error', 'Somente campanhas em rascunho podem ser editadas.', 'code', 'INVALID_STATUS');
      return public.app_operation_finish(v_org, v_scope, v_operation, 'ERROR', v_result, v_campaign.version, 'INVALID_STATUS');
    end if;
    update public.campaigns set
      name = coalesce(nullif(p_payload->>'nome', ''), name), description = coalesce(p_payload->>'descricao', description),
      message_template = coalesce(nullif(p_payload->>'mensagemTemplate', ''), message_template),
      filters = case when nullif(p_payload->>'filtrosJson', '') is null then filters else (p_payload->>'filtrosJson')::jsonb end,
      version = version + 1, last_operation_id = v_operation
    where id = v_campaign.id returning * into v_campaign;
  elsif p_action = 'arquivarCampanha' then
    update public.campaigns set status = 'ARCHIVED', active = false, deactivated_at = now(), version = version + 1, last_operation_id = v_operation where id = v_campaign.id returning * into v_campaign;
  elsif p_action = 'cancelarCampanha' then
    update public.campaigns set status = 'CANCELLED', finished_at = now(), version = version + 1, last_operation_id = v_operation where id = v_campaign.id returning * into v_campaign;
  elsif p_action = 'setCampanhaAtiva' then
    update public.campaigns set active = coalesce((p_payload->>'ativa')::boolean, true), deactivated_at = case when coalesce((p_payload->>'ativa')::boolean, true) then null else now() end, version = version + 1, last_operation_id = v_operation where id = v_campaign.id returning * into v_campaign;
  else
    v_result := jsonb_build_object('error', 'Acao de campanha invalida.', 'code', 'VALIDATION_ERROR');
    return public.app_operation_finish(v_org, v_scope, v_operation, 'ERROR', v_result, v_campaign.version, 'VALIDATION_ERROR');
  end if;
  v_result := jsonb_build_object('success', true, 'id', p_payload->>'id', 'version', v_campaign.version, 'ativa', v_campaign.active);
  return public.app_operation_finish(v_org, v_scope, v_operation, 'SUCCESS', v_result, v_campaign.version);
end;
$$;

create or replace function public.app_update_campanha(p_payload jsonb) returns jsonb language sql security definer set search_path = public as $$ select public.app_change_campanha('updateCampanha', p_payload) $$;
create or replace function public.app_arquivar_campanha(p_payload jsonb) returns jsonb language sql security definer set search_path = public as $$ select public.app_change_campanha('arquivarCampanha', p_payload) $$;
create or replace function public.app_cancelar_campanha(p_payload jsonb) returns jsonb language sql security definer set search_path = public as $$ select public.app_change_campanha('cancelarCampanha', p_payload) $$;
create or replace function public.app_set_campanha_ativa(p_payload jsonb) returns jsonb language sql security definer set search_path = public as $$ select public.app_change_campanha('setCampanhaAtiva', p_payload) $$;

create or replace function public.app_iniciar_campanha(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.app_require_organization(6);
  v_operation text := p_payload->>'operationId';
  v_expected integer := coalesce((p_payload->>'expectedVersion')::integer, 1);
  v_campaign public.campaigns%rowtype;
  v_claim jsonb;
  v_result jsonb;
  v_recipient jsonb;
  v_recipient_id uuid;
  v_contract_value jsonb;
  v_contract_id uuid;
  v_total integer;
begin
  v_claim := public.app_operation_claim(v_org, 'CAMPAIGN_START', v_operation, 'iniciarCampanha', 'campaign', p_payload->>'id', v_expected, p_payload - 'operationId');
  if v_claim is not null then return v_claim; end if;
  select * into v_campaign from public.campaigns
  where organization_id = v_org and (legacy_campaign_id = p_payload->>'id' or id::text = p_payload->>'id') for update;
  if v_campaign.id is null then
    v_result := jsonb_build_object('error', 'Campanha nao encontrada.', 'code', 'NOT_FOUND');
    return public.app_operation_finish(v_org, 'CAMPAIGN_START', v_operation, 'ERROR', v_result, null, 'NOT_FOUND');
  end if;
  if v_campaign.version <> v_expected then
    v_result := jsonb_build_object('error', 'A campanha foi modificada por outra pessoa.', 'code', 'CAMPAIGN_CONFLICT', 'currentVersion', v_campaign.version);
    return public.app_operation_finish(v_org, 'CAMPAIGN_START', v_operation, 'CONFLICT', v_result, v_campaign.version, 'CAMPAIGN_CONFLICT');
  end if;
  if v_campaign.status <> 'DRAFT' then
    v_result := jsonb_build_object('error', 'A campanha nao esta em rascunho.', 'code', 'INVALID_STATUS');
    return public.app_operation_finish(v_org, 'CAMPAIGN_START', v_operation, 'ERROR', v_result, v_campaign.version, 'INVALID_STATUS');
  end if;

  for v_recipient in select value from jsonb_array_elements(coalesce(p_payload->'destinatarios', '[]'::jsonb)) loop
    insert into public.campaign_recipients (
      id, organization_id, campaign_id, contact_key, name, phone, profiles, context,
      rendered_message, status, last_operation_id, legacy_data
    ) values (
      case when coalesce(v_recipient->>'id', '') ~* '^[0-9a-f-]{36}$' then (v_recipient->>'id')::uuid else extensions.gen_random_uuid() end,
      v_org, v_campaign.id, v_recipient->>'contactKey', coalesce(v_recipient->>'nome', ''), v_recipient->>'telefone',
      coalesce(nullif(v_recipient->>'perfisJson', '')::jsonb, '[]'::jsonb),
      coalesce(nullif(v_recipient->>'contextoJson', '')::jsonb, '{}'::jsonb),
      coalesce(v_recipient->>'mensagemRenderizada', ''), 'PENDING', v_operation, v_recipient
    ) on conflict (campaign_id, contact_key) do nothing
    returning id into v_recipient_id;

    if v_recipient_id is null then
      select id into v_recipient_id from public.campaign_recipients where campaign_id = v_campaign.id and contact_key = v_recipient->>'contactKey';
    end if;
    for v_contract_value in select value from jsonb_array_elements(coalesce(nullif(v_recipient->>'cadastroIdsJson', '')::jsonb, '[]'::jsonb)) loop
      v_contract_id := public.app_resolve_contract(v_org, trim(both '"' from v_contract_value::text));
      if v_contract_id is not null then
        insert into public.campaign_recipient_contracts (organization_id, recipient_id, contract_id)
        values (v_org, v_recipient_id, v_contract_id) on conflict do nothing;
      end if;
    end loop;
    v_recipient_id := null;
  end loop;

  select count(*) into v_total from public.campaign_recipients where campaign_id = v_campaign.id;
  update public.campaigns set status = 'STARTED', started_at = coalesce(started_at, now()), audience_total = v_total,
    version = version + 1, last_operation_id = v_operation
  where id = v_campaign.id returning * into v_campaign;
  v_result := jsonb_build_object('success', true, 'id', p_payload->>'id', 'version', v_campaign.version, 'audienciaTotal', v_total);
  return public.app_operation_finish(v_org, 'CAMPAIGN_START', v_operation, 'SUCCESS', v_result, v_campaign.version);
end;
$$;

create or replace function public.app_update_campanha_destinatario(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.app_require_organization(6);
  v_operation text := p_payload->>'operationId';
  v_expected integer := coalesce((p_payload->>'expectedVersion')::integer, 1);
  v_recipient public.campaign_recipients%rowtype;
  v_new_status public.campaign_recipient_status;
  v_claim jsonb;
  v_result jsonb;
  v_allowed boolean := false;
begin
  v_new_status := case p_payload->>'status'
    when 'WHATSAPP_ABERTO' then 'WHATSAPP_OPENED'::public.campaign_recipient_status
    when 'ENVIO_CONFIRMADO' then 'SEND_CONFIRMED'::public.campaign_recipient_status
    when 'IGNORADO' then 'IGNORED'::public.campaign_recipient_status
    when 'ERRO' then 'ERROR'::public.campaign_recipient_status
    else 'PENDING'::public.campaign_recipient_status end;
  v_claim := public.app_operation_claim(v_org, 'CAMPAIGN_RECIPIENT_UPDATE', v_operation, 'updateCampanhaDestinatario', 'campaign_recipient', p_payload->>'id', v_expected, p_payload - 'operationId');
  if v_claim is not null then return v_claim; end if;
  select * into v_recipient from public.campaign_recipients where organization_id = v_org and id::text = p_payload->>'id' for update;
  if v_recipient.id is null then
    v_result := jsonb_build_object('error', 'Destinatario nao encontrado.', 'code', 'NOT_FOUND');
    return public.app_operation_finish(v_org, 'CAMPAIGN_RECIPIENT_UPDATE', v_operation, 'ERROR', v_result, null, 'NOT_FOUND');
  end if;
  if v_recipient.version <> v_expected then
    v_result := jsonb_build_object('error', 'O destinatario foi modificado por outra pessoa.', 'code', 'DESTINATARIO_CONFLICT', 'currentVersion', v_recipient.version);
    return public.app_operation_finish(v_org, 'CAMPAIGN_RECIPIENT_UPDATE', v_operation, 'CONFLICT', v_result, v_recipient.version, 'DESTINATARIO_CONFLICT');
  end if;
  v_allowed :=
    (v_recipient.status = 'PENDING' and v_new_status in ('WHATSAPP_OPENED', 'SEND_CONFIRMED', 'IGNORED', 'ERROR')) or
    (v_recipient.status = 'WHATSAPP_OPENED' and v_new_status in ('SEND_CONFIRMED', 'IGNORED', 'ERROR')) or
    (v_recipient.status = 'ERROR' and v_new_status in ('PENDING', 'WHATSAPP_OPENED', 'SEND_CONFIRMED', 'IGNORED'));
  if not v_allowed then
    v_result := jsonb_build_object('error', 'Transicao de status invalida.', 'code', 'INVALID_STATUS_TRANSITION');
    return public.app_operation_finish(v_org, 'CAMPAIGN_RECIPIENT_UPDATE', v_operation, 'ERROR', v_result, v_recipient.version, 'INVALID_STATUS_TRANSITION');
  end if;
  update public.campaign_recipients set
    status = v_new_status,
    whatsapp_opened_at = case when v_new_status = 'WHATSAPP_OPENED' then now() else whatsapp_opened_at end,
    send_confirmed_at = case when v_new_status = 'SEND_CONFIRMED' then now() else send_confirmed_at end,
    ignored_at = case when v_new_status = 'IGNORED' then now() else ignored_at end,
    reason = coalesce(p_payload->>'motivo', reason), version = version + 1, last_operation_id = v_operation
  where id = v_recipient.id returning * into v_recipient;
  v_result := jsonb_build_object('success', true, 'id', v_recipient.id::text, 'version', v_recipient.version);
  return public.app_operation_finish(v_org, 'CAMPAIGN_RECIPIENT_UPDATE', v_operation, 'SUCCESS', v_result, v_recipient.version);
end;
$$;

revoke all on function public.app_require_organization(integer) from public;
revoke all on function public.app_require_any_interface(integer[]) from public;
revoke all on function public.app_operation_claim(uuid,text,text,text,text,text,integer,jsonb) from public;
revoke all on function public.app_operation_finish(uuid,text,text,public.operation_status,jsonb,integer,text) from public;
revoke all on function public.app_public_contract_id(public.contracts) from public;
revoke all on function public.app_contract_status_to_legacy(public.contract_status) from public;
revoke all on function public.app_contract_status_from_legacy(text) from public;
revoke all on function public.app_charge_status_to_legacy(public.charge_status) from public;
revoke all on function public.app_campaign_status_to_legacy(public.campaign_status) from public;
revoke all on function public.app_recipient_status_to_legacy(public.campaign_recipient_status) from public;
revoke all on function public.app_resolve_contract(uuid,text) from public;
revoke all on function public.app_upsert_person(uuid,text,text,text,text,jsonb) from public;
revoke all on function public.app_change_campanha(text,jsonb) from public;

revoke all on function public.app_get_cadastros() from public;
revoke all on function public.app_get_checklists() from public;
revoke all on function public.app_get_tarefas() from public;
revoke all on function public.app_get_condominios() from public;
revoke all on function public.app_get_cobrancas() from public;
revoke all on function public.app_get_campanhas() from public;
revoke all on function public.app_get_campanha_destinatarios(text) from public;
revoke all on function public.app_save_cadastro(jsonb) from public;
revoke all on function public.app_update_cadastro(jsonb) from public;
revoke all on function public.app_delete_cadastro(jsonb) from public;
revoke all on function public.app_update_checklist(jsonb) from public;
revoke all on function public.app_save_tarefa(jsonb) from public;
revoke all on function public.app_delete_tarefa(text) from public;
revoke all on function public.app_upsert_condominio(jsonb) from public;
revoke all on function public.app_sync_cobrancas() from public;
revoke all on function public.app_upsert_cobranca(jsonb) from public;
revoke all on function public.app_save_campanha(jsonb) from public;
revoke all on function public.app_update_campanha(jsonb) from public;
revoke all on function public.app_arquivar_campanha(jsonb) from public;
revoke all on function public.app_cancelar_campanha(jsonb) from public;
revoke all on function public.app_set_campanha_ativa(jsonb) from public;
revoke all on function public.app_iniciar_campanha(jsonb) from public;
revoke all on function public.app_update_campanha_destinatario(jsonb) from public;

grant execute on function public.app_get_cadastros() to authenticated;
grant execute on function public.app_get_checklists() to authenticated;
grant execute on function public.app_get_tarefas() to authenticated;
grant execute on function public.app_get_condominios() to authenticated;
grant execute on function public.app_get_cobrancas() to authenticated;
grant execute on function public.app_get_campanhas() to authenticated;
grant execute on function public.app_get_campanha_destinatarios(text) to authenticated;
grant execute on function public.app_save_cadastro(jsonb) to authenticated;
grant execute on function public.app_update_cadastro(jsonb) to authenticated;
grant execute on function public.app_delete_cadastro(jsonb) to authenticated;
grant execute on function public.app_update_checklist(jsonb) to authenticated;
grant execute on function public.app_save_tarefa(jsonb) to authenticated;
grant execute on function public.app_delete_tarefa(text) to authenticated;
grant execute on function public.app_upsert_condominio(jsonb) to authenticated;
grant execute on function public.app_sync_cobrancas() to authenticated;
grant execute on function public.app_upsert_cobranca(jsonb) to authenticated;
grant execute on function public.app_save_campanha(jsonb) to authenticated;
grant execute on function public.app_update_campanha(jsonb) to authenticated;
grant execute on function public.app_arquivar_campanha(jsonb) to authenticated;
grant execute on function public.app_cancelar_campanha(jsonb) to authenticated;
grant execute on function public.app_set_campanha_ativa(jsonb) to authenticated;
grant execute on function public.app_iniciar_campanha(jsonb) to authenticated;
grant execute on function public.app_update_campanha_destinatario(jsonb) to authenticated;

commit;
