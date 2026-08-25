/**
 * @vitest-environment jsdom
 */
import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DataProvider, useData } from '../DataContext';
import { db } from '../../store';

vi.mock('../../store', () => ({
  db: {
    getCadastros: vi.fn(),
    getChecklists: vi.fn(),
    getTarefas: vi.fn(),
    getCondominios: vi.fn(),
    getCobrancas: vi.fn(),
  },
}));

vi.mock('../AuthContext', () => {
  const user = {
    user: { login: 'admin', nome: 'Admin', email: '', interfaces: [99] },
  };
  return { useAuth: () => user };
});

let refreshFromProbe: ReturnType<typeof useData>['refreshData'];

function Probe() {
  const context = useData();
  refreshFromProbe = context.refreshData;
  return <span data-testid="loading-state">{context.loading ? 'loading' : 'ready'}</span>;
}

function resolvedDataset() {
  vi.mocked(db.getCadastros).mockResolvedValue([]);
  vi.mocked(db.getChecklists).mockResolvedValue([]);
  vi.mocked(db.getTarefas).mockResolvedValue([]);
  vi.mocked(db.getCondominios).mockResolvedValue([]);
  vi.mocked(db.getCobrancas).mockResolvedValue([]);
}

describe('DataProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolvedDataset();
  });

  it('mantém a interface montada durante uma atualização em segundo plano', async () => {
    render(
      <DataProvider>
        <Probe />
      </DataProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('loading-state').textContent).toBe('ready'));

    vi.mocked(db.getCadastros).mockImplementationOnce(async () => {
      await new Promise(resolve => window.setTimeout(resolve, 50));
      return [];
    });

    let refreshPromise!: ReturnType<typeof refreshFromProbe>;
    act(() => {
      refreshPromise = refreshFromProbe();
    });

    expect(screen.getByTestId('loading-state').textContent).toBe('ready');

    await act(async () => {
      await refreshPromise;
    });

    expect(screen.getByTestId('loading-state').textContent).toBe('ready');
  });
});
