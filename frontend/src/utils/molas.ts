import type { Transition } from 'motion/react';

/**
 * Molas do site (regras da skill apple-design):
 * - damping 1.0 (bounce 0) por padrão: assenta sem passar do ponto;
 * - damping ~0.8 (bounce 0.2) só quando o gesto anterior carregou impulso;
 * - response entre 0.3 e 0.4 s (no motion, `visualDuration`).
 * Toda animação parte do valor desenhado na tela, então pode ser interrompida.
 */
export const MOLA: Transition = { type: 'spring', bounce: 0, visualDuration: 0.35 };
export const MOLA_IMPULSO: Transition = { type: 'spring', bounce: 0.2, visualDuration: 0.35 };
/** pressão de botão: resposta mais curta, ainda sem overshoot */
export const MOLA_TOQUE: Transition = { type: 'spring', bounce: 0, visualDuration: 0.3 };
/** movimento reduzido: só opacidade, curto */
export const MOLA_FADE: Transition = { type: 'spring', bounce: 0, visualDuration: 0.2 };

/** acima disso (px/s) o gesto conta como "peteleco" e a mola ganha bounce */
export const VELOCIDADE_IMPULSO = 300;

/** distância (px) antes de assumir a direção do arraste */
export const LIMIAR_ARRASTE = 10;

/**
 * Projeção de momento da Apple: onde o elemento pararia se seguisse
 * desacelerando como o scroll. 0.998 = scroll normal, 0.99 = mais seco.
 */
export function projetar(velocidade: number, desaceleracao = 0.998) {
  return ((velocidade / 1000) * desaceleracao) / (1 - desaceleracao);
}

/** Resistência progressiva além do limite: quanto mais longe, menos acompanha. */
export function rubberband(overshoot: number, dimensao: number, constante = 0.55) {
  return (overshoot * dimensao * constante) / (dimensao + constante * Math.abs(overshoot));
}

/** Mede a velocidade (px/s) pelos últimos ~100 ms de movimento, não só pelos 2 últimos eventos. */
export function criarMedidorVelocidade(janelaMs = 100) {
  let amostras: { t: number; v: number }[] = [];
  return {
    registrar(valor: number, t = performance.now()) {
      amostras.push({ t, v: valor });
      amostras = amostras.filter((a) => t - a.t <= janelaMs);
    },
    velocidade() {
      if (amostras.length < 2) return 0;
      const a = amostras[0];
      const b = amostras[amostras.length - 1];
      const dt = b.t - a.t;
      return dt > 0 ? ((b.v - a.v) / dt) * 1000 : 0;
    },
    zerar() {
      amostras = [];
    },
  };
}
