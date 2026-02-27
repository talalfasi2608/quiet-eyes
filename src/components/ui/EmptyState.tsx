import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  emoji?: string;
  iconColor?: string;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  actionIcon?: LucideIcon;
  secondaryLabel?: string;
  secondaryAction?: () => void;
}

export default function EmptyState({
  icon: Icon,
  emoji,
  iconColor = 'text-cyan-400',
  title,
  description,
  actionLabel,
  onAction,
  actionIcon: ActionIcon,
  secondaryLabel,
  secondaryAction,
}: EmptyStateProps) {
  return (
    <div className="glass-card p-8 md:p-12 text-center" dir="rtl">
      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center mx-auto mb-6">
        {emoji ? (
          <span className="text-4xl">{emoji}</span>
        ) : Icon ? (
          <Icon className={`w-10 h-10 ${iconColor}`} />
        ) : null}
      </div>
      <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
      <p className="text-gray-400 text-sm max-w-md mx-auto whitespace-pre-line leading-relaxed">{description}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-6 px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-500 text-white rounded-xl font-medium hover:from-blue-500 hover:to-cyan-400 transition-all inline-flex items-center gap-2 min-h-[48px]"
        >
          {ActionIcon && <ActionIcon className="w-5 h-5" />}
          {actionLabel}
        </button>
      )}
      {secondaryLabel && secondaryAction && (
        <button
          onClick={secondaryAction}
          className="mt-3 block mx-auto text-sm text-gray-400 hover:text-cyan-400 transition-colors"
        >
          {secondaryLabel}
        </button>
      )}
    </div>
  );
}
