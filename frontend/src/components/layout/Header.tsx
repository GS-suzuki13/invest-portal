import { useEffect, useState } from 'react';
import logo from '../../assets/logo.svg';
import { getSession } from '../../utils/api';
import ClientNotifications from '../ClientNotifications';
import HeaderFixo from './HeaderFixo';
import { iniciais, primeiroNome } from '../../utils/nomes';

/** Topo do portal do investidor: espaço do ☰ (ClientLayout) + logo | nome + sino. */
export default function Header() {
  const [name, setName] = useState('');

  useEffect(() => {
    setName(getSession()?.name || '');
  }, []);

  // por grafema: emoji ou acento no início do nome nunca vira meio caractere
  const initials = iniciais(name);

  return (
    <HeaderFixo>
      <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10" />
          <img src={logo} alt="InvestPortal" className="h-7 w-auto object-contain sm:h-8" />
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {name && (
            <div className="hidden items-center gap-2.5 rounded-full border border-ip-border bg-ip-surface-2 py-1 pl-1 pr-3 sm:flex">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-gold-sheen ip-selo font-bold text-ip-navy">
                {initials || '·'}
              </span>
              <span title={name} className="max-w-[160px] truncate text-sm font-medium text-ip-text">
                {primeiroNome(name) || name}
              </span>
            </div>
          )}

          <ClientNotifications />
        </div>
      </div>
    </HeaderFixo>
  );
}
