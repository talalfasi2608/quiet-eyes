/**
 * FeatureLock — Plan-based component gating (follows RoleGate pattern).
 *
 * Usage:
 *   <FeatureLock feature="weekly_report" upgradeMessage="דוח שבועי זמין בתוכנית מקצועי">
 *     <WeeklyReportSection />
 *   </FeatureLock>
 */

import { type ReactNode, useState } from 'react';
import { Lock, ArrowUpRight } from 'lucide-react';
import { usePlan } from '../../hooks/usePlan';
import { FEATURE_LABELS_HE } from '../../lib/planFeatures';
import UpgradeModal from './UpgradeModal';

interface FeatureLockProps {
  /** Feature key to check (e.g. "weekly_report", "ai_campaign_generator") */
  feature: string;
  /** Content to show when feature is unlocked */
  children: ReactNode;
  /** Custom upgrade message (Hebrew) */
  upgradeMessage?: string;
  /** If true, hides the component entirely instead of showing lock overlay */
  hideCompletely?: boolean;
}

export default function FeatureLock({
  feature,
  children,
  upgradeMessage,
  hideCompletely = false,
}: FeatureLockProps) {
  const { canUse, plan, isLoading } = usePlan();
  const [showUpgrade, setShowUpgrade] = useState(false);

  // While loading, show children (avoid flash of locked state)
  if (isLoading) {
    return <>{children}</>;
  }

  // Feature is unlocked — render children normally
  if (canUse(feature)) {
    return <>{children}</>;
  }

  // Feature is locked
  if (hideCompletely) {
    return null;
  }

  const featureName = FEATURE_LABELS_HE[feature] || feature;
  const message = upgradeMessage || `${featureName} זמין בתוכנית גבוהה יותר`;

  return (
    <>
      <div className="relative">
        {/* Blurred children */}
        <div className="pointer-events-none select-none filter blur-sm opacity-40">
          {children}
        </div>

        {/* Lock overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/60 backdrop-blur-[2px] rounded-xl z-10">
          <div className="text-center p-6 max-w-sm">
            <div className="w-12 h-12 rounded-2xl bg-gray-800 border border-gray-700/30 flex items-center justify-center mx-auto mb-3">
              <Lock className="w-6 h-6 text-gray-400" />
            </div>
            <p className="text-gray-300 text-sm mb-4" dir="rtl">
              {message}
            </p>
            <button
              onClick={() => setShowUpgrade(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white text-sm font-medium hover:opacity-90 transition-all shadow-lg shadow-cyan-500/25"
            >
              <ArrowUpRight className="w-4 h-4" />
              שדרגו עכשיו
            </button>
          </div>
        </div>
      </div>

      <UpgradeModal
        isOpen={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        feature={featureName}
        currentPlan={plan}
      />
    </>
  );
}
