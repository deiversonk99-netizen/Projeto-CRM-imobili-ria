import type { User } from '@supabase/supabase-js';
import type { Campanha, CampanhaDestinatario } from './features/promocoes/types';
import { supabase } from './lib/supabase';
import type { Cadastro, ChecklistDocs, Condominio, Cobranca, TarefaConcluida, Usuario } from './types';

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

interface MutationResponse {
  success: true;
  status?: string;
  id?: string;
  version?: number;
  ativa?: boolean;
  dataConclusao?: string;
}

interface ProfileRow {
  user_id: string;
  full_name: string;
  interfaces: number[] | null;
  active: boolean;
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {};
}

function normalizeRpcError(error: { message: string; code?: string; details?: string; hint?: string }): ApiError {
  const rawMessage = [error.message, error.details, error.hint].filter(Boolean).join(' ');
  if (rawMessage.includes('SUPABASE_TIMEOUT')) {
    return new ApiError('A operação excedeu o tempo limite. Ela pode ter sido concluída e pode ser repetida com segurança.', { code: 'TIMEOUT' });
  }
  const knownCode = [
    'UNAUTHORIZED', 'FORBIDDEN', 'CHECKLIST_CONFLICT', 'CADASTRO_CONFLICT',
    'COBRANCA_CONFLICT', 'CAMPAIGN_CONFLICT', 'DESTINATARIO_CONFLICT',
    'IDEMPOTENCY_KEY_REUSED', 'INVALID_STATUS_TRANSITION', 'INVALID_STATUS',
    'VALIDATION_ERROR', 'DUPLICATE_CONTRACT', 'NOT_FOUND', 'OPERATION_IN_PROGRESS',
  ].find(code => rawMessage.includes(code));
  const message = knownCode === 'UNAUTHORIZED'
    ? 'Sua sessão expirou. Entre novamente.'
    : knownCode === 'FORBIDDEN'
      ? 'Seu usuário não possui permissão para esta operação.'
      : error.message || 'Falha ao comunicar com o banco de dados.';
  return new ApiError(message, { code: knownCode || error.code });
}

function unwrapResponse<T>(data: unknown): T {
  const record = asRecord(data);
  if (record.error) {
    const currentVersion = Number(record.currentVersion ?? record.version);
    throw new ApiError(String(record.error), {
      code: record.code ? String(record.code) : undefined,
      serverData: record,
      currentVersion: Number.isFinite(currentVersion) ? currentVersion : undefined,
    });
  }
  return data as T;
}

async function rpc<T>(functionName: string, args: JsonRecord = {}): Promise<T> {
  const { data, error } = await supabase.rpc(functionName, args);
  if (error) {
    const normalized = normalizeRpcError(error);
    if (normalized.code === 'UNAUTHORIZED' && typeof window !== 'undefined') {
      window.dispatchEvent(new Event('app:unauthorized'));
    }
    throw normalized;
  }
  return unwrapResponse<T>(data);
}

function loginToEmail(login: string): string {
  const normalized = login.trim().toLowerCase();
  if (normalized.includes('@')) return normalized;
  const safeLogin = normalized.replace(/[^a-z0-9._-]/g, '');
  return `${safeLogin}@img-imoveis.local`;
}

async function loadUser(user: User): Promise<Usuario> {
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, full_name, interfaces, active')
    .eq('user_id', user.id)
    .single();
  if (error) throw normalizeRpcError(error);
  const profile = data as ProfileRow;
  if (!profile.active) throw new ApiError('Usuário desativado.', { code: 'UNAUTHORIZED' });
  const email = user.email || '';
  return {
    id: profile.user_id,
    nome: profile.full_name,
    email,
    login: email.endsWith('@img-imoveis.local') ? email.slice(0, -'@img-imoveis.local'.length) : email,
    interfaces: Array.isArray(profile.interfaces) ? profile.interfaces.map(Number) : [],
  };
}

export const db = {
  loginAnonymously: async (): Promise<Usuario> => {
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error || !data.user || !data.session) {
      throw new ApiError(
        'Não foi possível iniciar o acesso direto. Verifique se o acesso anônimo está habilitado no Supabase.',
        { code: error?.code || 'DIRECT_ACCESS_FAILED' },
      );
    }
    return loadUser(data.user);
  },
  login: async (login: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email: loginToEmail(login), password });
    if (error || !data.user || !data.session) {
      throw new ApiError('Login ou senha inválidos.', { code: 'INVALID_CREDENTIALS' });
    }
    try {
      return { success: true as const, user: await loadUser(data.user) };
    } catch (profileError) {
      await supabase.auth.signOut();
      throw profileError;
    }
  },
  restoreSession: async (): Promise<Usuario | null> => {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw normalizeRpcError(error);
    return data.session?.user ? loadUser(data.session.user) : null;
  },
  userFromAuth: (user: User) => loadUser(user),
  logout: async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw normalizeRpcError(error);
  },
  onAuthStateChange: (callback: (user: User | null) => void) => {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session?.user ?? null));
    return () => data.subscription.unsubscribe();
  },

  getHealth: () => rpc<JsonRecord>('get_app_health'),
  getCadastros: () => rpc<Cadastro[]>('app_get_cadastros'),
  saveCadastro: (cadastro: Omit<Cadastro, 'id' | 'dataHora'> & {
    id?: string;
    dataHora?: string;
    operationId?: string;
    renewedFromId?: string;
  }) => rpc<MutationResponse>('app_save_cadastro', { p_data: cadastro }),
  updateCadastro: (cadastro: Cadastro & { operationId?: string; expectedVersion?: number }) =>
    rpc<MutationResponse>('app_update_cadastro', { p_data: cadastro }),
  deleteCadastro: (payload: { id: string; operationId: string; expectedVersion: number }) =>
    rpc<MutationResponse>('app_delete_cadastro', { p_payload: payload }),

  getChecklists: () => rpc<ChecklistDocs[]>('app_get_checklists'),
  updateChecklist: (checklist: ChecklistDocs & { operationId?: string; version?: number }) =>
    rpc<MutationResponse>('app_update_checklist', { p_data: checklist }),

  getTarefas: () => rpc<TarefaConcluida[]>('app_get_tarefas'),
  saveTarefa: async (tarefa: Omit<TarefaConcluida, 'idTarefa' | 'dataConclusao'> & { operationId: string }) => {
    const response = await rpc<MutationResponse>('app_save_tarefa', { p_data: tarefa });
    return {
      ...tarefa,
      idTarefa: String(response.id),
      dataConclusao: response.dataConclusao || new Date().toISOString(),
    } as TarefaConcluida;
  },
  deleteTarefa: (idTarefa: string) => rpc<MutationResponse>('app_delete_tarefa', { p_id: idTarefa }),

  getCondominios: () => rpc<Condominio[]>('app_get_condominios'),
  getCobrancas: () => rpc<Cobranca[]>('app_get_cobrancas'),
  syncCobrancas: () => rpc<MutationResponse>('app_sync_cobrancas'),
  upsertCondominio: (condominio: Condominio) =>
    rpc<MutationResponse & { data?: Condominio }>('app_upsert_condominio', { p_data: condominio }),
  upsertCobranca: (cobranca: Cobranca) =>
    rpc<MutationResponse & { data?: Cobranca }>('app_upsert_cobranca', { p_data: cobranca }),

  getCampanhas: () => rpc<Campanha[]>('app_get_campanhas'),
  saveCampanha: (payload: JsonRecord) => rpc<MutationResponse>('app_save_campanha', { p_payload: payload }),
  updateCampanha: (payload: JsonRecord) => rpc<MutationResponse>('app_update_campanha', { p_payload: payload }),
  arquivarCampanha: (payload: JsonRecord) => rpc<MutationResponse>('app_arquivar_campanha', { p_payload: payload }),
  cancelarCampanha: (payload: JsonRecord) => rpc<MutationResponse>('app_cancelar_campanha', { p_payload: payload }),
  setCampanhaAtiva: (payload: JsonRecord) => rpc<MutationResponse>('app_set_campanha_ativa', { p_payload: payload }),
  iniciarCampanha: (payload: JsonRecord) => rpc<MutationResponse>('app_iniciar_campanha', { p_payload: payload }),
  getCampanhaDestinatarios: (campanhaId: string) =>
    rpc<CampanhaDestinatario[]>('app_get_campanha_destinatarios', { p_campanha_id: campanhaId }),
  updateCampanhaDestinatario: (payload: JsonRecord) =>
    rpc<MutationResponse>('app_update_campanha_destinatario', { p_payload: payload }),
};
