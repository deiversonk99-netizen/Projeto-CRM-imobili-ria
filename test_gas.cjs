const GAS_URL = 'https://script.google.com/macros/s/AKfycbzL4JN0w6Kh_TM_V9A4V4YrgmfFMw-E8grL8ik6-HVsXeAKYc1JgqEQGCrNGUbYO0ou_g/exec';
async function run() {
  console.log("Testing updateCampanha...");
  const updateRes = await fetch(GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'updateCampanha', payload: { id: 'dummy', nome: 'teste editado', descricao: 'desc editada' } })
  });
  console.log("Update response:", await updateRes.text());
}
run();
