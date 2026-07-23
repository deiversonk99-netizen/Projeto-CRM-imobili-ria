import { Cadastro, ChecklistDocs, TarefaConcluida } from './types';

const GAS_URL = 'https://script.google.com/macros/s/AKfycbzL4JN0w6Kh_TM_V9A4V4YrgmfFMw-E8grL8ik6-HVsXeAKYc1JgqEQGCrNGUbYO0ou_g/exec';

async function fetchGAS(payload: any) {
  const response = await fetch(GAS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify(payload),
  });
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  const data = await response.json();
  if (data.error) {
    throw new Error(data.error);
  }
  return data;
}

export const db = {
  getCadastros: async (): Promise<Cadastro[]> => {
    const response = await fetch(`${GAS_URL}?action=getCadastros`);
    if (!response.ok) throw new Error('Failed to fetch cadastros');
    const data = await response.json();
    if (data.error) throw new Error(data.error);
    return data;
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
    const response = await fetch(`${GAS_URL}?action=getChecklists`);
    if (!response.ok) throw new Error('Failed to fetch checklists');
    const data = await response.json();
    if (data.error) throw new Error(data.error);
    return data;
  },

  updateChecklist: async (checklist: ChecklistDocs): Promise<void> => {
    await fetchGAS({ action: 'updateChecklist', data: checklist });
  },

  getTarefas: async (): Promise<TarefaConcluida[]> => {
    const response = await fetch(`${GAS_URL}?action=getTarefas`);
    if (!response.ok) throw new Error('Failed to fetch tarefas');
    const data = await response.json();
    if (data.error) throw new Error(data.error);
    return data;
  },

  saveTarefa: async (tarefa: Omit<TarefaConcluida, 'idTarefa' | 'dataConclusao'>): Promise<void> => {
    await fetchGAS({ action: 'saveTarefa', data: tarefa });
  },

  deleteTarefa: async (idTarefa: string): Promise<void> => {
    await fetchGAS({ action: 'deleteTarefa', id: idTarefa });
  }
};
