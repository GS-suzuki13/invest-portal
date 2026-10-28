import { useEffect, useState, type ReactNode, type Ref } from 'react';
import { motion } from 'motion/react';
import { MOLA } from '../../utils/molas';

function useTelaSm() {
  const consulta = '(min-width: 640px)';
  const [sm, setSm] = useState(() => window.matchMedia(consulta).matches);
  useEffect(() => {
    const mq = window.matchMedia(consulta);
    const onChange = () => setSm(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return sm;
}

interface Props {
  aberto: boolean;
  onFechar: () => void;
  /** itens do menu (use <ItemCascata> em cada um) */
  menu: ReactNode;
  /** o ☰ (<BotaoMenu>): fica fora do cartão, sempre no lugar */
  botao: ReactNode;
  /** a página; rola dentro do cartão, não na janela */
  children: ReactNode;
  cartaoRef?: Ref<HTMLDivElement>;
}

/**
 * Menu "página recua": o menu fica atrás da página; ao abrir, a página vira um
 * cartão que encolhe e vai para a direita. Tudo com mola, a partir do valor
 * desenhado na tela, então tocar no ☰ no meio do caminho inverte na hora.
 */
export default function MenuRecuo({ aberto, onFechar, menu, botao, children, cartaoRef }: Props) {
  const sm = useTelaSm();
  // cantos arredondados e header sem blur enquanto o cartão está fora do lugar
  const [recuado, setRecuado] = useState(aberto);
  useEffect(() => {
    if (aberto) setRecuado(true);
  }, [aberto]);

  const alvo = { x: aberto ? (sm ? 256 : 232) : 0, scale: aberto ? (sm ? 0.84 : 0.8) : 1 };

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#04070c]">
      {/* palco atrás da página: brilho dourado bem sutil */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(90%_80%_at_0%_0%,rgba(240,192,64,0.07),transparent_60%)]" />

      {/* menu (fica atrás da página) */}
      <aside
        aria-hidden={!aberto}
        style={{ paddingTop: 'calc(5rem + env(safe-area-inset-top, 0px))', paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}
        className="absolute inset-y-0 left-0 z-0 flex w-60 flex-col px-4 sm:w-64"
      >
        {/* brilho dourado que se desenha ao abrir */}
        <motion.div
          initial={false}
          animate={{ scaleX: aberto ? 1 : 0 }}
          transition={{ ...MOLA, delay: aberto ? 0.08 : 0 }}
          style={{ top: 'calc(68px + env(safe-area-inset-top, 0px))' }}
          className="absolute left-4 right-4 h-[2px] origin-left bg-gold-sheen"
        />
        {menu}
      </aside>

      {/* a página: vira um cartão que recua para a direita */}
      <motion.div
        ref={cartaoRef}
        initial={false}
        animate={alvo}
        transition={MOLA}
        onAnimationComplete={() => !aberto && setRecuado(false)}
        onClickCapture={(e) => {
          // com o menu aberto, clicar na página só fecha o menu
          if (!aberto) return;
          e.preventDefault();
          e.stopPropagation();
          onFechar();
        }}
        className={`absolute inset-0 z-10 origin-left bg-ip-bg shadow-[0_30px_80px_rgba(0,0,0,0.6),0_0_0_1px_rgba(31,43,61,1)] ${
          aberto ? 'cursor-pointer overflow-hidden' : 'overflow-y-auto overscroll-contain'
        } ${recuado ? 'ip-recuado rounded-3xl' : ''}`}
      >
        {children}
      </motion.div>

      {/* escurece a página recuada: camada irmã com a mesma mola, só opacidade (sem filter) */}
      <motion.div
        aria-hidden
        initial={false}
        animate={{ ...alvo, opacity: aberto ? 0.2 : 0 }}
        transition={MOLA}
        className={`pointer-events-none absolute inset-0 z-[11] origin-left bg-black ${recuado ? 'rounded-3xl' : ''}`}
      />

      {botao}
    </div>
  );
}

/** item do menu que entra em cascata; clicável desde o primeiro quadro */
export function ItemCascata({ indice, aberto, children }: { indice: number; aberto: boolean; children: ReactNode }) {
  return (
    <motion.div
      initial={false}
      animate={{ x: aberto ? 0 : -24, opacity: aberto ? 1 : 0 }}
      transition={{ ...MOLA, delay: aberto ? 0.04 + indice * 0.03 : 0 }}
    >
      {children}
    </motion.div>
  );
}

/** ☰ que vira um X dourado: as linhas animam y/rotate (transform), não top */
export function BotaoMenu({
  aberto,
  onAlternar,
  aviso = false,
  dataTour,
}: {
  aberto: boolean;
  onAlternar: () => void;
  aviso?: boolean;
  dataTour?: string;
}) {
  const linha = 'absolute left-0 top-0 h-[2px] w-5 rounded-full bg-current';
  return (
    <button
      onClick={onAlternar}
      aria-label={aberto ? 'Fechar menu' : 'Abrir menu'}
      aria-expanded={aberto}
      data-tour={dataTour}
      style={{ top: 'calc(0.75rem + env(safe-area-inset-top, 0px))' }}
      className={`absolute left-4 top-3 z-20 grid h-10 w-10 place-items-center rounded-xl border bg-ip-surface-2 sm:left-6 lg:left-8 ${
        aberto ? 'border-ip-gold/40 text-ip-gold' : 'border-ip-border text-ip-text-dim hover:border-ip-gold/40 hover:text-ip-gold'
      }`}
    >
      <span className="relative block h-3.5 w-5">
        <motion.span className={linha} initial={false} animate={{ y: 6 * Number(aberto), rotate: aberto ? 45 : 0 }} transition={MOLA} />
        <motion.span className={linha} initial={false} animate={{ y: 6, scaleX: aberto ? 0 : 1, opacity: aberto ? 0 : 1 }} transition={MOLA} />
        <motion.span className={linha} initial={false} animate={{ y: aberto ? 6 : 12, rotate: aberto ? -45 : 0 }} transition={MOLA} />
      </span>
      {aviso && !aberto && (
        <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-ip-gold ring-2 ring-ip-bg" />
      )}
    </button>
  );
}
