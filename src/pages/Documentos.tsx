'use client'

import React, { useEffect, useState } from 'react'
import { db } from '../store'
import type { ChecklistDocs, Cadastro } from '../types'
import { FileCheck, Search, Save, Loader2 } from 'lucide-react'

const checkboxClass =
  'mt-0.5 h-4.5 w-4.5 shrink-0 rounded border-input text-primary accent-[#76b82a] focus:ring-2 focus:ring-ring/40'

function ChecklistItem({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: () => void
  label: string
}) {
  return (
    <label className="group flex cursor-pointer items-start gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted/60">
      <input type="checkbox" checked={checked} onChange={onChange} className={checkboxClass} />
      <span
        className={`text-sm transition-colors ${
          checked ? 'text-muted-foreground line-through' : 'text-foreground group-hover:text-brand-navy'
        }`}
      >
        {label}
      </span>
    </label>
  )
}

export default function Documentos() {
  const [checklists, setChecklists] = useState<ChecklistDocs[]>([])
  const [cadastros, setCadastros] = useState<Record<string, Cadastro>>({})
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)

  const loadData = () => {
    setLoading(true)
    const checks = db.getChecklists()
    const cads = db.getCadastros()

    const cadMap: Record<string, Cadastro> = {}
    cads.forEach((c) => {
      cadMap[c.contrato] = c
    })

    setCadastros(cadMap)
    setChecklists(checks)
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleToggle = (id: string, field: keyof ChecklistDocs) => {
    setChecklists((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          return { ...c, [field]: !c[field] }
        }
        return c
      }),
    )
  }

  const handleSave = async (checklist: ChecklistDocs) => {
    setSavingId(checklist.id)
    await db.updateChecklist(checklist)
    setSavingId(null)
  }

  const filtered = checklists.filter((c) => {
    const term = searchTerm.toLowerCase()
    const cad = cadastros[c.contrato]
    if (!cad) return false
    return (
      c.contrato.toLowerCase().includes(term) ||
      cad.nomeProp.toLowerCase().includes(term) ||
      cad.nomeInq.toLowerCase().includes(term)
    )
  })

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex flex-col justify-between gap-4 border-b border-border bg-muted/50 px-6 py-5 sm:flex-row sm:items-center">
        <div>
          <h2 className="flex items-center gap-2.5 text-lg font-bold text-brand-navy">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
              <FileCheck className="h-4.5 w-4.5 text-secondary-foreground" />
            </span>
            Checklist de Documentos
          </h2>
        </div>
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar contrato ou nome..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-input bg-card py-2.5 pl-10 pr-4 text-sm shadow-sm outline-none transition-all placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-ring/30 sm:w-72"
          />
        </div>
      </div>

      <div>
        {loading ? (
          <div className="flex justify-center p-8 text-muted-foreground">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center p-14 text-center text-muted-foreground">
            <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <FileCheck className="h-7 w-7 text-muted-foreground/50" />
            </span>
            <p className="font-medium">Nenhum checklist encontrado.</p>
            <p className="mt-1 text-sm">Cadastre um contrato para gerar o checklist.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((c) => {
              const cad = cadastros[c.contrato]
              const isSaving = savingId === c.id
              const total = 5
              const done = [
                c.prop_contratoEnviado,
                c.prop_vistoriaEnviada,
                c.inq_manualEntregue,
                c.inq_vistoriaAssinada,
                c.inq_seguroIncendio,
              ].filter(Boolean).length

              return (
                <div key={c.id} className="p-6">
                  <div className="mb-5 flex flex-col justify-between gap-3 border-b border-border pb-5 sm:flex-row sm:items-center">
                    <div>
                      <div className="mb-1 flex items-center gap-2.5">
                        <span className="rounded-full bg-brand-navy px-2.5 py-0.5 text-xs font-semibold text-brand-navy-foreground">
                          Contrato: {c.contrato}
                        </span>
                        <span
                          className={`text-xs font-semibold ${
                            done === total ? 'text-primary' : 'text-muted-foreground'
                          }`}
                        >
                          {done}/{total} concluídos
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">Proprietário:</span>{' '}
                        {cad.nomeProp} {' | '}
                        <span className="font-medium text-foreground">Inquilino:</span>{' '}
                        {cad.nomeInq}
                      </p>
                    </div>
                    <button
                      onClick={() => handleSave(c)}
                      disabled={isSaving}
                      className="flex shrink-0 items-center gap-2 rounded-xl bg-brand-navy px-5 py-2.5 text-sm font-semibold text-brand-navy-foreground shadow-sm transition-all hover:brightness-125 disabled:opacity-70"
                    >
                      {isSaving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      Salvar
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                    {/* Proprietário */}
                    <div>
                      <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-brand-navy">
                        <span className="h-2 w-2 rounded-full bg-brand-navy" />
                        Documentos Proprietário
                      </h4>
                      <div className="space-y-1.5">
                        <ChecklistItem
                          checked={c.prop_contratoEnviado}
                          onChange={() => handleToggle(c.id, 'prop_contratoEnviado')}
                          label="Contrato de locação assinado"
                        />
                        <ChecklistItem
                          checked={c.prop_vistoriaEnviada}
                          onChange={() => handleToggle(c.id, 'prop_vistoriaEnviada')}
                          label="Termo de vistoria enviado"
                        />
                      </div>
                    </div>

                    {/* Inquilino */}
                    <div>
                      <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-brand-navy">
                        <span className="h-2 w-2 rounded-full bg-primary" />
                        Documentos Inquilino
                      </h4>
                      <div className="space-y-1.5">
                        <ChecklistItem
                          checked={c.inq_manualEntregue}
                          onChange={() => handleToggle(c.id, 'inq_manualEntregue')}
                          label="Manual do Inquilino entregue"
                        />
                        <ChecklistItem
                          checked={c.inq_vistoriaAssinada}
                          onChange={() => handleToggle(c.id, 'inq_vistoriaAssinada')}
                          label="Termo de vistoria assinado"
                        />
                        <ChecklistItem
                          checked={c.inq_seguroIncendio}
                          onChange={() => handleToggle(c.id, 'inq_seguroIncendio')}
                          label="Apólice de Seguro Incêndio"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
