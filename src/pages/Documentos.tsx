import React, { useEffect, useState } from 'react';
import { db } from '../store';
import { ChecklistDocs, Cadastro } from '../types';
import { FileCheck, Search, Save, Loader2, CheckCircle2 } from 'lucide-react';

export default function Documentos() {
  const [checklists, setChecklists] = useState<ChecklistDocs[]>([]);
  const [cadastros, setCadastros] = useState<Record<string, Cadastro>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);

  const loadData = () => {
    setLoading(true);
    const checks = db.getChecklists();
    const cads = db.getCadastros();
    
    const cadMap: Record<string, Cadastro> = {};
    cads.forEach(c => { cadMap[c.contrato] = c; });
    
    setCadastros(cadMap);
    setChecklists(checks);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggle = (id: string, field: keyof ChecklistDocs) => {
    setChecklists(prev => prev.map(c => {
      if (c.id === id) {
        return { ...c, [field]: !c[field] };
      }
      return c;
    }));
  };

  const handleSave = async (checklist: ChecklistDocs) => {
    setSavingId(checklist.id);
    await db.updateChecklist(checklist);
    setSavingId(null);
  };

  const filtered = checklists.filter(c => {
    const term = searchTerm.toLowerCase();
    const cad = cadastros[c.contrato];
    if (!cad) return false;
    return c.contrato.toLowerCase().includes(term) ||
           cad.nomeProp.toLowerCase().includes(term) ||
           cad.nomeInq.toLowerCase().includes(term);
  });

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-200 bg-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-blue-600" />
            Checklist de Documentos
          </h2>
        </div>
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input 
            type="text" 
            placeholder="Buscar contrato ou nome..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none w-full sm:w-64"
          />
        </div>
      </div>

      <div className="p-0">
        {loading ? (
          <div className="p-8 flex justify-center text-gray-400">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-500 flex flex-col items-center">
            <FileCheck className="w-12 h-12 text-gray-200 mb-3" />
            <p>Nenhum checklist encontrado.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filtered.map(c => {
              const cad = cadastros[c.contrato];
              const isSaving = savingId === c.id;

              return (
                <div key={c.id} className="p-6">
                  <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-100">
                    <div>
                      <span className="text-sm font-medium text-blue-600 mb-1 block">Contrato: {c.contrato}</span>
                      <p className="text-sm text-gray-600">
                        <span className="font-medium text-gray-900">Proprietário:</span> {cad.nomeProp} | {' '}
                        <span className="font-medium text-gray-900">Inquilino:</span> {cad.nomeInq}
                      </p>
                    </div>
                    <button
                      onClick={() => handleSave(c)}
                      disabled={isSaving}
                      className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white hover:bg-gray-800 rounded-lg text-sm font-medium transition-colors disabled:opacity-70"
                    >
                      {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Salvar
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Proprietário */}
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                        Documentos Proprietário
                      </h4>
                      <div className="space-y-3">
                        <label className="flex items-start gap-3 cursor-pointer group">
                          <input 
                            type="checkbox" 
                            checked={c.prop_contratoEnviado}
                            onChange={() => handleToggle(c.id, 'prop_contratoEnviado')}
                            className="mt-1 rounded text-blue-600 focus:ring-blue-500 w-4 h-4 border-gray-300" 
                          />
                          <span className="text-sm text-gray-700 group-hover:text-gray-900">Contrato de locação assinado</span>
                        </label>
                        <label className="flex items-start gap-3 cursor-pointer group">
                          <input 
                            type="checkbox" 
                            checked={c.prop_vistoriaEnviada}
                            onChange={() => handleToggle(c.id, 'prop_vistoriaEnviada')}
                            className="mt-1 rounded text-blue-600 focus:ring-blue-500 w-4 h-4 border-gray-300" 
                          />
                          <span className="text-sm text-gray-700 group-hover:text-gray-900">Termo de vistoria enviado</span>
                        </label>
                      </div>
                    </div>

                    {/* Inquilino */}
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
                        Documentos Inquilino
                      </h4>
                      <div className="space-y-3">
                        <label className="flex items-start gap-3 cursor-pointer group">
                          <input 
                            type="checkbox" 
                            checked={c.inq_manualEntregue}
                            onChange={() => handleToggle(c.id, 'inq_manualEntregue')}
                            className="mt-1 rounded text-blue-600 focus:ring-blue-500 w-4 h-4 border-gray-300" 
                          />
                          <span className="text-sm text-gray-700 group-hover:text-gray-900">Manual do Inquilino entregue</span>
                        </label>
                        <label className="flex items-start gap-3 cursor-pointer group">
                          <input 
                            type="checkbox" 
                            checked={c.inq_vistoriaAssinada}
                            onChange={() => handleToggle(c.id, 'inq_vistoriaAssinada')}
                            className="mt-1 rounded text-blue-600 focus:ring-blue-500 w-4 h-4 border-gray-300" 
                          />
                          <span className="text-sm text-gray-700 group-hover:text-gray-900">Termo de vistoria assinado</span>
                        </label>
                        <label className="flex items-start gap-3 cursor-pointer group">
                          <input 
                            type="checkbox" 
                            checked={c.inq_seguroIncendio}
                            onChange={() => handleToggle(c.id, 'inq_seguroIncendio')}
                            className="mt-1 rounded text-blue-600 focus:ring-blue-500 w-4 h-4 border-gray-300" 
                          />
                          <span className="text-sm text-gray-700 group-hover:text-gray-900">Apólice de Seguro Incêndio</span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
