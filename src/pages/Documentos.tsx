'use client'

import React, { useEffect, useState } from 'react'
import { db } from '../store'
import type { ChecklistDocs, Cadastro, DocumentoExtra } from '../types'
import { FileCheck, Search, Save, Loader2, AlertCircle, CheckCircle2, Plus, Trash2 } from 'lucide-react'
import { useData } from '../context/DataContext'
import { useToast } from '../components/ui/Toast'
import { v4 as uuidv4 } from 'uuid'

const checkboxClass =
  'mt-0.5 h-4.5 w-4.5 shrink-0 rounded border-input text-primary accent-[#76b82a] focus:ring-2 focus:ring-ring/40'

export interface ExtendedChecklist extends ChecklistDocs {
  docsExtras: DocumentoExtra[]
}

const parseDocs = (jsonStr?: string): DocumentoExtra[] => {
  if (!jsonStr || jsonStr === '[]') {
    return [
      { id: uuidv4(), nome: 'CNH', categoria: 'Locatário', isFeito: false, pendencia: '' },
      { id: uuidv4(), nome: 'Comprovante de Endereço', categoria: 'Locatário', isFeito: false, pendencia: '' },
      { id: uuidv4(), nome: 'Certidão de Casamento', categoria: 'Locador', isFeito: false, pendencia: '' },
      { id: uuidv4(), nome: 'Matrícula', categoria: 'Imóvel', isFeito: false, pendencia: '' }
    ]
  }
  try {
    return JSON.parse(jsonStr)
  } catch (e) {
    return []
  }
}

export default function Documentos() {
  const { cadastros: contextCadastros, checklists: contextChecklists, refreshData } = useData()
  const { addToast } = useToast()
  const [checklists, setChecklists] = useState<ExtendedChecklist[]>([])
  const [cadastros, setCadastros] = useState<Record<string, Cadastro>>({})
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)
  const [onlyPending, setOnlyPending] = useState(false)

  // State for new custom document form
  const [newDocForm, setNewDocForm] = useState<{ [key: string]: { nome: string, categoria: DocumentoExtra['categoria'] } }>({})

  const loadData = () => {
    const cadMap: Record<string, Cadastro> = {}
    contextCadastros.forEach((c) => {
      cadMap[c.id] = c
    })

    setCadastros(cadMap)
    setChecklists(
      contextChecklists.map((c) => ({
        ...c,
        docsExtras: parseDocs(c.documentos_json)
      }))
    )
  }

  useEffect(() => {
    if (contextCadastros && contextChecklists) {
      loadData()
    }
  }, [contextCadastros, contextChecklists])

  const handleToggleOld = (id: string, field: keyof ChecklistDocs) => {
    setChecklists((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          return { ...c, [field]: !c[field] }
        }
        return c
      }),
    )
  }

  const handleToggleExtra = (checklistId: string, docId: string) => {
    setChecklists((prev) =>
      prev.map((c) => {
        if (c.id === checklistId) {
          return {
            ...c,
            docsExtras: c.docsExtras.map(d => d.id === docId ? { ...d, isFeito: !d.isFeito } : d)
          }
        }
        return c
      })
    )
  }

  const handlePendenciaChange = (checklistId: string, docId: string, value: string) => {
    setChecklists((prev) =>
      prev.map((c) => {
        if (c.id === checklistId) {
          return {
            ...c,
            docsExtras: c.docsExtras.map(d => d.id === docId ? { ...d, pendencia: value } : d)
          }
        }
        return c
      })
    )
  }

  const handleDeleteExtra = (checklistId: string, docId: string) => {
    setChecklists((prev) =>
      prev.map((c) => {
        if (c.id === checklistId) {
          return {
            ...c,
            docsExtras: c.docsExtras.filter(d => d.id !== docId)
          }
        }
        return c
      })
    )
  }

  const handleAddExtra = (checklistId: string) => {
    const form = newDocForm[checklistId]
    if (!form || !form.nome.trim()) return

    setChecklists((prev) =>
      prev.map((c) => {
        if (c.id === checklistId) {
          return {
            ...c,
            docsExtras: [
              ...c.docsExtras,
              {
                id: uuidv4(),
                nome: form.nome.trim(),
                categoria: form.categoria,
                isFeito: false,
                pendencia: ''
              }
            ]
          }
        }
        return c
      })
    )
    
    setNewDocForm(prev => ({ ...prev, [checklistId]: { nome: '', categoria: 'Locatário' } }))
  }

  const handleSave = async (checklist: ExtendedChecklist) => {
    setSavingId(checklist.id)
    try {
      const { docsExtras, ...baseChecklist } = checklist
      const dataToSave: ChecklistDocs = {
        ...baseChecklist,
        documentos_json: JSON.stringify(docsExtras)
      }
      await db.updateChecklist(dataToSave)
      await refreshData()
      addToast('Checklist salvo com sucesso!', 'success')
    } catch (error) {
      addToast('Erro ao salvar checklist', 'error')
    } finally {
      setSavingId(null)
    }
  }

  const filtered = checklists.filter((c) => {
    const term = searchTerm.toLowerCase()
    const cad = cadastros[c.id]
    if (!cad) return false
    
    const matchesSearch = c.contrato.toLowerCase().includes(term) ||
      cad.nomeProp.toLowerCase().includes(term) ||
      cad.nomeInq.toLowerCase().includes(term)
      
    if (!matchesSearch) return false

    if (onlyPending) {
      const hasOldPending = !(c.prop_contratoEnviado && c.prop_vistoriaEnviada && c.inq_manualEntregue && c.inq_vistoriaAssinada && c.inq_seguroIncendio)
      const hasExtraPending = c.docsExtras.some(d => !d.isFeito)
      if (!hasOldPending && !hasExtraPending) return false
    }

    return true
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
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <label className="flex items-center gap-2 text-sm font-medium text-foreground cursor-pointer">
            <input 
              type="checkbox" 
              checked={onlyPending} 
              onChange={(e) => setOnlyPending(e.target.checked)}
              className={checkboxClass}
            />
            Mostrar somente pendentes
          </label>
          <div className="relative w-full sm:w-auto">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar contrato ou nome..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-input bg-card py-2.5 pl-10 pr-4 text-sm shadow-sm outline-none transition-all placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-ring/30 sm:w-64"
            />
          </div>
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
            <p className="mt-1 text-sm">Nenhum contrato condiz com os filtros selecionados.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((c) => {
              const cad = cadastros[c.id]
              const isSaving = savingId === c.id
              
              const oldTotal = 5
              const oldDone = [
                c.prop_contratoEnviado,
                c.prop_vistoriaEnviada,
                c.inq_manualEntregue,
                c.inq_vistoriaAssinada,
                c.inq_seguroIncendio,
              ].filter(Boolean).length

              const extraTotal = c.docsExtras.length
              const extraDone = c.docsExtras.filter(d => d.isFeito).length
              
              const total = oldTotal + extraTotal
              const done = oldDone + extraDone

              const renderOldItem = (checked: boolean, field: keyof ChecklistDocs, label: string) => {
                if (onlyPending && checked) return null;
                return (
                  <li key={field} className="flex items-center justify-between py-3">
                    <label className="group flex cursor-pointer items-center gap-3 overflow-hidden">
                      <input type="checkbox" checked={checked} onChange={() => handleToggleOld(c.id, field)} className={checkboxClass} />
                      <span className={`text-sm font-medium truncate transition-colors ${checked ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                        {label}
                      </span>
                    </label>
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      {checked ? (
                        <span className="flex items-center gap-1 rounded-md bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-700">
                          <CheckCircle2 className="h-3 w-3" /> Correto
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 rounded-md bg-orange-100 px-2 py-0.5 text-[11px] font-semibold text-orange-700">
                          <AlertCircle className="h-3 w-3" /> Pendente
                        </span>
                      )}
                    </div>
                  </li>
                )
              }

              const renderExtraItem = (doc: DocumentoExtra) => {
                if (onlyPending && doc.isFeito) return null;
                return (
                  <li key={doc.id} className="flex flex-col py-3">
                    <div className="flex items-center justify-between">
                      <label className="group flex cursor-pointer items-center gap-3 overflow-hidden">
                        <input type="checkbox" checked={doc.isFeito} onChange={() => handleToggleExtra(c.id, doc.id)} className={checkboxClass} />
                        <span className={`text-sm font-medium truncate transition-colors ${doc.isFeito ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                          {doc.nome}
                        </span>
                      </label>
                      <div className="flex items-center justify-end gap-2 shrink-0 ml-2">
                        {doc.isFeito ? (
                          <span className="flex items-center gap-1 rounded-md bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-700">
                            <CheckCircle2 className="h-3 w-3" /> Entregue
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 rounded-md bg-orange-100 px-2 py-0.5 text-[11px] font-semibold text-orange-700">
                            <AlertCircle className="h-3 w-3" /> Pendente
                          </span>
                        )}
                        <button onClick={() => handleDeleteExtra(c.id, doc.id)} className="text-muted-foreground hover:text-red-500 transition-colors shrink-0 p-1 rounded-md hover:bg-red-50" title="Remover documento">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    {!doc.isFeito && (
                      <div className="pl-7 mt-2 w-full">
                        <input 
                          type="text" 
                          value={doc.pendencia || ''}
                          onChange={(e) => handlePendenciaChange(c.id, doc.id, e.target.value)}
                          placeholder="Detalhes da pendência (opcional)..." 
                          className="w-full text-xs rounded-lg border border-input bg-muted/50 px-3 py-1.5 focus:bg-card focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all"
                        />
                      </div>
                    )}
                  </li>
                )
              }

              return (
                <div key={c.id} className="p-6">
                  <div className="mb-5 flex flex-col justify-between gap-3 border-b border-border pb-5 lg:flex-row lg:items-center">
                    <div>
                      <div className="mb-1 flex flex-wrap items-center gap-2.5">
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
                      <p className="text-sm text-muted-foreground mt-2">
                        <span className="font-medium text-foreground">Proprietário:</span> {cad.nomeProp} {' | '}
                        <span className="font-medium text-foreground">Inquilino:</span> {cad.nomeInq}
                      </p>
                    </div>
                    <button
                      onClick={() => handleSave(c)}
                      disabled={isSaving}
                      className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-brand-navy px-5 py-2.5 text-sm font-semibold text-brand-navy-foreground shadow-sm transition-all hover:brightness-125 disabled:opacity-70"
                    >
                      {isSaving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      Salvar Alterações
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
                    {/* Locatário */}
                    <div>
                      <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-brand-navy">
                        <span className="h-2 w-2 rounded-full bg-primary" />
                        Locatário / Inquilino
                      </h4>
                      <ul className="divide-y divide-border border border-border rounded-xl px-4 bg-card shadow-sm">
                        {renderOldItem(c.inq_manualEntregue, 'inq_manualEntregue', 'Manual do Inquilino')}
                        {renderOldItem(c.inq_vistoriaAssinada, 'inq_vistoriaAssinada', 'Vistoria Assinada')}
                        {renderOldItem(c.inq_seguroIncendio, 'inq_seguroIncendio', 'Seguro Incêndio')}
                        {c.docsExtras.filter(d => d.categoria === 'Locatário').map(renderExtraItem)}
                      </ul>
                    </div>

                    {/* Locador */}
                    <div>
                      <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-brand-navy">
                        <span className="h-2 w-2 rounded-full bg-brand-navy" />
                        Locador / Proprietário
                      </h4>
                      <ul className="divide-y divide-border border border-border rounded-xl px-4 bg-card shadow-sm">
                        {renderOldItem(c.prop_contratoEnviado, 'prop_contratoEnviado', 'Contrato de Locação')}
                        {renderOldItem(c.prop_vistoriaEnviada, 'prop_vistoriaEnviada', 'Vistoria Enviada')}
                        {c.docsExtras.filter(d => d.categoria === 'Locador').map(renderExtraItem)}
                      </ul>
                    </div>
                    
                    {/* Imóvel & Outros */}
                    <div>
                      <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-brand-navy">
                        <span className="h-2 w-2 rounded-full bg-secondary" />
                        Imóvel / Outros
                      </h4>
                      <ul className="divide-y divide-border border border-border rounded-xl px-4 bg-card shadow-sm">
                        {c.docsExtras.filter(d => d.categoria === 'Imóvel' || d.categoria === 'Outros').map(renderExtraItem)}
                      </ul>
                        <div className="mt-4 border border-dashed border-border rounded-xl p-4 bg-muted/20">
                          <h5 className="text-sm font-medium mb-3 text-muted-foreground flex items-center gap-2">
                            <Plus className="h-4 w-4" /> Adicionar Documento
                          </h5>
                          <div className="space-y-2.5">
                            <input 
                              type="text" 
                              placeholder="Nome do documento..."
                              value={newDocForm[c.id]?.nome || ''}
                              onChange={e => setNewDocForm(prev => ({ ...prev, [c.id]: { ...prev[c.id], nome: e.target.value, categoria: prev[c.id]?.categoria || 'Locatário' } }))}
                              className="w-full text-sm rounded-lg border border-input bg-card px-3 py-2 outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                            />
                            <div className="flex gap-2">
                              <select 
                                value={newDocForm[c.id]?.categoria || 'Locatário'}
                                onChange={e => setNewDocForm(prev => ({ ...prev, [c.id]: { ...prev[c.id], categoria: e.target.value as any, nome: prev[c.id]?.nome || '' } }))}
                                className="w-full text-sm rounded-lg border border-input bg-card px-3 py-2 outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                              >
                                <option value="Locatário">Locatário</option>
                                <option value="Locador">Locador</option>
                                <option value="Imóvel">Imóvel</option>
                                <option value="Outros">Outros</option>
                              </select>
                              <button 
                                onClick={() => handleAddExtra(c.id)}
                                className="shrink-0 bg-primary text-primary-foreground rounded-lg px-3 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
                              >
                                Adicionar
                              </button>
                            </div>
                          </div>
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

