'use client'

import React, { useEffect, useState } from 'react'
import { db } from '../store'
import { checkBirthday, getWhatsappLink } from '../utils/dates'
import { Gift, MessageCircle, CheckCircle, CalendarDays } from 'lucide-react'

interface BirthdayItem {
  id: string
  nome: string
  tipo: 'Proprietário' | 'Inquilino'
  telefone: string
  dataStr: string
  diasAte: number
  contrato: string
}

export default function Aniversarios() {
  const [aniversariantes, setAniversariantes] = useState<BirthdayItem[]>([])
  const [loading, setLoading] = useState(true)
  const currentYear = new Date().getFullYear().toString()

  const loadData = () => {
    setLoading(true)
    const cadastros = db.getCadastros()
    const tarefas = db.getTarefas()

    const doneIds = new Set(
      tarefas
        .filter((t) => t.tipo === 'Aniversário' && t.referencia === currentYear)
        .map((t) => `${t.contrato}-${t.usuario}`),
    )

    const result: BirthdayItem[] = []

    cadastros.forEach((c) => {
      const propBday = checkBirthday(c.niverProp)
      if (propBday && !doneIds.has(`${c.contrato}-Proprietário`)) {
        result.push({
          id: `${c.id}-prop`,
          nome: c.nomeProp,
          tipo: 'Proprietário',
          telefone: c.telProp,
          dataStr: propBday.dateStr,
          diasAte: propBday.daysAway,
          contrato: c.contrato,
        })
      }

      const inqBday = checkBirthday(c.niverInq)
      if (inqBday && !doneIds.has(`${c.contrato}-Inquilino`)) {
        result.push({
          id: `${c.id}-inq`,
          nome: c.nomeInq,
          tipo: 'Inquilino',
          telefone: c.telInq,
          dataStr: inqBday.dateStr,
          diasAte: inqBday.daysAway,
          contrato: c.contrato,
        })
      }
    })

    result.sort((a, b) => a.diasAte - b.diasAte)
    setAniversariantes(result)
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleMarcarFeito = async (item: BirthdayItem) => {
    await db.saveTarefa({
      contrato: item.contrato,
      tipo: 'Aniversário',
      usuario: item.tipo,
      referencia: currentYear,
    })
    loadData()
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="border-b border-border bg-muted/50 px-6 py-5">
        <h2 className="flex items-center gap-2.5 text-lg font-bold text-brand-navy">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
            <Gift className="h-4.5 w-4.5 text-secondary-foreground" />
          </span>
          Aniversários Próximos
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          Mostrando aniversariantes de hoje e dos próximos 3 dias.
        </p>
      </div>

      <div>
        {loading ? (
          <div className="flex justify-center p-8 text-muted-foreground">Carregando...</div>
        ) : aniversariantes.length === 0 ? (
          <div className="flex flex-col items-center p-14 text-center text-muted-foreground">
            <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Gift className="h-7 w-7 text-muted-foreground/50" />
            </span>
            <p className="font-medium">Nenhum aniversário nos próximos dias.</p>
            <p className="mt-1 text-sm">Os aniversariantes aparecerão aqui automaticamente.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {aniversariantes.map((item) => {
              const text = `Olá ${item.nome}! A IMG Imóveis Mogi Guaçu deseja um Feliz Aniversário! 🎉`
              const isToday = item.diasAte === 0

              return (
                <li
                  key={item.id}
                  className="flex flex-col justify-between gap-4 p-6 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center"
                >
                  <div>
                    <div className="mb-1.5 flex items-center gap-2">
                      <span
                        className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                          isToday
                            ? 'bg-warning text-warning-foreground'
                            : 'bg-secondary text-secondary-foreground'
                        }`}
                      >
                        <CalendarDays className="h-3 w-3" />
                        {item.dataStr}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        Contrato: {item.contrato}
                      </span>
                    </div>
                    <p className="font-semibold text-foreground">{item.nome}</p>
                    <p className="text-sm text-muted-foreground">{item.tipo}</p>
                  </div>

                  <div className="flex items-center gap-3">
                    <a
                      href={getWhatsappLink(item.telefone, text)}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm shadow-primary/20 transition-all hover:brightness-105"
                    >
                      <MessageCircle className="h-4 w-4" />
                      WhatsApp
                    </a>
                    <button
                      onClick={() => handleMarcarFeito(item)}
                      className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <CheckCircle className="h-4 w-4" />
                      Marcar Feito
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
