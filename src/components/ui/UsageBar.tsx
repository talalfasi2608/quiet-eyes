/**
 * UsageBar — Progress bar for count-based plan features.
 *
 * Usage:
 *   <UsageBar feature="leads_scans_per_month" label="סריקות לידים" />
 */

import { Lock, Infinity } from 'lucide-react';
import { usePlan } from '../../hooks/usePlan';
import { FEATURE_LABELS_HE } from '../../lib/planFeatures';

interface UsageBarProps {
  /** Feature key (e.g. "leads_scans_per_month") */
  feature: string;
  /** Display label (Hebrew). Falls back to FEATURE_LABELS_HE[feature]. */
  label?: string;
}

export default function UsageBar({ feature, label }: UsageBarProps) {
  const { limits, usage, getUsagePercent, getRemaining, isLoading } = usePlan();

  if (isLoading) {
    return (
      <div className="animate-pulse h-16 rounded-xl bg-gray-800/30" />
    );
  }

  const limit = limits[feature];
  const displayLabel = label || FEATURE_LABELS_HE[feature] || feature;

  // Boolean false — feature locked
  if (typeof limit === 'boolean' && !limit) {
    return (
      <div className="rounded-xl bg-gray-800/30 border border-gray-700/30 p-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm text-gray-400">{displayLabel}</span>
          <Lock className="w-4 h-4 text-gray-500" />
        </div>
        <p className="text-xs text-gray-500">לא זמין בתוכנית הנוכחית</p>
      </div>
    );
  }

  // Unlimited (-1)
  if (typeof limit === 'number' && limit === -1) {
    return (
      <div className="rounded-xl bg-gray-800/30 border border-gray-700/30 p-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm text-gray-300">{displayLabel}</span>
          <span className="flex items-center gap-1 text-emerald-400 text-sm">
            <Infinity className="w-4 h-4" />
            ללא הגבלה
          </span>
        </div>
        <div className="w-full h-2 rounded-full bg-gray-800 overflow-hidden">
          <div className="h-full rounded-full bg-emerald-500 w-full" />
        </div>
      </div>
    );
  }

  // Count-based feature
  if (typeof limit === 'number' && limit > 0) {
    const used = usage[feature] || 0;
    const remaining = getRemaining(feature) ?? 0;
    const percent = getUsagePercent(feature);

    // Color based on usage percentage
    let barColor = 'bg-cyan-500';
    let textColor = 'text-cyan-400';
    if (percent >= 90) {
      barColor = 'bg-red-500';
      textColor = 'text-red-400';
    } else if (percent >= 70) {
      barColor = 'bg-amber-500';
      textColor = 'text-amber-400';
    }

    return (
      <div className="rounded-xl bg-gray-800/30 border border-gray-700/30 p-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm text-gray-300">{displayLabel}</span>
          <span className={`text-sm font-medium ${textColor}`}>
            {used} / {limit}
          </span>
        </div>
        <div className="w-full h-2 rounded-full bg-gray-800 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${barColor}`}
            style={{ width: `${percent}%` }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-xs text-gray-500">{remaining} נותרו</span>
          <span className="text-xs text-gray-500">{percent}%</span>
        </div>
      </div>
    );
  }

  // Boolean true or string — feature available (no bar needed)
  return null;
}
