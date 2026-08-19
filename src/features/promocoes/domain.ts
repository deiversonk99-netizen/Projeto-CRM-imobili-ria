import { Cadastro } from '../../types';
import { ContatoAgrupado, FiltrosPromocao, VinculoContratual } from './types';

export function normalizarTelefone(tel: string | undefined | null): string {
  if (!tel) return '';
  let digits = tel.replace(/\D/g, '');
  digits = digits.replace(/^0+/, '');
  
  if (digits.length === 10 || digits.length === 11) {
    return '55' + digits;
  }
  
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) {
    return digits;
  }
  
  return digits;
}

export function isTelefoneValido(telNormalizado: string): boolean {
  if (!telNormalizado) return false;
  // Brazilian mobile: 55 + 2 digits (DD) + 9 digits (number) = 13 digits
  // Brazilian landline: 55 + 2 digits (DD) + 8 digits = 12 digits
  return telNormalizado.length >= 12 && telNormalizado.length <= 13;
}

export function extrairVinculos(cadastros: Cadastro[]): VinculoContratual[] {
  const vinculos: VinculoContratual[] = [];
  
  for (const c of cadastros) {
    const valorAluguel = typeof c.valorAluguel === 'string' ? parseFloat(c.valorAluguel) : (c.valorAluguel ?? null);
    
    // Proprietário
    if (c.nomeProp) {
      const telNormalizado = normalizarTelefone(c.telProp);
      vinculos.push({
        cadastroId: c.id,
        perfil: 'Proprietário',
        nome: c.nomeProp.trim(),
        telefoneOriginal: c.telProp || '',
        telefoneNormalizado: telNormalizado,
        contrato: c.contrato || '',
        status: c.status || '',
        valorAluguel: isNaN(valorAluguel as number) ? null : valorAluguel,
        tipoImovel: c.tipoImovel || '',
        finalidade: c.finalidade || '',
        condominio: c.condominio || '',
        telefoneValido: isTelefoneValido(telNormalizado),
      });
    }

    // Inquilino
    if (c.nomeInq) {
      const telNormalizado = normalizarTelefone(c.telInq);
      vinculos.push({
        cadastroId: c.id,
        perfil: 'Inquilino',
        nome: c.nomeInq.trim(),
        telefoneOriginal: c.telInq || '',
        telefoneNormalizado: telNormalizado,
        contrato: c.contrato || '',
        status: c.status || '',
        valorAluguel: isNaN(valorAluguel as number) ? null : valorAluguel,
        tipoImovel: c.tipoImovel || '',
        finalidade: c.finalidade || '',
        condominio: c.condominio || '',
        telefoneValido: isTelefoneValido(telNormalizado),
      });
    }
  }
  
  return vinculos;
}

export function aplicarFiltrosVinculos(vinculos: VinculoContratual[], filtros: FiltrosPromocao): VinculoContratual[] {
  return vinculos.filter(v => {
    if (filtros.status && v.status !== filtros.status) return false;
    
    if (filtros.valorMin !== '') {
      const vMin = Number(filtros.valorMin);
      if (!isNaN(vMin) && (v.valorAluguel === null || v.valorAluguel < vMin)) return false;
    }
    
    if (filtros.valorMax !== '') {
      const vMax = Number(filtros.valorMax);
      if (!isNaN(vMax) && (v.valorAluguel === null || v.valorAluguel > vMax)) return false;
    }

    if (filtros.tiposImovel.length > 0 && !filtros.tiposImovel.includes(v.tipoImovel)) return false;
    if (filtros.finalidades.length > 0 && !filtros.finalidades.includes(v.finalidade)) return false;
    if (filtros.condominios.length > 0 && !filtros.condominios.includes(v.condominio)) return false;
    
    return true;
  });
}

export function agruparContatos(vinculosFiltrados: VinculoContratual[], todosVinculos: VinculoContratual[], filtros: FiltrosPromocao): ContatoAgrupado[] {
  const contatosMap = new Map<string, ContatoAgrupado>();
  
  // Primeiro, vamos criar grupos baseados apenas nos vinculos que passaram nos filtros primarios
  // MAS precisamos saber todos os perfis da pessoa para os filtros combinados (ex: "Proprietário e inquilino").
  // Então agrupamos TODOS os vínculos primeiro, depois removemos.
  
  const agrupamentoGlobal = new Map<string, VinculoContratual[]>();
  for (const v of todosVinculos) {
    if (!v.telefoneNormalizado) continue;
    if (!agrupamentoGlobal.has(v.telefoneNormalizado)) {
      agrupamentoGlobal.set(v.telefoneNormalizado, []);
    }
    agrupamentoGlobal.get(v.telefoneNormalizado)!.push(v);
  }

  // Identificar quais contatos têm vínculos que passaram no filtro (usando o contactKey)
  const telefonesComMatch = new Set(vinculosFiltrados.filter(v => v.telefoneNormalizado).map(v => v.telefoneNormalizado));

  for (const tel of telefonesComMatch) {
    const vinculosDoContato = agrupamentoGlobal.get(tel) || [];
    
    // Perfil global da pessoa (para o filtro de Perfil)
    const perfisSet = new Set(vinculosDoContato.map(v => v.perfil));
    
    // Aplicação do filtro de Perfil Global (Todos, Proprietário, Inquilino, Ambas)
    let passouFiltroPerfil = false;
    if (filtros.perfil === 'Todos') {
      passouFiltroPerfil = true;
    } else if (filtros.perfil === 'Proprietário') {
      passouFiltroPerfil = perfisSet.has('Proprietário');
    } else if (filtros.perfil === 'Inquilino') {
      passouFiltroPerfil = perfisSet.has('Inquilino');
    } else if (filtros.perfil === 'Proprietário e inquilino') {
      passouFiltroPerfil = perfisSet.has('Proprietário') && perfisSet.has('Inquilino');
    }

    if (!passouFiltroPerfil) continue;

    // Busca
    const nomesSet = new Set(vinculosDoContato.map(v => v.nome.trim()).filter(Boolean));
    const nomes = Array.from(nomesSet);
    const telefoneOriginal = vinculosDoContato[0]?.telefoneOriginal || '';
    
    // Aplicação da Busca (nome, telefone, contrato)
    if (filtros.busca) {
      const termoBusca = filtros.busca.toLowerCase();
      const matchNome = nomes.some(n => n.toLowerCase().includes(termoBusca));
      const matchTelefone = tel.includes(termoBusca) || telefoneOriginal.includes(termoBusca);
      const matchContrato = vinculosDoContato.some(v => v.contrato.toLowerCase().includes(termoBusca));
      if (!matchNome && !matchTelefone && !matchContrato) {
        continue;
      }
    }

    const vinculosMatchFiltros = vinculosFiltrados.filter(v => v.telefoneNormalizado === tel);
    if (vinculosMatchFiltros.length === 0) continue; // Pode acontecer se apenas falhou na busca, mas já checamos telefonesComMatch

    const nomeFormatado = nomes.map(n => n.toLowerCase());
    const nomesNormalizados = new Set(nomeFormatado);
    const telefoneCompartilhado = nomesNormalizados.size > 1;

    contatosMap.set(tel, {
      contactKey: tel,
      nomes,
      telefoneOriginal,
      telefoneNormalizado: tel,
      perfis: Array.from(perfisSet),
      vinculos: vinculosDoContato,
      vinculosFiltrados: vinculosMatchFiltros,
      telefoneValido: isTelefoneValido(tel),
      telefoneCompartilhado,
    });
  }

  return Array.from(contatosMap.values());
}

export function gerarTextoMensagem(template: string, contato: ContatoAgrupado, campanhaNome: string): string {
  const nomeExibicao = contato.nomes[0] || 'Cliente';
  const perfis = contato.perfis.join(' e ');
  const contratos = Array.from(new Set(contato.vinculosFiltrados.map(v => v.contrato).filter(Boolean))).join(', ');
  const condominios = Array.from(new Set(contato.vinculosFiltrados.map(v => v.condominio).filter(Boolean))).join(', ');
  
  return template
    .replace(/{{nome}}/g, nomeExibicao)
    .replace(/{{perfil}}/g, perfis)
    .replace(/{{campanha}}/g, campanhaNome)
    .replace(/{{contratos}}/g, contratos)
    .replace(/{{condominios}}/g, condominios);
}

export function criarLinkWhatsApp(telefone: string, mensagem: string): string {
  if (!telefone) return '';
  return `https://wa.me/${telefone}?text=${encodeURIComponent(mensagem)}`;
}
