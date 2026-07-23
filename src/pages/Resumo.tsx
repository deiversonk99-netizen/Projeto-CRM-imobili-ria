import React, { useMemo } from 'react';
import { useData } from '../context/DataContext';
import { FileSignature, AlertCircle, FileCheck, Calendar as CalendarIcon, ArrowRight, UserRound, FileText } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { checkBoletoWarning, checkBirthday } from '../utils/dates';

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

export default function Resumo({ setTab }: { setTab: (tab: string) => void }) {
  const { cadastros, checklists } = useData();

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

  const expirationsByMonth = useMemo(() => {
    const counts: Record<string, number> = {};
    const today = new Date();
    
    cadastros.forEach(c => {
      if (!c.fimContrato || c.status === 'Encerrado' || c.status === 'Renovado') return;
      const end = new Date(c.fimContrato);
      if (end < today) return;
      
      const monthYear = end.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
      counts[monthYear] = (counts[monthYear] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => {
        const [mA, yA] = a.name.split(' de ');
        const [mB, yB] = b.name.split(' de ');
        return new Date(`${mA} 1, ${yA}`).getTime() - new Date(`${mB} 1, ${yB}`).getTime();
      })
      .slice(0, 6);
  }, [cadastros]);

  const upcomingBirthdays = useMemo(() => {
    const list: { nome: string, tipo: string, dataStr: string, dias: number, contrato: string }[] = [];
    cadastros.forEach(c => {
      const pBday = checkBirthday(c.niverProp);
      if (pBday && pBday.daysAway <= 7) {
        list.push({ nome: c.nomeProp, tipo: 'Proprietário', dataStr: pBday.dateStr, dias: pBday.daysAway, contrato: c.contrato });
      }
      const iBday = checkBirthday(c.niverInq);
      if (iBday && iBday.daysAway <= 7) {
        list.push({ nome: c.nomeInq, tipo: 'Inquilino', dataStr: iBday.dateStr, dias: iBday.daysAway, contrato: c.contrato });
      }
    });
    return list.sort((a, b) => a.dias - b.dias).slice(0, 5);
  }, [cadastros]);

  const upcomingBoletos = useMemo(() => {
    const list: { contrato: string, inq: string, dia: number, aviso: string }[] = [];
    cadastros.forEach(c => {
      const aviso = checkBoletoWarning(c.diaVencimento);
      if (aviso) {
        list.push({ contrato: c.contrato, inq: c.nomeInq, dia: c.diaVencimento, aviso });
      }
    });
    return list.sort((a, b) => a.dia - b.dia).slice(0, 5);
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-2xl p-6 border border-border shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-brand-navy flex items-center gap-2">
              <CalendarIcon className="w-5 h-5" />
              Renovações por Mês
            </h3>
            <button onClick={() => setTab('renovacoes')} className="text-sm text-primary font-medium hover:underline flex items-center gap-1">
              Ver todos <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          {expirationsByMonth.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={expirationsByMonth}>
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                  <Tooltip 
                    cursor={{ fill: 'transparent' }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {expirationsByMonth.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={index === 0 ? '#ef4444' : '#3a5a40'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-muted-foreground bg-muted/30 rounded-xl">
              Nenhuma renovação próxima
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-card rounded-2xl p-6 border border-border shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-brand-navy flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Avisos de Boleto (Próximos)
              </h3>
              <button onClick={() => setTab('boletos')} className="text-sm text-primary font-medium hover:underline flex items-center gap-1">
                Ver boletos <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            {upcomingBoletos.length > 0 ? (
              <ul className="divide-y divide-border">
                {upcomingBoletos.map((b, i) => (
                  <li key={i} className="py-3 flex justify-between items-center">
                    <div>
                      <p className="font-medium text-sm text-foreground">{b.inq}</p>
                      <p className="text-xs text-muted-foreground">Contrato {b.contrato}</p>
                    </div>
                    <div className="text-right">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-md ${
                        b.aviso === 'atrasado' || b.aviso === 'hoje' ? 'bg-red-100 text-red-700' : 'bg-brand-navy/10 text-brand-navy'
                      }`}>
                        Dia {b.dia}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum aviso programado.</p>
            )}
          </div>

          <div className="bg-card rounded-2xl p-6 border border-border shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-brand-navy flex items-center gap-2">
                <UserRound className="w-5 h-5" />
                Aniversários (Próximos 7 dias)
              </h3>
              <button onClick={() => setTab('aniversarios')} className="text-sm text-primary font-medium hover:underline flex items-center gap-1">
                Ver todos <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            {upcomingBirthdays.length > 0 ? (
              <ul className="divide-y divide-border">
                {upcomingBirthdays.map((b, i) => (
                  <li key={i} className="py-3 flex justify-between items-center">
                    <div>
                      <p className="font-medium text-sm text-foreground">{b.nome}</p>
                      <p className="text-xs text-muted-foreground">{b.tipo} - Contrato {b.contrato}</p>
                    </div>
                    <div className="text-right text-xs font-medium text-muted-foreground">
                      {b.dias === 0 ? <span className="text-primary font-bold">Hoje</span> : `Em ${b.dias} dias`}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum aniversário nos próximos 7 dias.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
