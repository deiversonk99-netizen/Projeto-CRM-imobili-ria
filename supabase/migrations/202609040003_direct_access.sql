begin;

-- Modo temporario sem tela de login. Cada navegador recebe uma identidade
-- anonima real do Supabase Auth, mantendo JWT, RLS, auditoria e isolamento por
-- organizacao. Nenhuma senha administrativa ou secret key vai para o frontend.

create or replace function public.provision_direct_access_profile()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_org uuid;
begin
  if not coalesce(new.is_anonymous, false) then
    return new;
  end if;

  select s.organization_id into v_org
  from public.app_settings s
  join public.organizations o on o.id = s.organization_id and o.active
  where s.data_backend = 'supabase'
  order by s.cutover_at desc nulls last, s.updated_at desc
  limit 1;

  if v_org is null then
    raise exception 'DIRECT_ACCESS_ORGANIZATION_NOT_FOUND' using errcode = 'P0001';
  end if;

  insert into public.profiles (user_id, organization_id, full_name, interfaces, active)
  values (new.id, v_org, 'Acesso direto', array[99]::integer[], true)
  on conflict (user_id) do update
  set organization_id = excluded.organization_id,
      full_name = excluded.full_name,
      interfaces = excluded.interfaces,
      active = true,
      updated_at = now();

  return new;
end;
$$;

drop trigger if exists provision_direct_access_profile_after_auth_user on auth.users;
create trigger provision_direct_access_profile_after_auth_user
after insert on auth.users
for each row
when (new.is_anonymous is true)
execute function public.provision_direct_access_profile();

-- Repara identidades anonimas eventualmente criadas entre a ativacao do
-- provedor e a instalacao do trigger.
insert into public.profiles (user_id, organization_id, full_name, interfaces, active)
select u.id, settings.organization_id, 'Acesso direto', array[99]::integer[], true
from auth.users u
cross join lateral (
  select s.organization_id
  from public.app_settings s
  join public.organizations o on o.id = s.organization_id and o.active
  where s.data_backend = 'supabase'
  order by s.cutover_at desc nulls last, s.updated_at desc
  limit 1
) settings
where u.is_anonymous is true
on conflict (user_id) do update
set organization_id = excluded.organization_id,
    full_name = excluded.full_name,
    interfaces = excluded.interfaces,
    active = true,
    updated_at = now();

revoke all on function public.provision_direct_access_profile() from public, anon, authenticated;

commit;
