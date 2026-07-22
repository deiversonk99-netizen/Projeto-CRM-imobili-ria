import { Cadastro, ChecklistDocs, TarefaConcluida } from './types';

const GAS_URL = 'https://script.google.com/macros/s/AKfycbzL4JN0w6Kh_TM_V9A4V4YrgmfFMw-E8grL8ik6-HVsXeAKYc1JgqEQGCrNGUbYO0ou_g/exec';

export const db = {
  getCadastros: async (): Promise<Cadastro[]> => {
    try {
      const response = await fetch(`${GAS_URL}?action=getCadastros`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching cadastros:', error);
      return [];
    }
  },
  
  saveCadastro: async (cadastro: Omit<Cadastro, 'id' | 'dataHora'>): Promise<void> => {
    try {
      await fetch(GAS_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'text/plain',
        },
        body: JSON.stringify({ action: 'saveCadastro', data: cadastro }),
      });
    } catch (error) {
      console.error('Error saving cadastro:', error);
      throw error;
    }
  },

  getChecklists: async (): Promise<ChecklistDocs[]> => {
    try {
      const response = await fetch(`${GAS_URL}?action=getChecklists`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching checklists:', error);
      return [];
    }
  },

  updateChecklist: async (checklist: ChecklistDocs): Promise<void> => {
    try {
      await fetch(GAS_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'text/plain',
        },
        body: JSON.stringify({ action: 'updateChecklist', data: checklist }),
      });
    } catch (error) {
      console.error('Error updating checklist:', error);
      throw error;
    }
  },

  getTarefas: async (): Promise<TarefaConcluida[]> => {
    try {
      const response = await fetch(`${GAS_URL}?action=getTarefas`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching tarefas:', error);
      return [];
    }
  },

  saveTarefa: async (tarefa: Omit<TarefaConcluida, 'idTarefa' | 'dataConclusao'>): Promise<void> => {
    try {
      await fetch(GAS_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'text/plain',
        },
        body: JSON.stringify({ action: 'saveTarefa', data: tarefa }),
      });
    } catch (error) {
      console.error('Error saving tarefa:', error);
      throw error;
    }
  }
};
