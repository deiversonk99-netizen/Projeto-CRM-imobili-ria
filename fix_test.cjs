const fs = require('fs');
let code = fs.readFileSync('src/features/promocoes/__tests__/hooks.test.ts', 'utf8');
code = code.replace(/setDestinatarios/g, "setDestinatarios: () => {}"); // Actually we can't test setDestinatarios like this easily because it's not exported.

// Let's rewrite the test to properly mock fetchDestinatarios or something?
// Actually wait, let's just see if it fails.
