import React, { useCallback, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  HandCoins,
  Users,
  TrendingUp,
  CalendarDays,
  MessageSquare,
  Wallet,
  LogOut,
} from 'lucide-react';
import logo from '../../assets/logo.svg';
import AdminNotifications from '../../components/AdminNotifications';
import MenuRecuo, { BotaoMenu, ItemCascata } from '../../components/layout/MenuRecuo';
import HeaderFixo from '../../components/layout/HeaderFixo';

interface AdminLayoutProps {
  onLogout: () => void;
}

const NAV = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/clientes', label: 'Clientes', icon: Users },
  { to: '/admin/repasses', label: 'Repasses', icon: HandCoins },
  { to: '/admin/rendimentos', label: 'Rendimentos', icon: TrendingUp },
  { to: '/admin/aportes', label: 'Aportes/Saques', icon: Wallet },
  { to: '/admin/eventos', label: 'Eventos', icon: CalendarDays },
  { to: '/admin/mensagens', label: 'Mensagens', icon: MessageSquare },
];

/**
 * Menu "página recua": o menu fica atrás da página; ao abrir, a página encolhe,
 * escurece e vai para a direita como um cartão, revelando o menu.
 * A página rola dentro do próprio cartão (não na janela), para o recuo
 * funcionar em qualquer ponto da rolagem.
 */
const AdminLayout: React.FC<AdminLayoutProps> = ({ onLogout }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();

  // fecha ao trocar de página
  useEffect(() => setMenuOpen(false), [pathname]);

  // Esc fecha
  useEffect(() => {
    if (!menuOpen) return;
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [menuOpen]);

  const navItem = ({ isActive }: { isActive: boolean }) =>
    `group relative flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium ${
      isActive
        ? 'bg-ip-gold/12 text-ip-gold'
        : 'text-ip-text-dim hover:bg-white/[0.04] hover:text-ip-text'
    }`;

  const foco = menuOpen ? 0 : -1;
  const fecharMenu = useCallback(() => setMenuOpen(false), []);

  return (
    <MenuRecuo
      aberto={menuOpen}
      onFechar={fecharMenu}
      botao={<BotaoMenu aberto={menuOpen} onAlternar={() => setMenuOpen((v) => !v)} />}
      menu={
        <>
          <nav className="flex flex-1 flex-col gap-1">
            {NAV.map(({ to, label, icon: Icon }, i) => (
              <ItemCascata key={to} indice={i} aberto={menuOpen}>
                <NavLink to={to} className={navItem} tabIndex={foco}>
                  {({ isActive }) => (
                    <>
                      <span
                        className={`absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-ip-gold ${
                          isActive ? 'opacity-100' : 'opacity-0'
                        }`}
                      />
                      <Icon size={18} className="shrink-0" />
                      {label}
                    </>
                  )}
                </NavLink>
              </ItemCascata>
            ))}
          </nav>

          <ItemCascata indice={NAV.length} aberto={menuOpen}>
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
        {/* barra superior: espaço do ☰ + logo | sino */}
        <HeaderFixo className="flex items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10" />
            <img src={logo} alt="InvestPortal" className="h-7 w-auto object-contain" />
          </div>
          <AdminNotifications />
        </HeaderFixo>

        <main className="relative p-4 sm:p-6 lg:p-8">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-60 bg-ip-radial" />
          <div className="relative mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
    </MenuRecuo>
  );
};

export default AdminLayout;
