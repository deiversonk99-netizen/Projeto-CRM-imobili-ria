import React, { useState } from 'react';
import { db } from '../store';
import { Cadastro } from '../types';
import { Save, Loader2, CheckCircle2 } from 'lucide-react';

export default function NovoCadastro() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  
  const [formData, setFormData] = useState<Omit<Cadastro, 'id' | 'dataHora'>>({
    contrato: '',
    nomeProp: '',
    telProp: '',
    niverProp: '',
    nomeInq: '',
    telInq: '',
    niverInq: '',
    inicioContrato: '',
    fimContrato: '',
    corretor: '',
    diaVencimento: 1,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'diaVencimento' ? parseInt(value) || 1 : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(false);
    try {
      await db.saveCadastro(formData);
      setSuccess(true);
      setFormData({
        contrato: '',
        nomeProp: '',
        telProp: '',
        niverProp: '',
        nomeInq: '',
        telInq: '',
        niverInq: '',
        inicioContrato: '',
        fimContrato: '',
        corretor: '',
        diaVencimento: 1,
      });
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      alert('Erro ao salvar os dados.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-800">Novo Contrato de Locação</h2>
        {success && (
          <span className="flex items-center text-sm font-medium text-green-600 bg-green-50 px-3 py-1 rounded-full">
            <CheckCircle2 className="w-4 h-4 mr-1" />
            Salvo com sucesso!
          </span>
        )}
      </div>
      
      <form onSubmit={handleSubmit} className="p-6 space-y-8">
        {/* Contrato e Base */}
        <div>
          <h3 className="text-sm font-medium text-gray-900 mb-4 pb-2 border-b">Dados do Contrato</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nº do Contrato</label>
              <input required type="text" name="contrato" value={formData.contrato} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow" placeholder="Ex: 2023-001" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Corretor Responsável</label>
              <input required type="text" name="corretor" value={formData.corretor} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Início do Contrato</label>
              <input required type="date" name="inicioContrato" value={formData.inicioContrato} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Término do Contrato</label>
              <input required type="date" name="fimContrato" value={formData.fimContrato} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Dia Venc. Aluguel</label>
              <input required type="number" min="1" max="31" name="diaVencimento" value={formData.diaVencimento} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow" />
            </div>
          </div>
        </div>

        {/* Proprietário */}
        <div>
          <h3 className="text-sm font-medium text-gray-900 mb-4 pb-2 border-b">Proprietário</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
              <input required type="text" name="nomeProp" value={formData.nomeProp} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp</label>
              <input required type="text" name="telProp" value={formData.telProp} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow" placeholder="(11) 99999-9999" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Aniversário (DD/MM)</label>
              <input required type="text" name="niverProp" value={formData.niverProp} onChange={handleChange} pattern="\d{2}/\d{2}" placeholder="DD/MM" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow" />
            </div>
          </div>
        </div>

        {/* Inquilino */}
        <div>
          <h3 className="text-sm font-medium text-gray-900 mb-4 pb-2 border-b">Inquilino</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
              <input required type="text" name="nomeInq" value={formData.nomeInq} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp</label>
              <input required type="text" name="telInq" value={formData.telInq} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow" placeholder="(11) 99999-9999" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Aniversário (DD/MM)</label>
              <input required type="text" name="niverInq" value={formData.niverInq} onChange={handleChange} pattern="\d{2}/\d{2}" placeholder="DD/MM" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow" />
            </div>
          </div>
        </div>
        
        <div className="pt-4 flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-70"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            {loading ? 'Salvando...' : 'Salvar Cadastro'}
          </button>
        </div>
      </form>
    </div>
  );
}
