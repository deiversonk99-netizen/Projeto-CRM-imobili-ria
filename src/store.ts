import { Cadastro, ChecklistDocs, TarefaConcluida, Usuario } from './types';

const GAS_URL = 'https://script.google.com/macros/s/AKfycbzL4JN0w6Kh_TM_V9A4V4YrgmfFMw-E8grL8ik6-HVsXeAKYc1JgqEQGCrNGUbYO0ou_g/exec';

async function fetchGAS(payload: any) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  
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
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    if (data.error) {
      throw new Error(data.error);
    }
    return data;
  } finally {
    clearTimeout(timeoutId);
  }
}

export const db = {
  getUsuarios: async (): Promise<Usuario[]> => {
    try {
      const response = await fetch(`${GAS_URL}?action=getUsuarios`, { credentials: 'omit' });
      if (!response.ok) throw new Error('Failed to fetch usuarios');
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      const users = data;
      // ensure we have the users
      if (Array.isArray(users)) return users;
      return [];
    } catch (e) {
      console.warn("getUsuarios fallback used", e);
      return [
        { id: "1", nome: "João Silva", email: "joao@example.com", login: "joao", senha: "123", interfaces: [1, 3] },
        { id: "2", nome: "Admin", email: "admin@example.com", login: "admin", senha: "123", interfaces: [1, 2, 3, 4, 5, 99] }
      ];
    }
  },
  getCadastros: async (): Promise<Cadastro[]> => {
    try {
      const response = await fetch(`${GAS_URL}?action=getCadastros`, { credentials: 'omit' });
      if (!response.ok) throw new Error(`Failed to fetch cadastros: ${response.status} ${response.statusText}`);
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      return data;
    } catch (e) {
      console.warn("getCadastros fallback used", e);
      return []; // Return empty array or fallback data
    }
  },
  
  saveCadastro: async (cadastro: Omit<Cadastro, 'id' | 'dataHora'>): Promise<void> => {
    await fetchGAS({ action: 'saveCadastro', data: cadastro });
  },

  updateCadastro: async (cadastro: Cadastro): Promise<void> => {
    await fetchGAS({ action: 'updateCadastro', data: cadastro });
  },

  deleteCadastro: async (id: string): Promise<void> => {
    await fetchGAS({ action: 'deleteCadastro', id });
  },

  getChecklists: async (): Promise<ChecklistDocs[]> => {
    try {
      const response = await fetch(`${GAS_URL}?action=getChecklists`, { credentials: 'omit' });
      if (!response.ok) throw new Error(`Failed to fetch checklists: ${response.status} ${response.statusText}`);
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      return data;
    } catch (e) {
      console.warn("getChecklists fallback used", e);
      return []; // Return empty array or fallback data
    }
  },

  updateChecklist: async (checklist: ChecklistDocs): Promise<void> => {
    await fetchGAS({ action: 'updateChecklist', data: checklist });
  },

  getTarefas: async (): Promise<TarefaConcluida[]> => {
    try {
      const response = await fetch(`${GAS_URL}?action=getTarefas`, { credentials: 'omit' });
      if (!response.ok) throw new Error(`Failed to fetch tarefas: ${response.status} ${response.statusText}`);
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      return data;
    } catch (e) {
      console.warn("getTarefas fallback used", e);
      return [];
    }
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
  }
};
