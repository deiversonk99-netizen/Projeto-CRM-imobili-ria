const GAS_URL = 'https://script.google.com/macros/s/AKfycbzL4JN0w6Kh_TM_V9A4V4YrgmfFMw-E8grL8ik6-HVsXeAKYc1JgqEQGCrNGUbYO0ou_g/exec';
async function run() {
  const getRes = await fetch(GAS_URL + "?action=getCampanhas");
  const data = await getRes.json();
  if (data.length > 0) {
    console.log("Found:", data[0].id);
    const delRes = await fetch(GAS_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'deleteCampanha', id: data[0].id })
    });
    console.log("Delete response:", await delRes.text());
  }
}
run();
