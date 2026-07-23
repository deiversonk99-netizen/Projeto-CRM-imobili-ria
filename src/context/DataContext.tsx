import React, { createContext, useContext, useEffect, useState } from 'react';
import { db } from '../store';
import { Cadastro, ChecklistDocs, TarefaConcluida } from '../types';

interface DataContextProps {
  cadastros: Cadastro[];
  checklists: ChecklistDocs[];
  tarefas: TarefaConcluida[];
  loading: boolean;
  error: string | null;
  refreshData: () => Promise<void>;
  addTarefaLocally: (tarefa: TarefaConcluida) => void;
  removeTarefaLocally: (idTarefa: string) => void;
}

const DataContext = createContext<DataContextProps | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cadastros, setCadastros] = useState<Cadastro[]>([]);
  const [checklists, setChecklists] = useState<ChecklistDocs[]>([]);
  const [tarefas, setTarefas] = useState<TarefaConcluida[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const addTarefaLocally = (tarefa: TarefaConcluida) => {
    setTarefas((prev) => [...prev, tarefa]);
  };

  const removeTarefaLocally = (idTarefa: string) => {
    setTarefas((prev) => prev.filter((t) => t.idTarefa !== idTarefa));
  };

  const refreshData = async () => {
    try {
      setError(null);
      const [cads, checks, tars] = await Promise.all([
        db.getCadastros(),
        db.getChecklists(),
        db.getTarefas(),
      ]);
      setCadastros(cads || []);
      setChecklists(checks || []);
      setTarefas(tars || []);
    } catch (err: any) {
      console.error('Error fetching data', err);
      setError(err.message || 'Falha ao carregar os dados. Verifique a conexão ou a permissão do Apps Script.');
    }
  };

  useEffect(() => {
    refreshData().finally(() => setLoading(false));
  }, []);

  return (
    <DataContext.Provider value={{ cadastros, checklists, tarefas, loading, error, refreshData, addTarefaLocally, removeTarefaLocally }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};
