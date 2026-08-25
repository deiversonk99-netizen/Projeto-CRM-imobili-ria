import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { db } from '../store';
import { Cadastro, ChecklistDocs, TarefaConcluida, Condominio, Cobranca } from '../types';
import { useAuth } from './AuthContext';

interface DataContextProps {
  cadastros: Cadastro[];
  checklists: ChecklistDocs[];
  tarefas: TarefaConcluida[];
  condominios: Condominio[];
  cobrancas: Cobranca[];
  loading: boolean;
  error: string | null;
  warnings: string[];
  refreshData: () => Promise<{ cads: Cadastro[]; checks: ChecklistDocs[]; tars: TarefaConcluida[]; conds: Condominio[]; cobs: Cobranca[] } | undefined>;
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
  const [warnings, setWarnings] = useState<string[]>([]);
  const hasLoadedRef = useRef(false);
  const refreshPromiseRef = useRef<ReturnType<DataContextProps['refreshData']> | null>(null);
  const { user } = useAuth();

  const addTarefaLocally = (tarefa: TarefaConcluida) => {
    setTarefas((prev) => [...prev, tarefa]);
  };

  const removeTarefaLocally = (idTarefa: string) => {
    setTarefas((prev) => prev.filter((t) => t.idTarefa !== idTarefa));
  };

  const refreshData: DataContextProps['refreshData'] = () => {
    if (!user) return Promise.resolve(undefined);
    if (refreshPromiseRef.current) return refreshPromiseRef.current;

    const showInitialLoader = !hasLoadedRef.current;
    const request = (async () => {
      try {
        if (showInitialLoader) setLoading(true);
        setError(null);
        setWarnings([]);
        const hasAccess = (interfaceId: number) => user.interfaces.includes(99) || user.interfaces.includes(interfaceId);
        const results = await Promise.allSettled([
          db.getCadastros(),
          hasAccess(4) ? db.getChecklists() : Promise.resolve([] as ChecklistDocs[]),
          hasAccess(2) ? db.getTarefas() : Promise.resolve([] as TarefaConcluida[]),
          hasAccess(1) || hasAccess(6) ? db.getCondominios() : Promise.resolve([] as Condominio[]),
          hasAccess(5) ? db.getCobrancas() : Promise.resolve([] as Cobranca[]),
        ]);
        if (results[0].status === 'rejected') throw results[0].reason;
        const cads = results[0].value as Cadastro[];
        const checks = results[1].status === 'fulfilled' ? results[1].value as ChecklistDocs[] : [];
        const tars = results[2].status === 'fulfilled' ? results[2].value as TarefaConcluida[] : [];
        const conds = results[3].status === 'fulfilled' ? results[3].value as Condominio[] : [];
        const cobs = results[4].status === 'fulfilled' ? results[4].value as Cobranca[] : [];
        const partialWarnings = results.slice(1).flatMap((result, index) =>
          result.status === 'rejected' ? [`Falha ao carregar ${['checklists', 'tarefas', 'condomínios', 'cobranças'][index]}.`] : [],
        );

        const chargeKeys = new Set<string>();
        const duplicateCharges = cobs.filter(cobranca => {
          const identity = String(cobranca.contrato || cobranca.cadastroId || '').trim().toLowerCase();
          const key = `${identity}-${cobranca.competencia}`;
          if (chargeKeys.has(key)) return true;
          chargeKeys.add(key);
          return false;
        });
        if (duplicateCharges.length > 0) {
          partialWarnings.push(`Foram encontradas ${duplicateCharges.length} cobranças duplicadas na base. Nenhum registro foi ocultado.`);
        }
        setWarnings(partialWarnings);
        setCadastros(cads || []);
        setChecklists(checks || []);
        setTarefas(tars || []);
        setCondominios(conds || []);
        setCobrancas(cobs || []);

        return { cads, checks, tars, conds, cobs };
      } catch (err: unknown) {
        console.error('Error fetching data', err);
        setError(err instanceof Error ? err.message : 'Falha ao carregar os dados. Verifique a conexão ou a permissão do Apps Script.');
        return undefined;
      } finally {
        hasLoadedRef.current = true;
        refreshPromiseRef.current = null;
        if (showInitialLoader) setLoading(false);
      }
    })();

    refreshPromiseRef.current = request;
    return request;
  };

  useEffect(() => {
    if (user) void refreshData();
    else {
      hasLoadedRef.current = false;
      refreshPromiseRef.current = null;
      setCadastros([]);
      setChecklists([]);
      setTarefas([]);
      setCondominios([]);
      setCobrancas([]);
      setWarnings([]);
      setError(null);
      setLoading(false);
    }
  }, [user]);

  return (
    <DataContext.Provider value={{ cadastros, checklists, tarefas, condominios, cobrancas, loading, error, warnings, refreshData, addTarefaLocally, removeTarefaLocally }}>
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
