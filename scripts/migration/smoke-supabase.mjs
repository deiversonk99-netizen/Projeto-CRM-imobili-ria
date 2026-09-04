import { createClient } from '@supabase/supabase-js';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const publicKey = 'sb_publishable_NcZhbSgmRLg0x_WPklbFkg_w2xYq1A-';

async function loadEnv(fileName) {
  const text = await readFile(resolve(fileName), 'utf8');
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (!process.env[key]) process.env[key] = value;
  }
}

function parseProperties(text) {
  return Object.fromEntries(text.split(/\r?\n/).filter(Boolean).map(line => {
    const separator = line.indexOf('=');
    return [line.slice(0, separator), line.slice(separator + 1)];
  }));
}

async function rpc(client, name, args = {}) {
  const { data, error } = await client.rpc(name, args);
  if (error) throw new Error(`${name}: ${error.message}`);
  if (data?.error) throw Object.assign(new Error(`${name}: ${data.error}`), { code: data.code, data });
  return data;
}

function assert(condition, message) {
  if (!condition) throw new Error(`ASSERTION_FAILED: ${message}`);
}

await loadEnv(process.env.MIGRATION_ENV_FILE || '.env.migration.local');
const url = process.env.SUPABASE_URL;
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !secret) throw new Error('Configuração administrativa ausente.');

const credentials = parseProperties(await readFile(resolve('scripts/migration/source/admin-credentials.txt'), 'utf8'));
const service = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
const production = createClient(url, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });

const denied = await createClient(url, publicKey, { auth: { persistSession: false } }).rpc('app_get_cadastros');
assert(Boolean(denied.error), 'RLS/API deve recusar chamadas sem sessão.');

const productionLogin = await production.auth.signInWithPassword({ email: credentials.email, password: credentials.password });
if (productionLogin.error) throw productionLogin.error;
const health = await rpc(production, 'get_app_health');
const productionData = {
  cadastros: await rpc(production, 'app_get_cadastros'),
  checklists: await rpc(production, 'app_get_checklists'),
  tarefas: await rpc(production, 'app_get_tarefas'),
  condominios: await rpc(production, 'app_get_condominios'),
  cobrancas: await rpc(production, 'app_get_cobrancas'),
  campanhas: await rpc(production, 'app_get_campanhas'),
};
assert(health.backend === 'supabase', 'Health check deve identificar o Supabase.');
assert(productionData.cadastros.length > 0, 'Cadastros migrados devem estar disponíveis.');
assert(productionData.checklists.length > 0, 'Checklists migrados devem estar disponíveis.');
await production.auth.signOut();

const suffix = randomBytes(5).toString('hex');
const testEmail = `integration-${suffix}@img-imoveis.local`;
const testPassword = `${randomBytes(18).toString('base64url')}A!9`;
let testOrganizationId;
let testUserId;
let failure;
const checks = [];

try {
  const organizationResult = await service.from('organizations').insert({
    name: `Integration Test ${suffix}`,
    slug: `integration-test-${suffix}`,
  }).select('id').single();
  if (organizationResult.error) throw organizationResult.error;
  testOrganizationId = organizationResult.data.id;
  await service.from('app_settings').insert({ organization_id: testOrganizationId, data_backend: 'supabase', schema_version: 2 });

  const userResult = await service.auth.admin.createUser({ email: testEmail, password: testPassword, email_confirm: true });
  if (userResult.error || !userResult.data.user) throw userResult.error || new Error('Falha ao criar usuário de integração.');
  testUserId = userResult.data.user.id;
  const profileResult = await service.from('profiles').insert({
    user_id: testUserId, organization_id: testOrganizationId, full_name: 'Integration Test', interfaces: [99], active: true,
  });
  if (profileResult.error) throw profileResult.error;

  const client = createClient(url, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const loginResult = await client.auth.signInWithPassword({ email: testEmail, password: testPassword });
  if (loginResult.error) throw loginResult.error;

  const cadastroId = randomUUID();
  const createOperationId = randomUUID();
  const cadastro = {
    id: cadastroId, operationId: createOperationId, contrato: `TEST-${suffix}`,
    nomeProp: 'Proprietário Integração', telProp: '(19) 99999-0001', niverProp: '10/05', emailProp: '',
    nomeInq: 'Inquilino Integração', telInq: '(19) 99999-0002', niverInq: '20/06', emailInq: '',
    inicioContrato: '2026-01-01', fimContrato: '2027-12-31', corretor: 'Teste', diaVencimento: 10,
    enderecoImovel: 'Endereço de integração', tipoImovel: 'Casa', finalidade: 'Residencial',
    condominio: `Condomínio ${suffix}`, valorAluguel: 1500, comissao: 150, status: 'Ativo',
  };
  const created = await rpc(client, 'app_save_cadastro', { p_data: cadastro });
  const createRetry = await rpc(client, 'app_save_cadastro', { p_data: cadastro });
  assert(created.version === 1 && createRetry.status === 'already_updated', 'Criação de cadastro deve ser idempotente.');
  checks.push('cadastro_create_idempotency');

  const initialCadastros = await rpc(client, 'app_get_cadastros');
  assert(initialCadastros.length === 1 && initialCadastros[0].id === cadastroId, 'Cadastro deve ser lido no formato do frontend.');

  const updated = await rpc(client, 'app_update_cadastro', { p_data: {
    ...initialCadastros[0], nomeInq: 'Inquilino Atualizado', expectedVersion: 1, operationId: randomUUID(),
  } });
  assert(updated.version === 2, 'Edição deve incrementar a versão.');
  let conflictDetected = false;
  try {
    await rpc(client, 'app_update_cadastro', { p_data: {
      ...initialCadastros[0], expectedVersion: 1, operationId: randomUUID(),
    } });
  } catch (error) {
    conflictDetected = error.code === 'CADASTRO_CONFLICT' && error.data?.currentVersion === 2;
  }
  assert(conflictDetected, 'Edição defasada deve gerar conflito explícito.');
  checks.push('cadastro_update_conflict');

  const checklists = await rpc(client, 'app_get_checklists');
  const checklistOperation = randomUUID();
  const checklistPayload = {
    ...checklists[0], version: 1, operationId: checklistOperation,
    documentos_json: JSON.stringify([{ id: 'doc-integration', nome: 'Documento de teste', categoria: 'Outros', isFeito: true, pendencia: '', status: 'Feito' }]),
  };
  const checklistSaved = await rpc(client, 'app_update_checklist', { p_data: checklistPayload });
  const checklistRetry = await rpc(client, 'app_update_checklist', { p_data: checklistPayload });
  assert(checklistSaved.version === 2 && checklistRetry.status === 'already_updated', 'Checklist deve persistir e repetir com segurança.');
  checks.push('checklist_atomic_idempotency');

  const taskOperation = randomUUID();
  const task = await rpc(client, 'app_save_tarefa', { p_data: {
    contrato: cadastro.contrato, tipo: 'Aniversário', usuario: 'Inquilino', referencia: '2026', operationId: taskOperation,
  } });
  const taskRetry = await rpc(client, 'app_save_tarefa', { p_data: {
    contrato: cadastro.contrato, tipo: 'Aniversário', usuario: 'Inquilino', referencia: '2026', operationId: taskOperation,
  } });
  assert(task.id === taskRetry.id, 'Tarefa repetida não pode duplicar.');
  await rpc(client, 'app_delete_tarefa', { p_id: task.id });
  checks.push('task_create_delete');

  await rpc(client, 'app_upsert_condominio', { p_data: { nome: cadastro.condominio, ativo: true } });
  const condominios = await rpc(client, 'app_get_condominios');
  assert(condominios.filter(item => item.nomeNormalizado.includes(suffix)).length === 1, 'Condomínio deve usar chave normalizada.');
  checks.push('condominium_upsert');

  await rpc(client, 'app_sync_cobrancas');
  let charges = await rpc(client, 'app_get_cobrancas');
  assert(charges.length === 3, 'Sincronização deve gerar três competências sem duplicar.');
  const charge = charges.at(-1);
  await rpc(client, 'app_upsert_cobranca', { p_data: {
    ...charge, envioConfirmadoEm: new Date().toISOString(), envioOperationId: randomUUID(),
  } });
  charges = await rpc(client, 'app_get_cobrancas');
  const delivered = charges.find(item => item.id === charge.id);
  assert(Boolean(delivered.envioConfirmadoEm), 'Confirmação de envio deve persistir.');
  await rpc(client, 'app_upsert_cobranca', { p_data: {
    ...delivered, statusPagamento: 'Pago', pagoEm: new Date().toISOString(), pagamentoOperationId: randomUUID(),
  } });
  charges = await rpc(client, 'app_get_cobrancas');
  assert(charges.find(item => item.id === charge.id)?.statusPagamento === 'Pago', 'Baixa de boleto deve persistir.');
  checks.push('charges_sync_delivery_payment');

  const campaignId = randomUUID();
  const campaignCreated = await rpc(client, 'app_save_campanha', { p_payload: {
    id: campaignId, operationId: randomUUID(), nome: 'Campanha Integração', descricao: 'Teste isolado',
    mensagemTemplate: 'Olá {{nome}}', filtrosJson: '{}',
  } });
  const campaignUpdated = await rpc(client, 'app_update_campanha', { p_payload: {
    id: campaignId, expectedVersion: campaignCreated.version, operationId: randomUUID(), descricao: 'Atualizada',
  } });
  const deactivated = await rpc(client, 'app_set_campanha_ativa', { p_payload: {
    id: campaignId, expectedVersion: campaignUpdated.version, operationId: randomUUID(), ativa: false,
  } });
  const reactivated = await rpc(client, 'app_set_campanha_ativa', { p_payload: {
    id: campaignId, expectedVersion: deactivated.version, operationId: randomUUID(), ativa: true,
  } });
  const recipientId = randomUUID();
  const started = await rpc(client, 'app_iniciar_campanha', { p_payload: {
    id: campaignId, expectedVersion: reactivated.version, operationId: randomUUID(), destinatarios: [{
      id: recipientId, campanhaId: campaignId, contactKey: '5519999990002', nome: cadastro.nomeInq,
      telefone: '5519999990002', perfisJson: '["Inquilino"]', cadastroIdsJson: JSON.stringify([cadastroId]),
      contratosJson: JSON.stringify([cadastro.contrato]), contextoJson: '{}', mensagemRenderizada: 'Olá', status: 'PENDENTE',
    }],
  } });
  const recipients = await rpc(client, 'app_get_campanha_destinatarios', { p_campanha_id: campaignId });
  assert(started.audienciaTotal === 1 && recipients.length === 1, 'Campanha deve congelar a audiência.');
  const opened = await rpc(client, 'app_update_campanha_destinatario', { p_payload: {
    id: recipients[0].id, expectedVersion: recipients[0].version, operationId: randomUUID(), status: 'WHATSAPP_ABERTO',
  } });
  const confirmed = await rpc(client, 'app_update_campanha_destinatario', { p_payload: {
    id: recipients[0].id, expectedVersion: opened.version, operationId: randomUUID(), status: 'ENVIO_CONFIRMADO',
  } });
  assert(confirmed.version === opened.version + 1, 'Fila de WhatsApp deve respeitar a máquina de estados.');
  checks.push('campaign_lifecycle_recipient_state_machine');

  const archived = await rpc(client, 'app_delete_cadastro', { p_payload: {
    id: cadastroId, expectedVersion: 2, operationId: randomUUID(),
  } });
  assert(archived.version === 3 && (await rpc(client, 'app_get_cadastros')).length === 0, 'Arquivamento deve preservar histórico e ocultar o contrato.');
  checks.push('contract_archive');
  await client.auth.signOut();
} catch (error) {
  failure = error;
} finally {
  if (testUserId) await service.auth.admin.deleteUser(testUserId);
  if (testOrganizationId) {
    await service.from('audit_log').delete().eq('organization_id', testOrganizationId);
    await service.from('organizations').delete().eq('id', testOrganizationId);
    await service.from('audit_log').delete().eq('actor_user_id', testUserId);
  }
}

if (failure) throw failure;
console.log(JSON.stringify({
  success: true,
  security: { anonymousAccessDenied: true, authenticatedRls: true },
  health,
  productionCounts: Object.fromEntries(Object.entries(productionData).map(([key, value]) => [key, value.length])),
  mutationChecks: checks,
  temporaryDataRemoved: true,
}, null, 2));
