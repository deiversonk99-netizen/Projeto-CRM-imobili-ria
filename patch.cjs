const fs = require('fs');
let code = fs.readFileSync('apps-script.js', 'utf8');

// 1. Add 'syncCobrancas' to handleRequest
code = code.replace(
  "    } else if (action === 'upsertCobranca') {",
  "    } else if (action === 'upsertCobranca') {\n      return upsertCobranca(data.data);\n    } else if (action === 'syncCobrancas') {\n      return syncCobrancas();"
);

// 2. Add syncCobrancas function
code += `\nfunction syncCobrancas() {
  gerarCobrancasMensais();
  return { success: true };
}\n`;

// 3. Add default Condominios logic to setupSpreadsheet
code = code.replace(
  "// Congela a primeira linha",
  `// Congela a primeira linha
    sheet.setFrozenRows(1);
    
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
    }`
);
code = code.replace("    // Congela a primeira linha\n    sheet.setFrozenRows(1);\n", ""); // remove duplicate if any

// 4. Update upsertCondominio to check nomeNormalizado
code = code.replace(
  "if (id === condoData.id || (condoData.operationId && opId === condoData.operationId)) {",
  "const nomeNorm = row[headers.indexOf('nomeNormalizado')];\n    if (id === condoData.id || (condoData.operationId && opId === condoData.operationId) || (condoData.nomeNormalizado && nomeNorm === condoData.nomeNormalizado)) {"
);

// 5. Update upsertCobranca to avoid conflict if operationId matches
code = code.replace(
  "const opId = row[headers.indexOf('envioOperationId')];",
  "const opId = row[headers.indexOf('envioOperationId')];"
).replace(
  "if (id === cobrancaData.id || (cobrancaData.envioOperationId && opId === cobrancaData.envioOperationId)) {",
  "if (id === cobrancaData.id || (cobrancaData.envioOperationId && opId === cobrancaData.envioOperationId)) {\n      if (cobrancaData.envioOperationId && opId === cobrancaData.envioOperationId) {\n        return { success: true, updated: true, data: cobrancaData };\n      }"
);

// 6. Fix gerarCobrancasMensais to check contract dates
code = code.replace(
  "if (cad.status === 'Encerrado') return;",
  `if (cad.status === 'Encerrado') return;
    
    // Check if contract is within valid dates
    if (cad.inicioContrato && new Date(cad.inicioContrato) > targetDate) return;
    if (cad.fimContrato && new Date(cad.fimContrato) < targetDate) return;`
);

fs.writeFileSync('apps-script.js', code);
