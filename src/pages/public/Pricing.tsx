import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Star, Zap, Crown, Shield, ArrowLeft } from 'lucide-react';

const PLANS = [
  {
    id: 'starter',
    name: 'סטארטר',
    icon: Zap,
    priceMonthly: 149,
    priceYearly: 1490,
    credits: 50,
    badge: null,
    gradient: 'from-blue-600 to-blue-700',
    border: 'border-blue-500/30',
    features: [
      '50 קרדיטים לחודש',
      'עד 3 מתחרים',
      '30 סריקות לידים',
      'דוחות AI',
      'צ\'אט AI COO',
      'תדריך יומי',
    ],
  },
  {
    id: 'pro',
    name: 'מקצועי',
    icon: Star,
    priceMonthly: 299,
    priceYearly: 2990,
    credits: 200,
    badge: 'הכי פופולרי',
    gradient: 'from-blue-600 to-cyan-500',
    border: 'border-cyan-500/30',
    features: [
      '200 קרדיטים לחודש',
      'עד 10 מתחרים',
      '200 סריקות לידים',
      'דוחות AI',
      'התראות WhatsApp',
      'עד 3 ערים',
      'אוטומציות',
      'עד 3 חברי צוות',
    ],
  },
  {
    id: 'business',
    name: 'עסקי',
    icon: Crown,
    priceMonthly: 599,
    priceYearly: 5990,
    credits: 9999,
    badge: null,
    gradient: 'from-amber-500 to-amber-700',
    border: 'border-amber-500/30',
    features: [
      'קרדיטים ללא הגבלה',
      'מתחרים ללא הגבלה',
      'סריקות ללא הגבלה',
      'הכל ב-Pro',
      'גישת API',
      'ניהול צוות',
      'לוגים ובקרה',
      'מנהל לקוח ייעודי',
    ],
  },
];

const COMPARISON_FEATURES = [
  { name: 'קרדיטים לחודש', free: '10', starter: '50', pro: '200', business: 'ללא הגבלה' },
  { name: 'מתחרים', free: '1', starter: '3', pro: '10', business: 'ללא הגבלה' },
  { name: 'סריקות לידים', free: '5', starter: '30', pro: '200', business: 'ללא הגבלה' },
  { name: 'ערים', free: '1', starter: '1', pro: '3', business: 'ללא הגבלה' },
  { name: 'דוחות AI', free: false, starter: true, pro: true, business: true },
  { name: 'צ\'אט AI COO', free: false, starter: true, pro: true, business: true },
  { name: 'התראות WhatsApp', free: false, starter: false, pro: true, business: true },
  { name: 'אוטומציות', free: false, starter: false, pro: true, business: true },
  { name: 'חברי צוות', free: '1', starter: '1', pro: '3', business: 'ללא הגבלה' },
  { name: 'גישת API', free: false, starter: false, pro: false, business: true },
  { name: 'מנהל לקוח ייעודי', free: false, starter: false, pro: false, business: true },
];

export default function Pricing() {
  const [isYearly, setIsYearly] = useState(false);
  const navigate = useNavigate();

  const handleSelectPlan = (planId: string) => {
    // Store plan selection and redirect to login
    localStorage.setItem('quieteyes_selected_plan', planId);
    navigate(`/login?plan=${planId}`);
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary,#0a0e1a)]" dir="rtl">
      {/* Header */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          חזרה לדף הבית
        </button>

        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            בחרו את התוכנית המתאימה לכם
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            14 יום ניסיון חינם בכל תוכנית. ביטול בכל עת, ללא התחייבות.
          </p>
        </div>

        {/* Monthly / Yearly Toggle */}
        <div className="flex items-center justify-center gap-4 mb-12">
          <span className={`text-sm font-medium ${!isYearly ? 'text-white' : 'text-gray-400'}`}>
            חודשי
          </span>
          <button
            onClick={() => setIsYearly(!isYearly)}
            className={`relative w-14 h-7 rounded-full transition-colors duration-300 ${
              isYearly ? 'bg-cyan-600' : 'bg-gray-700'
            }`}
          >
            <div
              className={`absolute top-0.5 w-6 h-6 rounded-full bg-white transition-transform duration-300 ${
                isYearly ? 'right-0.5' : 'right-[calc(100%-1.625rem)]'
              }`}
            />
          </button>
          <span className={`text-sm font-medium ${isYearly ? 'text-white' : 'text-gray-400'}`}>
            שנתי
          </span>
          {isYearly && (
            <span className="px-2 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-medium border border-emerald-500/30">
              חיסכון של עד 17%
            </span>
          )}
        </div>

        {/* Plan Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto mb-20">
          {PLANS.map((plan) => {
            const Icon = plan.icon;
            const price = isYearly ? Math.round(plan.priceYearly / 12) : plan.priceMonthly;
            const totalYearly = plan.priceYearly;
            const monthlySavings = plan.priceMonthly * 12 - totalYearly;
            const isPro = plan.id === 'pro';

            return (
              <div
                key={plan.id}
                className={`relative rounded-2xl p-6 transition-all duration-300 ${
                  isPro
                    ? `border-2 ${plan.border} ring-2 ring-cyan-500/20`
                    : 'border border-gray-700/30'
                }`}
                style={{
                  background: 'rgba(17, 24, 39, 0.8)',
                  backdropFilter: 'blur(16px)',
                }}
              >
                {isPro && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="px-3 py-1 rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 text-white text-xs font-bold">
                      {plan.badge}
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-3 mb-6">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${plan.gradient} flex items-center justify-center`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                </div>

                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-white">
                      {'\u20AA'}{price}
                    </span>
                    <span className="text-gray-400">/חודש</span>
                  </div>
                  {isYearly && (
                    <p className="text-sm text-emerald-400 mt-1">
                      {'\u20AA'}{totalYearly}/שנה (חיסכון של {'\u20AA'}{monthlySavings})
                    </p>
                  )}
                </div>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-sm text-gray-300">
                      <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleSelectPlan(plan.id)}
                  className={`w-full py-3 rounded-xl font-medium transition-all ${
                    isPro
                      ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white hover:opacity-90 shadow-lg shadow-cyan-500/25'
                      : `bg-gradient-to-r ${plan.gradient} text-white hover:opacity-90`
                  }`}
                >
                  {'\u05D4\u05EA\u05D7\u05DC \u05E0\u05D9\u05E1\u05D9\u05D5\u05DF \u05D7\u05D9\u05E0\u05DD 14 \u05D9\u05D5\u05DD'}
                </button>
              </div>
            );
          })}
        </div>

        {/* Free Tier Note */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-3 px-6 py-3 rounded-2xl border border-gray-700/30"
            style={{ background: 'rgba(17, 24, 39, 0.8)' }}
          >
            <Shield className="w-5 h-5 text-gray-400" />
            <span className="text-gray-300">
              יש גם תוכנית חינמית עם 10 קרדיטים לחודש.{' '}
              <button onClick={() => navigate('/login')} className="text-cyan-400 hover:underline">
                הירשמו בחינם
              </button>
            </span>
          </div>
        </div>

        {/* Feature Comparison Table */}
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-white text-center mb-8">
            השוואת תוכניות מפורטת
          </h2>

          <div className="rounded-2xl border border-gray-700/30 overflow-hidden"
            style={{ background: 'rgba(17, 24, 39, 0.8)' }}
          >
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700/30">
                  <th className="text-right px-6 py-4 text-sm font-medium text-gray-400">תכונה</th>
                  <th className="px-4 py-4 text-sm font-medium text-gray-400 text-center">חינם</th>
                  <th className="px-4 py-4 text-sm font-medium text-gray-400 text-center">סטארטר</th>
                  <th className="px-4 py-4 text-sm font-medium text-cyan-400 text-center">מקצועי</th>
                  <th className="px-4 py-4 text-sm font-medium text-gray-400 text-center">עסקי</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_FEATURES.map((row, idx) => (
                  <tr key={idx} className={idx < COMPARISON_FEATURES.length - 1 ? 'border-b border-gray-800/50' : ''}>
                    <td className="px-6 py-3 text-sm text-gray-300">{row.name}</td>
                    {(['free', 'starter', 'pro', 'business'] as const).map((tier) => {
                      const val = row[tier];
                      return (
                        <td key={tier} className="px-4 py-3 text-center">
                          {typeof val === 'boolean' ? (
                            val ? (
                              <Check className="w-4 h-4 text-emerald-400 mx-auto" />
                            ) : (
                              <span className="text-gray-600">—</span>
                            )
                          ) : (
                            <span className="text-sm text-gray-300">{val}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="text-center mt-16 pb-12">
          <p className="text-gray-500 text-sm">
            כל המחירים בשקלים חדשים ({'\u20AA'}) כולל מע"מ. ביטול בכל עת ללא התחייבות.
          </p>
        </div>
      </div>
    </div>
  );
}
