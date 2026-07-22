function setupSpreadsheet() {
  const ss = SpreadsheetApp.openById('1_mfjDq3noSckcJd-qJD3-H4cJEV5TAOdSzPBhSPN5sU');

  const sheetsConfig = {
    'Cadastros': [
      'id', 'dataHora', 'contrato', 'nomeProp', 'telProp', 'niverProp',
      'nomeInq', 'telInq', 'niverInq', 'inicioContrato', 'fimContrato',
      'corretor', 'diaVencimento'
    ],
    'Checklists': [
      'id', 'contrato', 'prop_contratoEnviado', 'prop_vistoriaEnviada',
      'inq_manualEntregue', 'inq_vistoriaAssinada', 'inq_seguroIncendio'
    ],
    'Tarefas': [
      'idTarefa', 'dataConclusao', 'contrato', 'tipo', 'usuario', 'referencia'
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
    
    // Congela a primeira linha
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
  }
  
  return jsonResponse({ error: "Action not found" });
}

function handleRequest(body) {
  try {
    const data = JSON.parse(body);
    const action = data.action;
    
    if (action === 'saveCadastro') {
      return saveCadastro(data.data);
    } else if (action === 'updateChecklist') {
      return updateChecklist(data.data);
    } else if (action === 'saveTarefa') {
      return saveTarefa(data.data);
    }
    
    return { error: 'Action not handled in POST' };
  } catch (error) {
    return { error: error.toString() };
  }
}

function getSheetData(sheetName) {
  const sheet = SpreadsheetApp.openById('1_mfjDq3noSckcJd-qJD3-H4cJEV5TAOdSzPBhSPN5sU').getSheetByName(sheetName);
  if (!sheet) return [];
  
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return []; // Empty or just headers
  
  const headers = data[0];
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
  
  const id = Utilities.getUuid();
  const dataHora = new Date().toISOString();
  
  sheet.appendRow([
    id, dataHora, cadastroData.contrato, cadastroData.nomeProp, cadastroData.telProp,
    cadastroData.niverProp, cadastroData.nomeInq, cadastroData.telInq, cadastroData.niverInq,
    cadastroData.inicioContrato, cadastroData.fimContrato, cadastroData.corretor,
    cadastroData.diaVencimento
  ]);
  
  // Auto-create checklist
  const checklistSheet = ss.getSheetByName('Checklists');
  checklistSheet.appendRow([
    id, cadastroData.contrato, false, false, false, false, false
  ]);
  
  return { success: true, id: id };
}

function updateChecklist(checklistData) {
  const sheet = SpreadsheetApp.openById('1_mfjDq3noSckcJd-qJD3-H4cJEV5TAOdSzPBhSPN5sU').getSheetByName('Checklists');
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === checklistData.id) {
      const rowIndex = i + 1;
      sheet.getRange(rowIndex, 3, 1, 5).setValues([[
        checklistData.prop_contratoEnviado,
        checklistData.prop_vistoriaEnviada,
        checklistData.inq_manualEntregue,
        checklistData.inq_vistoriaAssinada,
        checklistData.inq_seguroIncendio
      ]]);
      return { success: true };
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

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
