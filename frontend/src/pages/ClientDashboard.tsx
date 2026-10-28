import { useCallback, useEffect, useMemo, useState } from 'react';
import { TrendingUp, Wallet, CalendarClock, LineChart } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import type { User, ClientReturn, ClientReturnApi, RepasseApi } from '../types';
import { CSVHandler } from '../utils/csvHandler';
import { apiFetch, getSession } from '../utils/api';
import ClientLayout from '../components/layout/ClientLayout';
import PerformanceChart from '../components/PerformanceChart';
import ReturnsTable from '../components/ReturnsTable';
import ComparativoIndices from '../components/ComparativoIndices';
import StatCard from '../components/ui/StatCard';
import OnboardingTour from '../components/onboarding/OnboardingTour';
import { CLIENT_DASHBOARD_STEPS, ONBOARDING_VERSION } from '../components/onboarding/steps';
import { primeiroNome } from '../utils/nomes';
import { dataLocalISO } from '../utils/date';

const ONBOARDING_LS_KEY = 'ip:onboarding';

interface Repasse {
  id: number;
  label: string;
  start: string;
  end: string;
}

interface ClientDashboardProps {
  onLogout: () => void;
}

const formatMoney = (value: number) =>
  Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

export default function ClientDashboard({ onLogout }: ClientDashboardProps) {
  const [client, setClient] = useState<User | null>(null);
  const [repasses, setRepasses] = useState<Repasse[]>([]);
  const [returns, setReturns] = useState<ClientReturn[]>([]);
  const [selectedRepasseId, setSelectedRepasseId] = useState<number | 'all' | 'current'>('current');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tourAtivo, setTourAtivo] = useState(false);

  const apiUrl = import.meta.env.VITE_API_URL;

  const formatDateOnly = (dateStr?: string) => {
    if (!dateStr) return '—';
    const raw = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
    const [year, month, day] = raw.split('-');
    return year && month && day ? `${day}/${month}/${year}` : dateStr;
  };

  const parseLocalDate = (dateStr?: string) => {
    if (!dateStr) return new Date(0);
    const raw = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
    const [year, month, day] = raw.split('-').map(Number);
    if (!year || !month || !day) return new Date(0);
    return new Date(year, month - 1, day);
  };

  const fetchJson = async (url: string): Promise<unknown> => {
    try {
      const res = await apiFetch(url);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  };

  useEffect(() => {
    let cancelled = false;

    const loadDashboard = async () => {
      if (cancelled) return;
      setLoading(true);
      setError('');

      try {
        // lê a sessão na hora (localStorage), não via prop — evita render
        // preso ao valor que existia antes do login
        const storedUser = getSession();

        if (!storedUser?.id && !storedUser?.username) {
          setClient(null);
          setRepasses([]);
          setReturns([]);
          setError('Usuário inválido.');
          setLoading(false);
          return;
        }

        let foundClient: User | null = null;
        try {
          foundClient = await CSVHandler.getMe();
        } catch {
          foundClient = null;
        }
        if (cancelled) return;

        if (!foundClient || foundClient.token === 'adm') {
          setClient(null);
          setRepasses([]);
          setReturns([]);
          setError('Não foi possível localizar os dados do cliente.');
          setLoading(false);
          return;
        }

        const [repasseResponse, returnsResponse] = await Promise.all([
          fetchJson(`${apiUrl}/repasse/${foundClient.id}`),
          fetchJson(`${apiUrl}/returns/${foundClient.id}`),
        ]);

        if (cancelled) return;

        const repasseLista = (repasseResponse as { repasses?: unknown } | null)?.repasses;
        const repassesBrutos: (RepasseApi | null)[] = Array.isArray(repasseLista)
          ? repasseLista
          : Array.isArray(repasseResponse)
            ? repasseResponse
            : [];

        const repassesData: Repasse[] = repassesBrutos
          .filter((item): item is RepasseApi => Boolean(item) && item?.id != null)
          .map((item) => ({
            id: Number(item.id),
            label: String(item.label ?? `Repasse ${item.id}`),
            start: String(item.start ?? ''),
            end: String(item.end ?? ''),
          }));

        const returnsBrutos: (ClientReturnApi | null)[] = Array.isArray(returnsResponse)
          ? returnsResponse
          : [];

        const returnsData: ClientReturn[] = returnsBrutos
          .filter((item): item is ClientReturnApi => Boolean(item))
          .map((item) => ({
            id: item.id,
            data: String(item.data ?? ''),
            percentual: Number(item.percentual) || 0,
            variacao: Number(item.variacao) || 0,
            rendimento: Number(item.rendimento) || 0,
            repasseId: item.repasseId ?? null,
            userId: item.userId,
          }));

        setClient(foundClient);
        setRepasses(repassesData);
        setReturns(returnsData);
        setSelectedRepasseId('current');
        setLoading(false);
      } catch (err) {
        console.error('Erro ao carregar dashboard:', err);
        if (cancelled) return;
        setClient(null);
        setRepasses([]);
        setReturns([]);
        setError('Erro ao carregar o dashboard do cliente.');
        setLoading(false);
      }
    };

    void loadDashboard();
    return () => {
      cancelled = true;
    };
  }, [apiUrl]);

  const filteredReturns = useMemo(() => {
    return [...returns]
      .filter((item) => {
        if (selectedRepasseId === 'all') return true;
        if (selectedRepasseId === 'current') return !item.repasseId;
        return item.repasseId === selectedRepasseId;
      })
      .sort((a, b) => parseLocalDate(a.data).getTime() - parseLocalDate(b.data).getTime());
  }, [returns, selectedRepasseId]);

  const totalBruto = useMemo(
    () => filteredReturns.reduce((sum, item) => sum + item.rendimento, 0),
    [filteredReturns]
  );
  const totalLiquido = totalBruto * 0.7;
  const patrimonio = (client?.valor_aportado || 0) + totalLiquido;

  const nextRepasse = useMemo(() => {
    if (!client?.data_cadastro) return '—';
    const baseDate = repasses.length
      ? parseLocalDate(repasses[repasses.length - 1].end)
      : parseLocalDate(client.data_cadastro);
    const result = new Date(baseDate);
    if (Number.isNaN(result.getTime())) return '—';
    let days = 0;
    while (days < 30) {
      result.setDate(result.getDate() + 1);
      if (![0, 6].includes(result.getDay())) days++;
    }
    return result.toLocaleDateString('pt-BR');
  }, [client, repasses]);

  const chartData = filteredReturns.map((item) => ({
    month: formatDateOnly(item.data),
    value: item.rendimento,
  }));

  // Período e curva da carteira (líquida, acumulada) para o comparativo CDI/Poupança
  const iso = (d: string) => (d.includes('T') ? d.split('T')[0] : d);
  const hojeIso = dataLocalISO();

  const comparativo = useMemo(() => {
    const valorBase = client?.valor_aportado || 0;

    let inicio = '';
    let fim = '';
    let label = '';

    if (typeof selectedRepasseId === 'number') {
      const rep = repasses.find((r) => r.id === selectedRepasseId);
      if (rep) {
        inicio = iso(rep.start);
        fim = iso(rep.end) > hojeIso ? hojeIso : iso(rep.end);
        label = rep.label;
      }
    }

    if (!inicio && filteredReturns.length > 0) {
      inicio = iso(filteredReturns[0].data);
      fim = iso(filteredReturns[filteredReturns.length - 1].data);
      label = selectedRepasseId === 'all' ? 'Todo o período' : 'Rendimento atual';
    }

    // curva da carteira: parte do aporte e soma o rendimento líquido de cada dia
    let acc = valorBase;
    const carteiraSerie = filteredReturns.map((item) => {
      acc += item.rendimento * 0.7;
      return { data: iso(item.data), valor: acc };
    });

    return { valorBase, inicio, fim, label, carteiraSerie };
  }, [client, selectedRepasseId, repasses, filteredReturns, hojeIso]);

  // ---- Onboarding: mostra uma vez por cliente (por versão) ----
  const jaViuOnboarding = (c: User | null) => {
    if (!c) return true;
    if (c.onboarding_versao === ONBOARDING_VERSION) return true;
    try {
      return localStorage.getItem(ONBOARDING_LS_KEY) === ONBOARDING_VERSION;
    } catch {
      return false;
    }
  };

  useEffect(() => {
    if (loading || !client || jaViuOnboarding(client)) return;
    // deixa o layout (animações fade-up) assentar antes de medir os alvos
    const t = setTimeout(() => setTourAtivo(true), 450);
    return () => clearTimeout(t);
  }, [loading, client]);

  const finalizarOnboarding = useCallback(() => {
    setTourAtivo(false);
    try {
      localStorage.setItem(ONBOARDING_LS_KEY, ONBOARDING_VERSION);
    } catch {
      /* ignore */
    }
    setClient((c) => (c ? { ...c, onboarding_versao: ONBOARDING_VERSION } : c));
    CSVHandler.marcarOnboarding(ONBOARDING_VERSION);
  }, []);

  if (loading) {
    return (
      <ClientLayout onLogout={onLogout}>
        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <div className="skeleton h-36 w-full" />
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="skeleton h-28" />
            <div className="skeleton h-28" />
            <div className="skeleton h-28" />
          </div>
          <div className="skeleton mt-6 h-80 w-full" />
        </main>
      </ClientLayout>
    );
  }

  if (error || !client) {
    return (
      <ClientLayout onLogout={onLogout}>
        <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
          <div className="ip-card border-ip-negative/25 bg-ip-negative/10 p-6 text-ip-negative">
            {error || 'Não foi possível carregar o cliente.'}
          </div>
        </main>
      </ClientLayout>
    );
  }

  const firstName = primeiroNome(client.name);

  return (
    <ClientLayout onLogout={onLogout}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-ip-radial" />

      <main className="relative mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {/* Hero — patrimônio */}
        <section className="animate-fade-up" data-tour="patrimonio">
          <p className="ip-eyebrow">Olá, {firstName}</p>
          <div className="mt-3 ip-card overflow-hidden">
            <div className="relative p-6 sm:p-7">
              <div className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-ip-gold/8 blur-3xl" />
              <div className="relative flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-sm text-ip-text-dim">Patrimônio estimado</p>
                  {/* número nunca é cortado nem quebrado: a partir de 17 caracteres (R$ 100 mi) a fonte encolhe */}
                  <p
                    className={`ip-display mt-1 font-bold text-ip-text tnum ${
                      formatMoney(patrimonio).length >= 17 ? 'ip-display-longo' : ''
                    }`}
                  >
                    {formatMoney(patrimonio)}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
                  <span className="text-ip-text-mute">Aportado</span>
                  <span className="text-right font-semibold text-ip-text tnum">
                    {formatMoney(client.valor_aportado || 0)}
                  </span>
                  <span className="text-ip-text-mute">Rend. líquido</span>
                  <span className="text-right font-semibold text-ip-positive tnum">
                    + {formatMoney(totalLiquido)}
                  </span>
                </div>
              </div>
            </div>
            <div className="border-t border-ip-border bg-ip-bg-soft px-6 py-3 text-xs text-ip-text-mute">
              Contrato de {client.percentual_contrato ?? 0}% · Repasse a cada 30 dias úteis
            </div>
          </div>
        </section>

        {/* Stat tiles */}
        <section
          className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3"
          data-tour="rendimentos"
        >
          <div className="animate-fade-up delay-1">
            <StatCard
              label="Rendimento bruto"
              value={formatMoney(totalBruto)}
              icon={<TrendingUp className="h-4 w-4" />}
              tone="gold"
              hint="No período selecionado"
            />
          </div>
          <div className="animate-fade-up delay-2">
            <StatCard
              label="Rendimento líquido"
              value={formatMoney(totalLiquido)}
              icon={<Wallet className="h-4 w-4" />}
              tone="positive"
              hint="Após 30% de gestão"
            />
          </div>
          <div className="animate-fade-up delay-3" data-tour="proximo-repasse">
            <StatCard
              label="Próximo repasse"
              value={nextRepasse}
              icon={<CalendarClock className="h-4 w-4" />}
              tone="navy"
            />
          </div>
        </section>

        {/* Filtro de repasses */}
        {repasses.length > 0 && (
          <section className="mt-6 animate-fade-up delay-4" data-tour="periodo">
            <div className="ip-card flex flex-wrap items-center gap-3 p-4">
              <span className="text-sm font-medium text-ip-text-dim">Período</span>
              <select
                value={
                  selectedRepasseId === 'all'
                    ? 'all'
                    : selectedRepasseId === 'current'
                      ? 'current'
                      : String(selectedRepasseId)
                }
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === 'all') setSelectedRepasseId('all');
                  else if (value === 'current') setSelectedRepasseId('current');
                  else setSelectedRepasseId(Number(value));
                }}
                className="ip-input w-full max-w-xs py-2.5"
              >
                <option value="all">Todos os rendimentos</option>
                <option value="current">Rendimento atual</option>
                {repasses.map((rep) => (
                  <option key={rep.id} value={String(rep.id)}>
                    {rep.label} ({formatDateOnly(rep.start)} – {formatDateOnly(rep.end)})
                  </option>
                ))}
              </select>
            </div>
          </section>
        )}

        {/* Chart + tabela */}
        <section
          className="mt-6 grid grid-cols-1 gap-6 animate-fade-up delay-4 xl:grid-cols-5"
          data-tour="grafico"
        >
          <div className="ip-card p-5 xl:col-span-3">
            <div className="mb-4 flex items-center gap-2">
              <LineChart className="h-4 w-4 text-ip-gold" />
              <h3 className="text-sm font-semibold text-ip-text">
                Evolução dos rendimentos
              </h3>
            </div>
            {chartData.length > 0 ? (
              <PerformanceChart data={chartData} />
            ) : (
              <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-ip-border text-sm text-ip-text-mute">
                Sem dados para exibir no gráfico
              </div>
            )}
          </div>

          <div className="ip-card p-5 xl:col-span-2">
            <h3 className="mb-4 text-sm font-semibold text-ip-text">Histórico</h3>
            <ReturnsTable
              data={filteredReturns}
              columns={[
                {
                  key: 'data',
                  label: 'Data',
                  render: (value) => (
                    <span className="text-ip-text-dim">
                      {formatDateOnly(String(value))}
                    </span>
                  ),
                },
                {
                  key: 'rendimento',
                  label: 'Rendimento',
                  align: 'right',
                  render: (value) => (
                    <span className="font-semibold text-ip-positive">
                      {formatMoney(Number(value))}
                    </span>
                  ),
                },
              ]}
            />
          </div>
        </section>

        {/* Comparativo com CDI e Poupança */}
        {comparativo.inicio && comparativo.carteiraSerie.length > 0 && (
          <section className="mt-6 animate-fade-up delay-5" data-tour="comparativo">
            <ComparativoIndices
              valorBase={comparativo.valorBase}
              carteiraSerie={comparativo.carteiraSerie}
              inicio={comparativo.inicio}
              fim={comparativo.fim}
              periodoLabel={comparativo.label}
            />
          </section>
        )}

        {/* Bruto vs líquido */}
        <section className="mt-6 animate-fade-up delay-5">
          <div className="ip-card p-5 sm:p-6">
            <h3 className="mb-4 text-sm font-semibold text-ip-text">
              Composição do rendimento
            </h3>
            <div className="space-y-3">
              <Row label="Rendimento bruto" value={formatMoney(totalBruto)} strong />
              <Row
                label="Taxa de gestão (30%)"
                value={`− ${formatMoney(totalBruto * 0.3)}`}
                tone="negative"
              />
              <div className="h-px bg-ip-border" />
              <Row
                label="Rendimento líquido (70%)"
                value={formatMoney(totalLiquido)}
                tone="positive"
                strong
              />
            </div>
            <div className="mt-5 flex h-2 overflow-hidden rounded-full bg-ip-surface-2">
              <div className="h-full bg-ip-positive" style={{ width: '70%' }} />
              <div className="h-full bg-ip-negative/70" style={{ width: '30%' }} />
            </div>
          </div>
        </section>
      </main>

      <AnimatePresence>
      {tourAtivo && (
        <OnboardingTour
          steps={CLIENT_DASHBOARD_STEPS}
          nome={firstName}
          onDone={finalizarOnboarding}
        />
      )}
      </AnimatePresence>
    </ClientLayout>
  );
}

function Row({
  label,
  value,
  tone,
  strong,
}: {
  label: string;
  value: string;
  tone?: 'positive' | 'negative';
  strong?: boolean;
}) {
  const color =
    tone === 'positive'
      ? 'text-ip-positive'
      : tone === 'negative'
        ? 'text-ip-negative'
        : 'text-ip-text';
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-ip-text-dim">{label}</span>
      <span className={`tnum ${color} ${strong ? 'font-bold' : 'font-medium'}`}>
        {value}
      </span>
    </div>
  );
}
