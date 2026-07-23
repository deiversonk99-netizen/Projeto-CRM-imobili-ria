export function generateWhatsAppLink(phone: string, text: string): string {
  const cleanPhone = String(phone || '').replace(/\D/g, '');
  return `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(text)}`;
}

export function generateEmailLink(email: string, subject: string, body: string): string {
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
