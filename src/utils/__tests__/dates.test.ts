import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkBirthday, checkCobrancaWarning, getDaysUntilBirthday } from '../dates';
import { buildWhatsAppLink, normalizeBrazilianPhone } from '../whatsapp';

afterEach(() => vi.useRealTimers());

describe('janelas de avisos', () => {
  it('inclui todos os aniversários de hoje até os próximos três dias', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 11, 12));

    expect(checkBirthday('11/08')).toMatchObject({ daysAway: 0 });
    expect(checkBirthday('12/08')).toMatchObject({ daysAway: 1 });
    expect(checkBirthday('13/08')).toMatchObject({ daysAway: 2 });
    expect(checkBirthday('14/08')).toMatchObject({ daysAway: 3 });
    expect(checkBirthday('15/08')).toBe(false);
  });

  it('trata corretamente a virada do ano no próximo aniversário', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 11, 31, 12));
    expect(getDaysUntilBirthday('02/01')).toBe(2);
  });

  it('mostra boleto nos dois dias anteriores e no vencimento', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 8, 12));
    expect(checkCobrancaWarning('2026-08-10')).toBe('2_dias');
    expect(checkCobrancaWarning('2026-08-11')).toBe(false);
  });
});

describe('WhatsApp', () => {
  it('normaliza números brasileiros sem duplicar DDI ou DDD 55', () => {
    expect(normalizeBrazilianPhone('(19) 99999-9999')).toBe('5519999999999');
    expect(normalizeBrazilianPhone('+55 (55) 99999-9999')).toBe('5555999999999');
  });

  it('gera link somente para telefone válido e codifica a mensagem', () => {
    expect(buildWhatsAppLink('11999999999', 'Olá, tudo bem?')).toBe('https://wa.me/5511999999999?text=Ol%C3%A1%2C%20tudo%20bem%3F');
    expect(buildWhatsAppLink('123', 'Olá')).toBe('');
  });
});
