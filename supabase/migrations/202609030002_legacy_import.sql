begin;

create or replace function public.legacy_uuid(p_scope text, p_value text)
returns uuid
language sql
immutable
parallel safe
set search_path = public
as $$
  select (
    substr(v, 1, 8) || '-' || substr(v, 9, 4) || '-' || substr(v, 13, 4) || '-' ||
    substr(v, 17, 4) || '-' || substr(v, 21, 12)
  )::uuid
  from (select md5(coalesce(p_scope, '') || ':' || coalesce(p_value, '')) v) digest;
$$;

create or replace function public.legacy_boolean(p_value text, p_default boolean default false)
returns boolean
language sql
immutable
parallel safe
set search_path = public
as $$
  select case public.normalize_legacy_text(p_value)
    when 'true' then true when 'verdadeiro' then true when 'sim' then true when '1' then true
    when 'false' then false when 'falso' then false when 'nao' then false when '0' then false
    else p_default
  end;
$$;

create or replace function public.legacy_integer(p_value text, p_default integer default null)
returns integer
language plpgsql
immutable
parallel safe
set search_path = public
as $$
begin
  if nullif(trim(coalesce(p_value, '')), '') is null then return p_default; end if;
  return round(replace(trim(p_value), ',', '.')::numeric)::integer;
exception when others then
  return p_default;
end;
$$;

create or replace function public.legacy_numeric(p_value text)
returns numeric
language plpgsql
immutable
parallel safe
set search_path = public
as $$
declare
  v text := regexp_replace(trim(coalesce(p_value, '')), '[^0-9,.-]', '', 'g');
begin
  if v = '' then return null; end if;
  if position(',' in v) > 0 then
    v := replace(replace(v, '.', ''), ',', '.');
  end if;
  return v::numeric;
exception when others then
  return null;
end;
$$;

create or replace function public.legacy_date(p_value text)
returns date
language plpgsql
immutable
parallel safe
set search_path = public
as $$
declare
  v text := trim(coalesce(p_value, ''));
  m text[];
begin
  if v = '' then return null; end if;
  m := regexp_match(v, '^(\d{1,2})/(\d{1,2})/(\d{4})');
  if m is not null then return make_date(m[3]::integer, m[2]::integer, m[1]::integer); end if;
  m := regexp_match(v, '^(\d{4})-(\d{1,2})-(\d{1,2})');
  if m is not null then return make_date(m[1]::integer, m[2]::integer, m[3]::integer); end if;
  return v::date;
exception when others then
  return null;
end;
$$;

create or replace function public.legacy_timestamp(p_value text)
returns timestamptz
language plpgsql
immutable
parallel safe
set search_path = public
as $$
declare
  v text := trim(coalesce(p_value, ''));
begin
  if v = '' then return null; end if;
  return v::timestamptz;
exception when others then
  return public.legacy_date(v)::timestamptz;
end;
$$;

create or replace function public.legacy_json_array(p_value text)
returns jsonb
language plpgsql
immutable
parallel safe
set search_path = public
as $$
declare
  v jsonb;
begin
  if nullif(trim(coalesce(p_value, '')), '') is null then return '[]'::jsonb; end if;
  v := p_value::jsonb;
  if jsonb_typeof(v) <> 'array' then return '[]'::jsonb; end if;
  return v;
exception when others then
  return '[]'::jsonb;
end;
$$;

create or replace function public.legacy_json_object(p_value text)
returns jsonb
language plpgsql
immutable
parallel safe
set search_path = public
as $$
declare
  v jsonb;
begin
  if nullif(trim(coalesce(p_value, '')), '') is null then return '{}'::jsonb; end if;
  v := p_value::jsonb;
  if jsonb_typeof(v) <> 'object' then return '{}'::jsonb; end if;
  return v;
exception when others then
  return '{}'::jsonb;
end;
$$;

create or replace function public.legacy_birth_part(p_value text, p_part text)
returns smallint
language plpgsql
immutable
parallel safe
set search_path = public
as $$
declare
  m text[];
  d date;
begin
  m := regexp_match(trim(coalesce(p_value, '')), '^(\d{1,2})[/-](\d{1,2})');
  if m is not null then
    if p_part = 'day' then return m[1]::smallint; end if;
    return m[2]::smallint;
  end if;
  d := public.legacy_date(p_value);
  if d is null then return null; end if;
  if p_part = 'day' then return extract(day from d)::smallint; end if;
  return extract(month from d)::smallint;
exception when others then
  return null;
end;
$$;

create or replace function public.legacy_competence(p_value text)
returns date
language plpgsql
immutable
parallel safe
set search_path = public
as $$
declare
  v text := trim(coalesce(p_value, ''));
  m text[];
begin
  m := regexp_match(v, '^(\d{4})[-/](\d{1,2})');
  if m is not null then return make_date(m[1]::integer, m[2]::integer, 1); end if;
  m := regexp_match(v, '^(\d{1,2})[-/](\d{4})');
  if m is not null then return make_date(m[2]::integer, m[1]::integer, 1); end if;
  return date_trunc('month', public.legacy_date(v))::date;
exception when others then
  return null;
end;
$$;

create or replace function public.legacy_due_date(p_competence date, p_due_day integer)
returns date
language sql
immutable
parallel safe
set search_path = public
as $$
  select case when p_competence is null then null else
    make_date(
      extract(year from p_competence)::integer,
      extract(month from p_competence)::integer,
      least(greatest(coalesce(p_due_day, 1), 1), extract(day from (date_trunc('month', p_competence) + interval '1 month - 1 day'))::integer)
    )
  end;
$$;

create or replace function public.find_legacy_contract(
  p_run_id uuid,
  p_organization_id uuid,
  p_cadastro_id text,
  p_contract_number text
)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select m.new_id from public.legacy_identity_map m
      where m.migration_run_id = p_run_id and m.entity_type = 'cadastro' and m.legacy_id = nullif(trim(p_cadastro_id), '') limit 1),
    (select c.id from public.contracts c
      where c.organization_id = p_organization_id
        and c.normalized_contract_number = public.normalize_legacy_text(p_contract_number) limit 1)
  );
$$;

create or replace function public.bootstrap_migration_organization(p_name text, p_slug text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_id uuid;
begin
  insert into public.organizations (name, slug)
  values (trim(p_name), public.normalize_legacy_text(p_slug))
  on conflict (slug) do update set name = excluded.name, active = true
  returning id into v_id;

  insert into public.app_settings (organization_id, data_backend, schema_version)
  values (v_id, 'gas', 1)
  on conflict (organization_id) do nothing;
  return v_id;
end;
$$;

create or replace function public.stage_legacy_snapshot(
  p_organization_id uuid,
  p_source_id text,
  p_source_checksum text,
  p_snapshot jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_run_id uuid;
  v_status public.migration_status;
  v_counts jsonb;
  v_sheet text;
  v_rows jsonb;
  v_row record;
  v_source_row integer;
  v_source_key text;
begin
  if not exists (select 1 from public.organizations where id = p_organization_id) then
    raise exception 'ORGANIZATION_NOT_FOUND';
  end if;
  if jsonb_typeof(p_snapshot -> 'sheets') <> 'object' then
    raise exception 'INVALID_SNAPSHOT';
  end if;

  select coalesce(jsonb_object_agg(key, jsonb_array_length(value)), '{}'::jsonb)
  into v_counts
  from jsonb_each(p_snapshot -> 'sheets')
  where jsonb_typeof(value) = 'array';

  insert into public.migration_runs (organization_id, source_id, source_checksum, status, source_counts)
  values (p_organization_id, p_source_id, p_source_checksum, 'STAGED', v_counts)
  on conflict (organization_id, source_id, source_checksum)
  do update set source_counts = excluded.source_counts
  returning id, status into v_run_id, v_status;

  if v_status = 'COMPLETED' then return v_run_id; end if;

  delete from public.migration_source_rows where migration_run_id = v_run_id;
  delete from public.migration_errors where migration_run_id = v_run_id;
  delete from public.legacy_identity_map where migration_run_id = v_run_id;

  for v_sheet, v_rows in
    select key, value from jsonb_each(p_snapshot -> 'sheets') where jsonb_typeof(value) = 'array'
  loop
    for v_row in select value, ordinality from jsonb_array_elements(v_rows) with ordinality
    loop
      v_source_row := coalesce(public.legacy_integer(v_row.value ->> '_sourceRow'), v_row.ordinality::integer + 1);
      v_source_key := coalesce(
        nullif(trim(v_row.value ->> 'id'), ''),
        nullif(trim(v_row.value ->> 'idTarefa'), ''),
        nullif(trim(v_row.value ->> 'operationId'), ''),
        nullif(trim(v_row.value ->> 'contrato'), '')
      );
      insert into public.migration_source_rows
        (migration_run_id, sheet_name, source_row, source_key, row_checksum, raw_data)
      values
        (v_run_id, v_sheet, v_source_row, v_source_key,
         encode(extensions.digest(v_row.value::text, 'sha256'), 'hex'), v_row.value - '_sourceRow')
      on conflict (migration_run_id, sheet_name, source_row)
      do update set source_key = excluded.source_key, row_checksum = excluded.row_checksum, raw_data = excluded.raw_data;
    end loop;
  end loop;

  update public.app_settings set legacy_source_id = p_source_id where organization_id = p_organization_id;
  update public.migration_runs set status = 'STAGED', error_message = null where id = v_run_id;
  return v_run_id;
end;
$$;

create or replace function public.apply_legacy_migration(p_run_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_run public.migration_runs%rowtype;
  v_source record;
  v_doc record;
  v_item record;
  v_data jsonb;
  v_org uuid;
  v_legacy_id text;
  v_contract_norm text;
  v_contract_id uuid;
  v_property_id uuid;
  v_person_id uuid;
  v_checklist_id uuid;
  v_campaign_id uuid;
  v_recipient_id uuid;
  v_condominium_id uuid;
  v_condominium_norm text;
  v_name_norm text;
  v_phone_norm text;
  v_competence date;
  v_due_on date;
  v_result jsonb;
begin
  select * into v_run from public.migration_runs where id = p_run_id for update;
  if not found then raise exception 'MIGRATION_RUN_NOT_FOUND'; end if;
  if v_run.status = 'COMPLETED' then
    return jsonb_build_object('success', true, 'status', 'already_completed', 'counts', v_run.result_counts);
  end if;
  v_org := v_run.organization_id;
  update public.migration_runs set status = 'RUNNING', started_at = coalesce(started_at, now()), error_message = null where id = p_run_id;

  begin
    -- Condomínios explícitos.
    for v_source in
      select * from public.migration_source_rows where migration_run_id = p_run_id and sheet_name = 'Condominios' order by source_row
    loop
      v_data := v_source.raw_data;
      v_condominium_norm := public.normalize_legacy_text(coalesce(v_data ->> 'nomeNormalizado', v_data ->> 'nome'));
      if v_condominium_norm <> '' then
        v_condominium_id := public.legacy_uuid(v_org::text || ':condominium', v_condominium_norm);
        insert into public.condominiums (id, organization_id, name, normalized_name, active, legacy_data, created_at)
        values (v_condominium_id, v_org, trim(v_data ->> 'nome'), v_condominium_norm,
          public.legacy_boolean(v_data ->> 'ativo', true), v_data,
          coalesce(public.legacy_timestamp(v_data ->> 'createdAt'), now()))
        on conflict (organization_id, normalized_name) do update set
          name = excluded.name, active = excluded.active, legacy_data = excluded.legacy_data;
        if nullif(trim(v_data ->> 'id'), '') is not null then
          insert into public.legacy_identity_map values
            (p_run_id, v_org, 'condominio', trim(v_data ->> 'id'), v_condominium_id, 'Condominios', v_source.source_row, now())
          on conflict (migration_run_id, entity_type, legacy_id) do update set new_id = excluded.new_id;
        end if;
      end if;
    end loop;

    -- Cadastros: imóvel, contrato, pessoas e vínculos. Duplicatas de contrato convergem para o mesmo UUID.
    for v_source in
      select * from public.migration_source_rows where migration_run_id = p_run_id and sheet_name = 'Cadastros' order by source_row
    loop
      v_data := v_source.raw_data;
      v_legacy_id := trim(v_data ->> 'id');
      v_contract_norm := public.normalize_legacy_text(v_data ->> 'contrato');
      if v_legacy_id = '' or v_contract_norm = '' then
        insert into public.migration_errors (migration_run_id, sheet_name, source_row, code, message, raw_data)
        values (p_run_id, 'Cadastros', v_source.source_row, 'INVALID_CADASTRO', 'Cadastro sem ID ou contrato.', v_data);
        continue;
      end if;

      v_contract_id := public.legacy_uuid(v_org::text || ':contract', v_contract_norm);
      v_property_id := public.legacy_uuid(v_org::text || ':property', v_contract_norm);
      v_condominium_norm := public.normalize_legacy_text(v_data ->> 'condominio');
      v_condominium_id := null;
      if v_condominium_norm <> '' and v_condominium_norm not in ('nenhum / nao se aplica', 'nao se aplica', 'nenhum') then
        v_condominium_id := public.legacy_uuid(v_org::text || ':condominium', v_condominium_norm);
        insert into public.condominiums (id, organization_id, name, normalized_name, active, legacy_data)
        values (v_condominium_id, v_org, trim(v_data ->> 'condominio'), v_condominium_norm, true, jsonb_build_object('source', 'Cadastros'))
        on conflict (organization_id, normalized_name) do update set name = excluded.name;
      end if;

      insert into public.properties (id, organization_id, address, property_type, purpose, condominium_id, legacy_data)
      values (v_property_id, v_org, nullif(trim(v_data ->> 'enderecoImovel'), ''), nullif(trim(v_data ->> 'tipoImovel'), ''),
        nullif(trim(v_data ->> 'finalidade'), ''), v_condominium_id,
        jsonb_build_object('legacyCadastroId', v_legacy_id))
      on conflict (id) do update set address = excluded.address, property_type = excluded.property_type,
        purpose = excluded.purpose, condominium_id = excluded.condominium_id;

      insert into public.contracts (
        id, organization_id, legacy_primary_id, contract_number, normalized_contract_number, property_id,
        agent, starts_on, ends_on, due_day, rent_amount, commission_amount, status, version, deleted_at, legacy_data, created_at
      ) values (
        v_contract_id, v_org, v_legacy_id, trim(v_data ->> 'contrato'), v_contract_norm, v_property_id,
        nullif(trim(v_data ->> 'corretor'), ''), public.legacy_date(v_data ->> 'inicioContrato'),
        public.legacy_date(v_data ->> 'fimContrato'), public.legacy_integer(v_data ->> 'diaVencimento'),
        public.legacy_numeric(v_data ->> 'valorAluguel'), public.legacy_numeric(v_data ->> 'comissao'),
        case public.normalize_legacy_text(v_data ->> 'status')
          when 'encerrado' then 'CLOSED'::public.contract_status
          when 'renovado' then 'RENEWED'::public.contract_status
          else 'ACTIVE'::public.contract_status end,
        greatest(coalesce(public.legacy_integer(v_data ->> 'version', 1), 1), 1),
        public.legacy_timestamp(v_data ->> 'deletedAt'), v_data,
        coalesce(public.legacy_timestamp(v_data ->> 'dataHora'), now())
      )
      on conflict (organization_id, normalized_contract_number) do update set
        property_id = excluded.property_id, agent = excluded.agent, starts_on = excluded.starts_on,
        ends_on = excluded.ends_on, due_day = excluded.due_day, rent_amount = excluded.rent_amount,
        commission_amount = excluded.commission_amount, status = excluded.status,
        version = greatest(public.contracts.version, excluded.version), deleted_at = excluded.deleted_at,
        legacy_data = excluded.legacy_data;

      insert into public.legacy_identity_map values
        (p_run_id, v_org, 'cadastro', v_legacy_id, v_contract_id, 'Cadastros', v_source.source_row, now())
      on conflict (migration_run_id, entity_type, legacy_id) do update set new_id = excluded.new_id;
      insert into public.legacy_identity_map values
        (p_run_id, v_org, 'contrato', trim(v_data ->> 'contrato'), v_contract_id, 'Cadastros', v_source.source_row, now())
      on conflict (migration_run_id, entity_type, legacy_id) do update set new_id = excluded.new_id;

      -- Proprietário.
      if nullif(trim(v_data ->> 'nomeProp'), '') is not null then
        v_name_norm := public.normalize_legacy_text(v_data ->> 'nomeProp');
        v_phone_norm := public.normalize_phone(v_data ->> 'telProp');
        v_person_id := public.legacy_uuid(v_org::text || ':person', v_name_norm || '|' || coalesce(v_phone_norm, '') || '|' || lower(trim(coalesce(v_data ->> 'emailProp', ''))));
        insert into public.people (id, organization_id, display_name, normalized_name, phone, normalized_phone, email, birth_day, birth_month, legacy_data)
        values (v_person_id, v_org, trim(v_data ->> 'nomeProp'), v_name_norm, nullif(trim(v_data ->> 'telProp'), ''),
          v_phone_norm, nullif(lower(trim(v_data ->> 'emailProp')), ''),
          public.legacy_birth_part(v_data ->> 'niverProp', 'day'), public.legacy_birth_part(v_data ->> 'niverProp', 'month'),
          jsonb_build_object('role', 'OWNER', 'legacyCadastroId', v_legacy_id))
        on conflict (id) do update set display_name = excluded.display_name, phone = excluded.phone,
          normalized_phone = excluded.normalized_phone, email = excluded.email,
          birth_day = excluded.birth_day, birth_month = excluded.birth_month;
        insert into public.contract_parties (organization_id, contract_id, person_id, role, legacy_cadastro_ids)
        values (v_org, v_contract_id, v_person_id, 'OWNER', array[v_legacy_id])
        on conflict (contract_id, person_id, role) do update set legacy_cadastro_ids =
          case when v_legacy_id = any(public.contract_parties.legacy_cadastro_ids) then public.contract_parties.legacy_cadastro_ids
          else array_append(public.contract_parties.legacy_cadastro_ids, v_legacy_id) end;
        insert into public.legacy_identity_map values
          (p_run_id, v_org, 'pessoa_proprietario', v_legacy_id, v_person_id, 'Cadastros', v_source.source_row, now())
        on conflict (migration_run_id, entity_type, legacy_id) do update set new_id = excluded.new_id;
      end if;

      -- Inquilino.
      if nullif(trim(v_data ->> 'nomeInq'), '') is not null then
        v_name_norm := public.normalize_legacy_text(v_data ->> 'nomeInq');
        v_phone_norm := public.normalize_phone(v_data ->> 'telInq');
        v_person_id := public.legacy_uuid(v_org::text || ':person', v_name_norm || '|' || coalesce(v_phone_norm, '') || '|' || lower(trim(coalesce(v_data ->> 'emailInq', ''))));
        insert into public.people (id, organization_id, display_name, normalized_name, phone, normalized_phone, email, birth_day, birth_month, legacy_data)
        values (v_person_id, v_org, trim(v_data ->> 'nomeInq'), v_name_norm, nullif(trim(v_data ->> 'telInq'), ''),
          v_phone_norm, nullif(lower(trim(v_data ->> 'emailInq')), ''),
          public.legacy_birth_part(v_data ->> 'niverInq', 'day'), public.legacy_birth_part(v_data ->> 'niverInq', 'month'),
          jsonb_build_object('role', 'TENANT', 'legacyCadastroId', v_legacy_id))
        on conflict (id) do update set display_name = excluded.display_name, phone = excluded.phone,
          normalized_phone = excluded.normalized_phone, email = excluded.email,
          birth_day = excluded.birth_day, birth_month = excluded.birth_month;
        insert into public.contract_parties (organization_id, contract_id, person_id, role, legacy_cadastro_ids)
        values (v_org, v_contract_id, v_person_id, 'TENANT', array[v_legacy_id])
        on conflict (contract_id, person_id, role) do update set legacy_cadastro_ids =
          case when v_legacy_id = any(public.contract_parties.legacy_cadastro_ids) then public.contract_parties.legacy_cadastro_ids
          else array_append(public.contract_parties.legacy_cadastro_ids, v_legacy_id) end;
        insert into public.legacy_identity_map values
          (p_run_id, v_org, 'pessoa_inquilino', v_legacy_id, v_person_id, 'Cadastros', v_source.source_row, now())
        on conflict (migration_run_id, entity_type, legacy_id) do update set new_id = excluded.new_id;
      end if;
    end loop;

    -- Relacionamento de renovação após todos os contratos existirem.
    update public.contracts c
      set renewed_from_id = m.new_id
    from public.legacy_identity_map own_map
    join public.migration_source_rows src on src.migration_run_id = p_run_id
      and src.sheet_name = 'Cadastros' and trim(src.raw_data ->> 'id') = own_map.legacy_id
    join public.legacy_identity_map m on m.migration_run_id = p_run_id
      and m.entity_type = 'cadastro' and m.legacy_id = trim(src.raw_data ->> 'renewedFromId')
    where own_map.migration_run_id = p_run_id and own_map.entity_type = 'cadastro'
      and c.id = own_map.new_id and c.organization_id = v_org;

    -- Checklists e documentos livres.
    for v_source in
      select * from public.migration_source_rows where migration_run_id = p_run_id and sheet_name = 'Checklists' order by source_row
    loop
      v_data := v_source.raw_data;
      v_contract_id := public.find_legacy_contract(p_run_id, v_org, v_data ->> 'id', v_data ->> 'contrato');
      if v_contract_id is null then
        insert into public.migration_errors (migration_run_id, sheet_name, source_row, code, message, raw_data)
        values (p_run_id, 'Checklists', v_source.source_row, 'ORPHAN_CHECKLIST', 'Checklist sem contrato correspondente.', v_data);
        continue;
      end if;
      v_checklist_id := public.legacy_uuid(v_org::text || ':checklist', v_contract_id::text);
      insert into public.checklists (
        id, organization_id, contract_id, owner_contract_sent, owner_inspection_sent,
        tenant_manual_delivered, tenant_inspection_signed, tenant_fire_insurance,
        version, last_operation_id, legacy_data
      ) values (
        v_checklist_id, v_org, v_contract_id,
        public.legacy_boolean(v_data ->> 'prop_contratoEnviado'), public.legacy_boolean(v_data ->> 'prop_vistoriaEnviada'),
        public.legacy_boolean(v_data ->> 'inq_manualEntregue'), public.legacy_boolean(v_data ->> 'inq_vistoriaAssinada'),
        public.legacy_boolean(v_data ->> 'inq_seguroIncendio'),
        greatest(coalesce(public.legacy_integer(v_data ->> 'version', 1), 1), 1), nullif(trim(v_data ->> 'operationId'), ''), v_data
      ) on conflict (organization_id, contract_id) do update set
        owner_contract_sent = excluded.owner_contract_sent, owner_inspection_sent = excluded.owner_inspection_sent,
        tenant_manual_delivered = excluded.tenant_manual_delivered, tenant_inspection_signed = excluded.tenant_inspection_signed,
        tenant_fire_insurance = excluded.tenant_fire_insurance,
        version = greatest(public.checklists.version, excluded.version), last_operation_id = excluded.last_operation_id,
        legacy_data = excluded.legacy_data;

      for v_doc in select value, ordinality from jsonb_array_elements(public.legacy_json_array(v_data ->> 'documentos_json')) with ordinality
      loop
        v_legacy_id := coalesce(nullif(trim(v_doc.value ->> 'id'), ''), 'row-' || v_doc.ordinality::text);
        insert into public.checklist_documents (
          id, organization_id, checklist_id, legacy_document_id, name, category, status,
          issue_notes, sort_order, legacy_data
        ) values (
          public.legacy_uuid(v_checklist_id::text || ':document', v_legacy_id), v_org, v_checklist_id, v_legacy_id,
          coalesce(nullif(trim(v_doc.value ->> 'nome'), ''), 'Documento legado'), nullif(trim(v_doc.value ->> 'categoria'), ''),
          case public.normalize_legacy_text(v_doc.value ->> 'status')
            when 'feito' then 'DONE' when 'ok - feito' then 'DONE'
            when 'nao se aplica' then 'NOT_APPLICABLE'
            else case when public.legacy_boolean(v_doc.value ->> 'isFeito') then 'DONE' else 'PENDING' end end,
          nullif(trim(v_doc.value ->> 'pendencia'), ''), v_doc.ordinality::integer, v_doc.value
        ) on conflict (checklist_id, legacy_document_id) where legacy_document_id is not null do update set
          name = excluded.name, category = excluded.category, status = excluded.status,
          issue_notes = excluded.issue_notes, sort_order = excluded.sort_order, legacy_data = excluded.legacy_data;
      end loop;
    end loop;

    -- Tarefas concluídas.
    for v_source in
      select * from public.migration_source_rows where migration_run_id = p_run_id and sheet_name = 'Tarefas' order by source_row
    loop
      v_data := v_source.raw_data;
      v_legacy_id := coalesce(nullif(trim(v_data ->> 'idTarefa'), ''), 'source-row-' || v_source.source_row::text);
      v_contract_id := public.find_legacy_contract(p_run_id, v_org, null, v_data ->> 'contrato');
      insert into public.tasks (
        id, organization_id, contract_id, legacy_task_id, completed_at, task_type, completed_by,
        reference, operation_id, deleted_at, legacy_data
      ) values (
        public.legacy_uuid(v_org::text || ':task', v_legacy_id), v_org, v_contract_id, v_legacy_id,
        public.legacy_timestamp(v_data ->> 'dataConclusao'), coalesce(nullif(trim(v_data ->> 'tipo'), ''), 'Tarefa legada'),
        nullif(trim(v_data ->> 'usuario'), ''), nullif(trim(v_data ->> 'referencia'), ''),
        nullif(trim(v_data ->> 'operationId'), ''), public.legacy_timestamp(v_data ->> 'deletedAt'), v_data
      ) on conflict (organization_id, legacy_task_id) where legacy_task_id is not null do update set
        contract_id = excluded.contract_id, completed_at = excluded.completed_at, task_type = excluded.task_type,
        completed_by = excluded.completed_by, reference = excluded.reference, operation_id = excluded.operation_id,
        deleted_at = excluded.deleted_at, legacy_data = excluded.legacy_data;
    end loop;

    -- Cobranças. A unicidade operacional é contrato + competência.
    for v_source in
      select * from public.migration_source_rows where migration_run_id = p_run_id and sheet_name = 'Cobrancas' order by source_row
    loop
      v_data := v_source.raw_data;
      v_contract_id := public.find_legacy_contract(p_run_id, v_org, v_data ->> 'cadastroId', v_data ->> 'contrato');
      v_competence := public.legacy_competence(v_data ->> 'competencia');
      if v_contract_id is null or v_competence is null then
        insert into public.migration_errors (migration_run_id, sheet_name, source_row, code, message, raw_data)
        values (p_run_id, 'Cobrancas', v_source.source_row, 'INVALID_CHARGE', 'Cobrança sem contrato ou competência válida.', v_data);
        continue;
      end if;
      v_due_on := coalesce(public.legacy_date(v_data ->> 'vencimento'),
        public.legacy_due_date(v_competence, (select due_day from public.contracts where id = v_contract_id)));
      if v_due_on is null then
        insert into public.migration_errors (migration_run_id, sheet_name, source_row, code, message, raw_data)
        values (p_run_id, 'Cobrancas', v_source.source_row, 'MISSING_DUE_DATE', 'Cobrança sem vencimento recuperável.', v_data);
        continue;
      end if;
      insert into public.charges (
        id, organization_id, contract_id, legacy_charge_id, competence, due_on, amount, status,
        paid_at, delivery_confirmed_at, delivery_operation_id, payment_operation_id, version,
        legacy_data, created_at, updated_at
      ) values (
        public.legacy_uuid(v_org::text || ':charge', v_contract_id::text || ':' || v_competence::text), v_org, v_contract_id,
        nullif(trim(v_data ->> 'id'), ''), v_competence, v_due_on, public.legacy_numeric(v_data ->> 'valor'),
        case public.normalize_legacy_text(v_data ->> 'statusPagamento')
          when 'pago' then 'PAID'::public.charge_status when 'cancelado' then 'CANCELLED'::public.charge_status
          else 'PENDING'::public.charge_status end,
        public.legacy_timestamp(v_data ->> 'pagoEm'), public.legacy_timestamp(v_data ->> 'envioConfirmadoEm'),
        nullif(trim(v_data ->> 'envioOperationId'), ''), nullif(trim(v_data ->> 'pagamentoOperationId'), ''),
        greatest(coalesce(public.legacy_integer(v_data ->> 'version', 1), 1), 1), v_data,
        coalesce(public.legacy_timestamp(v_data ->> 'createdAt'), now()), coalesce(public.legacy_timestamp(v_data ->> 'updatedAt'), now())
      ) on conflict (organization_id, contract_id, competence) do update set
        legacy_charge_id = coalesce(excluded.legacy_charge_id, public.charges.legacy_charge_id),
        due_on = excluded.due_on, amount = excluded.amount, status = excluded.status, paid_at = excluded.paid_at,
        delivery_confirmed_at = excluded.delivery_confirmed_at, delivery_operation_id = excluded.delivery_operation_id,
        payment_operation_id = excluded.payment_operation_id, version = greatest(public.charges.version, excluded.version),
        legacy_data = excluded.legacy_data, updated_at = greatest(public.charges.updated_at, excluded.updated_at);
    end loop;

    -- Campanhas existentes.
    for v_source in
      select * from public.migration_source_rows where migration_run_id = p_run_id and sheet_name = 'Campanhas' order by source_row
    loop
      v_data := v_source.raw_data;
      v_legacy_id := trim(v_data ->> 'id');
      if v_legacy_id = '' then continue; end if;
      v_campaign_id := public.legacy_uuid(v_org::text || ':campaign', v_legacy_id);
      insert into public.campaigns (
        id, organization_id, legacy_campaign_id, name, description, message_template, filters, status,
        started_at, finished_at, audience_total, created_by, active, deactivated_at, version,
        last_operation_id, legacy_data, created_at, updated_at
      ) values (
        v_campaign_id, v_org, v_legacy_id, coalesce(nullif(trim(v_data ->> 'nome'), ''), 'Campanha legada'),
        nullif(trim(v_data ->> 'descricao'), ''), coalesce(v_data ->> 'mensagemTemplate', ''),
        public.legacy_json_object(v_data ->> 'filtrosJson'),
        case public.normalize_legacy_text(v_data ->> 'status')
          when 'iniciada' then 'STARTED'::public.campaign_status when 'concluida' then 'COMPLETED'::public.campaign_status
          when 'cancelada' then 'CANCELLED'::public.campaign_status when 'arquivada' then 'ARCHIVED'::public.campaign_status
          else 'DRAFT'::public.campaign_status end,
        public.legacy_timestamp(v_data ->> 'inicioEm'), public.legacy_timestamp(v_data ->> 'fimEm'),
        greatest(coalesce(public.legacy_integer(v_data ->> 'audienciaTotal', 0), 0), 0), nullif(trim(v_data ->> 'createdBy'), ''),
        public.legacy_boolean(v_data ->> 'ativa', true), public.legacy_timestamp(v_data ->> 'desativadaEm'),
        greatest(coalesce(public.legacy_integer(v_data ->> 'version', 1), 1), 1), nullif(trim(v_data ->> 'operationId'), ''),
        v_data, coalesce(public.legacy_timestamp(v_data ->> 'createdAt'), now()), coalesce(public.legacy_timestamp(v_data ->> 'updatedAt'), now())
      ) on conflict (organization_id, legacy_campaign_id) where legacy_campaign_id is not null do update set
        name = excluded.name, description = excluded.description, message_template = excluded.message_template,
        filters = excluded.filters, status = excluded.status, started_at = excluded.started_at, finished_at = excluded.finished_at,
        audience_total = excluded.audience_total, created_by = excluded.created_by, active = excluded.active,
        deactivated_at = excluded.deactivated_at, version = greatest(public.campaigns.version, excluded.version),
        last_operation_id = excluded.last_operation_id, legacy_data = excluded.legacy_data;
      insert into public.legacy_identity_map values
        (p_run_id, v_org, 'campanha', v_legacy_id, v_campaign_id, 'Campanhas', v_source.source_row, now())
      on conflict (migration_run_id, entity_type, legacy_id) do update set new_id = excluded.new_id;
    end loop;

    -- Campanhas removidas da aba principal ganham placeholder arquivado para preservar seus destinatários.
    for v_item in
      select distinct trim(raw_data ->> 'campanhaId') legacy_id
      from public.migration_source_rows
      where migration_run_id = p_run_id and sheet_name = 'Campanha_Destinatarios'
        and nullif(trim(raw_data ->> 'campanhaId'), '') is not null
    loop
      if not exists (select 1 from public.legacy_identity_map where migration_run_id = p_run_id and entity_type = 'campanha' and legacy_id = v_item.legacy_id) then
        v_campaign_id := public.legacy_uuid(v_org::text || ':campaign', v_item.legacy_id);
        insert into public.campaigns (
          id, organization_id, legacy_campaign_id, name, description, message_template, status, active, legacy_data
        ) values (
          v_campaign_id, v_org, v_item.legacy_id, 'Campanha legada recuperada',
          'Campanha ausente na aba principal do backup; preservada para manter o histórico de destinatários.', '',
          'ARCHIVED', false, jsonb_build_object('recoveredPlaceholder', true)
        ) on conflict (organization_id, legacy_campaign_id) where legacy_campaign_id is not null do nothing;
        insert into public.legacy_identity_map values
          (p_run_id, v_org, 'campanha', v_item.legacy_id, v_campaign_id, 'Campanha_Destinatarios', null, now())
        on conflict (migration_run_id, entity_type, legacy_id) do update set new_id = excluded.new_id;
      end if;
    end loop;

    -- Destinatários e vínculos contratuais das campanhas.
    for v_source in
      select * from public.migration_source_rows where migration_run_id = p_run_id and sheet_name = 'Campanha_Destinatarios' order by source_row
    loop
      v_data := v_source.raw_data;
      select new_id into v_campaign_id from public.legacy_identity_map
        where migration_run_id = p_run_id and entity_type = 'campanha' and legacy_id = trim(v_data ->> 'campanhaId') limit 1;
      if v_campaign_id is null or nullif(trim(v_data ->> 'contactKey'), '') is null then
        insert into public.migration_errors (migration_run_id, sheet_name, source_row, code, message, raw_data)
        values (p_run_id, 'Campanha_Destinatarios', v_source.source_row, 'INVALID_RECIPIENT', 'Destinatário sem campanha ou chave de contato.', v_data);
        continue;
      end if;
      v_recipient_id := public.legacy_uuid(v_campaign_id::text || ':recipient', trim(v_data ->> 'contactKey'));
      insert into public.campaign_recipients (
        id, organization_id, campaign_id, contact_key, name, phone, profiles, context, rendered_message,
        status, whatsapp_opened_at, send_confirmed_at, ignored_at, reason, version,
        last_operation_id, legacy_data, created_at, updated_at
      ) values (
        v_recipient_id, v_org, v_campaign_id, trim(v_data ->> 'contactKey'),
        coalesce(nullif(trim(v_data ->> 'nome'), ''), 'Contato legado'), nullif(trim(v_data ->> 'telefone'), ''),
        public.legacy_json_array(v_data ->> 'perfisJson'), public.legacy_json_object(v_data ->> 'contextoJson'),
        coalesce(v_data ->> 'mensagemRenderizada', ''),
        case public.normalize_legacy_text(v_data ->> 'status')
          when 'whatsapp_aberto' then 'WHATSAPP_OPENED'::public.campaign_recipient_status
          when 'envio_confirmado' then 'SEND_CONFIRMED'::public.campaign_recipient_status
          when 'ignorado' then 'IGNORED'::public.campaign_recipient_status
          when 'erro' then 'ERROR'::public.campaign_recipient_status
          else 'PENDING'::public.campaign_recipient_status end,
        public.legacy_timestamp(v_data ->> 'whatsappAbertoEm'), public.legacy_timestamp(v_data ->> 'envioConfirmadoEm'),
        public.legacy_timestamp(v_data ->> 'ignoradoEm'), nullif(trim(v_data ->> 'motivo'), ''),
        greatest(coalesce(public.legacy_integer(v_data ->> 'version', 1), 1), 1), nullif(trim(v_data ->> 'operationId'), ''),
        v_data, coalesce(public.legacy_timestamp(v_data ->> 'createdAt'), now()), coalesce(public.legacy_timestamp(v_data ->> 'updatedAt'), now())
      ) on conflict (campaign_id, contact_key) do update set
        name = excluded.name, phone = excluded.phone, profiles = excluded.profiles, context = excluded.context,
        rendered_message = excluded.rendered_message, status = excluded.status,
        whatsapp_opened_at = excluded.whatsapp_opened_at, send_confirmed_at = excluded.send_confirmed_at,
        ignored_at = excluded.ignored_at, reason = excluded.reason,
        version = greatest(public.campaign_recipients.version, excluded.version),
        last_operation_id = excluded.last_operation_id, legacy_data = excluded.legacy_data;

      if nullif(trim(v_data ->> 'id'), '') is not null then
        insert into public.legacy_identity_map values
          (p_run_id, v_org, 'destinatario_campanha', trim(v_data ->> 'id'), v_recipient_id, 'Campanha_Destinatarios', v_source.source_row, now())
        on conflict (migration_run_id, entity_type, legacy_id) do update set new_id = excluded.new_id;
      end if;

      for v_item in select value #>> '{}' contract_number from jsonb_array_elements(public.legacy_json_array(v_data ->> 'contratosJson'))
      loop
        v_contract_id := public.find_legacy_contract(p_run_id, v_org, null, v_item.contract_number);
        if v_contract_id is not null then
          insert into public.campaign_recipient_contracts (organization_id, recipient_id, contract_id)
          values (v_org, v_recipient_id, v_contract_id) on conflict do nothing;
        end if;
      end loop;
    end loop;

    -- Histórico de operações do checklist e das campanhas.
    for v_source in
      select * from public.migration_source_rows
      where migration_run_id = p_run_id and sheet_name in ('Operacoes', 'Campanha_Operacoes') order by sheet_name, source_row
    loop
      v_data := v_source.raw_data;
      v_legacy_id := trim(v_data ->> 'operationId');
      if v_legacy_id = '' then continue; end if;
      insert into public.idempotency_operations (
        id, organization_id, operation_id, scope, action, target_type, target_id,
        requested_version, result_version, payload_hash, status, error_code, legacy_data, created_at
      ) values (
        public.legacy_uuid(v_org::text || ':operation:' || v_source.sheet_name, v_legacy_id), v_org, v_legacy_id,
        case when v_source.sheet_name = 'Campanha_Operacoes' then 'CAMPAIGN' else 'CHECKLIST' end,
        nullif(trim(v_data ->> 'action'), ''),
        case when v_source.sheet_name = 'Campanha_Operacoes' then 'campaign' else 'checklist' end,
        nullif(trim(v_data ->> 'target_id'), ''), public.legacy_integer(v_data ->> 'requested_version'),
        public.legacy_integer(v_data ->> 'result_version'), nullif(trim(v_data ->> 'payload_hash'), ''),
        case public.normalize_legacy_text(v_data ->> 'status')
          when 'success' then 'SUCCESS'::public.operation_status when 'conflict' then 'CONFLICT'::public.operation_status
          when 'error' then 'ERROR'::public.operation_status else 'PENDING'::public.operation_status end,
        case when public.normalize_legacy_text(v_data ->> 'status') = 'conflict' then 'LEGACY_CONFLICT' else null end,
        v_data, coalesce(public.legacy_timestamp(v_data ->> 'timestamp'), now())
      ) on conflict (organization_id, scope, operation_id) do update set
        action = excluded.action, target_id = excluded.target_id, requested_version = excluded.requested_version,
        result_version = excluded.result_version, payload_hash = excluded.payload_hash, status = excluded.status,
        error_code = excluded.error_code, legacy_data = excluded.legacy_data;
    end loop;

    select jsonb_build_object(
      'contracts', (select count(*) from public.contracts where organization_id = v_org),
      'people', (select count(*) from public.people where organization_id = v_org),
      'condominiums', (select count(*) from public.condominiums where organization_id = v_org),
      'checklists', (select count(*) from public.checklists where organization_id = v_org),
      'checklistDocuments', (select count(*) from public.checklist_documents where organization_id = v_org),
      'tasks', (select count(*) from public.tasks where organization_id = v_org),
      'charges', (select count(*) from public.charges where organization_id = v_org),
      'campaigns', (select count(*) from public.campaigns where organization_id = v_org),
      'campaignRecipients', (select count(*) from public.campaign_recipients where organization_id = v_org),
      'operations', (select count(*) from public.idempotency_operations where organization_id = v_org),
      'migrationErrors', (select count(*) from public.migration_errors where migration_run_id = p_run_id)
    ) into v_result;

    update public.migration_runs set status = 'COMPLETED', result_counts = v_result, completed_at = now() where id = p_run_id;
    return jsonb_build_object('success', true, 'status', 'completed', 'counts', v_result);
  exception when others then
    update public.migration_runs set status = 'FAILED', error_message = sqlerrm where id = p_run_id;
    return jsonb_build_object('success', false, 'status', 'failed', 'error', sqlerrm);
  end;
end;
$$;

create or replace function public.migration_reconciliation_report(p_run_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run public.migration_runs%rowtype;
  v_duplicate_contract_groups integer;
  v_orphan_campaign_ids integer;
begin
  select * into v_run from public.migration_runs where id = p_run_id;
  if not found then raise exception 'MIGRATION_RUN_NOT_FOUND'; end if;

  select count(*) into v_duplicate_contract_groups from (
    select public.normalize_legacy_text(raw_data ->> 'contrato')
    from public.migration_source_rows
    where migration_run_id = p_run_id and sheet_name = 'Cadastros'
    group by public.normalize_legacy_text(raw_data ->> 'contrato') having count(*) > 1
  ) d;
  select count(distinct trim(r.raw_data ->> 'campanhaId')) into v_orphan_campaign_ids
  from public.migration_source_rows r
  where r.migration_run_id = p_run_id and r.sheet_name = 'Campanha_Destinatarios'
    and not exists (
      select 1 from public.migration_source_rows c
      where c.migration_run_id = p_run_id and c.sheet_name = 'Campanhas'
        and trim(c.raw_data ->> 'id') = trim(r.raw_data ->> 'campanhaId')
    );

  return jsonb_build_object(
    'runId', v_run.id,
    'status', v_run.status,
    'sourceCounts', v_run.source_counts,
    'resultCounts', v_run.result_counts,
    'preservedRawRows', (select count(*) from public.migration_source_rows where migration_run_id = p_run_id),
    'legacyMappings', (select count(*) from public.legacy_identity_map where migration_run_id = p_run_id),
    'migrationErrors', (select count(*) from public.migration_errors where migration_run_id = p_run_id),
    'duplicateContractGroupsConsolidated', v_duplicate_contract_groups,
    'orphanCampaignsRecovered', v_orphan_campaign_ids,
    'sourceChecksum', v_run.source_checksum
  );
end;
$$;

revoke all on function public.legacy_uuid(text, text) from public;
revoke all on function public.legacy_boolean(text, boolean) from public, anon, authenticated;
revoke all on function public.legacy_integer(text, integer) from public, anon, authenticated;
revoke all on function public.legacy_numeric(text) from public, anon, authenticated;
revoke all on function public.legacy_date(text) from public, anon, authenticated;
revoke all on function public.legacy_timestamp(text) from public, anon, authenticated;
revoke all on function public.legacy_json_array(text) from public, anon, authenticated;
revoke all on function public.legacy_json_object(text) from public, anon, authenticated;
revoke all on function public.legacy_birth_part(text, text) from public, anon, authenticated;
revoke all on function public.legacy_competence(text) from public, anon, authenticated;
revoke all on function public.legacy_due_date(date, integer) from public, anon, authenticated;
revoke all on function public.find_legacy_contract(uuid, uuid, text, text) from public;
revoke all on function public.bootstrap_migration_organization(text, text) from public, anon, authenticated;
revoke all on function public.stage_legacy_snapshot(uuid, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.apply_legacy_migration(uuid) from public, anon, authenticated;
revoke all on function public.migration_reconciliation_report(uuid) from public, anon, authenticated;
grant execute on function public.bootstrap_migration_organization(text, text) to service_role;
grant execute on function public.stage_legacy_snapshot(uuid, text, text, jsonb) to service_role;
grant execute on function public.apply_legacy_migration(uuid) to service_role;
grant execute on function public.migration_reconciliation_report(uuid) to service_role;

commit;
