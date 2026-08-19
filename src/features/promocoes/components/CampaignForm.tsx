import React, { useState } from 'react';
import { FiltrosPromocao, ContatoAgrupado } from '../types';
import { gerarTextoMensagem } from '../domain';
import { Check, ChevronRight, MessageSquare, Target, Settings, Play } from 'lucide-react';

interface Props {
  filtrosAtuais: FiltrosPromocao;
  contatosEncontrados: ContatoAgrupado[];
  onIniciar: (nome: string, descricao: string, mensagem: string) => Promise<void>;
  onCancel: () => void;
}

export function CampaignForm({ filtrosAtuais, contatosEncontrados, onIniciar, onCancel }: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [mensagem, setMensagem] = useState('Olá {{nome}}, temos uma novidade para você!');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const previewContato = contatosEncontrados[0] || null;
  const previewText = previewContato ? gerarTextoMensagem(mensagem, previewContato, nome || 'Campanha') : 'Nenhum contato para gerar prévia.';

  const handleNext = () => {
    if (!nome.trim() || !mensagem.trim()) {
      alert('Nome e mensagem são obrigatórios.');
      return;
    }
    setStep(2);
  };

  const handleStart = async () => {
    setIsSubmitting(true);
    try {
      await onIniciar(nome, descricao, mensagem);
    } catch (err) {
      console.error(err);
      alert('Erro ao iniciar campanha: ' + (err as Error).message);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-2xl shadow-lg overflow-hidden">
      {/* Header Wizard */}
      <div className="flex border-b border-border bg-muted/30">
        <div className={`flex-1 p-4 text-center text-sm font-medium border-b-2 transition-colors ${step === 1 ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}>
          1. Informações e Mensagem
        </div>
        <div className={`flex-1 p-4 text-center text-sm font-medium border-b-2 transition-colors ${step === 2 ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}>
          2. Revisão e Público
        </div>
      </div>

      <div className="p-6">
        {step === 1 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
            <div>
              <label className="block text-sm font-medium mb-1.5">Nome da Campanha <span className="text-red-500">*</span></label>
              <input 
                type="text" 
                value={nome}
                onChange={e => setNome(e.target.value)}
                className="w-full rounded-xl border border-input bg-background px-4 py-2 text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                placeholder="Ex: Oferta Fim de Ano - Inquilinos"
                maxLength={100}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1.5">Descrição Interna</label>
              <input 
                type="text" 
                value={descricao}
                onChange={e => setDescricao(e.target.value)}
                className="w-full rounded-xl border border-input bg-background px-4 py-2 text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                placeholder="Ex: Disparo para inquilinos de apartamentos no Centro"
                maxLength={200}
              />
            </div>

            <div>
              <div className="flex justify-between items-end mb-1.5">
                <label className="block text-sm font-medium">Mensagem do WhatsApp <span className="text-red-500">*</span></label>
                <span className="text-xs text-muted-foreground">Variáveis: {'{{nome}}, {{perfil}}, {{campanha}}, {{contratos}}, {{condominios}}'}</span>
              </div>
              <textarea 
                value={mensagem}
                onChange={e => setMensagem(e.target.value)}
                className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none min-h-[150px] resize-y"
                placeholder="Digite a mensagem que será enviada..."
              />
            </div>

            <div className="bg-muted/40 border border-border p-4 rounded-xl">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5"><MessageSquare className="h-4 w-4" /> Prévia da Mensagem (1º contato)</h4>
              <p className="text-sm whitespace-pre-wrap text-foreground bg-background p-3 rounded-lg border border-border/50 shadow-sm">{previewText}</p>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-border mt-6">
              <button onClick={onCancel} className="px-5 py-2 rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">Cancelar</button>
              <button onClick={handleNext} className="px-5 py-2 rounded-xl text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-2">Continuar <ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              <div className="space-y-4">
                <h3 className="font-semibold flex items-center gap-2"><Target className="h-5 w-5 text-primary" /> Público Alvo Congelado</h3>
                <ul className="space-y-2 text-sm">
                  <li className="flex justify-between p-3 bg-muted/30 rounded-lg border border-border/50">
                    <span className="text-muted-foreground">Contatos Únicos a enviar:</span>
                    <span className="font-bold">{contatosEncontrados.length}</span>
                  </li>
                  <li className="flex justify-between p-3 bg-muted/30 rounded-lg border border-border/50">
                    <span className="text-muted-foreground">Filtro de Perfil Base:</span>
                    <span className="font-medium">{filtrosAtuais.perfil}</span>
                  </li>
                  <li className="flex justify-between p-3 bg-muted/30 rounded-lg border border-border/50">
                    <span className="text-muted-foreground">Termo de Busca:</span>
                    <span className="font-medium">{filtrosAtuais.busca || 'Nenhum'}</span>
                  </li>
                </ul>
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                   <p className="text-xs text-amber-800 font-medium leading-relaxed">
                     Atenção: Ao iniciar, este público será salvo permanentemente. O envio será feito manualmente contato por contato através de links do WhatsApp.
                   </p>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold flex items-center gap-2"><Settings className="h-5 w-5 text-brand-navy" /> Resumo da Campanha</h3>
                <ul className="space-y-3 text-sm">
                  <li>
                    <span className="block text-xs text-muted-foreground mb-1">Nome</span>
                    <span className="font-medium">{nome}</span>
                  </li>
                  <li>
                    <span className="block text-xs text-muted-foreground mb-1">Descrição</span>
                    <span>{descricao || '-'}</span>
                  </li>
                  <li>
                    <span className="block text-xs text-muted-foreground mb-1">Template de Mensagem</span>
                    <span className="text-muted-foreground italic truncate block max-w-full">{mensagem.split('\\n')[0]}...</span>
                  </li>
                </ul>
              </div>

            </div>

            <div className="flex justify-between pt-6 border-t border-border">
              <button 
                onClick={() => setStep(1)} 
                disabled={isSubmitting}
                className="px-5 py-2 rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50"
              >
                Voltar
              </button>
              <button 
                onClick={handleStart} 
                disabled={isSubmitting || contatosEncontrados.length === 0}
                className="px-6 py-2 rounded-xl text-sm font-medium bg-green-600 text-white hover:bg-green-700 transition-colors flex items-center gap-2 disabled:opacity-50 shadow-sm"
              >
                {isSubmitting ? (
                  <span className="animate-pulse">Criando...</span>
                ) : (
                  <><Play className="h-4 w-4 fill-current" /> Iniciar Campanha</>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
