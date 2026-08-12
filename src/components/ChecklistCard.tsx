import React, { useState, useEffect, useCallback } from 'react'
import { ExtendedChecklist } from '../pages/Documentos'
import type { Cadastro, DocumentoExtra } from '../types'
import { db } from '../store'
import { Loader2, CheckCircle2, AlertCircle, Trash2, Plus, ChevronDown, ChevronUp, Check } from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'
import { useToast } from './ui/Toast'
import { useDebounce } from '../hooks/useDebounce'

const checkboxClass =
  'mt-0.5 h-4.5 w-4.5 shrink-0 rounded border-input text-primary accent-[#76b82a] focus:ring-2 focus:ring-ring/40'

type TabType = 'Locador' | 'Locatário' | 'Imóvel' | 'Contratos' | 'Outros'

interface ChecklistCardProps {
  initialChecklist: ExtendedChecklist
  cadastro: Cadastro
  onlyPending: boolean
  onUpdate: (updated: ExtendedChecklist) => void
}

export function ChecklistCard({ initialChecklist, cadastro, onlyPending, onUpdate }: ChecklistCardProps) {
  const [checklist, setChecklist] = useState(initialChecklist)
  const [isExpanded, setIsExpanded] = useState(false)
  const [newDocForm, setNewDocForm] = useState({ nome: '', categoria: 'Locatário' })
  
  const [isSaving, setIsSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error' | 'idle'>('idle')
  const { addToast } = useToast()

  // Debounced auto-save
  const debouncedChecklist = useDebounce(checklist, 1000)

  // This ref ensures we don't save on initial mount
  const isFirstRender = React.useRef(true)

  useEffect(() => {
    // Sync external updates (e.g. if we refresh data)
    setChecklist(initialChecklist)
  }, [initialChecklist])

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    
    // Don't auto-save if they are exactly the same
    if (JSON.stringify(debouncedChecklist) === JSON.stringify(initialChecklist)) return;

    const performSave = async () => {
      setSaveStatus('saving')
      try {
        const { docsExtras, ...baseChecklist } = debouncedChecklist
        const dataToSave = {
          ...baseChecklist,
          documentos_json: JSON.stringify(docsExtras)
        }
        await db.updateChecklist(dataToSave)
        setSaveStatus('saved')
        onUpdate(debouncedChecklist)
        setTimeout(() => setSaveStatus('idle'), 2000)
      } catch (error) {
        setSaveStatus('error')
        addToast('Erro ao salvar automático', 'error')
      }
    }

    performSave()
  }, [debouncedChecklist, onUpdate, addToast])

  const total = checklist.docsExtras.length
  const done = checklist.docsExtras.filter(d => d.isFeito).length
  const progressPercent = total === 0 ? 0 : Math.round((done / total) * 100)

  const handleStatusChange = (docId: string, newStatus: 'Pendente' | 'Feito' | 'Não se aplica') => {
    setChecklist(prev => {
      let newDocs = prev.docsExtras.map(d => {
        if (d.id === docId) {
          return {
            ...d,
            status: newStatus,
            isFeito: newStatus === 'Feito' || newStatus === 'Não se aplica'
          }
        }
        return d
      })
      
      const doc = newDocs.find(d => d.id === docId)
      // Auto-add spouse document
      if (doc && newStatus === 'Pendente' && doc.nome.includes('Certidão de Casamento')) {
        const conjugeName = 'CNH (CPF/RG) Cônjuge'
        if (!newDocs.some(d => d.nome === conjugeName && d.categoria === doc.categoria)) {
          newDocs.push({
            id: uuidv4(),
            nome: conjugeName,
            categoria: doc.categoria,
            isFeito: false,
            pendencia: '',
            status: 'Pendente' as any
          })
        }
      }
      return { ...prev, docsExtras: newDocs as any[] }
    })
  }

  const handleToggleExtra = (docId: string) => {
    setChecklist(prev => {
      let newDocs = prev.docsExtras.map(d => {
        if (d.id === docId) {
          const nextIsFeito = !d.isFeito
          return { 
            ...d, 
            isFeito: nextIsFeito,
            status: (nextIsFeito ? 'Feito' : 'Pendente') as any 
          }
        }
        return d
      })
      const doc = newDocs.find(d => d.id === docId)
      
      // Auto-add spouse document
      if (doc && doc.isFeito === false && doc.nome.includes('Certidão de Casamento')) {
        const conjugeName = 'CNH (CPF/RG) Cônjuge'
        if (!newDocs.some(d => d.nome === conjugeName && d.categoria === doc.categoria)) {
          newDocs.push({
            id: uuidv4(),
            nome: conjugeName,
            categoria: doc.categoria,
            isFeito: false,
            pendencia: '',
            status: 'Pendente' as any
          })
        }
      }
      return { ...prev, docsExtras: newDocs as any[] }
    })
  }

  const handlePendenciaChange = (docId: string, value: string) => {
    setChecklist(prev => ({
      ...prev,
      docsExtras: prev.docsExtras.map(d => d.id === docId ? { ...d, pendencia: value } : d)
    }))
  }

  const handleDeleteExtra = (docId: string) => {
    setChecklist(prev => ({
      ...prev,
      docsExtras: prev.docsExtras.filter(d => d.id !== docId)
    }))
  }

  const handleAddFiador = () => {
    setChecklist(prev => {
      const existingFiadors = prev.docsExtras
        .map(d => d.categoria)
        .filter(c => c.startsWith('Fiador '));
        
      const maxFiador = existingFiadors.reduce((max, c) => {
        const num = parseInt(c.replace('Fiador ', ''), 10);
        return !isNaN(num) && num > max ? num : max;
      }, 0);
      
      const nextFiador = `Fiador ${maxFiador + 1}`;
      
      const fiadorDocs = [
        'Proposta de Locação',
        'CNH (CPF/RG)',
        'Comprovante de Endereço',
        'Certidão de Casamento',
        'Certidão de Nascimento',
        'Comprovante de Renda (excluir se não aplica)',
        'SERASA (excluir se não aplica)',
        'Matrícula do Imóvel'
      ].map(nome => ({
        id: uuidv4(),
        nome,
        categoria: nextFiador,
        isFeito: false,
        pendencia: '',
        status: 'Pendente' as 'Pendente'
      }));

      return {
        ...prev,
        docsExtras: [...prev.docsExtras, ...fiadorDocs]
      };
    });
  }

  const handleAddExtra = () => {
    if (!newDocForm.nome.trim()) return
    setChecklist(prev => ({
      ...prev,
      docsExtras: [
        ...prev.docsExtras,
        {
          id: uuidv4(),
          nome: newDocForm.nome.trim(),
          categoria: newDocForm.categoria,
          isFeito: false,
          pendencia: '',
          status: 'Pendente'
        }
      ]
    }))
    setNewDocForm(prev => ({ ...prev, nome: '' }))
  }

  const renderExtraItem = (doc: DocumentoExtra) => {
    if (onlyPending && doc.isFeito) return null;
    
    // Highlight if there is a pending note
    const hasNote = doc.pendencia && doc.pendencia.trim().length > 0;
    
    return (
      <li key={doc.id} className={`flex flex-col py-3 px-3 rounded-lg transition-colors mb-2 border ${hasNote && !doc.isFeito ? 'border-orange-200 bg-orange-50/50' : 'border-transparent hover:bg-muted/30'}`}>
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <label className="group flex cursor-pointer items-start gap-3 flex-1 min-w-0">
            <input 
              type="checkbox" 
              checked={doc.isFeito} 
              onChange={() => handleToggleExtra(doc.id)} 
              className={checkboxClass + ' mt-0.5 shrink-0'} 
            />
            <span className={`text-sm font-medium transition-colors ${doc.isFeito ? 'text-muted-foreground line-through' : 'text-foreground'} break-words whitespace-normal`}>
              {doc.nome}
            </span>
          </label>
          <div className="flex items-center justify-end gap-2 shrink-0 ml-auto pl-7 sm:pl-0">
            {(() => {
              const currentStatus = doc.status || (doc.isFeito ? 'Feito' : 'Pendente');
              let bgClass = "bg-orange-100 text-orange-700 hover:bg-orange-200";
              if (currentStatus === 'Feito') bgClass = "bg-green-100 text-green-700 hover:bg-green-200";
              if (currentStatus === 'Não se aplica') bgClass = "bg-gray-200 text-gray-700 hover:bg-gray-300";
              
              return (
                <div className="relative inline-flex items-center">
                  <select 
                    value={currentStatus}
                    onChange={(e) => handleStatusChange(doc.id, e.target.value as any)}
                    className={`text-[11px] font-semibold rounded-md pl-2 pr-6 py-0.5 outline-none appearance-none cursor-pointer border-none transition-colors ${bgClass}`}
                  >
                    <option value="Pendente">Pendente</option>
                    <option value="Feito">Ok - Feito</option>
                    <option value="Não se aplica">Não se aplica</option>
                  </select>
                  <ChevronDown className="h-3 w-3 absolute right-1.5 pointer-events-none opacity-50" />
                </div>
              );
            })()}
            <button onClick={() => handleDeleteExtra(doc.id)} className="text-muted-foreground hover:text-red-500 transition-colors shrink-0 p-1 rounded-md hover:bg-red-50" title="Remover documento">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="pl-7 mt-2 w-full">
          {doc.nome.includes('Dados Bancários') ? (
            <textarea 
              value={doc.pendencia || ''}
              onChange={(e) => handlePendenciaChange(doc.id, e.target.value)}
              placeholder="Informe Agência, Conta, Banco, CPF/CNPJ, Titular..." 
              className={`w-full text-xs rounded-lg border px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all min-h-[80px] resize-y ${hasNote && !doc.isFeito ? 'border-orange-300 bg-white' : 'border-input bg-muted/50 focus:bg-card'}`}
            />
          ) : (
            <input 
              type="text" 
              value={doc.pendencia || ''}
              onChange={(e) => handlePendenciaChange(doc.id, e.target.value)}
              placeholder="Observações ou pendências (opcional)..." 
              className={`w-full text-xs rounded-lg border px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all ${hasNote && !doc.isFeito ? 'border-orange-300 bg-white text-orange-900' : 'border-input bg-muted/50 focus:bg-card'}`}
            />
          )}
        </div>
      </li>
    )
  }

  // Intelligent Sorting: Pending first, done last
  const getSortedDocs = (categoryFilter: (d: DocumentoExtra) => boolean) => {
    return [...checklist.docsExtras]
      .filter(categoryFilter)
      .sort((a, b) => (a.isFeito === b.isFeito ? 0 : a.isFeito ? 1 : -1))
  }

  const handleRemoveFiador = (fiadorCat: string) => {
    setChecklist(prev => ({
      ...prev,
      docsExtras: prev.docsExtras.filter(d => d.categoria !== fiadorCat)
    }))
  }

  const renderCategoryDocs = (title: string, categoryFilter: (d: DocumentoExtra) => boolean, color: string, onRemoveCategory?: () => void) => {
    const docs = getSortedDocs(categoryFilter)
    
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between mb-3">
          <h4 className="flex items-center gap-2 font-semibold text-sm">
            <span className={`w-2 h-2 rounded-full ${color}`}></span>
            {title}
          </h4>
          {onRemoveCategory && (
            <button 
              onClick={onRemoveCategory}
              className="text-muted-foreground hover:text-red-500 transition-colors p-1 rounded-md hover:bg-red-50"
              title={`Remover ${title}`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="border border-border rounded-xl bg-card shadow-sm flex flex-col flex-1 overflow-hidden">
          <ul className="divide-y divide-border/50 p-2 flex-1">
            {docs.length === 0 ? (
              <p className="text-sm text-muted-foreground p-4 text-center">Nenhum documento.</p>
            ) : (
              docs.map(renderExtraItem)
            )}
          </ul>
          {title.startsWith('Fiador') && (
            <div className="p-2 border-t border-border/50 bg-muted/30">
              <button 
                onClick={() => {
                  setNewDocForm(prev => ({ ...prev, categoria: title }));
                  document.getElementById(`new-doc-input-${checklist.id}`)?.focus();
                }}
                className="w-full text-xs font-medium text-orange-600 hover:text-orange-700 flex items-center justify-center gap-1.5 py-1.5 rounded-lg hover:bg-orange-100/50 transition-colors"
              >
                <Plus className="h-3 w-3" /> Adicionar Documento
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 border-b border-border last:border-0 bg-card">
      <div 
        className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center cursor-pointer group"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex-1 w-full">
          <div className="flex items-center justify-between">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="rounded-full bg-brand-navy px-2.5 py-0.5 text-xs font-semibold text-brand-navy-foreground">
                Contrato: {checklist.contrato}
              </span>
              <span className={`text-xs font-semibold ${done === total ? 'text-primary' : 'text-muted-foreground'}`}>
                {done}/{total} concluídos ({progressPercent}%)
              </span>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="flex items-center text-xs font-medium text-muted-foreground min-w-[80px]">
                {saveStatus === 'saving' && <><Loader2 className="h-3 w-3 animate-spin mr-1.5" /> Salvando...</>}
                {saveStatus === 'saved' && <><Check className="h-3 w-3 text-green-500 mr-1.5" /> Salvo</>}
                {saveStatus === 'error' && <><AlertCircle className="h-3 w-3 text-red-500 mr-1.5" /> Erro</>}
              </div>
              <button 
                className="p-1.5 rounded-full hover:bg-muted text-muted-foreground transition-colors"
                onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
              >
                {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
              </button>
            </div>
          </div>
          
          <p className="text-sm text-muted-foreground mt-2 group-hover:text-foreground transition-colors">
            <span className="font-medium">Proprietário:</span> {cadastro.nomeProp} {' | '}
            <span className="font-medium">Inquilino:</span> {cadastro.nomeInq}
          </p>
          
          {/* Progress Bar */}
          <div className="mt-3 h-1.5 w-full bg-muted rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-500 ${progressPercent === 100 ? 'bg-primary' : 'bg-brand-navy'}`} 
              style={{ width: `${progressPercent}%` }} 
            />
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-6 pt-6 border-t border-border animate-in slide-in-from-top-2 duration-200">
          
          {/* Columns */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {renderCategoryDocs('Locatário / Inquilino', d => d.categoria === 'Locatário', 'bg-primary')}
            {renderCategoryDocs('Locador / Proprietário', d => d.categoria === 'Locador', 'bg-brand-navy')}
            {renderCategoryDocs('Imóvel / Outros', d => ['Imóvel', 'Contratos', 'Outros'].includes(d.categoria), 'bg-secondary')}
            
            {Array.from(new Set(checklist.docsExtras.filter(d => d.categoria.startsWith('Fiador ')).map(d => d.categoria))).sort().map(fiadorCat => 
              <React.Fragment key={fiadorCat}>
                {renderCategoryDocs(fiadorCat, d => d.categoria === fiadorCat, 'bg-orange-500', () => handleRemoveFiador(fiadorCat))}
              </React.Fragment>
            )}
          </div>

          <div className="mt-6 flex items-center justify-end">
            <button 
              onClick={handleAddFiador}
              className="flex items-center gap-2 bg-orange-100 text-orange-700 hover:bg-orange-200 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
            >
              <Plus className="h-4 w-4" /> Adicionar Fiador
            </button>
          </div>

          {/* Add Document Form */}
          <div className="mt-6 border border-dashed border-border rounded-xl p-4 bg-muted/20">
            <h5 className="text-sm font-medium mb-3 text-muted-foreground flex items-center gap-2">
              <Plus className="h-4 w-4" /> Adicionar Novo Documento
            </h5>
            <div className="flex flex-col sm:flex-row gap-2.5 items-center">
              <input 
                id={`new-doc-input-${checklist.id}`}
                type="text" 
                placeholder="Nome do documento..."
                value={newDocForm.nome}
                onChange={e => setNewDocForm(prev => ({ ...prev, nome: e.target.value }))}
                className="w-full text-sm rounded-lg border border-input bg-card px-3 py-2 outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                onKeyDown={(e) => e.key === 'Enter' && handleAddExtra()}
              />
              <select 
                value={newDocForm.categoria}
                onChange={e => setNewDocForm(prev => ({ ...prev, categoria: e.target.value }))}
                className="w-full sm:w-48 text-sm rounded-lg border border-input bg-card px-3 py-2 outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all shrink-0"
              >
                <option value="Locatário">Locatário</option>
                <option value="Locador">Locador</option>
                <option value="Imóvel">Imóvel</option>
                <option value="Contratos">Contratos</option>
                <option value="Outros">Outros</option>
                {Array.from(new Set(checklist.docsExtras.filter(d => d.categoria.startsWith('Fiador ')).map(d => d.categoria))).sort().map(fiadorCat => (
                  <option key={fiadorCat} value={fiadorCat}>{fiadorCat}</option>
                ))}
              </select>
              <button 
                onClick={handleAddExtra}
                className="w-full sm:w-auto shrink-0 bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm"
              >
                Adicionar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
