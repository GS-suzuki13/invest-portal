import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type AnimationPlaybackControls,
  type Transition,
} from 'motion/react';
import { X, type LucideIcon } from 'lucide-react';
import { useFocoPreso } from '../../hooks/useFocoPreso';
import {
  LIMIAR_ARRASTE,
  MOLA,
  MOLA_FADE,
  MOLA_IMPULSO,
  VELOCIDADE_IMPULSO,
  criarMedidorVelocidade,
  projetar,
  rubberband,
} from '../../utils/molas';

interface Props {
  aberto: boolean;
  onFechar: () => void;
  titulo: string;
  subtitulo?: string;
  icone: LucideIcon;
  children: ReactNode;
}

type Arraste = { id: number; x0: number; y0: number; inicio: number; travado: boolean };

const molaPara = (v: number): Transition => (Math.abs(v) > VELOCIDADE_IMPULSO ? MOLA_IMPULSO : MOLA);

/**
 * Painel que entra e sai pela direita, com mola. Pode ser agarrado a qualquer
 * momento (inclusive no meio da animação) e arrastado para fechar.
 */
export default function Drawer({ aberto, onFechar, titulo, subtitulo, icone: Icone, children }: Props) {
  const reduzir = useReducedMotion();
  const painel = useRef<HTMLElement>(null);
  const cabecalho = useRef<HTMLElement>(null);
  const largura = useRef(typeof window === 'undefined' ? 10000 : window.innerWidth);

  // x: deslocamento do painel (0 = aberto, largura = fechado); op: opacidade (movimento reduzido)
  const x = useMotionValue(largura.current);
  const op = useMotionValue(1);
  // o fundo escuro deriva da posição do painel: os dois andam sempre juntos, até no arraste
  const scrim = useTransform(() => Math.min(1, Math.max(0, 1 - x.get() / largura.current)) * op.get());

  const [montado, setMontado] = useState(aberto);
  const [oculto, setOculto] = useState(!aberto);
  const abertoRef = useRef(aberto);
  const controles = useRef<AnimationPlaybackControls>();
  const velocidadeSoltura = useRef<number | null>(null);
  const arraste = useRef<Arraste | null>(null);
  const arrastou = useRef(false);
  const medidor = useRef(criarMedidorVelocidade()).current;

  // mede a largura real (w-full no celular, 448px no desktop)
  useLayoutEffect(() => {
    const el = painel.current;
    if (!el) return;
    const medir = () => {
      largura.current = el.offsetWidth || largura.current;
      if (!abertoRef.current) x.set(largura.current);
    };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, [x]);

  useEffect(() => {
    abertoRef.current = aberto;
    const v = velocidadeSoltura.current ?? 0;
    velocidadeSoltura.current = null;
    controles.current?.stop();

    if (aberto) {
      setMontado(true);
      setOculto(false);
      if (reduzir) {
        if (x.get() > 0) op.set(0);
        x.set(0);
        controles.current = animate(op, 1, MOLA_FADE);
      } else {
        op.set(1);
        controles.current = animate(x, 0, { ...molaPara(v), velocity: v });
      }
      return;
    }

    const terminar = () => {
      if (abertoRef.current) return;
      setMontado(false);
      setOculto(true);
    };
    if (reduzir) {
      controles.current = animate(op, 0, {
        ...MOLA_FADE,
        onComplete: () => {
          x.set(largura.current);
          terminar();
        },
      });
    } else {
      controles.current = animate(x, largura.current, { ...molaPara(v), velocity: v, onComplete: terminar });
    }
  }, [aberto, reduzir, x, op]);

  // teclado: foco preso no painel, Esc fecha, foco volta para quem abriu
  useFocoPreso(painel, aberto, onFechar);

  useEffect(() => {
    if (!aberto) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [aberto]);

  // ── arrastar para fechar ────────────────────────────────────────────────
  const onPointerDown = (e: PointerEvent<HTMLElement>) => {
    if (!aberto || e.button !== 0) return;
    const alvo = e.target as HTMLElement;
    if (alvo.closest('input, textarea, select, [contenteditable="true"]')) return;
    // no mouse, só pelo cabeçalho (no resto, arrastar seleciona texto)
    if (e.pointerType === 'mouse' && !cabecalho.current?.contains(alvo)) return;
    arraste.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, inicio: 0, travado: false };
    arrastou.current = false;
  };

  const onPointerMove = (e: PointerEvent<HTMLElement>) => {
    const a = arraste.current;
    if (!a || a.id !== e.pointerId) return;
    if (!a.travado) {
      const dx = e.clientX - a.x0;
      const dy = e.clientY - a.y0;
      if (Math.hypot(dx, dy) < LIMIAR_ARRASTE) return;
      // vertical: é rolagem, deixa com o navegador
      if (Math.abs(dy) > Math.abs(dx)) {
        arraste.current = null;
        return;
      }
      // agarra de onde o painel está desenhado agora, mesmo no meio da mola
      controles.current?.stop();
      a.travado = true;
      a.inicio = x.get();
      a.x0 = e.clientX;
      medidor.zerar();
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    const bruto = a.inicio + (e.clientX - a.x0);
    x.set(bruto < 0 ? rubberband(bruto, largura.current) : bruto);
    medidor.registrar(bruto);
  };

  const onPointerUp = (e: PointerEvent<HTMLElement>) => {
    const a = arraste.current;
    if (!a || a.id !== e.pointerId) return;
    arraste.current = null;
    if (!a.travado) return;
    arrastou.current = true;

    const v = medidor.velocidade();
    const atual = x.get();
    if (atual + projetar(v) > largura.current / 2) {
      velocidadeSoltura.current = v;
      onFechar();
      return;
    }
    // volta para aberto; saindo do rubber-band não há impulso rumo ao alvo
    controles.current = animate(x, 0, { ...(atual < 0 ? MOLA : molaPara(v)), velocity: v });
  };

  return createPortal(
    <>
      <motion.div
        onClick={onFechar}
        style={{ opacity: scrim }}
        className={`ip-scrim fixed inset-0 z-[100] ${aberto ? '' : 'pointer-events-none'} ${oculto ? 'invisible' : ''}`}
      />
      <motion.aside
        ref={painel}
        // área segura: o painel vai até a borda, o conteúdo desvia do notch e da barra inferior
        style={{ x, opacity: op, paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClickCapture={(e) => {
          // o clique que encerra um arraste não aciona o botão embaixo do dedo
          if (!arrastou.current) return;
          arrastou.current = false;
          e.preventDefault();
          e.stopPropagation();
        }}
        className={`ip-aresta ip-rolagem-contida fixed right-0 top-0 z-[110] flex h-[100dvh] w-full max-w-md touch-pan-y flex-col border-l border-ip-border bg-ip-surface ${
          oculto ? 'invisible' : ''
        }`}
        role="dialog"
        aria-modal="true"
        aria-hidden={!aberto}
        aria-label={titulo}
        tabIndex={-1}
      >
        {/* fundo prolongado à direita: no rubber-band nunca aparece fresta */}
        <div aria-hidden className="pointer-events-none absolute inset-y-0 left-full w-screen bg-ip-surface" />

        <header ref={cabecalho} className="flex select-none items-center gap-3 border-b border-ip-border px-4 py-3">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-ip-gold/15 text-ip-gold">
            <Icone className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ip-text">{titulo}</p>
            {subtitulo && <p className="truncate text-xs text-ip-text-mute">{subtitulo}</p>}
          </div>
          <button onClick={onFechar} aria-label="Fechar" className="rounded-lg p-1.5 text-ip-text-dim hover:text-ip-text">
            <X className="h-5 w-5" />
          </button>
        </header>

        {montado && children}
      </motion.aside>
    </>,
    document.body
  );
}
