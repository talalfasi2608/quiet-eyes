import { ReactNode } from 'react';
import { useSubscription } from '../../context/SubscriptionContext';
import { Lock, ArrowUpRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

type Tier = 'free' | 'basic' | 'pro' | 'elite';

const TIER_HIERARCHY: Record<Tier, number> = {
  free: 0,
  basic: 1,
  pro: 2,
  elite: 3,
};

const TIER_NAMES: Record<Tier, string> = {
  free: 'Free',
  basic: 'Basic',
  pro: 'Pro',
  elite: 'Elite',
};

interface FeatureGateProps {
  /** Minimum tier required */
  minTier: Tier;
  /** Content to show when user has sufficient tier */
  children: ReactNode;
  /** Feature name for the upgrade prompt */
  featureName?: string;
  /** If true, hides entirely */
  hideCompletely?: boolean;
}

/**
 * Subscription tier gating.
 * Shows upgrade prompt for users on lower tiers.
 *
 * Usage:
 *   <FeatureGate minTier="basic" featureName="AI COO Chat">
 *     <ChatInterface />
 *   </FeatureGate>
 */
export default function FeatureGate({ minTier, children, featureName, hideCompletely = false }: FeatureGateProps) {
  const { tier } = useSubscription();
  const navigate = useNavigate();

  const userLevel = TIER_HIERARCHY[(tier as Tier) || 'free'] || 0;
  const requiredLevel = TIER_HIERARCHY[minTier] || 0;

  if (userLevel >= requiredLevel) {
    return <>{children}</>;
  }

  if (hideCompletely) {
    return null;
  }

  return (
    <div className="rounded-xl bg-gradient-to-br from-gray-800/50 to-gray-900/50 border border-gray-700/30 p-8 text-center">
      <Lock className="w-10 h-10 text-indigo-400 mx-auto mb-3" />
      <h3 className="text-lg font-semibold text-white mb-2">
        {featureName ? `${featureName} דורש` : 'פיצ\'ר זה דורש'} תוכנית {TIER_NAMES[minTier]}
      </h3>
      <p className="text-gray-400 text-sm mb-4">
        שדרגו את התוכנית שלכם כדי לגשת לפיצ'ר זה
      </p>
      <button
        onClick={() => navigate('/dashboard/billing')}
        className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-medium hover:from-indigo-500 hover:to-purple-500 transition-all"
      >
        <ArrowUpRight className="w-4 h-4" />
        שדרג עכשיו
      </button>
    </div>
  );
}

/**
 * Hook to check if the current user has a minimum tier.
 */
export function useHasTier(minTier: Tier): boolean {
  const { tier } = useSubscription();
  const userLevel = TIER_HIERARCHY[(tier as Tier) || 'free'] || 0;
  const requiredLevel = TIER_HIERARCHY[minTier] || 0;
  return userLevel >= requiredLevel;
}
