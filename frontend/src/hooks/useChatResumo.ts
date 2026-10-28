import { useCallback, useEffect, useRef, useState } from 'react';
import { CSVHandler } from '../utils/csvHandler';
import type { ChatResumo } from '../types';

/**
 * Faz polling do resumo de notificações do chat (e, para o admin, eventos
 * pendentes). Pausa quando a aba está em segundo plano e atualiza ao voltar.
 */
export function useChatResumo(intervalMs = 20_000) {
  const [resumo, setResumo] = useState<ChatResumo | null>(null);
  const emAndamento = useRef(false);

  const buscar = useCallback(async () => {
    if (emAndamento.current) return;
    if (document.visibilityState === 'hidden') return;
    emAndamento.current = true;
    try {
      const r = await CSVHandler.getChatResumo();
      if (r) setResumo(r);
    } finally {
      emAndamento.current = false;
    }
  }, []);

  useEffect(() => {
    buscar();
    const id = setInterval(buscar, intervalMs);
    const onVis = () => {
      if (document.visibilityState === 'visible') buscar();
    };
    // atualiza na hora quando uma conversa é aberta/enviada em qualquer lugar
    const onSync = () => buscar();
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('ip:chat-sync', onSync);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('ip:chat-sync', onSync);
    };
  }, [buscar, intervalMs]);

  return { resumo, refetch: buscar };
}
