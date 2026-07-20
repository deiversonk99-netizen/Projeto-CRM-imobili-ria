import React, { useEffect, useState } from 'react';
import { db } from '../store';
import { Cadastro } from '../types';
import { checkBirthday, getWhatsappLink } from '../utils/dates';
import { Gift, MessageCircle, CheckCircle } from 'lucide-react';

interface BirthdayItem {
  id: string;
  nome: string;
  tipo: 'Proprietário' | 'Inquilino';
  telefone: string;
  dataStr: string;
  diasAte: number;
  contrato: string;
}

export default function Aniversarios() {
  const [aniversariantes, setAniversariantes] = useState<BirthdayItem[]>([]);
  const [loading, setLoading] = useState(true);
  const currentYear = new Date().getFullYear().toString();

  const loadData = () => {
    setLoading(true);
    const cadastros = db.getCadastros();
    const tarefas = db.getTarefas();
    
    // Find all done birthdays for this year
    const doneIds = new Set(
      tarefas
        .filter(t => t.tipo === 'Aniversário' && t.referencia === currentYear)
        .map(t => `${t.contrato}-${t.usuario}`) // We use 'usuario' to store 'Proprietário' or 'Inquilino' for simplicity
    );

    const result: BirthdayItem[] = [];

    cadastros.forEach(c => {
      // Check Proprietario
      const propBday = checkBirthday(c.niverProp);
      if (propBday && !doneIds.has(`${c.contrato}-Proprietário`)) {
        result.push({
          id: `${c.id}-prop`,
          nome: c.nomeProp,
          tipo: 'Proprietário',
          telefone: c.telProp,
          dataStr: propBday.dateStr,
          diasAte: propBday.daysAway,
          contrato: c.contrato,
        });
      }

      // Check Inquilino
      const inqBday = checkBirthday(c.niverInq);
      if (inqBday && !doneIds.has(`${c.contrato}-Inquilino`)) {
        result.push({
          id: `${c.id}-inq`,
          nome: c.nomeInq,
          tipo: 'Inquilino',
          telefone: c.telInq,
          dataStr: inqBday.dateStr,
          diasAte: inqBday.daysAway,
          contrato: c.contrato,
        });
      }
    });

    result.sort((a, b) => a.diasAte - b.diasAte);
    setAniversariantes(result);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleMarcarFeito = async (item: BirthdayItem) => {
    await db.saveTarefa({
      contrato: item.contrato,
      tipo: 'Aniversário',
      usuario: item.tipo, // Storing who it was for
      referencia: currentYear
    });
    loadData();
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-200 bg-gray-50">
        <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
          <Gift className="w-5 h-5 text-blue-600" />
          Aniversários Próximos
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Mostrando aniversariantes de hoje e dos próximos 3 dias.
        </p>
      </div>

      <div className="p-0">
        {loading ? (
          <div className="p-8 flex justify-center text-gray-400">Carregando...</div>
        ) : aniversariantes.length === 0 ? (
          <div className="p-12 text-center text-gray-500 flex flex-col items-center">
            <Gift className="w-12 h-12 text-gray-200 mb-3" />
            <p>Nenhum aniversário nos próximos dias.</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {aniversariantes.map((item) => {
              const text = `Olá ${item.nome}! A imobiliária deseja um Feliz Aniversário! 🎉`;
              const isToday = item.diasAte === 0;

              return (
                <li key={item.id} className="p-6 hover:bg-gray-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${isToday ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                        {item.dataStr}
                      </span>
                      <span className="text-sm text-gray-500">Contrato: {item.contrato}</span>
                    </div>
                    <p className="text-gray-900 font-medium">{item.nome}</p>
                    <p className="text-sm text-gray-500">{item.tipo}</p>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <a
                      href={getWhatsappLink(item.telefone, text)}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 hover:bg-green-100 rounded-lg text-sm font-medium transition-colors border border-green-200"
                    >
                      <MessageCircle className="w-4 h-4" />
                      WhatsApp
                    </a>
                    <button
                      onClick={() => handleMarcarFeito(item)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-gray-600 hover:bg-gray-50 rounded-lg text-sm font-medium transition-colors border border-gray-300 shadow-sm"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Marcar Feito
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
