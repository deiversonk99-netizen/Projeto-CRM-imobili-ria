import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Usuario } from '../types';
import { db } from '../store';

interface AuthContextData {
  user: Usuario | null;
  login: (login: string, senha?: string) => Promise<boolean>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem('@app:user');
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        // Garante que usuários cacheados tenham o mesmo nível de acesso do bypass
        if (!parsed.interfaces?.includes(99)) {
          parsed.interfaces = [1, 2, 3, 4, 5, 99];
        }
        setUser(parsed);
      } catch (e) {
        console.error(e);
      }
    } else {
      // Bypass login for now by providing a mock admin user
      setUser({ id: "0", nome: "Admin (Bypass)", email: "admin@example.com", login: "admin", interfaces: [1, 2, 3, 4, 5, 99] });
    }
    setLoading(false);
  }, []);

  const login = async (loginId: string, senha?: string) => {
    setLoading(true);
    try {
      const users = await db.getUsuarios();
      const foundUser = users.find(u => u.login.toLowerCase() === loginId.toLowerCase() && (!senha || u.senha === senha));
      if (foundUser) {
        setUser(foundUser);
        localStorage.setItem('@app:user', JSON.stringify(foundUser));
        return true;
      }
      return false;
    } catch (e) {
      console.error(e);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('@app:user');
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
