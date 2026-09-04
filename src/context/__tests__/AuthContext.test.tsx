/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from '../AuthContext';

const mocks = vi.hoisted(() => ({
  restoreSession: vi.fn(),
  loginAnonymously: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  userFromAuth: vi.fn(),
  onAuthStateChange: vi.fn(() => () => undefined),
}));

vi.mock('../../store', () => ({ db: mocks }));

const directUser = {
  id: 'anonymous-user',
  nome: 'Acesso direto',
  email: '',
  login: '',
  interfaces: [99],
};

function Probe() {
  const { user, loading, error, retryDirectAccess } = useAuth();
  return (
    <div>
      <span data-testid="status">{loading ? 'loading' : user?.nome || error || 'empty'}</span>
      <button onClick={retryDirectAccess}>retry</button>
    </div>
  );
}

describe('AuthProvider em acesso direto', () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.onAuthStateChange.mockReturnValue(() => undefined);
  });

  it('reaproveita uma sessão válida sem criar outra identidade anônima', async () => {
    mocks.restoreSession.mockResolvedValue(directUser);

    render(<AuthProvider><Probe /></AuthProvider>);

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('Acesso direto'));
    expect(mocks.loginAnonymously).not.toHaveBeenCalled();
  });

  it('cria uma sessão anônima quando o navegador ainda não possui sessão', async () => {
    mocks.restoreSession.mockResolvedValue(null);
    mocks.loginAnonymously.mockResolvedValue(directUser);

    render(<AuthProvider><Probe /></AuthProvider>);

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('Acesso direto'));
    expect(mocks.loginAnonymously).toHaveBeenCalledTimes(1);
  });

  it('permite repetir a inicialização depois de uma falha transitória', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mocks.restoreSession.mockResolvedValue(null);
    mocks.loginAnonymously
      .mockRejectedValueOnce(new Error('Falha temporária'))
      .mockResolvedValueOnce(directUser);

    render(<AuthProvider><Probe /></AuthProvider>);

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('Falha temporária'));
    fireEvent.click(screen.getByRole('button', { name: 'retry' }));
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('Acesso direto'));
    expect(mocks.loginAnonymously).toHaveBeenCalledTimes(2);
    consoleError.mockRestore();
  });
});
