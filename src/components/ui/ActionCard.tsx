import { AlertTriangle, Lightbulb, ChevronLeft } from 'lucide-react';

interface ActionCardProps {
  type: 'alert' | 'opportunity';
  title: string;
  description: string;
  actionButtonText: string;
  onAction?: () => void;
}

export default function ActionCard({
  type,
  title,
  description,
  actionButtonText,
  onAction,
}: ActionCardProps) {
  const isAlert = type === 'alert';

  return (
    <div
      className={
        "glass-card glass-hover p-5 border-r-4 " +
        (isAlert ? "border-r-amber-500" : "border-r-emerald-500")
      }
    >
      <div className="flex items-start gap-4">
        <div
          className={
            "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 " +
            (isAlert
              ? "bg-amber-500/20 text-amber-400"
              : "bg-emerald-500/20 text-emerald-400")
          }
        >
          {isAlert ? (
            <AlertTriangle className="w-5 h-5" />
          ) : (
            <Lightbulb className="w-5 h-5" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={
                "text-xs font-medium px-2 py-0.5 rounded-full " +
                (isAlert
                  ? "bg-amber-500/20 text-amber-400"
                  : "bg-emerald-500/20 text-emerald-400")
              }
            >
              {isAlert ? "התראה" : "הזדמנות"}
            </span>
          </div>
          <h3 className="text-lg font-semibold text-white mb-1">{title}</h3>
          <p className="text-gray-400 text-sm mb-4">{description}</p>

          <button
            onClick={onAction}
            className={
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 " +
              (isAlert
                ? "bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
                : "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20")
            }
          >
            <span>{actionButtonText}</span>
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
