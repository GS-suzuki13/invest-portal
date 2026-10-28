export interface User {
  id: string;
  user: string;
  password?: string;
  token: 'adm' | 'user';
  name: string;
  cpf: string;
  email: string;
  data_cadastro: string;
  data_modificacao: string;
  valor_aportado: number;
  percentual_contrato: number;
  /** versão do tutorial de onboarding já concluída/pulada (null = nunca viu) */
  onboarding_versao?: string | null;
}

export interface ClientReturn {
  id?: number;
  data: string;
  percentual: number;
  variacao: number;
  rendimento: number;
  userId?: string;
  repasseId?: number | null;
}

/** Usuário como chega da API: colunas DECIMAL podem vir como texto. */
export interface UserApi extends Omit<User, 'valor_aportado' | 'percentual_contrato'> {
  valor_aportado: number | string;
  percentual_contrato: number | string;
}

/** Rendimento como chega da API (antes de virar ClientReturn). */
export interface ClientReturnApi {
  id?: number;
  data: string;
  percentual: number | string;
  variacao?: number | string | null;
  rendimento: number | string;
  userId?: string;
  repasseId?: number | null;
}

/** Período de repasse como chega da API. */
export interface RepasseApi {
  id?: number | string | null;
  label?: string | null;
  start?: string | null;
  end?: string | null;
}

export interface LoggedUser {
  id: string;
  username: string;
  name: string;
  token: 'adm' | 'user';
  role: 'admin' | 'user';
}

export interface IndicePonto {
  data: string; // YYYY-MM-DD
  fator: number; // acumulado desde o início do período (1 = 0%)
}

export interface IndiceSerie {
  rotulo: string;
  serie: IndicePonto[];
  fator: number;
  percentual: number;
}

export interface ComparativoIndices {
  inicio: string;
  fim: string;
  dias_uteis: number;
  fonte: string;
  cdi: IndiceSerie;
  poupanca: IndiceSerie;
}

export type EventoStatus = 'pendente' | 'concluido' | 'cancelado';
export interface Evento {
  id?: number;
  nome: string;
  data: string;
  status: EventoStatus;
  recorrente: boolean;
  categoria?: string | null;
  observacao?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

// ---- Chat cliente <-> admin ----
export interface ChatMensagem {
  id: number;
  userId: string;
  autor: 'cliente' | 'admin';
  texto: string;
  lida: boolean;
  createdAt: string;
}

export interface ChatConversa {
  userId: string;
  nome: string;
  email?: string;
  naoLidas: number;
  ultimaMensagem: string;
  ultimaData: string | null;
}

export interface ChatResumo {
  chatNaoLidas: number;
  // presentes só para o admin:
  conversas?: ChatConversa[];
  eventosPendentes?: number;
  // eventos que vencem em até 3 dias (ou vencidos) e ainda não foram clicados
  eventos?: { id: number; nome: string; data: string }[];
}

export interface Aporte {
  id: number;
  userId: string;
  nome?: string;
  valor: number;
  data_recebimento: string;
  observacao: string | null;
  somado_ao_aportado: boolean;
  createdAt: string;
}

export interface Saque {
  id: number;
  userId: string;
  nome?: string;
  valor: number;
  data_saque: string;
  observacao: string | null;
  descontado_do_aportado: boolean;
  createdAt: string;
}

export interface ExtratoLancamento {
  id: string;
  data: string;
  tipo: 'aporte' | 'saque' | 'rendimento';
  descricao: string;
  valor: number;
}

export interface Extrato {
  totais: { aportado: number; sacado: number; rendimentos: number };
  lancamentos: ExtratoLancamento[];
}

// ---- Agenda de repasses (admin) ----
export interface AgendaRepasseItem {
  userId: string;
  nome: string;
  valor_aportado: number;
  numero: number;
  dataInicio: string; // YYYY-MM-DD
  dataFim: string; // YYYY-MM-DD
  situacao: 'hoje' | 'atrasado' | 'amanha';
  lancamentos: number;
  bruto: number;
  taxa: number;
  liquido: number;
}

export interface AgendaRepasses {
  hoje: string;
  amanha: string;
  itens: AgendaRepasseItem[];
}
