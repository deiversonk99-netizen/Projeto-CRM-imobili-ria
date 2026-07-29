const GAS_URL = 'https://script.google.com/macros/s/AKfycbzL4JN0w6Kh_TM_V9A4V4YrgmfFMw-E8grL8ik6-HVsXeAKYc1JgqEQGCrNGUbYO0ou_g/exec';

async function fetchGAS(payload) {
  const response = await fetch(GAS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify(payload),
  });
  console.log('Status:', response.status);
  const data = await response.json();
  console.log('Data:', data);
}

fetchGAS({ action: 'saveTarefa', data: { contrato: 500, tipo: 'Aniversário', usuario: 'Proprietário', referencia: '2026' } }).catch(console.error);
