import { AnimatePresence } from 'motion/react';
import { AlertTriangle, CheckCircle2, HelpCircle, Info } from 'lucide-react';
import Modal from './Modal';

export interface ConfirmDialogState {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger' | 'success';
  /** mostra só um botão (uso como alerta, sem opção de cancelar) */
  alertOnly?: boolean;
}

interface Props extends ConfirmDialogState {
  onClose: (result: boolean) => void;
}

/** Substitui window.confirm/alert nativos, com a identidade visual do site. */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  tone = 'default',
  alertOnly = false,
  onClose,
}: Props) {
  const isDanger = tone === 'danger';
  const isSuccess = tone === 'success';
  const Icon = isDanger ? AlertTriangle : isSuccess ? CheckCircle2 : alertOnly ? Info : HelpCircle;

  // sempre renderizado: o AnimatePresence segura o diálogo montado enquanto ele sai
  return (
    <AnimatePresence>
      {open && (
      <Modal onFechar={() => onClose(false)} z="z-[200]" role="alertdialog" className="max-w-sm p-5">
        <div className="flex items-start gap-3">
          <span
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${
              isDanger
                ? 'bg-ip-negative/15 text-ip-negative'
                : isSuccess
                ? 'bg-ip-positive/15 text-ip-positive'
                : 'bg-ip-gold/15 text-ip-gold'
            }`}
          >
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1 pt-1">
            <h3 className="text-sm font-semibold text-ip-text">{title}</h3>
            <p className="mt-1 whitespace-pre-line text-sm text-ip-text-dim">{message}</p>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          {!alertOnly && (
            <button
              onClick={() => onClose(false)}
              className="ip-btn ip-btn-ghost px-3.5 py-2 text-sm"
            >
              {cancelLabel}
            </button>
          )}
          <button
            onClick={() => onClose(true)}
            className={`ip-btn px-4 py-2 text-sm ${
              isDanger ? 'ip-btn-danger' : 'ip-btn-primary'
            }`}
          >
            {alertOnly ? 'OK' : confirmLabel}
          </button>
        </div>
      </Modal>
      )}
    </AnimatePresence>
  );
}
