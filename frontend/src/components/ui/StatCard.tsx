import React from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';

type Tone = 'gold' | 'navy' | 'positive' | 'negative' | 'neutral';

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  hint?: string;
  /** variação exibida como pílula (ex.: +2,4%) */
  delta?: { value: string; positive: boolean } | null;
  tone?: Tone;
  className?: string;
}

const toneRing: Record<Tone, string> = {
  gold: 'bg-ip-gold/12 text-ip-gold',
  navy: 'bg-ip-sky/12 text-ip-sky',
  positive: 'bg-ip-positive/12 text-ip-positive',
  negative: 'bg-ip-negative/12 text-ip-negative',
  neutral: 'bg-white/5 text-ip-text-dim',
};

export default function StatCard({
  label,
  value,
  icon,
  hint,
  delta,
  tone = 'neutral',
  className = '',
}: StatCardProps) {
  return (
    <div
      className={`ip-card ip-card-hover group relative overflow-hidden p-5 ${className}`}
    >
      {/* brilho sutil no topo */}
      <div className="pointer-events-none absolute -right-16 -top-20 h-40 w-40 rounded-full bg-ip-navy-400/10 blur-2xl transition-opacity duration-300 group-hover:opacity-80" />

      <div className="relative flex items-start justify-between">
        <p className="text-[0.8125rem] font-medium text-ip-text-dim">{label}</p>
        {icon && (
          <span
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${toneRing[tone]}`}
          >
            {icon}
          </span>
        )}
      </div>

      <p className="relative mt-3 text-2xl font-bold text-ip-text tnum break-words">
        {value}
      </p>

      {(delta || hint) && (
        <div className="relative mt-2 flex items-center gap-2">
          {delta && (
            <span
              className={`ip-chip ${
                delta.positive
                  ? 'border-ip-positive/25 bg-ip-positive/10 text-ip-positive'
                  : 'border-ip-negative/25 bg-ip-negative/10 text-ip-negative'
              }`}
            >
              {delta.positive ? (
                <ArrowUpRight className="h-3.5 w-3.5" />
              ) : (
                <ArrowDownRight className="h-3.5 w-3.5" />
              )}
              {delta.value}
            </span>
          )}
          {hint && <span className="text-xs text-ip-text-mute">{hint}</span>}
        </div>
      )}
    </div>
  );
}
