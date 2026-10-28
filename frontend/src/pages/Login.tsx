import React, { useEffect, useRef, useState } from 'react';
import { Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { MOLA } from '../utils/molas';
import { CSVHandler } from '../utils/csvHandler';
import { getSession } from '../utils/api';
import logo from '../assets/logo.svg';
import type { LoggedUser } from '../types';

const homeFor = (role: LoggedUser['role']) =>
  role === 'admin' ? '/admin/dashboard' : '/dashboard-cliente';

// contas fictícias da demonstração (src/demoData.js no backend)
const CONTAS_DEMO = [
  { label: 'Administrador', user: 'admin', senha: 'admin123' },
  { label: 'Investidor', user: 'investidor.demo', senha: 'demo123' },
];

const Login: React.FC = () => {
  const navigate = useNavigate();
  const hasRedirected = useRef(false);

  const [formData, setFormData] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (hasRedirected.current) return;

    // Mesmo critério do ProtectedRoute: só redireciona com sessão de fato
    // válida (token presente e não expirado). Sessão inválida/antiga é
    // limpa dentro de getSession() — sem token, ficamos no login, sem loop.
    const session = getSession();
    if (!session) return;

    hasRedirected.current = true;
    navigate(homeFor(session.role), { replace: true });
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    setIsLoading(true);
    setError('');

    try {
      const username = formData.username.trim();
      const foundUser = await CSVHandler.authenticateUser(
        username,
        formData.password
      );

      if (!foundUser) {
        setError('Usuário ou senha inválidos');
        setIsLoading(false);
        return;
      }

      const role: 'admin' | 'user' = foundUser.token === 'adm' ? 'admin' : 'user';

      const userData: LoggedUser = {
        id: foundUser.id,
        username: foundUser.user,
        name: foundUser.name,
        token: foundUser.token,
        role,
      };

      // token já foi gravado por authenticateUser(); grava o usuário junto
      localStorage.setItem('loggedUser', JSON.stringify(userData));

      hasRedirected.current = true;
      navigate(homeFor(role), { replace: true });
    } catch (error) {
      console.error('Erro ao autenticar:', error);
      setError('Erro ao autenticar usuário');
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-[100svh] flex-col overflow-hidden bg-ip-bg">
      {/* fundo ambiente */}
      <div className="pointer-events-none absolute inset-0 bg-ip-radial" />
      <div className="pointer-events-none absolute -left-40 top-1/3 h-[420px] w-[420px] rounded-full bg-ip-navy/40 blur-[120px]" />
      <div className="pointer-events-none absolute -right-32 -top-24 h-[360px] w-[360px] rounded-full bg-ip-gold/10 blur-[130px]" />

      <main className="relative z-10 flex flex-1 items-center justify-center px-5 py-12">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={MOLA}
          className="w-full max-w-[400px]"
        >
          <div className="mb-8 flex flex-col items-center text-center">
            <img
              src={logo}
              alt="InvestPortal"
              className="h-9 w-auto object-contain"
            />
            <h1 className="mt-7 text-[1.375rem] font-bold tracking-[-0.018em] text-ip-text">
              Área do investidor
            </h1>
            <p className="mt-1.5 text-sm text-ip-text-dim">
              Acompanhe seus aportes e rendimentos
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="ip-card space-y-5 p-6 sm:p-7"
          >
            <div>
              <label className="ip-label">Usuário</label>
              <input
                type="text"
                required
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={formData.username}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, username: e.target.value }))
                }
                className="ip-input"
                placeholder="nome.sobrenome"
              />
            </div>

            <div>
              <label className="ip-label">Senha</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ip-text-mute" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, password: e.target.value }))
                  }
                  className="ip-input pl-11 pr-11"
                  placeholder="••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-ip-text-mute hover:text-ip-text"
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={MOLA}
                className="rounded-xl border border-ip-negative/25 bg-ip-negative/10 px-3.5 py-2.5 text-sm text-ip-negative"
              >
                {error}
              </motion.div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="ip-btn ip-btn-primary w-full py-3"
            >
              {isLoading ? (
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-ip-navy/30 border-t-ip-navy" />
              ) : (
                <>
                  Entrar
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-5 rounded-2xl border border-ip-border-soft bg-ip-surface/60 p-4">
            <p className="ip-eyebrow text-center">Acesso de demonstração</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {CONTAS_DEMO.map((c) => (
                <button
                  key={c.user}
                  type="button"
                  onClick={() => {
                    setError('');
                    setFormData({ username: c.user, password: c.senha });
                  }}
                  className="ip-btn ip-btn-ghost flex-col gap-0.5 px-2 py-2.5"
                >
                  <span>{c.label}</span>
                  <span className="text-xs font-normal text-ip-text-mute">
                    {c.user} · {c.senha}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-ip-text-mute">
            InvestPortal · Dados fictícios de demonstração
          </p>
        </motion.div>
      </main>

    </div>
  );
};

export default Login;
