'use client'

import React, { useEffect, useState } from 'react'
import { db } from '../store'
import type { ChecklistDocs, Cadastro, DocumentoExtra } from '../types'
import { FileCheck, Search, Save, Loader2, AlertCircle, CheckCircle2, Plus, Trash2 } from 'lucide-react'
import { useData } from '../context/DataContext'
import { useToast } from '../components/ui/Toast'
import { v4 as uuidv4 } from 'uuid'

import { ChecklistCard } from '../components/ChecklistCard'

const checkboxClass =
  'mt-0.5 h-4.5 w-4.5 shrink-0 rounded border-input text-primary accent-[#76b82a] focus:ring-2 focus:ring-ring/40'

export interface ExtendedChecklist extends ChecklistDocs {
  docsExtras: DocumentoExtra[]
}

const parseDocs = (jsonStr?: string): DocumentoExtra[] => {
  const defaultDocs: DocumentoExtra[] = [
    // LOCADOR
    { id: 'doc_def_locador_cnh', nome: 'CNH (CPF/RG)', categoria: 'Locador', isFeito: false, pendencia: '' },
    { id: 'doc_def_locador_comp_end', nome: 'Comprovante de Endereço', categoria: 'Locador', isFeito: false, pendencia: '' },
    { id: 'doc_def_locador_casamento', nome: 'Certidão de Casamento', categoria: 'Locador', isFeito: false, pendencia: '' },
    { id: 'doc_def_locador_nascimento', nome: 'Certidão de Nascimento', categoria: 'Locador', isFeito: false, pendencia: '' },
    { id: 'doc_def_locador_banco', nome: 'Dados Bancários Proprietário', categoria: 'Locador', isFeito: false, pendencia: '' },
    
    // LOCATÁRIO
    { id: 'doc_def_locatario_proposta', nome: 'Proposta de Locação', categoria: 'Locatário', isFeito: false, pendencia: '' },
    { id: 'doc_def_locatario_cnh', nome: 'CNH (CPF/RG)', categoria: 'Locatário', isFeito: false, pendencia: '' },
    { id: 'doc_def_locatario_comp_end', nome: 'Comprovante de Endereço', categoria: 'Locatário', isFeito: false, pendencia: '' },
    { id: 'doc_def_locatario_casamento', nome: 'Certidão de Casamento', categoria: 'Locatário', isFeito: false, pendencia: '' },
    { id: 'doc_def_locatario_nascimento', nome: 'Certidão de Nascimento', categoria: 'Locatário', isFeito: false, pendencia: '' },
    { id: 'doc_def_locatario_renda', nome: 'Comprovante de Renda (excluir se não aplica)', categoria: 'Locatário', isFeito: false, pendencia: '' },
    { id: 'doc_def_locatario_serasa', nome: 'SERASA (excluir se não aplica)', categoria: 'Locatário', isFeito: false, pendencia: '' },

    // IMÓVEL
    { id: 'doc_def_imovel_energia', nome: 'Conta Energia', categoria: 'Imóvel', isFeito: false, pendencia: '' },
    { id: 'doc_def_imovel_agua', nome: 'Conta de Água', categoria: 'Imóvel', isFeito: false, pendencia: '' },
    { id: 'doc_def_imovel_iptu', nome: 'IPTU', categoria: 'Imóvel', isFeito: false, pendencia: '' },
    { id: 'doc_def_imovel_matricula', nome: 'Matrícula (ficha do imóvel)', categoria: 'Imóvel', isFeito: false, pendencia: '' },
    { id: 'doc_def_imovel_transf_energia', nome: 'Transferência Energia', categoria: 'Imóvel', isFeito: false, pendencia: '' },
    { id: 'doc_def_imovel_transf_agua', nome: 'Transferência Água', categoria: 'Imóvel', isFeito: false, pendencia: '' },

    // CONTRATOS
    { id: 'doc_def_contrato_locacao', nome: 'Contrato de Locação', categoria: 'Contratos', isFeito: false, pendencia: '' },
    { id: 'doc_def_contrato_intermed', nome: 'Contrato de Intermediação', categoria: 'Contratos', isFeito: false, pendencia: '' },
    { id: 'doc_def_contrato_incendio', nome: 'Seguro Incêndio (Proprietário, Inquilino ou Isento)', categoria: 'Contratos', isFeito: false, pendencia: '' },
    { id: 'doc_def_contrato_garantia', nome: 'Garantia (Seguro Fiança, Fiador, Caução, etc.)', categoria: 'Contratos', isFeito: false, pendencia: '' },
    { id: 'doc_def_contrato_chaves', nome: 'Termo de Entrega de Chaves', categoria: 'Contratos', isFeito: false, pendencia: '' },
    { id: 'doc_def_contrato_vistoria', nome: 'Vistoria de Entrada', categoria: 'Contratos', isFeito: false, pendencia: '' }
  ];

  if (!jsonStr || jsonStr === '[]') {
    return defaultDocs.map(def => ({
      ...def,
      status: def.isFeito ? 'Feito' : 'Pendente'
    }));
  }
  
  try {
    const parsed = JSON.parse(jsonStr) as DocumentoExtra[];
    const result = parsed.map(doc => ({
      ...doc,
      status: doc.status || (doc.isFeito ? 'Feito' : 'Pendente')
    }));
    
    // Adicionar novos documentos padrão que possam estar faltando em checklists antigos
    defaultDocs.forEach(def => {
      if (!result.some(r => r.nome === def.nome && r.categoria === def.categoria)) {
        result.push({
          ...def,
          status: def.isFeito ? 'Feito' : 'Pendente'
        });
      }
    });
    
    return result;
  } catch (e) {
    console.error("Invalid JSON in documentos_json", e);
    return defaultDocs.map(def => ({
      ...def,
      status: def.isFeito ? 'Feito' : 'Pendente'
    }));
  }
}

export default function Documentos() {
  const { cadastros: contextCadastros, checklists: contextChecklists, refreshData } = useData()
  const { addToast } = useToast()
  const [checklists, setChecklists] = useState<ExtendedChecklist[]>([])
  const [cadastros, setCadastros] = useState<Record<string, Cadastro>>({})
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [onlyPending, setOnlyPending] = useState(false)

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

  const handleChecklistUpdate = (updatedChecklist: ExtendedChecklist) => {
    setChecklists((prev) => 
      prev.map(c => c.id === updatedChecklist.id ? updatedChecklist : c)
    )
  }

  const filtered = checklists.filter((c) => {
    const term = searchTerm.toLowerCase()
    const cad = cadastros[c.id]
    if (!cad) return false
    
    const matchesSearch = String(c.contrato || '').toLowerCase().includes(term) ||
      String(cad.nomeProp || '').toLowerCase().includes(term) ||
      String(cad.nomeInq || '').toLowerCase().includes(term)
      
    if (!matchesSearch) return false

    if (onlyPending) {
      const hasExtraPending = c.docsExtras.some(d => !d.isFeito)
      if (!hasExtraPending) return false
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
            {filtered.map((c) => (
              <ChecklistCard 
                key={c.id} 
                initialChecklist={c} 
                cadastro={cadastros[c.id]} 
                onlyPending={onlyPending}
                onUpdate={handleChecklistUpdate}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

