import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSubscription } from '../../context/SubscriptionContext';
import { useSimulation } from '../../context/SimulationContext';
import { apiFetch } from '../../services/api';
import { Target, Eye, BarChart3, Lightbulb, Zap, Check, Crown, Loader2 } from 'lucide-react';

interface TrialStats {
  leads_found: number;
  competitors_tracked: number;
  competitor_changes: number;
  alerts_sent: number;
  health_score: number;
}

interface TrialStatusData {
  in_trial: boolean;
  expired: boolean;
  days_remaining: number;
  business_name: string;
  stats: TrialStats;
}

const PLANS = [
  {
    id: 'starter',
    name: 'סטארטר',
    price: 149,
    priceYearly: 119,
    features: [
      '50 קרדיטים/חודש',
      '5 מתחרים במעקב',
      '10 סריקות לידים',
      'דוח שבועי PDF',
      'התראות וואטסאפ',
    ],
  },
  {
    id: 'pro',
    name: 'PRO',
    price: 299,
    priceYearly: 249,
    popular: true,
    features: [
      '200 קרדיטים/חודש',
      '25 מתחרים במעקב',
      '100 סריקות לידים',
      'דוח שבועי PDF',
      'התראות וואטסאפ',
      'אינטגרציית CRM',
      'מודיעין מתקדם',
    ],
  },
  {
    id: 'business',
    name: 'Business',
    price: 599,
    priceYearly: 499,
    features: [
      'קרדיטים ללא הגבלה',
      'מתחרים ללא הגבלה',
      'סריקות ללא הגבלה',
      'כל תכונות PRO',
      'מנהל חשבון אישי',
      'API גישה',
      'רב-סניפי',
    ],
  },
];

export default function Upgrade() {
  const navigate = useNavigate();
  const { tier, isPaid } = useSubscription();
  const { currentProfile } = useSimulation();
  const [trialData, setTrialData] = useState<TrialStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'yearly'>('monthly');
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch('/billing/trial-status');
        if (res.ok) {
          setTrialData(await res.json());
        }
      } catch { /* ignore */ }
      setLoading(false);
    })();
  }, []);

  const handleCheckout = async (planId: string) => {
    setCheckoutLoading(planId);
    try {
      const res = await apiFetch('/billing/checkout', {
        method: 'POST',
        body: JSON.stringify({
          tier: planId,
          billing: billingInterval,
          success_url: `${window.location.origin}/dashboard?upgraded=true`,
          cancel_url: `${window.location.origin}/dashboard/billing`,
        }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch { /* ignore */ }
    setCheckoutLoading(null);
  };

  if (isPaid && tier !== 'free') {
    // Already paid — redirect to billing
    navigate('/dashboard/billing', { replace: true });
    return null;
  }

  const stats = trialData?.stats;
  const name = trialData?.business_name || currentProfile?.business_name || '';

  return (
    <div className="max-w-5xl mx-auto space-y-8" dir="rtl">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-white mb-2">
          {name ? `${name}, הנה למה כדאי לשדרג` : 'שדרג את Quieteyes שלך'}
        </h1>
        <p className="text-gray-400">
          {trialData?.expired
            ? 'הניסיון הסתיים — שדרג כדי להמשיך לקבל מודיעין עסקי'
            : trialData?.in_trial
              ? `נותרו ${trialData.days_remaining} ימים בניסיון`
              : 'בחר את התוכנית המתאימה לך'
          }
        </p>
      </div>

      {/* Trial Stats Summary */}
      {stats && (stats.leads_found > 0 || stats.competitors_tracked > 0) && (
        <div className="bg-[#0a1628]/60 backdrop-blur-xl border border-cyan-500/20 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-cyan-400" />
            מה מצאנו עבורך ב-14 יום:
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-cyan-400">{stats.leads_found}</div>
              <div className="text-gray-400 text-sm">לידים חמים</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-cyan-400">{stats.competitors_tracked}</div>
              <div className="text-gray-400 text-sm">מתחרים במעקב</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-cyan-400">{stats.competitor_changes}</div>
              <div className="text-gray-400 text-sm">שינויים שזוהו</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-cyan-400">{stats.health_score}/100</div>
              <div className="text-gray-400 text-sm">ציון בריאות</div>
            </div>
          </div>
          <p className="text-center text-gray-400 text-sm mt-4">
            אם ליד אחד הפך ללקוח — שילמת על כל השנה.
          </p>
        </div>
      )}

      {/* Billing toggle */}
      <div className="flex justify-center">
        <div className="bg-gray-800/50 rounded-xl p-1 flex">
          <button
            onClick={() => setBillingInterval('monthly')}
            className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${
              billingInterval === 'monthly'
                ? 'bg-cyan-600 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            חודשי
          </button>
          <button
            onClick={() => setBillingInterval('yearly')}
            className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${
              billingInterval === 'yearly'
                ? 'bg-cyan-600 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            שנתי (חסוך 20%)
          </button>
        </div>
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {PLANS.map((plan) => (
          <div
            key={plan.id}
            className={`relative bg-[#0a1628]/60 backdrop-blur-xl border rounded-2xl p-6 flex flex-col ${
              plan.popular
                ? 'border-cyan-500/50 ring-1 ring-cyan-500/20'
                : 'border-gray-700/30'
            }`}
          >
            {plan.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-cyan-600 to-blue-600 text-white text-xs font-bold">
                הכי פופולרי
              </div>
            )}

            <div className="mb-4">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                {plan.popular && <Crown className="w-5 h-5 text-cyan-400" />}
                {plan.name}
              </h3>
              <div className="mt-2">
                <span className="text-3xl font-bold text-white">
                  ₪{billingInterval === 'yearly' ? plan.priceYearly : plan.price}
                </span>
                <span className="text-gray-400 text-sm">/חודש</span>
              </div>
              {billingInterval === 'yearly' && (
                <p className="text-emerald-400 text-xs mt-1">
                  חיסכון של ₪{(plan.price - plan.priceYearly) * 12} בשנה
                </p>
              )}
            </div>

            <ul className="space-y-2.5 flex-1 mb-6">
              {plan.features.map((feat, i) => (
                <li key={i} className="flex items-center gap-2 text-gray-300 text-sm">
                  <Check className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                  {feat}
                </li>
              ))}
            </ul>

            <button
              onClick={() => handleCheckout(plan.id)}
              disabled={!!checkoutLoading}
              className={`w-full py-3 rounded-xl font-bold text-sm transition-all ${
                plan.popular
                  ? 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white'
                  : 'bg-gray-700/50 border border-gray-600/50 text-white hover:bg-gray-700'
              } disabled:opacity-50`}
            >
              {checkoutLoading === plan.id ? (
                <Loader2 className="w-4 h-4 animate-spin mx-auto" />
              ) : (
                'בחר תוכנית'
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
