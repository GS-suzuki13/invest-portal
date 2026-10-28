import { useState } from 'react';
import { Bell } from 'lucide-react';
import { useChatResumo } from '../hooks/useChatResumo';
import { getSession } from '../utils/api';
import ChatDrawer from './ChatDrawer';

/** Sino de notificações + chat direto com a gestora, para o portal do investidor. */
export default function ClientNotifications() {
  const { resumo, refetch } = useChatResumo();
  const [aberto, setAberto] = useState(false);
  const userId = getSession()?.id ?? '';

  const naoLidas = resumo?.chatNaoLidas ?? 0;

  if (!userId) return null;

  return (
    <>
      <button
        onClick={() => setAberto(true)}
        aria-label="Mensagens e notificações"
        data-tour="mensagens"
        className="relative grid h-9 w-9 place-items-center rounded-full border border-ip-border bg-ip-surface-2 text-ip-text-dim hover:text-ip-text"
      >
        <Bell className="h-4 w-4" />
        {naoLidas > 0 && (
          <span className="absolute -right-1 -top-1 grid min-w-[18px] place-items-center rounded-full bg-ip-gold px-1 ip-selo font-bold text-ip-navy">
            {naoLidas > 9 ? '9+' : naoLidas}
          </span>
        )}
      </button>

      <ChatDrawer
        aberto={aberto}
        onFechar={() => {
          setAberto(false);
          refetch();
        }}
        userId={userId}
        meuLado="cliente"
        titulo="Fale com a gestora"
        subtitulo="Atendimento direto com o administrador"
        outroNome="Gestora"
        onSync={refetch}
      />
    </>
  );
}
