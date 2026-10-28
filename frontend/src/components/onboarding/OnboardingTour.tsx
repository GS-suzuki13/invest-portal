import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, ArrowRight, ArrowLeft, X } from 'lucide-react';
import { motion } from 'motion/react';
import Modal from '../ui/Modal';
import { MOLA } from '../../utils/molas';
import type { TourStep } from './steps';

interface Props {
  steps: TourStep[];
  /** primeiro nome do cliente (para a mensagem final) */
  nome: string;
  /** chamado ao concluir OU pular — deve persistir e desmontar o tour */
  onDone: () => void;
}

const PAD = 8; // folga do recorte em volta do elemento
const POP_W = 360;

type Rect = { top: number; left: number; width: number; height: number };

const isMobile = () =>
  typeof window !== 'undefined' && window.innerWidth < 640;

export default function OnboardingTour({ steps, nome, onDone }: Props) {
  // só as etapas cujo alvo existe de fato na tela (medido após montar)
  const [visiveis, setVisiveis] = useState<TourStep[] | null>(null);
  const [fase, setFase] = useState<'passos' | 'bemvindo'>('passos');
  const [i, setI] = useState(0);

  useLayoutEffect(() => {
    const encontrados = steps.filter((s) => {
      const el = document.querySelector(s.target) as HTMLElement | null;
      return el && el.getBoundingClientRect().height > 0;
    });
    setVisiveis(encontrados);
    if (encontrados.length === 0) setFase('bemvindo');
  }, [steps]);
  const [rect, setRect] = useState<Rect | null>(null);
  const [popStyle, setPopStyle] = useState<React.CSSProperties>({ opacity: 0 });
  const popRef = useRef<HTMLDivElement>(null);

  const lista = visiveis ?? [];
  const step = lista[i];
  const ultimo = i === lista.length - 1;

  const avancar = useCallback(() => {
    if (ultimo) setFase('bemvindo');
    else setI((v) => v + 1);
  }, [ultimo]);

  const voltar = useCallback(() => setI((v) => Math.max(0, v - 1)), []);

  // mede o elemento-alvo (e reage a scroll / resize / troca de etapa)
  useLayoutEffect(() => {
    if (fase !== 'passos' || !step) return;
    const el = document.querySelector(step.target) as HTMLElement | null;
    if (!el) {
      avancar();
      return;
    }

    el.scrollIntoView({ block: 'center', inline: 'nearest' });

    let raf = 0;
    const medir = () => {
      const alvo = document.querySelector(step.target) as HTMLElement | null;
      if (!alvo) return;
      const r = alvo.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    const agendar = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(medir);
    };

    const t = setTimeout(medir, 80);
    window.addEventListener('resize', agendar);
    window.addEventListener('scroll', agendar, true);
    return () => {
      clearTimeout(t);
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', agendar);
      window.removeEventListener('scroll', agendar, true);
    };
  }, [fase, step, i, avancar]);

  // posiciona o balão a partir do retângulo medido, sem cortar nas bordas
  useLayoutEffect(() => {
    if (fase !== 'passos' || !rect) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const pop = popRef.current;
    const popH = pop?.offsetHeight ?? 200;
    const popW = Math.min(POP_W, vw - 24);

    if (isMobile()) {
      // folha fixa: embaixo, ou em cima se o alvo estiver na metade inferior
      const emCima = rect.top + rect.height / 2 > vh / 2;
      setPopStyle({
        left: 12,
        right: 12,
        width: 'auto',
        [emCima ? 'top' : 'bottom']: 12,
        opacity: 1,
      });
      return;
    }

    const espacoAbaixo = vh - (rect.top + rect.height);
    const lado =
      step.placement === 'top'
        ? 'top'
        : step.placement === 'bottom'
          ? 'bottom'
          : espacoAbaixo > popH + 24
            ? 'bottom'
            : 'top';

    let top =
      lado === 'bottom'
        ? rect.top + rect.height + PAD + 12
        : rect.top - PAD - 12 - popH;
    let left = rect.left + rect.width / 2 - popW / 2;

    left = Math.max(12, Math.min(left, vw - popW - 12));
    top = Math.max(12, Math.min(top, vh - popH - 12));

    setPopStyle({ top, left, width: popW, opacity: 1 });
  }, [fase, rect, step, i]);

  // teclado
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDone();
      else if (fase === 'passos') {
        if (e.key === 'ArrowRight') avancar();
        else if (e.key === 'ArrowLeft') voltar();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fase, avancar, voltar, onDone]);

  // ---- boas-vindas ----
  if (fase === 'bemvindo') {
    return (
      <Modal z="z-[220]" className="max-w-md p-7 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-ip-gold/15 text-ip-gold">
            <Sparkles className="h-6 w-6" />
          </span>
          <h2 className="mt-4 text-xl font-bold text-ip-text">
            Bem-vindo, {nome}, ao InvestPortal!
          </h2>
          <p className="mt-2 text-sm text-ip-text-dim">
            Agora você já conhece as principais novidades e funcionalidades do
            seu Dashboard. Aproveite a nova experiência!
          </p>
          <button
            onClick={onDone}
            className="ip-btn ip-btn-primary mt-6 w-full py-3"
          >
            Começar a usar
            <ArrowRight className="h-4 w-4" />
          </button>
      </Modal>
    );
  }

  if (!step) return null;

  return createPortal(
    <div className="fixed inset-0 z-[200]">
      {/* bloqueia interação com a página durante o tour */}
      <div className="absolute inset-0" />

      {/* recorte / spotlight: desliza de um alvo ao outro com mola (layout = só transform, x/y/escala independentes) */}
      {rect && (
        <motion.div
          layout
          transition={MOLA}
          className="pointer-events-none absolute rounded-2xl"
          style={{
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
            // contorno dourado como sombra (o motion corrige sombra e cantos durante a escala; outline não)
            boxShadow: '0 0 0 2px #F0C040, 0 0 0 9999px rgba(4,8,15,0.74)',
            borderRadius: 16,
          }}
        />
      )}

      {/* balão de explicação */}
      <motion.div
        ref={popRef}
        layout="position"
        initial={{ opacity: 0 }}
        animate={{ opacity: popStyle.opacity === 0 ? 0 : 1 }}
        transition={MOLA}
        style={{ position: 'fixed', zIndex: 210, ...popStyle, opacity: undefined }}
        className="ip-card ip-aresta p-4 sm:p-5"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start justify-between gap-3">
          <p className="ip-eyebrow">
            Passo {i + 1} de {lista.length}
          </p>
          <div className="flex items-center gap-2">
            {step.novo && (
              <span className="rounded-full bg-ip-gold/15 px-2 py-0.5 ip-selo font-semibold uppercase tracking-wide text-ip-gold">
                Novidade
              </span>
            )}
            <button
              onClick={onDone}
              aria-label="Fechar tutorial"
              className="rounded-lg p-1 text-ip-text-mute hover:text-ip-text"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <h3 className="mt-1.5 text-base font-semibold text-ip-text">
          {step.title}
        </h3>
        <p className="mt-1.5 text-sm leading-relaxed text-ip-text-dim">
          {step.body}
        </p>

        {/* progresso */}
        <div className="mt-4 flex gap-1.5">
          {lista.map((_, idx) => (
            <span
              key={idx}
              className={`h-1.5 flex-1 rounded-full ${
                idx <= i ? 'bg-ip-gold' : 'bg-ip-surface-3'
              }`}
            />
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            onClick={onDone}
            className="text-xs font-medium text-ip-text-mute hover:text-ip-text-dim"
          >
            Pular tutorial
          </button>
          <div className="flex items-center gap-2">
            {i > 0 && (
              <button
                onClick={voltar}
                className="ip-btn ip-btn-ghost px-3 py-2 text-sm"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </button>
            )}
            <button
              onClick={avancar}
              className="ip-btn ip-btn-primary px-4 py-2 text-sm"
            >
              {ultimo ? 'Concluir' : 'Avançar'}
              {!ultimo && <ArrowRight className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}
