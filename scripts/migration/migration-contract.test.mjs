import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const corePath = new URL('../../supabase/migrations/202609030001_crm_core.sql', import.meta.url);
const importPath = new URL('../../supabase/migrations/202609030002_legacy_import.sql', import.meta.url);
const directAccessPath = new URL('../../supabase/migrations/202609040003_direct_access.sql', import.meta.url);

test('esquema cobre todos os módulos e ativa RLS', async () => {
  const sql = await readFile(corePath, 'utf8');
  const protectedTables = [
    'people', 'condominiums', 'properties', 'contracts', 'contract_parties', 'checklists',
    'checklist_documents', 'tasks', 'charges', 'campaigns', 'campaign_recipients',
    'campaign_recipient_contracts', 'idempotency_operations', 'audit_log',
  ];
  for (const table of protectedTables) {
    assert.match(sql, new RegExp(`create table public\\.${table}\\b`, 'i'));
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, 'i'));
  }
  assert.doesNotMatch(sql, /sb_(?:publishable|secret)_[A-Za-z0-9_-]{20,}/);
  assert.match(sql, /get_app_health/);
});

test('importação é reexecutável, preserva staging e exige service role', async () => {
  const sql = await readFile(importPath, 'utf8');
  assert.match(sql, /stage_legacy_snapshot/);
  assert.match(sql, /apply_legacy_migration/);
  assert.match(sql, /migration_reconciliation_report/);
  assert.match(sql, /migration_source_rows/);
  assert.match(sql, /legacy_identity_map/);
  assert.match(sql, /on conflict/i);
  assert.match(sql, /grant execute[\s\S]+to service_role/i);
  assert.match(sql, /revoke all[\s\S]+from public, anon, authenticated/i);
});

test('acesso direto usa identidade autenticada sem expor o banco ao papel anon', async () => {
  const sql = await readFile(directAccessPath, 'utf8');
  assert.match(sql, /new\.is_anonymous/i);
  assert.match(sql, /after insert on auth\.users/i);
  assert.match(sql, /insert into public\.profiles/i);
  assert.match(sql, /array\[99\]::integer\[\]/i);
  assert.match(sql, /revoke all[\s\S]+from public, anon, authenticated/i);
  assert.doesNotMatch(sql, /grant\s+.+\s+to\s+anon/i);
});
