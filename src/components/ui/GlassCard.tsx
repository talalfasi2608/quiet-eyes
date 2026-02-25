import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

type Urgency = 'critical' | 'high' | 'medium' | 'low';

interface GlassCardProps {
  children: ReactNode;
  title?: string;
  icon?: LucideIcon;
  urgency?: Urgency;
  className?: string;
  noPadding?: boolean;
  onClick?: () => void;
}

const urgencyStyles: Record<Urgency, string> = {
  critical:
    'border-[var(--urgency-critical-border)] bg-[var(--urgency-critical-bg)] shadow-[var(--glow-critical)]',
  high:
    'border-[var(--urgency-high-border)] bg-[var(--urgency-high-bg)] shadow-[var(--glow-warning)]',
  medium:
    'border-[var(--urgency-medium-border)] bg-[var(--urgency-medium-bg)]',
  low:
    'border-[var(--urgency-low-border)] bg-[var(--urgency-low-bg)]',
};

const urgencyIconColor: Record<Urgency, string> = {
  critical: 'text-[var(--urgency-critical)]',
  high: 'text-[var(--urgency-high)]',
  medium: 'text-[var(--urgency-medium)]',
  low: 'text-[var(--text-secondary)]',
};

export default function GlassCard({
  children,
  title,
  icon: Icon,
  urgency,
  className = '',
  noPadding = false,
  onClick,
}: GlassCardProps) {
  const baseClasses = [
    'rounded-[var(--radius-lg)]',
    'border',
    'backdrop-blur-xl',
    'transition-all duration-300',
  ];

  const urgencyClass = urgency
    ? urgencyStyles[urgency]
    : 'border-[var(--border)] bg-[var(--glass)]';

  const hoverClass = onClick
    ? 'cursor-pointer hover:border-[var(--border-accent)] hover:shadow-[var(--glow)]'
    : 'hover:border-[var(--border)]/80';

  const paddingClass = noPadding ? '' : 'p-5';

  return (
    <div
      className={`${baseClasses.join(' ')} ${urgencyClass} ${hoverClass} ${paddingClass} ${className}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {(title || Icon) && (
        <div className="flex items-center gap-3 mb-4">
          {Icon && (
            <div
              className={`w-9 h-9 rounded-[var(--radius-md)] flex items-center justify-center ${
                urgency
                  ? `bg-[var(--bg-card)] ${urgencyIconColor[urgency]}`
                  : 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]'
              }`}
            >
              <Icon className="w-5 h-5" />
            </div>
          )}
          {title && (
            <h3 className="text-[var(--text-primary)] font-semibold text-[var(--text-base)]">
              {title}
            </h3>
          )}
        </div>
      )}
      {children}
    </div>
  );
}
