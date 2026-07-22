const GAS_URL = 'https://script.google.com/macros/s/AKfycbzL4JN0w6Kh_TM_V9A4V4YrgmfFMw-E8grL8ik6-HVsXeAKYc1JgqEQGCrNGUbYO0ou_g/exec';

fetch(GAS_URL + '?action=getCadastros')
  .then(res => res.json())
  .then(data => console.log(data))
  .catch(err => console.error(err));
