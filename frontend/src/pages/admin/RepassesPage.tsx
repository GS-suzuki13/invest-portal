import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CalendarCheck, HandCoins } from 'lucide-react';
import { CSVHandler } from '../../utils/csvHandler';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import type { AgendaRepasseItem, AgendaRepasses } from '../../types';

const formatMoney = (value: number) =>
  Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const br = (iso: string) => iso.split('-').reverse().join('/');

const GRUPOS: { situacao: AgendaRepasseItem['situacao']; titulo: string; dica: string; cor: string }[] = [
  { situacao: 'hoje', titulo: 'Fecham hoje', dica: '', cor: 'text-ip-gold' },
  { situacao: 'atrasado', titulo: 'Atrasados', dica: 'Já venceram e ainda não foram fechados', cor: 'text-ip-negative' },
  { situacao: 'amanha', titulo: 'Próximo dia útil', dica: 'Só para consulta — fecham no dia', cor: 'text-ip-sky' },
];

export default function RepassesPage() {
  const [agenda, setAgenda] = useState<AgendaRepasses | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [fechandoId, setFechandoId] = useState<string | null>(null);
  const { dialogState, confirm, handleClose } = useConfirmDialog();

  const carregar = useCallback(async () => {
    try {
      setErro('');
      setAgenda(await CSVHandler.getAgendaRepasses());
    } catch {
      setErro('Não foi possível carregar a agenda de repasses.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const fechar = async (item: AgendaRepasseItem) => {
    const ok = await confirm({
      title: `Fechar ${item.numero}º repasse`,
      message:
        `${item.nome}\nPeríodo: ${br(item.dataInicio)} a ${br(item.dataFim)} · ${item.lancamentos} lançamento(s)\n` +
        `Bruto ${formatMoney(item.bruto)} · Taxa ${formatMoney(item.taxa)} · Líquido ${formatMoney(item.liquido)}` +
        (item.lancamentos === 0 ? '\n\nAtenção: nenhum rendimento foi lançado neste período.' : ''),
      confirmLabel: 'Fechar repasse',
    });
    if (!ok) return;

    setFechandoId(item.userId);
    try {
      const repasse = await CSVHandler.fecharRepasse(item.userId, item.numero);

      const reinvestir = await confirm({
        title: 'Reinvestir rendimento',
        message: `Somar o líquido de ${formatMoney(item.liquido)} ao valor aportado de ${item.nome}? O investidor será avisado automaticamente pelo chat do site.`,
        confirmLabel: 'Reinvestir',
        cancelLabel: 'Não reinvestir',
      });
      if (reinvestir) await CSVHandler.reinvestirRepasse(item.userId, repasse.id);

      await carregar();
      await confirm({
        title: 'Repasse fechado',
        message:
          `${item.numero}º repasse de ${item.nome} fechado` +
          (reinvestir ? ' e líquido reinvestido.' : '.') +
          ' A Declaração de Distribuição de Resultados é gerada automaticamente.',
        alertOnly: true,
      });
    } catch (error) {
      await carregar();
      await confirm({
        title: 'Não foi possível concluir',
        message: error instanceof Error ? error.message : 'Erro ao fechar o repasse. Tente novamente.',
        tone: 'danger',
        alertOnly: true,
      });
    } finally {
      setFechandoId(null);
    }
  };

  const itens = agenda?.itens ?? [];
  const contagem = (s: AgendaRepasseItem['situacao']) => itens.filter((i) => i.situacao === s).length;

  return (
    <div className="space-y-8">
      <ConfirmDialog {...dialogState} onClose={handleClose} />

      <div>
        <p className="ip-eyebrow">Financeiro</p>
        <h2 className="mt-1 text-2xl font-bold text-ip-text">Repasses</h2>
        <p className="text-sm text-ip-text-dim">
          Feche os repasses do dia direto daqui, sem abrir cliente por cliente
        </p>
      </div>

      {agenda && (
        <div className="flex flex-wrap gap-2 text-xs">
          {GRUPOS.map((g) => (
            <span key={g.situacao} className="ip-chip">
              <span className={g.cor}>{g.titulo}</span>
              <b className="tnum text-ip-text">{contagem(g.situacao)}</b>
            </span>
          ))}
          <span className="ip-chip text-ip-text-mute">Hoje: {br(agenda.hoje)}</span>
        </div>
      )}

      {erro && <p className="text-sm text-ip-negative">{erro}</p>}

      {loading ? (
        <div className="space-y-3">
          <div className="skeleton h-24 w-full" />
          <div className="skeleton h-24 w-full" />
        </div>
      ) : itens.length === 0 && !erro ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-ip-border px-6 py-12 text-center">
          <CalendarCheck className="h-8 w-8 text-ip-positive" />
          <p className="font-medium text-ip-text">Nenhum repasse para fechar</p>
          <p className="text-sm text-ip-text-mute">
            Ninguém vence hoje, nem amanhã, e não há repasses atrasados.
          </p>
        </div>
      ) : (
        GRUPOS.map((g) => {
          const doGrupo = itens.filter((i) => i.situacao === g.situacao);
          if (doGrupo.length === 0) return null;
          return (
            <section key={g.situacao} className="space-y-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className={`text-xs font-semibold uppercase tracking-wider ${g.cor}`}>
                  {g.titulo} · {doGrupo.length}
                </h3>
                {g.dica && <span className="text-xs text-ip-text-mute">{g.dica}</span>}
              </div>

              <ul className="space-y-2.5">
                {doGrupo.map((item) => {
                  const podeFechar = item.situacao !== 'amanha';
                  return (
                    <li
                      key={item.userId}
                      className="grid gap-4 rounded-2xl border border-ip-border-soft bg-ip-surface p-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1.6fr)_auto] md:items-center"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-ip-text">{item.nome}</p>
                        <p className="mt-0.5 text-xs text-ip-text-mute tnum">
                          {item.numero}º repasse · {br(item.dataInicio)} a {br(item.dataFim)} ·{' '}
                          {item.lancamentos} lançamento(s)
                        </p>
                        {item.lancamentos === 0 && (
                          <p className="mt-1.5 inline-flex items-center gap-1 text-xs text-ip-gold">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            Nenhum rendimento lançado no período
                          </p>
                        )}
                      </div>

                      <dl className="grid grid-cols-3 gap-3 text-xs">
                        <div>
                          <dt className="text-ip-text-mute">Bruto</dt>
                          <dd className="tnum mt-0.5 text-sm text-ip-text">{formatMoney(item.bruto)}</dd>
                        </div>
                        <div>
                          <dt className="text-ip-text-mute">Taxa 30%</dt>
                          <dd className="tnum mt-0.5 text-sm text-ip-text-dim">{formatMoney(item.taxa)}</dd>
                        </div>
                        <div>
                          <dt className="text-ip-text-mute">Líquido 70%</dt>
                          <dd className="tnum mt-0.5 text-sm font-semibold text-ip-positive">
                            {formatMoney(item.liquido)}
                          </dd>
                        </div>
                      </dl>

                      {podeFechar ? (
                        <button
                          onClick={() => fechar(item)}
                          disabled={fechandoId !== null}
                          className="ip-btn ip-btn-primary justify-center whitespace-nowrap px-4 py-2 text-sm disabled:opacity-50"
                        >
                          <HandCoins className="h-4 w-4" />
                          {fechandoId === item.userId ? 'Fechando...' : 'Fechar repasse'}
                        </button>
                      ) : (
                        <span className="ip-chip justify-center whitespace-nowrap text-ip-text-mute">
                          Fecha em {br(item.dataFim)}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
}
