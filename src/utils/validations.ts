export const isValidDateDDMM = (dateStr: string) => {
  if (!/^\d{2}\/\d{2}$/.test(dateStr)) return false;
  const [day, month] = dateStr.split('/').map(Number);
  if (month < 1 || month > 12) return false;
  const maxDays = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day > 0 && day <= maxDays[month - 1];
};

export const isValidPhone = (phone: string) => {
  const clean = phone.replace(/\D/g, '');
  return clean.length >= 10 && clean.length <= 11;
};

export const maskDateDDMM = (value: string) => {
  let v = value.replace(/\D/g, '');
  if (v.length > 4) v = v.slice(0, 4);
  if (v.length > 2) {
    v = `${v.slice(0, 2)}/${v.slice(2)}`;
  }
  return v;
};

export const maskPhone = (value: string) => {
  let v = value.replace(/\D/g, '');
  if (v.length > 11) v = v.slice(0, 11);
  if (v.length > 2) {
    v = `(${v.slice(0, 2)}) ${v.slice(2)}`;
  }
  if (v.length > 10) {
    v = `${v.slice(0, 10)}-${v.slice(10)}`;
  }
  return v;
};
