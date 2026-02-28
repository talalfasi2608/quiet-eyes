import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useSubscription } from '../../context/SubscriptionContext';
import PageLoader from '../../components/ui/PageLoader';
import {
  CreditCard,
  Zap,
  Crown,
  Shield,
  Star,
  Check,
  Loader2,
  ExternalLink,
  BarChart3,
  ArrowUpRight,
  Sparkles,
  Clock,
} from 'lucide-react';
import { apiFetch } from '../../services/api';
import UsageBar from '../../components/ui/UsageBar';

interface TierInfo {
  id: string;
  name: string;
  nameHe?: string;
  credits: number;
  price_monthly: number;
  price_yearly?: number;
  features: string[];
  badge?: string | null;
}

interface UsageRecord {
  id: string;
  action: string;
  credits_used: number;
  endpoint: string;
  created_at: string;
}

const TIER_ICONS: Record<string, typeof Star> = {
  free: Shield,
  starter: Zap,
  basic: Zap,
  pro: Star,
  business: Crown,
  elite: Crown,
};

const TIER_GRADIENTS: Record<string, string> = {
  free: 'from-gray-600 to-gray-700',
  starter: 'from-blue-600 to-blue-700',
  basic: 'from-blue-600 to-blue-700',
  pro: 'from-blue-600 to-cyan-500',
  business: 'from-amber-500 to-amber-700',
  elite: 'from-amber-500 to-amber-700',
};

const TIER_BORDERS: Record<string, string> = {
  free: 'border-gray-600/30',
  starter: 'border-blue-500/30',
  basic: 'border-blue-500/30',
  pro: 'border-cyan-500/30',
  business: 'border-amber-500/30',
  elite: 'border-amber-500/30',
};

const ACTION_LABELS: Record<string, string> = {
  chat: 'צ\'אט AI',
  market_scan: 'סריקת שוק',
  lead_snipe: 'ציד לידים',
  competitor_research: 'מחקר מתחרים',
  briefing: 'תדריך יומי',
};

export default function PlanManagement() {
  const {
    tier, tierName, creditsRemaining, creditsLimit,
    hasStripe, refreshSubscription, billingInterval,
    trialEndsAt, isTrial, planId,
  } = useSubscription();

  const [tiers, setTiers] = useState<TierInfo[]>([]);
  const [creditCosts, setCreditCosts] = useState<Record<string, number>>({});
  const [usage, setUsage] = useState<UsageRecord[]>([]);
  const [isLoadingTiers, setIsLoadingTiers] = useState(true);
  const [isLoadingUsage, setIsLoadingUsage] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [showUsage, setShowUsage] = useState(false);
  const [suggestedPlan, setSuggestedPlan] = useState<string | null>(null);
  const [billingToggle, setBillingToggle] = useState<'monthly' | 'yearly'>('monthly');

  // Check if user came from landing page with a pre-selected plan
  useEffect(() => {
    const stored = localStorage.getItem('quieteyes_selected_plan');
    if (stored) {
      setSuggestedPlan(stored);
      localStorage.removeItem('quieteyes_selected_plan');
    }
  }, []);

  // Fetch available tiers
  useEffect(() => {
    const fetchTiers = async () => {
      try {
        const res = await apiFetch(`/billing/tiers`);
        if (res.ok) {
          const data = await res.json();
          const mappedTiers = (data.tiers || []).map((t: Record<string, unknown>) => ({
            ...t,
            price_monthly: t.price ?? t.price_monthly ?? 0,
            price_yearly: t.price_yearly ?? 0,
          }));
          setTiers(mappedTiers);
          setCreditCosts(data.credit_costs || {});
        }
      } catch {
        // Fallback
      } finally {
        setIsLoadingTiers(false);
      }
    };
    fetchTiers();
  }, []);

  // Fetch usage history
  const fetchUsage = async () => {
    setIsLoadingUsage(true);
    try {
      const res = await apiFetch(`/billing/usage`);
      if (res.ok) {
        const data = await res.json();
        setUsage(data.usage || []);
      }
    } catch {
      // silent
    } finally {
      setIsLoadingUsage(false);
    }
  };

  const handleCheckout = async (tierId: string) => {
    setCheckoutLoading(tierId);
    try {
      const res = await apiFetch(`/billing/checkout`, {
        method: 'POST',
        body: JSON.stringify({
          tier: tierId,
          billing: billingToggle,
          success_url: `${window.location.origin}/dashboard/billing?upgraded=true`,
          cancel_url: `${window.location.origin}/dashboard/billing`,
        }),
      });

      const data = await res.json().catch(() => null);
      if (res.ok && data?.url) {
        window.location.href = data.url;
        return;
      }
      toast.error(data?.detail || 'שגיאה ביצירת הזמנה');
    } catch {
      toast.error('שגיאת רשת');
    } finally {
      setCheckoutLoading(null);
    }
  };

  const handlePortal = async () => {
    setPortalLoading(true);
    try {
      const res = await apiFetch(`/billing/portal`, {
        method: 'POST',
        body: JSON.stringify({
          return_url: `${window.location.origin}/dashboard/billing`,
        }),
      });

      const data = await res.json().catch(() => null);
      if (res.ok && data?.url) {
        window.open(data.url, '_blank');
        return;
      }
      toast.error('שגיאה בפתיחת פורטל');
    } catch {
      toast.error('שגיאת רשת');
    } finally {
      setPortalLoading(false);
    }
  };

  // Check if just upgraded
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('upgraded') === 'true') {
      refreshSubscription();
      toast.success('המנוי שודרג בהצלחה!');
      window.history.replaceState({}, '', '/dashboard/billing');
    }
  }, []);

  const creditsPercent = creditsLimit > 0 ? Math.min(100, (creditsRemaining / creditsLimit) * 100) : 100;

  // Trial days remaining
  const trialDaysLeft = (() => {
    if (!trialEndsAt) return 0;
    try {
      const diff = new Date(trialEndsAt).getTime() - Date.now();
      return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
    } catch {
      return 0;
    }
  })();

  if (isLoadingTiers) return <PageLoader message="טוען פרטי מנוי..." />;

  return (
    <div className="space-y-8" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center">
          <CreditCard className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-white">התוכנית שלי ⭐</h1>
          <p className="text-gray-400">שדרגו את התוכנית שלכם וצפו בשימוש קרדיטים</p>
        </div>
      </div>

      {/* Current Plan Card */}
      <div className={`glass-card p-6 border ${TIER_BORDERS[tier] || 'border-gray-700/30'}`}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${TIER_GRADIENTS[tier] || TIER_GRADIENTS.free} flex items-center justify-center`}>
              {(() => {
                const Icon = TIER_ICONS[tier] || Shield;
                return <Icon className="w-7 h-7 text-white" />;
              })()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white">תוכנית {tierName}</h2>
                {isTrial && trialDaysLeft > 0 && (
                  <span className="px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-400 text-xs font-medium border border-amber-500/30 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    ניסיון - {trialDaysLeft} ימים
                  </span>
                )}
                {billingInterval === 'yearly' && tier !== 'free' && (
                  <span className="px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-medium border border-emerald-500/30">
                    שנתי
                  </span>
                )}
              </div>
              <p className="text-gray-400 text-sm">
                {tier === 'business' || tier === 'elite' ? 'קרדיטים ללא הגבלה' : `${creditsRemaining} / ${creditsLimit} קרדיטים נותרו`}
              </p>
            </div>
          </div>

          {hasStripe && (
            <button
              onClick={handlePortal}
              disabled={portalLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 transition-all text-sm disabled:opacity-50"
            >
              {portalLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
              ניהול מנוי ב-Stripe
            </button>
          )}
        </div>

        {/* Credits Bar */}
        {tier !== 'business' && tier !== 'elite' && (
          <div className="mt-4">
            <div className="w-full h-3 rounded-full bg-gray-800 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  creditsPercent > 50 ? 'bg-emerald-500' : creditsPercent > 20 ? 'bg-amber-500' : 'bg-red-500'
                }`}
                style={{ width: `${creditsPercent}%` }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-xs text-gray-500">{creditsRemaining} נותרו</span>
              <span className="text-xs text-gray-500">{creditsLimit} סה"כ</span>
            </div>
          </div>
        )}
      </div>

      {/* Monthly Usage Section */}
      <div className="glass-card p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-cyan-400" />
          שימוש חודשי
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <UsageBar feature="leads_scans_per_month" label="סריקות לידים" />
          <UsageBar feature="ai_chat_messages_per_month" label="הודעות AI" />
          <UsageBar feature="competitors_tracked" label="מתחרים עקובים" />
          <UsageBar feature="intelligence_scan_per_month" label="סריקות מודיעין" />
        </div>
      </div>

      {/* Credit Costs Info */}
      {Object.keys(creditCosts).length > 0 && (
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-cyan-400" />
            עלות קרדיטים לפעולה
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {Object.entries(creditCosts).map(([action, cost]) => (
              <div key={action} className="rounded-xl bg-gray-800/50 border border-gray-700/30 p-3 text-center">
                <p className="text-xl font-bold text-white">{cost}</p>
                <p className="text-xs text-gray-400 mt-1">{ACTION_LABELS[action] || action}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Billing Toggle + Tier Cards */}
      <div>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
          <h3 className="text-lg font-semibold text-white">תוכניות זמינות</h3>

          {/* Monthly / Yearly Toggle */}
          <div className="flex items-center gap-3">
            <span className={`text-sm ${billingToggle === 'monthly' ? 'text-white font-medium' : 'text-gray-400'}`}>
              חודשי
            </span>
            <button
              onClick={() => setBillingToggle(billingToggle === 'monthly' ? 'yearly' : 'monthly')}
              className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${
                billingToggle === 'yearly' ? 'bg-cyan-600' : 'bg-gray-700'
              }`}
            >
              <div
                className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform duration-300 ${
                  billingToggle === 'yearly' ? 'right-0.5' : 'right-[calc(100%-1.375rem)]'
                }`}
              />
            </button>
            <span className={`text-sm ${billingToggle === 'yearly' ? 'text-white font-medium' : 'text-gray-400'}`}>
              שנתי
            </span>
            {billingToggle === 'yearly' && (
              <span className="px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-medium border border-emerald-500/30">
                חיסכון עד 17%
              </span>
            )}
          </div>
        </div>

        {isLoadingTiers ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {tiers.map((t) => {
              const isCurrentTier = t.id === tier || t.id === planId;
              const isSuggested = t.id === suggestedPlan && !isCurrentTier;
              const Icon = TIER_ICONS[t.id] || Shield;
              const gradient = TIER_GRADIENTS[t.id] || TIER_GRADIENTS.free;
              const isUpgrade = !isCurrentTier && t.id !== 'free';
              const isPro = t.id === 'pro';
              const price = billingToggle === 'yearly' && t.price_yearly
                ? Math.round(t.price_yearly / 12)
                : t.price_monthly;
              const yearlySavings = t.price_monthly > 0 && t.price_yearly
                ? t.price_monthly * 12 - t.price_yearly
                : 0;

              return (
                <div
                  key={t.id}
                  className={`glass-card p-6 relative overflow-hidden transition-all duration-300 ${
                    isCurrentTier ? `border-2 ${TIER_BORDERS[t.id] || 'border-gray-600/30'}` :
                    isPro ? 'border-2 border-cyan-500/30 ring-1 ring-cyan-500/10' :
                    isSuggested ? 'border-2 border-indigo-500/50 ring-2 ring-indigo-500/20' :
                    'hover:border-gray-600/50'
                  }`}
                >
                  {t.badge && !isCurrentTier && (
                    <div className="absolute top-3 left-3">
                      <span className="px-2 py-1 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-500 text-white text-xs font-bold">
                        {t.badge}
                      </span>
                    </div>
                  )}
                  {isSuggested && !t.badge && (
                    <div className="absolute top-3 left-3">
                      <span className="px-2 py-1 rounded-lg bg-indigo-500/20 text-indigo-400 text-xs font-medium border border-indigo-500/30 animate-pulse">
                        מומלץ עבורך
                      </span>
                    </div>
                  )}
                  {isCurrentTier && (
                    <div className="absolute top-3 left-3">
                      <span className="px-2 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-medium border border-emerald-500/30">
                        נוכחי
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h4 className="text-lg font-bold text-white">{t.nameHe || t.name}</h4>
                      <p className="text-gray-400 text-sm">
                        {price === 0 ? 'חינם' : `₪${price}/חודש`}
                      </p>
                    </div>
                  </div>

                  {/* Yearly savings */}
                  {billingToggle === 'yearly' && yearlySavings > 0 && (
                    <p className="text-xs text-emerald-400 mb-3">
                      ₪{t.price_yearly}/שנה (חיסכון ₪{yearlySavings})
                    </p>
                  )}

                  <p className="text-2xl font-bold text-white mb-4">
                    {t.credits >= 9999 ? '\u221E' : t.credits}
                    <span className="text-sm font-normal text-gray-400 mr-1">קרדיטים/חודש</span>
                  </p>

                  <ul className="space-y-2 mb-6">
                    {t.features.map((feature, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-sm text-gray-300">
                        <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  {isCurrentTier ? (
                    <div className="w-full py-2.5 rounded-xl bg-gray-800/50 text-gray-400 text-center text-sm font-medium">
                      התוכנית הנוכחית שלך
                    </div>
                  ) : isUpgrade ? (
                    <button
                      onClick={() => handleCheckout(t.id)}
                      disabled={!!checkoutLoading}
                      className={`w-full py-2.5 rounded-xl bg-gradient-to-r ${gradient} text-white font-medium hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2`}
                    >
                      {checkoutLoading === t.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <ArrowUpRight className="w-4 h-4" />
                          שדרג עכשיו
                        </>
                      )}
                    </button>
                  ) : (
                    <div className="w-full py-2.5 rounded-xl bg-gray-800/30 text-gray-500 text-center text-sm">
                      תוכנית חינם
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Usage History */}
      <div className="glass-card p-6">
        <button
          onClick={() => { setShowUsage(!showUsage); if (!showUsage && usage.length === 0) fetchUsage(); }}
          className="flex items-center gap-2 text-lg font-semibold text-white w-full"
        >
          <BarChart3 className="w-5 h-5 text-indigo-400" />
          היסטוריית שימוש
          <span className="text-sm font-normal text-gray-400 mr-auto">
            {showUsage ? 'הסתר' : 'הצג'}
          </span>
        </button>

        {showUsage && (
          <div className="mt-4">
            {isLoadingUsage ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
              </div>
            ) : usage.length === 0 ? (
              <p className="text-center text-gray-500 py-8">אין היסטוריית שימוש</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {usage.map((u) => (
                  <div key={u.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-800/30">
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-white font-medium">{ACTION_LABELS[u.action] || u.action}</span>
                      <span className="text-xs text-gray-500">{u.endpoint}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-amber-400 font-medium">-{u.credits_used}</span>
                      <span className="text-xs text-gray-500">
                        {new Date(u.created_at).toLocaleDateString('he-IL')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
