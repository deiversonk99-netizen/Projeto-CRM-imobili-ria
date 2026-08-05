async function run() {
  const GAS_URL = 'https://script.google.com/macros/s/AKfycbzL4JN0w6Kh_TM_V9A4V4YrgmfFMw-E8grL8ik6-HVsXeAKYc1JgqEQGCrNGUbYO0ou_g/exec';
  const response = await fetch(GAS_URL, {
    method: 'POST',
    body: JSON.stringify({ action: 'updateCadastro', data: { id: "b39e66cf-d083-47b6-bb80-0a821b60de7f", contrato: 500, nomeProp: "Test", enderecoImovel: "aaa" } }),
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    redirect: 'follow'
  });
  console.log("Status:", response.status);
  const text = await response.text();
  console.log("Body:", text);
}
run();
