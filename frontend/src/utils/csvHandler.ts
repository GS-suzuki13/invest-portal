import {
  User,
  UserApi,
  ClientReturn,
  ClientReturnApi,
  Evento,
  ComparativoIndices,
  ChatMensagem,
  ChatConversa,
  ChatResumo,
  Aporte,
  Saque,
  Extrato,
  AgendaRepasses,
} from '../types';
import { apiFetch, setSession } from './api';

const apiUrl = import.meta.env.VITE_API_URL;

export class CSVHandler {
  // Buscar todos os usuários (somente admin)
  static async getUsers(): Promise<User[]> {
    const res = await apiFetch('/users');

    if (!res.ok) {
      throw new Error('Erro ao buscar usuários');
    }

    const data = await res.json();

    return data.map((u: UserApi) => ({
      ...u,
      valor_aportado: parseFloat(String(u.valor_aportado)),
      percentual_contrato: parseFloat(String(u.percentual_contrato)),
    }));
  }

  // Buscar os dados do próprio usuário autenticado
  static async getMe(): Promise<User> {
    const res = await apiFetch('/users/me');

    if (!res.ok) {
      throw new Error('Erro ao buscar dados do usuário');
    }

    const u = await res.json();

    return {
      ...u,
      valor_aportado: parseFloat(u.valor_aportado),
      percentual_contrato: parseFloat(u.percentual_contrato),
    };
  }

  // Adicionar um novo usuário
  static async addUser(user: User): Promise<{ success: boolean }> {
    const res = await apiFetch('/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      // usa a mensagem real do backend (ex.: 409 "Já existe um cadastro com esse cpf")
      throw new Error(
        data?.error || data?.detalhe || 'Erro ao adicionar usuário'
      );
    }

    return data;
  }

  // Autenticação de login
  static async authenticateUser(username: string, password: string): Promise<User | null> {
    const res = await fetch(`${apiUrl}/users/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user: username, password }),
    });

    if (!res.ok) {
      return null;
    }

    const u = await res.json();

    // sem token não há sessão possível — trata como falha de login
    if (!u?.accessToken) {
      return null;
    }
    setSession(u.accessToken);

    return {
      ...u,
      valor_aportado: parseFloat(u.valor_aportado),
      percentual_contrato: parseFloat(u.percentual_contrato),
    };
  }

  // Retornos de um cliente
  static async getClientReturns(clientId: string): Promise<ClientReturn[]> {
    const response = await apiFetch(`/returns/${clientId}`);

    if (!response.ok) {
      throw new Error('Erro ao buscar retornos do cliente');
    }

    const data = await response.json();

    return (Array.isArray(data) ? data : []).map((row: ClientReturnApi) => ({
      id: row.id,
      data: row.data,
      percentual: parseFloat(String(row.percentual)),
      variacao: parseFloat(String(row.variacao)),
      rendimento: parseFloat(String(row.rendimento)),
      userId: row.userId,
      repasseId: row.repasseId ?? null,
    }));
  }

  // Adicionar rendimento a um cliente
  static async addClientReturn(clientId: string, returnData: ClientReturn): Promise<void> {
    const res = await apiFetch(`/returns/${clientId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(returnData),
    });

    if (!res.ok) {
      const corpo = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(corpo?.error || 'Erro ao adicionar rendimento do cliente');
    }
  }

  static async getEventos(): Promise<Evento[]> {
    const res = await apiFetch('/eventos');

    if (!res.ok) {
      throw new Error('Erro ao buscar eventos');
    }

    return await res.json();
  }

  static async addEvento(evento: Evento): Promise<{ success: boolean; evento: Evento }> {
    const res = await apiFetch('/eventos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(evento),
    });

    if (!res.ok) {
      throw new Error('Erro ao criar evento');
    }

    return await res.json();
  }

  static async updateEvento(id: number, evento: Partial<Evento>): Promise<{ success: boolean; evento: Evento }> {
    const res = await apiFetch(`/eventos/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(evento),
    });

    if (!res.ok) {
      throw new Error('Erro ao atualizar evento');
    }

    return await res.json();
  }

  static async cancelEvento(id: number): Promise<{ success: boolean; evento: Evento }> {
    return this.updateEvento(id, { status: 'cancelado' });
  }

  static async deleteEvento(id: number): Promise<{ success: boolean }> {
    const res = await apiFetch(`/eventos/${id}`, {
      method: 'DELETE',
    });

    if (!res.ok) {
      throw new Error('Erro ao excluir evento');
    }

    return await res.json();
  }

  // Comparativo de rendimento (CDI e poupança) num período — dados do Banco Central.
  // Retorna null se os índices estiverem indisponíveis (não quebra o dashboard).
  static async getComparativoIndices(
    inicio: string,
    fim: string
  ): Promise<ComparativoIndices | null> {
    try {
      const res = await apiFetch(
        `/indices/comparativo?inicio=${inicio}&fim=${fim}`
      );
      if (!res.ok) return null;
      return (await res.json()) as ComparativoIndices;
    } catch {
      return null;
    }
  }

  // ---- Chat cliente <-> admin ----

  // Resumo para o sino de notificações. Silencioso em falha (não quebra a tela).
  // Admin clicou no aviso do evento no sino: não aparece mais lá.
  static async marcarEventoVisto(id: number): Promise<void> {
    await apiFetch(`/eventos/${id}/visto`, { method: 'POST' });
  }

  // ---- Agenda de repasses (admin) ----
  static async getAgendaRepasses(): Promise<AgendaRepasses> {
    const res = await apiFetch('/repasse/agenda');
    if (!res.ok) throw new Error('Erro ao carregar a agenda de repasses');
    return (await res.json()) as AgendaRepasses;
  }

  // Fecha o repasse `numero` do investidor (409 se ele já foi fechado).
  static async fecharRepasse(userId: string, numero: number): Promise<{ id: number; label: string; start: string; end: string }> {
    const res = await apiFetch(`/repasse/close/${userId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ numero }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error || 'Erro ao fechar o repasse');
    return data;
  }

  // Soma o líquido do repasse no valor aportado e avisa o investidor pelo chat.
  static async reinvestirRepasse(userId: string, repasseId: number): Promise<void> {
    const res = await apiFetch(`/repasse/${userId}/reinvestir`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repasseId }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error || 'Erro ao reinvestir o rendimento');
  }

  // Repasses fechados do cliente (o último define o próximo repasse)
  static async getRepasses(userId: string): Promise<{ id: number; label: string; start: string; end: string }[]> {
    const res = await apiFetch(`/repasse/${userId}`);
    if (!res.ok) throw new Error('Erro ao buscar repasses');
    const data = await res.json();
    return Array.isArray(data?.repasses) ? data.repasses : [];
  }

  static async getChatResumo(): Promise<ChatResumo | null> {
    try {
      const res = await apiFetch('/chat/resumo');
      if (!res.ok) return null;
      return (await res.json()) as ChatResumo;
    } catch {
      return null;
    }
  }

  // Mensagens de uma conversa (o cliente passa o próprio id; o admin, o id do cliente).
  // A leitura marca como lidas as mensagens da outra parte.
  static async getChatMensagens(userId: string): Promise<ChatMensagem[]> {
    const res = await apiFetch(`/chat/${userId}`);
    if (!res.ok) throw new Error('Erro ao carregar as mensagens');
    return (await res.json()) as ChatMensagem[];
  }

  static async enviarChatMensagem(
    userId: string,
    texto: string
  ): Promise<ChatMensagem> {
    const res = await apiFetch(`/chat/${userId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texto }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error || 'Erro ao enviar a mensagem');
    return data as ChatMensagem;
  }

  // Admin: lista de todas as conversas.
  static async getChatConversas(): Promise<ChatConversa[]> {
    const res = await apiFetch('/chat/conversas');
    if (!res.ok) throw new Error('Erro ao carregar as conversas');
    return (await res.json()) as ChatConversa[];
  }

  // Registra no servidor que o usuário concluiu/pulou o onboarding.
  static async marcarOnboarding(versao: string): Promise<boolean> {
    try {
      const res = await apiFetch('/users/me/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ versao }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  // ---------------- Aportes / Extrato ----------------
  static async getAportes(userId?: string): Promise<Aporte[]> {
    const qs = userId ? `?userId=${encodeURIComponent(userId)}` : '';
    const res = await apiFetch(`/aportes${qs}`);
    if (!res.ok) throw new Error('Erro ao buscar aportes');
    return (await res.json()) as Aporte[];
  }

  static async addAporte(aporte: {
    userId: string;
    valor: number;
    data_recebimento: string;
    observacao?: string;
    historico: boolean;
  }): Promise<{ aporte: Aporte; valor_aportado: number }> {
    const res = await apiFetch('/aportes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(aporte),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error || 'Erro ao registrar aporte');
    return data;
  }

  static async getSaques(userId?: string): Promise<Saque[]> {
    const qs = userId ? `?userId=${encodeURIComponent(userId)}` : '';
    const res = await apiFetch(`/saques${qs}`);
    if (!res.ok) throw new Error('Erro ao buscar saques');
    return (await res.json()) as Saque[];
  }

  static async addSaque(saque: {
    userId: string;
    valor: number;
    data_saque: string;
    observacao?: string;
    historico: boolean;
  }): Promise<{ saque: Saque; valor_aportado: number; avisado: boolean }> {
    const res = await apiFetch('/saques', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(saque),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error || 'Erro ao registrar saque');
    return data;
  }

  static async getExtrato(userId: string): Promise<Extrato> {
    const res = await apiFetch(`/aportes/extrato/${userId}`);
    if (!res.ok) throw new Error('Erro ao buscar extrato');
    return (await res.json()) as Extrato;
  }
}
