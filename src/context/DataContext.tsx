import React, { createContext, useContext, useEffect, useState } from 'react';
import { db } from '../store';
import { Cadastro, ChecklistDocs, TarefaConcluida, Condominio, Cobranca } from '../types';

interface DataContextProps {
  cadastros: Cadastro[];
  checklists: ChecklistDocs[];
  tarefas: TarefaConcluida[];
  condominios: Condominio[];
  cobrancas: Cobranca[];
  loading: boolean;
  error: string | null;
  refreshData: () => Promise<any>;
  addTarefaLocally: (tarefa: TarefaConcluida) => void;
  removeTarefaLocally: (idTarefa: string) => void;
}

const DataContext = createContext<DataContextProps | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cadastros, setCadastros] = useState<Cadastro[]>([]);
  const [checklists, setChecklists] = useState<ChecklistDocs[]>([]);
  const [tarefas, setTarefas] = useState<TarefaConcluida[]>([]);
  const [condominios, setCondominios] = useState<Condominio[]>([]);
  const [cobrancas, setCobrancas] = useState<Cobranca[]>([]);
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
      const [cads, checks, tars, conds, cobs] = await Promise.all([
        db.getCadastros(),
        db.getChecklists(),
        db.getTarefas(),
        db.getCondominios(),
        db.getCobrancas()
      ]);
      setCadastros(cads || []);
      setChecklists(checks || []);
      setTarefas(tars || []);
      setCondominios(conds || []);
      
      // Deduplicate cobrancas based on contrato + competencia + vencimento
      const uniqueCobs = Array.from(
        new Map(
          (cobs || []).map(c => [`${c.contrato}-${c.competencia}-${c.vencimento}`, c])
        ).values()
      );
      setCobrancas(uniqueCobs);

      return { cads, checks, tars, conds, cobs };
    } catch (err: any) {
      console.error('Error fetching data', err);
      setError(err.message || 'Falha ao carregar os dados. Verifique a conexão ou a permissão do Apps Script.');
    }
  };

  useEffect(() => {
    refreshData().finally(() => setLoading(false));
  }, []);

  return (
    <DataContext.Provider value={{ cadastros, checklists, tarefas, condominios, cobrancas, loading, error, refreshData, addTarefaLocally, removeTarefaLocally }}>
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
