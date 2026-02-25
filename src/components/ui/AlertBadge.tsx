type Urgency = 'critical' | 'high' | 'medium' | 'low';

interface AlertBadgeProps {
  urgency: Urgency;
  text: string;
  className?: string;
}

const config: Record<Urgency, {
  dot: string;
  text: string;
  bg: string;
  border: string;
  pulse: boolean;
}> = {
  critical: {
    dot: 'bg-[var(--urgency-critical)]',
    text: 'text-[var(--urgency-critical)]',
    bg: 'bg-[var(--urgency-critical-bg)]',
    border: 'border-[var(--urgency-critical-border)]',
    pulse: true,
  },
  high: {
    dot: 'bg-[var(--urgency-high)]',
    text: 'text-[var(--urgency-high)]',
    bg: 'bg-[var(--urgency-high-bg)]',
    border: 'border-[var(--urgency-high-border)]',
    pulse: true,
  },
  medium: {
    dot: 'bg-[var(--urgency-medium)]',
    text: 'text-[var(--urgency-medium)]',
    bg: 'bg-[var(--urgency-medium-bg)]',
    border: 'border-[var(--urgency-medium-border)]',
    pulse: false,
  },
  low: {
    dot: 'bg-[var(--urgency-low)]',
    text: 'text-[var(--urgency-low)]',
    bg: 'bg-[var(--urgency-low-bg)]',
    border: 'border-[var(--urgency-low-border)]',
    pulse: false,
  },
};

export default function AlertBadge({ urgency, text, className = '' }: AlertBadgeProps) {
  const c = config[urgency];

  return (
    <span
      className={`
        inline-flex items-center gap-2
        px-3 py-1.5
        rounded-[var(--radius-full)]
        border ${c.border} ${c.bg}
        text-xs font-medium ${c.text}
        ${className}
      `}
      dir="rtl"
    >
      {/* Pulsing dot for critical/high */}
      <span className="relative flex h-2 w-2">
        {c.pulse && (
          <span className={`absolute inline-flex h-full w-full rounded-full ${c.dot} opacity-75 animate-ping`} />
        )}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${c.dot}`} />
      </span>
      {text}
    </span>
  );
}
