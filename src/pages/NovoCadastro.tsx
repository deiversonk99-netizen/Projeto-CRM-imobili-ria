'use client'

import React, { useState } from 'react'
import { db } from '../store'
import type { Cadastro } from '../types'
import { Save, Loader2, CheckCircle2, FileSignature, UserRound, KeyRound } from 'lucide-react'

const inputClass =
  'w-full rounded-xl border border-input bg-card px-3.5 py-2.5 text-sm text-foreground shadow-sm outline-none transition-all placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-ring/30'

const labelClass = 'mb-1.5 block text-sm font-medium text-foreground'

function SectionTitle({
  icon: Icon,
  title,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
}) {
  return (
    <div className="mb-5 flex items-center gap-2.5 border-b border-border pb-3">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary">
        <Icon className="h-4 w-4 text-secondary-foreground" />
      </span>
      <h3 className="text-sm font-semibold uppercase tracking-wide text-brand-navy">{title}</h3>
    </div>
  )
}

export default function NovoCadastro() {
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'diaVencimento' ? parseInt(value) || 1 : value,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setSuccess(false)
    try {
      await db.saveCadastro(formData)
      setSuccess(true)
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
      setTimeout(() => setSuccess(false), 3000)
    } catch {
      alert('Erro ao salvar os dados.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between gap-4 border-b border-border bg-muted/50 px-6 py-5">
        <div>
          <h2 className="text-lg font-bold text-brand-navy text-balance">
            Novo Contrato de Locação
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Preencha os dados do contrato, proprietário e inquilino.
          </p>
        </div>
        {success && (
          <span className="flex shrink-0 items-center rounded-full bg-secondary px-3.5 py-1.5 text-sm font-semibold text-secondary-foreground">
            <CheckCircle2 className="mr-1.5 h-4 w-4" />
            Salvo com sucesso!
          </span>
        )}
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
                className={inputClass}
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
                pattern="\d{2}/\d{2}"
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
                pattern="\d{2}/\d{2}"
                placeholder="DD/MM"
                className={inputClass}
              />
            </div>
          </div>
        </section>

        <div className="flex justify-end border-t border-border pt-6">
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
