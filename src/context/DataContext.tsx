import React, { createContext, useContext, useEffect, useState } from 'react';
import { db } from '../store';
import { Cadastro, ChecklistDocs, TarefaConcluida } from '../types';

interface DataContextProps {
  cadastros: Cadastro[];
  checklists: ChecklistDocs[];
  tarefas: TarefaConcluida[];
  loading: boolean;
  refreshData: () => Promise<void>;
}

const DataContext = createContext<DataContextProps | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cadastros, setCadastros] = useState<Cadastro[]>([]);
  const [checklists, setChecklists] = useState<ChecklistDocs[]>([]);
  const [tarefas, setTarefas] = useState<TarefaConcluida[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshData = async () => {
    setLoading(true);
    try {
      const [cads, checks, tars] = await Promise.all([
        db.getCadastros(),
        db.getChecklists(),
        db.getTarefas(),
      ]);
      setCadastros(cads || []);
      setChecklists(checks || []);
      setTarefas(tars || []);
    } catch (error) {
      console.error('Error fetching data', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  return (
    <DataContext.Provider value={{ cadastros, checklists, tarefas, loading, refreshData }}>
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
