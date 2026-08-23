const GAS_URL = 'https://script.google.com/macros/s/AKfycbzL4JN0w6Kh_TM_V9A4V4YrgmfFMw-E8grL8ik6-HVsXeAKYc1JgqEQGCrNGUbYO0ou_g/exec';
async function run() {
  console.log("Fetching to identify duplicates...");
  const getRes = await fetch(GAS_URL + "?action=getCampanhas");
  const data = await getRes.json();
  
  const idCounts = {};
  data.forEach(d => { idCounts[d.id] = (idCounts[d.id] || 0) + 1; });
  console.log("ID counts:", idCounts);
}
run();
