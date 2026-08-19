function setupSpreadsheet() {
  const ss = SpreadsheetApp.openById('1_mfjDq3noSckcJd-qJD3-H4cJEV5TAOdSzPBhSPN5sU');

  const sheetsConfig = {
    'Cadastros': [
      'id', 'dataHora', 'contrato', 'nomeProp', 'telProp', 'niverProp',
      'nomeInq', 'telInq', 'niverInq', 'inicioContrato', 'fimContrato',
      'corretor', 'diaVencimento', 'enderecoImovel', 'tipoImovel', 'valorAluguel',
      'comissao', 'emailProp', 'emailInq', 'status', 'finalidade', 'condominio',
      'version', 'operationId'
    ],
    'Checklists': [
      'id', 'contrato', 'prop_contratoEnviado', 'prop_vistoriaEnviada',
      'inq_manualEntregue', 'inq_vistoriaAssinada', 'inq_seguroIncendio',
      'documentos_json', 'version', 'operationId'
    ],
    'Tarefas': [
      'idTarefa', 'dataConclusao', 'contrato', 'tipo', 'usuario', 'referencia'
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
      'version', 'operationId'
    ],
    'Campanha_Destinatarios': [
      'id', 'campanhaId', 'contactKey', 'nome', 'telefone', 'perfisJson',
      'cadastroIdsJson', 'contratosJson', 'contextoJson', 'mensagemRenderizada',
      'status', 'whatsappAbertoEm', 'envioConfirmadoEm', 'ignoradoEm', 'motivo',
      'createdAt', 'updatedAt', 'version', 'operationId'
    ],
    'Campanha_Operacoes': [
      'operationId', 'timestamp', 'status', 'result_version', 'target_id', 'requested_version'
    ]
  };

  for (const sheetName in sheetsConfig) {
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }

    // Migration logic for Cobrancas missing pagamentoOperationId
    if (sheetName === 'Cobrancas' && sheet.getLastColumn() > 0) {
      const existingHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      const indexEnvio = existingHeaders.indexOf('envioOperationId');
      const indexPagamento = existingHeaders.indexOf('pagamentoOperationId');
      if (indexEnvio !== -1 && indexPagamento === -1) {
        sheet.insertColumnAfter(indexEnvio + 1);
      }
    }

    // Configura os cabeçalhos
    const headers = sheetsConfig[sheetName];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#d0e0e3");


    // Seed condominios
    if (sheetName === 'Condominios' && sheet.getLastRow() <= 1) {
      const defaults = ['Vila Hadassas', 'Morro do Sol', 'Bela Vista', 'Residencial Oregon', 'Outro'];
      const rows = defaults.map(nome => [
        Utilities.getUuid(), nome, nome.toLowerCase(), true, new Date().toISOString(), Utilities.getUuid()
      ]);
      sheet.getRange(2, 1, rows.length, 6).setValues(rows);
    }

    // Create trigger for gerarCobrancasMensais if it doesn't exist
    const triggers = ScriptApp.getProjectTriggers();
    const hasTrigger = triggers.some(t => t.getHandlerFunction() === 'gerarCobrancasMensais');
    if (!hasTrigger) {
      ScriptApp.newTrigger('gerarCobrancasMensais')
        .timeBased()
        .everyDays(1)
        .atHour(1)
        .create();
    }
    sheet.setFrozenRows(1);
  }
}

function doPost(e) {
  const response = handleRequest(e.postData.contents);
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  const action = e.parameter.action;

  if (action === 'getCadastros') {
    return jsonResponse(getSheetData('Cadastros'));
  } else if (action === 'getChecklists') {
    return jsonResponse(getSheetData('Checklists'));
  } else if (action === 'getTarefas') {
    return jsonResponse(getSheetData('Tarefas'));
  } else if (action === 'getCondominios') {
    return jsonResponse(getSheetData('Condominios'));
  } else if (action === 'getCobrancas') {
    return jsonResponse(getSheetData('Cobrancas'));
  } else if (action === 'getCampanhas') {
    return jsonResponse(getCampanhas());
  } else if (action === 'getCampanhaDestinatarios') {
    if (!e.parameter.campanhaId) return jsonResponse({ error: 'campanhaId is required' });
    return jsonResponse(getCampanhaDestinatarios(e.parameter.campanhaId));
  }

  return jsonResponse({ error: "Action not found" });
}

function handleRequest(body) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000); // Wait up to 30 seconds for other processes
    const data = JSON.parse(body);
    const action = data.action;

    if (action === 'saveCadastro') {
      return saveCadastro(data.data);
    } else if (action === 'updateChecklist') {
      return updateChecklist(data.data);
    } else if (action === 'saveTarefa') {
      return saveTarefa(data.data);
    } else if (action === 'updateCadastro') {
      return updateCadastro(data.data);
    } else if (action === 'deleteCadastro') {
      return deleteCadastro(data.id);
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
      return saveCampanha(data.payload);
    } else if (action === 'iniciarCampanha') {
      return iniciarCampanha(data.payload);
    } else if (action === 'updateCampanhaDestinatario') {
      return updateCampanhaDestinatario(data.payload);
    }

    return { error: 'Action not handled in POST' };
  } catch (error) {
    return { error: error.toString() };
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}

function getSheetData(sheetName) {
  const sheet = SpreadsheetApp.openById('1_mfjDq3noSckcJd-qJD3-H4cJEV5TAOdSzPBhSPN5sU').getSheetByName(sheetName);
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return []; // Empty or just headers

  const sheetsConfig = {
    'Cadastros': [
      'id', 'dataHora', 'contrato', 'nomeProp', 'telProp', 'niverProp',
      'nomeInq', 'telInq', 'niverInq', 'inicioContrato', 'fimContrato',
      'corretor', 'diaVencimento', 'enderecoImovel', 'tipoImovel', 'valorAluguel',
      'comissao', 'emailProp', 'emailInq', 'status', 'finalidade', 'condominio',
      'version', 'operationId'
    ],
    'Checklists': [
      'id', 'contrato', 'prop_contratoEnviado', 'prop_vistoriaEnviada',
      'inq_manualEntregue', 'inq_vistoriaAssinada', 'inq_seguroIncendio',
      'documentos_json', 'version', 'operationId'
    ],
    'Tarefas': [
      'idTarefa', 'dataConclusao', 'contrato', 'tipo', 'usuario', 'referencia'
    ],
    'Condominios': [
      'id', 'nome', 'nomeNormalizado', 'ativo', 'createdAt', 'operationId'
    ],
    'Cobrancas': [
      'id', 'cadastroId', 'contrato', 'competencia', 'vencimento', 'valor',
      'statusPagamento', 'pagoEm', 'envioConfirmadoEm', 'envioOperationId', 'pagamentoOperationId',
      'version', 'createdAt', 'updatedAt'
    ]
  };

  const headers = sheetsConfig[sheetName] || data[0];
  const rows = data.slice(1);

  return rows.map(row => {
    let obj = {};
    headers.forEach((header, index) => {
      let val = row[index];
      // Try to parse booleans for Checklists
      if (val === 'TRUE') val = true;
      if (val === 'FALSE') val = false;
      obj[header] = val;
    });
    return obj;
  });
}

function saveCadastro(cadastroData) {
  const ss = SpreadsheetApp.openById('1_mfjDq3noSckcJd-qJD3-H4cJEV5TAOdSzPBhSPN5sU');
  const sheet = ss.getSheetByName('Cadastros');
  const checklistSheet = ss.getSheetByName('Checklists');

  const lastRow = sheet.getLastRow();
  let cadastroExists = false;

  if (lastRow > 1) {
    // Only get the IDs and Contratos to check for duplicates and idempotency
    const existingIds = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    const existingContratos = sheet.getRange(2, 3, lastRow - 1, 1).getValues();

    for (let i = 0; i < existingIds.length; i++) {
      const rowId = String(existingIds[i][0]);
      const rowContrato = String(existingContratos[i][0]).trim();
      const inputId = cadastroData.id ? String(cadastroData.id) : null;
      const inputContrato = String(cadastroData.contrato).trim();

      if (inputId && rowId === inputId) {
        if (rowContrato !== inputContrato) {
          return { error: 'Conflito de ID: O mesmo ID foi enviado para um contrato diferente.' };
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

    const newRow = [
      id, dataHora, cadastroData.contrato, cadastroData.nomeProp, cadastroData.telProp,
      cadastroData.niverProp, cadastroData.nomeInq, cadastroData.telInq, cadastroData.niverInq,
      cadastroData.inicioContrato, cadastroData.fimContrato, cadastroData.corretor,
      cadastroData.diaVencimento, cadastroData.enderecoImovel || '', cadastroData.tipoImovel || '',
      cadastroData.valorAluguel || '', cadastroData.comissao || '', cadastroData.emailProp || '',
      cadastroData.emailInq || '', cadastroData.status || 'Ativo', cadastroData.finalidade || '', cadastroData.condominio || '',
      1, '' // version (23rd col), operationId (24th col)
    ];

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

  return { success: true, id: id, message: cadastroExists ? 'Idempotency: already saved' : 'Created' };
}

function updateCadastro(cadastroData) {
  const sheet = SpreadsheetApp.openById('1_mfjDq3noSckcJd-qJD3-H4cJEV5TAOdSzPBhSPN5sU').getSheetByName('Cadastros');
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] !== cadastroData.id && String(data[i][2]).trim() === String(cadastroData.contrato).trim()) {
      return { error: 'Número de contrato já existe' };
    }
  }

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === cadastroData.id) {
      const rowIndex = i + 1;
      const currentRow = data[i];
      const currentVersion = Number(currentRow[22]) || 1; // 23rd column (index 22)
      const lastOperationId = currentRow[23]; // 24th column (index 23)

      if (cadastroData.operationId && String(lastOperationId) === String(cadastroData.operationId)) {
        return { success: true, status: 'already_updated', operationId: cadastroData.operationId };
      }

      if (cadastroData.expectedVersion && currentVersion !== Number(cadastroData.expectedVersion)) {
        return { error: 'EDIT_CONFLICT: O cadastro foi modificado por outra pessoa.', code: 'EDIT_CONFLICT' };
      }

      const nextVersion = currentVersion + 1;

      sheet.getRange(rowIndex, 3, 1, 22).setValues([[
        cadastroData.contrato, cadastroData.nomeProp, cadastroData.telProp,
        cadastroData.niverProp, cadastroData.nomeInq, cadastroData.telInq, cadastroData.niverInq,
        cadastroData.inicioContrato, cadastroData.fimContrato, cadastroData.corretor,
        cadastroData.diaVencimento, cadastroData.enderecoImovel || '', cadastroData.tipoImovel || '',
        cadastroData.valorAluguel || '', cadastroData.comissao || '', cadastroData.emailProp || '',
        cadastroData.emailInq || '', cadastroData.status || 'Ativo', cadastroData.finalidade || '', cadastroData.condominio || '',
        nextVersion, cadastroData.operationId || ''
      ]]);
      return { success: true, status: 'updated', operationId: cadastroData.operationId };
    }
  }
  return { error: 'Cadastro not found' };
}

function deleteCadastro(id) {
  const ss = SpreadsheetApp.openById('1_mfjDq3noSckcJd-qJD3-H4cJEV5TAOdSzPBhSPN5sU');

  // Delete from Cadastros
  const sheet = ss.getSheetByName('Cadastros');
  const data = sheet.getDataRange().getValues();
  let found = false;
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === id) {
      sheet.deleteRow(i + 1);
      found = true;
      break;
    }
  }

  // Delete from Checklists
  const checklistSheet = ss.getSheetByName('Checklists');
  const checkData = checklistSheet.getDataRange().getValues();
  for (let i = 1; i < checkData.length; i++) {
    if (checkData[i][0] === id) {
      checklistSheet.deleteRow(i + 1);
      break;
    }
  }

  if (found) {
    return { success: true };
  } else {
    return { error: 'Cadastro not found' };
  }
}

function updateChecklist(checklistData) {
  const spreadsheet = SpreadsheetApp.openById('1_mfjDq3noSckcJd-qJD3-H4cJEV5TAOdSzPBhSPN5sU');

  let opsSheet = spreadsheet.getSheetByName('Operacoes');
  if (!opsSheet) opsSheet = spreadsheet.insertSheet('Operacoes');

  if (opsSheet.getLastRow() === 0) {
    opsSheet.appendRow(['operationId', 'timestamp', 'status', 'result_version', 'target_id', 'requested_version']);
  }

  const sheet = spreadsheet.getSheetByName('Checklists');
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { error: 'Checklist not found' };

  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  let targetRowIndex = -1;
  let currentVersion = 1;
  let lastRowOperationId = '';

  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(checklistData.id)) {
      targetRowIndex = i + 2;
      const metaValues = sheet.getRange(targetRowIndex, 9, 1, 2).getValues()[0];
      currentVersion = Number(metaValues[0]) || 1;
      lastRowOperationId = metaValues[1];
      break;
    }
  }

  if (targetRowIndex === -1) return { error: 'Checklist not found' };

  let pendingRowIndex = -1;
  if (checklistData.operationId) {
    const opsLastRow = opsSheet.getLastRow();
    if (opsLastRow > 1) {
      const textFinder = opsSheet.getRange(2, 1, opsLastRow - 1, 1).createTextFinder(checklistData.operationId).matchEntireCell(true);
      const matches = textFinder.findAll();

      if (matches.length > 0) {
        // Obter a última ocorrência (maior número de linha)
        const match = matches[matches.length - 1];
        const j = match.getRow();

        // Colunas: 1:id, 2:timestamp, 3:status, 4:result_version, 5:target_id
        const meta = opsSheet.getRange(j, 3, 1, 3).getValues()[0];
        const opStatus = meta[0];
        const opVersion = Number(meta[1]);
        const opTargetId = String(meta[2]);

        if (opTargetId !== String(checklistData.id)) {
           return { error: 'INVALID_TARGET: O operationId fornecido pertence a outro checklist.' };
        }

        if (opStatus === 'SUCCESS') {
          return { success: true, status: 'already_updated', operationId: checklistData.operationId, version: opVersion };
        } else if (opStatus === 'CONFLICT') {
          return { error: 'CHECKLIST_CONFLICT: O checklist foi modificado por outra pessoa.', code: 'CHECKLIST_CONFLICT', currentVersion };
        } else if (opStatus === 'PENDING') {
          if (String(lastRowOperationId) === String(checklistData.operationId)) {
            opsSheet.getRange(j, 3).setValue('SUCCESS');
            return { success: true, status: 'already_updated', operationId: checklistData.operationId, version: currentVersion };
          }
          pendingRowIndex = j;
        }
      }
    }
  }

  if (checklistData.version && currentVersion !== Number(checklistData.version)) {
    if (checklistData.operationId && pendingRowIndex !== -1) {
      opsSheet.getRange(pendingRowIndex, 2, 1, 5).setValues([[new Date().toISOString(), 'CONFLICT', currentVersion, checklistData.id, checklistData.version]]);
    } else {
      opsSheet.appendRow([checklistData.operationId || 'N/A', new Date().toISOString(), 'CONFLICT', currentVersion, checklistData.id, checklistData.version]);
    }
    return { error: 'CHECKLIST_CONFLICT: O checklist foi modificado por outra pessoa.', code: 'CHECKLIST_CONFLICT', currentVersion };
  }

  const nextVersion = currentVersion + 1;

  if (checklistData.operationId) {
    if (pendingRowIndex !== -1) {
      opsSheet.getRange(pendingRowIndex, 2, 1, 5).setValues([[new Date().toISOString(), 'PENDING', nextVersion, checklistData.id, checklistData.version]]);
    } else {
      opsSheet.appendRow([checklistData.operationId, new Date().toISOString(), 'PENDING', nextVersion, checklistData.id, checklistData.version]);
      pendingRowIndex = opsSheet.getLastRow();
    }
  }

  sheet.getRange(targetRowIndex, 3, 1, 8).setValues([[
    checklistData.prop_contratoEnviado,
    checklistData.prop_vistoriaEnviada,
    checklistData.inq_manualEntregue,
    checklistData.inq_vistoriaAssinada,
    checklistData.inq_seguroIncendio,
    checklistData.documentos_json || '[]',
    nextVersion,
    checklistData.operationId || ''
  ]]);

  if (pendingRowIndex !== -1) {
    opsSheet.getRange(pendingRowIndex, 3).setValue('SUCCESS');
  }

  return { success: true, version: nextVersion, operationId: checklistData.operationId };
}

function saveTarefa(tarefaData) {
  const sheet = SpreadsheetApp.openById('1_mfjDq3noSckcJd-qJD3-H4cJEV5TAOdSzPBhSPN5sU').getSheetByName('Tarefas');
  const idTarefa = Utilities.getUuid();
  const dataConclusao = new Date().toISOString();

  sheet.appendRow([
    idTarefa, dataConclusao, tarefaData.contrato, tarefaData.tipo,
    tarefaData.usuario, tarefaData.referencia
  ]);

  return { success: true, id: idTarefa };
}

function deleteTarefa(id) {
  const sheet = SpreadsheetApp.openById('1_mfjDq3noSckcJd-qJD3-H4cJEV5TAOdSzPBhSPN5sU').getSheetByName('Tarefas');
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === id) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { error: 'Tarefa not found' };
}

function upsertCondominio(condoData) {
  if (condoData.nome && !condoData.nomeNormalizado) {
    condoData.nomeNormalizado = condoData.nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
  }
  const ss = SpreadsheetApp.openById('1_mfjDq3noSckcJd-qJD3-H4cJEV5TAOdSzPBhSPN5sU');
  const sheet = ss.getSheetByName('Condominios');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  // Try to update existing by id or operationId
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const id = row[headers.indexOf('id')];
    const opId = row[headers.indexOf('operationId')];

    const nomeNorm = row[headers.indexOf('nomeNormalizado')];
    if (id === condoData.id || (condoData.operationId && opId === condoData.operationId) || (condoData.nomeNormalizado && nomeNorm === condoData.nomeNormalizado)) {
      // Update
      const updateRow = [];
      headers.forEach(header => {
        updateRow.push(condoData[header] !== undefined ? condoData[header] : row[headers.indexOf(header)]);
      });
      sheet.getRange(i + 1, 1, 1, headers.length).setValues([updateRow]);
      return { success: true, updated: true, data: condoData };
    }
  }

  // Create new
  const newRow = [];
  headers.forEach(header => {
    newRow.push(condoData[header] || "");
  });
  sheet.appendRow(newRow);
  return { success: true, created: true, data: condoData };
}

function upsertCobranca(cobrancaData) {
  const ss = SpreadsheetApp.openById('1_mfjDq3noSckcJd-qJD3-H4cJEV5TAOdSzPBhSPN5sU');
  const sheet = ss.getSheetByName('Cobrancas');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  // Try to update existing by id or operationId
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const id = row[headers.indexOf('id')];
    const envioOpId = row[headers.indexOf('envioOperationId')];
    const pagOpId = row[headers.indexOf('pagamentoOperationId')];

    if (id === cobrancaData.id || (cobrancaData.envioOperationId && envioOpId === cobrancaData.envioOperationId) || (cobrancaData.pagamentoOperationId && pagOpId === cobrancaData.pagamentoOperationId)) {
      if ((cobrancaData.envioOperationId && envioOpId === cobrancaData.envioOperationId) || (cobrancaData.pagamentoOperationId && pagOpId === cobrancaData.pagamentoOperationId)) {
        return { success: true, updated: true, data: cobrancaData };
      }
      // Update
      const currentVersion = row[headers.indexOf('version')] || 1;
      const incomingVersion = cobrancaData.version || 1;

      if (incomingVersion < currentVersion) {
         return { error: 'COBRANCA_CONFLICT', message: 'Versão mais antiga' };
      }

      cobrancaData.version = currentVersion + 1;
      cobrancaData.updatedAt = new Date().toISOString();

      const updateRow = [];
      headers.forEach(header => {
        updateRow.push(cobrancaData[header] !== undefined ? cobrancaData[header] : row[headers.indexOf(header)]);
      });
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
    newRow.push(cobrancaData[header] || "");
  });
  sheet.appendRow(newRow);
  return { success: true, created: true, data: cobrancaData };
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
    const ss = SpreadsheetApp.openById('1_mfjDq3noSckcJd-qJD3-H4cJEV5TAOdSzPBhSPN5sU');
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
        cobrancasData
          .filter(c => c.competencia === competencia)
          .map(c => c.cadastroId)
      );

      const newCobrancas = [];

      cadastrosData.forEach(cad => {
        if (cad.status === 'Encerrado') return;
        if (existingCobrancas.has(cad.id)) return;
        if (!cad.diaVencimento) return;

        const diaVenc = parseInt(cad.diaVencimento, 10);
        if (isNaN(diaVenc)) return;

        let targetDate = new Date(currentYear, currentMonth - 1, diaVenc);
        if (targetDate.getMonth() !== currentMonth - 1) {
          targetDate = new Date(currentYear, currentMonth, 0);
        }

        // Date boundaries
        if (cad.inicioContrato && new Date(cad.inicioContrato) > targetDate) return;
        if (cad.fimContrato && new Date(cad.fimContrato) < targetDate) return;

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
        headers.forEach(h => row.push(novaCobranca[h] || ""));
        newCobrancas.push(row);
      });

      if (newCobrancas.length > 0) {
        sheetCobrancas.getRange(sheetCobrancas.getLastRow() + 1, 1, newCobrancas.length, headers.length).setValues(newCobrancas);
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


function _checkCampanhaOperation(opsSheet, operationId, targetId) {
  if (!operationId) return null;
  const opsLastRow = opsSheet.getLastRow();
  if (opsLastRow <= 1) return null;
  const textFinder = opsSheet.getRange(2, 1, opsLastRow - 1, 1).createTextFinder(operationId).matchEntireCell(true);
  const matches = textFinder.findAll();
  if (matches.length > 0) {
    const match = matches[matches.length - 1];
    const j = match.getRow();
    const meta = opsSheet.getRange(j, 3, 1, 5).getValues()[0];
    const opStatus = meta[0];
    const opVersion = Number(meta[1]);
    const opTargetId = String(meta[2]);
    const opExpectedVersion = meta[3];
    const opHash = String(meta[4] || '');

    if (targetId && opTargetId && opTargetId !== String(targetId)) {
      return { error: 'INVALID_TARGET: O operationId pertence a outra entidade.', code: 'INVALID_TARGET' };
    }

    return { status: opStatus, version: opVersion, row: j, hash: opHash };
  }
  return null;
}

function _recordCampanhaOperation(opsSheet, operationId, status, version, targetId, requestedVersion, pendingRow) {
  if (!operationId) return;
  const now = new Date().toISOString();
  if (pendingRow !== -1) {
    opsSheet.getRange(pendingRow, 2, 1, 5).setValues([[now, status, version, targetId, requestedVersion]]);
  } else {
    opsSheet.appendRow([operationId, now, status, version, targetId, requestedVersion]);
  }
}

function getCampanhas() {
  const sheet = SpreadsheetApp.openById('1_mfjDq3noSckcJd-qJD3-H4cJEV5TAOdSzPBhSPN5sU').getSheetByName('Campanhas');
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
    campanhas.push(obj);
  }
  return campanhas;
}

function getCampanhaDestinatarios(campanhaId) {
  const sheet = SpreadsheetApp.openById('1_mfjDq3noSckcJd-qJD3-H4cJEV5TAOdSzPBhSPN5sU').getSheetByName('Campanha_Destinatarios');
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
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const spreadsheet = SpreadsheetApp.openById('1_mfjDq3noSckcJd-qJD3-H4cJEV5TAOdSzPBhSPN5sU');
    let opsSheet = spreadsheet.getSheetByName('Campanha_Operacoes');
    if (!opsSheet) opsSheet = spreadsheet.insertSheet('Campanha_Operacoes');
    let sheet = spreadsheet.getSheetByName('Campanhas');

    const opCheck = _checkCampanhaOperation(opsSheet, payload.operationId, payload.id);
    if (opCheck) {
      if (opCheck.error) return opCheck;
      if (opCheck.status === 'SUCCESS') {
        return { success: true, status: 'already_updated', id: payload.id, operationId: payload.operationId, version: opCheck.version };
      }
    }

    // As it is a new campaign
    const version = 1;
    let pendingRow = -1;
    if (payload.operationId) {
       _recordCampanhaOperation(opsSheet, payload.operationId, 'PENDING', version, payload.id, version, -1);
       pendingRow = opsSheet.getLastRow();
    }

    sheet.appendRow([
      payload.id, payload.nome, payload.descricao || '', payload.mensagemTemplate || '',
      payload.filtrosJson || '{}', 'RASCUNHO', payload.inicioEm || '', payload.fimEm || '',
      payload.audienciaTotal || 0, payload.createdBy || 'Unknown', payload.createdAt || new Date().toISOString(),
      payload.updatedAt || new Date().toISOString(), version, payload.operationId || ''
    ]);

    if (pendingRow !== -1) {
      opsSheet.getRange(pendingRow, 3).setValue('SUCCESS');
    }

    return { success: true, id: payload.id, version: version, operationId: payload.operationId };
  } finally {
    lock.releaseLock();
  }
}

function updateCampanha(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const spreadsheet = SpreadsheetApp.openById('1_mfjDq3noSckcJd-qJD3-H4cJEV5TAOdSzPBhSPN5sU');
    let opsSheet = spreadsheet.getSheetByName('Campanha_Operacoes');
    let sheet = spreadsheet.getSheetByName('Campanhas');

    const opCheck = _checkCampanhaOperation(opsSheet, payload.operationId, payload.id);
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

    if (payload.expectedVersion && currentVersion !== Number(payload.expectedVersion)) {
       _recordCampanhaOperation(opsSheet, payload.operationId, 'CONFLICT', currentVersion, payload.id, payload.expectedVersion, opCheck ? opCheck.row : -1, '')
       return { error: 'CAMPAIGN_CONFLICT: The campaign was modified by someone else.', code: 'CAMPAIGN_CONFLICT', currentVersion: currentVersion };
    }

    if (currentStatus !== 'RASCUNHO') {
       return { error: 'INVALID_STATUS: Apenas campanhas em rascunho podem ser alteradas.' };
    }

    const nextVersion = currentVersion + 1;
    let pendingRow = opCheck ? opCheck.row : -1;

    if (payload.operationId) {
      _recordCampanhaOperation(opsSheet, payload.operationId, 'PENDING', nextVersion, payload.id, payload.expectedVersion, pendingRow, '')
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
      if (idx !== -1) {
         sheet.getRange(row, idx + 1).setValue(updates[key]);
      }
    }

    if (pendingRow !== -1) {
      opsSheet.getRange(pendingRow, 3).setValue('SUCCESS');
    }

    return { success: true, id: payload.id, version: nextVersion, operationId: payload.operationId };
  } finally {
    lock.releaseLock();
  }
}

function iniciarCampanha(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000); // Allow more time for batch insert
  try {
    const spreadsheet = SpreadsheetApp.openById('1_mfjDq3noSckcJd-qJD3-H4cJEV5TAOdSzPBhSPN5sU');
    let opsSheet = spreadsheet.getSheetByName('Campanha_Operacoes');
    let sheet = spreadsheet.getSheetByName('Campanhas');
    let destSheet = spreadsheet.getSheetByName('Campanha_Destinatarios');

    // Hash do payload
    const audienceCanonical = JSON.stringify({
      campanhaId: String(payload.id),
      version: Number(payload.expectedVersion || 1),
      destinatarios: (payload.destinatarios || [])
        .map(item => {
          let perfis = [];
          let cadastroIds = [];
          try { perfis = JSON.parse(item.perfisJson || '[]'); } catch(e) {}
          try { cadastroIds = JSON.parse(item.cadastroIdsJson || '[]'); } catch(e) {}
          return {
            contactKey: String(item.contactKey),
            mensagemRenderizada: String(item.mensagemRenderizada || ''),
            perfis: perfis.sort(),
            cadastroIds: cadastroIds.sort()
          };
        })
        .sort((a, b) => a.contactKey.localeCompare(b.contactKey))
    });

    const rawHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, audienceCanonical);
    const audienceHash = rawHash.map(b => (b < 0 ? b + 256 : b).toString(16).padStart(2, '0')).join('');

    const opCheck = _checkCampanhaOperation(opsSheet, payload.operationId, payload.id);
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

    if (payload.expectedVersion && currentVersion !== Number(payload.expectedVersion)) {
       _recordCampanhaOperation(opsSheet, payload.operationId, 'CONFLICT', currentVersion, payload.id, payload.expectedVersion, opCheck ? opCheck.row : -1, audienceHash);
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
      _recordCampanhaOperation(opsSheet, payload.operationId, 'PENDING', nextVersion, payload.id, payload.expectedVersion, pendingRow, audienceHash);
      pendingRow = opsSheet.getLastRow();
    }

    // Batch insert destinatarios
    if (payload.destinatarios && payload.destinatarios.length > 0) {
      const destHeaders = destSheet.getRange(1, 1, 1, destSheet.getLastColumn()).getValues()[0];

      const destData = destSheet.getDataRange().getValues();
      const existingKeys = new Set();
      if (destData.length > 1) {
        for (let i = 1; i < destData.length; i++) {
          if (String(destData[i][destHeaders.indexOf('campanhaId')]) === String(payload.id)) {
            existingKeys.add(String(destData[i][destHeaders.indexOf('contactKey')]));
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
        }
      });

      if (newRows.length > 0) {
        destSheet.getRange(destSheet.getLastRow() + 1, 1, newRows.length, destHeaders.length).setValues(newRows);
      }

      const updatedTotal = existingKeys.size + newRows.length;
      sheet.getRange(row, headers.indexOf('audienciaTotal') + 1).setValue(updatedTotal);
    }

    // Update Campanha
    sheet.getRange(row, headers.indexOf('status') + 1).setValue('INICIADA');
    sheet.getRange(row, headers.indexOf('updatedAt') + 1).setValue(new Date().toISOString());
    sheet.getRange(row, headers.indexOf('version') + 1).setValue(nextVersion);
    sheet.getRange(row, headers.indexOf('operationId') + 1).setValue(payload.operationId || '');

    if (pendingRow !== -1) {
      opsSheet.getRange(pendingRow, 3).setValue('SUCCESS');
    }

    return { success: true, id: payload.id, version: nextVersion, operationId: payload.operationId };
  } finally {
    lock.releaseLock();
  }
}

function updateCampanhaDestinatario(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const spreadsheet = SpreadsheetApp.openById('1_mfjDq3noSckcJd-qJD3-H4cJEV5TAOdSzPBhSPN5sU');
    let opsSheet = spreadsheet.getSheetByName('Campanha_Operacoes');
    let destSheet = spreadsheet.getSheetByName('Campanha_Destinatarios');

    const opCheck = _checkCampanhaOperation(opsSheet, payload.operationId, payload.id);
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



    if (payload.expectedVersion && currentVersion !== Number(payload.expectedVersion)) {
       _recordCampanhaOperation(opsSheet, payload.operationId, 'CONFLICT', currentVersion, payload.id, payload.expectedVersion, opCheck ? opCheck.row : -1, '')
       return { error: 'DESTINATARIO_CONFLICT: O destinatário foi modificado por outra pessoa.', code: 'DESTINATARIO_CONFLICT', currentVersion: currentVersion };
    }

    const nextVersion = currentVersion + 1;
    let pendingRow = opCheck ? opCheck.row : -1;

    if (payload.operationId) {
      _recordCampanhaOperation(opsSheet, payload.operationId, 'PENDING', nextVersion, payload.id, payload.expectedVersion, pendingRow, '')
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
      if (idx !== -1) {
         destSheet.getRange(row, idx + 1).setValue(updates[key]);
      }
    }

    if (pendingRow !== -1) {
      opsSheet.getRange(pendingRow, 3).setValue('SUCCESS');
    }

    return { success: true, id: payload.id, version: nextVersion, operationId: payload.operationId };
  } finally {
    lock.releaseLock();
  }
}

function cancelarCampanha(payload) {
   return _changeCampanhaStatus(payload, 'CANCELADA');
}

function arquivarCampanha(payload) {
   return _changeCampanhaStatus(payload, 'ARQUIVADA');
}

function _changeCampanhaStatus(payload, targetStatus) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const spreadsheet = SpreadsheetApp.openById('1_mfjDq3noSckcJd-qJD3-H4cJEV5TAOdSzPBhSPN5sU');
    let opsSheet = spreadsheet.getSheetByName('Campanha_Operacoes');
    let sheet = spreadsheet.getSheetByName('Campanhas');

    const opCheck = _checkCampanhaOperation(opsSheet, payload.operationId, payload.id);
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


    if (payload.expectedVersion && currentVersion !== Number(payload.expectedVersion)) {
       _recordCampanhaOperation(opsSheet, payload.operationId, 'CONFLICT', currentVersion, payload.id, payload.expectedVersion, opCheck ? opCheck.row : -1, '')
       return { error: 'CAMPAIGN_CONFLICT', code: 'CAMPAIGN_CONFLICT', currentVersion: currentVersion };
    }

    const nextVersion = currentVersion + 1;
    let pendingRow = opCheck ? opCheck.row : -1;

    if (payload.operationId) {
      _recordCampanhaOperation(opsSheet, payload.operationId, 'PENDING', nextVersion, payload.id, payload.expectedVersion, pendingRow, '')
      if (pendingRow === -1) pendingRow = opsSheet.getLastRow();
    }

    sheet.getRange(row, headers.indexOf('status') + 1).setValue(targetStatus);
    sheet.getRange(row, headers.indexOf('updatedAt') + 1).setValue(new Date().toISOString());
    sheet.getRange(row, headers.indexOf('version') + 1).setValue(nextVersion);
    sheet.getRange(row, headers.indexOf('operationId') + 1).setValue(payload.operationId || '');

    if (pendingRow !== -1) {
      opsSheet.getRange(pendingRow, 3).setValue('SUCCESS');
    }

    return { success: true, id: payload.id, version: nextVersion, operationId: payload.operationId };
  } finally {
    lock.releaseLock();
  }
}
