import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { normalizeCompetence, validateSnapshot } from './validate-source.mjs';

const currentDir = dirname(fileURLToPath(import.meta.url));

test('aceita snapshot íntegro e sinaliza consolidações sem expor dados pessoais', async () => {
  const fixture = JSON.parse(await readFile(join(currentDir, '__fixtures__', 'source-valid.json'), 'utf8'));
  const report = validateSnapshot(fixture);
  assert.equal(report.valid, true);
  assert.equal(report.errors.length, 0);
  assert.equal(report.metrics.duplicateContractGroups, 1);
  assert.equal(report.metrics.orphanCampaignRecipients, 1);
});

test('bloqueia cadastro sem campo obrigatório e cobrança órfã', () => {
  const report = validateSnapshot({
    sheets: {
      Cadastros: [{ _sourceRow: 2, id: 'cad-1', contrato: '', nomeProp: 'Teste', nomeInq: 'Teste' }],
      Cobrancas: [{ _sourceRow: 2, cadastroId: 'inexistente', contrato: '999', competencia: '2026-09' }],
    },
  });
  assert.equal(report.valid, false);
  assert.ok(report.errors.some((item) => item.code === 'MISSING_REQUIRED_FIELD'));
  assert.ok(report.errors.some((item) => item.code === 'ORPHAN_CHARGE'));
});

test('normaliza competência sem depender do fuso horário', () => {
  assert.equal(normalizeCompetence('2026-9'), '2026-09');
  assert.equal(normalizeCompetence('09/2026'), '2026-09');
  assert.equal(normalizeCompetence('2026-09-25T00:00:00.000Z'), '2026-09');
});
