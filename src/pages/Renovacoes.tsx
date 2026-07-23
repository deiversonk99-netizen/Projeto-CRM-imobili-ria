import React, { useMemo } from 'react';
import { useData } from '../context/DataContext';
import { AlertCircle, FileSignature } from 'lucide-react';
import { generateEmailLink, generateWhatsAppLink } from '../utils/links';

export default function Renovacoes() {
  const { cadastros } = useData();

  const expiringSoon = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const next60 = new Date(today);
    next60.setDate(today.getDate() + 60);

    return cadastros.filter(c => {
      if (!c.fimContrato || c.status === 'Encerrado' || c.status === 'Renovado') return false;
      const end = new Date(c.fimContrato);
      end.setHours(0,0,0,0);
      return end >= today && end <= next60;
    }).sort((a, b) => new Date(a.fimContrato).getTime() - new Date(b.fimContrato).getTime());
  }, [cadastros]);

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex items-center gap-2.5 border-b border-border bg-muted/50 px-6 py-5">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
          <AlertCircle className="h-4.5 w-4.5 text-secondary-foreground" />
        </span>
        <h2 className="text-lg font-bold text-brand-navy">
          Renovações (60 dias)
        </h2>
      </div>

      <div className="divide-y divide-border">
        {expiringSoon.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            Nenhum contrato vencendo nos próximos 60 dias.
          </div>
        ) : (
          expiringSoon.map(c => {
            const date = new Date(c.fimContrato);
            const daysLeft = Math.ceil((date.getTime() - new Date().getTime()) / (1000 * 3600 * 24));
            
            const msgProp = `Olá ${c.nomeProp}, lembramos que o contrato ${c.contrato} vence em ${date.toLocaleDateString('pt-BR')}. Gostaríamos de conversar sobre a renovação.`;
            const msgInq = `Olá ${c.nomeInq}, seu contrato ${c.contrato} vence em ${date.toLocaleDateString('pt-BR')}. Gostaríamos de conversar sobre a renovação.`;

            return (
              <div key={c.id} className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 items-center hover:bg-muted/30 transition-colors">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-bold text-brand-navy">Contrato: {c.contrato}</h3>
                    <span className="text-xs font-semibold px-2 py-1 bg-orange-100 text-orange-700 rounded-md">
                      Vence em {daysLeft} dias
                    </span>
                  </div>
                  <p className="text-sm text-foreground/80">Data fim: {date.toLocaleDateString('pt-BR')}</p>
                </div>
                
                <div className="flex flex-col gap-2">
                  <div className="text-sm flex flex-col gap-1">
                    <span className="font-semibold text-brand-navy">Locador: {c.nomeProp}</span>
                    <div className="flex gap-2 text-xs">
                      <a href={generateWhatsAppLink(c.telProp, msgProp)} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">WhatsApp</a>
                      {c.emailProp && (
                        <a href={generateEmailLink(c.emailProp, `Renovação de Contrato ${c.contrato}`, msgProp)} className="text-primary hover:underline font-medium">E-mail</a>
                      )}
                    </div>
                  </div>
                  
                  <div className="text-sm flex flex-col gap-1">
                    <span className="font-semibold text-brand-navy">Locatário: {c.nomeInq}</span>
                    <div className="flex gap-2 text-xs">
                      <a href={generateWhatsAppLink(c.telInq, msgInq)} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">WhatsApp</a>
                      {c.emailInq && (
                        <a href={generateEmailLink(c.emailInq, `Renovação de Contrato ${c.contrato}`, msgInq)} className="text-primary hover:underline font-medium">E-mail</a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  );
}
