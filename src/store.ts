import { Cadastro, ChecklistDocs, TarefaConcluida } from './types';

const STORAGE_KEYS = {
  CADASTROS: 'gas_cadastros',
  CHECKLISTS: 'gas_checklists',
  TAREFAS: 'gas_tarefas',
};

// Simulate Google Sheets backend with LocalStorage
export const db = {
  getCadastros: (): Cadastro[] => {
    const data = localStorage.getItem(STORAGE_KEYS.CADASTROS);
    return data ? JSON.parse(data) : [];
  },
  
  saveCadastro: (cadastro: Omit<Cadastro, 'id' | 'dataHora'>): Promise<void> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const cadastros = db.getCadastros();
        const id = Math.random().toString(36).substr(2, 9).toUpperCase();
        const dataHora = new Date().toISOString();
        
        const novoCadastro: Cadastro = {
          ...cadastro,
          id,
          dataHora,
        };
        
        cadastros.push(novoCadastro);
        localStorage.setItem(STORAGE_KEYS.CADASTROS, JSON.stringify(cadastros));
        
        // Auto-create checklist
        const checklists = db.getChecklists();
        checklists.push({
          id,
          contrato: cadastro.contrato,
          prop_contratoEnviado: false,
          prop_vistoriaEnviada: false,
          inq_manualEntregue: false,
          inq_vistoriaAssinada: false,
          inq_seguroIncendio: false,
        });
        localStorage.setItem(STORAGE_KEYS.CHECKLISTS, JSON.stringify(checklists));
        
        resolve();
      }, 800); // Simulate network delay
    });
  },

  getChecklists: (): ChecklistDocs[] => {
    const data = localStorage.getItem(STORAGE_KEYS.CHECKLISTS);
    return data ? JSON.parse(data) : [];
  },

  updateChecklist: (checklist: ChecklistDocs): Promise<void> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const checklists = db.getChecklists();
        const index = checklists.findIndex((c) => c.id === checklist.id);
        if (index > -1) {
          checklists[index] = checklist;
          localStorage.setItem(STORAGE_KEYS.CHECKLISTS, JSON.stringify(checklists));
        }
        resolve();
      }, 500);
    });
  },

  getTarefas: (): TarefaConcluida[] => {
    const data = localStorage.getItem(STORAGE_KEYS.TAREFAS);
    return data ? JSON.parse(data) : [];
  },

  saveTarefa: (tarefa: Omit<TarefaConcluida, 'idTarefa' | 'dataConclusao'>): Promise<void> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const tarefas = db.getTarefas();
        const idTarefa = Math.random().toString(36).substr(2, 9).toUpperCase();
        const dataConclusao = new Date().toISOString();
        
        tarefas.push({
          ...tarefa,
          idTarefa,
          dataConclusao,
        });
        
        localStorage.setItem(STORAGE_KEYS.TAREFAS, JSON.stringify(tarefas));
        resolve();
      }, 500);
    });
  }
};
