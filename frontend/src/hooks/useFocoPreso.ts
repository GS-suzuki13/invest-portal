import { useEffect, type RefObject } from 'react';

const FOCAVEIS =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// pilha de diálogos abertos: só o de cima controla o Tab e o Esc
const pilha: HTMLElement[] = [];

const focaveis = (el: HTMLElement) =>
  [...el.querySelectorAll<HTMLElement>(FOCAVEIS)].filter((f) => f.offsetParent !== null || f === document.activeElement);

/**
 * Prende o foco do teclado dentro de um painel/modal enquanto `ativo`:
 * ao abrir, foca o primeiro controle; Tab/Shift+Tab circulam lá dentro;
 * Esc chama `onEsc`; ao fechar, o foco volta para quem abriu.
 */
export function useFocoPreso(ref: RefObject<HTMLElement>, ativo: boolean, onEsc?: () => void) {
  useEffect(() => {
    const el = ref.current;
    if (!ativo || !el) return;

    const anterior = document.activeElement as HTMLElement | null;
    pilha.push(el);
    // espera o painel montar o conteúdo antes de focar
    const t = requestAnimationFrame(() => {
      if (!el.contains(document.activeElement)) (focaveis(el)[0] ?? el).focus({ preventScroll: true });
    });

    const onKey = (e: KeyboardEvent) => {
      if (pilha[pilha.length - 1] !== el) return;
      if (e.key === 'Escape' && onEsc) {
        e.stopPropagation();
        onEsc();
        return;
      }
      if (e.key !== 'Tab') return;
      const lista = focaveis(el);
      if (lista.length === 0) {
        e.preventDefault();
        el.focus();
        return;
      }
      const primeiro = lista[0];
      const ultimo = lista[lista.length - 1];
      const atual = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (atual === primeiro || !el.contains(atual))) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && (atual === ultimo || !el.contains(atual))) {
        e.preventDefault();
        primeiro.focus();
      }
    };
    document.addEventListener('keydown', onKey);

    return () => {
      cancelAnimationFrame(t);
      document.removeEventListener('keydown', onKey);
      const i = pilha.lastIndexOf(el);
      if (i >= 0) pilha.splice(i, 1);
      // devolve o foco a quem abriu, se ele ainda estiver na tela
      if (anterior && document.contains(anterior)) anterior.focus({ preventScroll: true });
    };
  }, [ref, ativo, onEsc]);
}
