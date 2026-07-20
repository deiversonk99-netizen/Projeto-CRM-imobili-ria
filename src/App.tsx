/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import Layout from './components/Layout';
import NovoCadastro from './pages/NovoCadastro';
import Aniversarios from './pages/Aniversarios';
import Documentos from './pages/Documentos';
import Boletos from './pages/Boletos';

export default function App() {
  const [activeTab, setActiveTab] = useState('cadastro');

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      {activeTab === 'cadastro' && <NovoCadastro />}
      {activeTab === 'aniversarios' && <Aniversarios />}
      {activeTab === 'documentos' && <Documentos />}
      {activeTab === 'boletos' && <Boletos />}
    </Layout>
  );
}
