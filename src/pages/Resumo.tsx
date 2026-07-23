import React, { useMemo } from 'react';
import { useData } from '../context/DataContext';
import { FileSignature, AlertCircle, FileCheck, Calendar as CalendarIcon, ArrowRight } from 'lucide-react';
import { parseDateToMD } from '../utils/dates';

export default function Resumo({ setTab }: { setTab: (tab: string) => void }) {
  const { cadastros, checklists, tarefas } = useData();

  const activeContractsCount = useMemo(() => {
    return cadastros.filter(c => c.status === 'Ativo' || !c.status).length;
  }, [cadastros]);

  const pendingDocsCount = useMemo(() => {
    return checklists.filter(c => {
      const isComplete = c.prop_contratoEnviado && c.prop_vistoriaEnviada && c.inq_manualEntregue && c.inq_vistoriaAssinada && c.inq_seguroIncendio;
      let hasExtraPending = false;
      try {
        if (c.documentos_json) {
          const extras = JSON.parse(c.documentos_json);
          hasExtraPending = extras.some((d: any) => !d.isFeito);
        }
      } catch (e) {}
      return !isComplete || hasExtraPending;
    }).length;
  }, [checklists]);

  const expiringSoonCount = useMemo(() => {
    const today = new Date();
    const next60 = new Date();
    next60.setDate(today.getDate() + 60);

    return cadastros.filter(c => {
      if (!c.fimContrato || c.status === 'Encerrado' || c.status === 'Renovado') return false;
      const end = new Date(c.fimContrato);
      return end >= today && end <= next60;
    }).length;
  }, [cadastros]);

  const StatCard = ({ icon: Icon, title, value, color, onClick }: any) => (
    <div 
      onClick={onClick}
      className="bg-card rounded-2xl p-6 border border-border shadow-sm flex items-start gap-4 cursor-pointer hover:border-primary/50 transition-colors"
    >
      <div className={`p-3 rounded-xl ${color}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
        <p className="text-3xl font-bold text-foreground mt-1">{value}</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard 
          icon={FileSignature} 
          title="Contratos Ativos" 
          value={activeContractsCount} 
          color="bg-primary/10 text-primary" 
          onClick={() => setTab('cadastro')}
        />
        <StatCard 
          icon={FileCheck} 
          title="Pendências (Docs)" 
          value={pendingDocsCount} 
          color="bg-orange-500/10 text-orange-600" 
          onClick={() => setTab('documentos')}
        />
        <StatCard 
          icon={AlertCircle} 
          title="Vencendo em 60 dias" 
          value={expiringSoonCount} 
          color="bg-red-500/10 text-red-600" 
          onClick={() => setTab('renovacoes')}
        />
      </div>
    </div>
  );
}
