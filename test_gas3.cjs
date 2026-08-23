const GAS_URL = 'https://script.google.com/macros/s/AKfycbzL4JN0w6Kh_TM_V9A4V4YrgmfFMw-E8grL8ik6-HVsXeAKYc1JgqEQGCrNGUbYO0ou_g/exec';
async function run() {
  const getRes = await fetch(GAS_URL + "?action=getCampanhas");
  const data = await getRes.json();
  console.log(data);
}
run();
