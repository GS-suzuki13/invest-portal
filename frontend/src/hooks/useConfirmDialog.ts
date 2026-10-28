import { useCallback, useRef, useState } from 'react';
import type { ConfirmDialogState } from '../components/ui/ConfirmDialog';

type Options = Omit<ConfirmDialogState, 'open'>;

const INITIAL_STATE: ConfirmDialogState = { open: false, title: '', message: '' };

/**
 * Substitui window.confirm/alert por um diálogo com a identidade visual do
 * site. Uso: `const ok = await confirm({ title, message })` ou
 * `await alert({ title, message, tone })` (só botão OK).
 */
export function useConfirmDialog() {
  const [state, setState] = useState<ConfirmDialogState>(INITIAL_STATE);
  const resolver = useRef<(value: boolean) => void>();

  const confirm = useCallback((options: Options) => {
    setState({ ...options, open: true });
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const handleClose = useCallback((result: boolean) => {
    setState((s) => ({ ...s, open: false }));
    resolver.current?.(result);
  }, []);

  const alert = useCallback(
    async (options: Omit<Options, 'alertOnly'>) => {
      await confirm({ ...options, alertOnly: true });
    },
    [confirm]
  );

  return { dialogState: state, confirm, alert, handleClose };
}
