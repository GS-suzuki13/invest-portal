import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import Drawer from '../ui/Drawer';

interface Props {
  aberto: boolean;
  onFechar: () => void;
  titulo: string;
  subtitulo: string;
  icone: LucideIcon;
  children: ReactNode;
}

/** Painel que desliza da direita (ex.: Extrato do portal). */
export default function PainelLateral(props: Props) {
  return <Drawer {...props} />;
}
