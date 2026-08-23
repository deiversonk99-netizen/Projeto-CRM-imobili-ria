import { Cadastro, ChecklistDocs, TarefaConcluida, Usuario } from './types';

const GAS_URL = 'https://script.google.com/macros/s/AKfycbzL4JN0w6Kh_TM_V9A4V4YrgmfFMw-E8grL8ik6-HVsXeAKYc1JgqEQGCrNGUbYO0ou_g/exec';

export async function fetchGAS(payload: any, customTimeout = 60000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), customTimeout);
  
  try {
    const response = await fetch(GAS_URL, {
      method: 'POST',
      credentials: 'omit',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    
    if (response.status === 404) {
      if (response.url && response.url.includes('script.googleusercontent.com')) {
        throw new Error('REDIRECT_FAILED: O Google Apps Script tentou redirecionar a resposta, mas a URL expirou ou falhou. É possível que os dados tenham sido salvos.');
      } else {
        throw new Error('ENDPOINT_NOT_FOUND: a implantação do Google Apps Script não foi encontrada.');
      }
    }

    if (!response.ok) {
      throw new Error(`HTTP_${response.status}`);
    }
    
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new Error('INVALID_RESPONSE: o servidor não retornou JSON.');
    }

    const data = await response.json();

    if (data.error) {
      const err: any = new Error(data.error);
      if (data.code) err.code = data.code;
      err.serverData = data;
      err.currentVersion = data.currentVersion || data.version;
      throw err;
    }

    return data;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error('TIMEOUT: A operação demorou muito para responder (timeout). O servidor ainda pode estar processando a sua requisição.');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function fetchGET(action: string) {
  const response = await fetch(`${GAS_URL}?action=${action}`, { credentials: 'omit' });
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`[404] Rota "${action}" não encontrada. Verifique se você publicou a NOVA VERSÃO no Apps Script.`);
    }
    throw new Error(`Failed to fetch ${action}: ${response.status} ${response.statusText}`);
  }
  const data = await response.json();
  if (data.error) throw new Error(data.error);
  return data;
}

export const db = {
  getUsuarios: async (): Promise<Usuario[]> => {
    try {
      const users = await fetchGET('getUsuarios');
      if (users && users.length > 0) return users;
      return [
        { id: "1", nome: "João Silva", email: "joao@example.com", login: "joao", senha: "123", interfaces: [1, 3] },
        { id: "2", nome: "Admin", email: "admin@example.com", login: "admin", senha: "123", interfaces: [1, 2, 3, 4, 5, 99] }
      ];
    } catch (e: any) {
      throw e;
    }
  },
  getCadastros: async (): Promise<Cadastro[]> => {
    return fetchGET('getCadastros');
  },
  
  saveCadastro: async (cadastro: Omit<Cadastro, 'id' | 'dataHora'> & { id?: string; dataHora?: string }): Promise<void> => {
    await fetchGAS({ action: 'saveCadastro', data: cadastro });
  },
  updateCadastro: async (cadastro: Cadastro & { operationId?: string, expectedVersion?: number }): Promise<void> => {
    await fetchGAS({ action: 'updateCadastro', data: cadastro });
  },
  deleteCadastro: async (id: string): Promise<void> => {
    await fetchGAS({ action: 'deleteCadastro', id });
  },

  getChecklists: async (): Promise<ChecklistDocs[]> => {
    return fetchGET('getChecklists');
  },
  updateChecklist: async (checklist: ChecklistDocs & { operationId?: string, version?: number }): Promise<any> => {
    return await fetchGAS({ action: 'updateChecklist', data: checklist });
  },

  getTarefas: async (): Promise<TarefaConcluida[]> => {
    return fetchGET('getTarefas');
  },

  getCondominios: async (): Promise<any[]> => {
    return fetchGET('getCondominios');
  },
  getCobrancas: async (): Promise<any[]> => {
    return fetchGET('getCobrancas');
  },
  syncCobrancas: async (): Promise<any> => {
    return await fetchGAS({ action: 'syncCobrancas' });
  },
  upsertCondominio: async (condo: any): Promise<any> => {
    return await fetchGAS({ action: 'upsertCondominio', data: condo });
  },
  upsertCobranca: async (cobranca: any): Promise<any> => {
    return await fetchGAS({ action: 'upsertCobranca', data: cobranca });
  },

  saveTarefa: async (tarefa: Omit<TarefaConcluida, 'idTarefa' | 'dataConclusao'>): Promise<TarefaConcluida> => {
    const res = await fetchGAS({ action: 'saveTarefa', data: tarefa });
    return {
      ...tarefa,
      idTarefa: res.id,
      dataConclusao: new Date().toISOString()
    };
  },
  deleteTarefa: async (idTarefa: string): Promise<void> => {
    await fetchGAS({ action: 'deleteTarefa', id: idTarefa });
  },

  getCampanhas: async (): Promise<any[]> => {
    return fetchGET('getCampanhas');
  },
  saveCampanha: async (payload: any): Promise<any> => {
    return await fetchGAS({ action: 'saveCampanha', payload });
  },
  
  // === FUNÇÕES NOVAS DE EDITAR/EXCLUIR AQUI ===
  deleteCampanha: async (id: string): Promise<void> => {
    await fetchGAS({ action: 'deleteCampanha', id });
  },
  updateCampanha: async (payload: any): Promise<any> => {
    return await fetchGAS({ action: 'updateCampanha', payload });
  },
  // ===========================================

  iniciarCampanha: async (payload: any): Promise<any> => {
    return await fetchGAS({ action: 'iniciarCampanha', payload }, 120000); 
  },
  getCampanhaDestinatarios: async (campanhaId: string): Promise<any[]> => {
    return fetchGET(`getCampanhaDestinatarios&campanhaId=${campanhaId}`);
  },
  updateCampanhaDestinatario: async (payload: any): Promise<any> => {
    return await fetchGAS({ action: 'updateCampanhaDestinatario', payload });
  }
};