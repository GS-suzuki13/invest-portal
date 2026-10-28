import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { LayoutDashboard, LogOut, ReceiptText } from 'lucide-react';
import Header from './Header';
import PainelLateral from './PainelLateral';
import MenuRecuo, { BotaoMenu, ItemCascata } from './MenuRecuo';
import ExtratoPanel from '../ExtratoPanel';
import { getSession } from '../../utils/api';

type Painel = 'extrato' | null;

/**
 * Portal do investidor com o menu ☰ no mesmo estilo do admin ("página recua"):
 * a página encolhe e vai para a direita, revelando o menu por trás.
 * O Extrato abre em um painel lateral.
 */
export default function ClientLayout({ onLogout, children }: { onLogout: () => void; children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [painel, setPainel] = useState<Painel>(null);
  const cartao = useRef<HTMLDivElement>(null);
  const userId = getSession()?.id ?? '';

  useEffect(() => {
    if (!menuOpen) return;
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [menuOpen]);

  const abrirPainel = (p: Painel) => {
    setMenuOpen(false);
    setPainel(p);
  };
  const fecharPainel = useCallback(() => setPainel(null), []);

  const ITENS = [
    {
      chave: 'inicio',
      label: 'Visão geral',
      icon: LayoutDashboard,
      onClick: () => {
        setMenuOpen(false);
        cartao.current?.scrollTo({ top: 0, behavior: 'smooth' });
      },
      ativo: true,
      aviso: '',
    },
    { chave: 'extrato', label: 'Extrato', icon: ReceiptText, onClick: () => abrirPainel('extrato'), ativo: false, aviso: '' },
  ];

  const foco = menuOpen ? 0 : -1;
  const fecharMenu = useCallback(() => setMenuOpen(false), []);

  return (
    <>
      <MenuRecuo
        aberto={menuOpen}
        onFechar={fecharMenu}
        cartaoRef={cartao}
        botao={
          <BotaoMenu aberto={menuOpen} onAlternar={() => setMenuOpen((v) => !v)} aviso={false} dataTour="menu" />
        }
        menu={
          <>
            <nav className="flex flex-1 flex-col gap-1">
              {ITENS.map(({ chave, label, icon: Icon, onClick, ativo, aviso }, i) => (
                <ItemCascata key={chave} indice={i} aberto={menuOpen}>
                  <button
                    onClick={onClick}
                    tabIndex={foco}
                    className={`relative flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium ${
                      ativo ? 'bg-ip-gold/12 text-ip-gold' : 'text-ip-text-dim hover:bg-white/[0.04] hover:text-ip-text'
                    }`}
                  >
                    {ativo && (
                      <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-ip-gold" />
                    )}
                    <Icon size={18} className="shrink-0" />
                    <span className="flex-1">{label}</span>
                    {aviso && (
                      <span className="ip-selo rounded-full bg-ip-gold px-2 py-0.5 font-bold text-ip-navy">{aviso}</span>
                    )}
                  </button>
                </ItemCascata>
              ))}
            </nav>

            <ItemCascata indice={ITENS.length} aberto={menuOpen}>
              <button
                onClick={onLogout}
                tabIndex={foco}
                className="ip-btn ip-btn-ghost w-full text-ip-text-dim hover:text-ip-negative"
              >
                <LogOut size={16} />
                Sair
              </button>
            </ItemCascata>
          </>
        }
      >
        <Header />
        {children}
      </MenuRecuo>

      {userId && (
        <>
          <PainelLateral aberto={painel === 'extrato'} onFechar={fecharPainel} titulo="Extrato" subtitulo="Seus aportes e rendimentos recebidos" icone={ReceiptText}>
            <ExtratoPanel userId={userId} />
          </PainelLateral>
        </>
      )}
    </>
  );
}
