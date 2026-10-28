import { useCallback, useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import { CSVHandler } from '../utils/csvHandler';
import type { ChatMensagem } from '../types';

interface Props {
  userId: string;
  meuLado: 'cliente' | 'admin';
  /** chamado depois de cada carga (para atualizar o contador do sino). */
  onSync?: () => void;
  /** rótulo de quem está do outro lado. */
  outroNome?: string;
  className?: string;
}

const horario = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};
const diaLabel = (iso: string) => {
  const d = new Date(iso);
  const hoje = new Date();
  const ontem = new Date();
  ontem.setDate(hoje.getDate() - 1);
  if (d.toDateString() === hoje.toDateString()) return 'Hoje';
  if (d.toDateString() === ontem.toDateString()) return 'Ontem';
  return d.toLocaleDateString('pt-BR');
};

export default function ChatPanel({
  userId,
  meuLado,
  onSync,
  outroNome,
  className = '',
}: Props) {
  const [mensagens, setMensagens] = useState<ChatMensagem[]>([]);
  const [texto, setTexto] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const fimRef = useRef<HTMLDivElement>(null);
  const emAndamento = useRef(false);

  const carregar = useCallback(async () => {
    if (emAndamento.current) return;
    emAndamento.current = true;
    try {
      const lista = await CSVHandler.getChatMensagens(userId);
      setMensagens(lista);
      setErro('');
      onSync?.();
      // avisa os sinos de notificação (leitura pode ter zerado o contador)
      window.dispatchEvent(new Event('ip:chat-sync'));
    } catch {
      setErro('Não foi possível carregar as mensagens.');
    } finally {
      emAndamento.current = false;
      setCarregando(false);
    }
  }, [userId, onSync]);

  useEffect(() => {
    setCarregando(true);
    carregar();
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') carregar();
    }, 10_000);
    return () => clearInterval(id);
  }, [carregar]);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ block: 'end' });
  }, [mensagens.length, carregando]);

  const enviar = async () => {
    const t = texto.trim();
    if (!t || enviando) return;
    setEnviando(true);
    setErro('');
    try {
      const nova = await CSVHandler.enviarChatMensagem(userId, t);
      setMensagens((prev) => [...prev, nova]);
      setTexto('');
      onSync?.();
      window.dispatchEvent(new Event('ip:chat-sync'));
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao enviar.');
    } finally {
      setEnviando(false);
    }
  };

  let ultimoDia = '';

  return (
    <div className={`flex min-h-0 flex-1 flex-col ${className}`}>
      {/* mensagens */}
      <div className="flex-1 space-y-1 overflow-y-auto px-4 py-4">
        {carregando ? (
          <div className="space-y-3">
            <div className="skeleton h-10 w-40" />
            <div className="skeleton ml-auto h-10 w-48" />
            <div className="skeleton h-10 w-32" />
          </div>
        ) : mensagens.length === 0 ? (
          <div className="flex h-full min-h-[160px] flex-col items-center justify-center text-center text-sm text-ip-text-mute">
            <p>Nenhuma mensagem ainda.</p>
            <p className="mt-1">
              {meuLado === 'cliente'
                ? 'Escreva para falar direto com a gestora.'
                : 'Escreva para iniciar a conversa com este cliente.'}
            </p>
          </div>
        ) : (
          mensagens.map((m) => {
            const meu = m.autor === meuLado;
            const dia = diaLabel(m.createdAt);
            const mostrarDia = dia !== ultimoDia;
            ultimoDia = dia;
            return (
              <div key={m.id}>
                {mostrarDia && (
                  <div className="my-3 flex justify-center">
                    <span className="rounded-full bg-ip-surface-2 px-2.5 py-0.5 ip-selo uppercase tracking-wide text-ip-text-mute">
                      {dia}
                    </span>
                  </div>
                )}
                <div className={`flex ${meu ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${
                      meu
                        ? 'rounded-br-sm bg-ip-gold/15 text-ip-text'
                        : 'rounded-bl-sm bg-ip-surface-2 text-ip-text'
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{m.texto}</p>
                    <p className="mt-0.5 text-right ip-selo text-ip-text-mute">
                      {horario(m.createdAt)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={fimRef} />
      </div>

      {erro && (
        <p className="px-4 pb-1 text-xs text-ip-negative">{erro}</p>
      )}

      {/* composer */}
      <div className="border-t border-ip-border bg-ip-bg-soft p-3">
        <div className="flex items-end gap-2">
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                enviar();
              }
            }}
            rows={1}
            maxLength={2000}
            placeholder={
              outroNome
                ? `Mensagem para ${outroNome}...`
                : 'Escreva sua mensagem...'
            }
            className="max-h-32 min-h-[42px] flex-1 resize-none rounded-xl border border-ip-border bg-ip-surface px-3.5 py-2.5 text-sm text-ip-text placeholder:text-ip-text-mute focus:border-ip-gold/60 focus:outline-none focus:ring-2 focus:ring-ip-gold/25"
          />
          <button
            onClick={enviar}
            disabled={!texto.trim() || enviando}
            aria-label="Enviar"
            className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-xl bg-ip-gold text-ip-navy hover:bg-ip-gold-600 disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
