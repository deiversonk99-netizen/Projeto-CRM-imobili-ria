import React from 'react';
import { FiltrosPromocao } from '../types';
import { Search } from 'lucide-react';

interface Props {
  filtros: FiltrosPromocao;
  onChange: (filtros: FiltrosPromocao) => void;
  condominiosDisponiveis: string[];
}

export function PromotionFilters({ filtros, onChange, condominiosDisponiveis }: Props) {
  const updateFiltro = <K extends keyof FiltrosPromocao>(key: K, value: FiltrosPromocao[K]) => {
    onChange({ ...filtros, [key]: value });
  };

  const handleMultiselect = (key: 'tiposImovel' | 'finalidades' | 'condominios', value: string) => {
    const current = filtros[key];
    if (current.includes(value)) {
      updateFiltro(key, current.filter(v => v !== value));
    } else {
      updateFiltro(key, [...current, value]);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm mb-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
        <h2 className="text-xl font-bold text-foreground">Filtros de Segmentação</h2>
        <button 
          onClick={() => onChange({
            busca: '', perfil: 'Todos', valorMin: '', valorMax: '',
            tiposImovel: [], finalidades: [], condominios: [], status: 'Ativo'
          })}
          className="text-sm font-medium text-brand-navy hover:text-brand-navy/80 transition-colors"
        >
          Limpar filtros
        </button>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {/* Busca */}
        <div className="xl:col-span-2">
          <label className="mb-2 block text-sm font-medium text-muted-foreground">
            Busca (Nome, Telefone ou Contrato)
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={filtros.busca}
              onChange={(e) => updateFiltro('busca', e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-border bg-background text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none"
              placeholder="Digite para buscar..."
            />
          </div>
        </div>

        {/* Perfil */}
        <div>
          <label className="mb-2 block text-sm font-medium text-muted-foreground">Perfil do Cliente</label>
          <select
            value={filtros.perfil}
            onChange={(e) => updateFiltro('perfil', e.target.value as any)}
            className="w-full rounded-xl border border-border bg-background px-4 py-2 text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none"
          >
            <option value="Todos">Todos</option>
            <option value="Proprietário">Proprietário</option>
            <option value="Inquilino">Inquilino</option>
            <option value="Proprietário e inquilino">Proprietário e Inquilino</option>
          </select>
        </div>

        {/* Status */}
        <div>
          <label className="mb-2 block text-sm font-medium text-muted-foreground">Status do Contrato</label>
          <select
            value={filtros.status}
            onChange={(e) => updateFiltro('status', e.target.value)}
            className="w-full rounded-xl border border-border bg-background px-4 py-2 text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none"
          >
            <option value="">Qualquer status</option>
            <option value="Ativo">Ativo</option>
            <option value="Encerrado">Encerrado</option>
          </select>
        </div>

        {/* Valores */}
        <div>
          <label className="mb-2 block text-sm font-medium text-muted-foreground">Valor Mínimo (R$)</label>
          <input
            type="number"
            value={filtros.valorMin}
            onChange={(e) => updateFiltro('valorMin', e.target.value ? Number(e.target.value) : '')}
            className="w-full rounded-xl border border-border bg-background px-4 py-2 text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none"
            placeholder="Ex: 500"
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-muted-foreground">Valor Máximo (R$)</label>
          <input
            type="number"
            value={filtros.valorMax}
            onChange={(e) => updateFiltro('valorMax', e.target.value ? Number(e.target.value) : '')}
            className="w-full rounded-xl border border-border bg-background px-4 py-2 text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none"
            placeholder="Ex: 2000"
          />
        </div>

        {/* Tipos de Imóvel */}
        <div className="lg:col-span-2">
          <label className="mb-2 block text-sm font-medium text-muted-foreground">Tipo de Imóvel (Múltiplos)</label>
          <div className="flex flex-wrap gap-2">
            {['Casa', 'Apartamento', 'Comercial', 'Terreno'].map(tipo => (
              <button
                key={tipo}
                onClick={() => handleMultiselect('tiposImovel', tipo)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border ${
                  filtros.tiposImovel.includes(tipo) 
                    ? 'bg-primary text-primary-foreground border-primary' 
                    : 'bg-background text-foreground border-border hover:bg-muted'
                }`}
              >
                {tipo}
              </button>
            ))}
          </div>
        </div>

        {/* Finalidade */}
        <div className="lg:col-span-2">
          <label className="mb-2 block text-sm font-medium text-muted-foreground">Finalidade</label>
          <div className="flex flex-wrap gap-2">
            {['Residencial', 'Comercial'].map(fin => (
              <button
                key={fin}
                onClick={() => handleMultiselect('finalidades', fin)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border ${
                  filtros.finalidades.includes(fin) 
                    ? 'bg-primary text-primary-foreground border-primary' 
                    : 'bg-background text-foreground border-border hover:bg-muted'
                }`}
              >
                {fin}
              </button>
            ))}
          </div>
        </div>

        {/* Condominios */}
        <div className="xl:col-span-4">
          <label className="mb-2 block text-sm font-medium text-muted-foreground">Condomínios (Selecione)</label>
          <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 border border-border rounded-xl bg-background">
            {condominiosDisponiveis.length === 0 && (
              <span className="text-xs text-muted-foreground italic">Nenhum condomínio encontrado</span>
            )}
            {condominiosDisponiveis.map(cond => (
              <button
                key={cond}
                onClick={() => handleMultiselect('condominios', cond)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border ${
                  filtros.condominios.includes(cond) 
                    ? 'bg-primary text-primary-foreground border-primary' 
                    : 'bg-background text-foreground border-border hover:bg-muted'
                }`}
              >
                {cond}
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
