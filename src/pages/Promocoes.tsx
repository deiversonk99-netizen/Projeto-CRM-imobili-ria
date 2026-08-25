import React, { useState, useMemo, useEffect } from 'react';
import { Cadastro } from '../types';
import { useCampanhas, useCampanhaDestinatarios } from '../features/promocoes/hooks/useCampanhas';
import { extrairVinculos, aplicarFiltrosVinculos, agruparContatos } from '../features/promocoes/domain';
import { FiltrosPromocao, Campanha } from '../features/promocoes/types';
import { PromotionFilters } from '../features/promocoes/components/PromotionFilters';
import { AudienceResults } from '../features/promocoes/components/AudienceResults';
import { CampaignForm } from '../features/promocoes/components/CampaignForm';
import { CampaignQueue } from '../features/promocoes/components/CampaignQueue';
import { Archive, Edit3, LayoutList, Loader2, Megaphone, PauseCircle, PlayCircle } from 'lucide-react';
import { gerarTextoMensagem } from '../features/promocoes/domain';
import { useData } from '../context/DataContext';

interface Props {
  cadastros: Cadastro[];
}

export default function Promocoes({ cadastros }: Props) {
  const [activeTab, setActiveTab] = useState<'publico' | 'campanhas'>('publico');
  const [selectedCampanha, setSelectedCampanha] = useState<Campanha | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editingCampanha, setEditingCampanha] = useState<Campanha | null>(null);
  const [deletingCampanha, setDeletingCampanha] = useState<Campanha | null>(null);
  const [editNome, setEditNome] = useState('');
  const [editDescricao, setEditDescricao] = useState('');
  const [editMensagemTemplate, setEditMensagemTemplate] = useState('');
  const [updatingCampaignId, setUpdatingCampaignId] = useState<string | null>(null);
  const [excludedContactKeys, setExcludedContactKeys] = useState<Set<string>>(new Set());
  const { condominios } = useData();

  const { campanhas, loading: loadingCampanhas, error: errorCampanhas, fetchCampanhas, saveCampanha, iniciarCampanha, arquivarCampanha, updateCampanha, setCampanhaAtiva } = useCampanhas();
  const { destinatarios, loading: loadingDest, error: errorDest, fetchDestinatarios, updateStatus } = useCampanhaDestinatarios(selectedCampanha?.id || null);

  const [filtros, setFiltros] = useState<FiltrosPromocao>({
    busca: '',
    perfil: 'Todos',
    valorMin: '',
    valorMax: '',
    tiposImovel: [],
    finalidades: [],
    condominios: [],
    status: 'Ativo'
  });

  const condominiosDisponiveis = useMemo(() => {
    const set = new Set([
      ...condominios.filter(item => item.ativo).map(item => item.nome),
      ...(cadastros.map(c => c.condominio).filter(Boolean) as string[]),
    ]);
    return Array.from(set).sort();
  }, [cadastros, condominios]);

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

  const selectedContacts = useMemo(
    () => contatos.filter(contact => !excludedContactKeys.has(contact.contactKey)),
    [contatos, excludedContactKeys],
  );

  useEffect(() => {
    const availableKeys = new Set(contatos.map(contact => contact.contactKey));
    setExcludedContactKeys(previous => new Set(Array.from(previous).filter(key => availableKeys.has(key))));
  }, [contatos]);

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
    if (filtros.valorMin !== '' && filtros.valorMax !== '' && Number(filtros.valorMin) > Number(filtros.valorMax)) {
      alert('O valor mínimo não pode ser maior que o valor máximo.');
      return;
    }
    if (selectedContacts.length === 0) {
      alert('Nenhum contato encontrado com os filtros atuais.');
      return;
    }
    setIsCreating(true);
  };

  const handleDelete = (c: Campanha) => {
    setDeletingCampanha(c);
  };
  
  const confirmDelete = async () => {
    if (!deletingCampanha) return;
    setUpdatingCampaignId(deletingCampanha.id);
    try {
      await arquivarCampanha(deletingCampanha);
      setDeletingCampanha(null);
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'Erro ao arquivar campanha.');
    } finally {
      setUpdatingCampaignId(null);
    }
  };

  const handleEdit = (c: Campanha) => {
    setEditingCampanha(c);
    setEditNome(c.nome);
    setEditDescricao(c.descricao || '');
    setEditMensagemTemplate(c.mensagemTemplate || '');
  };

  const saveEdit = async () => {
    if (!editingCampanha) return;
    try {
      await updateCampanha(editingCampanha, { nome: editNome, descricao: editDescricao, mensagemTemplate: editMensagemTemplate });
      setEditingCampanha(null);
    } catch (err) {
      alert('Erro ao editar campanha.');
    }
  };

  const buildRecipients = (campaign: Campanha, campaignContacts = contatos) => campaignContacts.map(contact => ({
    contactKey: contact.contactKey,
    nome: contact.nomes[0] || 'Cliente',
    telefone: contact.telefoneNormalizado,
    perfisJson: JSON.stringify(contact.perfis),
    cadastroIdsJson: JSON.stringify(contact.vinculosFiltrados.map(vinculo => vinculo.cadastroId)),
    contratosJson: JSON.stringify(contact.vinculosFiltrados.map(vinculo => vinculo.contrato)),
    contextoJson: JSON.stringify({
      originais: contact.nomes,
      inquilinos: Array.from(new Set(contact.vinculosFiltrados.map(vinculo => vinculo.nomeInquilino).filter(Boolean))),
      proprietarios: Array.from(new Set(contact.vinculosFiltrados.map(vinculo => vinculo.nomeProprietario).filter(Boolean))),
    }),
    mensagemRenderizada: gerarTextoMensagem(campaign.mensagemTemplate, contact, campaign.nome),
  }));

  const handleSalvarEIniciar = async (nome: string, descricao: string, mensagem: string) => {
    try {
      const audienceSnapshot = {
        ...filtros,
        selectedContactKeys: selectedContacts.map(contact => contact.contactKey).sort(),
      };
      const saved = await saveCampanha(nome, descricao, mensagem, JSON.stringify(audienceSnapshot));
      
      const result = await iniciarCampanha(saved, buildRecipients(saved, selectedContacts));
      
      setIsCreating(false);
      setActiveTab('campanhas');
      setSelectedCampanha({ ...saved, status: 'INICIADA', version: result.version || saved.version });
    } catch (err) {
      throw err;
    }
  };

  const handleStartDraft = async (campaign: Campanha) => {
    setUpdatingCampaignId(campaign.id);
    try {
      const campaignFilters = JSON.parse(campaign.filtrosJson) as FiltrosPromocao;
      const allLinks = extrairVinculos(cadastros);
      const filteredLinks = aplicarFiltrosVinculos(allLinks, campaignFilters);
      const selectedKeys = new Set(campaignFilters.selectedContactKeys || []);
      const campaignContacts = agruparContatos(filteredLinks, allLinks, campaignFilters).filter(contact =>
        contact.telefoneValido && (selectedKeys.size === 0 || selectedKeys.has(contact.contactKey)),
      );
      if (campaignContacts.length === 0) throw new Error('O público salvo não possui mais telefones válidos.');
      const result = await iniciarCampanha(campaign, buildRecipients(campaign, campaignContacts));
      setSelectedCampanha({ ...campaign, status: 'INICIADA', version: result.version || campaign.version });
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Erro ao iniciar campanha.');
    } finally {
      setUpdatingCampaignId(null);
    }
  };

  const handleToggleActive = async (campaign: Campanha) => {
    setUpdatingCampaignId(campaign.id);
    try {
      await setCampanhaAtiva(campaign, !campaign.ativa);
      if (selectedCampanha?.id === campaign.id) setSelectedCampanha({ ...campaign, ativa: !campaign.ativa });
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Erro ao alterar a situação da campanha.');
    } finally {
      setUpdatingCampaignId(null);
    }
  };

  if (isCreating) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <h2 className="text-2xl font-bold">Criar Nova Campanha</h2>
        <CampaignForm 
          filtrosAtuais={filtros}
          contatosEncontrados={selectedContacts}
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
              disabled={selectedContacts.length === 0}
              className="px-6 py-3 bg-brand-navy text-white rounded-xl font-medium shadow hover:bg-brand-navy/90 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <Megaphone className="h-5 w-5" />
              Criar Campanha com estes {selectedContacts.length} contatos
            </button>
          </div>
          <AudienceResults 
            contatos={contatos} 
            totalExcluidos={totalExcluidos} 
            totalCompartilhados={totalCompartilhados}
            excludedContactKeys={excludedContactKeys}
            onToggleContact={(contactKey) => setExcludedContactKeys(previous => {
              const next = new Set(previous);
              if (next.has(contactKey)) next.delete(contactKey); else next.add(contactKey);
              return next;
            })}
            onSelectAll={() => setExcludedContactKeys(new Set())}
            onClearSelection={() => setExcludedContactKeys(new Set(contatos.map(contact => contact.contactKey)))}
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
              {campanhas.map((c, index) => (
                <div key={`${c.id}-${c.createdAt}-${index}`} className={`bg-card border border-border p-5 rounded-2xl shadow-sm flex flex-col transition-colors ${c.ativa ? 'hover:border-primary/50' : 'opacity-70 bg-muted/30'}`}>
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="font-bold text-lg leading-tight line-clamp-2 pr-2">{c.nome}</h3>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full uppercase ${
                        c.status === 'RASCUNHO' ? 'bg-slate-100 text-slate-700' : 
                        c.status === 'INICIADA' ? 'bg-blue-100 text-blue-700' : 
                        c.status === 'CONCLUIDA' ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'
                      }`}>
                        {c.status}
                      </span>
                      {c.status === 'RASCUNHO' && c.ativa && <button onClick={() => handleEdit(c)} className="p-1.5 text-muted-foreground hover:bg-slate-100 rounded-lg transition-colors" title="Editar">
                        <Edit3 className="w-4 h-4" />
                      </button>}
                      {c.status !== 'ARQUIVADA' && <button disabled={updatingCampaignId === c.id} onClick={() => handleDelete(c)} className="p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50" title="Arquivar">
                        <Archive className="w-4 h-4" />
                      </button>}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-2 min-h-[40px]">{c.descricao || 'Sem descrição'}</p>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className={`text-xs font-semibold ${c.ativa ? 'text-green-700' : 'text-amber-700'}`}>{c.ativa ? 'Campanha ativa' : 'Campanha desativada'}</p>
                    {c.status !== 'ARQUIVADA' && c.status !== 'CANCELADA' && (
                      <button
                        disabled={updatingCampaignId === c.id}
                        onClick={() => handleToggleActive(c)}
                        className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-50"
                      >
                        {c.ativa ? <PauseCircle className="h-3.5 w-3.5" /> : <PlayCircle className="h-3.5 w-3.5" />}
                        {c.ativa ? 'Desativar' : 'Reativar'}
                      </button>
                    )}
                  </div>
                  
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
                      onClick={() => c.status === 'RASCUNHO' ? handleStartDraft(c) : setSelectedCampanha(c)}
                      disabled={!c.ativa || updatingCampaignId === c.id || c.status === 'ARQUIVADA' || c.status === 'CANCELADA'}
                      className="w-full py-2.5 bg-primary/10 text-primary hover:bg-primary/20 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {updatingCampaignId === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : c.status === 'RASCUNHO' ? 'Iniciar campanha' : 'Abrir fila de envio'} &rarr;
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    

      {deletingCampanha && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl text-center">
            <h2 className="text-xl font-bold text-slate-800 mb-2">Arquivar campanha</h2>
            <p className="text-slate-600 mb-6">
              A campanha <strong className="text-slate-800">"{deletingCampanha.nome}"</strong> será arquivada. Destinatários e histórico serão preservados.
            </p>
            <div className="flex gap-3 justify-center">
              <button 
                onClick={() => setDeletingCampanha(null)}
                className="px-4 py-2 font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors flex-1"
              >
                Cancelar
              </button>
              <button 
                onClick={confirmDelete}
                disabled={updatingCampaignId === deletingCampanha.id}
                className="px-4 py-2 font-medium bg-red-600 text-white hover:bg-red-700 rounded-lg transition-colors flex-1 disabled:opacity-50"
              >
                {updatingCampaignId === deletingCampanha.id ? 'Arquivando...' : 'Arquivar'}
              </button>
            </div>
          </div>
        </div>
      )}
      {editingCampanha && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-xl font-bold mb-4">Editar Campanha</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nome da Campanha</label>
                <input 
                  type="text" 
                  value={editNome} 
                  onChange={(e) => setEditNome(e.target.value)} 
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-navy"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Descrição</label>
                <textarea 
                  value={editDescricao} 
                  onChange={(e) => setEditDescricao(e.target.value)} 
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-navy resize-none"
                  rows={3}
                ></textarea>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Mensagem (Template)</label>
                <textarea 
                  value={editMensagemTemplate}
                  onChange={(e) => setEditMensagemTemplate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-navy resize-none"
                  rows={6}
                ></textarea>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button 
                onClick={() => setEditingCampanha(null)} 
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 font-medium rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={saveEdit} 
                className="px-4 py-2 bg-brand-navy text-white font-medium rounded-lg hover:bg-brand-navy/90 transition-colors"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
</div>
  );
}
