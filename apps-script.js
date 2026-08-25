const APP_SCHEMA_VERSION = '2026-08-24.1';
const AUTH_TOKEN_TTL_SECONDS = 8 * 60 * 60;

function getSpreadsheet_() {
  const configuredId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!configuredId) throw new Error('SPREADSHEET_NOT_CONFIGURED: defina SPREADSHEET_ID nas Propriedades do script.');
  return SpreadsheetApp.openById(configuredId);
}

function normalizeText_(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function parseDateOnly_(value) {
  if (!value) return null;
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function validateCadastro_(data) {
  if (!data || !String(data.contrato || '').trim() || !String(data.nomeProp || '').trim() || !String(data.nomeInq || '').trim()) {
    return { error: 'VALIDATION_ERROR: contrato, proprietário e inquilino são obrigatórios.', code: 'VALIDATION_ERROR' };
  }
  const validPhone = function(value) {
    let digits = String(value || '').replace(/\D/g, '').replace(/^0+/, '');
    if (digits.length >= 12 && digits.indexOf('55') === 0) digits = digits.substring(2);
    return /^[1-9]{2}\d{8,9}$/.test(digits);
  };
  if (!validPhone(data.telProp) || !validPhone(data.telInq)) {
    return { error: 'VALIDATION_ERROR: telefones de proprietário e inquilino são inválidos.', code: 'VALIDATION_ERROR' };
  }
  const validBirthday = function(value) {
    if (!value) return true;
    const match = String(value).match(/^(?:(\d{2})\/(\d{2})|\d{4}-(\d{2})-(\d{2}))$/);
    if (!match) return false;
    const day = Number(match[1] || match[4]);
    const month = Number(match[2] || match[3]);
    return month >= 1 && month <= 12 && day >= 1 && day <= new Date(2024, month, 0).getDate();
  };
  if (!validBirthday(data.niverProp) || !validBirthday(data.niverInq)) {
    return { error: 'VALIDATION_ERROR: aniversários devem estar em DD/MM.', code: 'VALIDATION_ERROR' };
  }
  const start = parseDateOnly_(data.inicioContrato);
  const end = parseDateOnly_(data.fimContrato);
  if (!start || !end || end <= start) {
    return { error: 'VALIDATION_ERROR: datas do contrato são inválidas.', code: 'VALIDATION_ERROR' };
  }
  const dueDay = Number(data.diaVencimento);
  if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) {
    return { error: 'VALIDATION_ERROR: dia de vencimento deve estar entre 1 e 31.', code: 'VALIDATION_ERROR' };
  }
  if (data.valorAluguel !== '' && (!Number.isFinite(Number(data.valorAluguel)) || Number(data.valorAluguel) < 0)) {
    return { error: 'VALIDATION_ERROR: valor do aluguel é inválido.', code: 'VALIDATION_ERROR' };
  }
  return null;
}

function ensureSheetSchema_(ss, sheetName, requiredHeaders) {
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) sheet = ss.insertSheet(sheetName);

  if (sheet.getLastColumn() === 0 || sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, requiredHeaders.length).setValues([requiredHeaders]);
  } else {
    const existingHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
    const missingHeaders = requiredHeaders.filter(header => existingHeaders.indexOf(header) === -1);
    if (missingHeaders.length > 0) {
      sheet.getRange(1, existingHeaders.length + 1, 1, missingHeaders.length).setValues([missingHeaders]);
    }
  }

  const lastColumn = sheet.getLastColumn();
  sheet.getRange(1, 1, 1, lastColumn).setFontWeight('bold').setBackground('#d0e0e3');
  sheet.setFrozenRows(1);
  return sheet;
}

function sha256Hex_(value) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(value));
  return bytes.map(byte => (byte < 0 ? byte + 256 : byte).toString(16).padStart(2, '0')).join('');
}

function base64WebSafe_(value) {
  return Utilities.base64EncodeWebSafe(value).replace(/=+$/g, '');
}

function setupAuth(adminLogin, adminPassword, adminName, adminEmail) {
  if (!adminLogin || !adminPassword || String(adminPassword).length < 10) {
    throw new Error('Informe login e uma senha com pelo menos 10 caracteres.');
  }

  const props = PropertiesService.getScriptProperties();
  const salt = Utilities.getUuid();
  const user = {
    id: Utilities.getUuid(),
    nome: adminName || 'Administrador',
    email: adminEmail || '',
    login: normalizeText_(adminLogin),
    passwordSalt: salt,
    passwordHash: sha256Hex_(salt + ':' + String(adminPassword)),
    interfaces: [1, 2, 3, 4, 5, 6, 99],
    ativo: true
  };

  props.setProperties({
    APP_USERS_JSON: JSON.stringify([user]),
    APP_SESSION_SECRET: Utilities.getUuid() + Utilities.getUuid(),
    APP_AUTH_CONFIGURED: 'true'
  });
  return { success: true, login: user.login };
}

function createAuthToken_(user) {
  const props = PropertiesService.getScriptProperties();
  const secret = props.getProperty('APP_SESSION_SECRET');
  if (!secret) throw new Error('AUTH_NOT_CONFIGURED');

  const payload = {
    sub: user.id,
    nome: user.nome,
    email: user.email || '',
    login: user.login,
    interfaces: user.interfaces || [],
    exp: Date.now() + AUTH_TOKEN_TTL_SECONDS * 1000,
    nonce: Utilities.getUuid()
  };
  const encodedPayload = base64WebSafe_(JSON.stringify(payload));
  const signature = base64WebSafe_(Utilities.computeHmacSha256Signature(encodedPayload, secret));
  return encodedPayload + '.' + signature;
}

function verifyAuthToken_(token) {
  if (!token || String(token).indexOf('.') === -1) return null;
  try {
    const parts = String(token).split('.');
    const secret = PropertiesService.getScriptProperties().getProperty('APP_SESSION_SECRET');
    if (!secret || parts.length !== 2) return null;
    const expected = base64WebSafe_(Utilities.computeHmacSha256Signature(parts[0], secret));
    if (expected !== parts[1]) return null;
    const payload = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString());
    if (!payload.exp || Number(payload.exp) <= Date.now()) return null;
    return payload;
  } catch (error) {
    return null;
  }
}

function login_(credentials) {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('APP_AUTH_CONFIGURED') !== 'true') {
    if (normalizeText_(credentials && credentials.login) === '__legacy__') {
      return {
        success: true,
        token: 'legacy-transition',
        expiresIn: 0,
        transitionMode: true,
        user: {
          id: 'legacy-transition',
          nome: 'Admin (modo de transição)',
          email: '',
          login: '__legacy__',
          interfaces: [1, 2, 3, 4, 5, 6, 99]
        }
      };
    }
    return { error: 'AUTH_NOT_CONFIGURED: Execute setupAuth no Apps Script.', code: 'AUTH_NOT_CONFIGURED' };
  }

  let users = [];
  try { users = JSON.parse(props.getProperty('APP_USERS_JSON') || '[]'); } catch (error) {}
  const login = normalizeText_(credentials && credentials.login);
  const password = String(credentials && credentials.password || '');
  const user = users.find(item => item.ativo !== false && item.login === login);
  if (!user || sha256Hex_(user.passwordSalt + ':' + password) !== user.passwordHash) {
    return { error: 'Login ou senha inválidos.', code: 'INVALID_CREDENTIALS' };
  }

  return {
    success: true,
    token: createAuthToken_(user),
    expiresIn: AUTH_TOKEN_TTL_SECONDS,
    user: { id: user.id, nome: user.nome, email: user.email || '', login: user.login, interfaces: user.interfaces || [] }
  };
}

function requiredInterfacesForAction_(action) {
  const mapping = {
    getCadastros: [1, 2, 3, 4, 5, 6],
    saveCadastro: [1], updateCadastro: [1], deleteCadastro: [1],
    getChecklists: [4], updateChecklist: [4],
    getTarefas: [2], saveTarefa: [2], deleteTarefa: [2],
    getCondominios: [1, 6], upsertCondominio: [1],
    getCobrancas: [5], syncCobrancas: [5], syncCobrancasHistoricas: [5], upsertCobranca: [5],
    getCampanhas: [6], getCampanhaDestinatarios: [6], saveCampanha: [6],
    iniciarCampanha: [6], updateCampanha: [6], updateCampanhaDestinatario: [6],
    setCampanhaAtiva: [6], cancelarCampanha: [6], arquivarCampanha: [6], deleteCampanha: [6]
  };
  return mapping[action] || [];
}

function authorizeAction_(data) {
  if (PropertiesService.getScriptProperties().getProperty('APP_AUTH_CONFIGURED') !== 'true') {
    return {
      user: {
        id: 'legacy-transition',
        nome: 'Admin (modo de transição)',
        email: '',
        login: '__legacy__',
        interfaces: [1, 2, 3, 4, 5, 6, 99]
      }
    };
  }
  const user = verifyAuthToken_(data.authToken);
  if (!user) return { error: 'Sessão inválida ou expirada.', code: 'UNAUTHORIZED' };
  const allowed = user.interfaces || [];
  const required = requiredInterfacesForAction_(data.action);
  if (allowed.indexOf(99) === -1 && required.length > 0 && !required.some(id => allowed.indexOf(id) !== -1)) {
    return { error: 'Usuário sem permissão para esta operação.', code: 'FORBIDDEN' };
  }
  return { user: user };
}

function setupSpreadsheet() {
  const ss = getSpreadsheet_();

  const sheetsConfig = {
    'Cadastros': [
      'id', 'dataHora', 'contrato', 'nomeProp', 'telProp', 'niverProp',
      'nomeInq', 'telInq', 'niverInq', 'inicioContrato', 'fimContrato',
      'corretor', 'diaVencimento', 'enderecoImovel', 'tipoImovel', 'valorAluguel',
      'comissao', 'emailProp', 'emailInq', 'status', 'finalidade', 'condominio',
      'version', 'operationId', 'deletedAt', 'renewedFromId', 'operationHash'
    ],
    'Checklists': [
      'id', 'contrato', 'prop_contratoEnviado', 'prop_vistoriaEnviada',
      'inq_manualEntregue', 'inq_vistoriaAssinada', 'inq_seguroIncendio',
      'documentos_json', 'version', 'operationId'
    ],
    'Tarefas': [
      'idTarefa', 'dataConclusao', 'contrato', 'tipo', 'usuario', 'referencia', 'operationId', 'deletedAt'
    ],
    'Condominios': [
      'id', 'nome', 'nomeNormalizado', 'ativo', 'createdAt', 'operationId'
    ],
    'Cobrancas': [
      'id', 'cadastroId', 'contrato', 'competencia', 'vencimento', 'valor',
      'statusPagamento', 'pagoEm', 'envioConfirmadoEm', 'envioOperationId', 'pagamentoOperationId',
      'version', 'createdAt', 'updatedAt'
    ],
    'Campanhas': [
      'id', 'nome', 'descricao', 'mensagemTemplate', 'filtrosJson', 'status',
      'inicioEm', 'fimEm', 'audienciaTotal', 'createdBy', 'createdAt', 'updatedAt',
      'version', 'operationId', 'ativa', 'desativadaEm'
    ],
    'Campanha_Destinatarios': [
      'id', 'campanhaId', 'contactKey', 'nome', 'telefone', 'perfisJson',
      'cadastroIdsJson', 'contratosJson', 'contextoJson', 'mensagemRenderizada',
      'status', 'whatsappAbertoEm', 'envioConfirmadoEm', 'ignoradoEm', 'motivo',
      'createdAt', 'updatedAt', 'version', 'operationId'
    ],
    'Campanha_Operacoes': [
      'operationId', 'timestamp', 'status', 'result_version', 'target_id', 'requested_version',
      'payload_hash', 'action'
    ],
    'Operacoes': [
      'operationId', 'timestamp', 'status', 'result_version', 'target_id', 'requested_version',
      'payload_hash', 'action'
    ]
  };

  for (const sheetName in sheetsConfig) {
    const sheet = ensureSheetSchema_(ss, sheetName, sheetsConfig[sheetName]);

    // Seed condominios
    if (sheetName === 'Condominios' && sheet.getLastRow() <= 1) {
      const defaults = ['Vila Hadassas', 'Morro do Sol', 'Bela Vista', 'Residencial Oregon', 'Outro'];
      const rows = defaults.map(nome => [
        Utilities.getUuid(), nome, normalizeText_(nome), true, new Date().toISOString(), Utilities.getUuid()
      ]);
      sheet.getRange(2, 1, rows.length, 6).setValues(rows);
    }

  }

  const campaignSheet = ss.getSheetByName('Campanhas');
  const campaignHeaders = campaignSheet.getRange(1, 1, 1, campaignSheet.getLastColumn()).getValues()[0];
  const activeColumn = campaignHeaders.indexOf('ativa') + 1;
  if (activeColumn > 0 && campaignSheet.getLastRow() > 1) {
    const activeValues = campaignSheet.getRange(2, activeColumn, campaignSheet.getLastRow() - 1, 1).getValues();
    let changed = false;
    activeValues.forEach(row => { if (row[0] === '') { row[0] = true; changed = true; } });
    if (changed) campaignSheet.getRange(2, activeColumn, activeValues.length, 1).setValues(activeValues);
  }

  const cobrancasSheet = ss.getSheetByName('Cobrancas');
  const cobrancasHeaders = cobrancasSheet.getRange(1, 1, 1, cobrancasSheet.getLastColumn()).getValues()[0].map(String);
  const competenciaColumn = cobrancasHeaders.indexOf('competencia') + 1;
  if (competenciaColumn > 0 && cobrancasSheet.getMaxRows() > 1) {
    cobrancasSheet.getRange(2, competenciaColumn, cobrancasSheet.getMaxRows() - 1, 1).setNumberFormat('@');
  }

  const triggers = ScriptApp.getProjectTriggers();
  const hasTrigger = triggers.some(trigger => trigger.getHandlerFunction() === 'gerarCobrancasMensais');
  if (!hasTrigger) {
    ScriptApp.newTrigger('gerarCobrancasMensais').timeBased().everyDays(1).atHour(1).create();
  }

  PropertiesService.getScriptProperties().setProperty('APP_SCHEMA_VERSION', APP_SCHEMA_VERSION);
  return { success: true, schemaVersion: APP_SCHEMA_VERSION };
}

function doPost(e) {
  const response = handleRequest(e.postData.contents);
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  if (e && e.parameter && e.parameter.action === 'health') {
    return jsonResponse({
      success: true,
      schemaVersion: APP_SCHEMA_VERSION,
      authConfigured: PropertiesService.getScriptProperties().getProperty('APP_AUTH_CONFIGURED') === 'true'
    });
  }
  return jsonResponse({ error: 'Use POST autenticado.', code: 'METHOD_NOT_ALLOWED' });
}

function handleRequest(body) {
  let data;
  try {
    data = JSON.parse(body || '{}');
  } catch (error) {
    return { error: 'JSON inválido.', code: 'INVALID_JSON' };
  }

  const action = data.action;
  if (action === 'login') return login_(data.credentials || {});
  if (action === 'health') {
    return {
      success: true,
      schemaVersion: APP_SCHEMA_VERSION,
      authConfigured: PropertiesService.getScriptProperties().getProperty('APP_AUTH_CONFIGURED') === 'true'
    };
  }

  const authorization = authorizeAction_(data);
  if (authorization.error) return authorization;
  data.authUser = authorization.user;

  const readActions = ['getCadastros', 'getChecklists', 'getTarefas', 'getCondominios', 'getCobrancas', 'getCampanhas', 'getCampanhaDestinatarios'];
  const execute = function() {
    if (action === 'getCadastros') return getSheetData('Cadastros').filter(item => !item.deletedAt);
    if (action === 'getChecklists') return getSheetData('Checklists');
    if (action === 'getTarefas') return getSheetData('Tarefas').filter(item => !item.deletedAt);
    if (action === 'getCondominios') return getSheetData('Condominios');
    if (action === 'getCobrancas') return getSheetData('Cobrancas');
    if (action === 'getCampanhas') return getCampanhas();
    if (action === 'getCampanhaDestinatarios') return getCampanhaDestinatarios(data.campanhaId);

    if (action === 'saveCadastro') {
      return saveCadastro(data.data);
    } else if (action === 'updateChecklist') {
      return updateChecklist(data.data);
    } else if (action === 'saveTarefa') {
      return saveTarefa(data.data);
    } else if (action === 'updateCadastro') {
      return updateCadastro(data.data);
    } else if (action === 'deleteCadastro') {
      return deleteCadastro(data.payload || { id: data.id });
    } else if (action === 'deleteTarefa') {
      return deleteTarefa(data.id);
    } else if (action === 'upsertCondominio') {
      return upsertCondominio(data.data);
    } else if (action === 'upsertCobranca') {
      return upsertCobranca(data.data);
    } else if (action === 'syncCobrancas') {
      return syncCobrancas();
    } else if (action === 'syncCobrancasHistoricas') {
      return gerarCobrancasHistoricas();
    } else if (action === 'saveCampanha') {
      data.payload = data.payload || {};
      data.payload.authUser = data.authUser;
      return saveCampanha(data.payload);
    } else if (action === 'iniciarCampanha') {
      return iniciarCampanha(data.payload);
    } else if (action === 'updateCampanhaDestinatario') {
      return updateCampanhaDestinatario(data.payload);
    } else if (action === 'deleteCampanha') {
      return arquivarCampanha(data.payload || { id: data.id });
    } else if (action === 'updateCampanha') {
      return updateCampanha(data.payload);
    } else if (action === 'setCampanhaAtiva') {
      return setCampanhaAtiva(data.payload);
    } else if (action === 'cancelarCampanha') {
      return cancelarCampanha(data.payload);
    } else if (action === 'arquivarCampanha') {
      return arquivarCampanha(data.payload);
    }

    return { error: 'Ação não encontrada.', code: 'ACTION_NOT_FOUND' };
  };

  if (readActions.indexOf(action) !== -1) {
    try { return execute(); } catch (error) { return { error: error.toString(), code: 'SERVER_ERROR' }; }
  }

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    return execute();
  } catch (error) {
    return { error: error.toString(), code: 'SERVER_ERROR' };
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}

function getSheetData(sheetName) {
  const sheet = getSpreadsheet_().getSheetByName(sheetName);
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return []; // Empty or just headers

  const headers = data[0].map(String);
  const rows = data.slice(1);

  return rows.map(row => {
    let obj = {};
    headers.forEach((header, index) => {
      let val = row[index];
      // Try to parse booleans for Checklists
      if (val === 'TRUE') val = true;
      if (val === 'FALSE') val = false;
      if (sheetName === 'Cobrancas' && header === 'competencia') val = normalizeCompetencia_(val);
      obj[header] = val;
    });
    return obj;
  });
}

function saveCadastro(cadastroData) {
  const validationError = validateCadastro_(cadastroData);
  if (validationError) return validationError;

  const ss = getSpreadsheet_();
  const sheet = ss.getSheetByName('Cadastros');
  const checklistSheet = ss.getSheetByName('Checklists');
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  if (['id', 'contrato', 'version', 'operationId', 'operationHash'].some(function(header) { return headers.indexOf(header) === -1; })) {
    return { error: 'SCHEMA_OUTDATED: Execute setupSpreadsheet() antes de salvar cadastros.', code: 'SCHEMA_OUTDATED' };
  }
  const requestHash = sha256Hex_(JSON.stringify(canonicalize_({ action: 'saveCadastro', data: cadastroData })));
  const renewalSourceMatch = cadastroData.renewedFromId
    ? sheet.getRange('A:A').createTextFinder(String(cadastroData.renewedFromId)).matchEntireCell(true).findNext()
    : null;
  if (cadastroData.renewedFromId && !renewalSourceMatch) {
    return { error: 'RENEWAL_SOURCE_NOT_FOUND: Contrato anterior não encontrado.', code: 'RENEWAL_SOURCE_NOT_FOUND' };
  }

  const lastRow = sheet.getLastRow();
  let cadastroExists = false;

  if (lastRow > 1) {
    // Only get the IDs and Contratos to check for duplicates and idempotency
    const existingIds = sheet.getRange(2, headers.indexOf('id') + 1, lastRow - 1, 1).getValues();
    const existingContratos = sheet.getRange(2, headers.indexOf('contrato') + 1, lastRow - 1, 1).getValues();
    const existingOperations = sheet.getRange(2, headers.indexOf('operationId') + 1, lastRow - 1, 1).getValues();
    const existingHashes = sheet.getRange(2, headers.indexOf('operationHash') + 1, lastRow - 1, 1).getValues();

    for (let i = 0; i < existingIds.length; i++) {
      const rowId = String(existingIds[i][0]);
      const rowContrato = String(existingContratos[i][0]).trim();
      const inputId = cadastroData.id ? String(cadastroData.id) : null;
      const inputContrato = String(cadastroData.contrato).trim();

      if (inputId && rowId === inputId) {
        if (rowContrato !== inputContrato) {
          return { error: 'Conflito de ID: O mesmo ID foi enviado para um contrato diferente.', code: 'CADASTRO_ID_CONFLICT' };
        }
        const storedOperation = String(existingOperations[i][0] || '');
        const storedHash = String(existingHashes[i][0] || '');
        const incomingOperation = String(cadastroData.operationId || cadastroData.id || '');
        if (storedOperation && incomingOperation && storedOperation !== incomingOperation) {
          return { error: 'CADASTRO_ID_CONFLICT: O cadastro já existe com outra operação.', code: 'CADASTRO_ID_CONFLICT' };
        }
        if (storedHash && storedHash !== requestHash) {
          return { error: 'IDEMPOTENCY_KEY_REUSED: A operação foi reutilizada com dados diferentes.', code: 'IDEMPOTENCY_KEY_REUSED' };
        }
        cadastroExists = true;
      }

      if (rowContrato === inputContrato && (!inputId || rowId !== inputId)) {
        return { error: 'Número de contrato já existe' };
      }
    }
  }

  const id = cadastroData.id || Utilities.getUuid();

  if (!cadastroExists) {
    const dataHora = cadastroData.dataHora || new Date().toISOString();

    const rowData = {
      id: id, dataHora: dataHora, contrato: String(cadastroData.contrato).trim(),
      nomeProp: cadastroData.nomeProp, telProp: cadastroData.telProp, niverProp: cadastroData.niverProp,
      nomeInq: cadastroData.nomeInq, telInq: cadastroData.telInq, niverInq: cadastroData.niverInq,
      inicioContrato: cadastroData.inicioContrato, fimContrato: cadastroData.fimContrato,
      corretor: cadastroData.corretor, diaVencimento: cadastroData.diaVencimento,
      enderecoImovel: cadastroData.enderecoImovel || '', tipoImovel: cadastroData.tipoImovel || '',
      valorAluguel: cadastroData.valorAluguel === undefined ? '' : cadastroData.valorAluguel,
      comissao: cadastroData.comissao === undefined ? '' : cadastroData.comissao,
      emailProp: cadastroData.emailProp || '', emailInq: cadastroData.emailInq || '',
      status: cadastroData.status || 'Ativo', finalidade: cadastroData.finalidade || '',
      condominio: cadastroData.condominio || '', version: 1,
      operationId: cadastroData.operationId || cadastroData.id || '', deletedAt: '',
      renewedFromId: cadastroData.renewedFromId || '', operationHash: requestHash
    };
    const newRow = headers.map(header => rowData[header] !== undefined ? rowData[header] : '');

    // Always get last row right before writing inside the lock
    sheet.getRange(sheet.getLastRow() + 1, 1, 1, newRow.length).setValues([newRow]);
  }

  // Reconcile checklist
  let checklistExists = false;
  const checkLastRow = checklistSheet.getLastRow();

  if (checkLastRow > 1) {
    const checklistIds = checklistSheet.getRange(2, 1, checkLastRow - 1, 1).getValues();
    for (let i = 0; i < checklistIds.length; i++) {
      if (String(checklistIds[i][0]) === String(id)) {
        checklistExists = true;
        break;
      }
    }
  }

  if (!checklistExists) {
    const checkRow = [
      id, cadastroData.contrato, false, false, false, false, false, '[]', 1, ''
    ];
    checklistSheet.getRange(checklistSheet.getLastRow() + 1, 1, 1, checkRow.length).setValues([checkRow]);

    if (cadastroExists) {
       return { success: true, id: id, message: 'Idempotency: checklist repaired' };
    }
  }

  if (cadastroData.renewedFromId) {
    const oldRow = renewalSourceMatch.getRow();
    const oldValues = sheet.getRange(oldRow, 1, 1, headers.length).getValues()[0];
    const oldStatusIndex = headers.indexOf('status');
    const oldVersionIndex = headers.indexOf('version');
    if (oldValues[oldStatusIndex] !== 'Renovado') {
      oldValues[oldStatusIndex] = 'Renovado';
      oldValues[oldVersionIndex] = (Number(oldValues[oldVersionIndex]) || 1) + 1;
      sheet.getRange(oldRow, 1, 1, headers.length).setValues([oldValues]);
    }
  }

  return { success: true, id: id, version: 1, message: cadastroExists ? 'Idempotency: already saved' : 'Created' };
}

function updateCadastro(cadastroData) {
  if (!cadastroData || !cadastroData.id || !cadastroData.operationId || !cadastroData.expectedVersion) {
    return { error: 'VALIDATION_ERROR: id, operationId e expectedVersion são obrigatórios.', code: 'VALIDATION_ERROR' };
  }
  const validationError = validateCadastro_(cadastroData);
  if (validationError) return validationError;
  const sheet = getSpreadsheet_().getSheetByName('Cadastros');
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(String);
  const requiredHeaders = ['id', 'contrato', 'version', 'operationId', 'operationHash', 'deletedAt'];
  if (requiredHeaders.some(function(header) { return headers.indexOf(header) === -1; })) {
    return { error: 'SCHEMA_OUTDATED: Execute setupSpreadsheet() antes de editar cadastros.', code: 'SCHEMA_OUTDATED' };
  }
  const requestHash = sha256Hex_(JSON.stringify(canonicalize_({ action: 'updateCadastro', data: cadastroData })));
  const idIndex = headers.indexOf('id');
  const contractIndex = headers.indexOf('contrato');

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idIndex]) !== String(cadastroData.id) && String(data[i][contractIndex]).trim() === String(cadastroData.contrato).trim()) {
      return { error: 'Número de contrato já existe', code: 'DUPLICATE_CONTRACT' };
    }
  }

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idIndex]) === String(cadastroData.id)) {
      const rowIndex = i + 1;
      const currentRow = data[i];
      const currentVersion = Number(currentRow[headers.indexOf('version')]) || 1;
      const lastOperationId = String(currentRow[headers.indexOf('operationId')] || '');
      const lastOperationHash = String(currentRow[headers.indexOf('operationHash')] || '');

      if (lastOperationId === String(cadastroData.operationId)) {
        if (lastOperationHash && lastOperationHash !== requestHash) {
          return { error: 'IDEMPOTENCY_KEY_REUSED: operationId foi reutilizado com dados diferentes.', code: 'IDEMPOTENCY_KEY_REUSED' };
        }
        return { success: true, status: 'already_updated', operationId: cadastroData.operationId, version: currentVersion };
      }

      if (currentVersion !== Number(cadastroData.expectedVersion)) {
        return { error: 'EDIT_CONFLICT: O cadastro foi modificado por outra pessoa.', code: 'EDIT_CONFLICT', currentVersion: currentVersion };
      }
      if (currentRow[headers.indexOf('deletedAt')]) return { error: 'CADASTRO_ARCHIVED', code: 'CADASTRO_ARCHIVED' };

      const nextVersion = currentVersion + 1;
      const mutableFields = [
        'contrato', 'nomeProp', 'telProp', 'niverProp', 'nomeInq', 'telInq', 'niverInq',
        'inicioContrato', 'fimContrato', 'corretor', 'diaVencimento', 'enderecoImovel',
        'tipoImovel', 'valorAluguel', 'comissao', 'emailProp', 'emailInq', 'status',
        'finalidade', 'condominio'
      ];
      mutableFields.forEach(function(header) {
        if (cadastroData[header] !== undefined) currentRow[headers.indexOf(header)] = cadastroData[header];
      });
      currentRow[headers.indexOf('version')] = nextVersion;
      currentRow[headers.indexOf('operationId')] = cadastroData.operationId;
      currentRow[headers.indexOf('operationHash')] = requestHash;
      sheet.getRange(rowIndex, 1, 1, headers.length).setValues([currentRow]);
      return { success: true, status: 'updated', operationId: cadastroData.operationId, version: nextVersion };
    }
  }
  return { error: 'Cadastro not found' };
}

function deleteCadastro(payload) {
  if (!payload || !payload.id || !payload.operationId || !payload.expectedVersion) {
    return { error: 'VALIDATION_ERROR: id, operationId e expectedVersion são obrigatórios.', code: 'VALIDATION_ERROR' };
  }
  const ss = getSpreadsheet_();
  const sheet = ss.getSheetByName('Cadastros');
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  const match = sheet.getRange('A:A').createTextFinder(String(payload.id)).matchEntireCell(true).findNext();
  if (!match) return { error: 'Cadastro not found', code: 'NOT_FOUND' };

  const row = match.getRow();
  const values = sheet.getRange(row, 1, 1, headers.length).getValues()[0];
  const versionIndex = headers.indexOf('version');
  const operationIndex = headers.indexOf('operationId');
  const operationHashIndex = headers.indexOf('operationHash');
  const deletedAtIndex = headers.indexOf('deletedAt');
  const statusIndex = headers.indexOf('status');
  if ([versionIndex, operationIndex, operationHashIndex, deletedAtIndex, statusIndex].some(function(index) { return index === -1; })) {
    return { error: 'SCHEMA_OUTDATED: Execute setupSpreadsheet() antes de arquivar cadastros.', code: 'SCHEMA_OUTDATED' };
  }
  const currentVersion = Number(values[versionIndex]) || 1;
  const requestHash = sha256Hex_(JSON.stringify(canonicalize_({ action: 'deleteCadastro', payload: payload })));
  if (String(values[operationIndex] || '') === String(payload.operationId || '')) {
    if (values[operationHashIndex] && String(values[operationHashIndex]) !== requestHash) {
      return { error: 'IDEMPOTENCY_KEY_REUSED: operationId foi reutilizado com dados diferentes.', code: 'IDEMPOTENCY_KEY_REUSED' };
    }
    if (values[deletedAtIndex]) return { success: true, status: 'already_archived', version: currentVersion };
  }
  if (deletedAtIndex !== -1 && values[deletedAtIndex]) {
    return { success: true, status: 'already_archived', version: currentVersion };
  }
  if (payload.expectedVersion && currentVersion !== Number(payload.expectedVersion)) {
    return { error: 'CADASTRO_CONFLICT', code: 'CADASTRO_CONFLICT', currentVersion: currentVersion };
  }

  values[statusIndex] = 'Encerrado';
  values[deletedAtIndex] = new Date().toISOString();
  values[versionIndex] = currentVersion + 1;
  values[operationIndex] = payload.operationId || '';
  values[operationHashIndex] = requestHash;
  sheet.getRange(row, 1, 1, headers.length).setValues([values]);
  return { success: true, status: 'archived', version: currentVersion + 1 };
}

function recordChecklistOperation_(sheet, operation, rowIndex) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  const values = headers.map(function(header) {
    return operation[header] !== undefined ? operation[header] : '';
  });
  const targetRow = rowIndex && rowIndex > 1 ? rowIndex : sheet.getLastRow() + 1;
  sheet.getRange(targetRow, 1, 1, headers.length).setValues([values]);
  return targetRow;
}

function updateChecklist(checklistData) {
  if (!checklistData || !checklistData.id || !checklistData.operationId || !checklistData.version) {
    return { error: 'VALIDATION_ERROR: id, operationId e version são obrigatórios.', code: 'VALIDATION_ERROR' };
  }

  let documents;
  try {
    documents = JSON.parse(checklistData.documentos_json || '[]');
    if (!Array.isArray(documents)) throw new Error('not an array');
  } catch (error) {
    return { error: 'INVALID_DOCUMENTS_JSON: documentos_json deve ser uma lista JSON válida.', code: 'INVALID_DOCUMENTS_JSON' };
  }

  const spreadsheet = getSpreadsheet_();
  const opsSheet = ensureSheetSchema_(spreadsheet, 'Operacoes', [
    'operationId', 'timestamp', 'status', 'result_version', 'target_id', 'requested_version',
    'payload_hash', 'action'
  ]);
  const sheet = spreadsheet.getSheetByName('Checklists');
  if (!sheet || sheet.getLastRow() <= 1) return { error: 'Checklist not found', code: 'NOT_FOUND' };

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  const requiredHeaders = [
    'id', 'prop_contratoEnviado', 'prop_vistoriaEnviada', 'inq_manualEntregue',
    'inq_vistoriaAssinada', 'inq_seguroIncendio', 'documentos_json', 'version', 'operationId'
  ];
  if (requiredHeaders.some(function(header) { return headers.indexOf(header) === -1; })) {
    return { error: 'SCHEMA_OUTDATED: Execute setupSpreadsheet() antes de salvar checklists.', code: 'SCHEMA_OUTDATED' };
  }

  const targetMatch = sheet.getRange(2, headers.indexOf('id') + 1, sheet.getLastRow() - 1, 1)
    .createTextFinder(String(checklistData.id)).matchEntireCell(true).findNext();
  if (!targetMatch) return { error: 'Checklist not found', code: 'NOT_FOUND' };

  const targetRow = targetMatch.getRow();
  const rowValues = sheet.getRange(targetRow, 1, 1, headers.length).getValues()[0];
  const versionIndex = headers.indexOf('version');
  const operationIndex = headers.indexOf('operationId');
  const currentVersion = Number(rowValues[versionIndex]) || 1;
  const lastOperationId = String(rowValues[operationIndex] || '');
  const payloadHash = sha256Hex_(JSON.stringify({
    id: String(checklistData.id),
    version: Number(checklistData.version),
    prop_contratoEnviado: Boolean(checklistData.prop_contratoEnviado),
    prop_vistoriaEnviada: Boolean(checklistData.prop_vistoriaEnviada),
    inq_manualEntregue: Boolean(checklistData.inq_manualEntregue),
    inq_vistoriaAssinada: Boolean(checklistData.inq_vistoriaAssinada),
    inq_seguroIncendio: Boolean(checklistData.inq_seguroIncendio),
    documentos: documents
  }));

  let operationRow = -1;
  const opsHeaders = opsSheet.getRange(1, 1, 1, opsSheet.getLastColumn()).getValues()[0].map(String);
  if (opsSheet.getLastRow() > 1) {
    const matches = opsSheet.getRange(2, opsHeaders.indexOf('operationId') + 1, opsSheet.getLastRow() - 1, 1)
      .createTextFinder(String(checklistData.operationId)).matchEntireCell(true).findAll();
    if (matches.length > 0) {
      operationRow = matches[matches.length - 1].getRow();
      const opValues = opsSheet.getRange(operationRow, 1, 1, opsHeaders.length).getValues()[0];
      const opValue = function(header) { return opValues[opsHeaders.indexOf(header)]; };
      const storedTarget = String(opValue('target_id') || '');
      const storedHash = String(opValue('payload_hash') || '');
      const storedAction = String(opValue('action') || '');
      if (storedTarget !== String(checklistData.id) || (storedHash && storedHash !== payloadHash) || (storedAction && storedAction !== 'updateChecklist')) {
        return { error: 'IDEMPOTENCY_KEY_REUSED: operationId já pertence a outra alteração.', code: 'IDEMPOTENCY_KEY_REUSED' };
      }
      const operationStatus = String(opValue('status') || '');
      const operationVersion = Number(opValue('result_version')) || currentVersion;
      if (operationStatus === 'SUCCESS') {
        return { success: true, status: 'already_updated', operationId: checklistData.operationId, version: operationVersion };
      }
      if (operationStatus === 'CONFLICT') {
        return { error: 'CHECKLIST_CONFLICT: O checklist foi modificado por outra pessoa.', code: 'CHECKLIST_CONFLICT', currentVersion: currentVersion };
      }
      if (operationStatus === 'PENDING' && lastOperationId === String(checklistData.operationId) && currentVersion === operationVersion) {
        recordChecklistOperation_(opsSheet, {
          operationId: checklistData.operationId, timestamp: new Date().toISOString(), status: 'SUCCESS',
          result_version: currentVersion, target_id: checklistData.id, requested_version: checklistData.version,
          payload_hash: payloadHash, action: 'updateChecklist'
        }, operationRow);
        return { success: true, status: 'already_updated', operationId: checklistData.operationId, version: currentVersion };
      }
    }
  }

  if (currentVersion !== Number(checklistData.version)) {
    recordChecklistOperation_(opsSheet, {
      operationId: checklistData.operationId, timestamp: new Date().toISOString(), status: 'CONFLICT',
      result_version: currentVersion, target_id: checklistData.id, requested_version: checklistData.version,
      payload_hash: payloadHash, action: 'updateChecklist'
    }, operationRow);
    return { error: 'CHECKLIST_CONFLICT: O checklist foi modificado por outra pessoa.', code: 'CHECKLIST_CONFLICT', currentVersion: currentVersion };
  }

  const nextVersion = currentVersion + 1;
  operationRow = recordChecklistOperation_(opsSheet, {
    operationId: checklistData.operationId, timestamp: new Date().toISOString(), status: 'PENDING',
    result_version: nextVersion, target_id: checklistData.id, requested_version: checklistData.version,
    payload_hash: payloadHash, action: 'updateChecklist'
  }, operationRow);

  const updates = {
    prop_contratoEnviado: Boolean(checklistData.prop_contratoEnviado),
    prop_vistoriaEnviada: Boolean(checklistData.prop_vistoriaEnviada),
    inq_manualEntregue: Boolean(checklistData.inq_manualEntregue),
    inq_vistoriaAssinada: Boolean(checklistData.inq_vistoriaAssinada),
    inq_seguroIncendio: Boolean(checklistData.inq_seguroIncendio),
    documentos_json: JSON.stringify(documents),
    version: nextVersion,
    operationId: checklistData.operationId
  };
  Object.keys(updates).forEach(function(header) {
    rowValues[headers.indexOf(header)] = updates[header];
  });
  sheet.getRange(targetRow, 1, 1, headers.length).setValues([rowValues]);

  recordChecklistOperation_(opsSheet, {
    operationId: checklistData.operationId, timestamp: new Date().toISOString(), status: 'SUCCESS',
    result_version: nextVersion, target_id: checklistData.id, requested_version: checklistData.version,
    payload_hash: payloadHash, action: 'updateChecklist'
  }, operationRow);
  return { success: true, version: nextVersion, operationId: checklistData.operationId };
}

function saveTarefa(tarefaData) {
  const sheet = getSpreadsheet_().getSheetByName('Tarefas');
  if (!tarefaData || !tarefaData.contrato || !tarefaData.tipo || !tarefaData.referencia) {
    return { error: 'VALIDATION_ERROR: contrato, tipo e referência são obrigatórios.', code: 'VALIDATION_ERROR' };
  }
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(String);
  const deletedAtIndex = headers.indexOf('deletedAt');
  if (deletedAtIndex === -1 || headers.indexOf('operationId') === -1) {
    return { error: 'SCHEMA_OUTDATED: Execute setupSpreadsheet() antes de salvar tarefas.', code: 'SCHEMA_OUTDATED' };
  }
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const sameOperation = tarefaData.operationId && String(row[headers.indexOf('operationId')]) === String(tarefaData.operationId);
    const sameBusinessKey = String(row[headers.indexOf('contrato')]) === String(tarefaData.contrato) &&
      String(row[headers.indexOf('tipo')]) === String(tarefaData.tipo) &&
      String(row[headers.indexOf('usuario')]) === String(tarefaData.usuario || '') &&
      String(row[headers.indexOf('referencia')]) === String(tarefaData.referencia);
    if (sameOperation) {
      return { success: true, status: 'already_saved', id: row[headers.indexOf('idTarefa')], dataConclusao: row[headers.indexOf('dataConclusao')] };
    }
    if (sameBusinessKey && row[deletedAtIndex]) {
      const restoredAt = new Date().toISOString();
      row[deletedAtIndex] = '';
      row[headers.indexOf('dataConclusao')] = restoredAt;
      row[headers.indexOf('operationId')] = tarefaData.operationId;
      sheet.getRange(i + 1, 1, 1, headers.length).setValues([row]);
      return { success: true, status: 'restored', id: row[headers.indexOf('idTarefa')], dataConclusao: restoredAt };
    }
    if (sameBusinessKey) {
      return { success: true, status: 'already_saved', id: row[headers.indexOf('idTarefa')], dataConclusao: row[headers.indexOf('dataConclusao')] };
    }
  }

  const idTarefa = tarefaData.idTarefa || Utilities.getUuid();
  const dataConclusao = new Date().toISOString();
  const rowData = Object.assign({}, tarefaData, { idTarefa: idTarefa, dataConclusao: dataConclusao });
  sheet.getRange(sheet.getLastRow() + 1, 1, 1, headers.length).setValues([
    headers.map(header => rowData[header] !== undefined ? rowData[header] : '')
  ]);

  return { success: true, id: idTarefa };
}

function deleteTarefa(id) {
  const sheet = getSpreadsheet_().getSheetByName('Tarefas');
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(String);
  const deletedAtIndex = headers.indexOf('deletedAt');
  if (deletedAtIndex === -1) {
    return { error: 'SCHEMA_OUTDATED: Execute setupSpreadsheet() antes de remover tarefas.', code: 'SCHEMA_OUTDATED' };
  }

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][headers.indexOf('idTarefa')]) === String(id)) {
      if (data[i][deletedAtIndex]) return { success: true, status: 'already_deleted' };
      sheet.getRange(i + 1, deletedAtIndex + 1).setValue(new Date().toISOString());
      return { success: true, status: 'archived' };
    }
  }
  return { success: true, status: 'already_deleted' };
}

function upsertCondominio(condoData) {
  if (!condoData || !String(condoData.nome || '').trim()) {
    return { error: 'VALIDATION_ERROR: Nome do condomínio é obrigatório.', code: 'VALIDATION_ERROR' };
  }
  condoData.nome = String(condoData.nome).replace(/\s+/g, ' ').trim();
  condoData.nomeNormalizado = normalizeText_(condoData.nome);
  condoData.id = condoData.id || Utilities.getUuid();
  condoData.operationId = condoData.operationId || Utilities.getUuid();
  if (condoData.ativo === undefined) condoData.ativo = true;
  condoData.createdAt = condoData.createdAt || new Date().toISOString();
  const ss = getSpreadsheet_();
  const sheet = ss.getSheetByName('Condominios');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  // Try to update existing by id or operationId
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const id = row[headers.indexOf('id')];
    const opId = row[headers.indexOf('operationId')];

    const nomeNorm = normalizeText_(row[headers.indexOf('nomeNormalizado')] || row[headers.indexOf('nome')]);
    if (id === condoData.id || (condoData.operationId && opId === condoData.operationId) || (condoData.nomeNormalizado && nomeNorm === condoData.nomeNormalizado)) {
      // Update
      const updateRow = [];
      headers.forEach(header => {
        updateRow.push(condoData[header] !== undefined ? condoData[header] : row[headers.indexOf(header)]);
      });
      sheet.getRange(i + 1, 1, 1, headers.length).setValues([updateRow]);
      const updated = {};
      headers.forEach(function(header, index) { updated[header] = updateRow[index]; });
      return { success: true, updated: true, data: updated };
    }
  }

  // Create new
  const newRow = [];
  headers.forEach(header => {
    newRow.push(condoData[header] !== undefined ? condoData[header] : "");
  });
  sheet.getRange(sheet.getLastRow() + 1, 1, 1, headers.length).setValues([newRow]);
  return { success: true, created: true, data: condoData };
}

function upsertCobranca(cobrancaData) {
  if (!cobrancaData || !cobrancaData.id || !cobrancaData.cadastroId || !cobrancaData.competencia) {
    return { error: 'VALIDATION_ERROR: id, cadastroId e competência são obrigatórios.', code: 'VALIDATION_ERROR' };
  }
  const ss = getSpreadsheet_();
  const sheet = ss.getSheetByName('Cobrancas');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  // Try to update existing by id or operationId
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const id = row[headers.indexOf('id')];
    const envioOpId = row[headers.indexOf('envioOperationId')];
    const pagOpId = row[headers.indexOf('pagamentoOperationId')];
    const sameCompetence = String(row[headers.indexOf('cadastroId')]) === String(cobrancaData.cadastroId) &&
      normalizeCompetencia_(row[headers.indexOf('competencia')]) === normalizeCompetencia_(cobrancaData.competencia);

    if (sameCompetence && String(id) !== String(cobrancaData.id)) {
      return { error: 'DUPLICATE_COBRANCA', code: 'DUPLICATE_COBRANCA', existingId: id };
    }

    if (id === cobrancaData.id || (cobrancaData.envioOperationId && envioOpId === cobrancaData.envioOperationId) || (cobrancaData.pagamentoOperationId && pagOpId === cobrancaData.pagamentoOperationId)) {
      if ((cobrancaData.envioOperationId && envioOpId === cobrancaData.envioOperationId) || (cobrancaData.pagamentoOperationId && pagOpId === cobrancaData.pagamentoOperationId)) {
        const existingData = {};
        headers.forEach((header, index) => existingData[header] = row[index]);
        return { success: true, status: 'already_updated', updated: true, data: existingData };
      }
      // Update
      const currentVersion = row[headers.indexOf('version')] || 1;
      const incomingVersion = Number(cobrancaData.version || 1);

      if (incomingVersion !== Number(currentVersion)) {
         return { error: 'COBRANCA_CONFLICT', code: 'COBRANCA_CONFLICT', currentVersion: Number(currentVersion) };
      }

      cobrancaData.version = currentVersion + 1;
      cobrancaData.updatedAt = new Date().toISOString();

      const updateRow = [];
      headers.forEach(header => {
        updateRow.push(cobrancaData[header] !== undefined ? cobrancaData[header] : row[headers.indexOf(header)]);
      });
      const competenciaColumn = headers.indexOf('competencia') + 1;
      if (competenciaColumn > 0) sheet.getRange(i + 1, competenciaColumn).setNumberFormat('@');
      sheet.getRange(i + 1, 1, 1, headers.length).setValues([updateRow]);
      return { success: true, updated: true, data: cobrancaData };
    }
  }

  // Create new
  cobrancaData.version = 1;
  cobrancaData.createdAt = new Date().toISOString();
  cobrancaData.updatedAt = cobrancaData.createdAt;

  const newRow = [];
  headers.forEach(header => {
    newRow.push(cobrancaData[header] !== undefined && cobrancaData[header] !== null ? cobrancaData[header] : "");
  });
  const appendRow = sheet.getLastRow() + 1;
  const competenciaColumn = headers.indexOf('competencia') + 1;
  if (competenciaColumn > 0) sheet.getRange(appendRow, competenciaColumn).setNumberFormat('@');
  sheet.getRange(appendRow, 1, 1, headers.length).setValues([newRow]);
  return { success: true, created: true, data: cobrancaData };
}

function normalizeCompetencia_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM');
  }

  const text = String(value || '').trim();
  const match = text.match(/^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?/);
  if (match) return match[1] + '-' + String(Number(match[2])).padStart(2, '0');

  const parsed = new Date(text);
  if (!isNaN(parsed.getTime())) {
    return Utilities.formatDate(parsed, Session.getScriptTimeZone(), 'yyyy-MM');
  }
  return text;
}

function gerarCobrancasMensais(monthsBack, useLock) {
  if (typeof monthsBack !== 'number') {
    monthsBack = 0;
    useLock = true;
  }
  useLock = useLock !== false;
  const lock = useLock ? LockService.getScriptLock() : null;
  try {
    if (lock) lock.waitLock(30000);
    const ss = getSpreadsheet_();
    const sheetCobrancas = ss.getSheetByName('Cobrancas');

    const cadastrosData = getSheetData('Cadastros');
    const cobrancasData = getSheetData('Cobrancas');
    const headers = sheetCobrancas.getDataRange().getValues()[0];

    const today = new Date();

    // Generate for current month, and optionally historical months
    for (let offset = monthsBack; offset >= 0; offset--) {
      let targetDateForMonth = new Date(today.getFullYear(), today.getMonth() - offset, 1);
      const currentYear = targetDateForMonth.getFullYear();
      const currentMonth = targetDateForMonth.getMonth() + 1;
      const competencia = `${currentYear}-${currentMonth.toString().padStart(2, '0')}`;

      const existingCobrancas = new Set(
        cobrancasData.map(c => String(c.cadastroId) + '|' + normalizeCompetencia_(c.competencia))
      );

      const newCobrancas = [];

      cadastrosData.forEach(cad => {
        if (cad.status !== 'Ativo' || cad.deletedAt) return;
        const cobrancaKey = String(cad.id) + '|' + competencia;
        if (existingCobrancas.has(cobrancaKey)) return;
        if (!cad.diaVencimento) return;

        const diaVenc = parseInt(cad.diaVencimento, 10);
        if (isNaN(diaVenc)) return;

        let targetDate = new Date(currentYear, currentMonth - 1, diaVenc);
        if (targetDate.getMonth() !== currentMonth - 1) {
          targetDate = new Date(currentYear, currentMonth, 0);
        }

        // Date boundaries
        const inicioContrato = parseDateOnly_(cad.inicioContrato);
        const fimContrato = parseDateOnly_(cad.fimContrato);
        if (inicioContrato && inicioContrato > targetDate) return;
        if (fimContrato && fimContrato < targetDate) return;

        const vencimentoStr = `${targetDate.getFullYear()}-${(targetDate.getMonth() + 1).toString().padStart(2, '0')}-${targetDate.getDate().toString().padStart(2, '0')}`;

        const novaCobranca = {
          id: Utilities.getUuid(),
          cadastroId: cad.id,
          contrato: cad.contrato,
          competencia: competencia,
          vencimento: vencimentoStr,
          valor: cad.valorAluguel || '',
          statusPagamento: 'Pendente',
          pagoEm: '',
          envioConfirmadoEm: '',
          envioOperationId: '',
          pagamentoOperationId: '',
          version: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        const row = [];
        headers.forEach(h => row.push(novaCobranca[h] !== undefined && novaCobranca[h] !== null ? novaCobranca[h] : ""));
        newCobrancas.push(row);
        existingCobrancas.add(cobrancaKey);
      });

      if (newCobrancas.length > 0) {
        const appendRow = sheetCobrancas.getLastRow() + 1;
        const competenciaColumn = headers.indexOf('competencia') + 1;
        if (competenciaColumn > 0) {
          sheetCobrancas.getRange(appendRow, competenciaColumn, newCobrancas.length, 1).setNumberFormat('@');
        }
        sheetCobrancas.getRange(appendRow, 1, newCobrancas.length, headers.length).setValues(newCobrancas);
        // Add to cobrancasData so subsequent loops know it exists if needed
        newCobrancas.forEach(row => {
           let obj = {};
           headers.forEach((h, i) => obj[h] = row[i]);
           cobrancasData.push(obj);
        });
      }
    }
  } catch (e) {
    console.error(e);
    throw e;
  } finally {
    if (lock && lock.hasLock()) lock.releaseLock();
  }
}

function sanearCobrancasDuplicadas(dryRun) {
  const previewOnly = dryRun !== false;
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const sheet = getSpreadsheet_().getSheetByName('Cobrancas');
    if (!sheet || sheet.getLastRow() <= 1) {
      return { success: true, dryRun: previewOnly, totalAntes: 0, totalDepois: 0, duplicadas: 0 };
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(String);
    const required = ['id', 'cadastroId', 'competencia', 'statusPagamento', 'pagoEm', 'envioConfirmadoEm', 'version', 'createdAt', 'updatedAt'];
    const missing = required.filter(header => headers.indexOf(header) === -1);
    if (missing.length > 0) {
      throw new Error('SCHEMA_OUTDATED: colunas ausentes em Cobrancas: ' + missing.join(', '));
    }

    const index = {};
    headers.forEach((header, position) => { index[header] = position; });
    const groups = new Map();

    data.slice(1).forEach((row, offset) => {
      if (!row.some(value => value !== '' && value !== null)) return;
      const key = String(row[index.cadastroId] || '').trim() + '|' + normalizeCompetencia_(row[index.competencia]);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push({ row: row.slice(), sourceRow: offset + 2 });
    });

    function timeValue_(value, fallback) {
      const timestamp = new Date(value).getTime();
      return isNaN(timestamp) ? fallback : timestamp;
    }

    function firstFilled_(entries, header) {
      const position = index[header];
      if (position === undefined) return '';
      const match = entries.find(entry => entry.row[position] !== '' && entry.row[position] !== null);
      return match ? match.row[position] : '';
    }

    const cleanedRows = [];
    let duplicateCount = 0;
    let groupsWithDuplicates = 0;

    groups.forEach(entries => {
      entries.sort((a, b) => {
        const dateDiff = timeValue_(a.row[index.createdAt], Number.MAX_SAFE_INTEGER) - timeValue_(b.row[index.createdAt], Number.MAX_SAFE_INTEGER);
        return dateDiff || a.sourceRow - b.sourceRow;
      });

      if (entries.length > 1) {
        groupsWithDuplicates += 1;
        duplicateCount += entries.length - 1;
      }

      const canonical = entries[0].row.slice();
      canonical[index.competencia] = normalizeCompetencia_(canonical[index.competencia]);

      const paidEntry = entries.find(entry => String(entry.row[index.statusPagamento]).toLowerCase() === 'pago');
      if (paidEntry) canonical[index.statusPagamento] = 'Pago';
      else if (entries.some(entry => String(entry.row[index.statusPagamento]).toLowerCase() === 'cancelado')) {
        canonical[index.statusPagamento] = 'Cancelado';
      }

      ['pagoEm', 'envioConfirmadoEm', 'envioOperationId', 'pagamentoOperationId'].forEach(header => {
        if (index[header] !== undefined) canonical[index[header]] = firstFilled_(entries, header);
      });

      canonical[index.version] = Math.max.apply(null, entries.map(entry => Number(entry.row[index.version]) || 1));
      const latestUpdated = entries.reduce((latest, entry) => {
        return timeValue_(entry.row[index.updatedAt], 0) > timeValue_(latest, 0) ? entry.row[index.updatedAt] : latest;
      }, canonical[index.updatedAt]);
      canonical[index.updatedAt] = latestUpdated;
      cleanedRows.push(canonical);
    });

    const summary = {
      success: true,
      dryRun: previewOnly,
      totalAntes: data.length - 1,
      totalDepois: cleanedRows.length,
      duplicadas: duplicateCount,
      gruposDuplicados: groupsWithDuplicates
    };
    console.log(JSON.stringify(summary));
    if (previewOnly || duplicateCount === 0) return summary;

    if (cleanedRows.length === 0) throw new Error('CLEANUP_ABORTED: nenhuma linha canônica foi produzida.');

    const competenciaColumn = index.competencia + 1;
    sheet.getRange(2, competenciaColumn, cleanedRows.length, 1).setNumberFormat('@');
    sheet.getRange(2, 1, cleanedRows.length, headers.length).setValues(cleanedRows);

    const rowsToDelete = sheet.getLastRow() - cleanedRows.length - 1;
    if (rowsToDelete > 0) sheet.deleteRows(cleanedRows.length + 2, rowsToDelete);
    SpreadsheetApp.flush();

    const finalRows = sheet.getLastRow() - 1;
    if (finalRows !== cleanedRows.length) {
      throw new Error('CLEANUP_VERIFICATION_FAILED: esperado ' + cleanedRows.length + ', encontrado ' + finalRows);
    }
    return summary;
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}

function auditarCobrancasDuplicadas() {
  return sanearCobrancasDuplicadas(true);
}

function executarSaneamentoCobrancas() {
  return sanearCobrancasDuplicadas(false);
}

function gerarCobrancasHistoricas() {
  gerarCobrancasMensais(2, false); // Generate for current and last 2 months
  return { success: true };
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function syncCobrancas() {
  gerarCobrancasMensais(0, false);
  return { success: true };
}


function canonicalize_(value) {
  if (Array.isArray(value)) return value.map(canonicalize_);
  if (value && typeof value === 'object') {
    const result = {};
    Object.keys(value).sort().forEach(key => { result[key] = canonicalize_(value[key]); });
    return result;
  }
  return value;
}

function campaignPayloadHash_(action, payload) {
  const cleanPayload = Object.assign({}, payload || {});
  delete cleanPayload.authUser;
  return sha256Hex_(JSON.stringify(canonicalize_({ action: action, payload: cleanPayload })));
}

function _checkCampanhaOperation(opsSheet, operationId, targetId, action, payloadHash) {
  if (!operationId) return null;
  const opsLastRow = opsSheet.getLastRow();
  if (opsLastRow <= 1) return null;
  const textFinder = opsSheet.getRange(2, 1, opsLastRow - 1, 1).createTextFinder(operationId).matchEntireCell(true);
  const matches = textFinder.findAll();
  if (matches.length > 0) {
    const match = matches[matches.length - 1];
    const j = match.getRow();
    const headers = opsSheet.getRange(1, 1, 1, opsSheet.getLastColumn()).getValues()[0].map(String);
    const values = opsSheet.getRange(j, 1, 1, headers.length).getValues()[0];
    const opStatus = values[headers.indexOf('status')];
    const opVersion = Number(values[headers.indexOf('result_version')]);
    const opTargetId = String(values[headers.indexOf('target_id')] || '');
    const opHash = String(values[headers.indexOf('payload_hash')] || '');
    const opAction = String(values[headers.indexOf('action')] || '');

    if (targetId && opTargetId && opTargetId !== String(targetId)) {
      return { error: 'INVALID_TARGET: O operationId pertence a outra entidade.', code: 'INVALID_TARGET' };
    }
    if (action && opAction && opAction !== String(action)) {
      return { error: 'IDEMPOTENCY_KEY_REUSED: O operationId pertence a outra ação.', code: 'IDEMPOTENCY_KEY_REUSED' };
    }
    if (payloadHash && opHash && opHash !== String(payloadHash)) {
      return { error: 'IDEMPOTENCY_KEY_REUSED: O operationId foi reutilizado com dados diferentes.', code: 'IDEMPOTENCY_KEY_REUSED' };
    }

    return { status: opStatus, version: opVersion, row: j, hash: opHash, action: opAction };
  }
  return null;
}

function _recordCampanhaOperation(opsSheet, operationId, status, version, targetId, requestedVersion, pendingRow, payloadHash, action) {
  if (!operationId) return;
  const now = new Date().toISOString();
  const headers = opsSheet.getRange(1, 1, 1, opsSheet.getLastColumn()).getValues()[0].map(String);
  const operation = {
    operationId: operationId,
    timestamp: now,
    status: status,
    result_version: version,
    target_id: targetId,
    requested_version: requestedVersion,
    payload_hash: payloadHash || '',
    action: action || ''
  };
  const rowValues = headers.map(header => operation[header] !== undefined ? operation[header] : '');
  if (pendingRow !== -1) {
    opsSheet.getRange(pendingRow, 1, 1, headers.length).setValues([rowValues]);
  } else {
    opsSheet.getRange(opsSheet.getLastRow() + 1, 1, 1, headers.length).setValues([rowValues]);
  }
}

function getCampanhas() {
  const sheet = getSpreadsheet_().getSheetByName('Campanhas');
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  const keys = data[0];
  const campanhas = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const obj = {};
    keys.forEach((key, j) => {
      obj[key] = row[j];
    });
    if (obj.ativa === '') obj.ativa = true;
    campanhas.push(obj);
  }
  return campanhas;
}

function getCampanhaDestinatarios(campanhaId) {
  if (!campanhaId) return [];
  const sheet = getSpreadsheet_().getSheetByName('Campanha_Destinatarios');
  if (!sheet) return [];
  if (!campanhaId) return { error: 'CampanhaId is required' };

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  const keys = data[0];
  const idxCampanhaId = keys.indexOf('campanhaId');
  if (idxCampanhaId === -1) return [];

  const destinatarios = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (String(row[idxCampanhaId]) === String(campanhaId)) {
      const obj = {};
      keys.forEach((key, j) => {
        obj[key] = row[j];
      });
      destinatarios.push(obj);
    }
  }
  return destinatarios;
}

function saveCampanha(payload) {
  if (!payload || !payload.id || !payload.operationId || !String(payload.nome || '').trim() || !String(payload.mensagemTemplate || '').trim()) {
    return { error: 'VALIDATION_ERROR: id, operationId, nome e mensagem são obrigatórios.', code: 'VALIDATION_ERROR' };
  }
  try { JSON.parse(payload.filtrosJson || '{}'); } catch (error) {
    return { error: 'VALIDATION_ERROR: filtrosJson inválido.', code: 'VALIDATION_ERROR' };
  }

  const spreadsheet = getSpreadsheet_();
  const opsSheet = ensureSheetSchema_(spreadsheet, 'Campanha_Operacoes', [
    'operationId', 'timestamp', 'status', 'result_version', 'target_id', 'requested_version', 'payload_hash', 'action'
  ]);
  const sheet = spreadsheet.getSheetByName('Campanhas');
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  const payloadHash = campaignPayloadHash_('saveCampanha', payload);
  const opCheck = _checkCampanhaOperation(opsSheet, payload.operationId, payload.id, 'saveCampanha', payloadHash);
  if (opCheck && opCheck.error) return opCheck;
  if (opCheck && opCheck.status === 'SUCCESS') {
    return { success: true, status: 'already_updated', id: payload.id, operationId: payload.operationId, version: opCheck.version };
  }

  const existing = sheet.getRange('A:A').createTextFinder(String(payload.id)).matchEntireCell(true).findNext();
  if (existing) {
    const existingValues = sheet.getRange(existing.getRow(), 1, 1, headers.length).getValues()[0];
    const currentVersion = Number(existingValues[headers.indexOf('version')]) || 1;
    if (String(existingValues[headers.indexOf('operationId')]) === String(payload.operationId)) {
      _recordCampanhaOperation(opsSheet, payload.operationId, 'SUCCESS', currentVersion, payload.id, 1, opCheck ? opCheck.row : -1, payloadHash, 'saveCampanha');
      return { success: true, status: 'already_updated', id: payload.id, operationId: payload.operationId, version: currentVersion };
    }
    return { error: 'CAMPAIGN_ID_CONFLICT', code: 'CAMPAIGN_ID_CONFLICT' };
  }

  const version = 1;
  _recordCampanhaOperation(opsSheet, payload.operationId, 'PENDING', version, payload.id, version, opCheck ? opCheck.row : -1, payloadHash, 'saveCampanha');
  const pendingRow = opCheck ? opCheck.row : opsSheet.getLastRow();
  const now = new Date().toISOString();
  const rowData = {
    id: payload.id, nome: String(payload.nome).trim(), descricao: payload.descricao || '',
    mensagemTemplate: payload.mensagemTemplate, filtrosJson: payload.filtrosJson || '{}', status: 'RASCUNHO',
    inicioEm: '', fimEm: '', audienciaTotal: 0,
    createdBy: payload.authUser ? payload.authUser.nome : 'Unknown',
    createdAt: now, updatedAt: now, version: version, operationId: payload.operationId,
    ativa: true, desativadaEm: ''
  };
  sheet.getRange(sheet.getLastRow() + 1, 1, 1, headers.length).setValues([
    headers.map(header => rowData[header] !== undefined ? rowData[header] : '')
  ]);
  _recordCampanhaOperation(opsSheet, payload.operationId, 'SUCCESS', version, payload.id, version, pendingRow, payloadHash, 'saveCampanha');
  return { success: true, id: payload.id, version: version, operationId: payload.operationId, ativa: true };
}

function updateCampanha(payload) {
    if (!payload || !payload.id || !payload.operationId || !payload.expectedVersion) {
      return { error: 'VALIDATION_ERROR: id, operationId e expectedVersion são obrigatórios.', code: 'VALIDATION_ERROR' };
    }
    if (payload.filtrosJson !== undefined) {
      try { JSON.parse(payload.filtrosJson || '{}'); } catch (error) {
        return { error: 'VALIDATION_ERROR: filtrosJson inválido.', code: 'VALIDATION_ERROR' };
      }
    }
    const spreadsheet = getSpreadsheet_();
    const opsSheet = spreadsheet.getSheetByName('Campanha_Operacoes');
    const sheet = spreadsheet.getSheetByName('Campanhas');
    const payloadHash = campaignPayloadHash_('updateCampanha', payload);

    const opCheck = _checkCampanhaOperation(opsSheet, payload.operationId, payload.id, 'updateCampanha', payloadHash);
    if (opCheck) {
      if (opCheck.error) return opCheck;
      if (opCheck.status === 'SUCCESS') {
        return { success: true, status: 'already_updated', id: payload.id, operationId: payload.operationId, version: opCheck.version };
      }
      if (opCheck.status === 'CONFLICT') {
        return { error: 'CAMPAIGN_CONFLICT', code: 'CAMPAIGN_CONFLICT' };
      }
    }

    const textFinder = sheet.getRange("A:A").createTextFinder(payload.id).matchEntireCell(true);
    const match = textFinder.findNext();
    if (!match) return { error: 'Campanha not found' };

    const row = match.getRow();
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const dataRow = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];
    const currentVersion = Number(dataRow[headers.indexOf('version')]) || 1;

    const currentStatus = dataRow[headers.indexOf('status')];
    if (opCheck && opCheck.status === 'PENDING' && String(dataRow[headers.indexOf('operationId')]) === String(payload.operationId)) {
      _recordCampanhaOperation(opsSheet, payload.operationId, 'SUCCESS', currentVersion, payload.id, payload.expectedVersion, opCheck.row, payloadHash, 'updateCampanha');
      return { success: true, status: 'already_updated', id: payload.id, operationId: payload.operationId, version: currentVersion };
    }

    if (payload.expectedVersion && currentVersion !== Number(payload.expectedVersion)) {
       _recordCampanhaOperation(opsSheet, payload.operationId, 'CONFLICT', currentVersion, payload.id, payload.expectedVersion, opCheck ? opCheck.row : -1, payloadHash, 'updateCampanha')
       return { error: 'CAMPAIGN_CONFLICT: The campaign was modified by someone else.', code: 'CAMPAIGN_CONFLICT', currentVersion: currentVersion };
    }

    if (currentStatus !== 'RASCUNHO') {
       return { error: 'INVALID_STATUS: Apenas campanhas em rascunho podem ser alteradas.' };
    }

    const nextVersion = currentVersion + 1;
    let pendingRow = opCheck ? opCheck.row : -1;

    if (payload.operationId) {
      _recordCampanhaOperation(opsSheet, payload.operationId, 'PENDING', nextVersion, payload.id, payload.expectedVersion, pendingRow, payloadHash, 'updateCampanha')
      if (pendingRow === -1) pendingRow = opsSheet.getLastRow();
    }

    // update fields
    const updates = {};
    if (payload.nome !== undefined) updates['nome'] = payload.nome;
    if (payload.descricao !== undefined) updates['descricao'] = payload.descricao;
    if (payload.mensagemTemplate !== undefined) updates['mensagemTemplate'] = payload.mensagemTemplate;
    if (payload.filtrosJson !== undefined) updates['filtrosJson'] = payload.filtrosJson;
    if (payload.audienciaTotal !== undefined) updates['audienciaTotal'] = payload.audienciaTotal;
    updates['updatedAt'] = new Date().toISOString();
    updates['version'] = nextVersion;
    updates['operationId'] = payload.operationId || '';

    for (const key in updates) {
      const idx = headers.indexOf(key);
      if (idx !== -1) dataRow[idx] = updates[key];
    }
    sheet.getRange(row, 1, 1, headers.length).setValues([dataRow]);

    if (pendingRow !== -1) _recordCampanhaOperation(opsSheet, payload.operationId, 'SUCCESS', nextVersion, payload.id, payload.expectedVersion, pendingRow, payloadHash, 'updateCampanha');

    return { success: true, id: payload.id, version: nextVersion, operationId: payload.operationId };
}

function iniciarCampanha(payload) {
    if (!payload || !payload.id || !payload.operationId || !payload.expectedVersion || !Array.isArray(payload.destinatarios)) {
      return { error: 'VALIDATION_ERROR: campanha, operação, versão e destinatários são obrigatórios.', code: 'VALIDATION_ERROR' };
    }
    if (payload.destinatarios.length === 0 || payload.destinatarios.length > 5000) {
      return { error: 'VALIDATION_ERROR: a campanha deve possuir entre 1 e 5000 destinatários.', code: 'VALIDATION_ERROR' };
    }
    const receivedContactKeys = new Set();
    for (let recipientIndex = 0; recipientIndex < payload.destinatarios.length; recipientIndex++) {
      const recipient = payload.destinatarios[recipientIndex] || {};
      const key = String(recipient.contactKey || '');
      if (!recipient.id || !key || !/^55[1-9]{2}\d{8,9}$/.test(String(recipient.telefone || '')) || !String(recipient.mensagemRenderizada || '').trim()) {
        return { error: 'VALIDATION_ERROR: destinatário inválido na posição ' + recipientIndex + '.', code: 'VALIDATION_ERROR' };
      }
      if (receivedContactKeys.has(key)) {
        return { error: 'DUPLICATE_RECIPIENT: contactKey repetido no público da campanha.', code: 'DUPLICATE_RECIPIENT' };
      }
      receivedContactKeys.add(key);
    }
    const spreadsheet = getSpreadsheet_();
    const opsSheet = spreadsheet.getSheetByName('Campanha_Operacoes');
    const sheet = spreadsheet.getSheetByName('Campanhas');
    const destSheet = spreadsheet.getSheetByName('Campanha_Destinatarios');

    // Hash do payload
    const audienceCanonical = JSON.stringify({
      campanhaId: String(payload.id),
      version: Number(payload.expectedVersion || 1),
      destinatarios: (payload.destinatarios || [])
        .map(item => {
          let perfis = [];
          let cadastroIds = [];
          let contratos = [];
          let contexto = {};
          try { perfis = JSON.parse(item.perfisJson || '[]'); } catch(e) {}
          try { cadastroIds = JSON.parse(item.cadastroIdsJson || '[]'); } catch(e) {}
          try { contratos = JSON.parse(item.contratosJson || '[]'); } catch(e) {}
          try { contexto = JSON.parse(item.contextoJson || '{}'); } catch(e) {}
          return {
            id: String(item.id || ''),
            contactKey: String(item.contactKey),
            nome: String(item.nome || ''),
            telefone: String(item.telefone || ''),
            mensagemRenderizada: String(item.mensagemRenderizada || ''),
            perfis: perfis.sort(),
            cadastroIds: cadastroIds.sort(),
            contratos: contratos.sort(),
            contexto: canonicalize_(contexto)
          };
        })
        .sort((a, b) => a.contactKey.localeCompare(b.contactKey))
    });

    const rawHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, audienceCanonical);
    const audienceHash = rawHash.map(b => (b < 0 ? b + 256 : b).toString(16).padStart(2, '0')).join('');

    const opCheck = _checkCampanhaOperation(opsSheet, payload.operationId, payload.id, 'iniciarCampanha', audienceHash);
    if (opCheck) {
      if (opCheck.error) return opCheck;

      if (opCheck.hash && opCheck.hash !== audienceHash) {
        return { error: 'IDEMPOTENCY_KEY_REUSED: O mesmo operationId foi usado com payload diferente.', code: 'IDEMPOTENCY_KEY_REUSED' };
      }

      if (opCheck.status === 'SUCCESS') {
        return { success: true, status: 'already_updated', id: payload.id, operationId: payload.operationId, version: opCheck.version };
      }
      if (opCheck.status === 'CONFLICT') {
        return { error: 'CAMPAIGN_CONFLICT', code: 'CAMPAIGN_CONFLICT' };
      }
    }

    const textFinder = sheet.getRange("A:A").createTextFinder(payload.id).matchEntireCell(true);
    const match = textFinder.findNext();
    if (!match) return { error: 'Campanha not found' };

    const row = match.getRow();
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const dataRow = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];
    const currentVersion = Number(dataRow[headers.indexOf('version')]) || 1;
    const currentStatus = dataRow[headers.indexOf('status')];
    const ativaIndex = headers.indexOf('ativa');
    const isActive = ativaIndex === -1 || dataRow[ativaIndex] === '' || dataRow[ativaIndex] === true || String(dataRow[ativaIndex]).toUpperCase() === 'TRUE';
    if (!isActive) return { error: 'CAMPAIGN_INACTIVE: Reative a campanha antes de iniciá-la.', code: 'CAMPAIGN_INACTIVE' };

    if (opCheck && opCheck.status === 'PENDING' && String(dataRow[headers.indexOf('operationId')]) === String(payload.operationId)) {
      _recordCampanhaOperation(opsSheet, payload.operationId, 'SUCCESS', currentVersion, payload.id, payload.expectedVersion, opCheck.row, audienceHash, 'iniciarCampanha');
      return { success: true, status: 'already_updated', id: payload.id, operationId: payload.operationId, version: currentVersion };
    }

    if (payload.expectedVersion && currentVersion !== Number(payload.expectedVersion)) {
       _recordCampanhaOperation(opsSheet, payload.operationId, 'CONFLICT', currentVersion, payload.id, payload.expectedVersion, opCheck ? opCheck.row : -1, audienceHash, 'iniciarCampanha');
       return { error: 'CAMPAIGN_CONFLICT: The campaign was modified by someone else.', code: 'CAMPAIGN_CONFLICT', currentVersion: currentVersion };
    }

    if (currentStatus !== 'RASCUNHO') {
       if (opCheck && opCheck.status === 'PENDING') {
          // It's possible it transitioned by another concurrent call but we are reconciling
       } else {
          return { error: 'INVALID_STATUS: Apenas campanhas em rascunho podem ser iniciadas.' };
       }
    }

    const nextVersion = currentVersion + 1;
    let pendingRow = opCheck ? opCheck.row : -1;

    if (payload.operationId && pendingRow === -1) {
      _recordCampanhaOperation(opsSheet, payload.operationId, 'PENDING', nextVersion, payload.id, payload.expectedVersion, pendingRow, audienceHash, 'iniciarCampanha');
      pendingRow = opsSheet.getLastRow();
    }

    // Batch insert destinatarios
    let updatedTotal = Number(dataRow[headers.indexOf('audienciaTotal')]) || 0;
    if (payload.destinatarios && payload.destinatarios.length > 0) {
      const destHeaders = destSheet.getRange(1, 1, 1, destSheet.getLastColumn()).getValues()[0];

      const existingKeys = new Set();
      const campaignColumn = destHeaders.indexOf('campanhaId') + 1;
      const contactColumn = destHeaders.indexOf('contactKey') + 1;
      if (destSheet.getLastRow() > 1 && campaignColumn > 0 && contactColumn > 0) {
        const firstColumn = Math.min(campaignColumn, contactColumn);
        const columnCount = Math.abs(campaignColumn - contactColumn) + 1;
        const keyRows = destSheet.getRange(2, firstColumn, destSheet.getLastRow() - 1, columnCount).getValues();
        for (let i = 0; i < keyRows.length; i++) {
          const campaignValue = keyRows[i][campaignColumn - firstColumn];
          if (String(campaignValue) === String(payload.id)) {
            existingKeys.add(String(keyRows[i][contactColumn - firstColumn]));
          }
        }
      }

      const newRows = [];
      payload.destinatarios.forEach(d => {
        if (!existingKeys.has(String(d.contactKey))) {
          const r = new Array(destHeaders.length).fill('');
          r[destHeaders.indexOf('id')] = d.id;
          r[destHeaders.indexOf('campanhaId')] = payload.id;
          r[destHeaders.indexOf('contactKey')] = d.contactKey;
          r[destHeaders.indexOf('nome')] = d.nome;
          r[destHeaders.indexOf('telefone')] = d.telefone;
          r[destHeaders.indexOf('perfisJson')] = d.perfisJson;
          r[destHeaders.indexOf('cadastroIdsJson')] = d.cadastroIdsJson;
          r[destHeaders.indexOf('contratosJson')] = d.contratosJson;
          r[destHeaders.indexOf('contextoJson')] = d.contextoJson;
          r[destHeaders.indexOf('mensagemRenderizada')] = d.mensagemRenderizada;
          r[destHeaders.indexOf('status')] = 'PENDENTE';
          r[destHeaders.indexOf('createdAt')] = new Date().toISOString();
          r[destHeaders.indexOf('updatedAt')] = new Date().toISOString();
          r[destHeaders.indexOf('version')] = 1;
          r[destHeaders.indexOf('operationId')] = payload.operationId || '';
          newRows.push(r);
          existingKeys.add(String(d.contactKey));
        }
      });

      if (newRows.length > 0) {
        destSheet.getRange(destSheet.getLastRow() + 1, 1, newRows.length, destHeaders.length).setValues(newRows);
      }

      updatedTotal = existingKeys.size;
    }

    // Update Campanha
    dataRow[headers.indexOf('audienciaTotal')] = updatedTotal;
    dataRow[headers.indexOf('status')] = 'INICIADA';
    dataRow[headers.indexOf('updatedAt')] = new Date().toISOString();
    dataRow[headers.indexOf('version')] = nextVersion;
    dataRow[headers.indexOf('operationId')] = payload.operationId || '';
    sheet.getRange(row, 1, 1, headers.length).setValues([dataRow]);

    if (pendingRow !== -1) _recordCampanhaOperation(opsSheet, payload.operationId, 'SUCCESS', nextVersion, payload.id, payload.expectedVersion, pendingRow, audienceHash, 'iniciarCampanha');

    return { success: true, id: payload.id, version: nextVersion, operationId: payload.operationId };
}

function updateCampanhaDestinatario(payload) {
    if (!payload || !payload.id || !payload.operationId || !payload.expectedVersion || !payload.status) {
      return { error: 'VALIDATION_ERROR: id, operationId, expectedVersion e status são obrigatórios.', code: 'VALIDATION_ERROR' };
    }
    const spreadsheet = getSpreadsheet_();
    const opsSheet = spreadsheet.getSheetByName('Campanha_Operacoes');
    const destSheet = spreadsheet.getSheetByName('Campanha_Destinatarios');
    const payloadHash = campaignPayloadHash_('updateCampanhaDestinatario', payload);

    const opCheck = _checkCampanhaOperation(opsSheet, payload.operationId, payload.id, 'updateCampanhaDestinatario', payloadHash);
    if (opCheck) {
      if (opCheck.error) return opCheck;
      if (opCheck.status === 'SUCCESS') {
        return { success: true, status: 'already_updated', id: payload.id, operationId: payload.operationId, version: opCheck.version };
      }
      if (opCheck.status === 'CONFLICT') {
        return { error: 'DESTINATARIO_CONFLICT', code: 'DESTINATARIO_CONFLICT' };
      }
    }

    const textFinder = destSheet.getRange("A:A").createTextFinder(payload.id).matchEntireCell(true);
    const match = textFinder.findNext();
    if (!match) return { error: 'Destinatario not found' };

    const row = match.getRow();
    const headers = destSheet.getRange(1, 1, 1, destSheet.getLastColumn()).getValues()[0];
    const dataRow = destSheet.getRange(row, 1, 1, destSheet.getLastColumn()).getValues()[0];
    const currentVersion = Number(dataRow[headers.indexOf('version')]) || 1;
    const currentStatus = dataRow[headers.indexOf('status')];
    if (opCheck && opCheck.status === 'PENDING' && String(dataRow[headers.indexOf('operationId')]) === String(payload.operationId)) {
      _recordCampanhaOperation(opsSheet, payload.operationId, 'SUCCESS', currentVersion, payload.id, payload.expectedVersion, opCheck.row, payloadHash, 'updateCampanhaDestinatario');
      return { success: true, status: 'already_updated', id: payload.id, operationId: payload.operationId, version: currentVersion };
    }

    const campaignId = String(dataRow[headers.indexOf('campanhaId')]);
    const campaignSheet = spreadsheet.getSheetByName('Campanhas');
    const campaignMatch = campaignSheet.getRange('A:A').createTextFinder(campaignId).matchEntireCell(true).findNext();
    if (!campaignMatch) return { error: 'Campanha not found', code: 'NOT_FOUND' };
    const campaignHeaders = campaignSheet.getRange(1, 1, 1, campaignSheet.getLastColumn()).getValues()[0].map(String);
    const campaignValues = campaignSheet.getRange(campaignMatch.getRow(), 1, 1, campaignHeaders.length).getValues()[0];
    const activeIndex = campaignHeaders.indexOf('ativa');
    const campaignActive = activeIndex === -1 || campaignValues[activeIndex] === '' || campaignValues[activeIndex] === true || String(campaignValues[activeIndex]).toUpperCase() === 'TRUE';
    if (!campaignActive) return { error: 'CAMPAIGN_INACTIVE: Reative a campanha para continuar os envios.', code: 'CAMPAIGN_INACTIVE' };

    if (currentVersion !== Number(payload.expectedVersion)) {
       _recordCampanhaOperation(opsSheet, payload.operationId, 'CONFLICT', currentVersion, payload.id, payload.expectedVersion, opCheck ? opCheck.row : -1, payloadHash, 'updateCampanhaDestinatario');
       return { error: 'DESTINATARIO_CONFLICT: O destinatário foi modificado por outra pessoa.', code: 'DESTINATARIO_CONFLICT', currentVersion: currentVersion };
    }
    if (payload.status && payload.status !== currentStatus) {
      const validTransitions = {
        'PENDENTE': ['WHATSAPP_ABERTO', 'ENVIO_CONFIRMADO', 'IGNORADO', 'ERRO'],
        'WHATSAPP_ABERTO': ['ENVIO_CONFIRMADO', 'IGNORADO', 'ERRO'],
        'ENVIO_CONFIRMADO': [],
        'IGNORADO': [],
        'ERRO': ['PENDENTE', 'WHATSAPP_ABERTO', 'ENVIO_CONFIRMADO', 'IGNORADO']
      };

      if (validTransitions[currentStatus] && !validTransitions[currentStatus].includes(payload.status)) {
        return { error: 'INVALID_STATUS_TRANSITION', code: 'INVALID_STATUS_TRANSITION' };
      }
    }
    const nextVersion = currentVersion + 1;
    let pendingRow = opCheck ? opCheck.row : -1;

    if (payload.operationId) {
      _recordCampanhaOperation(opsSheet, payload.operationId, 'PENDING', nextVersion, payload.id, payload.expectedVersion, pendingRow, payloadHash, 'updateCampanhaDestinatario')
      if (pendingRow === -1) pendingRow = opsSheet.getLastRow();
    }

    // update fields
    const updates = {};
    if (payload.status !== undefined) updates['status'] = payload.status;
    if (payload.whatsappAbertoEm !== undefined) updates['whatsappAbertoEm'] = payload.whatsappAbertoEm;
    if (payload.envioConfirmadoEm !== undefined) updates['envioConfirmadoEm'] = payload.envioConfirmadoEm;
    if (payload.ignoradoEm !== undefined) updates['ignoradoEm'] = payload.ignoradoEm;
    if (payload.motivo !== undefined) updates['motivo'] = payload.motivo;
    updates['updatedAt'] = new Date().toISOString();
    updates['version'] = nextVersion;
    updates['operationId'] = payload.operationId || '';

    for (const key in updates) {
      const idx = headers.indexOf(key);
      if (idx !== -1) dataRow[idx] = updates[key];
    }
    destSheet.getRange(row, 1, 1, headers.length).setValues([dataRow]);

    if (pendingRow !== -1) _recordCampanhaOperation(opsSheet, payload.operationId, 'SUCCESS', nextVersion, payload.id, payload.expectedVersion, pendingRow, payloadHash, 'updateCampanhaDestinatario');

    return { success: true, id: payload.id, version: nextVersion, operationId: payload.operationId };
}

function cancelarCampanha(payload) {
   return _changeCampanhaStatus(payload, 'CANCELADA');
}

function arquivarCampanha(payload) {
   return _changeCampanhaStatus(payload, 'ARQUIVADA');
}

function setCampanhaAtiva(payload) {
  if (!payload || !payload.id || !payload.operationId || !payload.expectedVersion || typeof payload.ativa !== 'boolean') {
    return { error: 'VALIDATION_ERROR: id, operationId, expectedVersion e ativa são obrigatórios.', code: 'VALIDATION_ERROR' };
  }
  const spreadsheet = getSpreadsheet_();
  const sheet = spreadsheet.getSheetByName('Campanhas');
  const opsSheet = spreadsheet.getSheetByName('Campanha_Operacoes');
  const payloadHash = campaignPayloadHash_('setCampanhaAtiva', payload);
  const opCheck = _checkCampanhaOperation(opsSheet, payload.operationId, payload.id, 'setCampanhaAtiva', payloadHash);
  if (opCheck && opCheck.error) return opCheck;
  if (opCheck && opCheck.status === 'SUCCESS') {
    return { success: true, status: 'already_updated', id: payload.id, version: opCheck.version, ativa: payload.ativa };
  }

  const match = sheet.getRange('A:A').createTextFinder(String(payload.id)).matchEntireCell(true).findNext();
  if (!match) return { error: 'Campanha not found', code: 'NOT_FOUND' };
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  const row = match.getRow();
  const values = sheet.getRange(row, 1, 1, headers.length).getValues()[0];
  const versionIndex = headers.indexOf('version');
  const activeIndex = headers.indexOf('ativa');
  const disabledAtIndex = headers.indexOf('desativadaEm');
  const updatedAtIndex = headers.indexOf('updatedAt');
  const operationIndex = headers.indexOf('operationId');
  if ([versionIndex, activeIndex, disabledAtIndex, updatedAtIndex, operationIndex].some(function(index) { return index === -1; })) {
    return { error: 'SCHEMA_OUTDATED: Execute setupSpreadsheet() antes de alterar campanhas.', code: 'SCHEMA_OUTDATED' };
  }
  const currentVersion = Number(values[versionIndex]) || 1;
  const status = String(values[headers.indexOf('status')]);
  if (opCheck && opCheck.status === 'PENDING' && String(values[headers.indexOf('operationId')]) === String(payload.operationId)) {
    const activeValue = values[headers.indexOf('ativa')] === true || String(values[headers.indexOf('ativa')]).toUpperCase() === 'TRUE';
    _recordCampanhaOperation(opsSheet, payload.operationId, 'SUCCESS', currentVersion, payload.id, payload.expectedVersion, opCheck.row, payloadHash, 'setCampanhaAtiva');
    return { success: true, status: 'already_updated', id: payload.id, version: currentVersion, ativa: activeValue };
  }
  if (status === 'ARQUIVADA' || status === 'CANCELADA') {
    return { error: 'INVALID_STATUS: Campanhas arquivadas ou canceladas não podem ser reativadas.', code: 'INVALID_STATUS' };
  }
  if (currentVersion !== Number(payload.expectedVersion)) {
    _recordCampanhaOperation(opsSheet, payload.operationId, 'CONFLICT', currentVersion, payload.id, payload.expectedVersion, opCheck ? opCheck.row : -1, payloadHash, 'setCampanhaAtiva');
    return { error: 'CAMPAIGN_CONFLICT', code: 'CAMPAIGN_CONFLICT', currentVersion: currentVersion };
  }

  const currentActive = values[activeIndex] === '' || values[activeIndex] === true || String(values[activeIndex]).toUpperCase() === 'TRUE';
  if (currentActive === payload.ativa) {
    _recordCampanhaOperation(opsSheet, payload.operationId, 'SUCCESS', currentVersion, payload.id, payload.expectedVersion, opCheck ? opCheck.row : -1, payloadHash, 'setCampanhaAtiva');
    return { success: true, status: 'unchanged', id: payload.id, version: currentVersion, ativa: currentActive };
  }

  const nextVersion = currentVersion + 1;
  _recordCampanhaOperation(opsSheet, payload.operationId, 'PENDING', nextVersion, payload.id, payload.expectedVersion, opCheck ? opCheck.row : -1, payloadHash, 'setCampanhaAtiva');
  const pendingRow = opCheck ? opCheck.row : opsSheet.getLastRow();
  values[activeIndex] = payload.ativa;
  values[disabledAtIndex] = payload.ativa ? '' : new Date().toISOString();
  values[updatedAtIndex] = new Date().toISOString();
  values[versionIndex] = nextVersion;
  values[operationIndex] = payload.operationId;
  sheet.getRange(row, 1, 1, headers.length).setValues([values]);
  _recordCampanhaOperation(opsSheet, payload.operationId, 'SUCCESS', nextVersion, payload.id, payload.expectedVersion, pendingRow, payloadHash, 'setCampanhaAtiva');
  return { success: true, id: payload.id, version: nextVersion, ativa: payload.ativa };
}

function _changeCampanhaStatus(payload, targetStatus) {
    if (!payload || !payload.id || !payload.operationId || !payload.expectedVersion) {
      return { error: 'VALIDATION_ERROR: id, operationId e expectedVersion são obrigatórios.', code: 'VALIDATION_ERROR' };
    }
    const spreadsheet = getSpreadsheet_();
    const opsSheet = spreadsheet.getSheetByName('Campanha_Operacoes');
    const sheet = spreadsheet.getSheetByName('Campanhas');
    const action = targetStatus === 'ARQUIVADA' ? 'arquivarCampanha' : 'cancelarCampanha';
    const payloadHash = campaignPayloadHash_(action, payload);

    const opCheck = _checkCampanhaOperation(opsSheet, payload.operationId, payload.id, action, payloadHash);
    if (opCheck) {
      if (opCheck.error) return opCheck;
      if (opCheck.status === 'SUCCESS') {
        return { success: true, status: 'already_updated', id: payload.id, operationId: payload.operationId, version: opCheck.version };
      }
      if (opCheck.status === 'CONFLICT') {
        return { error: 'CAMPAIGN_CONFLICT', code: 'CAMPAIGN_CONFLICT' };
      }
    }

    const textFinder = sheet.getRange("A:A").createTextFinder(payload.id).matchEntireCell(true);
    const match = textFinder.findNext();
    if (!match) return { error: 'Campanha not found' };

    const row = match.getRow();
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const dataRow = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];
    const currentVersion = Number(dataRow[headers.indexOf('version')]) || 1;
    const currentStatus = String(dataRow[headers.indexOf('status')]);
    if (opCheck && opCheck.status === 'PENDING' && String(dataRow[headers.indexOf('operationId')]) === String(payload.operationId)) {
      _recordCampanhaOperation(opsSheet, payload.operationId, 'SUCCESS', currentVersion, payload.id, payload.expectedVersion, opCheck.row, payloadHash, action);
      return { success: true, status: 'already_updated', id: payload.id, version: currentVersion, operationId: payload.operationId };
    }
    const transitions = {
      RASCUNHO: ['CANCELADA', 'ARQUIVADA'],
      INICIADA: ['CANCELADA', 'ARQUIVADA'],
      CONCLUIDA: ['ARQUIVADA'],
      CANCELADA: ['ARQUIVADA'],
      ARQUIVADA: []
    };
    if ((transitions[currentStatus] || []).indexOf(targetStatus) === -1) {
      return { error: 'INVALID_STATUS_TRANSITION', code: 'INVALID_STATUS_TRANSITION' };
    }
    if (currentVersion !== Number(payload.expectedVersion)) {
       _recordCampanhaOperation(opsSheet, payload.operationId, 'CONFLICT', currentVersion, payload.id, payload.expectedVersion, opCheck ? opCheck.row : -1, payloadHash, action)
       return { error: 'CAMPAIGN_CONFLICT', code: 'CAMPAIGN_CONFLICT', currentVersion: currentVersion };
    }

    const nextVersion = currentVersion + 1;
    let pendingRow = opCheck ? opCheck.row : -1;

    if (payload.operationId) {
      _recordCampanhaOperation(opsSheet, payload.operationId, 'PENDING', nextVersion, payload.id, payload.expectedVersion, pendingRow, payloadHash, action)
      if (pendingRow === -1) pendingRow = opsSheet.getLastRow();
    }

    const now = new Date().toISOString();
    dataRow[headers.indexOf('status')] = targetStatus;
    dataRow[headers.indexOf('updatedAt')] = now;
    dataRow[headers.indexOf('version')] = nextVersion;
    dataRow[headers.indexOf('operationId')] = payload.operationId || '';
    if (headers.indexOf('ativa') !== -1) dataRow[headers.indexOf('ativa')] = false;
    if (headers.indexOf('desativadaEm') !== -1) dataRow[headers.indexOf('desativadaEm')] = now;
    sheet.getRange(row, 1, 1, headers.length).setValues([dataRow]);

    if (pendingRow !== -1) _recordCampanhaOperation(opsSheet, payload.operationId, 'SUCCESS', nextVersion, payload.id, payload.expectedVersion, pendingRow, payloadHash, action);

    return { success: true, id: payload.id, version: nextVersion, operationId: payload.operationId };
}
