import React, { useState } from 'react';
import { Campanha, CampanhaDestinatario, DestinatarioStatus } from '../types';
import { MessageSquare, CheckCircle, AlertCircle, XCircle, ArrowRight, Loader2, Play } from 'lucide-react';
import { criarLinkWhatsApp } from '../domain';

interface Props {
  campanha: Campanha;
  destinatarios: CampanhaDestinatario[];
  onUpdateStatus: (id: string, version: number, status: DestinatarioStatus, extra?: Partial<CampanhaDestinatario>) => Promise<void>;
  onVoltar: () => void;
}

export function CampaignQueue({ campanha, destinatarios, onUpdateStatus, onVoltar }: Props) {
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const getStatusBadge = (status: DestinatarioStatus) => {
    switch(status) {
      case 'PENDENTE': return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">Pendente</span>;
      case 'WHATSAPP_ABERTO': return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 border border-blue-200 flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin"/> Aberto</span>;
      case 'ENVIO_CONFIRMADO': return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200 flex items-center gap-1"><CheckCircle className="h-3 w-3"/> Confirmado</span>;
      case 'IGNORADO': return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700 border border-orange-200 flex items-center gap-1"><ArrowRight className="h-3 w-3"/> Pulado</span>;
      case 'ERRO': return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 border border-red-200 flex items-center gap-1"><AlertCircle className="h-3 w-3"/> Erro</span>;
    }
  };

  const handleAbrirWhatsApp = async (d: CampanhaDestinatario) => {
    try {
      const url = criarLinkWhatsApp(d.telefone, d.mensagemRenderizada);
      const popup = window.open('', '_blank');
      
      if (!popup) {
         alert('O navegador bloqueou a abertura do WhatsApp. Por favor, permita pop-ups para este site.');
         return;
      }
      
      popup.opener = null;
      popup.location.href = url;
      
      if (d.status === 'PENDENTE') {
        setUpdatingId(d.id);
        try {
          await onUpdateStatus(d.id, d.version, 'WHATSAPP_ABERTO', { whatsappAbertoEm: new Date().toISOString() });
        } catch (updateErr) {
          console.error(updateErr);
          alert('WhatsApp foi aberto, mas houve erro ao atualizar status no sistema. Tente confirmar o envio depois.');
        }
      }
    } catch(err) {
      console.error(err);
      alert('Erro inesperado.');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleConfirmar = async (d: CampanhaDestinatario) => {
    setUpdatingId(d.id);
    try {
      await onUpdateStatus(d.id, d.version, 'ENVIO_CONFIRMADO', { envioConfirmadoEm: new Date().toISOString() });
    } catch(err) {
      console.error(err);
      alert('Erro ao confirmar envio.');
    } finally {
      setUpdatingId(null);
    }
  };

  const handlePular = async (d: CampanhaDestinatario) => {
    setUpdatingId(d.id);
    try {
      await onUpdateStatus(d.id, d.version, 'IGNORADO', { ignoradoEm: new Date().toISOString() });
    } catch(err) {
      console.error(err);
      alert('Erro ao pular.');
    } finally {
      setUpdatingId(null);
    }
  };

  const pendentes = destinatarios.filter(d => d.status === 'PENDENTE' || d.status === 'WHATSAPP_ABERTO');
  const concluidos = destinatarios.filter(d => d.status === 'ENVIO_CONFIRMADO' || d.status === 'IGNORADO' || d.status === 'ERRO');

  // Encontrar o próximo destinatário lógico (primeiro pendente, ou o primeiro aberto que ainda precisa ser confirmado)
  const proximoId = pendentes[0]?.id;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={onVoltar} className="text-sm font-medium text-muted-foreground hover:text-foreground">
          &larr; Voltar
        </button>
        <h2 className="text-xl font-bold text-foreground">Fila de Envio: {campanha.nome}</h2>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border p-4 rounded-2xl shadow-sm text-center">
          <span className="block text-3xl font-black text-primary">{destinatarios.length}</span>
          <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Total</span>
        </div>
        <div className="bg-card border border-border p-4 rounded-2xl shadow-sm text-center">
          <span className="block text-3xl font-black text-amber-500">{pendentes.length}</span>
          <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Na Fila</span>
        </div>
        <div className="bg-card border border-border p-4 rounded-2xl shadow-sm text-center">
          <span className="block text-3xl font-black text-green-500">{destinatarios.filter(d => d.status === 'ENVIO_CONFIRMADO').length}</span>
          <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Enviados</span>
        </div>
        <div className="bg-card border border-border p-4 rounded-2xl shadow-sm text-center">
          <span className="block text-3xl font-black text-slate-400">{destinatarios.filter(d => d.status === 'IGNORADO').length}</span>
          <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Pulados</span>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden flex flex-col">
        <div className="divide-y divide-border overflow-y-auto max-h-[700px]">
          {destinatarios.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Nenhum destinatário.</div>
          ) : (
            destinatarios.map(d => {
              const isNext = d.id === proximoId;
              const isUpdating = updatingId === d.id;

              return (
                <div key={d.id} className={`p-5 transition-colors ${isNext ? 'bg-primary/5 border-l-4 border-l-primary' : 'hover:bg-muted/20 border-l-4 border-l-transparent'}`}>
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-3">
                        {isNext && <span className="flex h-2 w-2 rounded-full bg-primary animate-pulse" title="Próximo da fila"></span>}
                        <h4 className="font-semibold text-base">{d.nome}</h4>
                        {getStatusBadge(d.status)}
                      </div>
                      
                      <div className="text-sm text-muted-foreground font-medium flex items-center gap-2">
                        {d.telefone}
                        {d.perfisJson && JSON.parse(d.perfisJson).map((p: string) => (
                           <span key={p} className="px-1.5 py-0.5 bg-muted rounded text-[10px] uppercase">{p}</span>
                        ))}
                      </div>

                      <div className="mt-2 bg-background border border-border/50 rounded-lg p-3 text-sm text-foreground whitespace-pre-wrap">
                        {d.mensagemRenderizada}
                      </div>
                    </div>

                    <div className="shrink-0 flex flex-col gap-2 pt-2 md:pt-0 min-w-[200px]">
                      {d.status === 'PENDENTE' && (
                        <div className="flex flex-col gap-2">
                          <button 
                            disabled={isUpdating}
                            onClick={() => {
                              if (window.confirm("Confirmar envio mesmo assim? Só faça isso se você já enviou a mensagem pelo WhatsApp.")) {
                                handleConfirmar(d);
                              }
                            }}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition-colors shadow-sm disabled:opacity-50 text-xs"
                          >
                            Confirmar envio mesmo assim
                          </button>
                        </div>
                      )}

                      {d.status === 'WHATSAPP_ABERTO' && (
                        <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-top-2">
                          <button 
                            disabled={isUpdating}
                            onClick={() => handleConfirmar(d)}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition-colors shadow-sm disabled:opacity-50"
                          >
                            {isUpdating ? <Loader2 className="h-4 w-4 animate-spin"/> : <CheckCircle className="h-4 w-4" />}
                            2. Confirmar Envio
                          </button>
                          <button 
                            disabled={isUpdating}
                            onClick={() => handleAbrirWhatsApp(d)}
                            className="w-full text-xs font-medium text-muted-foreground hover:text-foreground underline decoration-dotted"
                          >
                            Reabrir WhatsApp
                          </button>
                        </div>
                      )}

                      {(d.status === 'PENDENTE' || d.status === 'WHATSAPP_ABERTO') && (
                        <button 
                          disabled={isUpdating}
                          onClick={() => handlePular(d)}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-background border border-border text-muted-foreground rounded-xl font-medium hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50 mt-1"
                        >
                          <XCircle className="h-4 w-4" /> Pular (Ignorar)
                        </button>
                      )}

                      {(d.status === 'ENVIO_CONFIRMADO' || d.status === 'IGNORADO') && (
                        <div className="flex flex-col items-center justify-center h-full text-sm text-muted-foreground">
                          <span className="italic">Processado</span>
                          <span className="text-xs">{new Date(d.envioConfirmadoEm || d.ignoradoEm || d.updatedAt).toLocaleTimeString()}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
