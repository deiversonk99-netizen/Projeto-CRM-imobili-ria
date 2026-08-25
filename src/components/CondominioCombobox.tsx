import React, { useState, useRef, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { db } from '../store';
import { v4 as uuidv4 } from 'uuid';
import { ChevronDown, Search, Plus, Loader2 } from 'lucide-react';
import { useToast } from './ui/Toast';

interface Props {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function CondominioCombobox({ value, onChange, className }: Props) {
  const normalizeName = (name: string) => name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
  const { condominios, refreshData } = useData();
  const { addToast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter condominios based on search term
  const filteredOptions = condominios
    .filter(c => c.ativo !== false) // support active condominios
    .filter(c => normalizeName(c.nome).includes(normalizeName(searchTerm)));

  // Check if exact match exists
  const exactMatchExists = condominios.some(
    c => normalizeName(c.nome) === normalizeName(searchTerm)
  );

  const handleSelect = (condominioNome: string) => {
    onChange(condominioNome);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleAddNew = async () => {
    const nomeNormalizado = searchTerm.trim().replace(/\s+/g, ' ');
    if (!nomeNormalizado) return;

    setIsSaving(true);
    try {
      const newCondo = {
        id: uuidv4(),
        nome: nomeNormalizado,
        nomeNormalizado: normalizeName(nomeNormalizado),
        ativo: true,
        createdAt: new Date().toISOString(),
        operationId: uuidv4()
      };
      
      await db.upsertCondominio(newCondo);
      await refreshData();
      onChange(nomeNormalizado);
      setIsOpen(false);
      setSearchTerm('');
      addToast('Condomínio adicionado com sucesso', 'success');
    } catch (error: any) {
      addToast('Erro ao adicionar condomínio: ' + error.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        className={`flex w-full items-center justify-between cursor-pointer ${className}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className={value ? 'text-foreground' : 'text-muted-foreground'}>
          {value || 'Nenhum / Não se aplica'}
        </span>
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-xl shadow-lg overflow-hidden">
          <div className="p-2 border-b border-border flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground ml-1" />
            <input
              type="text"
              placeholder="Buscar ou adicionar novo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 bg-transparent outline-none text-sm p-1"
              autoFocus
            />
          </div>
          
          <ul className="max-h-48 overflow-y-auto p-1" role="listbox">
            <li><button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-muted rounded-md" onClick={() => handleSelect('')}>Nenhum / Não se aplica</button></li>
            
            {filteredOptions.map(condo => (
              <li key={condo.id} role="option" aria-selected={value === condo.nome}>
                <button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-muted rounded-md" onClick={() => handleSelect(condo.nome)}>{condo.nome}</button>
              </li>
            ))}

            {searchTerm.trim() && !exactMatchExists && (
              <li><button type="button" disabled={isSaving} className="w-full px-3 py-2 text-sm hover:bg-primary/10 text-primary flex items-center gap-2 rounded-md font-medium disabled:opacity-50" onClick={handleAddNew}>
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Adicionar "{searchTerm.trim().replace(/\s+/g, ' ')}"
              </button></li>
            )}
            
            {filteredOptions.length === 0 && !searchTerm.trim() && (
              <li className="px-3 py-4 text-sm text-center text-muted-foreground">
                Nenhum condomínio encontrado.
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
