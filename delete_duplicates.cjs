const GAS_URL = 'https://script.google.com/macros/s/AKfycbzL4JN0w6Kh_TM_V9A4V4YrgmfFMw-E8grL8ik6-HVsXeAKYc1JgqEQGCrNGUbYO0ou_g/exec';
async function run() {
  console.log("Fetching to identify duplicates...");
  const getRes = await fetch(GAS_URL + "?action=getCampanhas");
  const data = await getRes.json();
  
  // We found that 'd5032027-a337-4e85-b374-05c70fcff813' is duplicated.
  // Wait, if we send 'deleteCampanha' it will delete ONE of them.
  // Let's send it once to remove the first one!
  const updateRes = await fetch(GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'deleteCampanha', id: 'd5032027-a337-4e85-b374-05c70fcff813' })
  });
  console.log("Delete response:", await updateRes.text());
}
run();
