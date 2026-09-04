import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadSnapshot, validateSnapshot } from './validate-source.mjs';

function requiredEnvironment(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`Variável obrigatória ausente: ${name}`);
  return value;
}

function jwtRole(value) {
  try {
    const payload = value.split('.')[1];
    if (!payload) return null;
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')).role || null;
  } catch {
    return null;
  }
}

async function callRpc(url, serviceRoleKey, functionName, body) {
  const response = await fetch(`${url.replace(/\/$/, '')}/rest/v1/rpc/${functionName}`, {
    method: 'POST',
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const responseText = await response.text();
  let data = null;
  if (responseText) {
    try { data = JSON.parse(responseText); } catch { data = responseText; }
  }
  if (!response.ok) {
    const message = typeof data === 'object' && data?.message ? data.message : responseText || `HTTP ${response.status}`;
    throw new Error(`${functionName}: ${message}`);
  }
  return data;
}

async function main() {
  const sourceFile = resolve(process.argv[2] || process.env.MIGRATION_SOURCE_FILE || 'scripts/migration/source/backup.json');
  const sourceBuffer = await readFile(sourceFile);
  const snapshot = await loadSnapshot(sourceFile);
  const validation = validateSnapshot(snapshot);
  console.log(JSON.stringify({ phase: 'validation', ...validation }, null, 2));
  if (!validation.valid) throw new Error('A importação foi bloqueada porque a validação encontrou erros estruturais.');

  if (process.argv.includes('--dry-run') || process.env.MIGRATION_DRY_RUN === 'true') {
    console.log(JSON.stringify({ phase: 'dry-run', success: true, message: 'Nenhum dado remoto foi alterado.' }, null, 2));
    return;
  }

  const supabaseUrl = requiredEnvironment('SUPABASE_URL');
  const serviceRoleKey = requiredEnvironment('SUPABASE_SERVICE_ROLE_KEY');
  if (serviceRoleKey.startsWith('sb_publishable_') || jwtRole(serviceRoleKey) === 'anon') {
    throw new Error('Use uma service role/secret key no importador. A publishable key não possui privilégios de migração.');
  }
  let organizationId = String(process.env.MIGRATION_ORGANIZATION_ID || '').trim();
  if (!organizationId) {
    organizationId = await callRpc(supabaseUrl, serviceRoleKey, 'bootstrap_migration_organization', {
      p_name: String(process.env.MIGRATION_ORGANIZATION_NAME || 'IMG Imóveis Mogi Guaçu'),
      p_slug: String(process.env.MIGRATION_ORGANIZATION_SLUG || 'img-imoveis-mogi-guacu'),
    });
  }
  const sourceId = String(process.env.MIGRATION_SOURCE_ID || snapshot.sourceSpreadsheetId || 'google-sheet-backup');
  const checksum = createHash('sha256').update(sourceBuffer).digest('hex');

  const runId = await callRpc(supabaseUrl, serviceRoleKey, 'stage_legacy_snapshot', {
    p_organization_id: organizationId,
    p_source_id: sourceId,
    p_source_checksum: checksum,
    p_snapshot: snapshot,
  });
  if (process.argv.includes('--stage-only') || process.env.MIGRATION_STAGE_ONLY === 'true') {
    console.log(JSON.stringify({ phase: 'stage', success: true, runId, message: 'Snapshot preservado; tabelas operacionais ainda não foram alteradas.' }, null, 2));
    return;
  }
  const result = await callRpc(supabaseUrl, serviceRoleKey, 'apply_legacy_migration', { p_run_id: runId });
  if (result?.success === false) {
    throw new Error(`apply_legacy_migration: ${result.error || 'falha sem detalhe'}`);
  }
  const reconciliation = await callRpc(supabaseUrl, serviceRoleKey, 'migration_reconciliation_report', { p_run_id: runId });

  console.log(JSON.stringify({ phase: 'import', success: true, runId, result, reconciliation }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
  process.exitCode = 1;
});
