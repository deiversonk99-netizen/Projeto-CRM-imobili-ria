/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import Layout from './components/Layout';
import Resumo from './pages/Resumo';
import Cadastros from './pages/Cadastros';
import Aniversarios from './pages/Aniversarios';
import Renovacoes from './pages/Renovacoes';
import Documentos from './pages/Documentos';
import Boletos from './pages/Boletos';
import Promocoes from './pages/Promocoes';
import Login from './pages/Login';
import { DataProvider, useData } from './context/DataContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './components/ui/Toast';

function AppContent() {
  const [activeTab, setActiveTab] = useState('resumo');
  const { loading: dataLoading, error } = useData();
  const { user, loading: authLoading } = useAuth();

  const { cadastros } = useData();

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center font-sans">
        <div className="w-16 h-16 border-4 border-[#3a5a40] border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-[#3a5a40] font-medium text-lg">Verificando acesso...</p>
      </div>
    );
  }

  // Bypass login for now
  // if (!user) {
  //   return <Login />;
  // }

  if (dataLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center font-sans">
        <div className="w-16 h-16 border-4 border-[#3a5a40] border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-[#3a5a40] font-medium text-lg">Carregando dados do servidor...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center font-sans p-6 text-center">
        <div className="w-16 h-16 flex items-center justify-center rounded-full bg-red-100 text-red-600 mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">Erro ao carregar dados</h2>
        <p className="text-slate-600 max-w-md">{error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="mt-6 px-4 py-2 bg-[#3a5a40] text-white rounded-lg hover:bg-[#2c4532] transition-colors"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  // Filter allowed tabs for the user (resumo is 0 or always allowed, let's keep it simple for now)
  const allowedTabs = user?.interfaces || [];
  const hasAccess = (tabId: number) => allowedTabs.includes(tabId) || allowedTabs.includes(99);

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      {activeTab === 'resumo' && <Resumo setTab={setActiveTab} />}
      {activeTab === 'cadastro' && hasAccess(1) && <Cadastros />}
      {activeTab === 'aniversarios' && hasAccess(2) && <Aniversarios />}
      {activeTab === 'renovacoes' && hasAccess(3) && <Renovacoes />}
      {activeTab === 'documentos' && hasAccess(4) && <Documentos />}
      {activeTab === 'boletos' && hasAccess(5) && <Boletos />}
      {activeTab === 'promocoes' && <Promocoes cadastros={cadastros} />}
      
      {/* Fallback for unauthorized access to a tab */}
      {activeTab !== 'resumo' && (
        (activeTab === 'cadastro' && !hasAccess(1)) ||
        (activeTab === 'aniversarios' && !hasAccess(2)) ||
        (activeTab === 'renovacoes' && !hasAccess(3)) ||
        (activeTab === 'documentos' && !hasAccess(4)) ||
        (activeTab === 'boletos' && !hasAccess(5)) ||
        false /* Promocoes is open for everyone */
      ) && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
          </div>
          <h2 className="text-xl font-bold text-slate-800">Acesso Negado</h2>
          <p className="text-slate-500 mt-2">Você não tem permissão para acessar esta interface.</p>
          <button onClick={() => setActiveTab('resumo')} className="mt-6 px-4 py-2 bg-[#3a5a40] text-white rounded-lg hover:bg-[#2c4532]">Voltar para o Resumo</button>
        </div>
      )}
    </Layout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <DataProvider>
        <ToastProvider>
          <AppContent />
        </ToastProvider>
      </DataProvider>
    </AuthProvider>
  );
}
