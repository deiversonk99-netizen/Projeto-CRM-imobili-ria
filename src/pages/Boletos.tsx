'use client'

import React, { useEffect, useState } from 'react'
import { db } from '../store'
import { checkBoletoWarning, getWhatsappLink } from '../utils/dates'
import { FileText, MessageCircle, CheckCircle, Loader2, Search } from 'lucide-react'
import { useData } from '../context/DataContext'
import { useToast } from '../components/ui/Toast'

interface BoletoItem {
  id: string
  contrato: string
  nomeInq: string
  nomeProp: string
  telefone: string
  tipoAviso: '5_dias' | '1_dia' | 'hoje' | 'atrasado'
  diaVencimento: number
  isFeito: boolean
}

export default function Boletos() {
  const { cadastros, tarefas, refreshData, addTarefaLocally, removeTarefaLocally } = useData()
  const [boletos, setBoletos] = useState<BoletoItem[]>([])
  const [loading, setLoading] = useState(false)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [tab, setTab] = useState<'pendentes' | 'concluidos'>('pendentes')

  const [searchTerm, setSearchTerm] = useState('')

  // Formato: YYYY-MM
  const currentMonthRef = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`

  const loadData = () => {
    const doneIds = new Set(
      tarefas
        .filter((t) => t.tipo.startsWith('Boleto') && t.referencia === currentMonthRef)
        .map((t) => `${t.contrato}-${t.tipo}`),
    )

    const result: BoletoItem[] = []

    cadastros.forEach((c) => {
      const aviso = checkBoletoWarning(c.diaVencimento)
      if (aviso) {
        const tipoStr = aviso === '5_dias' ? 'Boleto 5 dias' : aviso === '1_dia' ? 'Boleto 1 dia' : aviso === 'atrasado' ? 'Boleto Atrasado' : 'Boleto Hoje'
        result.push({
          id: c.id,
          contrato: c.contrato,
          nomeInq: c.nomeInq,
          nomeProp: c.nomeProp,
          telefone: c.telInq,
          tipoAviso: aviso,
          diaVencimento: c.diaVencimento,
          isFeito: doneIds.has(`${c.contrato}-${tipoStr}`),
        })
      }
    })
    setBoletos(result)
  }

  const { addToast } = useToast()
  
  useEffect(() => {
    if (cadastros && tarefas) {
      loadData()
    }
  }, [cadastros, tarefas])

  const toggleAction = async (item: BoletoItem, action: 'marcar' | 'desfazer') => {
    setProcessingId(item.id)
    const tipoStr = item.tipoAviso === '5_dias' ? 'Boleto 5 dias' : item.tipoAviso === '1_dia' ? 'Boleto 1 dia' : item.tipoAviso === 'atrasado' ? 'Boleto Atrasado' : 'Boleto Hoje'

    try {
      if (action === 'marcar') {
        const novaTarefa = {
          contrato: String(item.contrato),
          tipo: tipoStr as any,
          usuario: 'Sistema',
          referencia: currentMonthRef,
        };
        setBoletos(prev => prev.map(b => b.id === item.id ? { ...b, isFeito: true } : b))
        const saved = await db.saveTarefa(novaTarefa)
        addTarefaLocally(saved)
        addToast('Aviso de boleto marcado como feito!', 'success')
      } else {
        const task = tarefas.find(t => t.tipo === tipoStr && t.referencia === currentMonthRef && String(t.contrato) === String(item.contrato))
        if (task) {
           setBoletos(prev => prev.map(b => b.id === item.id ? { ...b, isFeito: false } : b))
           await db.deleteTarefa(task.idTarefa)
           removeTarefaLocally(task.idTarefa)
           addToast('Ação desfeita com sucesso!', 'success')
        }
      }
    } catch (error) {
      addToast(`Erro ao ${action === 'marcar' ? 'marcar' : 'desfazer'} aviso de boleto.`, 'error')
      await refreshData() // Revert optimistic update on error
    } finally {
      setProcessingId(null)
    }
  }

  const filteredBoletos = boletos.filter((b) => {
    const term = searchTerm.toLowerCase()
    return b.nomeInq.toLowerCase().includes(term) || String(b.contrato).toLowerCase().includes(term)
  })

  const pendentes = filteredBoletos.filter(b => !b.isFeito)
  const concluidos = filteredBoletos.filter(b => b.isFeito)
  const currentList = tab === 'pendentes' ? pendentes : concluidos
  
  const totalItems = filteredBoletos.length;
  const progressPercent = totalItems === 0 ? 0 : Math.round((concluidos.length / totalItems) * 100);

  const cincoDias = currentList.filter((b) => b.tipoAviso === '5_dias')
  const umDia = currentList.filter((b) => b.tipoAviso === '1_dia')
  const hoje = currentList.filter((b) => b.tipoAviso === 'hoje')
  const atrasados = currentList.filter((b) => b.tipoAviso === 'atrasado')

  const renderList = (lista: BoletoItem[], title: string, dotClass: string, textClass: string) => (
    <div className="mb-8 last:mb-0">
      <h3
        className={`mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider ${textClass}`}
      >
        <span className={`h-2.5 w-2.5 rounded-full ${dotClass}`} />
        {title}
      </h3>
      {lista.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-muted/40 px-4 py-3 text-sm italic text-muted-foreground">
          Nenhuma cobrança para este período hoje.
        </p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
          {lista.map((item) => {
            let text = ''
            if (item.tipoAviso === '5_dias') {
              text = `Olá ${item.nomeInq}, tudo bem? Passando para avisar que o boleto do seu aluguel (Contrato ${item.contrato}), com vencimento para o dia ${item.diaVencimento}, já está disponível para pagamento.`
            } else if (item.tipoAviso === '1_dia') {
              text = `Olá ${item.nomeInq}, tudo bem? Passando para lembrar que o vencimento do seu aluguel (Contrato ${item.contrato}) é amanhã, dia ${item.diaVencimento}.`
            } else if (item.tipoAviso === 'hoje') {
              text = `Olá ${item.nomeInq}, tudo bem? Passando para lembrar que o vencimento do seu aluguel (Contrato ${item.contrato}) é hoje, dia ${item.diaVencimento}.`
            } else {
              text = `Olá ${item.nomeInq}, tudo bem? Consta em nosso sistema que o boleto referente ao aluguel (Contrato ${item.contrato}) com vencimento no dia ${item.diaVencimento} consta como em aberto. Por favor, desconsidere esta mensagem caso o pagamento já tenha sido realizado.`
            }
            const isProcessing = processingId === item.id

            return (
              <li
                key={item.id}
                className="flex flex-col justify-between gap-4 bg-card p-4 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center"
              >
                <div>
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">{item.nomeInq}</span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      Contrato: {item.contrato}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">Proprietário: {item.nomeProp}</p>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={getWhatsappLink(item.telefone, text)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 rounded-xl bg-[#25D366] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:brightness-105"
                  >
                    <MessageCircle className="h-4 w-4" />
                    Avisar
                  </a>
                  {!item.isFeito ? (
                    <button
                      onClick={() => toggleAction(item, 'marcar')}
                      disabled={isProcessing}
                      className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed w-[110px] justify-center whitespace-nowrap"
                    >
                      {isProcessing ? <Loader2 className="h-4 w-4 animate-spin shrink-0" /> : <CheckCircle className="h-4 w-4 shrink-0" />}
                      {isProcessing ? 'Salvando' : 'Feito'}
                    </button>
                  ) : (
                    <button
                      onClick={() => toggleAction(item, 'desfazer')}
                      disabled={isProcessing}
                      className="flex items-center gap-1.5 rounded-xl border border-red-200 bg-card px-4 py-2 text-sm font-medium text-green-600 shadow-sm transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50 disabled:cursor-not-allowed w-[110px] justify-center whitespace-nowrap"
                      title="Desfazer"
                    >
                      {isProcessing ? <Loader2 className="h-4 w-4 animate-spin shrink-0 text-muted-foreground" /> : <CheckCircle className="h-4 w-4 shrink-0" />}
                      {isProcessing ? 'Aguarde' : 'Concluído'}
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex flex-col justify-between gap-4 border-b border-border bg-muted/50 px-6 py-5 sm:flex-row sm:items-center">
        <div>
          <h2 className="flex items-center gap-2.5 text-lg font-bold text-brand-navy">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
              <FileText className="h-4.5 w-4.5 text-secondary-foreground" />
            </span>
            Envio de Boletos (Vencimentos)
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            Avisos de cobrança programados para 5 dias e 1 dia antes do vencimento.
          </p>
          
          <div className="mt-3 h-1.5 w-48 bg-border rounded-full overflow-hidden flex items-center">
            <div 
              className={`h-full transition-all duration-500 ${progressPercent === 100 ? 'bg-primary' : 'bg-brand-navy'}`} 
              style={{ width: `${progressPercent}%` }} 
            />
          </div>
          <p className="text-xs font-semibold text-muted-foreground mt-1">
             {concluidos.length}/{totalItems} Concluídos ({progressPercent}%)
          </p>
        </div>
        
        <div className="relative w-full sm:w-auto">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar nome ou contrato..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-input bg-card py-2.5 pl-10 pr-4 text-sm shadow-sm outline-none transition-all placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-ring/30 sm:w-64"
          />
        </div>
      </div>

      <div className="flex border-b border-border">
        <button
          onClick={() => setTab('pendentes')}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            tab === 'pendentes'
              ? 'border-b-2 border-primary text-primary bg-muted/20'
              : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
          }`}
        >
          Pendentes ({pendentes.length})
        </button>
        <button
          onClick={() => setTab('concluidos')}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            tab === 'concluidos'
              ? 'border-b-2 border-primary text-primary bg-muted/20'
              : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
          }`}
        >
          Concluídos ({concluidos.length})
        </button>
      </div>

      <div className="p-6">
        {loading ? (
          <div className="flex justify-center p-8 text-muted-foreground">Carregando...</div>
        ) : currentList.length === 0 ? (
          <div className="flex justify-center p-8 text-muted-foreground">Nenhum boleto {tab === 'pendentes' ? 'pendente' : 'concluído'}.</div>
        ) : (
          <>
            {renderList(atrasados, 'Atrasados', 'bg-red-700', 'text-red-700')}
            {renderList(hoje, 'Vence Hoje', 'bg-red-500', 'text-red-500')}
            {renderList(umDia, 'Avisar Amanhã (Falta 1 dia)', 'bg-warning-foreground', 'text-warning-foreground')}
            {renderList(cincoDias, 'Avisar em 5 dias', 'bg-brand-navy', 'text-brand-navy')}
          </>
        )}
      </div>
    </div>
  )
}
