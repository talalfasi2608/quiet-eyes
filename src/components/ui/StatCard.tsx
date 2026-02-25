import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type Trend = 'up' | 'down' | 'neutral';

interface StatCardProps {
  value: string | number;
  label: string;
  trend?: Trend;
  trendValue?: string;
  icon?: LucideIcon;
  prefix?: string;
  suffix?: string;
  className?: string;
}

const trendConfig: Record<Trend, { icon: LucideIcon; color: string; bg: string }> = {
  up: {
    icon: TrendingUp,
    color: 'text-[var(--success)]',
    bg: 'bg-[var(--success-bg)]',
  },
  down: {
    icon: TrendingDown,
    color: 'text-[var(--danger)]',
    bg: 'bg-[var(--danger-bg)]',
  },
  neutral: {
    icon: Minus,
    color: 'text-[var(--text-muted)]',
    bg: 'bg-[var(--bg-elevated)]',
  },
};

export default function StatCard({
  value,
  label,
  trend,
  trendValue,
  icon: Icon,
  prefix,
  suffix,
  className = '',
}: StatCardProps) {
  const trendInfo = trend ? trendConfig[trend] : null;
  const TrendIcon = trendInfo?.icon;

  return (
    <div
      className={`
        relative overflow-hidden
        rounded-[var(--radius-lg)] border border-[var(--border)]
        bg-[var(--glass)] backdrop-blur-xl
        p-5 transition-all duration-300
        hover:border-[var(--border-accent)] hover:shadow-[var(--glow)]
        ${className}
      `}
    >
      {/* Background pulse animation */}
      <div className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-500">
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent-primary)]/[0.03] to-transparent" />
      </div>

      <div className="relative">
        {/* Top row: icon + trend */}
        <div className="flex items-center justify-between mb-3">
          {Icon && (
            <div className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--accent-primary)]/10 flex items-center justify-center">
              <Icon className="w-5 h-5 text-[var(--accent-primary)]" />
            </div>
          )}
          {trendInfo && TrendIcon && trendValue && (
            <div className={`flex items-center gap-1 px-2.5 py-1 rounded-[var(--radius-full)] ${trendInfo.bg}`}>
              <TrendIcon className={`w-3.5 h-3.5 ${trendInfo.color}`} />
              <span className={`text-xs font-medium ${trendInfo.color}`}>{trendValue}</span>
            </div>
          )}
        </div>

        {/* Value */}
        <div className="flex items-baseline gap-1 mb-1">
          {prefix && (
            <span className="text-[var(--text-secondary)] text-sm font-medium">{prefix}</span>
          )}
          <span
            className="text-[var(--text-stat)] font-bold text-[var(--text-primary)] leading-none tracking-tight"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {value}
          </span>
          {suffix && (
            <span className="text-[var(--text-secondary)] text-sm font-medium">{suffix}</span>
          )}
        </div>

        {/* Label */}
        <p className="text-[var(--text-secondary)] text-sm">{label}</p>
      </div>
    </div>
  );
}
