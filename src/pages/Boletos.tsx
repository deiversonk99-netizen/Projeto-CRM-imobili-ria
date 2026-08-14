import React, { useEffect, useState } from 'react'
import { db } from '../store'
import { checkCobrancaWarning, getWhatsappLink } from '../utils/dates'
import { FileText, MessageCircle, CheckCircle, Loader2, Search, AlertTriangle, RefreshCw } from 'lucide-react'
import { useData } from '../context/DataContext'
import { useToast } from '../components/ui/Toast'
import { parseISO, format, isBefore, startOfDay } from 'date-fns'
import type { Cobranca } from '../types'
import { v4 as uuidv4 } from 'uuid'

export default function Boletos() {
  const { cadastros, cobrancas, refreshData } = useData()
  const [loading, setLoading] = useState(false)
  const [processingId, setProcessingId] = useState<string | null>(null)
  
  const [mainTab, setMainTab] = useState<'envios' | 'pendencias'>('envios')
  const [envioTab, setEnvioTab] = useState<'pendentes' | 'concluidos'>('pendentes')
  const [searchTerm, setSearchTerm] = useState('')

  const { addToast } = useToast()

  // Sincroniza as cobranças no carregamento inicial da página
  useEffect(() => {
    let mounted = true;
    const syncAndLoad = async () => {
      setLoading(true);
      try {
        await db.syncCobrancas();
        if (mounted) {
          await refreshData();
        }
      } catch (err) {
        console.error('Erro ao sincronizar cobranças', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    syncAndLoad();
    return () => { mounted = false };
  }, []);

  const toggleEnvioAction = async (cobranca: Cobranca, action: 'marcar' | 'desfazer') => {
    setProcessingId(cobranca.id)
    try {
      const operationId = uuidv4();
      const updatedData = {
        ...cobranca,
        envioConfirmadoEm: action === 'marcar' ? new Date().toISOString() : '',
        envioOperationId: operationId
      };
      
      await db.upsertCobranca(updatedData);
      await refreshData();
      addToast(`Aviso de boleto ${action === 'marcar' ? 'marcado como feito' : 'desfeito'}!`, 'success')
    } catch (err) {
      console.error(err);
      addToast('Erro ao atualizar status do boleto.', 'error')
    } finally {
      setProcessingId(null)
    }
  }

  const markCobrancaPago = async (cobranca: Cobranca) => {
    setProcessingId(cobranca.id)
    try {
      const operationId = uuidv4();
      const updatedData = {
        ...cobranca,
        statusPagamento: 'Pago',
        pagoEm: new Date().toISOString(),
        envioOperationId: operationId // Utilizando este campo para idempotencia geral
      };
      await db.upsertCobranca(updatedData);
      await refreshData();
      addToast('Boleto baixado e marcado como pago!', 'success')
    } catch (err) {
      console.error(err);
      addToast('Erro ao baixar boleto.', 'error')
    } finally {
      setProcessingId(null)
    }
  }

  // Filtragem de dados
  const term = searchTerm.toLowerCase()
  
  // 1. Envios: Cobranças pendentes do mês atual com vencimento próximo
  const enviosCobrancas = cobrancas.filter(c => {
    if (c.statusPagamento !== 'Pendente') return false;
    
    const aviso = checkCobrancaWarning(c.vencimento);
    if (!aviso || aviso === 'atrasado') return false; // Atrasados vão para pendências
    
    const cadastro = cadastros.find(cad => cad.id === c.cadastroId);
    if (!cadastro) return false;
    
    if (term) {
      return String(c.contrato).toLowerCase().includes(term) || 
             (cadastro.nomeInq && cadastro.nomeInq.toLowerCase().includes(term)) ||
             (cadastro.nomeProp && cadastro.nomeProp.toLowerCase().includes(term));
    }
    return true;
  });

  const enviosPendentes = enviosCobrancas.filter(c => !c.envioConfirmadoEm)
  const enviosConcluidos = enviosCobrancas.filter(c => c.envioConfirmadoEm)

  const currentEnviosList = envioTab === 'pendentes' ? enviosPendentes : enviosConcluidos
  const totalEnvios = enviosCobrancas.length
  const progressPercent = totalEnvios === 0 ? 0 : Math.round((enviosConcluidos.length / totalEnvios) * 100)

  // Separar em categorias de aviso (2_dias, 1_dia, hoje)
  const hoje = currentEnviosList.filter(c => checkCobrancaWarning(c.vencimento) === 'hoje')
  const umDia = currentEnviosList.filter(c => checkCobrancaWarning(c.vencimento) === '1_dia')
  const doisDias = currentEnviosList.filter(c => checkCobrancaWarning(c.vencimento) === '2_dias')

  // 2. Pendências: Cobranças pendentes e atrasadas
  const pendingCobrancas = cobrancas.filter(c => {
    if (c.statusPagamento !== 'Pendente') return false;
    
    // Check if it is atrasado
    const today = startOfDay(new Date());
    const vencDate = startOfDay(parseISO(c.vencimento));
    if (!isBefore(vencDate, today)) return false;
    
    const cadastro = cadastros.find(cad => cad.id === c.cadastroId);
    if (term) {
      return String(c.contrato).toLowerCase().includes(term) || 
             (cadastro?.nomeInq && cadastro.nomeInq.toLowerCase().includes(term));
    }
    return true;
  });

  const renderList = (items: Cobranca[], title: string, badgeBg: string, badgeText: string) => {
    if (items.length === 0) return null

    return (
      <div className="mb-8 last:mb-0">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          <span className={`h-2.5 w-2.5 rounded-full ${badgeBg}`} />
          {title} ({items.length})
        </h3>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((cobranca) => {
            const isProcessing = processingId === cobranca.id
            const cadastro = cadastros.find(cad => cad.id === cobranca.cadastroId)
            const text = `Olá ${cadastro?.nomeInq || ''}, tudo bem? Segue o aviso de vencimento do seu boleto referente ao Contrato ${cobranca.contrato}.`

            return (
              <li
                key={cobranca.id}
                className={`group relative flex flex-col justify-between rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/30 hover:shadow-md ${
                  cobranca.envioConfirmadoEm ? 'opacity-60 grayscale-[0.5]' : ''
                }`}
              >
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-bold text-foreground">
                      Contrato: {cobranca.contrato}
                    </span>
                    <span className={`rounded-full bg-muted/50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${badgeText}`}>
                      {title.split('(')[0]}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-foreground line-clamp-1">
                    {cadastro?.nomeInq || 'Desconhecido'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    Venc: {format(parseISO(cobranca.vencimento), 'dd/MM/yyyy')}
                  </p>
                </div>

                <div className="mt-4 flex items-center gap-2">
                  <a
                    href={getWhatsappLink(cadastro?.telInq, text)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-2 text-xs font-semibold text-white transition-all hover:brightness-105"
                  >
                    <MessageCircle className="h-4 w-4" />
                    Avisar
                  </a>
                  
                  {cobranca.envioConfirmadoEm ? (
                    <button
                      onClick={() => toggleEnvioAction(cobranca, 'desfazer')}
                      disabled={isProcessing}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                    >
                      {isProcessing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                      Desfazer
                    </button>
                  ) : (
                    <button
                      onClick={() => toggleEnvioAction(cobranca, 'marcar')}
                      disabled={isProcessing}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary/10 px-3 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/20 disabled:opacity-50"
                    >
                      {isProcessing ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
                      Feito
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            Boletos e Cobranças
            {loading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            Acompanhe o envio de boletos (3 dias) e as inadimplências (Pendências).
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

      <div className="flex border-b border-border bg-card">
        <button
          onClick={() => setMainTab('envios')}
          className={`flex-1 py-4 text-sm font-medium transition-colors ${
            mainTab === 'envios'
              ? 'border-b-2 border-primary text-primary bg-muted/20'
              : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
          }`}
        >
          Envios (Próximos 3 dias)
        </button>
        <button
          onClick={() => setMainTab('pendencias')}
          className={`flex-1 flex items-center justify-center gap-2 py-4 text-sm font-medium transition-colors ${
            mainTab === 'pendencias'
              ? 'border-b-2 border-red-500 text-red-600 bg-red-50/50'
              : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
          }`}
        >
          <AlertTriangle className="h-4 w-4" />
          Pendências ({pendingCobrancas.length})
        </button>
      </div>

      <div className="p-6">
        {mainTab === 'envios' && (
          <div>
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-1.5 w-48 bg-border rounded-full overflow-hidden flex items-center">
                  <div 
                    className={`h-full transition-all duration-500 ${progressPercent === 100 ? 'bg-primary' : 'bg-brand-navy'}`}
                    style={{ width: `${progressPercent}%` }} 
                  />
                </div>
                <p className="text-xs font-semibold text-muted-foreground">
                   {enviosConcluidos.length}/{totalEnvios} Concluídos ({progressPercent}%)
                </p>
              </div>
              
              <div className="flex bg-muted/30 rounded-lg p-1 w-fit">
                <button
                  onClick={() => setEnvioTab('pendentes')}
                  className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    envioTab === 'pendentes'
                      ? 'bg-card shadow-sm text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Pendentes ({enviosPendentes.length})
                </button>
                <button
                  onClick={() => setEnvioTab('concluidos')}
                  className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    envioTab === 'concluidos'
                      ? 'bg-card shadow-sm text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Concluídos ({enviosConcluidos.length})
                </button>
              </div>
            </div>

            {currentEnviosList.length === 0 ? (
              <div className="flex justify-center p-8 text-muted-foreground">
                Nenhum boleto {envioTab === 'pendentes' ? 'pendente' : 'concluído'} neste período.
              </div>
            ) : (
              <>
                {renderList(hoje, 'Vence Hoje', 'bg-red-500', 'text-red-500')}
                {renderList(umDia, 'Avisar Amanhã (1 dia)', 'bg-warning-foreground', 'text-warning-foreground')}
                {renderList(doisDias, 'Avisar em 2 dias', 'bg-brand-navy', 'text-brand-navy')}
              </>
            )}
          </div>
        )}

        {mainTab === 'pendencias' && (
          <div>
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-red-600">
              <span className="h-2.5 w-2.5 rounded-full bg-red-600" />
              Inadimplência - Boletos Vencidos
            </h3>

            {pendingCobrancas.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border bg-muted/40 px-4 py-3 text-sm italic text-muted-foreground">
                Não há cobranças vencidas e pendentes.
              </p>
            ) : (
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                {pendingCobrancas.map(cobranca => {
                  const cadastro = cadastros.find(cad => cad.id === cobranca.cadastroId);
                  const isProcessing = processingId === cobranca.id;
                  
                  const text = `Olá ${cadastro?.nomeInq || ''}, tudo bem? Consta em nosso sistema que o boleto referente ao aluguel (Contrato ${cobranca.contrato}) com vencimento no dia ${format(parseISO(cobranca.vencimento), 'dd/MM/yyyy')} consta como em aberto. Por favor, desconsidere esta mensagem caso o pagamento já tenha sido realizado.`;

                  return (
                    <li
                      key={cobranca.id}
                      className="flex flex-col justify-between gap-4 bg-red-50/30 p-4 transition-colors hover:bg-red-50/50 sm:flex-row sm:items-center"
                    >
                      <div>
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold text-foreground">
                            {cadastro?.nomeInq || 'Locatário Desconhecido'}
                          </span>
                          <span className="rounded-full bg-white border border-red-200 px-2 py-0.5 text-xs font-medium text-red-600">
                            Venceu em: {format(parseISO(cobranca.vencimento), 'dd/MM/yyyy')}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Contrato: {cobranca.contrato} &bull; Comp: {cobranca.competencia} &bull; Valor: R$ {Number(cobranca.valor).toFixed(2)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <a
                          href={getWhatsappLink(cadastro?.telInq, text)}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 rounded-xl bg-[#25D366] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:brightness-105"
                        >
                          <MessageCircle className="h-4 w-4" />
                          Cobrar
                        </a>
                        <button
                          onClick={() => markCobrancaPago(cobranca)}
                          disabled={isProcessing}
                          className="flex items-center gap-1.5 rounded-xl border border-green-200 bg-white px-4 py-2 text-sm font-medium text-green-700 shadow-sm transition-colors hover:bg-green-50 disabled:opacity-50 disabled:cursor-not-allowed w-[130px] justify-center whitespace-nowrap"
                        >
                          {isProcessing ? <Loader2 className="h-4 w-4 animate-spin shrink-0" /> : <CheckCircle className="h-4 w-4 shrink-0" />}
                          {isProcessing ? 'Baixando' : 'Baixar Boleto'}
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
