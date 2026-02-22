import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Shield, Target, Brain, BarChart3, Users, Zap,
  Check, ArrowLeft, Eye, Crosshair, Ghost
} from 'lucide-react';

const TIERS = [
  {
    id: 'free',
    name: 'Free',
    nameHe: 'חינם',
    price: 0,
    credits: 10,
    features: ['10 קרדיטים לחודש', 'דשבורד בסיסי', 'פרופיל עסק אחד'],
    cta: 'התחל בחינם',
    popular: false,
  },
  {
    id: 'basic',
    name: 'Basic',
    nameHe: 'בסיסי',
    price: 49,
    credits: 50,
    features: ['50 קרדיטים לחודש', "צ'אט AI COO", 'סריקות שוק', 'גילוי לידים'],
    cta: 'התחל עכשיו',
    popular: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    nameHe: 'מקצועי',
    price: 149,
    credits: 200,
    features: ['200 קרדיטים לחודש', 'הכל ב-Basic', 'תדריך יומי', 'סריקת מתחרים מעמיקה', 'תמיכה בעדיפות'],
    cta: 'שדרג למקצועי',
    popular: true,
  },
  {
    id: 'elite',
    name: 'Elite',
    nameHe: 'עילית',
    price: 349,
    credits: Infinity,
    features: ['קרדיטים ללא הגבלה', 'הכל ב-Pro', 'ניהול צוות', 'לוגים ובקרה', 'אינטגרציות מותאמות'],
    cta: 'צור קשר',
    popular: false,
  },
];

const FEATURES = [
  {
    icon: Eye,
    title: 'מודיעין שוק בזמן אמת',
    description: 'סריקה אוטומטית של מתחרים, מחירים ומגמות בשוק שלך',
  },
  {
    icon: Crosshair,
    title: 'צלף הזדמנויות',
    description: 'זיהוי לידים חמים מרשתות חברתיות ופורומים עם AI',
  },
  {
    icon: Brain,
    title: 'AI COO — סמנכ"ל תפעול',
    description: "צ'אט חכם שמכיר את העסק שלך ונותן המלצות מותאמות",
  },
  {
    icon: BarChart3,
    title: 'ניתוח מתחרים מעמיק',
    description: 'דירוגים, ביקורות, מחירים ואסטרטגיות של כל מתחרה',
  },
  {
    icon: Shield,
    title: 'כספת מודיעין מוצפנת',
    description: 'כל התובנות והנתונים שלך מאובטחים בהצפנת AES-256',
  },
  {
    icon: Users,
    title: 'ניהול צוות חכם',
    description: 'הזמנת חברי צוות, הרשאות ומעקב KPI לכל עובד',
  },
];

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-950 text-white" dir="rtl">
      {/* Navbar */}
      <nav className="fixed top-0 w-full z-50 bg-gray-950/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Ghost className="w-8 h-8 text-indigo-400" />
            <span className="text-xl font-bold bg-gradient-to-l from-indigo-400 to-purple-400 bg-clip-text text-transparent">
              Strategic Ghost
            </span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/login')}
              className="px-4 py-2 text-sm text-gray-300 hover:text-white transition"
            >
              התחברות
            </button>
            <button
              onClick={() => navigate('/login')}
              className="px-5 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 rounded-lg transition font-medium"
            >
              התחל בחינם
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-600/10 via-transparent to-transparent" />
        <div className="absolute top-20 right-1/4 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl" />
        <div className="absolute top-40 left-1/4 w-72 h-72 bg-purple-600/15 rounded-full blur-3xl" />
        
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-sm mb-8">
            <Zap className="w-4 h-4" />
            <span>פלטפורמת מודיעין עסקי מבוססת AI</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
            <span className="bg-gradient-to-l from-white via-white to-gray-400 bg-clip-text text-transparent">
              המודיעין העסקי
            </span>
            <br />
            <span className="bg-gradient-to-l from-indigo-400 to-purple-400 bg-clip-text text-transparent">
              שעובד בשבילך 24/7
            </span>
          </h1>
          
          <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">
            Strategic Ghost סורק את השוק, מזהה הזדמנויות ומתריע על שינויים — 
            כדי שתמיד תהיו צעד אחד לפני המתחרים
          </p>
          
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => navigate('/login')}
              className="px-8 py-3.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-lg font-medium transition shadow-lg shadow-indigo-600/25"
            >
              התחל בחינם — 10 קרדיטים
            </button>
            <button
              onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
              className="px-8 py-3.5 bg-white/5 hover:bg-white/10 rounded-xl text-lg font-medium transition border border-white/10"
            >
              גלה עוד
            </button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">הכלים שלך לשליטה בשוק</h2>
            <p className="text-gray-400 text-lg">כל מה שצריך כדי לנטר, לנתח ולפעול — במקום אחד</p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feature, i) => (
              <div
                key={i}
                className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] hover:border-indigo-500/30 transition group"
              >
                <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center mb-4 group-hover:bg-indigo-500/20 transition">
                  <feature.icon className="w-6 h-6 text-indigo-400" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-6 bg-gradient-to-b from-transparent via-indigo-600/5 to-transparent">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">תוכניות ומחירים</h2>
            <p className="text-gray-400 text-lg">בחר את התוכנית שמתאימה לעסק שלך</p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {TIERS.map((tier) => (
              <div
                key={tier.id}
                className={`relative p-6 rounded-2xl border transition ${
                  tier.popular
                    ? 'bg-indigo-600/10 border-indigo-500/40 shadow-lg shadow-indigo-600/10'
                    : 'bg-white/[0.03] border-white/[0.06] hover:border-white/[0.12]'
                }`}
              >
                {tier.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-indigo-600 rounded-full text-xs font-medium">
                    הכי פופולרי
                  </div>
                )}
                
                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-1">{tier.nameHe}</h3>
                  <p className="text-sm text-gray-400">{tier.name}</p>
                </div>
                
                <div className="mb-6">
                  <span className="text-4xl font-bold">
                    {tier.price === 0 ? 'חינם' : `₪${tier.price}`}
                  </span>
                  {tier.price > 0 && <span className="text-gray-400 text-sm mr-1">/ חודש</span>}
                </div>
                
                <ul className="space-y-3 mb-8">
                  {tier.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-gray-300">
                      <Check className="w-4 h-4 text-indigo-400 shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
                
                <button
                  onClick={() => navigate('/login')}
                  className={`w-full py-2.5 rounded-lg text-sm font-medium transition ${
                    tier.popular
                      ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                      : 'bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10'
                  }`}
                >
                  {tier.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            מוכנים לשדרג את המודיעין העסקי?
          </h2>
          <p className="text-gray-400 text-lg mb-10">
            הצטרפו לעסקים שכבר משתמשים ב-Strategic Ghost כדי לזהות הזדמנויות לפני כולם
          </p>
          <button
            onClick={() => navigate('/login')}
            className="px-10 py-4 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-lg font-medium transition shadow-lg shadow-indigo-600/25"
          >
            התחל עכשיו — בחינם
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-sm text-gray-500">
          <div className="flex items-center gap-2">
            <Ghost className="w-5 h-5" />
            <span>Strategic Ghost © 2026</span>
          </div>
          <div>פותח עם ❤️ בישראל</div>
        </div>
      </footer>
    </div>
  );
}
