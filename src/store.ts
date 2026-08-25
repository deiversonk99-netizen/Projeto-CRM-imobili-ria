import type { Campanha, CampanhaDestinatario } from './features/promocoes/types';
import type { Cadastro, ChecklistDocs, Condominio, Cobranca, TarefaConcluida, Usuario } from './types';

export const GAS_URL = String(import.meta.env.VITE_GAS_URL || '').trim();
const AUTH_TOKEN_KEY = '@app:auth-token';

type JsonRecord = Record<string, unknown>;

export class ApiError extends Error {
  code?: string;
  serverData?: JsonRecord;
  currentVersion?: number;

  constructor(message: string, options: { code?: string; serverData?: JsonRecord; currentVersion?: number } = {}) {
    super(message);
    this.name = 'ApiError';
    this.code = options.code;
    this.serverData = options.serverData;
    this.currentVersion = options.currentVersion;
  }
}

let authToken = typeof window !== 'undefined' ? localStorage.getItem(AUTH_TOKEN_KEY) || '' : '';

export function setAuthToken(token: string) {
  authToken = token;
  localStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function clearAuthToken() {
  authToken = '';
  localStorage.removeItem(AUTH_TOKEN_KEY);
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' ? value as JsonRecord : {};
}

export async function fetchGAS<T = unknown>(payload: JsonRecord, customTimeout = 60000): Promise<T> {
  if (!GAS_URL || !/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(GAS_URL)) {
    throw new ApiError('VITE_GAS_URL não está configurada com uma URL /exec válida.', { code: 'CONFIG_ERROR' });
  }
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), customTimeout);
  const requestPayload = payload.action === 'login' || payload.action === 'health'
    ? payload
    : { ...payload, authToken };

  try {
    const response = await fetch(GAS_URL, {
      method: 'POST',
      credentials: 'omit',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(requestPayload),
      signal: controller.signal,
    });

    if (response.status === 404) {
      const code = response.url.includes('script.googleusercontent.com') ? 'REDIRECT_FAILED' : 'ENDPOINT_NOT_FOUND';
      throw new ApiError(
        code === 'REDIRECT_FAILED'
          ? 'O redirecionamento do Google falhou. A operação ainda pode ter sido processada.'
          : 'A implantação do Google Apps Script não foi encontrada.',
        { code },
      );
    }
    if (!response.ok) throw new ApiError(`Falha HTTP ${response.status}.`, { code: `HTTP_${response.status}` });

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new ApiError('O servidor não retornou uma resposta JSON.', { code: 'INVALID_RESPONSE' });
    }

    const data: unknown = await response.json();
    const record = asRecord(data);
    if (record.error) {
      const currentVersion = Number(record.currentVersion ?? record.version);
      const error = new ApiError(String(record.error), {
        code: record.code ? String(record.code) : undefined,
        serverData: record,
        currentVersion: Number.isFinite(currentVersion) ? currentVersion : undefined,
      });
      if (error.code === 'UNAUTHORIZED') window.dispatchEvent(new Event('app:unauthorized'));
      throw error;
    }
    return data as T;
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError(
        'A operação excedeu o tempo limite. O servidor ainda pode estar processando a solicitação.',
        { code: 'TIMEOUT' },
      );
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export function fetchGET<T>(action: string, params: JsonRecord = {}): Promise<T> {
  return fetchGAS<T>({ action, ...params });
}

interface LoginResponse {
  success: true;
  token: string;
  expiresIn: number;
  user: Usuario;
  transitionMode?: boolean;
}

interface MutationResponse {
  success: true;
  status?: string;
  id?: string;
  version?: number;
  ativa?: boolean;
  dataConclusao?: string;
}

export const db = {
  login: (login: string, password: string) =>
    fetchGAS<LoginResponse>({ action: 'login', credentials: { login, password } }),
  legacyLogin: () =>
    fetchGAS<LoginResponse>({ action: 'login', credentials: { login: '__legacy__', password: '' } }),

  getCadastros: () => fetchGET<Cadastro[]>('getCadastros'),
  saveCadastro: (cadastro: Omit<Cadastro, 'id' | 'dataHora'> & {
    id?: string;
    dataHora?: string;
    operationId?: string;
    renewedFromId?: string;
  }) => fetchGAS<MutationResponse>({ action: 'saveCadastro', data: cadastro }),
  updateCadastro: (cadastro: Cadastro & { operationId?: string; expectedVersion?: number }) =>
    fetchGAS<MutationResponse>({ action: 'updateCadastro', data: cadastro }),
  deleteCadastro: (payload: { id: string; operationId: string; expectedVersion: number }) =>
    fetchGAS<MutationResponse>({ action: 'deleteCadastro', payload }),

  getChecklists: () => fetchGET<ChecklistDocs[]>('getChecklists'),
  updateChecklist: (checklist: ChecklistDocs & { operationId?: string; version?: number }) =>
    fetchGAS<MutationResponse>({ action: 'updateChecklist', data: checklist }),

  getTarefas: () => fetchGET<TarefaConcluida[]>('getTarefas'),
  saveTarefa: async (tarefa: Omit<TarefaConcluida, 'idTarefa' | 'dataConclusao'> & { operationId: string }) => {
    const response = await fetchGAS<MutationResponse>({ action: 'saveTarefa', data: tarefa });
    return {
      ...tarefa,
      idTarefa: String(response.id),
      dataConclusao: response.dataConclusao || new Date().toISOString(),
    } as TarefaConcluida;
  },
  deleteTarefa: (idTarefa: string) => fetchGAS<MutationResponse>({ action: 'deleteTarefa', id: idTarefa }),

  getCondominios: () => fetchGET<Condominio[]>('getCondominios'),
  getCobrancas: () => fetchGET<Cobranca[]>('getCobrancas'),
  syncCobrancas: () => fetchGAS<MutationResponse>({ action: 'syncCobrancas' }),
  upsertCondominio: (condominio: Condominio) =>
    fetchGAS<MutationResponse & { data?: Condominio }>({ action: 'upsertCondominio', data: condominio }),
  upsertCobranca: (cobranca: Cobranca) =>
    fetchGAS<MutationResponse & { data?: Cobranca }>({ action: 'upsertCobranca', data: cobranca }),

  getCampanhas: () => fetchGET<Campanha[]>('getCampanhas'),
  saveCampanha: (payload: JsonRecord) => fetchGAS<MutationResponse>({ action: 'saveCampanha', payload }),
  updateCampanha: (payload: JsonRecord) => fetchGAS<MutationResponse>({ action: 'updateCampanha', payload }),
  arquivarCampanha: (payload: JsonRecord) => fetchGAS<MutationResponse>({ action: 'arquivarCampanha', payload }),
  cancelarCampanha: (payload: JsonRecord) => fetchGAS<MutationResponse>({ action: 'cancelarCampanha', payload }),
  setCampanhaAtiva: (payload: JsonRecord) => fetchGAS<MutationResponse>({ action: 'setCampanhaAtiva', payload }),
  iniciarCampanha: (payload: JsonRecord) => fetchGAS<MutationResponse>({ action: 'iniciarCampanha', payload }, 120000),
  getCampanhaDestinatarios: (campanhaId: string) =>
    fetchGET<CampanhaDestinatario[]>('getCampanhaDestinatarios', { campanhaId }),
  updateCampanhaDestinatario: (payload: JsonRecord) =>
    fetchGAS<MutationResponse>({ action: 'updateCampanhaDestinatario', payload }),
};
