'use client'

import React, { useEffect, useState } from 'react'
import { db } from '../store'
import { checkBoletoWarning, getWhatsappLink } from '../utils/dates'
import { FileText, MessageCircle, CheckCircle, Loader2 } from 'lucide-react'
import { useData } from '../context/DataContext'
import { useToast } from '../components/ui/Toast'
import { ConfirmModal } from '../components/ui/ConfirmModal'

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
  const { cadastros, tarefas, addTarefaLocally, removeTarefaLocally } = useData()
  const [boletos, setBoletos] = useState<BoletoItem[]>([])
  const [loading, setLoading] = useState(false)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [tab, setTab] = useState<'pendentes' | 'concluidos'>('pendentes')
  const [modal, setModal] = useState<{ isOpen: boolean; item: BoletoItem | null; action: 'marcar' | 'desfazer' }>({
    isOpen: false,
    item: null,
    action: 'marcar'
  })

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

  const confirmAction = async () => {
    const { item, action } = modal
    if (!item) return

    setModal({ ...modal, isOpen: false })
    setProcessingId(item.id)
    const tipoStr = item.tipoAviso === '5_dias' ? 'Boleto 5 dias' : item.tipoAviso === '1_dia' ? 'Boleto 1 dia' : item.tipoAviso === 'atrasado' ? 'Boleto Atrasado' : 'Boleto Hoje'

    try {
      if (action === 'marcar') {
        const novaTarefa = {
          contrato: item.contrato,
          tipo: tipoStr as any,
          usuario: 'Sistema',
          referencia: currentMonthRef,
        };
        const tempId = `temp-${Date.now()}`;
        addTarefaLocally({ ...novaTarefa, idTarefa: tempId, dataConclusao: new Date().toISOString() });
        
        await db.saveTarefa(novaTarefa)
        addToast('Aviso de boleto marcado como feito!', 'success')
      } else {
        const task = tarefas.find(t => t.tipo === tipoStr && t.referencia === currentMonthRef && t.contrato === item.contrato)
        if (task) {
           removeTarefaLocally(task.idTarefa);
           await db.deleteTarefa(task.idTarefa)
           addToast('Ação desfeita com sucesso!', 'success')
        }
      }
    } catch (error) {
      addToast(`Erro ao ${action === 'marcar' ? 'marcar' : 'desfazer'} aviso de boleto.`, 'error')
    } finally {
      setProcessingId(null)
    }
  }

  const pendentes = boletos.filter(b => !b.isFeito)
  const concluidos = boletos.filter(b => b.isFeito)
  const currentList = tab === 'pendentes' ? pendentes : concluidos

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
            const text = `Olá ${item.nomeInq}, tudo bem? O vencimento do seu aluguel (Contrato ${item.contrato}) está próximo (Dia ${item.diaVencimento}). O boleto já está disponível!`
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
                    className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm shadow-primary/20 transition-all hover:brightness-105"
                  >
                    <MessageCircle className="h-4 w-4" />
                    Avisar
                  </a>
                  {!item.isFeito ? (
                    <button
                      onClick={() => setModal({ isOpen: true, item, action: 'marcar' })}
                      disabled={isProcessing}
                      className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed w-[110px] justify-center"
                    >
                      {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                      {isProcessing ? 'Salvando...' : 'Feito'}
                    </button>
                  ) : (
                    <button
                      onClick={() => setModal({ isOpen: true, item, action: 'desfazer' })}
                      disabled={isProcessing}
                      className="flex items-center gap-1.5 rounded-xl border border-red-200 bg-card px-4 py-2 text-sm font-medium text-green-600 shadow-sm transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50 disabled:cursor-not-allowed w-[110px] justify-center"
                      title="Desfazer"
                    >
                      {isProcessing ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : <CheckCircle className="h-4 w-4" />}
                      {isProcessing ? 'Aguarde...' : 'Concluído'}
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
      <ConfirmModal
        isOpen={modal.isOpen}
        title={modal.action === 'marcar' ? 'Marcar como Feito' : 'Desfazer Ação'}
        message={
          modal.action === 'marcar'
            ? `Deseja realmente marcar o aviso de boleto para o contrato ${modal.item?.contrato} como feito?`
            : `Deseja desfazer a marcação do aviso para o contrato ${modal.item?.contrato}?`
        }
        confirmText={modal.action === 'marcar' ? 'Sim, marcar' : 'Sim, desfazer'}
        intent={modal.action === 'marcar' ? 'success' : 'warning'}
        onConfirm={confirmAction}
        onCancel={() => setModal({ ...modal, isOpen: false })}
      />

      <div className="border-b border-border bg-muted/50 px-6 py-5">
        <h2 className="flex items-center gap-2.5 text-lg font-bold text-brand-navy">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
            <FileText className="h-4.5 w-4.5 text-secondary-foreground" />
          </span>
          Envio de Boletos (Vencimentos)
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          Avisos de cobrança programados para 5 dias e 1 dia antes do vencimento.
        </p>
      </div>

      <div className="flex border-b border-border">
        <button
          onClick={() => setTab('pendentes')}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            tab === 'pendentes'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
          }`}
        >
          Pendentes ({pendentes.length})
        </button>
        <button
          onClick={() => setTab('concluidos')}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            tab === 'concluidos'
              ? 'border-b-2 border-primary text-primary'
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
