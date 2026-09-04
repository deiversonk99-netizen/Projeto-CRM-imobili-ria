begin;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create type public.contract_party_role as enum ('OWNER', 'TENANT');
create type public.contract_status as enum ('ACTIVE', 'CLOSED', 'RENEWED');
create type public.charge_status as enum ('PENDING', 'PAID', 'CANCELLED');
create type public.campaign_status as enum ('DRAFT', 'STARTED', 'COMPLETED', 'CANCELLED', 'ARCHIVED');
create type public.campaign_recipient_status as enum ('PENDING', 'WHATSAPP_OPENED', 'SEND_CONFIRMED', 'IGNORED', 'ERROR');
create type public.operation_status as enum ('PENDING', 'SUCCESS', 'CONFLICT', 'ERROR');
create type public.migration_status as enum ('STAGED', 'RUNNING', 'COMPLETED', 'FAILED');

create table public.organizations (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null,
  slug text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  full_name text not null,
  interfaces integer[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.app_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  data_backend text not null default 'gas' check (data_backend in ('gas', 'dual_write', 'supabase')),
  schema_version integer not null default 1 check (schema_version > 0),
  legacy_source_id text,
  cutover_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.people (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  display_name text not null,
  normalized_name text not null,
  phone text,
  normalized_phone text,
  email text,
  birth_day smallint check (birth_day between 1 and 31),
  birth_month smallint check (birth_month between 1 and 12),
  legacy_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.people add constraint people_id_org_unique unique (id, organization_id);

create index people_org_name_idx on public.people (organization_id, normalized_name);
create index people_org_phone_idx on public.people (organization_id, normalized_phone) where normalized_phone is not null;

create table public.condominiums (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  normalized_name text not null,
  active boolean not null default true,
  legacy_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, normalized_name)
);

create table public.properties (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  address text,
  property_type text,
  purpose text,
  condominium_id uuid references public.condominiums(id) on delete set null,
  legacy_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index properties_org_idx on public.properties (organization_id);
create index properties_condominium_idx on public.properties (condominium_id);

create table public.contracts (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  legacy_primary_id text,
  contract_number text not null,
  normalized_contract_number text not null,
  property_id uuid references public.properties(id) on delete set null,
  agent text,
  starts_on date,
  ends_on date,
  due_day smallint check (due_day between 1 and 31),
  rent_amount numeric(14,2),
  commission_amount numeric(14,2),
  status public.contract_status not null default 'ACTIVE',
  version integer not null default 1 check (version > 0),
  deleted_at timestamptz,
  renewed_from_id uuid references public.contracts(id) on delete set null,
  legacy_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, normalized_contract_number)
);

alter table public.contracts add constraint contracts_id_org_unique unique (id, organization_id);

create index contracts_org_status_idx on public.contracts (organization_id, status) where deleted_at is null;
create index contracts_dates_idx on public.contracts (starts_on, ends_on);

create table public.contract_parties (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contract_id uuid not null,
  person_id uuid not null,
  role public.contract_party_role not null,
  legacy_cadastro_ids text[] not null default '{}',
  created_at timestamptz not null default now(),
  primary key (contract_id, person_id, role),
  foreign key (contract_id, organization_id) references public.contracts(id, organization_id) on delete cascade,
  foreign key (person_id, organization_id) references public.people(id, organization_id) on delete restrict
);

create index contract_parties_person_idx on public.contract_parties (person_id, role);

create table public.checklists (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contract_id uuid not null references public.contracts(id) on delete cascade,
  owner_contract_sent boolean not null default false,
  owner_inspection_sent boolean not null default false,
  tenant_manual_delivered boolean not null default false,
  tenant_inspection_signed boolean not null default false,
  tenant_fire_insurance boolean not null default false,
  version integer not null default 1 check (version > 0),
  last_operation_id text,
  legacy_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, contract_id)
);

create table public.checklist_documents (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  checklist_id uuid not null references public.checklists(id) on delete cascade,
  legacy_document_id text,
  name text not null,
  category text,
  status text not null default 'PENDING' check (status in ('PENDING', 'DONE', 'NOT_APPLICABLE')),
  issue_notes text,
  sort_order integer not null default 0,
  legacy_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index checklist_documents_checklist_idx on public.checklist_documents (checklist_id, sort_order);
create unique index checklist_documents_legacy_uidx
  on public.checklist_documents (checklist_id, legacy_document_id)
  where legacy_document_id is not null;

create table public.tasks (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contract_id uuid references public.contracts(id) on delete set null,
  legacy_task_id text,
  completed_at timestamptz,
  task_type text not null,
  completed_by text,
  reference text,
  operation_id text,
  deleted_at timestamptz,
  legacy_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index tasks_legacy_uidx on public.tasks (organization_id, legacy_task_id) where legacy_task_id is not null;
create index tasks_contract_idx on public.tasks (contract_id, task_type);

create table public.charges (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contract_id uuid not null references public.contracts(id) on delete restrict,
  legacy_charge_id text,
  competence date not null check (extract(day from competence) = 1),
  due_on date not null,
  amount numeric(14,2),
  status public.charge_status not null default 'PENDING',
  paid_at timestamptz,
  delivery_confirmed_at timestamptz,
  delivery_operation_id text,
  payment_operation_id text,
  version integer not null default 1 check (version > 0),
  legacy_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, contract_id, competence)
);

create index charges_pending_due_idx on public.charges (organization_id, due_on) where status = 'PENDING';

create table public.campaigns (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  legacy_campaign_id text,
  name text not null,
  description text,
  message_template text not null,
  filters jsonb not null default '{}'::jsonb,
  status public.campaign_status not null default 'DRAFT',
  started_at timestamptz,
  finished_at timestamptz,
  audience_total integer not null default 0 check (audience_total >= 0),
  created_by text,
  active boolean not null default true,
  deactivated_at timestamptz,
  version integer not null default 1 check (version > 0),
  last_operation_id text,
  legacy_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index campaigns_legacy_uidx on public.campaigns (organization_id, legacy_campaign_id) where legacy_campaign_id is not null;
create index campaigns_org_status_idx on public.campaigns (organization_id, status, active);

create table public.campaign_recipients (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  contact_key text not null,
  name text not null,
  phone text,
  profiles jsonb not null default '[]'::jsonb,
  context jsonb not null default '{}'::jsonb,
  rendered_message text not null,
  status public.campaign_recipient_status not null default 'PENDING',
  whatsapp_opened_at timestamptz,
  send_confirmed_at timestamptz,
  ignored_at timestamptz,
  reason text,
  version integer not null default 1 check (version > 0),
  last_operation_id text,
  legacy_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, contact_key)
);

alter table public.campaign_recipients add constraint campaign_recipients_id_org_unique unique (id, organization_id);

create index campaign_recipients_queue_idx on public.campaign_recipients (campaign_id, status);

create table public.campaign_recipient_contracts (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  recipient_id uuid not null,
  contract_id uuid not null,
  primary key (recipient_id, contract_id),
  foreign key (recipient_id, organization_id) references public.campaign_recipients(id, organization_id) on delete cascade,
  foreign key (contract_id, organization_id) references public.contracts(id, organization_id) on delete cascade
);

create table public.idempotency_operations (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  operation_id text not null,
  scope text not null,
  action text,
  target_type text,
  target_id text,
  requested_version integer,
  result_version integer,
  payload_hash text,
  status public.operation_status not null,
  error_code text,
  result jsonb,
  legacy_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, scope, operation_id)
);

create index idempotency_operations_target_idx on public.idempotency_operations (organization_id, target_type, target_id);

create table public.audit_log (
  id bigint generated always as identity primary key,
  organization_id uuid references public.organizations(id) on delete set null,
  actor_user_id uuid,
  table_name text not null,
  record_id text,
  action text not null,
  old_data jsonb,
  new_data jsonb,
  occurred_at timestamptz not null default now()
);

create index audit_log_org_time_idx on public.audit_log (organization_id, occurred_at desc);

create table public.migration_runs (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source_id text not null,
  source_checksum text not null,
  status public.migration_status not null default 'STAGED',
  source_counts jsonb not null default '{}'::jsonb,
  result_counts jsonb not null default '{}'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, source_id, source_checksum)
);

create table public.migration_source_rows (
  id bigint generated always as identity primary key,
  migration_run_id uuid not null references public.migration_runs(id) on delete cascade,
  sheet_name text not null,
  source_row integer not null,
  source_key text,
  row_checksum text not null,
  raw_data jsonb not null,
  created_at timestamptz not null default now(),
  unique (migration_run_id, sheet_name, source_row)
);

create index migration_source_rows_key_idx on public.migration_source_rows (migration_run_id, sheet_name, source_key);

create table public.legacy_identity_map (
  migration_run_id uuid not null references public.migration_runs(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  entity_type text not null,
  legacy_id text not null,
  new_id uuid not null,
  source_sheet text,
  source_row integer,
  created_at timestamptz not null default now(),
  primary key (migration_run_id, entity_type, legacy_id)
);

create index legacy_identity_map_new_idx on public.legacy_identity_map (organization_id, entity_type, new_id);

create table public.migration_errors (
  id bigint generated always as identity primary key,
  migration_run_id uuid not null references public.migration_runs(id) on delete cascade,
  sheet_name text,
  source_row integer,
  code text not null,
  message text not null,
  raw_data jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.normalize_legacy_text(p_value text)
returns text
language sql
immutable
parallel safe
set search_path = public
as $$
  select trim(regexp_replace(
    translate(lower(coalesce(p_value, '')),
      'áàâãäéèêëíìîïóòôõöúùûüçñ',
      'aaaaaeeeeiiiiooooouuuucn'),
    '\s+', ' ', 'g'));
$$;

create or replace function public.normalize_phone(p_value text)
returns text
language sql
immutable
parallel safe
set search_path = public
as $$
  with cleaned as (
    select regexp_replace(coalesce(p_value, ''), '\D', '', 'g') value
  )
  select case
    when length(value) in (10, 11) then '55' || value
    when length(value) in (12, 13) and value like '55%' then value
    else null
  end
  from cleaned;
$$;

create or replace function public.current_organization_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id
  from public.profiles
  where user_id = auth.uid() and active
  limit 1;
$$;

create or replace function public.can_access_interface(p_organization_id uuid, p_interface integer)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.active
      and p.organization_id = p_organization_id
      and (99 = any(p.interfaces) or p_interface = any(p.interfaces))
  );
$$;

create or replace function public.get_app_health()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'ok', true,
    'backend', 'supabase',
    'schemaVersion', coalesce(s.schema_version, 1),
    'dataBackend', coalesce(s.data_backend, 'gas'),
    'organizationId', s.organization_id,
    'databaseTime', now()
  )
  from (select public.current_organization_id() organization_id) context
  left join public.app_settings s on s.organization_id = context.organization_id;
$$;

create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_row jsonb;
  v_org uuid;
  v_record_id text;
begin
  v_old := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end;
  v_new := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end;
  v_row := coalesce(v_new, v_old);
  v_org := nullif(v_row ->> 'organization_id', '')::uuid;
  v_record_id := coalesce(v_row ->> 'id', v_row ->> 'contract_id', v_row ->> 'recipient_id');
  insert into public.audit_log (organization_id, actor_user_id, table_name, record_id, action, old_data, new_data)
  values (v_org, auth.uid(), tg_table_name, v_record_id, tg_op, v_old, v_new);
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'organizations', 'profiles', 'app_settings', 'people', 'condominiums', 'properties', 'contracts',
    'checklists', 'checklist_documents', 'tasks', 'charges', 'campaigns',
    'campaign_recipients', 'idempotency_operations', 'migration_runs'
  ] loop
    execute format('create trigger %I_set_updated_at before update on public.%I for each row execute function public.set_updated_at()', v_table, v_table);
  end loop;

  foreach v_table in array array[
    'people', 'condominiums', 'properties', 'contracts', 'contract_parties',
    'checklists', 'checklist_documents', 'tasks', 'charges', 'campaigns',
    'campaign_recipients', 'campaign_recipient_contracts'
  ] loop
    execute format('create trigger %I_audit after insert or update or delete on public.%I for each row execute function public.audit_row_change()', v_table, v_table);
  end loop;
end;
$$;

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.app_settings enable row level security;
alter table public.people enable row level security;
alter table public.condominiums enable row level security;
alter table public.properties enable row level security;
alter table public.contracts enable row level security;
alter table public.contract_parties enable row level security;
alter table public.checklists enable row level security;
alter table public.checklist_documents enable row level security;
alter table public.tasks enable row level security;
alter table public.charges enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_recipients enable row level security;
alter table public.campaign_recipient_contracts enable row level security;
alter table public.idempotency_operations enable row level security;
alter table public.audit_log enable row level security;
alter table public.migration_runs enable row level security;
alter table public.migration_source_rows enable row level security;
alter table public.legacy_identity_map enable row level security;
alter table public.migration_errors enable row level security;

create policy organizations_select_own on public.organizations
  for select to authenticated using (id = public.current_organization_id());
create policy profiles_select_own on public.profiles
  for select to authenticated using (user_id = auth.uid());
create policy app_settings_admin on public.app_settings
  for all to authenticated using (public.can_access_interface(organization_id, 99))
  with check (public.can_access_interface(organization_id, 99));

create policy people_read on public.people
  for select to authenticated using (
    public.can_access_interface(organization_id, 1) or public.can_access_interface(organization_id, 4)
    or public.can_access_interface(organization_id, 5) or public.can_access_interface(organization_id, 6)
  );
create policy people_write on public.people
  for all to authenticated using (public.can_access_interface(organization_id, 1))
  with check (public.can_access_interface(organization_id, 1));

create policy condominiums_read on public.condominiums
  for select to authenticated using (public.can_access_interface(organization_id, 1) or public.can_access_interface(organization_id, 6));
create policy condominiums_write on public.condominiums
  for all to authenticated using (public.can_access_interface(organization_id, 1))
  with check (public.can_access_interface(organization_id, 1));

create policy properties_read on public.properties
  for select to authenticated using (
    public.can_access_interface(organization_id, 1) or public.can_access_interface(organization_id, 4)
    or public.can_access_interface(organization_id, 5) or public.can_access_interface(organization_id, 6)
  );
create policy properties_write on public.properties
  for all to authenticated using (public.can_access_interface(organization_id, 1))
  with check (public.can_access_interface(organization_id, 1));

create policy contracts_read on public.contracts
  for select to authenticated using (
    public.can_access_interface(organization_id, 1) or public.can_access_interface(organization_id, 2)
    or public.can_access_interface(organization_id, 4) or public.can_access_interface(organization_id, 5)
    or public.can_access_interface(organization_id, 6)
  );
create policy contracts_write on public.contracts
  for all to authenticated using (public.can_access_interface(organization_id, 1))
  with check (public.can_access_interface(organization_id, 1));

create policy contract_parties_read on public.contract_parties
  for select to authenticated using (
    exists (select 1 from public.contracts c where c.id = contract_id and (
      public.can_access_interface(c.organization_id, 1) or public.can_access_interface(c.organization_id, 4)
      or public.can_access_interface(c.organization_id, 5) or public.can_access_interface(c.organization_id, 6)))
  );
create policy contract_parties_write on public.contract_parties
  for all to authenticated using (
    exists (select 1 from public.contracts c where c.id = contract_id and public.can_access_interface(c.organization_id, 1))
  ) with check (
    exists (select 1 from public.contracts c where c.id = contract_id and public.can_access_interface(c.organization_id, 1))
  );

create policy checklists_access on public.checklists
  for all to authenticated using (public.can_access_interface(organization_id, 4))
  with check (public.can_access_interface(organization_id, 4));
create policy checklist_documents_access on public.checklist_documents
  for all to authenticated using (public.can_access_interface(organization_id, 4))
  with check (public.can_access_interface(organization_id, 4));
create policy tasks_access on public.tasks
  for all to authenticated using (public.can_access_interface(organization_id, 2))
  with check (public.can_access_interface(organization_id, 2));
create policy charges_access on public.charges
  for all to authenticated using (public.can_access_interface(organization_id, 5))
  with check (public.can_access_interface(organization_id, 5));
create policy campaigns_access on public.campaigns
  for all to authenticated using (public.can_access_interface(organization_id, 6))
  with check (public.can_access_interface(organization_id, 6));
create policy campaign_recipients_access on public.campaign_recipients
  for all to authenticated using (public.can_access_interface(organization_id, 6))
  with check (public.can_access_interface(organization_id, 6));
create policy campaign_recipient_contracts_access on public.campaign_recipient_contracts
  for all to authenticated using (
    exists (select 1 from public.campaign_recipients r where r.id = recipient_id and public.can_access_interface(r.organization_id, 6))
  ) with check (
    exists (select 1 from public.campaign_recipients r where r.id = recipient_id and public.can_access_interface(r.organization_id, 6))
  );

create policy idempotency_operations_admin_read on public.idempotency_operations
  for select to authenticated using (public.can_access_interface(organization_id, 99));
create policy audit_log_admin_read on public.audit_log
  for select to authenticated using (public.can_access_interface(organization_id, 99));

revoke all on all tables in schema public from anon;
revoke all on all tables in schema public from authenticated;
grant select on public.organizations, public.profiles to authenticated;
grant select, insert, update, delete on public.app_settings, public.people, public.condominiums, public.properties,
  public.contracts, public.contract_parties, public.checklists, public.checklist_documents, public.tasks,
  public.charges, public.campaigns, public.campaign_recipients, public.campaign_recipient_contracts to authenticated;
grant select on public.idempotency_operations, public.audit_log to authenticated;
grant usage, select on all sequences in schema public to authenticated;

revoke all on function public.current_organization_id() from public;
revoke all on function public.can_access_interface(uuid, integer) from public;
revoke all on function public.get_app_health() from public;
revoke all on function public.set_updated_at() from public;
revoke all on function public.audit_row_change() from public;
revoke all on function public.normalize_legacy_text(text) from public;
revoke all on function public.normalize_phone(text) from public;
grant execute on function public.current_organization_id() to authenticated;
grant execute on function public.can_access_interface(uuid, integer) to authenticated;
grant execute on function public.get_app_health() to authenticated;

commit;
