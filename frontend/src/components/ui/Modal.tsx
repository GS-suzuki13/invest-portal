import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion, useIsPresent } from 'motion/react';
import { MOLA } from '../../utils/molas';
import { useFocoPreso } from '../../hooks/useFocoPreso';

/** nível de empilhamento: um modal aberto sobre outro recua o de baixo */
const Pilha = createContext<{ nivel: number; avisarFilho: (delta: number) => void } | null>(null);

interface Props {
  /** clique no fundo escuro; sem ele, o fundo não fecha o modal */
  onFechar?: () => void;
  /** tecla Esc (sem ela, usa onFechar; sem nenhum dos dois, Esc não fecha) */
  onEsc?: () => void;
  children: ReactNode;
  /** classes do cartão (largura, altura, padding) */
  className?: string;
  z?: string;
  role?: 'dialog' | 'alertdialog';
  /** false: só a animação, sem a superfície (o conteúdo já traz o próprio cartão) */
  cartao?: boolean;
}

/**
 * Casca dos modais: fundo escuro + cartão que entra e sai pelo mesmo caminho
 * (escala 0.96 ↔ 1 com mola). Use dentro de <AnimatePresence> para a saída animar.
 */
export default function Modal({ onFechar, onEsc, children, className = '', z = 'z-50', role = 'dialog', cartao = true }: Props) {
  const pai = useContext(Pilha);
  const [filhos, setFilhos] = useState(0);
  const nivel = pai ? pai.nivel + 1 : 0;
  // saindo: já não bloqueia cliques e o modal de baixo começa a voltar
  const presente = useIsPresent();
  const cartaoRef = useRef<HTMLDivElement>(null);
  // teclado: foco preso no cartão, Esc fecha, foco volta para quem abriu
  useFocoPreso(cartaoRef, presente, onEsc ?? onFechar);

  useEffect(() => {
    if (!pai || !presente) return;
    pai.avisarFilho(1);
    return () => pai.avisarFilho(-1);
  }, [pai, presente]);

  const recuado = filhos > 0;
  const pilha = useMemo(() => ({ nivel, avisarFilho: (d: number) => setFilhos((n) => n + d) }), [nivel]);

  return createPortal(
    <Pilha.Provider value={pilha}>
      <div className={`fixed inset-0 ${z} flex items-center justify-center p-3 sm:p-6 ${presente ? '' : 'pointer-events-none'}`}>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={MOLA}
          onClick={onFechar}
          // sobre outro modal o fundo é mais leve: o de baixo já está escurecido
          className={`absolute inset-0 ${nivel > 0 ? 'bg-black/40' : 'ip-scrim'}`}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: recuado ? 0.97 : 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={MOLA}
          ref={cartaoRef}
          tabIndex={-1}
          role={role}
          aria-modal="true"
          className={`relative w-full ${cartao ? 'ip-aresta rounded-2xl border border-ip-border bg-ip-surface' : ''} ${className}`}
        >
          {children}
        </motion.div>
      </div>
    </Pilha.Provider>,
    document.body
  );
}
