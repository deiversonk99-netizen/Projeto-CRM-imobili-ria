import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import localforage from 'localforage';
import { db } from '../store';
import type { Usuario } from '../types';

interface AuthContextData {
  user: Usuario | null;
  login: (login: string, senha: string) => Promise<boolean>;
  logout: () => void;
  loading: boolean;
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

  useEffect(() => {
    let active = true;

    void db.restoreSession()
      .then(restoredUser => {
        if (active) setUser(restoredUser);
      })
      .catch(error => {
        console.error('Falha ao restaurar a sessão do Supabase', error);
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    const unsubscribe = db.onAuthStateChange(authUser => {
      if (!active) return;
      if (!authUser) {
        setUser(null);
        setLoading(false);
        return;
      }
      // Evita executar outra chamada do cliente dentro do callback interno do Auth.
      window.setTimeout(() => {
        void db.userFromAuth(authUser)
          .then(profile => { if (active) setUser(profile); })
          .catch(error => {
            console.error('Sessão sem perfil ativo', error);
            if (active) setUser(null);
          })
          .finally(() => { if (active) setLoading(false); });
      }, 0);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const handleUnauthorized = () => {
      setUser(null);
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
      return true;
    } catch (error) {
      console.error(error);
      setUser(null);
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
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
