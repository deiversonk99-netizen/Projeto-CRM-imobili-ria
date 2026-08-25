import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Usuario } from '../types';
import localforage from 'localforage';
import { clearAuthToken, db, setAuthToken } from '../store';

interface AuthContextData {
  user: Usuario | null;
  login: (login: string, senha: string) => Promise<boolean>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

function clearLocalSession() {
  localStorage.removeItem('@app:user');
  clearAuthToken();
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
    const restoreSession = async () => {
      const storedUser = localStorage.getItem('@app:user');
      const storedToken = localStorage.getItem('@app:auth-token');
      if (storedUser && storedToken) {
        try {
          if (active) setUser(JSON.parse(storedUser) as Usuario);
          if (active) setLoading(false);
          return;
        } catch (e) {
          console.error(e);
          localStorage.removeItem('@app:user');
          clearAuthToken();
        }
      }

      try {
        const response = await db.legacyLogin();
        if (!active || !response.transitionMode) return;
        setAuthToken(response.token);
        setUser(response.user);
        localStorage.setItem('@app:user', JSON.stringify(response.user));
      } catch (e) {
        // A autenticação já está configurada: a tela de login será exibida.
      } finally {
        if (active) setLoading(false);
      }
    };

    void restoreSession();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const handleUnauthorized = () => {
      setUser(null);
      clearLocalSession();
    };
    window.addEventListener('app:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('app:unauthorized', handleUnauthorized);
  }, []);

  const login = async (loginId: string, senha: string) => {
    setLoading(true);
    try {
      const response = await db.login(loginId, senha);
      setAuthToken(response.token);
      setUser(response.user);
      localStorage.setItem('@app:user', JSON.stringify(response.user));
      return true;
    } catch (e) {
      console.error(e);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    clearLocalSession();
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
