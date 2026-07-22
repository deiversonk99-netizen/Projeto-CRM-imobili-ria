'use client'

import React, { useEffect, useState } from 'react'
import { db } from '../store'
import { checkBoletoWarning, getWhatsappLink } from '../utils/dates'
import { FileText, MessageCircle, CheckCircle } from 'lucide-react'

interface BoletoItem {
  id: string
  contrato: string
  nomeInq: string
  nomeProp: string
  telefone: string
  tipoAviso: '5_dias' | '1_dia'
  diaVencimento: number
}

export default function Boletos() {
  const [boletos, setBoletos] = useState<BoletoItem[]>([])
  const [loading, setLoading] = useState(true)

  // Formato: YYYY-MM
  const currentMonthRef = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`

  const loadData = () => {
    setLoading(true)
    const cadastros = db.getCadastros()
    const tarefas = db.getTarefas()

    const doneIds = new Set(
      tarefas
        .filter((t) => t.tipo.startsWith('Boleto') && t.referencia === currentMonthRef)
        .map((t) => `${t.contrato}-${t.tipo}`),
    )

    const result: BoletoItem[] = []

    cadastros.forEach((c) => {
      const aviso = checkBoletoWarning(c.diaVencimento)
      if (aviso) {
        const tipoStr = aviso === '5_dias' ? 'Boleto 5 dias' : 'Boleto 1 dia'
        if (!doneIds.has(`${c.contrato}-${tipoStr}`)) {
          result.push({
            id: c.id,
            contrato: c.contrato,
            nomeInq: c.nomeInq,
            nomeProp: c.nomeProp,
            telefone: c.telInq,
            tipoAviso: aviso,
            diaVencimento: c.diaVencimento,
          })
        }
      }
    })

    setBoletos(result)
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleMarcarFeito = async (item: BoletoItem) => {
    const tipoStr = item.tipoAviso === '5_dias' ? 'Boleto 5 dias' : 'Boleto 1 dia'
    await db.saveTarefa({
      contrato: item.contrato,
      tipo: tipoStr as 'Boleto 5 dias' | 'Boleto 1 dia',
      usuario: 'Sistema',
      referencia: currentMonthRef,
    })
    loadData()
  }

  const cincoDias = boletos.filter((b) => b.tipoAviso === '5_dias')
  const umDia = boletos.filter((b) => b.tipoAviso === '1_dia')

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
                  <button
                    onClick={() => handleMarcarFeito(item)}
                    className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <CheckCircle className="h-4 w-4" />
                    Feito
                  </button>
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

      <div className="p-6">
        {loading ? (
          <div className="flex justify-center p-8 text-muted-foreground">Carregando...</div>
        ) : (
          <>
            {renderList(umDia, 'Avisar Amanhã (Falta 1 dia)', 'bg-warning-foreground', 'text-warning-foreground')}
            {renderList(cincoDias, 'Avisar em 5 dias', 'bg-brand-navy', 'text-brand-navy')}
          </>
        )}
      </div>
    </div>
  )
}
