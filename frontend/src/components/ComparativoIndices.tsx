import { useEffect, useMemo, useState } from 'react';
import { Scale, TrendingUp } from 'lucide-react';
import { CSVHandler } from '../utils/csvHandler';
import type { ComparativoIndices as Comparativo } from '../types';

interface Ponto {
  data: string;
  valor: number;
}

interface Props {
  /** Valor aportado — base de todas as simulações. */
  valorBase: number;
  /** Evolução real do patrimônio na carteira (líquido), por data, em R$. */
  carteiraSerie: Ponto[];
  /** Período YYYY-MM-DD. */
  inicio: string;
  fim: string;
  /** Rótulo amigável do período (ex.: "3º Repasse"). */
  periodoLabel?: string;
}

const W = 760;
const H = 280;
const PAD = { left: 10, right: 20, top: 14, bottom: 26 };

const brl = (v: number) =>
  v.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const pct = (v: number) =>
  `${v >= 0 ? '+' : ''}${v.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;

const diaMes = (iso: string) => {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
};

// alinha uma série (ordenada por data) a um eixo de datas-alvo.
// forward-fill (degrau) para índices como CDI/poupança; linear para a carteira,
// que tem poucos pontos e fica mais legível com uma trajetória contínua.
function alinhar(
  serie: Ponto[],
  datas: string[],
  base: number,
  modo: 'degrau' | 'linear' = 'degrau'
): number[] {
  if (serie.length === 0) return datas.map(() => base);

  const t = (iso: string) => new Date(`${iso}T00:00:00Z`).getTime();

  return datas.map((d) => {
    // último ponto <= d
    let ant: Ponto | null = null;
    let prox: Ponto | null = null;
    for (const p of serie) {
      if (p.data <= d) ant = p;
      else {
        prox = p;
        break;
      }
    }
    if (!ant) return base;
    if (modo === 'degrau' || !prox) return ant.valor;

    const span = t(prox.data) - t(ant.data) || 1;
    const k = (t(d) - t(ant.data)) / span;
    return ant.valor + (prox.valor - ant.valor) * k;
  });
}

const LINHAS = [
  { key: 'carteira', label: 'Carteira', cor: '#F0C040', largura: 2.75 },
  { key: 'cdi', label: 'CDI', cor: '#4d9de0', largura: 2 },
  { key: 'poupanca', label: 'Poupança', cor: '#93a1b5', largura: 2, tracejado: true },
] as const;

export default function ComparativoIndices({
  valorBase,
  carteiraSerie,
  inicio,
  fim,
  periodoLabel,
}: Props) {
  const [dados, setDados] = useState<Comparativo | null>(null);
  const [estado, setEstado] = useState<'carregando' | 'ok' | 'indisponivel'>(
    'carregando'
  );
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    let vivo = true;
    setEstado('carregando');
    setDados(null);

    if (!inicio || !fim || inicio >= fim || valorBase <= 0) {
      setEstado('indisponivel');
      return;
    }

    CSVHandler.getComparativoIndices(inicio, fim).then((res) => {
      if (!vivo) return;
      if (!res || !res.cdi?.serie?.length) {
        setEstado('indisponivel');
        return;
      }
      setDados(res);
      setEstado('ok');
    });

    return () => {
      vivo = false;
    };
  }, [inicio, fim, valorBase]);

  const chart = useMemo(() => {
    if (!dados) return null;

    const cdiPontos: Ponto[] = dados.cdi.serie.map((p) => ({
      data: p.data,
      valor: valorBase * p.fator,
    }));
    const poupPontos: Ponto[] = dados.poupanca.serie.map((p) => ({
      data: p.data,
      valor: valorBase * p.fator,
    }));

    // eixo X = união das datas de todas as séries, dentro do período
    const set = new Set<string>([inicio, fim]);
    for (const s of [carteiraSerie, cdiPontos, poupPontos])
      for (const p of s) if (p.data >= inicio && p.data <= fim) set.add(p.data);
    const datas = [...set].sort();
    if (datas.length < 2) return null;

    const carteira = alinhar(
      [{ data: inicio, valor: valorBase }, ...carteiraSerie].sort((a, b) =>
        a.data < b.data ? -1 : 1
      ),
      datas,
      valorBase,
      'linear'
    );
    const cdi = alinhar(
      [{ data: inicio, valor: valorBase }, ...cdiPontos],
      datas,
      valorBase
    );
    const poup = alinhar(
      [{ data: inicio, valor: valorBase }, ...poupPontos],
      datas,
      valorBase
    );

    const todos = [...carteira, ...cdi, ...poup];
    const min = Math.min(...todos);
    const max = Math.max(...todos);
    const range = max - min || 1;

    const plotW = W - PAD.left - PAD.right;
    const plotH = H - PAD.top - PAD.bottom;
    const x = (i: number) => PAD.left + (i / (datas.length - 1)) * plotW;
    const y = (v: number) => PAD.top + plotH - ((v - min) / range) * plotH;

    const poly = (arr: number[]) =>
      arr.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');

    const maxLabels = 6;
    const step = Math.max(1, Math.ceil(datas.length / maxLabels));
    const xLabels = datas
      .map((_, i) => i)
      .filter((i) => i % step === 0 || i === datas.length - 1);

    return {
      datas,
      series: { carteira, cdi, poupanca: poup },
      x,
      y,
      poly,
      plotH,
      xLabels,
    };
  }, [dados, carteiraSerie, inicio, fim, valorBase]);

  const wrapper = 'ip-card p-5 sm:p-6';

  const posFromClientX = (clientX: number, el: SVGSVGElement) => {
    const rect = el.getBoundingClientRect();
    const px = ((clientX - rect.left) / rect.width) * W;
    const t = Math.min(
      1,
      Math.max(0, (px - PAD.left) / (W - PAD.left - PAD.right))
    );
    return Math.round(t * ((chart?.datas.length ?? 1) - 1));
  };

  if (estado === 'carregando') {
    return (
      <div className={wrapper}>
        <div className="skeleton h-5 w-56" />
        <div className="skeleton mt-4 h-64 w-full" />
      </div>
    );
  }

  if (estado === 'indisponivel' || !dados || !chart) {
    return (
      <div className={wrapper}>
        <div className="mb-1 flex items-center gap-2">
          <Scale className="h-4 w-4 text-ip-gold" />
          <h3 className="text-sm font-semibold text-ip-text">
            Comparação com CDI e Poupança
          </h3>
        </div>
        <p className="text-sm text-ip-text-mute">
          Indicadores indisponíveis para este período no momento.
        </p>
      </div>
    );
  }

  const finais = {
    carteira: chart.series.carteira[chart.series.carteira.length - 1],
    cdi: valorBase * dados.cdi.fator,
    poupanca: valorBase * dados.poupanca.fator,
  };
  const rendCarteira = finais.carteira - valorBase;
  const vantagemCdi = finais.carteira - finais.cdi;
  const vantagemPoup = finais.carteira - finais.poupanca;

  const resumo = [
    {
      ...LINHAS[0],
      final: finais.carteira,
      ganho: rendCarteira,
      perc: valorBase ? (rendCarteira / valorBase) * 100 : 0,
    },
    {
      ...LINHAS[1],
      final: finais.cdi,
      ganho: finais.cdi - valorBase,
      perc: dados.cdi.percentual,
    },
    {
      ...LINHAS[2],
      final: finais.poupanca,
      ganho: finais.poupanca - valorBase,
      perc: dados.poupanca.percentual,
    },
  ];

  const hoverData =
    hover != null && chart.datas[hover]
      ? {
          data: chart.datas[hover],
          carteira: chart.series.carteira[hover],
          cdi: chart.series.cdi[hover],
          poupanca: chart.series.poupanca[hover],
        }
      : null;

  return (
    <div className={wrapper}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Scale className="h-4 w-4 text-ip-gold" />
          <h3 className="text-sm font-semibold text-ip-text">
            E se o dinheiro estivesse no CDI ou na Poupança?
          </h3>
        </div>
        <span className="ip-chip ip-selo">
          {periodoLabel ? `${periodoLabel} · ` : ''}
          {diaMes(inicio)} a {diaMes(fim)}
        </span>
      </div>

      <p className="mt-1.5 text-xs text-ip-text-dim">
        Aporte de{' '}
        <span className="tnum font-medium text-ip-text">{brl(valorBase)}</span>{' '}
        no mesmo período, em cada modalidade:
      </p>

      {/* resumo em cards */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {resumo.map((r) => (
          <div
            key={r.key}
            className="rounded-xl border border-ip-border bg-ip-surface-2 p-3"
          >
            <div className="flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: r.cor }}
              />
              <span className="text-xs font-medium text-ip-text-dim">
                {r.label}
              </span>
            </div>
            <p className="mt-1.5 text-lg font-bold text-ip-text tnum">
              {brl(r.final)}
            </p>
            <p
              className={`text-xs tnum ${
                r.ganho >= 0 ? 'text-ip-positive' : 'text-ip-negative'
              }`}
            >
              {r.ganho >= 0 ? '+' : ''}
              {brl(r.ganho)} ({pct(r.perc)})
            </p>
          </div>
        ))}
      </div>

      {/* destaque da vantagem */}
      {vantagemCdi > 0 && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-ip-positive/25 bg-ip-positive/10 p-3 text-sm text-ip-positive">
          <TrendingUp className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Na carteira seu dinheiro rendeu{' '}
            <span className="tnum font-semibold">{brl(vantagemCdi)}</span> a mais
            que no CDI
            {vantagemPoup > 0 && (
              <>
                {' '}
                e <span className="tnum font-semibold">{brl(vantagemPoup)}</span>{' '}
                a mais que na Poupança
              </>
            )}
            .
          </span>
        </div>
      )}

      {/* gráfico */}
      <div className="relative mt-4">
        <div className="ip-card-i relative overflow-hidden p-3">
          <svg
            width="100%"
            viewBox={`0 0 ${W} ${H}`}
            className="block touch-none select-none"
            onMouseLeave={() => setHover(null)}
            onMouseMove={(e) =>
              setHover(posFromClientX(e.clientX, e.currentTarget))
            }
            onTouchStart={(e) =>
              setHover(posFromClientX(e.touches[0].clientX, e.currentTarget))
            }
            onTouchMove={(e) =>
              setHover(posFromClientX(e.touches[0].clientX, e.currentTarget))
            }
            onTouchEnd={() => setHover(null)}
          >
            {/* linhas de grade horizontais */}
            {[0, 0.25, 0.5, 0.75, 1].map((f) => {
              const yy = PAD.top + chart.plotH * f;
              return (
                <line
                  key={f}
                  x1={PAD.left}
                  y1={yy}
                  x2={W - PAD.right}
                  y2={yy}
                  stroke="rgba(255,255,255,0.05)"
                  strokeWidth="1"
                />
              );
            })}

            {LINHAS.map((l) => (
              <polyline
                key={l.key}
                fill="none"
                stroke={l.cor}
                strokeWidth={l.largura}
                strokeLinejoin="round"
                strokeLinecap="round"
                strokeDasharray={'tracejado' in l && l.tracejado ? '5 4' : undefined}
                points={chart.poly(
                  chart.series[l.key as keyof typeof chart.series]
                )}
              />
            ))}

            {/* eixo X */}
            {chart.xLabels.map((i) => (
              <text
                key={i}
                x={chart.x(i)}
                y={H - 8}
                textAnchor="middle"
                className="fill-ip-text-mute ip-selo tnum"
              >
                {diaMes(chart.datas[i])}
              </text>
            ))}

            {/* guia do hover */}
            {hover != null && (
              <>
                <line
                  x1={chart.x(hover)}
                  y1={PAD.top}
                  x2={chart.x(hover)}
                  y2={PAD.top + chart.plotH}
                  stroke="rgba(240,192,64,0.35)"
                  strokeWidth="1"
                />
                {LINHAS.map((l) => (
                  <circle
                    key={l.key}
                    cx={chart.x(hover)}
                    cy={chart.y(
                      chart.series[l.key as keyof typeof chart.series][hover]
                    )}
                    r="3.5"
                    fill={l.cor}
                    stroke="#0d141f"
                    strokeWidth="2.5"
                  />
                ))}
              </>
            )}
          </svg>

          {hoverData && (
            <div
              className="pointer-events-none absolute z-20 w-40 rounded-xl border border-ip-border bg-ip-surface px-3 py-2 text-xs shadow-card"
              style={{
                left: `${Math.min(
                  82,
                  Math.max(18, (chart.x(hover as number) / W) * 100)
                )}%`,
                top: 8,
                transform: 'translateX(-50%)',
              }}
            >
              <p className="mb-1 text-ip-text-mute">{diaMes(hoverData.data)}</p>
              {(['carteira', 'cdi', 'poupanca'] as const).map((k, idx) => (
                <p key={k} className="flex items-center gap-1.5 tnum">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: LINHAS[idx].cor }}
                  />
                  <span className="text-ip-text-dim">{LINHAS[idx].label}</span>
                  <span className="ml-auto font-medium text-ip-text">
                    {brl(hoverData[k])}
                  </span>
                </p>
              ))}
            </div>
          )}
        </div>

        {/* legenda */}
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
          {LINHAS.map((l) => (
            <span key={l.key} className="flex items-center gap-1.5 text-xs">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: l.cor }}
              />
              <span className="text-ip-text-dim">{l.label}</span>
            </span>
          ))}
        </div>
      </div>

      <p className="mt-3 ip-selo leading-relaxed text-ip-text-mute">
        Simulação: CDI a 100% e rendimento da poupança no mesmo período, sobre o
        valor aportado. Não considera imposto de renda nem taxas. Carteira = seu
        rendimento líquido (após 30% de gestão). Fonte: {dados.fonte}.
      </p>
    </div>
  );
}
