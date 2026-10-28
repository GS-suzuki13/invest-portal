import { CalendarClock, X } from 'lucide-react';
import { User } from '../../types';
import Modal from '../ui/Modal';

export type RepasseProximo = User & {
  proximoRepasse: string; // DD/MM/AAAA
  proximoISO: string; // YYYY-MM-DD
  grupo: 'atrasado' | 'hoje' | 'proximo';
};

interface ClientNextBusinessDayProps {
  data: RepasseProximo[];
  carregando: boolean;
  onClose: () => void;
}

const formatMoney = (value: number) =>
  Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// "amanhã" ou o dia da semana (ex.: sexta → "segunda-feira, 19/10")
const rotuloProximo = (iso: string) => {
  const [a, m, d] = iso.split('-').map(Number);
  const data = new Date(a, m - 1, d);
  const amanha = new Date();
  amanha.setDate(amanha.getDate() + 1);
  if (data.toDateString() === amanha.toDateString()) return 'Amanhã';
  const dia = data.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' });
  return dia.charAt(0).toUpperCase() + dia.slice(1);
};

export default function ClientNextBusinessDay({ data, carregando, onClose }: ClientNextBusinessDayProps) {
  const proximos = data.filter((c) => c.grupo === 'proximo');
  // hoje e o próximo dia útil primeiro; atrasados por último (a lista pode ser longa)
  const grupos = [
    { chave: 'hoje', titulo: 'Hoje', dica: '', cor: 'text-ip-gold', itens: data.filter((c) => c.grupo === 'hoje') },
    {
      chave: 'proximo',
      titulo: proximos.length ? rotuloProximo(proximos[0].proximoISO) : 'Próximo dia útil',
      dica: '',
      cor: 'text-ip-sky',
      itens: proximos,
    },
    {
      chave: 'atrasado',
      titulo: 'Atrasados',
      dica: 'Venceram e o repasse ainda não foi fechado',
      cor: 'text-ip-negative',
      itens: data.filter((c) => c.grupo === 'atrasado'),
    },
  ].filter((g) => g.itens.length > 0);

  return (
    <Modal onEsc={onClose} className="max-w-lg overflow-hidden">
        <div className="flex items-center justify-between border-b border-ip-border px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-ip-gold/12 text-ip-gold">
              <CalendarClock className="h-4 w-4" />
            </span>
            <h2 className="text-base font-semibold text-ip-text">Próximos repasses</h2>
          </div>
          <button aria-label="Fechar"
            onClick={onClose}
            className="rounded-lg p-1.5 text-ip-text-mute hover:text-ip-text"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[60vh] space-y-5 overflow-y-auto p-5">
          {carregando ? (
            <div className="space-y-2.5">
              <div className="skeleton h-14 w-full" />
              <div className="skeleton h-14 w-full" />
            </div>
          ) : grupos.length === 0 ? (
            <p className="py-6 text-center text-sm text-ip-text-mute">
              Nenhum repasse atrasado, para hoje ou para o próximo dia útil.
            </p>
          ) : (
            grupos.map((g) => (
              <section key={g.chave}>
                <div className="mb-2 flex items-baseline justify-between gap-3">
                  <h3 className={`text-xs font-semibold uppercase tracking-wider ${g.cor}`}>
                    {g.titulo} · {g.itens.length}
                  </h3>
                  {g.dica && <span className="ip-selo text-ip-text-mute">{g.dica}</span>}
                </div>
                <ul className="space-y-2">
                  {g.itens.map((c) => (
                    <li key={c.id} className="ip-card-i p-3.5">
                      <p className="font-medium text-ip-text">{c.name}</p>
                      <div className="mt-1 flex flex-wrap gap-x-5 gap-y-0.5 text-xs text-ip-text-dim tnum">
                        <span>Repasse: {c.proximoRepasse}</span>
                        <span>Aporte: {formatMoney(c.valor_aportado)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>

        <div className="border-t border-ip-border p-4">
          <button onClick={onClose} className="ip-btn ip-btn-ghost w-full">
            Fechar
          </button>
        </div>
    </Modal>
  );
}
