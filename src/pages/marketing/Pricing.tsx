import { useState } from 'react';
import { Link } from 'react-router-dom';
import FadeInSection from '../../components/marketing/FadeInSection';
import useSEO from '../../hooks/useSEO';

const plans = [
  {
    name: 'חינמי',
    nameEn: 'FREE',
    monthlyPrice: 0,
    desc: 'נסה את מודיעין העסקי בחינם. ראה איך הפלטפורמה עובדת עם הנתונים האמיתיים של העסק שלך — ללא סיכון.',
    features: [
      { text: '3 סריקות לידים', included: true },
      { text: '3 מתחרים במעקב', included: true },
      { text: '10 הודעות AI', included: true },
      { text: 'התראות וואטסאפ', included: false },
      { text: 'דוחות שבועיים', included: false },
    ],
    cta: 'התחל חינם',
    popular: false,
  },
  {
    name: 'Basic',
    nameEn: 'BASIC',
    monthlyPrice: 149,
    desc: 'לעסקים שרוצים להתחיל לעקוב אחרי המתחרים ולמצוא לידים ראשונים. מתאים לעסק עם 1-5 מתחרים.',
    features: [
      { text: '20 סריקות לידים', included: true },
      { text: '10 מתחרים במעקב', included: true },
      { text: '50 הודעות AI', included: true },
      { text: 'התראות וואטסאפ', included: true },
      { text: 'דוחות שבועיים', included: false },
    ],
    cta: 'התחל 14 יום חינם',
    popular: false,
  },
  {
    name: 'Pro',
    nameEn: 'PRO',
    monthlyPrice: 299,
    desc: 'הכלי המלא לעסקים שרוצים יתרון תחרותי אמיתי. כולל התראות וואטסאפ, דוחות שבועיים וניתוח מחירים.',
    features: [
      { text: '100 סריקות לידים', included: true },
      { text: '25 מתחרים במעקב', included: true },
      { text: '300 הודעות AI', included: true },
      { text: 'התראות וואטסאפ', included: true },
      { text: 'דוחות שבועיים', included: true },
      { text: 'ניתוח מחירים', included: true },
    ],
    cta: 'התחל 14 יום חינם',
    popular: true,
  },
  {
    name: 'Business',
    nameEn: 'BUSINESS',
    monthlyPrice: 599,
    desc: 'לעסקים גדולים, רשתות וסוכנויות שיווק. ללא הגבלות, עם תמיכה ייעודית ו-API.',
    features: [
      { text: 'סריקות ללא הגבלה', included: true },
      { text: 'מתחרים ללא הגבלה', included: true },
      { text: 'AI ללא הגבלה', included: true },
      { text: 'הכל כלול', included: true },
      { text: 'API access', included: true },
      { text: 'תמיכה ייעודית', included: true },
    ],
    cta: 'צור קשר',
    popular: false,
  },
];

const faqs = [
  {
    q: 'האם צריך להתחייב לחוזה?',
    a: 'לא. Quieteyes עובדת על בסיס חודשי בלבד. ביטול בכל עת — אין קנסות, אין מינימום תקופה. אנחנו מאמינים שאם הכלי לא מועיל לך — אתה לא צריך לשלם.',
  },
  {
    q: 'מה קורה בסוף 14 הימים?',
    a: 'אם לא בחרת תוכנית, החשבון עובר אוטומטית לתוכנית החינמית. לא חויבת שקל. לא צריך לבטל. תמשיך להשתמש בגרסה המוגבלת ללא תשלום.',
  },
  {
    q: 'האם Quieteyes עובדת לכל סוג עסק?',
    a: 'כן, לכל עסק מקומי עם מתחרים. הכי מתאים ל: מסעדות, בתי קפה, סלוני יופי, חדרי כושר, חנויות, סוכנויות נדל"ן, רופאים ופרקליטים, סוכנויות שיווק וחנויות אונליין.',
  },
  {
    q: 'איפה הנתונים נשמרים?',
    a: 'שרתים בישראל. עמידה מלאה בחוקי הגנת הפרטיות הישראלים. המידע שלך לא נמכר ולא משמש לאף מטרה אחרת.',
  },
  {
    q: 'כמה זמן לוקח עד שרואים תוצאות?',
    a: 'הרוב רואה לידים ראשונים תוך 24 שעות מהרשמה. ניתוח מתחרים מלא — תוך 12 שעות ראשונות. דוח שבועי ראשון — ביום ראשון הקרוב לאחר ההגדרה.',
  },
];

export default function Pricing() {
  useSEO(
    'תמחור Quieteyes | תוכניות מודיעין עסקי לכל עסק',
    'בחר את תוכנית מודיעין עסקי שמתאימה לך. מתחיל ב-₪149/חודש. 14 יום חינם. ביטול בכל עת. ללא כרטיס אשראי.'
  );

  const [annual, setAnnual] = useState(false);

  return (
    <div className="pt-16">
      {/* Hero */}
      <section className="py-24">
        <div className="max-w-[1200px] mx-auto px-6 text-center">
          <FadeInSection>
            <p className="text-sm tracking-[0.15em] mb-4 uppercase" style={{ color: '#00d4ff', fontFamily: "'JetBrains Mono', monospace" }}>
              PRICING
            </p>
            <h1 className="text-4xl md:text-6xl font-extrabold mb-6" style={{ letterSpacing: '-0.03em' }}>
              השקעה שמחזירה את עצמה
            </h1>
            <p className="text-lg mb-10 max-w-2xl mx-auto" style={{ color: '#8899aa' }}>
              ליד אחד שתפסת בזכות Quieteyes שווה יותר מכל עלות המנוי. רוב הלקוחות מוצאים את ה-ROI בשבוע הראשון.
            </p>

            {/* Toggle */}
            <div className="inline-flex items-center gap-4 rounded p-1" style={{ background: '#111827', border: '1px solid rgba(30,45,69,0.3)' }}>
              <button
                className="px-5 py-2 text-sm font-medium rounded transition-colors duration-200"
                style={!annual ? { background: '#00d4ff', color: '#0a0e1a' } : { color: '#8899aa' }}
                onClick={() => setAnnual(false)}
              >
                חודשי
              </button>
              <button
                className="px-5 py-2 text-sm font-medium rounded transition-colors duration-200 flex items-center gap-2"
                style={annual ? { background: '#00d4ff', color: '#0a0e1a' } : { color: '#8899aa' }}
                onClick={() => setAnnual(true)}
              >
                שנתי
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: annual ? 'rgba(10,14,26,0.2)' : 'rgba(0,255,136,0.15)', color: annual ? '#0a0e1a' : '#00ff88' }}>
                  -20%
                </span>
              </button>
            </div>
          </FadeInSection>
        </div>
      </section>

      {/* Plans */}
      <section className="pb-24">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {plans.map((plan, i) => {
              const price = annual ? Math.round(plan.monthlyPrice * 0.8) : plan.monthlyPrice;
              return (
                <FadeInSection key={i} delay={i * 80}>
                  <div
                    className="rounded p-6 relative h-full flex flex-col"
                    style={{
                      background: '#111827',
                      border: plan.popular ? '1px solid rgba(0,212,255,0.4)' : '1px solid rgba(30,45,69,0.3)',
                    }}
                  >
                    {plan.popular && (
                      <span
                        className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-bold px-3 py-0.5 rounded"
                        style={{ background: '#00d4ff', color: '#0a0e1a' }}
                      >
                        MOST POPULAR
                      </span>
                    )}

                    <p className="text-[10px] tracking-[0.15em] uppercase mb-1" style={{ color: '#4a5568', fontFamily: "'JetBrains Mono', monospace" }}>
                      {plan.nameEn}
                    </p>
                    <h3 className="text-xl font-bold mb-2" style={{ color: '#f0f4ff' }}>{plan.name}</h3>

                    <p className="text-xs leading-relaxed mb-4" style={{ color: '#8899aa' }}>{plan.desc}</p>

                    <div className="mb-6">
                      {price === 0 ? (
                        <span className="text-4xl font-extrabold" style={{ color: '#f0f4ff', fontFamily: "'JetBrains Mono', monospace" }}>
                          חינם
                        </span>
                      ) : (
                        <>
                          <span className="text-4xl font-extrabold" style={{ color: '#f0f4ff', fontFamily: "'JetBrains Mono', monospace" }}>
                            &#8362;{price}
                          </span>
                          <span className="text-sm" style={{ color: '#8899aa' }}>/חודש</span>
                        </>
                      )}
                    </div>

                    <ul className="space-y-3 mb-8 flex-1">
                      {plan.features.map((f, j) => (
                        <li key={j} className="flex items-center gap-2.5 text-sm" style={{ color: f.included ? '#f0f4ff' : '#4a5568' }}>
                          <span style={{ color: f.included ? '#00ff88' : '#4a5568', fontSize: 12 }}>
                            {f.included ? '\u2713' : '\u2715'}
                          </span>
                          {f.text}
                        </li>
                      ))}
                    </ul>

                    <Link
                      to={plan.monthlyPrice === 599 ? '/about' : '/login'}
                      className="block py-2.5 rounded text-sm font-semibold text-center transition-colors duration-200"
                      style={plan.popular
                        ? { background: '#00d4ff', color: '#0a0e1a' }
                        : { border: '1px solid rgba(30,45,69,0.5)', color: '#8899aa' }
                      }
                    >
                      {plan.cta}
                    </Link>
                  </div>
                </FadeInSection>
              );
            })}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24" style={{ background: '#0d1526' }}>
        <div className="max-w-[700px] mx-auto px-6">
          <FadeInSection>
            <h2 className="text-3xl font-extrabold text-center mb-12" style={{ letterSpacing: '-0.03em' }}>
              שאלות נפוצות
            </h2>
          </FadeInSection>

          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <FadeInSection key={i} delay={i * 60}>
                <details className="group rounded" style={{ background: '#111827', border: '1px solid rgba(30,45,69,0.3)' }}>
                  <summary className="cursor-pointer px-6 py-4 text-sm font-semibold flex items-center justify-between" style={{ color: '#f0f4ff' }}>
                    {faq.q}
                    <span className="transition-transform duration-200 group-open:rotate-45 text-lg" style={{ color: '#00d4ff' }}>+</span>
                  </summary>
                  <div className="px-6 pb-4 text-sm leading-relaxed" style={{ color: '#8899aa' }}>
                    {faq.a}
                  </div>
                </details>
              </FadeInSection>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 text-center">
        <FadeInSection>
          <h2 className="text-2xl md:text-3xl font-extrabold mb-4" style={{ letterSpacing: '-0.03em' }}>
            עדיין לא בטוח?
          </h2>
          <p className="mb-6" style={{ color: '#8899aa' }}>נסה חינם ל-14 יום. ללא כרטיס אשראי.</p>
          <Link
            to="/login"
            className="inline-block px-8 py-3 font-bold rounded transition-colors duration-200"
            style={{ background: '#00d4ff', color: '#0a0e1a' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#00bfe6')}
            onMouseLeave={e => (e.currentTarget.style.background = '#00d4ff')}
          >
            התחל עכשיו
          </Link>
        </FadeInSection>
      </section>
    </div>
  );
}
