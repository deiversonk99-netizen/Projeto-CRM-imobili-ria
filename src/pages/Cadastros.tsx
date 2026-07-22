'use client'

import React, { useState, useMemo } from 'react'
import { db } from '../store'
import type { Cadastro } from '../types'
import { Save, Loader2, CheckCircle2, FileSignature, UserRound, KeyRound, Search, PlusCircle, Pencil, Trash2 } from 'lucide-react'
import { useData } from '../context/DataContext'
import { useToast } from '../components/ui/Toast'
import { isValidDateDDMM, isValidPhone } from '../utils/validations'
import { ConfirmModal } from '../components/ui/ConfirmModal'

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
  
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [cadastroToDelete, setCadastroToDelete] = useState<string | null>(null)

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
  })

  const filteredCadastros = useMemo(() => {
    return cadastros.filter(c => 
      c.contrato.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.nomeProp.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.nomeInq.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [cadastros, searchTerm])

  const handleEdit = (cadastro: Cadastro) => {
    setEditingId(cadastro.id)
    setFormData({
      contrato: cadastro.contrato,
      nomeProp: cadastro.nomeProp,
      telProp: cadastro.telProp,
      niverProp: cadastro.niverProp,
      nomeInq: cadastro.nomeInq,
      telInq: cadastro.telInq,
      niverInq: cadastro.niverInq,
      inicioContrato: cadastro.inicioContrato.split('T')[0],
      fimContrato: cadastro.fimContrato.split('T')[0],
      corretor: cadastro.corretor,
      diaVencimento: cadastro.diaVencimento,
    })
    setView('form')
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
    })
    setView('form')
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'diaVencimento' ? parseInt(value) || 1 : value,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validations
    if (!editingId && cadastros.some(c => c.contrato === formData.contrato)) {
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
        await db.saveCadastro(formData)
        addToast('Cadastro salvo com sucesso!', 'success')
      }
      await refreshData()
      setView('list')
    } catch {
      addToast('Erro ao salvar os dados.', 'error')
    } finally {
      setLoading(false)
    }
  }

  if (view === 'list') {
    return (
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
                  <th className="px-6 py-4 font-medium">Contrato</th>
                  <th className="px-6 py-4 font-medium">Proprietário</th>
                  <th className="px-6 py-4 font-medium">Inquilino</th>
                  <th className="px-6 py-4 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredCadastros.map((cad) => (
                  <tr key={cad.id} className="transition-colors hover:bg-muted/30">
                    <td className="px-6 py-4 font-medium">{cad.contrato}</td>
                    <td className="px-6 py-4">{cad.nomeProp}</td>
                    <td className="px-6 py-4">{cad.nomeInq}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleEdit(cad)}
                          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-secondary-foreground"
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => confirmDelete(cad.id)}
                          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-red-100 hover:text-red-600"
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
