import { useEffect } from 'react';
import { animate } from 'motion/react';
import { LIMIAR_ARRASTE, MOLA_TOQUE } from '../utils/molas';

const ALVOS = 'button, [role="button"], a.ip-btn';

/**
 * Feedback de pressão no site inteiro: o botão afunda no pointerdown (não no
 * clique), com mola, e volta se o dedo sair dele (com ~10px de folga).
 * Botões com transform próprio (ex.: -translate-y-1/2) ficam de fora para não pular;
 * `data-sem-pressao` também tira um elemento da regra.
 */
export function usePressao() {
  useEffect(() => {
    let alvo: HTMLElement | null = null;
    let afundado = false;

    const escala = (el: HTMLElement) => (el.offsetWidth < 48 && el.offsetHeight < 48 ? 0.92 : 0.97);
    const mover = (el: HTMLElement, s: number) => animate(el, { scale: s }, MOLA_TOQUE);

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const el = (e.target as HTMLElement | null)?.closest<HTMLElement>(ALVOS);
      if (!el || el.matches(':disabled, [aria-disabled="true"]') || el.closest('[data-sem-pressao]')) return;
      // transform de layout (Tailwind) que não é nosso: não mexe
      if (!el.dataset.pressao && getComputedStyle(el).transform !== 'none') return;
      el.dataset.pressao = '1';
      alvo = el;
      afundado = true;
      mover(el, escala(el));
    };

    const onMove = (e: PointerEvent) => {
      if (!alvo) return;
      const r = alvo.getBoundingClientRect();
      const dentro =
        e.clientX >= r.left - LIMIAR_ARRASTE &&
        e.clientX <= r.right + LIMIAR_ARRASTE &&
        e.clientY >= r.top - LIMIAR_ARRASTE &&
        e.clientY <= r.bottom + LIMIAR_ARRASTE;
      if (dentro !== afundado) {
        afundado = dentro;
        mover(alvo, dentro ? escala(alvo) : 1);
      }
    };

    const onUp = () => {
      if (!alvo) return;
      mover(alvo, 1);
      alvo = null;
    };

    document.addEventListener('pointerdown', onDown, true);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, []);
}
