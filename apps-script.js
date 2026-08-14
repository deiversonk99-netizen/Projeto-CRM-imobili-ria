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
    ]
  };

  for (const sheetName in sheetsConfig) {
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
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
      return syncCobrancas();
      return upsertCobranca(data.data);
    }
    
    return { error: 'Action not handled in POST' };
  } catch (error) {
    return { error: error.toString() };
  } finally {
    lock.releaseLock();
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
      'statusPagamento', 'pagoEm', 'envioConfirmadoEm', 'envioOperationId',
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
  const sheet = SpreadsheetApp.openById('1_mfjDq3noSckcJd-qJD3-H4cJEV5TAOdSzPBhSPN5sU').getSheetByName('Checklists');
  const lastRow = sheet.getLastRow();
  
  if (lastRow <= 1) return { error: 'Checklist not found' };
  
  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(checklistData.id)) {
      const rowIndex = i + 2;
      
      // Check version and operationId to prevent conflicts and ensure idempotency
      const metaValues = sheet.getRange(rowIndex, 9, 1, 2).getValues()[0];
      const currentVersion = Number(metaValues[0]) || 1;
      const lastOperationId = metaValues[1];
      
      if (checklistData.operationId && String(lastOperationId) === String(checklistData.operationId)) {
        return { success: true, status: 'already_updated', operationId: checklistData.operationId, version: currentVersion };
      }
      
      if (checklistData.version && currentVersion !== Number(checklistData.version)) {
        return { error: 'CHECKLIST_CONFLICT: O checklist foi modificado por outra pessoa.', code: 'CHECKLIST_CONFLICT' };
      }
      
      const nextVersion = currentVersion + 1;
      
      sheet.getRange(rowIndex, 3, 1, 8).setValues([[
        checklistData.prop_contratoEnviado,
        checklistData.prop_vistoriaEnviada,
        checklistData.inq_manualEntregue,
        checklistData.inq_vistoriaAssinada,
        checklistData.inq_seguroIncendio,
        checklistData.documentos_json || '[]',
        nextVersion,
        checklistData.operationId || ''
      ]]);
      return { success: true, version: nextVersion, operationId: checklistData.operationId };
    }
  }
  return { error: 'Checklist not found' };
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
  if (condoData.nome && !condoData.nomeNormalizado) {
    condoData.nomeNormalizado = condoData.nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
  }
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

function gerarCobrancasMensais(monthsBack = 0) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
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
  } finally {
    lock.releaseLock();
  }
}

function gerarCobrancasHistoricas() {
  gerarCobrancasMensais(2); // Generate for current and last 2 months
  return { success: true };
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function syncCobrancas() {
  gerarCobrancasMensais();
  return { success: true };
}
