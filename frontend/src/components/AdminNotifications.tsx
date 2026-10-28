import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Bell, MessageSquare, CalendarClock, X } from 'lucide-react';
import { useChatResumo } from '../hooks/useChatResumo';
import { CSVHandler } from '../utils/csvHandler';
import { MOLA } from '../utils/molas';

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

// "vence hoje", "vence em 2 dias", "venceu há 3 dias"
const vencimento = (data: string) => {
  const [a, m, d] = data.split('-').map(Number);
  const hoje = new Date();
  const dias = Math.round(
    (Date.UTC(a, m - 1, d) - Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())) / 86400000
  );
  if (dias === 0) return 'vence hoje';
  if (dias === 1) return 'vence amanhã';
  if (dias > 1) return `vence em ${dias} dias`;
  if (dias === -1) return 'venceu ontem';
  return `venceu há ${-dias} dias`;
};

/** Sino de notificações do admin: mensagens não lidas + eventos perto do vencimento. */
export default function AdminNotifications() {
  const { resumo, refetch } = useChatResumo();
  const [aberto, setAberto] = useState(false);
  const navigate = useNavigate();

  const chatNaoLidas = resumo?.chatNaoLidas ?? 0;
  const eventosPendentes = resumo?.eventosPendentes ?? 0;
  const eventos = resumo?.eventos ?? [];
  const conversas = resumo?.conversas ?? [];
  const total = chatNaoLidas + eventosPendentes;

  useEffect(() => {
    if (!aberto) return;
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && setAberto(false);
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [aberto]);

  const ir = (path: string) => {
    setAberto(false);
    navigate(path);
  };

  // clicou no aviso: some do sino (o evento continua na agenda)
  const abrirEvento = async (id: number) => {
    ir('/admin/eventos');
    await CSVHandler.marcarEventoVisto(id).catch(() => undefined);
    // atualiza todos os sinos (o layout tem um no topo mobile e outro no desktop)
    window.dispatchEvent(new Event('ip:chat-sync'));
  };

  return (
    <>
      <button
        onClick={() => {
          setAberto((v) => !v);
          refetch();
        }}
        aria-label="Notificações"
        className="relative grid h-9 w-9 place-items-center rounded-full border border-ip-border bg-ip-surface-2 text-ip-text-dim hover:text-ip-text"
      >
        <Bell className="h-4 w-4" />
        {total > 0 && (
          <span className="absolute -right-1 -top-1 grid min-w-[18px] place-items-center rounded-full bg-ip-gold px-1 ip-selo font-bold text-ip-navy">
            {total > 9 ? '9+' : total}
          </span>
        )}
      </button>

      {createPortal(
          <>
            {aberto && (
              <div
                className="fixed inset-0 z-[100]"
                onClick={() => setAberto(false)}
              />
            )}
            {/* nasce do sino (canto superior direito) e volta para ele */}
            <AnimatePresence>
            {aberto && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95, pointerEvents: 'none' }}
              transition={MOLA}
              className="ip-material ip-aresta fixed right-3 top-16 z-[110] w-[320px] max-w-[calc(100vw-1.5rem)] origin-top-right overflow-hidden rounded-2xl border border-ip-border sm:right-6"
            >
              <div className="flex items-center justify-between border-b border-ip-border px-4 py-3">
                <p className="text-sm font-semibold text-ip-text">
                  Notificações
                </p>
                <button
                  onClick={() => setAberto(false)}
                  aria-label="Fechar"
                  className="rounded-lg p-1 text-ip-text-dim hover:text-ip-text"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="max-h-[60vh] overflow-y-auto">
                {eventos.map((ev) => {
                  const venceu = vencimento(ev.data).startsWith('venceu');
                  return (
                    <button
                      key={`evento-${ev.id}`}
                      onClick={() => abrirEvento(ev.id)}
                      className="flex w-full items-center gap-3 border-b border-ip-border-soft px-4 py-3 text-left hover:bg-white/[0.03]"
                    >
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ip-sky/15 text-ip-sky">
                        <CalendarClock className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ip-text">{ev.nome}</p>
                        <p className={`text-xs ${venceu ? 'text-ip-negative' : 'text-ip-text-mute'}`}>
                          {new Date(`${ev.data}T00:00:00`).toLocaleDateString('pt-BR')} · {vencimento(ev.data)}
                        </p>
                      </div>
                    </button>
                  );
                })}

                {conversas.map((c) => (
                  <button
                    key={c.userId}
                    onClick={() => ir(`/admin/mensagens?c=${c.userId}`)}
                    className="flex w-full items-start gap-3 border-b border-ip-border-soft px-4 py-3 text-left hover:bg-white/[0.03]"
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ip-gold/15 text-ip-gold">
                      <MessageSquare className="h-4 w-4" />
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
                      <p className="truncate text-xs text-ip-text-dim">
                        {c.ultimaMensagem}
                      </p>
                    </div>
                    <span className="mt-0.5 grid min-w-[18px] shrink-0 place-items-center rounded-full bg-ip-gold px-1 ip-selo font-bold text-ip-navy">
                      {c.naoLidas}
                    </span>
                  </button>
                ))}

                {total === 0 && (
                  <p className="px-4 py-8 text-center text-sm text-ip-text-mute">
                    Nada de novo por aqui.
                  </p>
                )}
              </div>

              <button
                onClick={() => ir('/admin/mensagens')}
                className="w-full border-t border-ip-border px-4 py-2.5 text-center text-xs font-medium text-ip-gold hover:bg-white/[0.03]"
              >
                Abrir todas as mensagens
              </button>
            </motion.div>
            )}
            </AnimatePresence>
          </>,
          document.body
        )}
    </>
  );
}
