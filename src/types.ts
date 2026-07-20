export interface Cadastro {
  id: string;
  dataHora: string;
  contrato: string;
  nomeProp: string;
  telProp: string;
  niverProp: string; // format: DD/MM
  nomeInq: string;
  telInq: string;
  niverInq: string; // format: DD/MM
  inicioContrato: string;
  fimContrato: string;
  corretor: string;
  diaVencimento: number;
}

export interface ChecklistDocs {
  id: string;
  contrato: string;
  prop_contratoEnviado: boolean;
  prop_vistoriaEnviada: boolean;
  inq_manualEntregue: boolean;
  inq_vistoriaAssinada: boolean;
  inq_seguroIncendio: boolean;
}

export type TipoTarefa = 'Aniversário' | 'Boleto 5 dias' | 'Boleto 1 dia';

export interface TarefaConcluida {
  idTarefa: string;
  contrato: string;
  tipo: TipoTarefa;
  dataConclusao: string;
  usuario: string;
  referencia: string; // e.g., '2023' for birthdays, '2023-10' for boletos
}
