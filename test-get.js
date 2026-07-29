const GAS_URL = 'https://script.google.com/macros/s/AKfycbzL4JN0w6Kh_TM_V9A4V4YrgmfFMw-E8grL8ik6-HVsXeAKYc1JgqEQGCrNGUbYO0ou_g/exec';

async function fetchGAS(payload) {
  const response = await fetch(`${GAS_URL}?action=getTarefas`);
  console.log('Status:', response.status);
  const data = await response.json();
  console.log('Data count:', data.length);
  console.log(data.filter(t => t.tipo === 'Aniversário'));
}
fetchGAS().catch(console.error);
