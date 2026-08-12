'use client'

import React, { useState, useMemo } from 'react'
import { db } from '../store'
import type { Cadastro } from '../types'
import { Save, Loader2, MessageCircle, Home, BadgeDollarSign, AlertCircle, CheckCircle2, FileSignature, UserRound, KeyRound, Search, PlusCircle, Pencil, Trash2, RefreshCw } from 'lucide-react'
import { useData } from '../context/DataContext'
import { useToast } from '../components/ui/Toast'
import { isValidDateDDMM, isValidPhone, maskDateDDMM, maskPhone } from '../utils/validations'
import { getWhatsappLink } from '../utils/dates'
import { ConfirmModal } from '../components/ui/ConfirmModal'
import { v4 as uuidv4 } from 'uuid'

const inputClass =
  'w-full rounded-xl border border-input bg-card px-3.5 py-2.5 text-sm text-foreground shadow-sm outline-none transition-all placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-ring/30'

const labelClass = 'mb-1.5 block text-sm font-medium text-foreground'

function SectionTitle({ icon: Icon, title }: { icon: React.ComponentType<{ className?: string }>; title: string }) {
  return (
    <div className="mb-5 flex items-center gap-2.5 border-b border-border pb-3">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary">
        <Icon className="h-4 w-4 text-secondary-foreground" />
      </span>
      <h3 className="text-sm font-semibold uppercase tracking-wide text-brand-navy">{title}</h3>
    </div>
  )
}

export default function Cadastros() {
  const { cadastros, refreshData } = useData()
  const { addToast } = useToast()
  
  const [view, setView] = useState<'list' | 'form'>('list')
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [tabStatus, setTabStatus] = useState('Todos')
  
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [cadastroToDelete, setCadastroToDelete] = useState<string | null>(null)
  const [currentRequestId, setCurrentRequestId] = useState<string | null>(null)

  const [formData, setFormData] = useState<Omit<Cadastro, 'id' | 'dataHora'>>({
    contrato: '',
    nomeProp: '',
    telProp: '',
    niverProp: '',
    emailProp: '',
    nomeInq: '',
    telInq: '',
    niverInq: '',
    emailInq: '',
    inicioContrato: '',
    fimContrato: '',
    corretor: '',
    diaVencimento: 1,
    enderecoImovel: '',
    tipoImovel: '',
    finalidade: '',
    condominio: '',
    valorAluguel: 0,
    comissao: 0,
    status: 'Ativo',
  })

  const filteredCadastros = useMemo(() => {
    const term = searchTerm.toLowerCase()
    return cadastros.filter(c => {
      const matchSearch = String(c.contrato || '').toLowerCase().includes(term) ||
                          String(c.nomeProp || '').toLowerCase().includes(term) ||
                          String(c.nomeInq || '').toLowerCase().includes(term);
      const matchStatus = tabStatus === 'Todos' || c.status === tabStatus;
      return matchSearch && matchStatus;
    })
  }, [cadastros, searchTerm, tabStatus])

  const dashboardStats = useMemo(() => {
    const ativos = cadastros.filter(c => c.status === 'Ativo');
    const valorTotalAtivos = ativos.reduce((acc, c) => acc + (c.valorAluguel || 0), 0);
    const totalEncerrados = cadastros.filter(c => c.status === 'Encerrado').length;
    return { 
      ativos: ativos.length, 
      valorTotalAtivos,
      totalEncerrados
    }
  }, [cadastros]);

  const parseIsoToDDMM = (dateStr: string) => {
    if (!dateStr) return '';
    if (dateStr.includes('T') && dateStr.length >= 10) {
      // Assuming format is YYYY-MM-DDThh:mm...
      const month = dateStr.substring(5, 7);
      const day = dateStr.substring(8, 10);
      return `${day}/${month}`;
    }
    return dateStr;
  }

  const handleEdit = (cadastro: Cadastro) => {
    setEditingId(cadastro.id)
    setFormData({
      contrato: cadastro.contrato,
      nomeProp: cadastro.nomeProp,
      telProp: cadastro.telProp,
      niverProp: parseIsoToDDMM(cadastro.niverProp),
      emailProp: cadastro.emailProp || '',
      nomeInq: cadastro.nomeInq,
      telInq: cadastro.telInq,
      niverInq: parseIsoToDDMM(cadastro.niverInq),
      emailInq: cadastro.emailInq || '',
      inicioContrato: cadastro.inicioContrato.split('T')[0],
      fimContrato: cadastro.fimContrato.split('T')[0],
      corretor: cadastro.corretor,
      diaVencimento: cadastro.diaVencimento,
      enderecoImovel: cadastro.enderecoImovel || '',
      tipoImovel: cadastro.tipoImovel || '',
      finalidade: cadastro.finalidade || '',
      condominio: cadastro.condominio || '',
      valorAluguel: cadastro.valorAluguel || 0,
      comissao: cadastro.comissao || 0,
      status: cadastro.status || 'Ativo',
    })
    setView('form')
  }

  const handleRenew = (cadastro: Cadastro) => {
    setEditingId(null) // It will be created as a new record
    setFormData({
      contrato: `${cadastro.contrato}-REN`,
      nomeProp: cadastro.nomeProp,
      telProp: cadastro.telProp,
      niverProp: parseIsoToDDMM(cadastro.niverProp),
      emailProp: cadastro.emailProp || '',
      nomeInq: cadastro.nomeInq,
      telInq: cadastro.telInq,
      niverInq: parseIsoToDDMM(cadastro.niverInq),
      emailInq: cadastro.emailInq || '',
      inicioContrato: cadastro.fimContrato.split('T')[0], // start from previous end
      fimContrato: '', // require new end date
      corretor: cadastro.corretor,
      diaVencimento: cadastro.diaVencimento,
      enderecoImovel: cadastro.enderecoImovel || '',
      tipoImovel: cadastro.tipoImovel || '',
      finalidade: cadastro.finalidade || '',
      condominio: cadastro.condominio || '',
      valorAluguel: cadastro.valorAluguel || 0,
      comissao: cadastro.comissao || 0,
      status: 'Ativo',
    })
    setView('form')
    addToast('Preencha os dados da renovação.', 'success')
  }

  const handleDelete = async () => {
    if (!cadastroToDelete) return;
    setLoading(true)
    try {
      await db.deleteCadastro(cadastroToDelete)
      await refreshData()
      addToast('Cadastro excluído com sucesso!', 'success')
      setDeleteModalOpen(false)
      setCadastroToDelete(null)
    } catch (error) {
      addToast('Erro ao excluir cadastro.', 'error')
    } finally {
      setLoading(false)
    }
  }

  const confirmDelete = (id: string) => {
    setCadastroToDelete(id)
    setDeleteModalOpen(true)
  }

  const handleNew = () => {
    setEditingId(null)
    setCurrentRequestId(uuidv4())
    setFormData({
      contrato: '',
      nomeProp: '',
      telProp: '',
      niverProp: '',
      emailProp: '',
      nomeInq: '',
      telInq: '',
      niverInq: '',
      emailInq: '',
      inicioContrato: '',
      fimContrato: '',
      corretor: '',
      diaVencimento: 1,
      enderecoImovel: '',
      tipoImovel: '',
      finalidade: '',
      condominio: '',
      valorAluguel: 0,
      comissao: 0,
      status: 'Ativo',
    })
    setView('form')
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData((prev) => {
      let parsedValue: string | number = value;
      if (name === 'diaVencimento') parsedValue = parseInt(value) || 1;
      if (name === 'valorAluguel' || name === 'comissao') parsedValue = parseFloat(value) || 0;
      
      if (name === 'niverProp' || name === 'niverInq') {
        parsedValue = maskDateDDMM(value);
      }
      if (name === 'telProp' || name === 'telInq') {
        parsedValue = maskPhone(value);
      }
      
      return {
        ...prev,
        [name]: parsedValue,
      }
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validations
    const contratoExists = cadastros.some(c => String(c.contrato).trim() === String(formData.contrato).trim() && c.id !== editingId);
    if (contratoExists) {
      addToast('Número de contrato já existe!', 'error')
      return;
    }
    if (!isValidDateDDMM(formData.niverProp)) {
      addToast('Aniversário do Proprietário inválido. Use DD/MM.', 'error')
      return;
    }
    if (!isValidDateDDMM(formData.niverInq)) {
      addToast('Aniversário do Inquilino inválido. Use DD/MM.', 'error')
      return;
    }
    if (!isValidPhone(formData.telProp)) {
      addToast('WhatsApp do Proprietário inválido.', 'error')
      return;
    }
    if (!isValidPhone(formData.telInq)) {
      addToast('WhatsApp do Inquilino inválido.', 'error')
      return;
    }
    if (new Date(formData.fimContrato) <= new Date(formData.inicioContrato)) {
      addToast('O término do contrato deve ser posterior ao início.', 'error')
      return;
    }

    setLoading(true)
    try {
      if (editingId) {
        await db.updateCadastro({ ...formData, id: editingId, dataHora: new Date().toISOString() })
        addToast('Cadastro atualizado com sucesso!', 'success')
      } else {
        await db.saveCadastro({ ...formData, id: currentRequestId || uuidv4() })
        addToast('Cadastro salvo com sucesso!', 'success')
      }
      await refreshData()
      setView('list')
    } catch (error: any) {
      if (error && error.message && error.message.includes('timeout')) {
         addToast('A operação demorou muito. Verificando se o contrato foi salvo...', 'info')
         try {
           const newData = await refreshData();
           if (!editingId && newData?.cads) {
             const wasSaved = newData.cads.some((c: any) => String(c.contrato).trim() === String(formData.contrato).trim());
             if (wasSaved) {
                addToast('Apesar da demora, o cadastro foi salvo com sucesso!', 'success');
                setView('list');
                setLoading(false);
                return;
             }
           }
         } catch(e) {}
      }
      addToast(error?.message || 'Erro ao salvar os dados.', 'error')
    } finally {
      setLoading(false)
    }
  }

  if (view === 'list') {
    return (
      <div className="space-y-6">
        {/* Dashboard Resumo */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Contratos Ativos</p>
                <p className="mt-2 text-3xl font-bold text-foreground">{dashboardStats.ativos}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <FileSignature className="h-6 w-6" />
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Receita Estimada (Ativos)</p>
                <p className="mt-2 text-3xl font-bold text-brand-navy">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(dashboardStats.valorTotalAtivos)}
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-navy/10 text-brand-navy">
                <BadgeDollarSign className="h-6 w-6" />
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Contratos Encerrados</p>
                <p className="mt-2 text-3xl font-bold text-foreground">{dashboardStats.totalEncerrados}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <AlertCircle className="h-6 w-6" />
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex flex-col justify-between gap-4 border-b border-border bg-muted/50 px-6 py-5 sm:flex-row sm:items-center">
            <div>
              <h2 className="flex items-center gap-2.5 text-lg font-bold text-brand-navy">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
                  <FileSignature className="h-4.5 w-4.5 text-secondary-foreground" />
                </span>
                Cadastros e Contratos
              </h2>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Buscar contrato ou nome..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full rounded-xl border border-input bg-card py-2.5 pl-10 pr-4 text-sm shadow-sm outline-none transition-all placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-ring/30 sm:w-64"
                />
              </div>
              <button
                onClick={handleNew}
                className="flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:brightness-105"
              >
                <PlusCircle className="h-4 w-4" />
                Novo Cadastro
              </button>
            </div>
          </div>

          <div className="flex border-b border-border">
            {['Todos', 'Ativo', 'Encerrado', 'Renovado'].map(status => (
              <button
                key={status}
                onClick={() => setTabStatus(status)}
                className={`px-6 py-3 text-sm font-medium transition-colors ${
                  tabStatus === status
                    ? 'border-b-2 border-primary text-primary bg-muted/20'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                }`}
              >
                {status}
              </button>
            ))}
          </div>

          <div className="overflow-x-auto">
            {filteredCadastros.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-14 text-muted-foreground">
                <FileSignature className="mb-4 h-12 w-12 opacity-50" />
                <p>Nenhum cadastro encontrado.</p>
              </div>
            ) : (
              <table className="w-full text-left text-sm text-foreground">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-6 py-4 font-medium">Contrato & Status</th>
                    <th className="px-6 py-4 font-medium">Partes Envolvidas</th>
                    <th className="px-6 py-4 font-medium">Financeiro & Prazos</th>
                    <th className="px-6 py-4 font-medium text-right">Ações Rápidas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredCadastros.map((cad) => (
                    <tr key={cad.id} className="transition-colors hover:bg-muted/10 group">
                      <td className="px-6 py-4">
                        <div className="font-bold text-foreground">{cad.contrato}</div>
                        <div className="mt-1 flex items-center gap-2">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                            cad.status === 'Ativo' ? 'bg-green-100 text-green-700' :
                            cad.status === 'Encerrado' ? 'bg-red-100 text-red-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {cad.status}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                         <div className="flex flex-col gap-3">
                            <div className="flex flex-wrap items-center gap-2.5">
                               <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-700 w-12 justify-center">Prop</span>
                               <span className="font-medium text-foreground text-sm">{cad.nomeProp}</span>
                               <a href={getWhatsappLink(cad.telProp, `Olá ${cad.nomeProp}, aqui é da IMG Imóveis Mogi Guaçu.`)} target="_blank" rel="noreferrer" className="text-[#25D366] hover:brightness-110 p-1 bg-[#25D366]/10 rounded-full ml-auto md:ml-0" title="WhatsApp Proprietário">
                                 <MessageCircle className="h-3.5 w-3.5" />
                               </a>
                            </div>
                            <div className="flex flex-wrap items-center gap-2.5">
                               <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 w-12 justify-center">Inq</span>
                               <span className="font-medium text-foreground text-sm">{cad.nomeInq}</span>
                               <a href={getWhatsappLink(cad.telInq, `Olá ${cad.nomeInq}, aqui é da IMG Imóveis Mogi Guaçu.`)} target="_blank" rel="noreferrer" className="text-[#25D366] hover:brightness-110 p-1 bg-[#25D366]/10 rounded-full ml-auto md:ml-0" title="WhatsApp Inquilino">
                                 <MessageCircle className="h-3.5 w-3.5" />
                               </a>
                            </div>
                         </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-brand-navy">
                          {cad.valorAluguel ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cad.valorAluguel) : 'R$ 0,00'}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          Dia de Venc.: {cad.diaVencimento}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {cad.inicioContrato && cad.fimContrato ? `${cad.inicioContrato.split('T')[0].split('-').reverse().join('/')} até ${cad.fimContrato.split('T')[0].split('-').reverse().join('/')}` : 'Sem datas'}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-1 opacity-100 lg:opacity-50 transition-opacity lg:group-hover:opacity-100">
                          <button
                            onClick={() => handleRenew(cad)}
                            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-blue-100 hover:text-blue-700"
                            title="Renovar Contrato"
                          >
                            <RefreshCw className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleEdit(cad)}
                            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-secondary-foreground"
                            title="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => confirmDelete(cad.id)}
                            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-red-100 hover:text-red-700"
                            title="Excluir"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <ConfirmModal
            isOpen={deleteModalOpen}
            title="Excluir Cadastro"
            message="Tem certeza que deseja excluir este cadastro? Esta ação não pode ser desfeita."
            onConfirm={handleDelete}
            onCancel={() => {
              setDeleteModalOpen(false)
              setCadastroToDelete(null)
            }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between gap-4 border-b border-border bg-muted/50 px-6 py-5">
        <div>
          <h2 className="text-lg font-bold text-brand-navy text-balance">
            {editingId ? 'Editar Contrato' : 'Novo Contrato de Locação'}
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Preencha os dados do contrato, proprietário e inquilino.
          </p>
        </div>
        <button
          onClick={() => setView('list')}
          className="text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          Voltar para lista
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-10 p-6 md:p-8">
        {/* Contrato e Base */}
        <section>
          <SectionTitle icon={FileSignature} title="Dados do Contrato" />
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <label htmlFor="contrato" className={labelClass}>
                Nº do Contrato
              </label>
              <input
                id="contrato"
                required
                type="text"
                name="contrato"
                value={formData.contrato}
                onChange={handleChange}
                disabled={!!editingId} // Usually it's better to not allow changing the key ID
                className={`${inputClass} ${editingId ? 'opacity-60 cursor-not-allowed' : ''}`}
                placeholder="Ex: 2023-001"
              />
            </div>
            <div>
              <label htmlFor="corretor" className={labelClass}>
                Corretor Responsável
              </label>
              <input
                id="corretor"
                required
                type="text"
                name="corretor"
                value={formData.corretor}
                onChange={handleChange}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="inicioContrato" className={labelClass}>
                Início do Contrato
              </label>
              <input
                id="inicioContrato"
                required
                type="date"
                name="inicioContrato"
                value={formData.inicioContrato}
                onChange={handleChange}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="fimContrato" className={labelClass}>
                Término do Contrato
              </label>
              <input
                id="fimContrato"
                required
                type="date"
                name="fimContrato"
                value={formData.fimContrato}
                onChange={handleChange}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="diaVencimento" className={labelClass}>
                Dia Venc. Aluguel
              </label>
              <input
                id="diaVencimento"
                required
                type="number"
                min="1"
                max="31"
                name="diaVencimento"
                value={formData.diaVencimento}
                onChange={handleChange}
                className={inputClass}
              />
            </div>
          </div>
        </section>

        {/* Proprietário */}
        <section>
          <SectionTitle icon={KeyRound} title="Proprietário" />
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            <div className="md:col-span-2">
              <label htmlFor="nomeProp" className={labelClass}>
                Nome
              </label>
              <input
                id="nomeProp"
                required
                type="text"
                name="nomeProp"
                value={formData.nomeProp}
                onChange={handleChange}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="emailProp" className={labelClass}>
                E-mail (opcional)
              </label>
              <input
                id="emailProp"
                type="email"
                name="emailProp"
                value={formData.emailProp || ''}
                onChange={handleChange}
                className={inputClass}
                placeholder="email@exemplo.com"
              />
            </div>
            <div>
              <label htmlFor="telProp" className={labelClass}>
                WhatsApp
              </label>
              <input
                id="telProp"
                required
                type="text"
                name="telProp"
                value={formData.telProp}
                onChange={handleChange}
                className={inputClass}
                placeholder="(11) 99999-9999"
              />
            </div>
            <div>
              <label htmlFor="niverProp" className={labelClass}>
                Aniversário (DD/MM)
              </label>
              <input
                id="niverProp"
                required
                type="text"
                name="niverProp"
                value={formData.niverProp}
                onChange={handleChange}
                placeholder="DD/MM"
                className={inputClass}
              />
            </div>
          </div>
        </section>

        {/* Inquilino */}
        <section>
          <SectionTitle icon={UserRound} title="Inquilino" />
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            <div className="md:col-span-2">
              <label htmlFor="nomeInq" className={labelClass}>
                Nome
              </label>
              <input
                id="nomeInq"
                required
                type="text"
                name="nomeInq"
                value={formData.nomeInq}
                onChange={handleChange}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="emailInq" className={labelClass}>
                E-mail (opcional)
              </label>
              <input
                id="emailInq"
                type="email"
                name="emailInq"
                value={formData.emailInq || ''}
                onChange={handleChange}
                className={inputClass}
                placeholder="email@exemplo.com"
              />
            </div>
            <div>
              <label htmlFor="telInq" className={labelClass}>
                WhatsApp
              </label>
              <input
                id="telInq"
                required
                type="text"
                name="telInq"
                value={formData.telInq}
                onChange={handleChange}
                className={inputClass}
                placeholder="(11) 99999-9999"
              />
            </div>
            <div>
              <label htmlFor="niverInq" className={labelClass}>
                Aniversário (DD/MM)
              </label>
              <input
                id="niverInq"
                required
                type="text"
                name="niverInq"
                value={formData.niverInq}
                onChange={handleChange}
                placeholder="DD/MM"
                className={inputClass}
              />
            </div>
          </div>
        </section>

        {/* Imóvel */}
        <section>
          <SectionTitle icon={FileSignature} title="Imóvel & Financeiro" />
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div className="md:col-span-2">
              <label htmlFor="enderecoImovel" className={labelClass}>
                Endereço do Imóvel
              </label>
              <input
                id="enderecoImovel"
                type="text"
                name="enderecoImovel"
                value={formData.enderecoImovel || ''}
                onChange={handleChange}
                className={inputClass}
                placeholder="Rua, número, bairro, cidade"
              />
            </div>
            <div>
              <label htmlFor="tipoImovel" className={labelClass}>
                Tipo de Imóvel
              </label>
              <select
                id="tipoImovel"
                name="tipoImovel"
                value={formData.tipoImovel || ''}
                onChange={handleChange}
                className={inputClass}
              >
                <option value="">Selecione...</option>
                <option value="Casa">Casa</option>
                <option value="Apartamento">Apartamento</option>
                <option value="Comercial">Comercial</option>
                <option value="Terreno">Terreno</option>
                <option value="Outro">Outro</option>
              </select>
            </div>
            
            <div>
              <label htmlFor="finalidade" className={labelClass}>
                Finalidade
              </label>
              <select
                id="finalidade"
                name="finalidade"
                value={formData.finalidade || ''}
                onChange={handleChange}
                className={inputClass}
              >
                <option value="">Selecione...</option>
                <option value="Residencial">Residencial</option>
                <option value="Comercial">Comercial</option>
              </select>
            </div>

            <div>
              <label htmlFor="condominio" className={labelClass}>
                Condomínio
              </label>
              <select
                id="condominio"
                name="condominio"
                value={formData.condominio || ''}
                onChange={handleChange}
                className={inputClass}
              >
                <option value="">Nenhum / Não se aplica</option>
                <option value="Vila Hadassas">Vila Hadassas</option>
                <option value="Morro do Sol">Morro do Sol</option>
                <option value="Bela Vista">Bela Vista</option>
                <option value="Residencial Oregon">Residencial Oregon</option>
                <option value="Outro">Outro</option>
              </select>
            </div>
            <div>
              <label htmlFor="valorAluguel" className={labelClass}>
                Valor do Aluguel (R$)
              </label>
              <input
                id="valorAluguel"
                type="number"
                step="0.01"
                min="0"
                name="valorAluguel"
                value={formData.valorAluguel || ''}
                onChange={handleChange}
                className={inputClass}
                placeholder="0.00"
              />
            </div>
            <div>
              <label htmlFor="comissao" className={labelClass}>
                Comissão (%)
              </label>
              <input
                id="comissao"
                type="number"
                step="0.1"
                min="0"
                max="100"
                name="comissao"
                value={formData.comissao || ''}
                onChange={handleChange}
                className={inputClass}
                placeholder="Ex: 10"
              />
            </div>
            <div>
              <label htmlFor="status" className={labelClass}>
                Status do Contrato
              </label>
              <select
                id="status"
                name="status"
                value={formData.status || 'Ativo'}
                onChange={handleChange}
                className={inputClass}
              >
                <option value="Ativo">Ativo</option>
                <option value="Encerrado">Encerrado</option>
                <option value="Renovado">Renovado</option>
              </select>
            </div>
          </div>
        </section>

        <div className="flex justify-end gap-3 border-t border-border pt-6">
          <button
            type="button"
            onClick={() => setView('list')}
            className="px-6 py-3 text-sm font-semibold text-foreground hover:bg-muted rounded-xl transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 rounded-xl bg-primary px-7 py-3 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/25 transition-all hover:brightness-105 active:scale-[0.98] disabled:opacity-70"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
            {loading ? 'Salvando...' : 'Salvar Cadastro'}
          </button>
        </div>
      </form>
    </div>
  )
}
