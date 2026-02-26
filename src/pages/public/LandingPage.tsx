import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, Search, TrendingUp, MessageSquare, Shield,
  Check, ChevronDown, Zap, Target, BarChart3, Eye, X,
  Bell, Star, Users,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════════════════════
   DATA
   ═══════════════════════════════════════════════════════════════════════════════ */

const TIERS = [
  {
    id: 'free',
    name: 'Free',
    nameHe: 'חינם',
    price: 0,
    yearlyPrice: 0,
    label: 'חינם',
    yearlyLabel: 'חינם',
    features: ['10 קרדיטים לחודש', 'דשבורד בסיסי', 'פרופיל עסק אחד', 'מתחרה אחד', 'סריקות שוק בסיסיות'],
    cta: 'התחל בחינם',
    popular: false,
  },
  {
    id: 'starter',
    name: 'Starter',
    nameHe: 'סטארטר',
    price: 149,
    yearlyPrice: 99,
    label: '₪149',
    yearlyLabel: '₪99',
    features: ['50 קרדיטים לחודש', 'עד 3 מתחרים', '30 סריקות לידים', "צ'אט AI COO", 'תדריך יומי', 'דוחות AI'],
    cta: 'התחל 14 יום חינם',
    popular: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    nameHe: 'מקצועי',
    price: 299,
    yearlyPrice: 199,
    label: '₪299',
    yearlyLabel: '₪199',
    features: ['200 קרדיטים לחודש', 'עד 10 מתחרים', '200 סריקות לידים', 'התראות WhatsApp', 'אוטומציות', 'עד 3 ערים', 'עד 3 חברי צוות'],
    cta: 'התחל 14 יום חינם',
    popular: true,
  },
  {
    id: 'business',
    name: 'Business',
    nameHe: 'עסקי',
    price: 599,
    yearlyPrice: 399,
    label: '₪599',
    yearlyLabel: '₪399',
    features: ['קרדיטים ללא הגבלה', 'הכל ב-Pro', 'ניהול צוות', 'לוגים ובקרה', 'גישת API', 'מנהל לקוח ייעודי'],
    cta: 'צור קשר',
    popular: false,
  },
];

const FAQ_ITEMS = [
  {
    q: 'מה זה Quieteyes ולמי זה מתאים?',
    a: 'Quieteyes היא פלטפורמת מודיעין עסקי מבוססת AI, שמיועדת לבעלי עסקים קטנים ובינוניים שרוצים לקבל תמונה ברורה של השוק, המתחרים וההזדמנויות — בלי להשקיע שעות במחקר ידני.',
  },
  {
    q: 'האם המידע שנאסף הוא חוקי?',
    a: 'בהחלט. Quieteyes אוספת אך ורק מידע ממקורות פתוחים ונגישים לציבור (OSINT). אנחנו לא פורצים, לא גונבים ולא ניגשים למידע פרטי.',
  },
  {
    q: 'כמה זמן לוקח לראות תוצאות?',
    a: 'מהרגע שתגדיר את פרופיל העסק שלך, הסריקה הראשונה מוכנה תוך דקות. תדריכים יומיים מתחילים מהיום הראשון.',
  },
  {
    q: 'אפשר לבטל בכל רגע?',
    a: 'כן. ללא התחייבות, ללא דמי ביטול. אפשר לשדרג, לשנמך או לבטל את המנוי בכל עת מתוך הגדרות החשבון.',
  },
  {
    q: 'מה ההבדל בין Quieteyes לכלי ניתוח מתחרים אחרים?',
    a: 'בניגוד לכלים שמציגים נתונים גולמיים, Quieteyes מעבדת את המידע עם AI ומחזירה לך תובנות אקטיביות — מה לעשות, מתי לפעול ואיפה ההזדמנות.',
  },
];

const TESTIMONIALS = [
  { quote: 'מאז שהתחלנו להשתמש ב-Quieteyes, אנחנו מגלים הזדמנויות שפשוט לא ידענו שקיימות.', name: 'דניאל כ.', biz: 'סוכנות דיגיטל', rating: 5, initial: 'ד', gradient: 'from-blue-500 to-cyan-500' },
  { quote: 'התדריך היומי חוסך לי לפחות שעתיים של מחקר כל בוקר. זה כמו לקבל עוזר אישי.', name: 'מיכל א.', biz: 'חנות אונליין', rating: 5, initial: 'מ', gradient: 'from-cyan-500 to-blue-500' },
  { quote: 'גילינו שמתחרה שינה מחירים — והגבנו באותו יום. בלי Quieteyes היינו מאבדים לקוחות.', name: 'יוסי ר.', biz: 'חברת שירותים', rating: 5, initial: 'י', gradient: 'from-amber-500 to-orange-500' },
];

/* ═══════════════════════════════════════════════════════════════════════════════
   HOOKS
   ═══════════════════════════════════════════════════════════════════════════════ */

function useCountUp(target: number, duration = 2000) {
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const start = performance.now();
          const step = (now: number) => {
            const progress = Math.min((now - start) / duration, 1);
            setValue(Math.floor(progress * target));
            if (progress < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [target, duration]);

  return { value, ref };
}

/* ═══════════════════════════════════════════════════════════════════════════════
   ANIMATED BACKGROUND COMPONENTS
   ═══════════════════════════════════════════════════════════════════════════════ */

function StarField() {
  const stars = useRef(
    Array.from({ length: 100 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 0.5 + Math.random() * 1.5,
      delay: Math.random() * 5,
      duration: 2 + Math.random() * 4,
    }))
  ).current;

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {stars.map((s) => (
        <div
          key={s.id}
          className="absolute rounded-full bg-white landing-star"
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: `${s.size}px`,
            height: `${s.size}px`,
            animationDelay: `${s.delay}s`,
            animationDuration: `${s.duration}s`,
          }}
        />
      ))}
    </div>
  );
}

function FloatingParticles() {
  const particles = useRef(
    Array.from({ length: 30 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 1 + Math.random() * 2,
      delay: Math.random() * 5,
      duration: 15 + Math.random() * 20,
    }))
  ).current;

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p) => (
        <div
          key={p.id}
          className="landing-particle"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   HERO DASHBOARD MOCKUP (CSS-animated, no images)
   ═══════════════════════════════════════════════════════════════════════════════ */

function DashboardMockup() {
  return (
    <div className="landing-mockup">
      <div className="landing-mockup-inner">
        {/* Title bar */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/60" />
          </div>
          <span className="text-[10px] text-gray-500">Quieteyes Dashboard</span>
          <div className="w-16" />
        </div>

        {/* Content */}
        <div className="p-4 space-y-3">
          {/* KPI row */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'מתחרים', val: '24', color: 'text-blue-400' },
              { label: 'לידים', val: '12', color: 'text-emerald-400' },
              { label: 'איומים', val: '3', color: 'text-red-400' },
              { label: 'דירוג', val: '4.7', color: 'text-amber-400' },
            ].map((k, i) => (
              <div key={i} className="bg-white/[0.03] rounded-lg p-2 text-center border border-white/5">
                <span className={`text-sm font-bold block ${k.color}`} style={{ fontFamily: "'JetBrains Mono', monospace" }}>{k.val}</span>
                <span className="text-[8px] text-gray-500">{k.label}</span>
              </div>
            ))}
          </div>

          {/* Mini chart */}
          <div className="bg-white/[0.03] rounded-lg p-3 border border-white/5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[9px] text-gray-400">מגמות שוק</span>
              <TrendingUp className="w-3 h-3 text-emerald-400" />
            </div>
            <svg viewBox="0 0 200 40" className="w-full h-8">
              <polyline
                points="0,35 20,30 40,32 60,25 80,28 100,20 120,22 140,15 160,18 180,10 200,8"
                fill="none"
                stroke="#00d4ff"
                strokeWidth="2"
                className="landing-chart-line"
              />
              <polyline
                points="0,35 20,30 40,32 60,25 80,28 100,20 120,22 140,15 160,18 180,10 200,8"
                fill="url(#chart-fill)"
                className="landing-chart-area"
              />
              <defs>
                <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00d4ff" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="#00d4ff" stopOpacity="0" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          {/* Notifications */}
          <div className="space-y-1.5">
            <div className="landing-notification landing-notification-1">
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <Target className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                <span className="text-[9px] text-emerald-300">ליד חדש: "מחפש שירותי עיצוב בתל אביב"</span>
              </div>
            </div>
            <div className="landing-notification landing-notification-2">
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <AlertTriangle className="w-3 h-3 text-amber-400 flex-shrink-0" />
                <span className="text-[9px] text-amber-300">מתחרה עדכן מחירים — ירידה של 15%</span>
              </div>
            </div>
            <div className="landing-notification landing-notification-3">
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <Bell className="w-3 h-3 text-blue-400 flex-shrink-0" />
                <span className="text-[9px] text-blue-300">תדריך בוקר מוכן — 5 עדכונים חדשים</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════════════════ */

export default function LandingPage() {
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [isYearly, setIsYearly] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Scroll-reveal observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    );
    document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  // Staggered reveal for children
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const children = entry.target.querySelectorAll('.reveal-child');
            children.forEach((child, i) => {
              setTimeout(() => child.classList.add('visible'), i * 150);
            });
          }
        });
      },
      { threshold: 0.1 }
    );
    document.querySelectorAll('.reveal-stagger').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const stat1 = useCountUp(40);
  const stat2 = useCountUp(3);
  const stat3 = useCountUp(2);
  const leadsCounter = useCountUp(1847);

  const goLogin = () => navigate('/login');
  const goRegister = () => navigate('/login?tab=register');
  const goRegisterWithPlan = (planId: string) => navigate(`/login?tab=register&plan=${planId}`);
  const scrollTo = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMobileMenuOpen(false);
  }, []);

  return (
    <div className="min-h-screen text-white overflow-x-hidden" dir="rtl" style={{ background: '#0a0e1a' }}>

      {/* ═══════════════════════════════════════════════════════════════════════════
          NAVBAR
          ═══════════════════════════════════════════════════════════════════════════ */}
      <nav className="fixed top-0 w-full z-50 bg-[#0a0e1a]/80 backdrop-blur-2xl border-b border-white/[0.04]">
        <div className="max-w-7xl mx-auto px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/logo-icon-only.svg" alt="" className="w-8 h-8" />
            <span className="text-lg font-bold text-white" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Quiet<span className="text-[#00d4ff]">eyes</span>
            </span>
          </div>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-6">
            <button onClick={() => scrollTo('how-it-works')} className="text-sm text-gray-400 hover:text-white transition-colors">
              איך זה עובד
            </button>
            <button onClick={() => scrollTo('pricing')} className="text-sm text-gray-400 hover:text-white transition-colors">
              מחירים
            </button>
            <button onClick={goLogin} className="text-sm text-gray-400 hover:text-white transition-colors">
              התחברות
            </button>
            <button
              onClick={goRegister}
              className="px-5 py-2 text-sm font-medium rounded-lg bg-[#00d4ff]/10 text-[#00d4ff] border border-[#00d4ff]/30 hover:bg-[#00d4ff]/20 transition-all shadow-[0_0_20px_rgba(0,212,255,0.1)]"
            >
              התחל חינם
            </button>
          </div>

          {/* Mobile hamburger */}
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden p-2 text-gray-400">
            {mobileMenuOpen ? <X className="w-5 h-5" /> : (
              <div className="space-y-1.5">
                <div className="w-5 h-0.5 bg-gray-400" />
                <div className="w-5 h-0.5 bg-gray-400" />
                <div className="w-3.5 h-0.5 bg-gray-400" />
              </div>
            )}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-white/5 bg-[#0a0e1a]/95 backdrop-blur-2xl px-6 py-4 space-y-3">
            <button onClick={() => scrollTo('how-it-works')} className="block w-full text-start text-sm text-gray-300 py-2">איך זה עובד</button>
            <button onClick={() => scrollTo('pricing')} className="block w-full text-start text-sm text-gray-300 py-2">מחירים</button>
            <button onClick={goLogin} className="block w-full text-start text-sm text-gray-300 py-2">התחברות</button>
            <button onClick={goRegister} className="w-full py-2.5 text-sm font-medium rounded-lg bg-[#00d4ff] text-black">התחל חינם</button>
          </div>
        )}
      </nav>

      {/* ═══════════ BETA CTA BANNER ═══════════ */}
      <div className="fixed top-[57px] w-full z-40 bg-gradient-to-r from-indigo-600/90 to-cyan-500/90 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-2 flex items-center justify-center gap-3 text-sm">
          <span className="text-white/90">הצטרפו לבטא הסגורה — מקומות מוגבלים!</span>
          <button
            onClick={() => navigate('/beta')}
            className="px-4 py-1 rounded-full bg-white/20 hover:bg-white/30 text-white text-xs font-bold transition-all border border-white/20"
          >
            הצטרף עכשיו
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════════
          HERO
          ═══════════════════════════════════════════════════════════════════════════ */}
      <section className="relative pt-36 md:pt-44 pb-20 md:pb-32 px-6 overflow-hidden">
        {/* Background effects */}
        <StarField />
        <FloatingParticles />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#00d4ff]/[0.04] rounded-full blur-[150px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#0a0e1a] to-transparent pointer-events-none z-10" />

        <div className="max-w-7xl mx-auto relative z-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">

            {/* Text content */}
            <div className="text-center lg:text-start">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#00d4ff]/[0.08] border border-[#00d4ff]/20 text-[#00d4ff] text-xs tracking-wide mb-8 landing-eyebrow">
                <Zap className="w-3.5 h-3.5" />
                <span>מודיעין עסקי בזמן אמת</span>
              </div>

              <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold leading-[1.15] mb-6">
                <span className="block text-white">הרשת יודעת הכל</span>
                <span className="block text-white">על העסק שלך.</span>
                <span className="block bg-gradient-to-l from-[#00d4ff] to-[#0066cc] bg-clip-text text-transparent">האם אתה?</span>
              </h1>

              <p className="text-lg text-gray-400 mb-10 max-w-lg mx-auto lg:mx-0 leading-relaxed">
                Quieteyes סורקת את הרשת 24/7 ומספקת לך
                מודיעין, לידים וטרנדים — בזמן שאתה ישן.
              </p>

              <div className="flex items-center justify-center lg:justify-start gap-4 flex-wrap">
                <button
                  onClick={goRegister}
                  className="px-8 py-3.5 bg-[#00d4ff] hover:bg-[#00bfe0] text-black rounded-xl text-base font-bold transition-all shadow-[0_0_30px_rgba(0,212,255,0.3)] hover:shadow-[0_0_50px_rgba(0,212,255,0.4)] hover:-translate-y-0.5"
                >
                  התחל 14 יום חינם
                </button>
                <button
                  onClick={() => scrollTo('how-it-works')}
                  className="px-8 py-3.5 bg-transparent hover:bg-white/5 rounded-xl text-base font-medium transition-all border border-white/10 hover:border-white/20 text-gray-300"
                >
                  ראה הדגמה
                </button>
              </div>

              {/* Social proof */}
              <div className="mt-8 flex items-center justify-center lg:justify-start gap-3">
                <div className="flex -space-x-2 rtl:space-x-reverse">
                  {['from-blue-400 to-blue-600', 'from-emerald-400 to-emerald-600', 'from-cyan-400 to-cyan-600', 'from-amber-400 to-amber-600'].map((g, i) => (
                    <div key={i} className={`w-7 h-7 rounded-full bg-gradient-to-br ${g} border-2 border-[#0a0e1a] flex items-center justify-center`}>
                      <Users className="w-3 h-3 text-white" />
                    </div>
                  ))}
                </div>
                <span className="text-sm text-gray-400">
                  מצטרפים ל-<span className="text-white font-medium">127+</span> עסקים שכבר רואים יותר
                </span>
              </div>
            </div>

            {/* Dashboard mockup */}
            <div className="hidden lg:block relative">
              {/* Floating notification cards */}
              <div className="absolute -top-4 -right-6 z-20 landing-float-card landing-float-1">
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/25 backdrop-blur-md shadow-lg shadow-emerald-500/10">
                  <Target className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-xs text-emerald-300 whitespace-nowrap">ליד חדש נמצא!</span>
                </div>
              </div>
              <div className="absolute top-1/3 -left-10 z-20 landing-float-card landing-float-2">
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/15 border border-amber-500/25 backdrop-blur-md shadow-lg shadow-amber-500/10">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-xs text-amber-300 whitespace-nowrap">מתחרה שינה מחיר</span>
                </div>
              </div>
              <div className="absolute -bottom-3 right-12 z-20 landing-float-card landing-float-3">
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-500/15 border border-blue-500/25 backdrop-blur-md shadow-lg shadow-blue-500/10">
                  <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-xs text-blue-300 whitespace-nowrap">הדירוג שלך עלה!</span>
                </div>
              </div>
              <div className="scale-105">
                <DashboardMockup />
              </div>
            </div>
          </div>

          {/* Trust badges */}
          <div className="mt-16 flex items-center justify-center gap-8 text-xs text-gray-500">
            <span className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5" /> הצפנת AES-256</span>
            <span className="flex items-center gap-1.5"><Eye className="w-3.5 h-3.5" /> OSINT בלבד</span>
            <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5" /> ללא התחייבות</span>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════════
          LIVE TICKER
          ═══════════════════════════════════════════════════════════════════════════ */}
      <div className="relative overflow-hidden border-y border-white/[0.04] bg-white/[0.015]">
        <div className="landing-ticker flex gap-16 py-3 whitespace-nowrap">
          {[
            '🎯 ליד חדש — "מחפש שירותי עיצוב באזור המרכז"',
            '📊 מתחרה עדכן מחירים — ירידה של 12%',
            '⚡ 3 הזדמנויות חדשות בפייסבוק',
            '🔍 סריקה הושלמה — 8 תובנות חדשות',
            '📈 הדירוג שלך עלה ב-0.2 נקודות',
            '🎯 ליד חדש — "צריך הצעת מחיר לאירוע בתל אביב"',
            '🔔 מתחרה חדש נכנס לשוק שלך',
            '📊 דו"ח שבועי מוכן — 5 המלצות פעולה',
            '🎯 ליד חדש — "מחפש שירותי עיצוב באזור המרכז"',
            '📊 מתחרה עדכן מחירים — ירידה של 12%',
            '⚡ 3 הזדמנויות חדשות בפייסבוק',
            '🔍 סריקה הושלמה — 8 תובנות חדשות',
            '📈 הדירוג שלך עלה ב-0.2 נקודות',
            '🎯 ליד חדש — "צריך הצעת מחיר לאירוע בתל אביב"',
            '🔔 מתחרה חדש נכנס לשוק שלך',
            '📊 דו"ח שבועי מוכן — 5 המלצות פעולה',
          ].map((item, i) => (
            <span key={i} className="text-xs text-gray-500 flex items-center gap-2 flex-shrink-0">
              {item}
            </span>
          ))}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════════
          PROBLEM SECTION
          ═══════════════════════════════════════════════════════════════════════════ */}
      <section className="py-20 md:py-28 px-6 reveal">
        <div className="max-w-6xl mx-auto">
          <div className="relative rounded-3xl border border-red-500/15 bg-gradient-to-br from-red-900/20 via-red-500/[0.06] to-transparent p-8 md:p-14 overflow-hidden">
            {/* Dramatic red glow effects */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-red-500/[0.08] rounded-full blur-[150px] pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-72 h-72 bg-red-600/[0.05] rounded-full blur-[120px] pointer-events-none" />

            <div className="relative z-10 text-center mb-12">
              <h2 className="text-3xl md:text-5xl font-bold mb-4">
                בזמן שאתה עסוק בניהול העסק...
              </h2>
              <p className="text-gray-400 text-lg max-w-2xl mx-auto">
                המתחרים שלך זזים. מחירים משתנים. לידים נעלמים. ואתה? מפספס הכל.
              </p>
            </div>

            <div className="relative z-10 grid md:grid-cols-12 gap-6 items-start">
              {/* Pain cards */}
              <div className="md:col-span-7 grid gap-4 reveal-stagger">
                {[
                  { icon: Users, title: 'מתחרים חדשים נכנסים לשוק', desc: 'ואתה שומע על זה רק כשהלקוחות כבר עברו אליהם.', stat: '67%', statLabel: 'מהעסקים לא יודעים על מתחרים חדשים' },
                  { icon: Target, title: 'הזדמנויות עוברות בשקט', desc: 'לידים חמים בפורומים וברשתות — ואף אחד מהצוות לא רואה אותם.', stat: '12', statLabel: 'לידים חמים אבודים בשבוע בממוצע' },
                  { icon: Search, title: 'שעות של מחקר ידני', desc: 'במקום לנהל את העסק, אתה מבזבז זמן על חיפושים ידניים.', stat: '6+', statLabel: 'שעות שבועיות על מחקר ידני' },
                ].map((item, i) => {
                  const Icon = item.icon;
                  return (
                    <div key={i} className="reveal-child p-6 rounded-2xl bg-[#0d1117]/80 border border-red-500/10 hover:border-red-500/25 transition-all group">
                      <div className="flex items-start gap-5">
                        <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center flex-shrink-0 group-hover:bg-red-500/15 transition-colors">
                          <Icon className="w-7 h-7 text-red-400" />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-base font-semibold mb-1.5 text-white">{item.title}</h3>
                          <p className="text-gray-400 text-sm leading-relaxed mb-3">{item.desc}</p>
                          <div className="flex items-center gap-2">
                            <span className="text-2xl font-bold text-red-400" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{item.stat}</span>
                            <span className="text-xs text-gray-500">{item.statLabel}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* WhatsApp phone mockup */}
              <div className="md:col-span-5 hidden md:flex justify-center reveal-child">
                <div className="w-[260px] rounded-[32px] bg-[#0a0a0a] border border-gray-700/40 p-2 shadow-2xl shadow-black/50">
                  <div className="rounded-[24px] overflow-hidden bg-[#111b21] h-[380px] flex flex-col">
                    {/* WhatsApp header */}
                    <div className="bg-[#1f2c33] px-3 py-2.5 flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-emerald-500/20 flex items-center justify-center">
                        <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                      </div>
                      <div className="flex-1">
                        <span className="text-[10px] text-white font-medium block">הודעות עסקיות</span>
                        <span className="text-[8px] text-gray-400">5 הודעות שלא נקראו</span>
                      </div>
                      <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
                        <span className="text-[8px] text-white font-bold">5</span>
                      </div>
                    </div>
                    {/* Messages */}
                    <div className="flex-1 p-3 space-y-2.5 overflow-hidden" dir="rtl">
                      {[
                        { msg: 'הי, אתם עושים גם עיצוב לוגו? מחפש מישהו דחוף', time: '09:14', unread: true },
                        { msg: 'ראיתי שהמתחרה שלכם מציע הנחה של 20%. מעניין אותי לשמוע הצעה', time: '10:22', unread: true },
                        { msg: 'צריך הצעת מחיר לאירוע בתל אביב בשבוע הבא', time: '11:45', unread: true },
                        { msg: 'מחפש שירות דומה לשלכם באזור המרכז', time: '13:01', unread: true },
                        { msg: 'שלום, ניסיתי להתקשר ולא ענו. עדיין פעילים?', time: '14:33', unread: true },
                      ].map((m, i) => (
                        <div key={i} className="bg-[#1a2e35] rounded-lg px-3 py-2 max-w-[95%] relative opacity-80">
                          <p className="text-[10px] text-gray-300 leading-relaxed">{m.msg}</p>
                          <div className="flex items-center justify-end gap-1 mt-1">
                            <span className="text-[8px] text-gray-500">{m.time}</span>
                            {m.unread && <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                          </div>
                        </div>
                      ))}
                    </div>
                    {/* Bottom label */}
                    <div className="bg-red-500/10 border-t border-red-500/20 px-3 py-2 text-center">
                      <span className="text-[9px] text-red-400 font-medium">5 הזדמנויות שפספסת השבוע</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════════
          SOLUTION SECTION
          ═══════════════════════════════════════════════════════════════════════════ */}
      <section className="py-20 md:py-28 px-6 reveal">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-3">
            <span className="text-[#00d4ff]">Quieteyes</span> רואה בשבילך
          </h2>
          <p className="text-gray-400 text-lg mb-14 max-w-2xl mx-auto">
            מודיעין עסקי אוטומטי שעובד 24/7 — כדי שתקבל תמונה ברורה בלי מאמץ
          </p>

          <div className="grid md:grid-cols-2 gap-5 reveal-stagger">

            {/* Card 1: Competitor Scanning — mini comparison table */}
            <div className="reveal-child p-7 rounded-2xl bg-[#0d1117]/60 border border-white/[0.04] hover:border-[#00d4ff]/30 transition-all duration-300 text-start group hover:-translate-y-1 hover:shadow-[0_0_40px_rgba(0,212,255,0.06)]">
              <div className="w-12 h-12 rounded-xl bg-[#00d4ff]/[0.08] flex items-center justify-center mb-5 text-[#00d4ff] group-hover:bg-[#00d4ff]/15 transition-colors">
                <Search className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold mb-2">סריקת מתחרים</h3>
              <p className="text-gray-400 text-sm leading-relaxed mb-5">ניטור אוטומטי של מחירים, מוצרים, ביקורות ואסטרטגיות של כל מתחרה בשוק שלך.</p>
              {/* Mini comparison table preview */}
              <div className="rounded-xl bg-[#0a0e1a]/80 border border-white/[0.06] overflow-hidden text-[10px]">
                <div className="grid grid-cols-4 gap-0 border-b border-white/[0.06] px-3 py-2 text-gray-500">
                  <span>מתחרה</span><span>מחיר</span><span>דירוג</span><span>שינוי</span>
                </div>
                {[
                  { name: 'העסק שלך', price: '₪149', rating: '4.7', change: '—', highlight: true },
                  { name: 'מתחרה א׳', price: '₪169', rating: '4.2', change: '↑12%', changeColor: 'text-red-400' },
                  { name: 'מתחרה ב׳', price: '₪129', rating: '4.5', change: '↓8%', changeColor: 'text-emerald-400' },
                ].map((row, i) => (
                  <div key={i} className={`grid grid-cols-4 gap-0 px-3 py-1.5 ${row.highlight ? 'bg-[#00d4ff]/[0.06] text-[#00d4ff]' : 'text-gray-400'}`}>
                    <span className="font-medium">{row.name}</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{row.price}</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{row.rating}</span>
                    <span className={row.changeColor || ''} style={{ fontFamily: "'JetBrains Mono', monospace" }}>{row.change}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Card 2: Lead Discovery — mini Facebook/forum post mockup */}
            <div className="reveal-child p-7 rounded-2xl bg-[#0d1117]/60 border border-white/[0.04] hover:border-[#00d4ff]/30 transition-all duration-300 text-start group hover:-translate-y-1 hover:shadow-[0_0_40px_rgba(0,212,255,0.06)]">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/[0.08] flex items-center justify-center mb-5 text-emerald-400 group-hover:bg-emerald-500/15 transition-colors">
                <Target className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold mb-2">גילוי לידים חכם</h3>
              <p className="text-gray-400 text-sm leading-relaxed mb-5">זיהוי לידים חמים מפורומים, רשתות חברתיות וקבוצות — ישירות לדשבורד שלך.</p>
              {/* Mini Facebook post mockup */}
              <div className="rounded-xl bg-[#0a0e1a]/80 border border-white/[0.06] p-3 space-y-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <span className="text-[8px] text-blue-400 font-bold">f</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-300 block leading-none">קבוצת עסקים — תל אביב</span>
                    <span className="text-[8px] text-gray-500">לפני 12 דקות</span>
                  </div>
                </div>
                <p className="text-[10px] text-gray-400 leading-relaxed" dir="rtl">
                  מישהו מכיר חברה טובה לעיצוב גרפי? צריך לוגו + קמפיין לעסק חדש. תקציב סביר, עדיפות לאזור המרכז 🙏
                </p>
                <div className="flex items-center gap-2 pt-1 border-t border-white/[0.04]">
                  <div className="flex-1 flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20">
                    <Target className="w-2.5 h-2.5 text-emerald-400" />
                    <span className="text-[8px] text-emerald-400 font-medium">ליד חם — 92% התאמה</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 3: AI COO Chat — mini chat bubble UI */}
            <div className="reveal-child p-7 rounded-2xl bg-[#0d1117]/60 border border-white/[0.04] hover:border-cyan-500/30 transition-all duration-300 text-start group hover:-translate-y-1 hover:shadow-[0_0_40px_rgba(0,212,255,0.06)]">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/[0.08] flex items-center justify-center mb-5 text-cyan-400 group-hover:bg-cyan-500/15 transition-colors">
                <MessageSquare className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold mb-2">AI COO — יועץ אישי</h3>
              <p className="text-gray-400 text-sm leading-relaxed mb-5">צ׳אט חכם שמכיר את העסק שלך לעומק ונותן המלצות אקטיביות מבוססות נתונים.</p>
              {/* Mini chat bubble preview */}
              <div className="rounded-xl bg-[#0a0e1a]/80 border border-white/[0.06] p-3 space-y-2" dir="rtl">
                <div className="flex justify-end">
                  <div className="bg-cyan-500/15 border border-cyan-500/20 rounded-xl rounded-tl-sm px-3 py-1.5 max-w-[80%]">
                    <p className="text-[10px] text-gray-300">מה המצב עם המתחרים שלי השבוע?</p>
                  </div>
                </div>
                <div className="flex justify-start">
                  <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl rounded-tr-sm px-3 py-1.5 max-w-[85%]">
                    <p className="text-[10px] text-gray-300 leading-relaxed">זיהיתי 3 שינויים מרכזיים: מתחרה א׳ הוריד מחיר ב-15%, מתחרה ב׳ השיק מוצר חדש, ויש לך הזדמנות לתפוס 8 לידים חמים. מומלץ לפעול היום.</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 pt-1">
                  <div className="w-1 h-1 rounded-full bg-cyan-400 animate-pulse" />
                  <div className="w-1 h-1 rounded-full bg-cyan-400 animate-pulse" style={{ animationDelay: '0.2s' }} />
                  <div className="w-1 h-1 rounded-full bg-cyan-400 animate-pulse" style={{ animationDelay: '0.4s' }} />
                </div>
              </div>
            </div>

            {/* Card 4: Daily Briefing — mini report/trend preview */}
            <div className="reveal-child p-7 rounded-2xl bg-[#0d1117]/60 border border-white/[0.04] hover:border-amber-500/30 transition-all duration-300 text-start group hover:-translate-y-1 hover:shadow-[0_0_40px_rgba(245,158,11,0.06)]">
              <div className="w-12 h-12 rounded-xl bg-amber-500/[0.08] flex items-center justify-center mb-5 text-amber-400 group-hover:bg-amber-500/15 transition-colors">
                <BarChart3 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold mb-2">תדריך יומי</h3>
              <p className="text-gray-400 text-sm leading-relaxed mb-5">כל בוקר מקבלים סיכום קצר עם מה שהשתנה בשוק, מה דורש תשומת לב ומה ההזדמנות.</p>
              {/* Mini daily brief preview */}
              <div className="rounded-xl bg-[#0a0e1a]/80 border border-white/[0.06] overflow-hidden">
                <div className="px-3 py-2 border-b border-white/[0.06] flex items-center justify-between">
                  <span className="text-[10px] text-gray-400">תדריך בוקר — 24.02.2026</span>
                  <span className="text-[8px] px-1.5 py-0.5 bg-emerald-500/15 text-emerald-400 rounded-full">5 עדכונים</span>
                </div>
                <div className="p-3 space-y-2">
                  {/* Mini trend chart */}
                  <svg viewBox="0 0 180 32" className="w-full h-6">
                    <polyline points="0,28 20,24 40,26 60,18 80,20 100,14 120,16 140,8 160,12 180,6" fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    <polyline points="0,28 20,24 40,26 60,18 80,20 100,14 120,16 140,8 160,12 180,6 180,32 0,32" fill="url(#brief-fill)" />
                    <defs>
                      <linearGradient id="brief-fill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.15" />
                        <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                  </svg>
                  {/* Brief items */}
                  <div className="space-y-1.5">
                    {[
                      { color: 'bg-red-400', text: 'מתחרה הוריד מחיר — נדרשת תגובה' },
                      { color: 'bg-emerald-400', text: '3 לידים חמים ממתינים לפנייה' },
                      { color: 'bg-blue-400', text: 'דירוג Google עלה ל-4.7' },
                    ].map((item, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full ${item.color} flex-shrink-0`} />
                        <span className="text-[9px] text-gray-400">{item.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════════
          HOW IT WORKS
          ═══════════════════════════════════════════════════════════════════════════ */}
      <section id="how-it-works" className="py-20 md:py-28 px-6 reveal">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-3">איך זה עובד?</h2>
          <p className="text-gray-400 text-lg mb-16">שלושה צעדים פשוטים — ואתה בפנים</p>

          <div className="relative flex flex-col md:flex-row items-center md:items-start justify-center gap-12 md:gap-8 reveal-stagger">
            {/* Connecting line (desktop) */}
            <div className="hidden md:block absolute top-10 right-[calc(16.67%+24px)] left-[calc(16.67%+24px)] h-px bg-gradient-to-l from-[#00d4ff]/40 via-[#00d4ff]/20 to-[#00d4ff]/40" />

            {[
              { num: '1', title: 'הגדר את העסק', desc: 'ספר ל-Quieteyes על התחום, המתחרים וקהל היעד שלך.' },
              { num: '2', title: 'Quieteyes סורק', desc: 'המערכת סורקת מקורות פתוחים ומעבדת את המידע עם AI.' },
              { num: '3', title: 'קבל תובנות', desc: 'תדריכים, התראות והמלצות — ישירות לדשבורד ולמייל.' },
            ].map((step, i) => (
              <div key={i} className="reveal-child flex flex-col items-center text-center flex-1 relative z-10">
                <div className="w-20 h-20 rounded-full bg-[#0a0e1a] border border-[#00d4ff]/40 flex items-center justify-center text-2xl font-bold text-[#00d4ff] mb-5 shadow-[0_0_30px_rgba(0,212,255,0.1)]">
                  {step.num}
                </div>
                <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
                <p className="text-gray-400 text-sm max-w-[220px] leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════════
          SOCIAL PROOF
          ═══════════════════════════════════════════════════════════════════════════ */}
      <section className="py-20 md:py-28 px-6 reveal">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-center">מה אומרים עלינו</h2>

          {/* Live leads counter */}
          <div className="flex items-center justify-center gap-3 mb-14">
            <span className="w-2 h-2 rounded-full bg-emerald-400 pulse-dot inline-block" />
            <span className="text-gray-400 text-sm">
              <span ref={leadsCounter.ref} className="text-[#00d4ff] font-bold counter-up" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                {leadsCounter.value.toLocaleString()}
              </span>
              {' '}לידים נמצאו היום
            </span>
          </div>

          {/* Testimonials with avatar initials */}
          <div className="grid md:grid-cols-3 gap-5 mb-16 reveal-stagger">
            {TESTIMONIALS.map((t, i) => (
              <div key={i} className="reveal-child p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06] backdrop-blur-sm hover:border-white/10 transition-all group hover:-translate-y-1 hover:shadow-[0_0_40px_rgba(0,212,255,0.04)]">
                <div className="flex gap-0.5 mb-4">
                  {Array.from({ length: t.rating }, (_, j) => (
                    <Star key={j} className="w-4 h-4 text-amber-400 fill-amber-400" />
                  ))}
                </div>
                <p className="text-gray-300 text-sm leading-relaxed mb-6">"{t.quote}"</p>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${t.gradient} flex items-center justify-center shadow-lg`}>
                    <span className="text-white font-bold text-sm">{t.initial}</span>
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-white">{t.name}</p>
                    <p className="text-gray-500 text-xs">{t.biz}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Stats — bigger with icon backgrounds */}
          <div className="grid grid-cols-3 gap-4 md:gap-6 mb-16 reveal-stagger">
            {[
              { ref: stat1.ref, value: `${stat1.value}%`, label: 'חיסכון בזמן מחקר', icon: TrendingUp, color: 'from-cyan-500/15 to-blue-500/15', border: 'border-cyan-500/20', textColor: 'text-[#00d4ff]' },
              { ref: stat2.ref, value: `${stat2.value}x`, label: 'יותר לידים מזוהים', icon: Target, color: 'from-emerald-500/15 to-teal-500/15', border: 'border-emerald-500/20', textColor: 'text-emerald-400' },
              { ref: stat3.ref, value: `${stat3.value} שעות`, label: 'נחסכות כל יום', icon: Zap, color: 'from-amber-500/15 to-orange-500/15', border: 'border-amber-500/20', textColor: 'text-amber-400' },
            ].map((s, i) => {
              const Icon = s.icon;
              return (
                <div key={i} className={`reveal-child text-center p-6 md:p-8 rounded-2xl bg-gradient-to-br ${s.color} border ${s.border}`}>
                  <div className="flex justify-center mb-4">
                    <div className={`w-12 h-12 rounded-xl bg-white/[0.05] flex items-center justify-center ${s.textColor}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                  </div>
                  <span ref={s.ref} className={`text-4xl md:text-5xl font-extrabold ${s.textColor} counter-up block`} style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                    {s.value}
                  </span>
                  <p className="text-gray-400 text-sm mt-2">{s.label}</p>
                </div>
              );
            })}
          </div>

          {/* Industry logos / trust bar */}
          <div className="reveal text-center">
            <p className="text-gray-500 text-xs tracking-wider uppercase mb-6">מתאים לכל תעשייה</p>
            <div className="flex items-center justify-center gap-8 md:gap-12 flex-wrap">
              {[
                { label: 'מסעדנות', icon: '🍽️' },
                { label: 'נדל״ן', icon: '🏠' },
                { label: 'קמעונאות', icon: '🛍️' },
                { label: 'שירותים', icon: '⚙️' },
                { label: 'בריאות', icon: '🏥' },
                { label: 'חינוך', icon: '📚' },
              ].map((ind, i) => (
                <div key={i} className="flex flex-col items-center gap-1.5 opacity-40 hover:opacity-70 transition-opacity">
                  <span className="text-2xl">{ind.icon}</span>
                  <span className="text-[10px] text-gray-500">{ind.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════════
          PRICING
          ═══════════════════════════════════════════════════════════════════════════ */}
      <section id="pricing" className="py-20 md:py-28 px-6 reveal">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-3">תוכניות ומחירים</h2>
            <p className="text-gray-400 text-lg mb-8">בחר את התוכנית שמתאימה לעסק שלך</p>

            {/* Monthly / Yearly toggle */}
            <div className="inline-flex items-center gap-3 p-1 rounded-full bg-white/[0.04] border border-white/[0.06]">
              <button
                onClick={() => setIsYearly(false)}
                className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                  !isYearly ? 'bg-[#00d4ff]/15 text-[#00d4ff] border border-[#00d4ff]/30' : 'text-gray-400'
                }`}
              >
                חודשי
              </button>
              <button
                onClick={() => setIsYearly(true)}
                className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                  isYearly ? 'bg-[#00d4ff]/15 text-[#00d4ff] border border-[#00d4ff]/30' : 'text-gray-400'
                }`}
              >
                שנתי
                <span className="ms-1.5 text-[10px] text-emerald-400">חיסכון 20%</span>
              </button>
            </div>
          </div>

          <div className="grid md:grid-cols-4 gap-4 reveal-stagger">
            {TIERS.map((tier) => (
              <div
                key={tier.id}
                className={`reveal-child relative p-8 rounded-2xl border transition-all duration-300 ${
                  tier.popular
                    ? 'bg-[#00d4ff]/[0.04] border-[#00d4ff]/30 shadow-[0_0_60px_rgba(0,212,255,0.08)] scale-[1.02] md:-translate-y-2'
                    : 'bg-white/[0.02] border-white/[0.06] hover:border-white/10'
                }`}
              >
                {tier.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-[#00d4ff] text-black rounded-full text-xs font-bold shadow-[0_0_20px_rgba(0,212,255,0.3)]">
                    הכי פופולרי
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-0.5">{tier.nameHe}</h3>
                  <p className="text-xs text-gray-500">{tier.name}</p>
                </div>

                <div className="mb-6">
                  <span className="text-4xl font-bold" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                    {isYearly ? tier.yearlyLabel : tier.label}
                  </span>
                  {tier.price > 0 && <span className="text-gray-400 text-sm me-1">/ חודש</span>}
                </div>

                <ul className="space-y-3 mb-8">
                  {tier.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2.5 text-sm text-gray-300">
                      <Check className="w-4 h-4 text-[#00d4ff] shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => goRegisterWithPlan(tier.id)}
                  className={`w-full py-3 rounded-xl text-sm font-bold transition-all ${
                    tier.popular
                      ? 'bg-[#00d4ff] hover:bg-[#00bfe0] text-black shadow-[0_0_20px_rgba(0,212,255,0.2)] hover:shadow-[0_0_30px_rgba(0,212,255,0.3)]'
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

      {/* ═══════════════════════════════════════════════════════════════════════════
          FAQ
          ═══════════════════════════════════════════════════════════════════════════ */}
      <section className="py-20 md:py-28 px-6 reveal">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold mb-12 text-center">שאלות נפוצות</h2>

          <div className="space-y-0">
            {FAQ_ITEMS.map((item, i) => (
              <div key={i} className="border-b border-white/[0.06] last:border-b-0">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between py-5 text-start group"
                >
                  <span className="font-medium text-sm text-gray-200 group-hover:text-white transition-colors">{item.q}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-gray-500 shrink-0 ms-4 transition-transform duration-300 ${
                      openFaq === i ? 'rotate-180 text-[#00d4ff]' : ''
                    }`}
                  />
                </button>
                <div
                  className="transition-all duration-300 overflow-hidden"
                  style={{ maxHeight: openFaq === i ? '200px' : '0px' }}
                >
                  <p className="pb-5 text-gray-400 text-sm leading-relaxed">{item.a}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════════
          FOOTER CTA
          ═══════════════════════════════════════════════════════════════════════════ */}
      <section className="py-20 md:py-28 px-6 reveal">
        <div className="max-w-4xl mx-auto text-center relative">
          {/* Background glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-[#00d4ff]/[0.05] rounded-full blur-[120px] pointer-events-none" />

          <div className="relative z-10">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              מוכן להפסיק לפספס הזדמנויות?
            </h2>
            <p className="text-gray-400 text-lg mb-10 max-w-xl mx-auto">
              הצטרף ל-127+ עסקים שכבר משתמשים ב-Quieteyes כדי לזהות הזדמנויות לפני כולם
            </p>
            <button
              onClick={goRegister}
              className="px-12 py-4 bg-[#00d4ff] hover:bg-[#00bfe0] text-black rounded-xl text-lg font-bold transition-all shadow-[0_0_40px_rgba(0,212,255,0.3)] hover:shadow-[0_0_60px_rgba(0,212,255,0.4)] hover:-translate-y-1"
            >
              התחל עכשיו — בחינם
            </button>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════════
          FOOTER
          ═══════════════════════════════════════════════════════════════════════════ */}
      <footer className="py-8 px-6 border-t border-white/[0.04]">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-sm text-gray-500">
          <div className="flex items-center gap-2">
            <img src="/logo-icon-only.svg" alt="" className="w-5 h-5 opacity-50" />
            <span>Quieteyes &copy; 2026</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="#" className="hover:text-gray-300 transition-colors">תנאי שימוש</a>
            <a href="#" className="hover:text-gray-300 transition-colors">פרטיות</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
