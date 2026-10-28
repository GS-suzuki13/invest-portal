import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { X, TrendingUp, Calendar, DollarSign, BarChart3 } from 'lucide-react';
import { User, ClientReturn, ClientReturnApi } from '../types';
import { calculateNextRepasseBusinessDays } from '../utils/calculateNextRepasse';
import { apiFetch } from '../utils/api';
import Modal from './ui/Modal';

interface Repasse {
  id: number;
  label: string;
  start: string;
  end: string;
}

interface ClientDetailsModalProps {
  client: User;
  onClose: () => void;
  onUpdated: () => void;
}

const parseLocalDate = (dateStr?: string) => {
  if (!dateStr) return new Date(0);

  const raw = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
  const [year, month, day] = raw.split('-').map(Number);

  if (!year || !month || !day) {
    const fallback = new Date(dateStr);
    return Number.isNaN(fallback.getTime()) ? new Date(0) : fallback;
  }

  return new Date(year, month - 1, day);
};

export default function ClientDetailsModal({
  client,
  onClose
}: ClientDetailsModalProps) {
  const [returns, setReturns] = useState<ClientReturn[]>([]);
  const [repasses, setRepasses] = useState<Repasse[]>([]);
  const [selectedRepasseId, setSelectedRepasseId] = useState<number | null | 'all' | 'current'>('current');
  const [loadingReturns, setLoadingReturns] = useState(true);
  const [loadingRepasses, setLoadingRepasses] = useState(true);

  const apiUrl = import.meta.env.VITE_API_URL;

  const formatMoney = (value: number) =>
    value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—';

    const raw = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
    const [year, month, day] = raw.split('-');

    if (year && month && day) {
      return `${day}/${month}/${year}`;
    }

    const parsed = new Date(dateStr);

    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString('pt-BR');
    }

    return dateStr;
  };

  const loadClientReturns = useCallback(async () => {
    try {
      setLoadingReturns(true);

      const response = await apiFetch(`${apiUrl}/returns/${client.id}`);

      if (response.status === 404) {
        setReturns([]);
        return;
      }

      if (!response.ok) {
        throw new Error('Erro ao carregar rendimentos');
      }

      const data = await response.json();

      const parsed: ClientReturn[] = (Array.isArray(data) ? data : []).map((item: ClientReturnApi) => ({
        id: item.id,
        data: item.data,
        percentual: Number(item.percentual) || 0,
        variacao:
          item.variacao === null || item.variacao === undefined || item.variacao === ''
            ? NaN
            : Number(item.variacao),
        rendimento: Number(item.rendimento) || 0,
        userId: item.userId,
        repasseId: item.repasseId ?? null
      }));

      const ordered = [...parsed].sort(
        (a, b) => parseLocalDate(a.data).getTime() - parseLocalDate(b.data).getTime()
      );

      const normalized = ordered.map((item, index, arr) => {
        const previous = arr[index - 1];
        const apiVariacao = Number(item.variacao);

        const shouldRecalculate =
          !Number.isFinite(apiVariacao) ||
          (apiVariacao === 0 && index > 0 && item.percentual !== previous?.percentual);

        const calculatedVariacao = previous
          ? Number((item.percentual - previous.percentual).toFixed(2))
          : Number(item.percentual.toFixed(2));

        return {
          ...item,
          variacao: shouldRecalculate ? calculatedVariacao : Number(apiVariacao.toFixed(2))
        };
      });

      setReturns(normalized);
    } catch (err) {
      console.error(err);
      setReturns([]);
    } finally {
      setLoadingReturns(false);
    }
  }, [apiUrl, client]);

  const loadRepasses = useCallback(async () => {
    try {
      setLoadingRepasses(true);

      const response = await apiFetch(`${apiUrl}/repasse/${client.id}`);

      if (response.status === 404) {
        setRepasses([]);
        return;
      }

      if (!response.ok) {
        throw new Error('Erro ao carregar repasses');
      }

      const data = await response.json();
      const repassesArray = Array.isArray(data?.repasses)
        ? data.repasses
        : Array.isArray(data)
          ? data
          : [];

      setRepasses(repassesArray);
      setSelectedRepasseId('current');
    } catch (err) {
      console.error(err);
      setRepasses([]);
    } finally {
      setLoadingRepasses(false);
    }
  }, [apiUrl, client]);

  useEffect(() => {
    if (!client) return;

    void loadClientReturns();
    void loadRepasses();
  }, [client, loadClientReturns, loadRepasses]);

  const filteredReturns = useMemo(() => {
    return [...returns]
      .filter((r) => {
        if (selectedRepasseId === 'all') return true;
        if (selectedRepasseId === 'current' || selectedRepasseId === null) return !r.repasseId;
        return r.repasseId === selectedRepasseId;
      })
      .sort((a, b) => parseLocalDate(a.data).getTime() - parseLocalDate(b.data).getTime());
  }, [returns, selectedRepasseId]);

  const totalReturn = useMemo(() => {
    return filteredReturns.reduce((sum, r) => sum + (r.rendimento || 0), 0);
  }, [filteredReturns]);

  const mediaPercentual = useMemo(() => {
    if (!filteredReturns.length) return 0;

    return (
      filteredReturns.reduce((sum, r) => sum + (r.percentual || 0), 0) /
      filteredReturns.length
    );
  }, [filteredReturns]);

  const getValueColorClass = (value: number) => {
    if (value > 0) return 'text-ip-positive font-medium';
    if (value < 0) return 'text-ip-negative font-medium';
    return 'text-ip-text-dim';
  };

  const isLoading = loadingReturns || loadingRepasses;

  return (
    <Modal onEsc={onClose} className="max-w-6xl max-h-[92vh] overflow-hidden">
        <div className="flex items-start justify-between gap-4 border-b border-ip-border px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-ip-text">
              {client.name}
            </h2>
            <p className="text-sm text-ip-text-dim mt-1">
              {client.email}
            </p>
            <p className="text-xs text-ip-text-mute mt-1">
              Usuário: {client.user}
            </p>
          </div>

          <button aria-label="Fechar"
            onClick={onClose}
            className="rounded-lg p-2 text-ip-text-dim hover:bg-white/5 hover:text-ip-text"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="max-h-[calc(92vh-76px)] overflow-y-auto p-5 sm:p-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <InfoCard
              title="Valor Aportado"
              value={formatMoney(client.valor_aportado || 0)}
              icon={<DollarSign size={22} />}
              iconClassName="bg-ip-gold/12 text-ip-gold"
            />

            <InfoCard
              title="Rendimento Total"
              value={formatMoney(totalReturn)}
              icon={<TrendingUp size={22} />}
              iconClassName="bg-emerald-600/20 text-ip-positive"
            />

            <InfoCard
              title="Rendimento Líquido"
              value={formatMoney(totalReturn * 0.7)}
              icon={<BarChart3 size={22} />}
              iconClassName="bg-green-600/20 text-ip-positive"
            />

            <InfoCard
              title="Próximo Repasse"
              value={calculateNextRepasseBusinessDays(client.data_cadastro, repasses)}
              icon={<Calendar size={22} />}
              iconClassName="bg-yellow-600/20 text-ip-gold"
            />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2 bg-ip-surface-2 border border-ip-border-soft rounded-2xl p-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-ip-text">
                    Histórico de Rendimentos
                  </h3>
                  <p className="text-sm text-ip-text-dim">
                    Visualização por repasse
                  </p>
                </div>

                <select
                  value={
                    selectedRepasseId === 'current'
                      ? 'current'
                      : selectedRepasseId === 'all'
                        ? 'all'
                        : selectedRepasseId === null
                          ? 'current'
                          : String(selectedRepasseId)
                  }
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === 'all') setSelectedRepasseId('all');
                    else if (v === 'current') setSelectedRepasseId('current');
                    else setSelectedRepasseId(Number(v));
                  }}
                  className="bg-ip-surface border border-ip-border text-ip-text rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ip-gold/25 focus:border-ip-gold/60"
                >
                  <option value="all">Todos os rendimentos</option>
                  <option value="current">Rendimento atual</option>
                  {repasses.map((rep) => (
                    <option key={rep.id} value={String(rep.id)}>
                      {rep.label} ({formatDate(rep.start)} - {formatDate(rep.end)})
                    </option>
                  ))}
                </select>
              </div>

              {isLoading ? (
                <div className="h-64 flex items-center justify-center text-ip-text-mute text-sm">
                  Carregando histórico...
                </div>
              ) : (
                <div className="overflow-x-auto max-h-[420px] overflow-y-auto rounded-xl border border-ip-border-soft">
                  <table className="w-full text-sm text-left text-ip-text-dim">
                    <thead className="bg-ip-surface text-ip-text-dim uppercase text-xs sticky top-0">
                      <tr>
                        <th className="px-4 py-3">Data</th>
                        <th className="px-4 py-3">Percentual</th>
                        <th className="px-4 py-3">Variação</th>
                        <th className="px-4 py-3">Rendimento</th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredReturns.map((r, index) => (
                        <tr
                          key={`${r.id ?? r.data}-${index}`}
                          className="border-t border-ip-border-soft hover:bg-white/5"
                        >
                          <td className="px-4 py-3 text-ip-text-dim">
                            {formatDate(r.data)}
                          </td>

                          <td className="px-4 py-3">
                            <span className={getValueColorClass(r.percentual)}>
                              {r.percentual.toFixed(2)}%
                            </span>
                          </td>

                          <td className="px-4 py-3">
                            <span className={getValueColorClass(r.variacao)}>
                              {r.variacao.toFixed(2)}%
                            </span>
                          </td>

                          <td className="px-4 py-3">
                            <span className={getValueColorClass(r.rendimento)}>
                              {formatMoney(r.rendimento)}
                            </span>
                          </td>
                        </tr>
                      ))}

                      {filteredReturns.length === 0 && (
                        <tr>
                          <td colSpan={4} className="text-center py-8 text-ip-text-mute">
                            Nenhum rendimento encontrado para este filtro.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="bg-ip-surface-2 border border-ip-border-soft rounded-2xl p-5">
              <h3 className="text-lg font-semibold text-ip-text mb-4">
                Resumo do Cliente
              </h3>

              <div className="space-y-4">
                <div className="bg-ip-surface border border-ip-border-soft rounded-xl p-4">
                  <p className="text-sm text-ip-text-dim">Email</p>
                  <p className="text-ip-text font-medium mt-1 break-all">
                    {client.email}
                  </p>
                </div>

                <div className="bg-ip-surface border border-ip-border-soft rounded-xl p-4">
                  <p className="text-sm text-ip-text-dim">Cadastro</p>
                  <p className="text-ip-text font-medium mt-1">
                    {formatDate(client.data_cadastro)}
                  </p>
                </div>

                <div className="bg-ip-surface border border-ip-border-soft rounded-xl p-4">
                  <p className="text-sm text-ip-text-dim">Percentual de contrato</p>
                  <p className="text-ip-text font-medium mt-1">
                    {client.percentual_contrato ? `${client.percentual_contrato}%` : '—'}
                  </p>
                </div>

                <div className="bg-ip-surface border border-ip-border-soft rounded-xl p-4">
                  <p className="text-sm text-ip-text-dim">Média de percentual</p>
                  <p className="text-ip-text font-medium mt-1">
                    {mediaPercentual.toFixed(2)}%
                  </p>
                </div>

                <div className="bg-ip-surface border border-ip-border-soft rounded-xl p-4">
                  <p className="text-sm text-ip-text-dim">Quantidade de registros</p>
                  <p className="text-ip-text font-medium mt-1">
                    {filteredReturns.length}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="bg-ip-negative/15 hover:bg-ip-negative/25 text-ip-negative border border-ip-negative/25 px-5 py-2 rounded-lg"
            >
              Fechar
            </button>
          </div>
        </div>
    </Modal>
  );
}

interface InfoCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  iconClassName: string;
}

function InfoCard({ title, value, icon, iconClassName }: InfoCardProps) {
  return (
    <div className="bg-ip-surface border border-ip-border-soft rounded-2xl p-5 shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <span className="text-ip-text-dim text-sm">{title}</span>
        <div className={`p-2 rounded-lg ${iconClassName}`}>
          {icon}
        </div>
      </div>

      <h3 className="text-xl sm:text-2xl font-bold text-ip-text break-words">
        {value}
      </h3>
    </div>
  );
}