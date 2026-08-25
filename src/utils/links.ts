import { buildWhatsAppLink } from './whatsapp';

export function generateWhatsAppLink(phone: string, text: string): string {
  return buildWhatsAppLink(phone, text);
}

export function generateEmailLink(email: string, subject: string, body: string): string {
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
