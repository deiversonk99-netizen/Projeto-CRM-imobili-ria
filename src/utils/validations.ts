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
