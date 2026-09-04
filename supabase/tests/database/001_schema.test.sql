begin;
select plan(16);

select has_table('public', 'contracts', 'contracts existe');
select has_table('public', 'people', 'people existe');
select has_table('public', 'checklists', 'checklists existe');
select has_table('public', 'checklist_documents', 'checklist_documents existe');
select has_table('public', 'charges', 'charges existe');
select has_table('public', 'campaigns', 'campaigns existe');
select has_table('public', 'campaign_recipients', 'campaign_recipients existe');
select has_table('public', 'migration_source_rows', 'staging existe');
select has_table('public', 'legacy_identity_map', 'mapa legado existe');
select has_table('public', 'audit_log', 'auditoria existe');
select has_function('public', 'stage_legacy_snapshot', array['uuid', 'text', 'text', 'jsonb'], 'RPC de staging existe');
select has_function('public', 'apply_legacy_migration', array['uuid'], 'RPC de aplicação existe');
select has_function('public', 'migration_reconciliation_report', array['uuid'], 'RPC de reconciliação existe');
select is((select c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'contracts'), true, 'RLS em contracts');
select is((select c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'charges'), true, 'RLS em charges');
select is((select c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'campaigns'), true, 'RLS em campaigns');

select * from finish();
rollback;
