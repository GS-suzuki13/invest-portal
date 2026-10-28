import { useEffect, useRef, useState } from 'react';

/** sobe a árvore até achar quem rola (o cartão do ☰ ou a própria janela) */
function rolador(el: HTMLElement | null): HTMLElement | Window {
  for (let p = el?.parentElement; p; p = p.parentElement) {
    const { overflowY } = getComputedStyle(p);
    if (overflowY === 'auto' || overflowY === 'scroll') return p;
  }
  return window;
}

/**
 * true quando há conteúdo rolado por baixo do elemento (header fixo): a borda
 * de rolagem só aparece onde o material flutuante realmente cobre conteúdo.
 */
export function useRolou<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [rolou, setRolou] = useState(false);
  useEffect(() => {
    const alvo = rolador(ref.current);
    const ler = () => setRolou((alvo instanceof Window ? alvo.scrollY : alvo.scrollTop) > 0);
    ler();
    alvo.addEventListener('scroll', ler, { passive: true });
    return () => alvo.removeEventListener('scroll', ler);
  }, []);
  return [ref, rolou] as const;
}
