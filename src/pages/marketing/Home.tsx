import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import FadeInSection from '../../components/marketing/FadeInSection';

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
    <div className="relative w-full max-w-[480px] mx-auto">
      <style>{`
        @keyframes mockFadeIn { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }
        @keyframes pulseDot { 0%,100% { opacity:1; transform:scale(1) } 50% { opacity:.4; transform:scale(1.6) } }
      `}</style>
      <div className="rounded" style={{ background: '#0d1526', border: '1px solid rgba(30,45,69,0.5)', overflow: 'hidden', boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }}>
        {/* Chrome */}
        <div className="flex items-center gap-1.5 px-3 py-2" style={{ background: '#080c16', borderBottom: '1px solid rgba(30,45,69,0.3)' }}>
          <div className="w-2 h-2 rounded-full" style={{ background: '#ff4466', opacity: 0.6 }} />
          <div className="w-2 h-2 rounded-full" style={{ background: '#ffaa00', opacity: 0.6 }} />
          <div className="w-2 h-2 rounded-full" style={{ background: '#00ff88', opacity: 0.6 }} />
          <span className="mr-3" style={{ fontSize: 9, color: '#4a5568', fontFamily: "'JetBrains Mono', monospace" }}>
            quieteyes.co.il/dashboard
          </span>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3">
          <div className="flex gap-3">
            {/* Health gauge */}
            <div
              className="w-20 h-20 rounded flex flex-col items-center justify-center"
              style={{ background: '#111827', border: '1px solid rgba(30,45,69,0.3)', animation: 'mockFadeIn 0.8s ease 0.3s both' }}
            >
              <span className="text-2xl font-bold" style={{ color: '#00ff88', fontFamily: "'JetBrains Mono', monospace" }}>78</span>
              <span style={{ fontSize: 8, color: '#8899aa' }}>Health</span>
            </div>

            {/* Intel cards */}
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

          {/* Map */}
          <div
            className="rounded h-24 relative overflow-hidden"
            style={{ background: '#111827', border: '1px solid rgba(30,45,69,0.3)', animation: 'mockFadeIn 0.6s ease 1.2s both' }}
          >
            <div className="absolute inset-0" style={{ opacity: 0.15, backgroundImage: 'linear-gradient(rgba(0,212,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,0.4) 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
            {[
              { top: 20, right: 48, color: '#00d4ff', delay: '0s' },
              { top: 40, right: 96, color: '#ff4466', delay: '0.5s' },
              { top: 16, right: 128, color: '#ff4466', delay: '1s' },
              { top: 56, right: 80, color: '#00ff88', delay: '0.3s' },
              { top: 32, right: 160, color: '#ffaa00', delay: '0.7s' },
            ].map((d, i) => (
              <div
                key={i}
                className="absolute w-2 h-2 rounded-full"
                style={{ top: d.top, right: d.right, background: d.color, animation: `pulseDot 2s infinite ${d.delay}` }}
              />
            ))}
            <span className="absolute bottom-1.5 left-2" style={{ fontSize: 8, color: '#4a5568' }}>4 competitors nearby</span>
          </div>

          {/* Bottom stats */}
          <div
            className="flex justify-between rounded p-2"
            style={{ background: '#111827', border: '1px solid rgba(30,45,69,0.3)', animation: 'mockFadeIn 0.6s ease 1.5s both' }}
          >
            {[
              { val: '12', label: 'Leads', color: '#00d4ff' },
              { val: '7', label: 'Threats', color: '#ff4466' },
              { val: '94%', label: 'Accuracy', color: '#00ff88' },
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

/* ══════════════════════════════════════════════════ */

export default function Home() {
  return (
    <>
      {/* ─── HERO ─── */}
      <section
        className="relative min-h-screen flex items-center pt-16"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(0,212,255,0.08) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      >
        <div className="max-w-[1200px] mx-auto px-6 py-20 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <p
              className="text-sm tracking-[0.2em] mb-6 uppercase"
              style={{ color: '#00d4ff', fontFamily: "'JetBrains Mono', monospace" }}
            >
              מודיעין עסקי &middot; OSINT PLATFORM
            </p>
            <h1
              className="text-4xl md:text-6xl lg:text-[76px] font-extrabold leading-[1.08] mb-6"
              style={{ letterSpacing: '-0.03em', color: '#f0f4ff' }}
            >
              ראה את השוק
              <br />
              לפני המתחרים שלך
            </h1>
            <p className="text-lg md:text-xl leading-relaxed mb-8 max-w-lg" style={{ color: '#8899aa' }}>
              Quieteyes מנתחת את השוק שלך בזמן אמת.
              {' '}לידים חמים, ניטור מתחרים, התראות שוק —
              {' '}הכל אוטומטי, הכל בעברית.
            </p>
            <div className="flex flex-wrap gap-4 mb-6">
              <Link
                to="/login"
                className="px-7 py-3 text-sm font-bold rounded transition-colors duration-200"
                style={{ background: '#00d4ff', color: '#0a0e1a' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#00bfe6')}
                onMouseLeave={e => (e.currentTarget.style.background = '#00d4ff')}
              >
                התחל 14 יום חינם &larr;
              </Link>
              <Link
                to="/features"
                className="px-7 py-3 text-sm font-medium rounded transition-colors duration-200"
                style={{ border: '1px solid rgba(0,212,255,0.4)', color: '#00d4ff' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,212,255,0.1)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                צפה בדמו
              </Link>
            </div>
            <p className="text-xs" style={{ color: '#4a5568' }}>
              ללא כרטיס אשראי &middot; ביטול בכל עת &middot; הגדרה תוך 3 דקות
            </p>
          </div>

          <div className="hidden md:block">
            <DashboardMockup />
          </div>
        </div>
      </section>

      {/* ─── LIVE STATS BAR ─── */}
      <section style={{ background: '#0d1526', borderTop: '1px solid rgba(30,45,69,0.3)', borderBottom: '1px solid rgba(30,45,69,0.3)' }}>
        <div className="max-w-[1200px] mx-auto px-6 py-12 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { value: 2847, label: 'עסקים פעילים' },
            { value: 156000, label: 'לידים זוהו', suffix: '+' },
            { value: 94, label: 'דיוק AI', suffix: '%' },
            { value: 3, label: 'הגדרה', prefix: '<', suffix: 'min' },
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

      {/* ─── PROBLEM / SOLUTION ─── */}
      <section className="py-24">
        <div className="max-w-[1200px] mx-auto px-6">
          <FadeInSection>
            <h2 className="text-3xl md:text-5xl font-extrabold text-center mb-16" style={{ letterSpacing: '-0.03em' }}>
              העסק שלך פועל עיוור
            </h2>
          </FadeInSection>

          <div className="grid md:grid-cols-2 gap-8">
            <FadeInSection delay={100}>
              <div className="rounded p-8" style={{ background: '#111827', border: '1px solid rgba(30,45,69,0.3)' }}>
                <h3 className="text-lg font-bold mb-6" style={{ color: '#ff4466' }}>בלי Quieteyes</h3>
                <ul className="space-y-4">
                  {[
                    'לא יודע מה המתחרה מתכנן',
                    'מפספס לידים חמים כל יום',
                    'מגלה על מתחרה חדש רק אחרי חודשים',
                    'מקבל החלטות על בסיס תחושת בטן',
                  ].map((t, i) => (
                    <li key={i} className="flex items-start gap-3" style={{ color: '#8899aa' }}>
                      <span style={{ color: '#ff4466', marginTop: 2 }}>&#10005;</span>
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </FadeInSection>

            <FadeInSection delay={200}>
              <div className="rounded p-8" style={{ background: '#111827', border: '1px solid rgba(0,212,255,0.2)' }}>
                <h3 className="text-lg font-bold mb-6" style={{ color: '#00ff88' }}>עם Quieteyes</h3>
                <ul className="space-y-4">
                  {[
                    'רואה כל שינוי אצל המתחרים בזמן אמת',
                    'מקבל לידים חמים ישירות לוואטסאפ',
                    'מתראה על מתחרה חדש תוך 24 שעות',
                    'מחליט על בסיס נתוני שוק אמיתיים',
                  ].map((t, i) => (
                    <li key={i} className="flex items-start gap-3" style={{ color: '#f0f4ff' }}>
                      <span style={{ color: '#00ff88', marginTop: 2 }}>&#10003;</span>
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </FadeInSection>
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section className="py-24" style={{ background: '#0d1526' }}>
        <div className="max-w-[1200px] mx-auto px-6">
          <FadeInSection>
            <h2 className="text-3xl md:text-5xl font-extrabold text-center mb-16" style={{ letterSpacing: '-0.03em' }}>
              איך זה עובד
            </h2>
          </FadeInSection>

          <div className="grid md:grid-cols-3 gap-12">
            {[
              { num: '01', title: 'מגדיר את העסק שלך', desc: 'הכנס את שם העסק, סוג ואזור. Quieteyes מוצאת הכל אוטומטית.' },
              { num: '02', title: 'הפלטפורמה סורקת את השוק', desc: 'כל 12 שעות — מתחרים, לידים, ביקורות, מחירים, פרסומות.' },
              { num: '03', title: 'מקבל התראות ופועל', desc: 'וואטסאפ + אימייל עם תובנות ופעולות מומלצות. אתה פועל, לא מנחש.' },
            ].map((step, i) => (
              <FadeInSection key={i} delay={i * 150}>
                <div className="text-center">
                  <span
                    className="text-6xl font-extrabold block mb-4"
                    style={{ color: 'rgba(0,212,255,0.15)', fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    {step.num}
                  </span>
                  <h3 className="text-xl font-bold mb-3" style={{ color: '#f0f4ff' }}>{step.title}</h3>
                  <p className="leading-relaxed" style={{ color: '#8899aa' }}>{step.desc}</p>
                </div>
              </FadeInSection>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FEATURES PREVIEW ─── */}
      <section className="py-24">
        <div className="max-w-[1200px] mx-auto px-6">
          <FadeInSection>
            <h2 className="text-3xl md:text-5xl font-extrabold text-center mb-16" style={{ letterSpacing: '-0.03em' }}>
              הכלים שלך
            </h2>
          </FadeInSection>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: '\uD83C\uDFAF', title: 'צלף לידים', desc: 'מוצא שיחות רלוונטיות ברשתות החברתיות ומחשב ציון רלוונטיות לכל ליד' },
              { icon: '\uD83D\uDC41\uFE0F', title: 'מודיעין שוק', desc: 'עוקב אחרי מתחרים, מחירים, ביקורות ומכריז על שינויים בזמן אמת' },
              { icon: '\u26A1', title: 'מיקוד יומי', desc: 'AI מייצר תוכנית פעולה יומית מותאמת אישית לעסק שלך' },
            ].map((f, i) => (
              <FadeInSection key={i} delay={i * 100}>
                <div
                  className="rounded p-8 transition-colors duration-300"
                  style={{ background: '#111827', border: '1px solid rgba(30,45,69,0.3)' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(0,212,255,0.3)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(30,45,69,0.3)')}
                >
                  <span className="text-4xl block mb-4">{f.icon}</span>
                  <h3 className="text-lg font-bold mb-3" style={{ color: '#f0f4ff' }}>{f.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: '#8899aa' }}>{f.desc}</p>
                </div>
              </FadeInSection>
            ))}
          </div>

          <div className="text-center mt-10">
            <Link
              to="/features"
              className="text-sm font-medium transition-opacity duration-200"
              style={{ color: '#00d4ff' }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            >
              ראה את כל התכונות &larr;
            </Link>
          </div>
        </div>
      </section>

      {/* ─── SOCIAL PROOF ─── */}
      <section className="py-24" style={{ background: '#0d1526' }}>
        <div className="max-w-[1200px] mx-auto px-6">
          <FadeInSection>
            <h2 className="text-3xl md:text-5xl font-extrabold text-center mb-16" style={{ letterSpacing: '-0.03em' }}>
              מה אומרים עסקים שכבר עובדים איתנו
            </h2>
          </FadeInSection>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { quote: 'מצאנו 8 לידים חמים בשבוע הראשון. זה שינה איך אנחנו מנהלים את העסק', name: 'רועי כהן', role: 'בעל מסעדה, חיפה' },
              { quote: 'לסוף אני יודעת מה המתחרים עושים. חסכתי שעות של מחקר ידני כל שבוע', name: 'מיה לוי', role: 'סלון יופי, תל אביב' },
              { quote: 'ה-AI מצא הזדמנות שלא ידעתי שקיימת. הגדלתי הכנסות ב-23% תוך חודש', name: 'דני ברקת', role: 'סוכנות שיווק, ירושלים' },
            ].map((t, i) => (
              <FadeInSection key={i} delay={i * 100}>
                <div className="rounded p-8" style={{ background: '#111827', border: '1px solid rgba(30,45,69,0.3)' }}>
                  <div className="mb-4" style={{ color: '#ffaa00', fontSize: 14 }}>&#9733;&#9733;&#9733;&#9733;&#9733;</div>
                  <p className="leading-relaxed mb-6" style={{ color: '#f0f4ff' }}>"{t.quote}"</p>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: '#f0f4ff' }}>{t.name}</p>
                    <p className="text-xs" style={{ color: '#8899aa' }}>{t.role}</p>
                  </div>
                </div>
              </FadeInSection>
            ))}
          </div>
        </div>
      </section>

      {/* ─── PRICING PREVIEW ─── */}
      <section className="py-24">
        <div className="max-w-[1200px] mx-auto px-6">
          <FadeInSection>
            <h2 className="text-3xl md:text-5xl font-extrabold text-center mb-4" style={{ letterSpacing: '-0.03em' }}>
              תוכניות ומחירים
            </h2>
            <p className="text-center mb-12" style={{ color: '#8899aa' }}>בחר את התוכנית שמתאימה לך</p>
          </FadeInSection>

          <div className="grid md:grid-cols-3 gap-8 max-w-[900px] mx-auto">
            {[
              { name: 'חינמי', price: '0', desc: '3 סריקות \u00B7 3 מתחרים \u00B7 10 הודעות AI', popular: false },
              { name: 'Basic', price: '149', desc: '20 סריקות \u00B7 10 מתחרים \u00B7 התראות וואטסאפ', popular: false },
              { name: 'Pro', price: '299', desc: '100 סריקות \u00B7 25 מתחרים \u00B7 דוחות שבועיים', popular: true },
            ].map((p, i) => (
              <FadeInSection key={i} delay={i * 100}>
                <div
                  className="rounded p-8 text-center relative"
                  style={{ background: '#111827', border: p.popular ? '1px solid rgba(0,212,255,0.4)' : '1px solid rgba(30,45,69,0.3)' }}
                >
                  {p.popular && (
                    <span
                      className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-bold px-3 py-0.5 rounded"
                      style={{ background: '#00d4ff', color: '#0a0e1a' }}
                    >
                      MOST POPULAR
                    </span>
                  )}
                  <h3 className="text-lg font-bold mb-2" style={{ color: '#f0f4ff' }}>{p.name}</h3>
                  <div className="mb-4">
                    <span className="text-3xl font-extrabold" style={{ color: '#f0f4ff', fontFamily: "'JetBrains Mono', monospace" }}>
                      &#8362;{p.price}
                    </span>
                    <span className="text-sm" style={{ color: '#8899aa' }}>/חודש</span>
                  </div>
                  <p className="text-sm mb-6" style={{ color: '#8899aa' }}>{p.desc}</p>
                  <Link
                    to="/pricing"
                    className="block py-2.5 rounded text-sm font-semibold transition-colors duration-200"
                    style={p.popular
                      ? { background: '#00d4ff', color: '#0a0e1a' }
                      : { border: '1px solid rgba(30,45,69,0.5)', color: '#8899aa' }
                    }
                  >
                    {p.price === '0' ? 'התחל חינם' : 'בחר תוכנית'}
                  </Link>
                </div>
              </FadeInSection>
            ))}
          </div>

          <div className="text-center mt-8">
            <Link to="/pricing" className="text-sm font-medium" style={{ color: '#00d4ff' }}>
              ראה את כל התוכניות &larr;
            </Link>
          </div>
        </div>
      </section>

      {/* ─── FINAL CTA ─── */}
      <section className="py-24 relative overflow-hidden">
        <div
          className="absolute inset-0"
          style={{ background: 'radial-gradient(circle at 50% 50%, rgba(0,212,255,0.08) 0%, transparent 60%)' }}
        />
        <div className="max-w-[600px] mx-auto px-6 text-center relative z-10">
          <FadeInSection>
            <h2 className="text-3xl md:text-5xl font-extrabold mb-4" style={{ letterSpacing: '-0.03em' }}>
              מוכן לראות את השוק שלך?
            </h2>
            <p className="mb-8" style={{ color: '#8899aa' }}>
              הצטרף ל-2,847 עסקים שכבר עובדים חכם יותר
            </p>
            <Link
              to="/login"
              className="inline-block px-8 py-4 font-bold rounded text-base transition-colors duration-200"
              style={{ background: '#00d4ff', color: '#0a0e1a' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#00bfe6')}
              onMouseLeave={e => (e.currentTarget.style.background = '#00d4ff')}
            >
              התחל עכשיו — חינם ל-14 יום
            </Link>
          </FadeInSection>
        </div>
      </section>
    </>
  );
}
