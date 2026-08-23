const GAS_URL = 'https://script.google.com/macros/s/AKfycbzL4JN0w6Kh_TM_V9A4V4YrgmfFMw-E8grL8ik6-HVsXeAKYc1JgqEQGCrNGUbYO0ou_g/exec';
const id = require('crypto').randomUUID();

async function run() {
  console.log("Saving new...");
  const saveRes = await fetch(GAS_URL, {
    method: 'POST',
    body: JSON.stringify({ action: 'saveCampanha', payload: { id, nome: 'Test Delete', descricao: 'desc', operationId: 'abc' } })
  });
  console.log("Save:", await saveRes.text());
  
  console.log("Deleting...");
  const delRes = await fetch(GAS_URL, {
    method: 'POST',
    body: JSON.stringify({ action: 'deleteCampanha', id })
  });
  console.log("Delete:", await delRes.text());
}
run();
