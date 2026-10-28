import { MessageSquare } from 'lucide-react';
import ChatPanel from './ChatPanel';
import Drawer from './ui/Drawer';

interface Props {
  aberto: boolean;
  onFechar: () => void;
  userId: string;
  meuLado: 'cliente' | 'admin';
  titulo: string;
  subtitulo?: string;
  outroNome?: string;
  onSync?: () => void;
}

export default function ChatDrawer({
  aberto,
  onFechar,
  userId,
  meuLado,
  titulo,
  subtitulo,
  outroNome,
  onSync,
}: Props) {
  return (
    <Drawer aberto={aberto} onFechar={onFechar} titulo={titulo} subtitulo={subtitulo} icone={MessageSquare}>
      <ChatPanel userId={userId} meuLado={meuLado} outroNome={outroNome} onSync={onSync} />
    </Drawer>
  );
}
