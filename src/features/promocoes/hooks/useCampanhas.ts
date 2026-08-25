import { useCallback, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../../store';
import type { Campanha, CampanhaDestinatario, DestinatarioStatus } from '../types';

interface PersistedJob<T> {
  operationId: string;
  payload: T;
  createdAt: string;
}

function getOrCreateJob<T>(key: string, createPayload: () => T): PersistedJob<T> {
  const stored = localStorage.getItem(key);
  if (stored) {
    try { return JSON.parse(stored) as PersistedJob<T>; } catch { localStorage.removeItem(key); }
  }
  const job = { operationId: uuidv4(), payload: createPayload(), createdAt: new Date().toISOString() };
  localStorage.setItem(key, JSON.stringify(job));
  return job;
}

function completeJob(key: string) {
  localStorage.removeItem(key);
}

const FINAL_OPERATION_ERRORS = new Set([
  'CAMPAIGN_CONFLICT', 'DESTINATARIO_CONFLICT', 'IDEMPOTENCY_KEY_REUSED',
  'INVALID_TARGET', 'INVALID_STATUS', 'INVALID_STATUS_TRANSITION',
  'VALIDATION_ERROR', 'DUPLICATE_RECIPIENT', 'NOT_FOUND',
]);

async function executePersistedJob<T>(key: string, request: Promise<T>): Promise<T> {
  try {
    return await request;
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code && FINAL_OPERATION_ERRORS.has(code)) completeJob(key);
    throw error;
  }
}

function campaignError(error: unknown): unknown {
  const typed = error as { code?: string; currentVersion?: number; serverData?: unknown };
  if (typed?.code !== 'CAMPAIGN_CONFLICT') return error;
  return Object.assign(new Error('Conflito: A campanha foi modificada. Recarregue os dados antes de continuar.'), {
    code: typed.code,
    currentVersion: typed.currentVersion,
    serverData: typed.serverData,
  });
}

function normalizeCampaign(campaign: Campanha): Campanha {
  return {
    ...campaign,
    version: Number(campaign.version) || 1,
    ativa: campaign.ativa === undefined || campaign.ativa === null || campaign.ativa === true || String(campaign.ativa).toUpperCase() === 'TRUE',
    desativadaEm: campaign.desativadaEm || null,
  };
}

export function useCampanhas() {
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCampanhas = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await db.getCampanhas();
      setCampanhas((data || []).map(normalizeCampaign).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ));
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : 'Erro ao carregar campanhas');
    } finally {
      setLoading(false);
    }
  }, []);

  const saveCampanha = async (
    nome: string,
    descricao: string,
    mensagemTemplate: string,
    filtrosJson: string,
  ): Promise<Campanha> => {
    const fingerprint = [nome.trim(), descricao.trim(), mensagemTemplate.trim(), filtrosJson].join('\u241f');
    const key = `@campaign:create:${fingerprint}`;
    const job = getOrCreateJob(key, () => ({
      id: uuidv4(), nome, descricao, mensagemTemplate, filtrosJson,
    }));
    const payload = { ...job.payload, operationId: job.operationId };
    const data = await executePersistedJob(key, db.saveCampanha(payload));
    const now = new Date().toISOString();
    const campaign = normalizeCampaign({
      ...payload,
      status: 'RASCUNHO', inicioEm: null, fimEm: null, audienciaTotal: 0,
      createdBy: '', createdAt: now, updatedAt: now,
      version: data.version || 1, ativa: true, desativadaEm: null,
    });
    setCampanhas(previous => previous.some(item => item.id === campaign.id) ? previous : [...previous, campaign]);
    return campaign;
  };

  const completeCreation = (campaign: Campanha) => {
    const fingerprint = [campaign.nome, campaign.descricao, campaign.mensagemTemplate, campaign.filtrosJson]
      .map(value => String(value || '').trim())
      .join('\u241f');
    completeJob(`@campaign:create:${fingerprint}`);
  };

  const iniciarCampanha = async (campaign: Campanha, recipients: Partial<CampanhaDestinatario>[]) => {
    const key = `@campaign:start:${campaign.id}`;
    const job = getOrCreateJob(key, () => ({
      id: campaign.id,
      expectedVersion: campaign.version,
      destinatarios: recipients.map(recipient => ({ ...recipient, id: recipient.id || uuidv4() })),
    }));
    try {
      const data = await executePersistedJob(key, db.iniciarCampanha({ ...job.payload, operationId: job.operationId }));
      setCampanhas(previous => previous.map(item => item.id === campaign.id
        ? { ...item, status: 'INICIADA', version: data.version || item.version, updatedAt: new Date().toISOString() }
        : item));
      completeJob(key);
      completeCreation(campaign);
      return data;
    } catch (requestError) {
      throw campaignError(requestError);
    }
  };

  const updateCampanha = async (campaign: Campanha, changes: Partial<Campanha>) => {
    const key = `@campaign:update:${campaign.id}:${campaign.version}`;
    const job = getOrCreateJob(key, () => ({ id: campaign.id, expectedVersion: campaign.version, ...changes }));
    const data = await executePersistedJob(key, db.updateCampanha({ ...job.payload, operationId: job.operationId }))
      .catch(error => { throw campaignError(error); });
    setCampanhas(previous => previous.map(item => item.id === campaign.id
      ? { ...item, ...changes, version: data.version || item.version, updatedAt: new Date().toISOString() }
      : item));
    completeJob(key);
  };

  const arquivarCampanha = async (campaign: Campanha) => {
    const key = `@campaign:archive:${campaign.id}:${campaign.version}`;
    const job = getOrCreateJob(key, () => ({ id: campaign.id, expectedVersion: campaign.version }));
    const data = await executePersistedJob(key, db.arquivarCampanha({ ...job.payload, operationId: job.operationId }))
      .catch(error => { throw campaignError(error); });
    setCampanhas(previous => previous.map(item => item.id === campaign.id
      ? { ...item, status: 'ARQUIVADA', ativa: false, desativadaEm: new Date().toISOString(), version: data.version || item.version }
      : item));
    completeJob(key);
  };

  const setCampanhaAtiva = async (campaign: Campanha, ativa: boolean) => {
    const key = `@campaign:active:${campaign.id}:${campaign.version}:${ativa}`;
    const job = getOrCreateJob(key, () => ({ id: campaign.id, expectedVersion: campaign.version, ativa }));
    const data = await executePersistedJob(key, db.setCampanhaAtiva({ ...job.payload, operationId: job.operationId }))
      .catch(error => { throw campaignError(error); });
    setCampanhas(previous => previous.map(item => item.id === campaign.id
      ? { ...item, ativa, desativadaEm: ativa ? null : new Date().toISOString(), version: data.version || item.version }
      : item));
    completeJob(key);
  };

  return {
    campanhas, loading, error, fetchCampanhas, saveCampanha, iniciarCampanha,
    updateCampanha, arquivarCampanha, setCampanhaAtiva,
  };
}

export function useCampanhaDestinatarios(campanhaId: string | null) {
  const [destinatarios, setDestinatarios] = useState<CampanhaDestinatario[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDestinatarios = useCallback(async () => {
    if (!campanhaId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await db.getCampanhaDestinatarios(campanhaId);
      setDestinatarios((data || []).map(item => ({ ...item, version: Number(item.version) || 1 })));
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : 'Erro ao carregar destinatários');
    } finally {
      setLoading(false);
    }
  }, [campanhaId]);

  const updateStatus = async (
    destinatarioId: string,
    expectedVersion: number,
    status: DestinatarioStatus,
    extra: Partial<CampanhaDestinatario> = {},
  ) => {
    const key = `@campaign:recipient:${destinatarioId}:${expectedVersion}:${status}`;
    const job = getOrCreateJob(key, () => ({ id: destinatarioId, expectedVersion, status, ...extra }));
    const data = await executePersistedJob(key, db.updateCampanhaDestinatario({ ...job.payload, operationId: job.operationId }));
    setDestinatarios(previous => previous.map(item => item.id === destinatarioId
      ? { ...item, status, ...extra, version: data.version || item.version }
      : item));
    completeJob(key);
  };

  return { destinatarios, loading, error, fetchDestinatarios, updateStatus };
}
