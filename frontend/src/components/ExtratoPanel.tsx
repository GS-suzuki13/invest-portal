import { useEffect, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, TrendingUp } from 'lucide-react';
import { CSVHandler } from '../utils/csvHandler';
import type { Extrato } from '../types';

const formatMoney = (value: number) =>
  Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const formatDate = (date: string) => {
  const parsed = new Date(`${date}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? date : parsed.toLocaleDateString('pt-BR');
};

/** Extrato do investidor (aportes, saques e rendimentos), dentro do painel lateral do portal. */
export default function ExtratoPanel({ userId }: { userId: string }) {
  const [extrato, setExtrato] = useState<Extrato | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    CSVHandler.getExtrato(userId)
      .then(setExtrato)
      .catch(() => setError('Não foi possível carregar seu extrato.'))
      .finally(() => setLoading(false));
  }, [userId]);

  return (
    <div className="flex-1 overflow-y-auto p-4">
      {error && <p className="text-sm text-ip-negative">{error}</p>}

      {loading ? (
        <div className="space-y-2.5">
          <div className="skeleton h-20 w-full" />
          <div className="skeleton h-14 w-full" />
          <div className="skeleton h-14 w-full" />
        </div>
      ) : (
        extrato && (
          <>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-xl border border-ip-border-soft bg-ip-surface-2 px-3 py-3">
                <p className="text-xs text-ip-text-mute">Total aportado</p>
                <p className="tnum mt-1 text-base font-semibold text-ip-text">
                  {formatMoney(extrato.totais.aportado)}
                </p>
              </div>
              <div className="rounded-xl border border-ip-border-soft bg-ip-surface-2 px-3 py-3">
                <p className="text-xs text-ip-text-mute">Rendimentos recebidos</p>
                <p className="tnum mt-1 text-base font-semibold text-ip-positive">
                  {formatMoney(extrato.totais.rendimentos)}
                </p>
              </div>
            </div>
            {extrato.totais.sacado > 0 && (
              <div className="mt-2.5 rounded-xl border border-ip-border-soft bg-ip-surface-2 px-3 py-3">
                <p className="text-xs text-ip-text-mute">Total sacado</p>
                <p className="tnum mt-1 text-base font-semibold text-ip-negative">
                  {formatMoney(extrato.totais.sacado)}
                </p>
              </div>
            )}
            <p className="mt-2 text-xs text-ip-text-mute">
              Rendimentos líquidos por repasse fechado. O ciclo em andamento entra aqui quando o
              repasse for fechado.
            </p>

            {extrato.lancamentos.length === 0 ? (
              <div className="mt-4 flex h-20 items-center justify-center rounded-xl border border-dashed border-ip-border text-sm text-ip-text-mute">
                Nenhuma movimentação ainda.
              </div>
            ) : (
              <ul className="mt-4 space-y-2">
                {extrato.lancamentos.map((l) => {
                  const aporte = l.tipo === 'aporte';
                  const saque = l.tipo === 'saque';
                  const Icon = aporte ? ArrowDownLeft : saque ? ArrowUpRight : TrendingUp;
                  return (
                    <li
                      key={l.id}
                      className="flex items-center gap-3 rounded-xl border border-ip-border-soft bg-ip-surface px-3 py-2.5"
                    >
                      <span
                        className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${
                          aporte
                            ? 'bg-ip-sky/15 text-ip-sky'
                            : saque
                              ? 'bg-ip-negative/15 text-ip-negative'
                              : 'bg-ip-positive/15 text-ip-positive'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-ip-text">
                          {aporte ? 'Aporte' : saque ? 'Saque' : 'Rendimento'}
                        </p>
                        <p className="text-xs leading-snug text-ip-text-mute">
                          {formatDate(l.data)} · {l.descricao}
                        </p>
                      </div>
                      <span
                        className={`tnum whitespace-nowrap text-sm font-semibold ${
                          aporte ? 'text-ip-text' : saque ? 'text-ip-negative' : 'text-ip-positive'
                        }`}
                      >
                        {saque ? '− ' : ''}
                        {formatMoney(l.valor)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )
      )}
    </div>
  );
}
