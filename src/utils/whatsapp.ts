export function normalizeBrazilianPhone(phone: string | number | undefined | null): string {
  let digits = String(phone ?? '').replace(/\D/g, '').replace(/^0+/, '');
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  return /^55[1-9]{2}\d{8,9}$/.test(digits) ? digits : '';
}

export function buildWhatsAppLink(phone: string | number | undefined | null, message: string): string {
  const normalized = normalizeBrazilianPhone(phone);
  if (!normalized) return '';
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}
