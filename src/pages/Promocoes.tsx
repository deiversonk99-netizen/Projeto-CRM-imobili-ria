import React, { useState, useMemo, useEffect } from 'react';
import { Cadastro } from '../types';
import { useCampanhas, useCampanhaDestinatarios } from '../features/promocoes/hooks/useCampanhas';
import { extrairVinculos, aplicarFiltrosVinculos, agruparContatos } from '../features/promocoes/domain';
import { FiltrosPromocao, Campanha, CampanhaDestinatario } from '../features/promocoes/types';
import { PromotionFilters } from '../features/promocoes/components/PromotionFilters';
import { AudienceResults } from '../features/promocoes/components/AudienceResults';
import { CampaignForm } from '../features/promocoes/components/CampaignForm';
import { CampaignQueue } from '../features/promocoes/components/CampaignQueue';
import { LayoutList, Megaphone, Loader2 } from 'lucide-react';
import { gerarTextoMensagem } from '../features/promocoes/domain';

interface Props {
  cadastros: Cadastro[];
}

export default function Promocoes({ cadastros }: Props) {
  const [activeTab, setActiveTab] = useState<'publico' | 'campanhas'>('publico');
  const [selectedCampanha, setSelectedCampanha] = useState<Campanha | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const { campanhas, loading: loadingCampanhas, error: errorCampanhas, fetchCampanhas, saveCampanha, iniciarCampanha } = useCampanhas();
  const { destinatarios, loading: loadingDest, error: errorDest, fetchDestinatarios, updateStatus } = useCampanhaDestinatarios(selectedCampanha?.id || null);

  const [filtros, setFiltros] = useState<FiltrosPromocao>({
    busca: '',
    perfil: 'Proprietário',
    valorMin: '',
    valorMax: '',
    tiposImovel: [],
    finalidades: [],
    condominios: [],
    status: 'Ativo'
  });

  const condominiosDisponiveis = useMemo(() => {
    const set = new Set((cadastros.map(c => c.condominio).filter(Boolean) as string[]));
    return Array.from(set).sort();
  }, [cadastros]);

  const { contatos, totalExcluidos, totalCompartilhados } = useMemo(() => {
    const todosVinculos = extrairVinculos(cadastros);
    const vinculosFiltrados = aplicarFiltrosVinculos(todosVinculos, filtros);
    const agrupados = agruparContatos(vinculosFiltrados, todosVinculos, filtros);
    
    const comTelefone = agrupados.filter(c => c.telefoneValido);
    const semTelefone = agrupados.length - comTelefone.length;
    const compartilhados = comTelefone.filter(c => c.telefoneCompartilhado).length;

    return { 
      contatos: comTelefone, 
      totalExcluidos: semTelefone, 
      totalCompartilhados: compartilhados 
    };
  }, [cadastros, filtros]);

  // Carregar campanhas quando entrar na aba
  useEffect(() => {
    if (activeTab === 'campanhas') {
      fetchCampanhas();
    }
  }, [activeTab, fetchCampanhas]);

  // Carregar destinatários quando selecionar campanha
  useEffect(() => {
    if (selectedCampanha) {
      fetchDestinatarios();
    }
  }, [selectedCampanha, fetchDestinatarios]);

  const handleIniciarCriacao = () => {
    if (contatos.length === 0) {
      alert('Nenhum contato encontrado com os filtros atuais.');
      return;
    }
    setIsCreating(true);
  };

  const handleSalvarEIniciar = async (nome: string, descricao: string, mensagem: string) => {
    try {
      const saved = await saveCampanha(nome, descricao, mensagem, JSON.stringify(filtros));
      
      const payloadDestinatarios = contatos.map(c => ({
        contactKey: c.contactKey,
        nome: c.nomes[0] || 'Cliente',
        telefone: c.telefoneNormalizado,
        perfisJson: JSON.stringify(c.perfis),
        cadastroIdsJson: JSON.stringify(c.vinculosFiltrados.map(v => v.cadastroId)),
        contratosJson: JSON.stringify(c.vinculosFiltrados.map(v => v.contrato)),
        contextoJson: JSON.stringify({ 
          originais: c.nomes, 
          inquilinos: Array.from(new Set(c.vinculosFiltrados.map(v => v.nomeInquilino).filter(Boolean))),
          proprietarios: Array.from(new Set(c.vinculosFiltrados.map(v => v.nomeProprietario).filter(Boolean)))
        }),
        mensagemRenderizada: gerarTextoMensagem(mensagem, c, nome)
      }));

      await iniciarCampanha(saved, payloadDestinatarios);
      
      setIsCreating(false);
      setActiveTab('campanhas');
      setSelectedCampanha({ ...saved, status: 'INICIADA' });
    } catch (err) {
      throw err;
    }
  };

  if (isCreating) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <h2 className="text-2xl font-bold">Criar Nova Campanha</h2>
        <CampaignForm 
          filtrosAtuais={filtros}
          contatosEncontrados={contatos}
          onIniciar={handleSalvarEIniciar}
          onCancel={() => setIsCreating(false)}
        />
      </div>
    );
  }

  if (selectedCampanha) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        {loadingDest ? (
          <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
             <Loader2 className="h-8 w-8 animate-spin mb-4" />
             <p>Carregando destinatários da campanha...</p>
          </div>
        ) : errorDest ? (
          <div className="p-8 bg-red-50 text-red-700 rounded-2xl border border-red-200 text-center">
             <p>{errorDest}</p>
             <button onClick={fetchDestinatarios} className="mt-4 px-4 py-2 bg-red-100 rounded-xl font-medium hover:bg-red-200">Tentar Novamente</button>
          </div>
        ) : (
          <CampaignQueue 
            campanha={selectedCampanha}
            destinatarios={destinatarios}
            onUpdateStatus={updateStatus}
            onVoltar={() => setSelectedCampanha(null)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex bg-muted/50 p-1.5 rounded-xl border border-border w-full sm:w-fit">
        <button
          onClick={() => setActiveTab('publico')}
          className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'publico' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <LayoutList className="h-4 w-4" /> Público e Filtros
        </button>
        <button
          onClick={() => setActiveTab('campanhas')}
          className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'campanhas' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Megaphone className="h-4 w-4" /> Campanhas
        </button>
      </div>

      {activeTab === 'publico' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
          <PromotionFilters 
            filtros={filtros} 
            onChange={setFiltros} 
            condominiosDisponiveis={condominiosDisponiveis}
          />
          <div className="flex justify-end">
            <button 
              onClick={handleIniciarCriacao}
              disabled={contatos.length === 0}
              className="px-6 py-3 bg-brand-navy text-white rounded-xl font-medium shadow hover:bg-brand-navy/90 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <Megaphone className="h-5 w-5" />
              Criar Campanha com estes {contatos.length} contatos
            </button>
          </div>
          <AudienceResults 
            contatos={contatos} 
            totalExcluidos={totalExcluidos} 
            totalCompartilhados={totalCompartilhados}
          />
        </div>
      )}

      {activeTab === 'campanhas' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-foreground">Campanhas</h2>
            <button onClick={fetchCampanhas} className="text-sm text-primary hover:underline font-medium">Atualizar</button>
          </div>
          
          {loadingCampanhas ? (
            <div className="flex justify-center p-12 text-muted-foreground">
               <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : errorCampanhas ? (
            <div className="p-6 bg-red-50 text-red-700 rounded-2xl border border-red-200">
               {errorCampanhas}
            </div>
          ) : campanhas.length === 0 ? (
            <div className="p-12 text-center border border-border rounded-2xl bg-card text-muted-foreground">
              Nenhuma campanha criada ainda. Volte para "Público e Filtros" para criar a primeira.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {campanhas.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(c => (
                <div key={c.id} className="bg-card border border-border p-5 rounded-2xl shadow-sm flex flex-col hover:border-primary/50 transition-colors">
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="font-bold text-lg leading-tight line-clamp-2">{c.nome}</h3>
                    <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full uppercase ${
                      c.status === 'RASCUNHO' ? 'bg-slate-100 text-slate-700' : 
                      c.status === 'INICIADA' ? 'bg-blue-100 text-blue-700' : 
                      c.status === 'CONCLUIDA' ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'
                    }`}>
                      {c.status}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-2 min-h-[40px]">{c.descricao || 'Sem descrição'}</p>
                  
                  <div className="mt-auto space-y-4">
                    <div className="flex justify-between text-sm bg-muted/40 p-3 rounded-xl border border-border/50">
                      <div className="flex flex-col">
                        <span className="text-muted-foreground text-xs">Público Total</span>
                        <span className="font-bold">{c.audienciaTotal || '-'}</span>
                      </div>
                      <div className="flex flex-col text-right">
                        <span className="text-muted-foreground text-xs">Criado em</span>
                        <span className="font-medium">{new Date(c.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    
                    <button 
                      onClick={() => setSelectedCampanha(c)}
                      className="w-full py-2.5 bg-primary/10 text-primary hover:bg-primary/20 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2"
                    >
                      {c.status === 'RASCUNHO' ? 'Continuar Edição' : 'Abrir Fila de Envio'} &rarr;
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
