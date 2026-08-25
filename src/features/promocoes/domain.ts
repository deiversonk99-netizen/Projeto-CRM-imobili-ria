import { Cadastro } from '../../types';
import { ContatoAgrupado, FiltrosPromocao, VinculoContratual } from './types';
import { buildWhatsAppLink, normalizeBrazilianPhone } from '../../utils/whatsapp';

export function normalizarTelefone(tel: string | undefined | null): string {
  return normalizeBrazilianPhone(tel);
}

export function isTelefoneValido(telNormalizado: string): boolean {
  if (!telNormalizado) return false;
  return /^55[1-9]{2}\d{8,9}$/.test(telNormalizado);
}

export function parseValorMonetario(value: number | string | undefined | null): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (!value) return null;
  const normalized = String(value).replace(/R\$/gi, '').replace(/\s/g, '');
  const decimal = normalized.includes(',')
    ? normalized.replace(/\./g, '').replace(',', '.')
    : normalized;
  const parsed = Number(decimal);
  return Number.isFinite(parsed) ? parsed : null;
}

export function extrairVinculos(cadastros: Cadastro[]): VinculoContratual[] {
  const vinculos: VinculoContratual[] = [];
  
  for (const c of cadastros) {
    const valorAluguel = parseValorMonetario(c.valorAluguel);
    
    // Proprietário
    if (c.nomeProp) {
      const telNormalizado = normalizarTelefone(c.telProp);
      vinculos.push({
        cadastroId: c.id,
        perfil: 'Proprietário',
        nome: c.nomeProp.trim(),
        telefoneOriginal: c.telProp || '',
        telefoneNormalizado: telNormalizado,
        nomeInquilino: c.nomeInq?.trim() || '',
        nomeProprietario: c.nomeProp?.trim() || '',
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
        nomeInquilino: c.nomeInq?.trim() || '',
        nomeProprietario: c.nomeProp?.trim() || '',
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
    if (filtros.perfil === 'Proprietário' && v.perfil !== 'Proprietário') return false;
    if (filtros.perfil === 'Inquilino' && v.perfil !== 'Inquilino') return false;
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
  
  const contactKeyFor = (vinculo: VinculoContratual) => vinculo.telefoneNormalizado || `sem-telefone:${vinculo.cadastroId}:${vinculo.perfil}`;
  const agrupamentoGlobal = new Map<string, VinculoContratual[]>();
  for (const v of todosVinculos) {
    const key = contactKeyFor(v);
    if (!agrupamentoGlobal.has(key)) {
      agrupamentoGlobal.set(key, []);
    }
    agrupamentoGlobal.get(key)!.push(v);
  }

  // Identificar quais contatos têm vínculos que passaram no filtro (usando o contactKey)
  const telefonesComMatch = new Set(vinculosFiltrados.map(contactKeyFor));

  for (const tel of telefonesComMatch) {
    const vinculosDoContato = agrupamentoGlobal.get(tel) || [];
    
    const vinculosMatchFiltros = vinculosFiltrados.filter(v => contactKeyFor(v) === tel);
    if (vinculosMatchFiltros.length === 0) continue;
    const perfisSet = new Set(vinculosMatchFiltros.map(v => v.perfil));
    
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
      const matchContrato = vinculosMatchFiltros.some(v => v.contrato.toLowerCase().includes(termoBusca));
      if (!matchNome && !matchTelefone && !matchContrato) {
        continue;
      }
    }

    const nomeFormatado = nomes.map(n => n.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase());
    const nomesNormalizados = new Set(nomeFormatado);
    const telefoneCompartilhado = nomesNormalizados.size > 1;

    contatosMap.set(tel, {
      contactKey: tel,
      nomes,
      telefoneOriginal,
      telefoneNormalizado: vinculosDoContato[0]?.telefoneNormalizado || '',
      perfis: Array.from(perfisSet),
      vinculos: vinculosDoContato,
      vinculosFiltrados: vinculosMatchFiltros,
      telefoneValido: isTelefoneValido(vinculosDoContato[0]?.telefoneNormalizado || ''),
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

const PLACEHOLDERS_SUPORTADOS = new Set(['nome', 'perfil', 'campanha', 'contratos', 'condominios']);

export function placeholdersDesconhecidos(template: string): string[] {
  const encontrados = Array.from(template.matchAll(/{{\s*([^{}]+?)\s*}}/g)).map(match => match[1]);
  return Array.from(new Set(encontrados.filter(item => !PLACEHOLDERS_SUPORTADOS.has(item))));
}

export function criarLinkWhatsApp(telefone: string, mensagem: string): string {
  return buildWhatsAppLink(telefone, mensagem);
}
