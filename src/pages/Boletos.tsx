import React, { useEffect, useState } from 'react';
import { db } from '../store';
import { Cadastro } from '../types';
import { checkBoletoWarning, getWhatsappLink } from '../utils/dates';
import { FileText, MessageCircle, CheckCircle } from 'lucide-react';

interface BoletoItem {
  id: string;
  contrato: string;
  nomeInq: string;
  nomeProp: string;
  telefone: string;
  tipoAviso: '5_dias' | '1_dia';
  diaVencimento: number;
}

export default function Boletos() {
  const [boletos, setBoletos] = useState<BoletoItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Format: YYYY-MM
  const currentMonthRef = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

  const loadData = () => {
    setLoading(true);
    const cadastros = db.getCadastros();
    const tarefas = db.getTarefas();
    
    // Find all done boletos for this month
    const doneIds = new Set(
      tarefas
        .filter(t => t.tipo.startsWith('Boleto') && t.referencia === currentMonthRef)
        .map(t => `${t.contrato}-${t.tipo}`) // e.g. "2023-001-Boleto 5 dias"
    );

    const result: BoletoItem[] = [];

    cadastros.forEach(c => {
      const aviso = checkBoletoWarning(c.diaVencimento);
      if (aviso) {
        const tipoStr = aviso === '5_dias' ? 'Boleto 5 dias' : 'Boleto 1 dia';
        if (!doneIds.has(`${c.contrato}-${tipoStr}`)) {
          result.push({
            id: c.id,
            contrato: c.contrato,
            nomeInq: c.nomeInq,
            nomeProp: c.nomeProp,
            telefone: c.telInq,
            tipoAviso: aviso,
            diaVencimento: c.diaVencimento,
          });
        }
      }
    });

    setBoletos(result);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleMarcarFeito = async (item: BoletoItem) => {
    const tipoStr = item.tipoAviso === '5_dias' ? 'Boleto 5 dias' : 'Boleto 1 dia';
    await db.saveTarefa({
      contrato: item.contrato,
      tipo: tipoStr as any,
      usuario: 'Sistema',
      referencia: currentMonthRef
    });
    loadData();
  };

  const cincoDias = boletos.filter(b => b.tipoAviso === '5_dias');
  const umDia = boletos.filter(b => b.tipoAviso === '1_dia');

  const renderList = (lista: BoletoItem[], title: string, color: string) => (
    <div className="mb-8 last:mb-0">
      <h3 className={`text-sm font-semibold uppercase tracking-wider mb-4 flex items-center gap-2 ${color}`}>
        <span className="w-2 h-2 rounded-full bg-current"></span>
        {title}
      </h3>
      {lista.length === 0 ? (
        <p className="text-sm text-gray-500 italic">Nenhuma cobrança para este período hoje.</p>
      ) : (
        <ul className="divide-y divide-gray-100 border border-gray-100 rounded-lg overflow-hidden">
          {lista.map((item) => {
            const text = `Olá ${item.nomeInq}, tudo bem? O vencimento do seu aluguel (Contrato ${item.contrato}) está próximo (Dia ${item.diaVencimento}). O boleto já está disponível!`;
            
            return (
              <li key={item.id} className="p-4 hover:bg-gray-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-gray-900">{item.nomeInq}</span>
                    <span className="text-xs text-gray-400">|</span>
                    <span className="text-xs text-gray-500">Contrato: {item.contrato}</span>
                  </div>
                  <p className="text-xs text-gray-500">Proprietário: {item.nomeProp}</p>
                </div>
                
                <div className="flex items-center gap-2">
                  <a
                    href={getWhatsappLink(item.telefone, text)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 hover:bg-green-100 rounded-lg text-sm font-medium transition-colors border border-green-200"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Avisar
                  </a>
                  <button
                    onClick={() => handleMarcarFeito(item)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-gray-600 hover:bg-gray-50 rounded-lg text-sm font-medium transition-colors border border-gray-300 shadow-sm"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Feito
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-200 bg-gray-50">
        <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-600" />
          Envio de Boletos (Vencimentos)
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Avisos de cobrança programados para 5 dias e 1 dia antes do vencimento.
        </p>
      </div>

      <div className="p-6">
        {loading ? (
          <div className="p-8 flex justify-center text-gray-400">Carregando...</div>
        ) : (
          <>
            {renderList(umDia, 'Avisar Amanhã (Falta 1 dia)', 'text-orange-600')}
            {renderList(cincoDias, 'Avisar em 5 dias', 'text-blue-600')}
          </>
        )}
      </div>
    </div>
  );
}
