import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('../../../apps-script.js', import.meta.url), 'utf8');

function createAppsScriptContext() {
  return vm.createContext({
    console,
    Session: {
      getScriptTimeZone: () => 'America/Sao_Paulo',
    },
    Utilities: {
      formatDate: (date: Date) => {
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        return `${year}-${month}`;
      },
    },
  });
}

describe('normalização financeira do Apps Script', () => {
  it.each([
    ['"2026-08"', '2026-08'],
    ['"2026-8-1"', '2026-08'],
    ['"2026-08-01T03:00:00.000Z"', '2026-08'],
    ['"01/08/2026"', '2026-08'],
    ['new Date("2026-08-01T00:00:00.000Z")', '2026-08'],
    ['new Date("2026-08-01T12:00:00.000Z")', '2026-08'],
  ])('normaliza %s para uma competência canônica', (expression, expected) => {
    const context = createAppsScriptContext();
    vm.runInContext(source, context);

    expect(vm.runInContext(`normalizeCompetencia_(${expression})`, context)).toBe(expected);
  });

  it('não compara competência da planilha diretamente com a string do mês', () => {
    expect(source).toContain('getCobrancaKeysFromSheet_(sheetCobrancas)');
    expect(source).not.toContain("filter(c => c.competencia === competencia)");
  });

  it('reconfere as chaves persistidas imediatamente antes de inserir', () => {
    expect(source).toContain('getCobrancaKeysFromSheet_(sheetCobrancas)');
    expect(source).toContain('if (persistedKeys.has(key)) return false;');
    expect(source).toContain('cobrancaKey_(cad.id, competencia, cad.contrato)');
  });
});
