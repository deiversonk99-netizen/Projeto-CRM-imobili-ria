/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import Layout from './components/Layout';
import Cadastros from './pages/Cadastros';
import Aniversarios from './pages/Aniversarios';
import Documentos from './pages/Documentos';
import Boletos from './pages/Boletos';
import { DataProvider, useData } from './context/DataContext';
import { ToastProvider } from './components/ui/Toast';

function AppContent() {
  const [activeTab, setActiveTab] = useState('cadastro');
  const { loading } = useData();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center font-sans">
        <div className="w-16 h-16 border-4 border-[#3a5a40] border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-[#3a5a40] font-medium text-lg">Carregando dados do servidor...</p>
      </div>
    );
  }

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      {activeTab === 'cadastro' && <Cadastros />}
      {activeTab === 'aniversarios' && <Aniversarios />}
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
