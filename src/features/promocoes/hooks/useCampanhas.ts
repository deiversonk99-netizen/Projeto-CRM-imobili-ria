import { useState, useCallback } from 'react';
import { Campanha, CampanhaDestinatario, DestinatarioStatus } from '../types';
import { useAuth } from '../../../context/AuthContext';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../../store';

export function useCampanhas() {
  const { user } = useAuth();
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCampanhas = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await db.getCampanhas();
      
      // Filtro de proteção contra duplicidades e erros de ID no react
      const deduplicated = [];
      const seen = new Set();
      const sorted = (data || []).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      for (const item of sorted) {
        if (!seen.has(item.id)) {
          seen.add(item.id);
          deduplicated.push(item);
        }
      }
      
      setCampanhas(deduplicated);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar campanhas');
    } finally {
      setLoading(false);
    }
  }, []);

  const saveCampanha = async (
    nome: string, 
    descricao: string, 
    mensagemTemplate: string, 
    filtrosJson: string
  ): Promise<Campanha> => {
    const payload = {
      id: uuidv4(),
      nome,
      descricao,
      mensagemTemplate,
      filtrosJson,
      createdBy: user?.nome || 'Unknown',
      operationId: uuidv4(),
    };

    const data = await db.saveCampanha(payload);
    
    const novaCampanha: Campanha = {
      ...payload,
      status: 'RASCUNHO',
      inicioEm: null,
      fimEm: null,
      audienciaTotal: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: data.version || 1,
    };

    setCampanhas(prev => [...prev, novaCampanha]);
    return novaCampanha;
  };

  const iniciarCampanha = async (campanha: Campanha, destinatarios: Partial<CampanhaDestinatario>[]) => {
    const payload = {
      id: campanha.id,
      expectedVersion: campanha.version,
      operationId: uuidv4(),
      destinatarios: destinatarios.map(d => ({ ...d, id: uuidv4() })),
    };

    try {
      const data = await db.iniciarCampanha(payload);
      setCampanhas(prev => prev.map(c => 
        c.id === campanha.id 
          ? { ...c, status: 'INICIADA', version: data.version, updatedAt: new Date().toISOString() } 
          : c
      ));
    } catch (err: any) {
      if (err.code === 'CAMPAIGN_CONFLICT') {
        throw new Error('Conflito: A campanha foi modificada.');
      }
      throw err;
    }
  };

  // Funções ajustadas para deletar e editar de verdade
  const deleteCampanha = async (id: string) => {
    await db.deleteCampanha(id);
    setCampanhas(prev => prev.filter(c => c.id !== id));
  };

  const updateCampanha = async (id: string, payload: Partial<Campanha>) => {
    await db.updateCampanha({ id, ...payload });
    setCampanhas(prev => prev.map(c => c.id === id ? { ...c, ...payload, updatedAt: new Date().toISOString() } : c));
  };

  return {
    campanhas,
    loading,
    error,
    fetchCampanhas,
    saveCampanha,
    iniciarCampanha,
    deleteCampanha,
    updateCampanha
  };
}

export function useCampanhaDestinatarios(campanhaId: string | null) {
  const [destinatarios, setDestinatarios] = useState<CampanhaDestinatario[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDestinatarios = useCallback(async () => {
    if (!campanhaId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await db.getCampanhaDestinatarios(campanhaId);
      setDestinatarios(data || []);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar destinatários');
    } finally {
      setLoading(false);
    }
  }, [campanhaId]);

  const updateStatus = async (
    destinatarioId: string, 
    expectedVersion: number, 
    status: DestinatarioStatus, 
    extra: Partial<CampanhaDestinatario> = {}
  ) => {
    const payload = {
      id: destinatarioId,
      expectedVersion,
      operationId: uuidv4(),
      status,
      ...extra
    };
    const data = await db.updateCampanhaDestinatario(payload);
    setDestinatarios(prev => prev.map(d => 
      d.id === destinatarioId 
        ? { ...d, status, ...extra, version: data.version } 
        : d
    ));
  };

  return {
    destinatarios,
    loading,
    error,
    fetchDestinatarios,
    updateStatus
  };
}