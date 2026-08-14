const fs = require('fs');
let code = fs.readFileSync('src/pages/Resumo.tsx', 'utf8');

code = code.replace(
  "const { cadastros, checklists } = useData();",
  "const { cadastros, checklists, cobrancas } = useData();\n  const { checkCobrancaWarning } = require('../utils/dates');"
);

// We need to use import for checkCobrancaWarning.
// Let's do it right.
