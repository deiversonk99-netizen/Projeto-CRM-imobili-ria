import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const EXPECTED_SHEETS = [
  'Cadastros',
  'Checklists',
  'Tarefas',
  'Condominios',
  'Cobrancas',
  'Campanhas',
  'Campanha_Destinatarios',
  'Campanha_Operacoes',
  'Operacoes',
];

const REQUIRED_CADASTRO_FIELDS = ['id', 'contrato', 'nomeProp', 'nomeInq'];

function rowsFor(snapshot, sheetName) {
  const rows = snapshot?.sheets?.[sheetName];
  return Array.isArray(rows) ? rows : [];
}

function text(value) {
  return String(value ?? '').trim();
}

export function normalizeContract(value) {
  return text(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export function normalizeCompetence(value) {
  const raw = text(value);
  const yearMonth = raw.match(/^(\d{4})[-/](\d{1,2})(?:[-/]|$)/);
  if (yearMonth) return `${yearMonth[1]}-${yearMonth[2].padStart(2, '0')}`;
  const monthYear = raw.match(/^(\d{1,2})[-/](\d{4})$/);
  if (monthYear) return `${monthYear[2]}-${monthYear[1].padStart(2, '0')}`;
  return raw;
}

function parseJsonArray(value) {
  if (Array.isArray(value)) return value;
  if (!text(value)) return [];
  const parsed = JSON.parse(String(value));
  if (!Array.isArray(parsed)) throw new Error('JSON não é um array');
  return parsed;
}

function duplicateKeys(rows, keyBuilder) {
  const seen = new Map();
  for (const [index, row] of rows.entries()) {
    const key = keyBuilder(row);
    if (!key) continue;
    const sourceRow = Number(row?._sourceRow) || index + 2;
    const group = seen.get(key) ?? [];
    group.push(sourceRow);
    seen.set(key, group);
  }
  return [...seen.entries()].filter(([, sourceRows]) => sourceRows.length > 1);
}

function issue(code, sheet, detail, rows = []) {
  return { code, sheet, detail, rows };
}

export function validateSnapshot(snapshot) {
  const errors = [];
  const warnings = [];
  const counts = {};

  if (!snapshot || typeof snapshot !== 'object' || !snapshot.sheets || typeof snapshot.sheets !== 'object') {
    return {
      valid: false,
      errors: [issue('INVALID_SNAPSHOT', '', 'O arquivo deve conter um objeto sheets.')],
      warnings,
      counts,
      metrics: {},
    };
  }

  for (const sheetName of EXPECTED_SHEETS) {
    counts[sheetName] = rowsFor(snapshot, sheetName).length;
    if (!(sheetName in snapshot.sheets)) {
      warnings.push(issue('MISSING_SHEET', sheetName, 'A aba não existe no snapshot e será tratada como vazia.'));
    }
  }

  const cadastros = rowsFor(snapshot, 'Cadastros');
  const cadastroIds = new Set();
  const contractKeys = new Set();
  cadastros.forEach((row, index) => {
    const sourceRow = Number(row?._sourceRow) || index + 2;
    const missing = REQUIRED_CADASTRO_FIELDS.filter((field) => !text(row?.[field]));
    if (missing.length > 0) {
      errors.push(issue('MISSING_REQUIRED_FIELD', 'Cadastros', `Campos obrigatórios ausentes: ${missing.join(', ')}.`, [sourceRow]));
    }
    if (text(row?.id)) cadastroIds.add(text(row.id));
    if (normalizeContract(row?.contrato)) contractKeys.add(normalizeContract(row.contrato));
  });

  const duplicateIds = duplicateKeys(cadastros, (row) => text(row?.id));
  duplicateIds.forEach(([, sourceRows]) => {
    errors.push(issue('DUPLICATE_LEGACY_ID', 'Cadastros', 'O mesmo ID legado aparece em mais de uma linha.', sourceRows));
  });

  const duplicateContracts = duplicateKeys(cadastros, (row) => normalizeContract(row?.contrato));
  duplicateContracts.forEach(([, sourceRows]) => {
    warnings.push(issue('DUPLICATE_CONTRACT', 'Cadastros', 'Linhas com o mesmo número de contrato serão preservadas no staging e consolidadas no cadastro operacional.', sourceRows));
  });

  const checklists = rowsFor(snapshot, 'Checklists');
  checklists.forEach((row, index) => {
    const sourceRow = Number(row?._sourceRow) || index + 2;
    const linkedById = cadastroIds.has(text(row?.id));
    const linkedByContract = contractKeys.has(normalizeContract(row?.contrato));
    if (!linkedById && !linkedByContract) {
      errors.push(issue('ORPHAN_CHECKLIST', 'Checklists', 'Checklist sem cadastro correspondente.', [sourceRow]));
    }
    try {
      parseJsonArray(row?.documentos_json);
    } catch {
      errors.push(issue('INVALID_DOCUMENTS_JSON', 'Checklists', 'documentos_json não contém um array JSON válido.', [sourceRow]));
    }
  });

  const charges = rowsFor(snapshot, 'Cobrancas');
  charges.forEach((row, index) => {
    const sourceRow = Number(row?._sourceRow) || index + 2;
    const linkedById = cadastroIds.has(text(row?.cadastroId));
    const linkedByContract = contractKeys.has(normalizeContract(row?.contrato));
    if (!linkedById && !linkedByContract) {
      errors.push(issue('ORPHAN_CHARGE', 'Cobrancas', 'Cobrança sem cadastro correspondente.', [sourceRow]));
    }
    if (!normalizeCompetence(row?.competencia)) {
      errors.push(issue('MISSING_COMPETENCE', 'Cobrancas', 'Cobrança sem competência.', [sourceRow]));
    }
  });

  const duplicateCharges = duplicateKeys(charges, (row) => {
    const identity = normalizeContract(row?.contrato) || text(row?.cadastroId).toLowerCase();
    const competence = normalizeCompetence(row?.competencia);
    return identity && competence ? `${identity}|${competence}` : '';
  });
  duplicateCharges.forEach(([, sourceRows]) => {
    warnings.push(issue('DUPLICATE_CHARGE', 'Cobrancas', 'Cobranças repetidas serão preservadas no staging e reconciliadas por contrato + competência.', sourceRows));
  });

  const campaigns = rowsFor(snapshot, 'Campanhas');
  const campaignIds = new Set(campaigns.map((row) => text(row?.id)).filter(Boolean));
  const recipients = rowsFor(snapshot, 'Campanha_Destinatarios');
  recipients.forEach((row, index) => {
    const sourceRow = Number(row?._sourceRow) || index + 2;
    if (!campaignIds.has(text(row?.campanhaId))) {
      warnings.push(issue('ORPHAN_CAMPAIGN_RECIPIENT', 'Campanha_Destinatarios', 'Destinatário sem campanha atual; uma campanha legada arquivada será criada para preservar o histórico.', [sourceRow]));
    }
    for (const field of ['perfisJson', 'cadastroIdsJson', 'contratosJson']) {
      try {
        parseJsonArray(row?.[field]);
      } catch {
        errors.push(issue('INVALID_RECIPIENT_JSON', 'Campanha_Destinatarios', `${field} não contém um array JSON válido.`, [sourceRow]));
      }
    }
  });

  const operationIds = [
    ...rowsFor(snapshot, 'Operacoes'),
    ...rowsFor(snapshot, 'Campanha_Operacoes'),
  ];
  const duplicateOperations = duplicateKeys(operationIds, (row) => text(row?.operationId));
  duplicateOperations.forEach(([, sourceRows]) => {
    warnings.push(issue('DUPLICATE_OPERATION', 'Operacoes', 'Operação repetida será consolidada pelo operationId.', sourceRows));
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    counts,
    metrics: {
      uniqueCadastroIds: cadastroIds.size,
      uniqueContracts: contractKeys.size,
      duplicateContractGroups: duplicateContracts.length,
      duplicateChargeGroups: duplicateCharges.length,
      orphanCampaignRecipients: warnings.filter((item) => item.code === 'ORPHAN_CAMPAIGN_RECIPIENT').length,
    },
  };
}

export async function loadSnapshot(filePath) {
  const raw = await readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

function printReport(report) {
  console.log(JSON.stringify(report, null, 2));
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : '';
if (invokedPath && invokedPath === fileURLToPath(import.meta.url)) {
  const filePath = resolve(process.argv[2] || process.env.MIGRATION_SOURCE_FILE || 'scripts/migration/source/backup.json');
  try {
    const report = validateSnapshot(await loadSnapshot(filePath));
    printReport(report);
    if (!report.valid) process.exitCode = 1;
  } catch (error) {
    console.error(JSON.stringify({ valid: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
    process.exitCode = 1;
  }
}
