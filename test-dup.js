const fs = require('fs');

let boletos = fs.readFileSync('src/pages/Boletos.tsx', 'utf8');

boletos = boletos.replace(
  'const totalEnvios = enviosCobrancas.length',
  `const totalEnvios = enviosCobrancas.length
  console.log("enviosCobrancas", enviosCobrancas.length, enviosCobrancas.map(c => c.contrato + "-" + c.competencia + "-" + c.vencimento + "-" + c.id));`
);

fs.writeFileSync('src/pages/Boletos.tsx', boletos);
