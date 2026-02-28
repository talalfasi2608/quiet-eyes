import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import FadeInSection from '../../components/marketing/FadeInSection';
import useSEO from '../../hooks/useSEO';

/* ── Count-up animation ── */
function CountUp({ target, suffix = '', prefix = '' }: { target: number; suffix?: string; prefix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && !started.current) {
          started.current = true;
          const steps = 60;
          const inc = target / steps;
          let cur = 0;
          const timer = setInterval(() => {
            cur += inc;
            if (cur >= target) { setCount(target); clearInterval(timer); }
            else setCount(Math.floor(cur));
          }, 2000 / steps);
        }
      },
      { threshold: 0.3 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [target]);

  return (
    <span ref={ref} style={{ fontFamily: "'JetBrains Mono', monospace" }}>
      {prefix}{count.toLocaleString()}{suffix}
    </span>
  );
}

/* ── Dashboard mockup ── */
function DashboardMockup() {
  return (
    <div className="relative w-full max-w-[480px] mx-auto" role="img" aria-label="מודיעין עסקי לעסקים קטנים - Quieteyes">
      <style>{`
        @keyframes mockFadeIn { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }
        @keyframes pulseDot { 0%,100% { opacity:1; transform:scale(1) } 50% { opacity:.4; transform:scale(1.6) } }
      `}</style>
      <div className="rounded" style={{ background: '#0d1526', border: '1px solid rgba(30,45,69,0.5)', overflow: 'hidden', boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }}>
        <div className="flex items-center gap-1.5 px-3 py-2" style={{ background: '#080c16', borderBottom: '1px solid rgba(30,45,69,0.3)' }}>
          <div className="w-2 h-2 rounded-full" style={{ background: '#ff4466', opacity: 0.6 }} />
          <div className="w-2 h-2 rounded-full" style={{ background: '#ffaa00', opacity: 0.6 }} />
          <div className="w-2 h-2 rounded-full" style={{ background: '#00ff88', opacity: 0.6 }} />
          <span className="mr-3" style={{ fontSize: 9, color: '#4a5568', fontFamily: "'JetBrains Mono', monospace" }}>quieteyes.co.il/dashboard</span>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex gap-3">
            <div className="w-20 h-20 rounded flex flex-col items-center justify-center" style={{ background: '#111827', border: '1px solid rgba(30,45,69,0.3)', animation: 'mockFadeIn 0.8s ease 0.3s both' }}>
              <span className="text-2xl font-bold" style={{ color: '#00ff88', fontFamily: "'JetBrains Mono', monospace" }}>78</span>
              <span style={{ fontSize: 8, color: '#8899aa' }}>Health</span>
            </div>
            <div className="flex-1 space-y-2">
              <div className="rounded p-2" style={{ background: '#111827', border: '1px solid rgba(30,45,69,0.3)', animation: 'mockFadeIn 0.6s ease 0.6s both' }}>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: '#ff4466' }} />
                  <span style={{ fontSize: 9, color: '#f0f4ff', fontWeight: 600 }}>מתחרה חדש זוהה</span>
                </div>
                <p style={{ fontSize: 8, color: '#4a5568', marginTop: 2 }}>CoffeeX פתח סניף חדש בקרבת מקום</p>
              </div>
              <div className="rounded p-2" style={{ background: '#111827', border: '1px solid rgba(30,45,69,0.3)', animation: 'mockFadeIn 0.6s ease 0.9s both' }}>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: '#00d4ff' }} />
                  <span style={{ fontSize: 9, color: '#f0f4ff', fontWeight: 600 }}>ליד חם — ציון 94</span>
                </div>
                <p style={{ fontSize: 8, color: '#4a5568', marginTop: 2 }}>מישהו מחפש "קפה ליד רוטשילד"</p>
              </div>
            </div>
          </div>
          <div className="rounded h-24 relative overflow-hidden" style={{ background: '#111827', border: '1px solid rgba(30,45,69,0.3)', animation: 'mockFadeIn 0.6s ease 1.2s both' }}>
            <div className="absolute inset-0" style={{ opacity: 0.15, backgroundImage: 'linear-gradient(rgba(0,212,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,0.4) 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
            {[
              { top: 20, right: 48, color: '#00d4ff', delay: '0s' },
              { top: 40, right: 96, color: '#ff4466', delay: '0.5s' },
              { top: 16, right: 128, color: '#ff4466', delay: '1s' },
              { top: 56, right: 80, color: '#00ff88', delay: '0.3s' },
              { top: 32, right: 160, color: '#ffaa00', delay: '0.7s' },
            ].map((d, i) => (
              <div key={i} className="absolute w-2 h-2 rounded-full" style={{ top: d.top, right: d.right, background: d.color, animation: `pulseDot 2s infinite ${d.delay}` }} />
            ))}
            <span className="absolute bottom-1.5 left-2" style={{ fontSize: 8, color: '#4a5568' }}>4 מתחרים בסביבה</span>
          </div>
          <div className="flex justify-between rounded p-2" style={{ background: '#111827', border: '1px solid rgba(30,45,69,0.3)', animation: 'mockFadeIn 0.6s ease 1.5s both' }}>
            {[
              { val: '12', label: 'לידים', color: '#00d4ff' },
              { val: '7', label: 'איומים', color: '#ff4466' },
              { val: '94%', label: 'דיוק', color: '#00ff88' },
            ].map((s, i) => (
              <div key={i} className="text-center">
                <div className="text-xs font-bold" style={{ color: s.color, fontFamily: "'JetBrains Mono', monospace" }}>{s.val}</div>
                <div style={{ fontSize: 7, color: '#4a5568' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── WhatsApp-style chat bubble ── */
function WhatsAppBubble({ message }: { message: string }) {
  return (
    <div className="mt-4 rounded-lg p-3" style={{ background: '#f0f4f0', maxWidth: '100%' }}>
      <p className="text-[10px] font-bold mb-1" style={{ color: '#00d4ff' }}>Quieteyes</p>
      <p className="text-xs leading-relaxed" style={{ color: '#1a1a1a', direction: 'rtl' }}>{message}</p>
      <p className="text-[9px] text-left mt-1" style={{ color: '#999' }}>08:02 ✓✓</p>
    </div>
  );
}

/* ══════════════════════════════════════════════════ */

export default function Home() {
  useSEO(
    'Quieteyes | מודיעין עסקי חכם — 6 עוזרים שעובדים בשבילך 24/7',
    'Quieteyes היא פלטפורמת המודיעין העסקי הראשונה בישראל. 6 עוזרים חכמים סורקים את השוק, מוצאים לידים, עוקבים אחרי מתחרים ושולחים לך הכל לוואטסאפ. נסיון חינם 14 יום.'
  );

  const helpers = [
    {
      emoji: '👁️',
      name: 'עיני',
      tagline: 'עוקב בשבילך על מה שקורה בחוץ',
      desc: 'סורק רשתות חברתיות, פורומים וקבוצות ומוצא אנשים שמחפשים בדיוק את מה שאתה נותן. בזמן אמת.',
      whatsapp: 'מצאתי מישהו שמחפש בדיוק מה שאתה נותן. פרסם לפני 4 דקות. יש לך חלון של 20 דקות 🎯',
    },
    {
      emoji: '🧠',
      name: 'המוח',
      tagline: 'חושב בשבילך כשאתה עסוק',
      desc: 'מנתח את כל הנתונים, מזהה דפוסים, ונותן לך כל בוקר 3 משימות בסדר עדיפות שיזיזו את העסק קדימה.',
      whatsapp: 'שמתי לב שאתה מפספס לידים בין 14:00-16:00. רוצה שנתקן את זה? 💡',
    },
    {
      emoji: '📢',
      name: 'הקול',
      tagline: 'מדבר ללקוחות שלך כשאין לך זמן',
      desc: 'מנתח מה עובד בתעשייה שלך, מה המתחרים לא מדברים עליו, ומכין לך תוכן שממצב אותך כמומחה.',
      whatsapp: 'המתחרים שלך לא מדברים על [נושא]. כתבתי לך 3 פוסטים שיהפכו אותך למומחה בנושא הזה תוך חודש 📢',
    },
    {
      emoji: '💰',
      name: 'הכיס',
      tagline: 'שומר שלא תפספס אף שקל',
      desc: 'מזהה הזדמנויות הכנסה, עונתיות, ודפוסי קנייה של הלקוחות שלך. מתריע לפני ירידות ומציע תוכניות.',
      whatsapp: 'בפברואר תמיד יש ירידה של 23% אצלך. יש לי תוכנית שתמנע את זה השנה. רוצה לראות? 💰',
    },
    {
      emoji: '👂',
      name: 'האוזן',
      tagline: 'מקשיב ללקוחות שלך בשבילך',
      desc: 'עוקב אחרי ביקורות, תלונות, ומגמות דעת קהל בתעשייה שלך. יודע מה הלקוחות רוצים לפני שהם אומרים.',
      whatsapp: '31% מהלקוחות באזורך רוצים הזמנה בוואטסאפ. אף מתחרה לא נותן את זה עדיין 👂',
    },
    {
      emoji: '🔭',
      name: 'הטווח',
      tagline: 'מסתכל לאן השוק הולך',
      desc: 'מזהה מגמות שמגיעות לאזורך, טכנולוגיות חדשות, ושינויים בהתנהגות צרכנים. נותן לך יתרון של שבועות.',
      whatsapp: 'המגמה הזו הגיעה לחיפה לפני 6 שבועות. עכשיו היא מגיעה לאזורך. הכנתי לך תוכנית 🔭',
    },
  ];

  const testimonials = [
    {
      quote: 'לפני Quieteyes הייתי מגלה על מבצעים של מתחרים רק כשלקוחות עזבו. עכשיו אני יודע מראש ומגיב. המסעדה מרגישה אחרת לגמרי.',
      name: 'יוסי כהן',
      role: 'בעל מסעדה',
      city: 'חיפה',
      badge: 'מפספס פחות ₪8,000 בחודש',
    },
    {
      quote: 'העוזרים של Quieteyes מצאו לי לקוחות שחיפשו קוסמטיקאית באזור שלי ברשתות החברתיות. הגעתי אליהן תוך דקות. הן לא האמינו כמה מהר הגבתי.',
      name: 'שרה לוי',
      role: 'קוסמטיקאית',
      city: 'תל אביב',
      badge: '+11 לקוחות חדשות בחודש',
    },
    {
      quote: 'הטווח התריע שמגמת ריהוט סקנדינבי מגיעה לאזור שלי שבועיים לפני כולם. הכנתי מלאי, עשיתי פוסטים, והייתי הראשון. רבעון שיא.',
      name: 'דני אברהם',
      role: 'חנות ריהוט',
      city: 'ראשל"צ',
      badge: '+23% לקוחות חדשים ברבעון',
    },
  ];

  return (
    <>
      {/* Schema markup */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        "name": "Quieteyes",
        "description": "פלטפורמת מודיעין עסקי חכמה עם 6 עוזרים אוטומטיים לעסקים קטנים ובינוניים בישראל",
        "applicationCategory": "BusinessApplication",
        "offers": { "@type": "AggregateOffer", "lowPrice": "0", "highPrice": "449", "priceCurrency": "ILS" },
        "inLanguage": "he",
        "availableLanguage": "Hebrew",
      })}} />

      {/* ─── HERO ─── */}
      <section
        className="relative min-h-screen flex items-center pt-16"
        style={{ backgroundImage: 'radial-gradient(circle, rgba(0,212,255,0.08) 1px, transparent 1px)', backgroundSize: '32px 32px' }}
      >
        <div className="max-w-[1200px] mx-auto px-6 py-20 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <h1 className="text-4xl md:text-6xl lg:text-[68px] font-extrabold leading-[1.08] mb-6" style={{ letterSpacing: '-0.03em', color: '#f0f4ff' }}>
              תדע מה קורה בעסק שלך
              <br />
              גם כשאתה לא מסתכל
            </h1>
            <p className="text-lg md:text-xl leading-relaxed mb-8 max-w-lg" style={{ color: '#8899aa' }}>
              6 עוזרים חכמים עובדים בשבילך 24 שעות.
              <br />
              אתה מקבל את מה שחשוב — ישירות לוואטסאפ.
            </p>
            <div className="flex flex-wrap gap-4 mb-6">
              <Link
                to="/register"
                className="px-7 py-3 text-sm font-bold rounded transition-colors duration-200"
                style={{ background: '#00d4ff', color: '#0a0e1a' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#00bfe6')}
                onMouseLeave={e => (e.currentTarget.style.background = '#00d4ff')}
              >
                התחל חינם — 14 יום ללא כרטיס אשראי
              </Link>
              <Link
                to="/features"
                className="px-7 py-3 text-sm font-medium rounded transition-colors duration-200"
                style={{ border: '1px solid rgba(0,212,255,0.4)', color: '#00d4ff' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,212,255,0.1)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                {'ראה איך זה עובד \u2190'}
              </Link>
            </div>
            <p className="text-xs" style={{ color: '#4a5568' }}>
              כבר 2,847 בעלי עסקים בישראל יודעים מה קורה בשוק שלהם. בזמן אמת.
            </p>
          </div>
          <div className="hidden md:block">
            <DashboardMockup />
          </div>
        </div>
      </section>

      {/* ─── STATS BAR ─── */}
      <section style={{ background: '#0d1526', borderTop: '1px solid rgba(30,45,69,0.3)', borderBottom: '1px solid rgba(30,45,69,0.3)' }}>
        <div className="max-w-[1200px] mx-auto px-6 py-12 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { value: 2847, label: 'עסקים פעילים' },
            { value: 156000, label: 'לידים שנמצאו', suffix: '+' },
            { value: 94, label: 'מדויקות', suffix: '%' },
            { value: 3200, label: 'ממוצע הזדמנויות שבועיות', prefix: '₪' },
          ].map((s, i) => (
            <div key={i}>
              <div className="text-3xl md:text-4xl font-extrabold mb-1" style={{ color: '#f0f4ff' }}>
                <CountUp target={s.value} suffix={s.suffix || ''} prefix={s.prefix || ''} />
              </div>
              <div className="text-sm" style={{ color: '#8899aa' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── PROBLEM ─── */}
      <section className="py-24">
        <div className="max-w-[1200px] mx-auto px-6">
          <FadeInSection>
            <h2 className="text-3xl md:text-5xl font-extrabold text-center mb-16" style={{ letterSpacing: '-0.03em', color: '#f0f4ff' }}>
              בעל עסק טוב לא אמור לנחש
            </h2>
          </FadeInSection>

          <div className="grid md:grid-cols-3 gap-8 mb-12">
            {[
              {
                emoji: '😰',
                title: 'הבוקר מתחיל בחוסר ודאות',
                desc: 'אתה קם בבוקר ולא יודע אם היום יהיה טוב או רע. אין לך מושג מה קרה בשוק בזמן שישנת.',
              },
              {
                emoji: '📵',
                title: 'לידים בורחים לך מהידיים',
                desc: 'מישהו כתב בפייסבוק שהוא מחפש בדיוק מה שאתה נותן. אתה לא ראית. המתחרה כן.',
              },
              {
                emoji: '😔',
                title: 'מתחרה חדש — והפתעה',
                desc: 'פתחו עסק חדש ליד שלך. כולם כבר יודעים חוץ ממך. שמת לב רק כשהלקוחות התחילו להיעלם.',
              },
            ].map((card, i) => (
              <FadeInSection key={i} delay={i * 100}>
                <div
                  className="rounded p-8 h-full transition-colors duration-300"
                  style={{ background: '#111827', border: '1px solid rgba(30,45,69,0.3)' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(0,212,255,0.3)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(30,45,69,0.3)')}
                >
                  <span className="text-4xl block mb-4">{card.emoji}</span>
                  <h3 className="text-lg font-bold mb-3" style={{ color: '#f0f4ff' }}>{card.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: '#8899aa' }}>{card.desc}</p>
                </div>
              </FadeInSection>
            ))}
          </div>

          <FadeInSection delay={400}>
            <p className="text-center text-lg md:text-xl leading-relaxed max-w-2xl mx-auto" style={{ color: '#8899aa' }}>
              זה לא חוסר מזל. זה חוסר מידע.
              <br />
              <span style={{ color: '#00d4ff', fontWeight: 700 }}>ו-Quieteyes פותרת את זה.</span>
            </p>
          </FadeInSection>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section className="py-24" style={{ background: '#0d1526' }}>
        <div className="max-w-[1200px] mx-auto px-6">
          <FadeInSection>
            <h2 className="text-3xl md:text-5xl font-extrabold text-center mb-16" style={{ letterSpacing: '-0.03em', color: '#f0f4ff' }}>
              3 דקות הגדרה. תוצאות כל החיים.
            </h2>
          </FadeInSection>

          <div className="grid md:grid-cols-3 gap-12">
            {[
              {
                num: '01',
                title: 'ספר לנו על העסק שלך',
                desc: 'שם העסק, סוג, כתובת. זהו.',
              },
              {
                num: '02',
                title: '6 העוזרים מתחילים לעבוד',
                desc: 'הם סורקים, מנתחים, ומכינים הכל בשבילך — בלי שתצטרך לעשות כלום.',
              },
              {
                num: '03',
                title: 'אתה מקבל רק מה שחשוב',
                desc: 'בוקר טוב עם סיכום יומי. התראה מיידית כשמשהו חשוב קורה. הכל לוואטסאפ שלך.',
              },
            ].map((step, i) => (
              <FadeInSection key={i} delay={i * 150}>
                <div className="text-center">
                  <span className="text-6xl font-extrabold block mb-4" style={{ color: 'rgba(0,212,255,0.15)', fontFamily: "'JetBrains Mono', monospace" }}>{step.num}</span>
                  <h3 className="text-xl font-bold mb-3" style={{ color: '#f0f4ff' }}>{step.title}</h3>
                  <p className="leading-relaxed" style={{ color: '#8899aa' }}>{step.desc}</p>
                </div>
              </FadeInSection>
            ))}
          </div>
        </div>
      </section>

      {/* ─── 6 HELPERS ─── */}
      <section className="py-24">
        <div className="max-w-[1200px] mx-auto px-6">
          <FadeInSection>
            <h2 className="text-3xl md:text-5xl font-extrabold text-center mb-16" style={{ letterSpacing: '-0.03em', color: '#f0f4ff' }}>
              הכר את 6 העוזרים שלך
            </h2>
          </FadeInSection>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {helpers.map((h, i) => (
              <FadeInSection key={i} delay={i * 80}>
                <div
                  className="rounded p-8 transition-colors duration-300 h-full flex flex-col"
                  style={{ background: '#111827', border: '1px solid rgba(30,45,69,0.3)' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(0,212,255,0.3)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(30,45,69,0.3)')}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-3xl">{h.emoji}</span>
                    <div>
                      <h3 className="text-lg font-bold" style={{ color: '#f0f4ff' }}>{h.name}</h3>
                      <p className="text-xs" style={{ color: '#00d4ff' }}>{h.tagline}</p>
                    </div>
                  </div>
                  <p className="text-sm leading-relaxed mb-auto" style={{ color: '#8899aa' }}>{h.desc}</p>
                  <WhatsAppBubble message={h.whatsapp} />
                </div>
              </FadeInSection>
            ))}
          </div>
        </div>
      </section>

      {/* ─── TESTIMONIALS ─── */}
      <section className="py-24" style={{ background: '#0d1526' }}>
        <div className="max-w-[1200px] mx-auto px-6">
          <FadeInSection>
            <h2 className="text-3xl md:text-5xl font-extrabold text-center mb-16" style={{ letterSpacing: '-0.03em', color: '#f0f4ff' }}>
              מה אומרים בעלי העסקים
            </h2>
          </FadeInSection>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((t, i) => (
              <FadeInSection key={i} delay={i * 100}>
                <div className="rounded p-8 h-full flex flex-col" style={{ background: '#111827', border: '1px solid rgba(30,45,69,0.3)' }}>
                  <div className="mb-4" style={{ color: '#ffaa00', fontSize: 14 }}>&#9733;&#9733;&#9733;&#9733;&#9733;</div>
                  <p className="leading-relaxed mb-6 flex-1" style={{ color: '#f0f4ff' }}>"{t.quote}"</p>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold" style={{ color: '#f0f4ff' }}>{t.name}, {t.role}</p>
                      <p className="text-xs" style={{ color: '#8899aa' }}>{t.city}</p>
                    </div>
                    <span className="text-[10px] font-bold px-3 py-1 rounded" style={{ background: 'rgba(0,212,255,0.1)', color: '#00d4ff', border: '1px solid rgba(0,212,255,0.2)' }}>
                      {t.badge}
                    </span>
                  </div>
                </div>
              </FadeInSection>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FINAL CTA ─── */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at 50% 50%, rgba(0,212,255,0.08) 0%, transparent 60%)' }} />
        <div className="max-w-[700px] mx-auto px-6 text-center relative z-10">
          <FadeInSection>
            <h2 className="text-3xl md:text-5xl font-extrabold mb-4" style={{ letterSpacing: '-0.03em', color: '#f0f4ff' }}>
              תפסיק לנחש. תתחיל לדעת.
            </h2>
            <p className="mb-8 leading-relaxed" style={{ color: '#8899aa' }}>
              14 יום חינם. ללא כרטיס אשראי. בלי התחייבות. רק תוצאות.
            </p>
            <Link
              to="/register"
              className="inline-block px-8 py-4 font-bold rounded text-base transition-colors duration-200"
              style={{ background: '#00d4ff', color: '#0a0e1a' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#00bfe6')}
              onMouseLeave={e => (e.currentTarget.style.background = '#00d4ff')}
            >
              {'התחל עכשיו — זה לוקח 3 דקות'}
            </Link>
            <p className="mt-6 text-sm" style={{ color: '#4a5568' }}>
              {'🔒 מאובטח | 🇮🇱 שרתים בישראל | ❌ ללא ספאם | ✅ ביטול בכל עת'}
            </p>
          </FadeInSection>
        </div>
      </section>
    </>
  );
}
