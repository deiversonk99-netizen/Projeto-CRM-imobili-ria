import React from 'react';
import { ContatoAgrupado } from '../types';
import { MessageSquare, AlertCircle, Building2, LayoutList } from 'lucide-react';
import { criarLinkWhatsApp } from '../domain';

interface Props {
  contatos: ContatoAgrupado[];
  totalExcluidos: number;
  totalCompartilhados: number;
  excludedContactKeys: Set<string>;
  onToggleContact: (contactKey: string) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
}

export function AudienceResults({ contatos, totalExcluidos, totalCompartilhados, excludedContactKeys, onToggleContact, onSelectAll, onClearSelection }: Props) {
  // Simples pagination para não explodir render
  const [page, setPage] = React.useState(1);
  const itemsPerPage = 20;
  const paginated = contatos.slice(0, page * itemsPerPage);

  const totalVinculos = contatos.reduce((acc, c) => acc + c.vinculosFiltrados.length, 0);

  return (
    <div className="rounded-2xl border border-border bg-card p-0 shadow-sm overflow-hidden flex flex-col">
      <div className="p-4 border-b border-border bg-muted/30">
        <h3 className="font-semibold text-foreground text-lg flex items-center gap-2">
          <LayoutList className="h-5 w-5 text-primary" />
          Resultados da Segmentação
        </h3>
        
        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          <div className="bg-background border border-border px-3 py-2 rounded-lg shadow-sm">
            <span className="text-muted-foreground block text-xs">Contatos Únicos</span>
            <span className="font-bold text-foreground text-base">{contatos.length}</span>
          </div>
          <div className="bg-background border border-border px-3 py-2 rounded-lg shadow-sm">
            <span className="text-muted-foreground block text-xs">Vínculos Correspondentes</span>
            <span className="font-bold text-foreground text-base">{totalVinculos}</span>
          </div>
          {totalExcluidos > 0 && (
            <div className="bg-red-50 border border-red-100 px-3 py-2 rounded-lg shadow-sm">
              <span className="text-red-600 block text-xs flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> Excluídos (S/ Tel)
              </span>
              <span className="font-bold text-red-700 text-base">{totalExcluidos}</span>
            </div>
          )}
          {totalCompartilhados > 0 && (
            <div className="bg-amber-50 border border-amber-100 px-3 py-2 rounded-lg shadow-sm">
              <span className="text-amber-700 block text-xs flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> Telefones Compartilhados
              </span>
              <span className="font-bold text-amber-800 text-base">{totalCompartilhados}</span>
            </div>
          )}
        </div>
        <div className="mt-3 flex items-center gap-3 text-xs">
          <button type="button" onClick={onSelectAll} className="font-semibold text-primary hover:underline">Selecionar todos</button>
          <button type="button" onClick={onClearSelection} className="font-semibold text-muted-foreground hover:underline">Limpar seleção</button>
          <span className="ml-auto text-muted-foreground">{contatos.length - excludedContactKeys.size} selecionados</span>
        </div>
      </div>

      <div className="divide-y divide-border overflow-y-auto max-h-[600px]">
        {contatos.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            Nenhum contato atende aos filtros atuais.
          </div>
        ) : (
          paginated.map(c => (
            <div key={c.contactKey} className="p-4 hover:bg-muted/20 transition-colors">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={!excludedContactKeys.has(c.contactKey)}
                    onChange={() => onToggleContact(c.contactKey)}
                    className="h-4 w-4 accent-primary"
                    aria-label={`Selecionar ${c.nomes.join(' / ')}`}
                  />
                  Enviar
                </label>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-foreground text-base">
                      {c.nomes.join(' / ') || 'Sem Nome'}
                    </p>
                    <div className="flex gap-1">
                      {c.perfis.includes('Proprietário') && (
                        <span className="px-2 py-0.5 bg-brand-navy/10 text-brand-navy rounded text-xs font-medium border border-brand-navy/20">
                          Proprietário
                        </span>
                      )}
                      {c.perfis.includes('Inquilino') && (
                        <span className="px-2 py-0.5 bg-primary/10 text-primary rounded text-xs font-medium border border-primary/20">
                          Inquilino
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <span className="font-medium text-foreground">Tel:</span> 
                      <span className={c.telefoneCompartilhado ? "text-amber-600 font-medium" : ""}>
                        {c.telefoneOriginal || c.telefoneNormalizado}
                      </span>
                    </div>
                  </div>

                  {c.perfis.includes('Proprietário') && (
                    <div className="mt-1 mb-2 text-sm text-muted-foreground">
                      <span className="font-semibold text-foreground">Inquilino(s):</span> {
                        Array.from(new Set(c.vinculosFiltrados.map(v => v.nomeInquilino).filter(Boolean))).join(', ') || 'Nenhum'
                      }
                    </div>
                  )}
                  <div className="mt-2 space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Vínculos que passaram no filtro ({c.vinculosFiltrados.length})</p>
                    {c.vinculosFiltrados.map((v, i) => (
                      <div key={i} className="text-sm bg-background border border-border/50 rounded p-2 flex flex-wrap gap-x-4 gap-y-1 items-center">
                        <span className="font-medium">{v.contrato}</span>
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Building2 className="h-3 w-3" /> {v.tipoImovel || 'N/A'}
                        </span>
                        {v.condominio && <span className="text-muted-foreground truncate max-w-[150px]">{v.condominio}</span>}
                        {v.valorAluguel && <span className="text-green-600 font-medium">R$ {v.valorAluguel.toLocaleString('pt-BR')}</span>}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="shrink-0 flex items-center pt-2 md:pt-0">
                  <a
                    href={criarLinkWhatsApp(c.telefoneNormalizado, 'Olá ' + (c.nomes[0] || ''))}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#25D366] px-4 py-2.5 text-white font-medium hover:bg-[#20bd5a] transition-all shadow-sm w-full md:w-auto"
                  >
                    <MessageSquare className="h-4 w-4" />
                    Contato Livre
                  </a>
                </div>
              </div>
            </div>
          ))
        )}
        
        {paginated.length < contatos.length && (
          <div className="p-4 flex justify-center border-t border-border bg-muted/10">
            <button 
              onClick={() => setPage(p => p + 1)}
              className="px-6 py-2 bg-background border border-border rounded-xl text-sm font-medium hover:bg-muted transition-colors shadow-sm"
            >
              Carregar mais resultados ({contatos.length - paginated.length} restantes)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
