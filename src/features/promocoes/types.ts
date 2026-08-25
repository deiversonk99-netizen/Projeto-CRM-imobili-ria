export type PerfilContato = 'Proprietário' | 'Inquilino';

export interface VinculoContratual {
  cadastroId: string;
  perfil: PerfilContato;
  nome: string;
  telefoneOriginal: string;
  telefoneNormalizado: string;
  contrato: string;
  status: string;
  valorAluguel: number | null;
  tipoImovel: string;
  finalidade: string;
  condominio: string;
  telefoneValido: boolean;
  nomeInquilino?: string;
  nomeProprietario?: string;
}

export interface ContatoAgrupado {
  contactKey: string; // O telefone normalizado
  nomes: string[];
  telefoneOriginal: string;
  telefoneNormalizado: string;
  perfis: PerfilContato[];
  vinculos: VinculoContratual[];
  vinculosFiltrados: VinculoContratual[]; // Vínculos que passaram nos filtros
  telefoneValido: boolean;
  telefoneCompartilhado: boolean; // Mais de um nome diferente no mesmo telefone
}

export interface FiltrosPromocao {
  busca: string;
  perfil: 'Todos' | 'Proprietário' | 'Inquilino' | 'Proprietário e inquilino';
  valorMin: number | '';
  valorMax: number | '';
  tiposImovel: string[];
  finalidades: string[];
  condominios: string[];
  status: string;
  selectedContactKeys?: string[];
}

export type CampanhaStatus = 'RASCUNHO' | 'INICIADA' | 'CONCLUIDA' | 'CANCELADA' | 'ARQUIVADA';

export interface Campanha {
  id: string;
  nome: string;
  descricao: string;
  mensagemTemplate: string;
  filtrosJson: string; // JSON de FiltrosPromocao
  status: CampanhaStatus;
  inicioEm: string | null;
  fimEm: string | null;
  audienciaTotal: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  operationId: string;
  ativa: boolean;
  desativadaEm: string | null;
}

export type DestinatarioStatus = 'PENDENTE' | 'WHATSAPP_ABERTO' | 'ENVIO_CONFIRMADO' | 'IGNORADO' | 'ERRO';

export interface CampanhaDestinatario {
  id: string;
  campanhaId: string;
  contactKey: string;
  nome: string;
  telefone: string;
  perfisJson: string; // Array de PerfilContato
  cadastroIdsJson: string; // Array de IDs
  contratosJson: string; // Array de números de contrato
  contextoJson: string; // Dados adicionais do contato
  mensagemRenderizada: string;
  status: DestinatarioStatus;
  whatsappAbertoEm: string | null;
  envioConfirmadoEm: string | null;
  ignoradoEm: string | null;
  motivo: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  operationId: string;
}

export interface PromocaoStats {
  totalContatos: number;
  totalVinculos: number;
  totalInvalidos: number;
  totalCompartilhados: number;
}
