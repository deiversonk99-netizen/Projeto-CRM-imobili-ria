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
}

export interface DocumentoExtra {
  id: string;
  nome: string;
  categoria: 'Locatário' | 'Locador' | 'Imóvel' | 'Outros';
  isFeito: boolean;
  pendencia: string;
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
}

export type TipoTarefa = 'Aniversário' | 'Boleto 5 dias' | 'Boleto 1 dia' | 'Boleto Hoje';

export interface TarefaConcluida {
  idTarefa: string;
  contrato: string;
  tipo: TipoTarefa;
  dataConclusao: string;
  usuario: string;
  referencia: string; // e.g., '2023' for birthdays, '2023-10' for boletos
}
