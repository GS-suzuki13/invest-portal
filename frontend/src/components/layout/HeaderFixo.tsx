import type { ReactNode } from 'react';
import { useRolou } from '../../hooks/useRolou';

/**
 * Header fixo como material translúcido: o conteúdo rola por baixo e, só quando
 * há conteúdo coberto, aparece a borda de rolagem (degradê), no lugar de uma linha dura.
 * O material vai até a borda (atrás do notch); o conteúdo desce pela área segura.
 */
export default function HeaderFixo({ className = '', children }: { className?: string; children: ReactNode }) {
  const [ref, rolou] = useRolou<HTMLElement>();
  return (
    <header
      ref={ref}
      data-rolou={rolou}
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      className="ip-material ip-borda-rolagem sticky top-0 z-30"
    >
      <div className={className}>{children}</div>
    </header>
  );
}
