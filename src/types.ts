export interface Cadastro {
  id: string;
  dataHora: string;
  contrato: string;
  nomeProp: string;
  telProp: string;
  niverProp: string; // format: DD/MM
  emailProp?: string;
  nomeInq: string;
  telInq: string;
  niverInq: string; // format: DD/MM
  emailInq?: string;
  inicioContrato: string;
  fimContrato: string;
  corretor: string;
  diaVencimento: number;
  enderecoImovel?: string;
  tipoImovel?: string;
  valorAluguel?: number;
  comissao?: number;
  status?: 'Ativo' | 'Encerrado' | 'Renovado';
  finalidade?: string;
  condominio?: string;
  version?: number;
  operationId?: string;
  deletedAt?: string;
  renewedFromId?: string;
}

export interface DocumentoExtra {
  id: string;
  nome: string;
  categoria: string;
  isFeito: boolean;
  pendencia: string;
  status?: 'Pendente' | 'Feito' | 'Não se aplica';
}

export interface ChecklistDocs {
  id: string;
  contrato: string;
  prop_contratoEnviado: boolean;
  prop_vistoriaEnviada: boolean;
  inq_manualEntregue: boolean;
  inq_vistoriaAssinada: boolean;
  inq_seguroIncendio: boolean;
  documentos_json?: string;
  version?: number;
  operationId?: string;
}

export type TipoTarefa = 'Aniversário' | 'Boleto 3 dias' | 'Boleto 2 dias' | 'Boleto 1 dia' | 'Boleto Hoje' | 'Boleto Atrasado' | 'Boleto Enviado';

export interface TarefaConcluida {
  idTarefa: string;
  contrato: string;
  tipo: TipoTarefa;
  dataConclusao: string;
  usuario: string;
  referencia: string; // e.g., '2023' for birthdays, '2023-10' for boletos, or cobrancaId
  operationId?: string;
}

export interface Condominio {
  id: string;
  nome: string;
  nomeNormalizado: string;
  ativo: boolean;
  createdAt: string;
  operationId?: string;
}

export interface Cobranca {
  id: string;
  cadastroId: string;
  contrato: string;
  competencia: string;
  vencimento: string;
  valor: number | string;
  statusPagamento: 'Pendente' | 'Pago' | 'Cancelado';
  pagoEm: string;
  envioConfirmadoEm: string;
  envioOperationId: string;
  pagamentoOperationId?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface Usuario {
  id?: string;
  nome: string;
  email: string;
  login: string;
  senha?: string;
  interfaces: number[];
}
