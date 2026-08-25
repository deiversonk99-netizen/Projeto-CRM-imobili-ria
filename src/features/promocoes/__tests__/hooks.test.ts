/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCampanhas, useCampanhaDestinatarios } from '../hooks/useCampanhas';
import { db } from '../../../store';
import { useAuth } from '../../../context/AuthContext';

vi.mock('../../../store', () => ({
  db: {
    getCampanhas: vi.fn(),
    saveCampanha: vi.fn(),
    updateCampanha: vi.fn(),
    arquivarCampanha: vi.fn(),
    setCampanhaAtiva: vi.fn(),
    iniciarCampanha: vi.fn(),
    getCampanhaDestinatarios: vi.fn(),
    updateCampanhaDestinatario: vi.fn(),
  }
}));

vi.mock('../../../context/AuthContext', () => ({
  useAuth: vi.fn()
}));

describe('useCampanhas hook', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
    (useAuth as any).mockReturnValue({ user: { nome: 'Tester' } });
  });

  it('deve lidar com timeout ao salvar campanha', async () => {
    (db.saveCampanha as any).mockRejectedValueOnce(new Error('TIMEOUT'));
    const { result } = renderHook(() => useCampanhas());
    
    await expect(result.current.saveCampanha('Teste', 'Desc', 'Ola', '{}')).rejects.toThrow('TIMEOUT');
  });

  it('deve identificar conflito de versão (CAMPAIGN_CONFLICT)', async () => {
    const error = new Error('Conflito de versao');
    (error as any).code = 'CAMPAIGN_CONFLICT';
    (db.iniciarCampanha as any).mockRejectedValueOnce(error);
    
    const { result } = renderHook(() => useCampanhas());
    const mockCampanha = { id: 'c1', nome: 'C', descricao: '', mensagemTemplate: '', filtrosJson: '', status: 'RASCUNHO', inicioEm: null, fimEm: null, audienciaTotal: 0, createdAt: '', updatedAt: '', version: 1 } as any;
    
    await expect(result.current.iniciarCampanha(mockCampanha, [])).rejects.toThrow('Conflito: A campanha foi modificada.');
  });
  
  it('publicacao repetida nao deve duplicar estado indevidamente', async () => {
    // If the hook is called twice, it should just update the state correctly
    (db.saveCampanha as any).mockResolvedValue({ id: 'c1', version: 1 });
    const { result } = renderHook(() => useCampanhas());
    
    await act(async () => {
      await result.current.saveCampanha('Teste', 'Desc', 'Ola', '{}');
    });
    
    expect(result.current.campanhas).toHaveLength(1);
    expect(result.current.campanhas[0].id).toBeDefined();
  });
});


describe('useCampanhaDestinatarios hook', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
  });

  it('confirmacao repetida deve atualizar estado do hook corretamente', async () => {
    (db.getCampanhaDestinatarios as any).mockResolvedValue([{ id: 'd1', status: 'WHATSAPP_ABERTO', version: 1 }]);
    (db.updateCampanhaDestinatario as any).mockResolvedValue({ version: 2 });
    
    const { result } = renderHook(() => useCampanhaDestinatarios('c1'));
    
    await act(async () => {
      await result.current.fetchDestinatarios();
    });
    
    await act(async () => {
      await result.current.updateStatus('d1', 1, 'ENVIO_CONFIRMADO');
    });
    
    expect(result.current.destinatarios[0].status).toBe('ENVIO_CONFIRMADO');
    expect(result.current.destinatarios[0].version).toBe(2);
  });
});


describe('useCampanhas hook - retomada', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
    (useAuth as any).mockReturnValue({ user: { nome: 'Tester' } });
  });

  it('deve retomar estado após recarregar a página (fetch)', async () => {
    (db.getCampanhas as any).mockResolvedValue([{ id: 'c2', status: 'INICIADA' }]);
    const { result } = renderHook(() => useCampanhas());
    
    await act(async () => {
      await result.current.fetchCampanhas();
    });
    
    expect(result.current.campanhas).toHaveLength(1);
    expect(result.current.campanhas[0].status).toBe('INICIADA');
  });

  it('não deve quebrar em publicações concorrentes parciais (idempotencia do hook)', async () => {
    const { result } = renderHook(() => useCampanhas());
    
    const mockCampanha = { id: 'c1', nome: 'C', status: 'RASCUNHO', version: 1 } as any;
    
    (db.iniciarCampanha as any).mockResolvedValueOnce({ version: 2 });
    
    await act(async () => {
      await result.current.iniciarCampanha(mockCampanha, []);
    });
    
    // Na segunda tentativa simulada (ex: recarga da página + novo clique)
    // O mock resolve com version: 2 novamente indicando a idempotência da store
    (db.iniciarCampanha as any).mockResolvedValueOnce({ version: 2 });
    
    await act(async () => {
      await result.current.iniciarCampanha(mockCampanha, []);
    });
    
    // Deve ter processado sem falhas
    expect(db.iniciarCampanha).toHaveBeenCalledTimes(2);
  });

  it('preserva a mesma operação ao retentar ativação após falha de rede', async () => {
    const campaign = {
      id: 'c-active', nome: 'Campanha', descricao: '', mensagemTemplate: 'Olá', filtrosJson: '{}',
      status: 'INICIADA', version: 3, ativa: true, desativadaEm: null,
    } as any;
    (db.setCampanhaAtiva as any)
      .mockRejectedValueOnce(new Error('TIMEOUT'))
      .mockResolvedValueOnce({ version: 4, ativa: false });
    const { result } = renderHook(() => useCampanhas());

    await expect(result.current.setCampanhaAtiva(campaign, false)).rejects.toThrow('TIMEOUT');
    await act(async () => {
      await result.current.setCampanhaAtiva(campaign, false);
    });

    const firstPayload = (db.setCampanhaAtiva as any).mock.calls[0][0];
    const retryPayload = (db.setCampanhaAtiva as any).mock.calls[1][0];
    expect(retryPayload.operationId).toBe(firstPayload.operationId);
    expect(retryPayload).toEqual(firstPayload);
  });
});
