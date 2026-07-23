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
import { DataProvider, useData } from './context/DataContext';
import { ToastProvider } from './components/ui/Toast';

function AppContent() {
  const [activeTab, setActiveTab] = useState('resumo');
  const { loading, error } = useData();

  if (loading) {
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

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      {activeTab === 'resumo' && <Resumo setTab={setActiveTab} />}
      {activeTab === 'cadastro' && <Cadastros />}
      {activeTab === 'aniversarios' && <Aniversarios />}
      {activeTab === 'renovacoes' && <Renovacoes />}
      {activeTab === 'documentos' && <Documentos />}
      {activeTab === 'boletos' && <Boletos />}
    </Layout>
  );
}

export default function App() {
  return (
    <DataProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </DataProvider>
  );
}
