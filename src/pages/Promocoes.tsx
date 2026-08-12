import React, { useState, useMemo } from 'react';
import { Cadastro } from '../types';
import { Search, MessageSquare } from 'lucide-react';

interface PromocoesProps {
  cadastros: Cadastro[];
}

export default function Promocoes({ cadastros }: PromocoesProps) {
  const [precoMin, setPrecoMin] = useState<number | ''>('');
  const [precoMax, setPrecoMax] = useState<number | ''>('');
  const [tipoImovel, setTipoImovel] = useState<string>('');
  const [finalidade, setFinalidade] = useState<string>('');

  const filteredCadastros = useMemo(() => {
    return cadastros.filter(c => {
      // Consider only active contracts or you can consider all? Usually active
      if (c.status !== 'Ativo') return false;

      if (precoMin !== '' && (c.valorAluguel || 0) < Number(precoMin)) return false;
      if (precoMax !== '' && (c.valorAluguel || 0) > Number(precoMax)) return false;
      if (tipoImovel && c.tipoImovel !== tipoImovel) return false;
      if (finalidade && c.finalidade !== finalidade) return false;

      return true;
    });
  }, [cadastros, precoMin, precoMax, tipoImovel, finalidade]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-xl font-bold text-foreground mb-4">Filtros de Promoção</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-muted-foreground">
              Preço Mínimo (R$)
            </label>
            <input
              type="number"
              value={precoMin}
              onChange={(e) => setPrecoMin(e.target.value ? Number(e.target.value) : '')}
              className="w-full rounded-xl border border-border bg-background px-4 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="0,00"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-muted-foreground">
              Preço Máximo (R$)
            </label>
            <input
              type="number"
              value={precoMax}
              onChange={(e) => setPrecoMax(e.target.value ? Number(e.target.value) : '')}
              className="w-full rounded-xl border border-border bg-background px-4 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="0,00"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-muted-foreground">
              Tipo de Imóvel
            </label>
            <select
              value={tipoImovel}
              onChange={(e) => setTipoImovel(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-4 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Todos</option>
              <option value="Casa">Casa</option>
              <option value="Apartamento">Apartamento</option>
              <option value="Comercial">Comercial</option>
              <option value="Terreno">Terreno</option>
              <option value="Outro">Outro</option>
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-muted-foreground">
              Finalidade
            </label>
            <select
              value={finalidade}
              onChange={(e) => setFinalidade(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-4 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Todas</option>
              <option value="Residencial">Residencial</option>
              <option value="Comercial">Comercial</option>
            </select>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-0 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border bg-muted/50 flex justify-between items-center">
          <h3 className="font-semibold text-foreground">Resultados ({filteredCadastros.length})</h3>
        </div>
        <div className="divide-y divide-border">
          {filteredCadastros.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              Nenhum contrato encontrado com estes filtros.
            </div>
          ) : (
            filteredCadastros.map(c => {
              const whatsAppNumber = String(c.telInq).replace(/\D/g, '');
              const whatsAppUrl = `https://wa.me/55${whatsAppNumber}`;

              return (
                <div key={c.id} className="p-4 hover:bg-muted/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors">
                  <div>
                    <p className="font-medium text-foreground">{c.nomeInq || 'N/A'}</p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground">
                      <span>WhatsApp: {c.telInq || 'N/A'}</span>
                      <span>Condomínio: {c.condominio || 'Nenhum / Não se aplica'}</span>
                    </div>
                  </div>
                  <div>
                    {c.telInq && (
                      <a
                        href={whatsAppUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-lg bg-[#25D366]/10 px-4 py-2 text-[#25D366] font-medium hover:bg-[#25D366]/20 transition-colors whitespace-nowrap"
                      >
                        <MessageSquare className="h-4 w-4" />
                        Contato
                      </a>
                    )}
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
