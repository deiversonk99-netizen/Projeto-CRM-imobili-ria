'use client'

import React, { useEffect, useState } from 'react'
import { db } from '../store'
import { checkBirthday, getWhatsappLink } from '../utils/dates'
import { Gift, MessageCircle, CheckCircle, CalendarDays, Loader2, Search } from 'lucide-react'
import { useData } from '../context/DataContext'
import { useToast } from '../components/ui/Toast'

interface BirthdayItem {
  id: string
  nome: string
  tipo: 'Proprietário' | 'Inquilino'
  telefone: string
  dataStr: string
  diasAte: number
  contrato: string
  isFeito: boolean
}

export default function Aniversarios() {
  const { cadastros, tarefas, refreshData, addTarefaLocally, removeTarefaLocally } = useData()
  const [aniversariantes, setAniversariantes] = useState<BirthdayItem[]>([])
  const [loading, setLoading] = useState(false)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [tab, setTab] = useState<'pendentes' | 'concluidos'>('pendentes')
  const [searchTerm, setSearchTerm] = useState('')
  
  const currentYear = new Date().getFullYear().toString()

  const loadData = () => {
    const doneIds = new Set(
      tarefas
        .filter((t) => t.tipo === 'Aniversário' && String(t.referencia) === currentYear)
        .map((t) => `${t.contrato}-${t.usuario}`),
    )

    const result: BirthdayItem[] = []

    cadastros.forEach((c) => {
      const propBday = checkBirthday(c.niverProp)
      if (propBday) {
        result.push({
          id: `${c.id}-prop`,
          nome: c.nomeProp,
          tipo: 'Proprietário',
          telefone: c.telProp,
          dataStr: propBday.dateStr,
          diasAte: propBday.daysAway,
          contrato: c.contrato,
          isFeito: doneIds.has(`${c.contrato}-Proprietário`),
        })
      }

      const inqBday = checkBirthday(c.niverInq)
      if (inqBday) {
        result.push({
          id: `${c.id}-inq`,
          nome: c.nomeInq,
          tipo: 'Inquilino',
          telefone: c.telInq,
          dataStr: inqBday.dateStr,
          diasAte: inqBday.daysAway,
          contrato: c.contrato,
          isFeito: doneIds.has(`${c.contrato}-Inquilino`),
        })
      }
    })

    result.sort((a, b) => a.diasAte - b.diasAte)
    setAniversariantes(result)
  }

  const { addToast } = useToast()
  
  useEffect(() => {
    if (cadastros && tarefas) {
      loadData()
    }
  }, [cadastros, tarefas])

  const toggleAction = async (item: BirthdayItem, action: 'marcar' | 'desfazer') => {
    setProcessingId(item.id)

    try {
      if (action === 'marcar') {
        const novaTarefa = {
          contrato: String(item.contrato),
          tipo: 'Aniversário' as any,
          usuario: item.tipo,
          referencia: currentYear,
        };
        setAniversariantes(prev => prev.map(a => a.id === item.id ? { ...a, isFeito: true } : a))
        const saved = await db.saveTarefa(novaTarefa)
        addTarefaLocally(saved)
        addToast('Aniversário marcado como feito!', 'success')
      } else {
        const task = tarefas.find(t => t.tipo === 'Aniversário' && String(t.referencia) === currentYear && String(t.contrato) === String(item.contrato) && t.usuario === item.tipo)
        if (task) {
           setAniversariantes(prev => prev.map(a => a.id === item.id ? { ...a, isFeito: false } : a))
           await db.deleteTarefa(task.idTarefa)
           removeTarefaLocally(task.idTarefa)
           addToast('Ação desfeita com sucesso!', 'success')
        }
      }
    } catch (error) {
      addToast(`Erro ao ${action === 'marcar' ? 'marcar' : 'desfazer'} ação.`, 'error')
      await refreshData() // Revert optimistic update on error
    } finally {
      setProcessingId(null)
    }
  }

  const filteredAniversariantes = aniversariantes.filter((a) => {
    const term = searchTerm.toLowerCase()
    return a.nome.toLowerCase().includes(term) || String(a.contrato).toLowerCase().includes(term)
  })

  const pendentes = filteredAniversariantes.filter(a => !a.isFeito)
  const concluidos = filteredAniversariantes.filter(a => a.isFeito)
  const currentList = tab === 'pendentes' ? pendentes : concluidos
  
  const totalItems = filteredAniversariantes.length;
  const progressPercent = totalItems === 0 ? 0 : Math.round((concluidos.length / totalItems) * 100);

  // Group by day
  const groupedList = currentList.reduce((acc, item) => {
    const category = item.diasAte === 0 ? 'Hoje' : item.diasAte === 1 ? 'Amanhã' : 'Próximos Dias'
    if (!acc[category]) acc[category] = []
    acc[category].push(item)
    return acc
  }, {} as Record<string, BirthdayItem[]>)

  const categories = ['Hoje', 'Amanhã', 'Próximos Dias']

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex flex-col justify-between gap-4 border-b border-border bg-muted/50 px-6 py-5 sm:flex-row sm:items-center">
        <div>
          <h2 className="flex items-center gap-2.5 text-lg font-bold text-brand-navy">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
              <Gift className="h-4.5 w-4.5 text-secondary-foreground" />
            </span>
            Aniversários Próximos
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            Mostrando aniversariantes de hoje e dos próximos 3 dias.
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

      <div>
        {loading ? (
          <div className="flex justify-center p-8 text-muted-foreground">Carregando...</div>
        ) : currentList.length === 0 ? (
          <div className="flex flex-col items-center p-14 text-center text-muted-foreground">
            <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Gift className="h-7 w-7 text-muted-foreground/50" />
            </span>
            <p className="font-medium">Nenhum aniversário {tab === 'pendentes' ? 'pendente' : 'concluído'} encontrado.</p>
          </div>
        ) : (
          <div className="flex flex-col">
            {categories.map((category) => {
              const items = groupedList[category]
              if (!items || items.length === 0) return null
              
              return (
                <div key={category} className="border-b border-border last:border-b-0">
                   <div className="bg-muted/30 px-6 py-2 border-b border-border/50 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      {category}
                   </div>
                   <ul className="divide-y divide-border/50">
                    {items.map((item) => {
                      const text = `Olá ${item.nome}, tudo bem? A equipe da IMG Imóveis Mogi Guaçu deseja a você um feliz aniversário! 🥳🎉 Que o seu dia seja repleto de alegria e coisas boas!`
                      const isToday = item.diasAte === 0
                      const isProcessing = processingId === item.id
        
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
                              <span className="text-sm font-medium text-muted-foreground">
                                Contrato: {item.contrato}
                              </span>
                            </div>
                            <p className="font-semibold text-foreground text-base">{item.nome}</p>
                            <p className="text-sm font-medium text-brand-navy">{item.tipo}</p>
                          </div>
        
                          <div className="flex items-center gap-3">
                            <a
                              href={getWhatsappLink(item.telefone, text)}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-1.5 rounded-xl bg-[#25D366] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:brightness-105"
                            >
                              <MessageCircle className="h-4 w-4" />
                              WhatsApp
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
                                className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium text-green-600 shadow-sm transition-colors hover:bg-red-50 hover:text-red-600 hover:border-red-200 disabled:opacity-50 disabled:cursor-not-allowed w-[110px] justify-center whitespace-nowrap"
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
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

