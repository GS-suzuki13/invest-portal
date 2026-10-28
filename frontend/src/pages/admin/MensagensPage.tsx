import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, ArrowLeft, MessageSquare } from 'lucide-react';
import { CSVHandler } from '../../utils/csvHandler';
import ChatPanel from '../../components/ChatPanel';
import type { ChatConversa } from '../../types';
import { primeiroNome } from '../../utils/nomes';

const quando = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  const min = Math.round((Date.now() - d.getTime()) / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h`;
  return d.toLocaleDateString('pt-BR');
};

const iniciais = (nome: string) =>
  nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');

export default function MensagensPage() {
  const [conversas, setConversas] = useState<ChatConversa[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [params, setParams] = useSearchParams();
  const selecionado = params.get('c');

  const carregar = useCallback(async () => {
    try {
      const lista = await CSVHandler.getChatConversas();
      setConversas(lista);
    } catch {
      /* silencioso */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') carregar();
    }, 15_000);
    return () => clearInterval(id);
  }, [carregar]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return conversas;
    return conversas.filter((c) => c.nome.toLowerCase().includes(q));
  }, [conversas, busca]);

  const atual = conversas.find((c) => c.userId === selecionado) || null;

  const selecionar = (userId: string) => {
    params.set('c', userId);
    setParams(params, { replace: true });
  };
  const voltar = () => {
    params.delete('c');
    setParams(params, { replace: true });
  };

  return (
    <div>
      <p className="ip-eyebrow">Atendimento</p>
      <h1 className="mt-1 text-xl font-bold text-ip-text">
        Mensagens
      </h1>
      <p className="mt-1 text-sm text-ip-text-dim">
        Conversa direta com cada investidor.
      </p>

      <div className="mt-6 grid gap-4 lg:grid-cols-[320px_1fr]">
        {/* lista de conversas */}
        <div
          className={`ip-card flex max-h-[70vh] flex-col overflow-hidden ${
            selecionado ? 'hidden lg:flex' : 'flex'
          }`}
        >
          <div className="border-b border-ip-border p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ip-text-mute" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar cliente..."
                className="w-full rounded-lg border border-ip-border bg-ip-surface-2 py-2 pl-9 pr-3 text-sm text-ip-text placeholder:text-ip-text-mute focus:border-ip-gold/60 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="space-y-2 p-3">
                <div className="skeleton h-14 w-full" />
                <div className="skeleton h-14 w-full" />
                <div className="skeleton h-14 w-full" />
              </div>
            ) : filtradas.length === 0 ? (
              <p className="p-6 text-center text-sm text-ip-text-mute">
                Nenhum cliente encontrado.
              </p>
            ) : (
              filtradas.map((c) => (
                <button
                  key={c.userId}
                  onClick={() => selecionar(c.userId)}
                  className={`flex w-full items-center gap-3 border-b border-ip-border-soft px-3 py-3 text-left hover:bg-white/[0.03] ${
                    c.userId === selecionado ? 'bg-ip-gold/[0.06]' : ''
                  }`}
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ip-surface-3 text-xs font-bold text-ip-text-dim">
                    {iniciais(c.nome) || '·'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium text-ip-text">
                        {c.nome}
                      </p>
                      <span className="shrink-0 ip-selo text-ip-text-mute">
                        {quando(c.ultimaData)}
                      </span>
                    </div>
                    <p className="truncate text-xs text-ip-text-mute">
                      {c.ultimaMensagem || 'Sem mensagens'}
                    </p>
                  </div>
                  {c.naoLidas > 0 && (
                    <span className="grid min-w-[18px] shrink-0 place-items-center rounded-full bg-ip-gold px-1 ip-selo font-bold text-ip-navy">
                      {c.naoLidas}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        {/* painel da conversa */}
        <div
          className={`ip-card flex max-h-[70vh] min-h-[420px] flex-col overflow-hidden ${
            selecionado ? 'flex' : 'hidden lg:flex'
          }`}
        >
          {atual ? (
            <>
              <header className="flex items-center gap-3 border-b border-ip-border px-4 py-3">
                <button
                  onClick={voltar}
                  className="rounded-lg p-1 text-ip-text-dim hover:text-ip-text lg:hidden"
                  aria-label="Voltar"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <span className="grid h-9 w-9 place-items-center rounded-full bg-ip-surface-3 text-xs font-bold text-ip-text-dim">
                  {iniciais(atual.nome) || '·'}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ip-text">
                    {atual.nome}
                  </p>
                  {atual.email && (
                    <p className="truncate text-xs text-ip-text-mute">
                      {atual.email}
                    </p>
                  )}
                </div>
              </header>
              <ChatPanel
                key={atual.userId}
                userId={atual.userId}
                meuLado="admin"
                outroNome={primeiroNome(atual.nome) || atual.nome}
                onSync={carregar}
              />
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-sm text-ip-text-mute">
              <MessageSquare className="mb-3 h-8 w-8 text-ip-text-mute/60" />
              Selecione um cliente para ver a conversa.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
