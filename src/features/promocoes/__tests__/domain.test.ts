import { describe, it, expect } from 'vitest';
import { extrairVinculos, aplicarFiltrosVinculos, agruparContatos, normalizarTelefone, isTelefoneValido, gerarTextoMensagem } from '../domain';
import { Cadastro } from '../../../types';
import { FiltrosPromocao } from '../types';

describe('Promocoes Domain', () => {
  it('aplicarFiltrosVinculos - filtro avançado (condominio, status encerrado, multiplos imoveis)', () => {
    const vinculos = extrairVinculos(cadastrosMock as unknown as Cadastro[]);
    // Status Encerrado
    const filtradoEncerrado = aplicarFiltrosVinculos(vinculos, { ...baseFiltro, status: 'Encerrado' });
    expect(filtradoEncerrado.every(v => v.contrato === '004')).toBe(true);
    
    // Condominio e Tipo de Imovel combinados (mas que existem separadamente em vinculos diferentes)
    // Maria tem Casa (001) e Apt/Bela Vista (002).
    // Se filtrarmos tipoImovel 'Casa' e condominio 'Bela Vista' na baseFiltro, o que acontece?
    // aplicarFiltrosVinculos retorna VINCULOS individuais.
    // Então um vínculo deve satisfazer TODAS as condições.
    const filtradoCombo = aplicarFiltrosVinculos(vinculos, { ...baseFiltro, tiposImovel: ['Casa'], condominios: ['Bela Vista'] });
    expect(filtradoCombo.length).toBe(0); // Nenhum vínculo é Casa e Bela Vista ao mesmo tempo
  });

  it('normalizarTelefone - should keep 55 and clean up non-digits', () => {
    expect(normalizarTelefone('(11) 98765-4321')).toBe('5511987654321');
    expect(normalizarTelefone('+55 11 98765-4321')).toBe('5511987654321');
    expect(normalizarTelefone('5511987654321')).toBe('5511987654321');
    expect(normalizarTelefone('011987654321')).toBe('5511987654321');
    // removed invalid double 55 tests
    // DDD 55 (Rio Grande do Sul) checks
    expect(normalizarTelefone('55 99999-9999')).toBe('5555999999999');
    expect(normalizarTelefone('+55 (55) 99999-9999')).toBe('5555999999999');
  });

  it('isTelefoneValido', () => {
    expect(isTelefoneValido('5511987654321')).toBe(true);
    expect(isTelefoneValido('551187654321')).toBe(true); // Fixo
    expect(isTelefoneValido('11987654321')).toBe(false); // Sem 55
    expect(isTelefoneValido('5511')).toBe(false);
    expect(isTelefoneValido('')).toBe(false);
    expect(isTelefoneValido(null as any)).toBe(false);
  });

  const baseFiltro: FiltrosPromocao = {
    busca: '',
    perfil: 'Todos',
    valorMin: '',
    valorMax: '',
    tiposImovel: [],
    finalidades: [],
    condominios: [],
    status: ''
  };

  const cadastrosMock = [
    {
      id: '1', contrato: '001', 
      nomeProp: 'João', telProp: '11987654321', 
      nomeInq: 'Maria', telInq: '11912345678',
      tipoImovel: 'Casa', finalidade: 'Residencial', condominio: '', valorAluguel: 1000, status: 'Ativo'
    },
    {
      id: '2', contrato: '002',
      nomeProp: 'Maria', telProp: '11912345678', // Maria is owner here
      nomeInq: 'Pedro', telInq: '11999998888',
      tipoImovel: 'Apartamento', finalidade: 'Residencial', condominio: 'Bela Vista', valorAluguel: 2000, status: 'Ativo'
    },
    {
      id: '3', contrato: '003',
      nomeProp: 'Pedro', telProp: '11999998888',
      nomeInq: 'João', telInq: '11987654321', // João is tenant here
      tipoImovel: 'Casa', finalidade: 'Comercial', condominio: '', valorAluguel: 3000, status: 'Ativo'
    },
    {
      id: '4', contrato: '004',
      nomeProp: 'Empresa', telProp: '11000000', // Invalid/Fake
      nomeInq: 'Empresa', telInq: '11000000', // Same phone for both
      tipoImovel: 'Comercial', finalidade: 'Comercial', condominio: '', valorAluguel: '4000', status: 'Encerrado'
    }
  ];

  it('extrairVinculos - deve separar prop e inq', () => {
    const vinculos = extrairVinculos(cadastrosMock as unknown as Cadastro[]);
    expect(vinculos.length).toBe(8); // 4 props + 4 inqs
    const joaoProp = vinculos.find(v => v.nome === 'João' && v.perfil === 'Proprietário');
    expect(joaoProp).toBeDefined();
    expect(joaoProp?.valorAluguel).toBe(1000);
    
    // Testa parse do valor em string
    const empresaInq = vinculos.find(v => v.nome === 'Empresa' && v.perfil === 'Inquilino');
    expect(empresaInq?.valorAluguel).toBe(4000);
  });

  it('aplicarFiltrosVinculos - filtro de status e valor e tipo', () => {
    const vinculos = extrairVinculos(cadastrosMock as unknown as Cadastro[]);
    const result = aplicarFiltrosVinculos(vinculos, {
      ...baseFiltro,
      status: 'Ativo',
      valorMin: 1500,
      valorMax: 3500,
      tiposImovel: ['Apartamento', 'Casa']
    });
    
    // Apenas contratos 002 (2000) e 003 (3000) devem passar
    // Ou seja: Prop 002, Inq 002, Prop 003, Inq 003 = 4 vínculos
    expect(result.length).toBe(4);
    expect(result.every(v => v.contrato === '002' || v.contrato === '003')).toBe(true);
  });

  it('agruparContatos - proprietário somente', () => {
    const vinculos = extrairVinculos(cadastrosMock as unknown as Cadastro[]);
    const filtrados = aplicarFiltrosVinculos(vinculos, { ...baseFiltro });
    
    const contatos = agruparContatos(filtrados, vinculos, { ...baseFiltro, perfil: 'Proprietário' });
    
    // Telefones únicos que têm vínculo de proprietário: João, Maria, Pedro, Empresa
    expect(contatos.length).toBe(4);
    
    // Todos eles têm perfil Proprietário
    expect(contatos.every(c => c.perfis.includes('Proprietário'))).toBe(true);
  });

  it('agruparContatos - proprietário e inquilino (ambos)', () => {
    const vinculos = extrairVinculos(cadastrosMock as unknown as Cadastro[]);
    const filtrados = aplicarFiltrosVinculos(vinculos, { ...baseFiltro });
    
    const contatos = agruparContatos(filtrados, vinculos, { ...baseFiltro, perfil: 'Proprietário e inquilino' });
    
    // João, Maria e Pedro têm ambos os perfis e telefone utilizável. A Empresa
    // permanece fora do público enviável porque seu telefone é inválido.
    expect(contatos.length).toBe(3);
    
    const maria = contatos.find(c => c.nomes.includes('Maria'));
    expect(maria?.perfis).toContain('Proprietário');
    expect(maria?.perfis).toContain('Inquilino');
  });

  it('agruparContatos - telefones compartilhados', () => {
    // Adicionando uma pessoa diferente com o mesmo telefone de João
    const mock = [...cadastrosMock, {
      id: '5', contrato: '005', nomeProp: 'Clone do Joao', telProp: '11987654321',
      nomeInq: '', telInq: '', tipoImovel: '', finalidade: '', condominio: '', valorAluguel: 100, status: 'Ativo'
    }];
    
    const vinculos = extrairVinculos(mock as unknown as Cadastro[]);
    const filtrados = aplicarFiltrosVinculos(vinculos, { ...baseFiltro });
    const contatos = agruparContatos(filtrados, vinculos, baseFiltro);
    
    const joaoEClone = contatos.find(c => c.contactKey === '5511987654321');
    expect(joaoEClone?.telefoneCompartilhado).toBe(true);
    expect(joaoEClone?.nomes.length).toBe(2);
  });

  it('agruparContatos - telefone inválido', () => {
    const vinculos = extrairVinculos(cadastrosMock as unknown as Cadastro[]);
    const filtrados = aplicarFiltrosVinculos(vinculos, { ...baseFiltro });
    const contatos = agruparContatos(filtrados, vinculos, baseFiltro);
    
    const empresa = contatos.find(c => c.nomes.includes('Empresa'));
    expect(empresa?.telefoneValido).toBe(false); // 5511000000000 é muito curto/inválido
  });

  it('gerarTextoMensagem', () => {
    const vinculos = extrairVinculos(cadastrosMock as unknown as Cadastro[]);
    const filtrados = aplicarFiltrosVinculos(vinculos, { ...baseFiltro });
    const contatos = agruparContatos(filtrados, vinculos, baseFiltro);
    
    const maria = contatos.find(c => c.nomes.includes('Maria'));
    
    const template = "Olá {{nome}}, você é {{perfil}} da campanha {{campanha}}! Contratos: {{contratos}}. Cond: {{condominios}}.";
    const result = gerarTextoMensagem(template, maria!, 'Oferta');
    
    expect(result).toBe("Olá Maria, você é Inquilino e Proprietário da campanha Oferta! Contratos: 001, 002. Cond: Bela Vista.");
    
    const templateWithUnknown = "Oi {{nome}}, {{inexistente}}.";
    const result2 = gerarTextoMensagem(templateWithUnknown, maria!, 'Oferta');
    expect(result2).toBe("Oi Maria, {{inexistente}}.");
  });
});
