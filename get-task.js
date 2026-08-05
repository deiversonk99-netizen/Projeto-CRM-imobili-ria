async function run() {
  const result = await fetch("https://script.google.com/macros/s/AKfycbzL4JN0w6Kh_TM_V9A4V4YrgmfFMw-E8grL8ik6-HVsXeAKYc1JgqEQGCrNGUbYO0ou_g/exec?action=getCadastros").then(res => res.json());
  console.log(JSON.stringify(result));
}
run();
