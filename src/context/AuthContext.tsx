import React, { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import localforage from 'localforage';
import { db } from '../store';
import type { Usuario } from '../types';

interface AuthContextData {
  user: Usuario | null;
  login: (login: string, senha: string) => Promise<boolean>;
  logout: () => void;
  loading: boolean;
  error: string | null;
  retryDirectAccess: () => void;
}

const AuthContext = createContext<AuthContextData | undefined>(undefined);

function clearLocalWorkQueues() {
  Object.keys(localStorage)
    .filter(key => key.startsWith('@campaign:') || key.startsWith('@cobranca:operation:'))
    .forEach(key => localStorage.removeItem(key));
  void localforage.clear();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const initializeDirectAccess = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let restoredUser: Usuario | null = null;
      try {
        restoredUser = await db.restoreSession();
      } catch (restoreError) {
        console.warn('Sessão anterior inválida; iniciando uma nova sessão direta.', restoreError);
        await db.logout().catch(() => undefined);
      }
      const directUser = restoredUser || await db.loginAnonymously();
      setUser(directUser);
    } catch (accessError) {
      console.error('Falha ao iniciar o acesso direto do Supabase', accessError);
      setUser(null);
      setError(accessError instanceof Error
        ? accessError.message
        : 'Não foi possível iniciar o acesso direto ao sistema.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    void initializeDirectAccess();

    const unsubscribe = db.onAuthStateChange(authUser => {
      if (!active) return;
      if (!authUser) {
        setUser(null);
        return;
      }
      // Evita executar outra chamada do cliente dentro do callback interno do Auth.
      window.setTimeout(() => {
        void db.userFromAuth(authUser)
          .then(profile => {
            if (active) {
              setUser(profile);
              setError(null);
            }
          })
          .catch(error => {
            console.error('Sessão sem perfil ativo', error);
            if (active) {
              setUser(null);
              setError(error instanceof Error ? error.message : 'Sessão sem perfil ativo.');
            }
          })
          .finally(() => { if (active) setLoading(false); });
      }, 0);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [initializeDirectAccess]);

  useEffect(() => {
    const handleUnauthorized = () => {
      setUser(null);
      setError('A sessão de acesso direto expirou. Tente conectar novamente.');
      clearLocalWorkQueues();
      void db.logout();
    };
    window.addEventListener('app:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('app:unauthorized', handleUnauthorized);
  }, []);

  const login = async (loginId: string, senha: string) => {
    setLoading(true);
    try {
      const response = await db.login(loginId, senha);
      setUser(response.user);
      setError(null);
      return true;
    } catch (error) {
      console.error(error);
      setUser(null);
      setError(error instanceof Error ? error.message : 'Falha ao autenticar.');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    clearLocalWorkQueues();
    void db.logout().catch(error => console.error('Falha ao encerrar a sessão', error));
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, error, retryDirectAccess: initializeDirectAccess }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
