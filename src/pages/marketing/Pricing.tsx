import { useState } from 'react';
import { Link } from 'react-router-dom';
import FadeInSection from '../../components/marketing/FadeInSection';
import useSEO from '../../hooks/useSEO';

interface Feature {
  text: string;
  included: boolean;
}

interface Plan {
  name: string;
  nameEn: string;
  monthlyPrice: number;
  annualPrice: number;
  tagline: string;
  features: Feature[];
  cta: string;
  popular: boolean;
  roi?: string;
}

const plans: Plan[] = [
  {
    name: 'חינמי',
    nameEn: 'FREE',
    monthlyPrice: 0,
    annualPrice: 0,
    tagline: 'טעם ראשון',
    features: [
      { text: 'עיני — 5 לידים בחודש', included: true },
      { text: '3 מתחרים במעקב', included: true },
      { text: 'סריקה יומית אחת', included: true },
      { text: 'התראות וואטסאפ', included: false },
      { text: 'המוח, הקול, הכיס, האוזן, הטווח', included: false },
    ],
    cta: 'התחל חינם',
    popular: false,
  },
  {
    name: 'מתחיל',
    nameEn: 'STARTER',
    monthlyPrice: 149,
    annualPrice: 119,
    tagline: 'לעסק שמתחיל לצמוח',
    features: [
      { text: 'עיני — לידים ללא הגבלה', included: true },
      { text: '15 מתחרים', included: true },
      { text: 'סריקה כל 6 שעות', included: true },
      { text: 'התראות וואטסאפ מיידיות', included: true },
      { text: 'המוח — 3 משימות יומיות', included: true },
      { text: 'דוח שבועי', included: true },
      { text: 'הקול, הכיס, האוזן, הטווח', included: false },
    ],
    cta: 'התחל 14 יום חינם',
    popular: false,
    roi: 'ליד אחד שסגרת = ₪800 ממוצע = כיסית את המנוי ×5',
  },
  {
    name: 'צומח',
    nameEn: 'GROWTH',
    monthlyPrice: 279,
    annualPrice: 224,
    tagline: 'לעסק שרוצה לצמוח ברצינות',
    features: [
      { text: 'עיני — לידים ללא הגבלה', included: true },
      { text: '30 מתחרים', included: true },
      { text: 'סריקה כל שעתיים', included: true },
      { text: 'התראות וואטסאפ', included: true },
      { text: 'המוח — מלא + למידה', included: true },
      { text: 'הקול — תוכן שבועי', included: true },
      { text: 'הכיס — מגמות', included: true },
      { text: 'דוח שבועי + חודשי', included: true },
      { text: 'האוזן, הטווח', included: false },
    ],
    cta: 'התחל 14 יום חינם',
    popular: true,
    roi: 'פוסט אחד + ליד אחד = ₪1,500+ = כיסית את המנוי ×5',
  },
  {
    name: 'שולט',
    nameEn: 'PRO',
    monthlyPrice: 449,
    annualPrice: 359,
    tagline: 'לעסק שרוצה יתרון מלא',
    features: [
      { text: 'עיני — ללא הגבלה + real-time', included: true },
      { text: 'מתחרים ללא הגבלה', included: true },
      { text: 'סריקה כל 30 דקות', included: true },
      { text: 'כל 6 העוזרים — מלאים', included: true },
      { text: 'למידה עמוקה + זיכרון', included: true },
      { text: 'דוחות שבועי+חודשי+רבעוני', included: true },
      { text: 'תמיכה בעדיפות גבוהה', included: true },
    ],
    cta: 'התחל 14 יום חינם',
    popular: false,
    roi: 'מגמה אחת שזוהתה מוקדם = יתרון חודש על המתחרים = אין לזה מחיר',
  },
];

const commonFeatures = [
  '14 יום ניסיון',
  'ביטול בכל עת',
  'ללא כרטיס אשראי',
  'הגדרה תוך 3 דקות',
  'תמיכה בעברית',
  'ערבות החזר כסף 30 יום',
];

const faqs = [
  {
    q: 'האם זה מתאים לעסק שלי?',
    a: 'כן! Quieteyes נבנתה לכל עסק שיש לו מתחרים — בין אם אתה מסעדה, סלון יופי, חנות אונליין, יועץ עסקי או כל עסק מקומי אחר. אם יש לך מתחרים ואתה רוצה לדעת מה הם עושים ומאיפה מגיעים הלקוחות — זה בדיוק בשבילך.',
  },
  {
    q: 'כמה זמן עד שרואים תוצאות?',
    a: 'רוב הלקוחות שלנו רואים לידים ראשונים תוך 24 שעות מרגע ההרשמה. ניתוח מתחרים מלא מוכן תוך 12 שעות. הדוח השבועי הראשון מגיע ביום ראשון הקרוב. בקיצור — התוצאות מתחילות מהר מאוד.',
  },
  {
    q: 'מה קורה בסוף הניסיון?',
    a: 'שום דבר מפחיד. אם לא בחרת תוכנית בתשלום, החשבון שלך עובר אוטומטית לתוכנית החינמית. לא חויבת שקל אחד. לא צריך לבטל. פשוט ממשיכים עם הגרסה החינמית.',
  },
  {
    q: 'יכול לבטל בכל זמן?',
    a: 'בוודאי. אין חוזה, אין התחייבות, אין קנסות. לחיצה אחת בהגדרות — וזהו. אנחנו מאמינים שאם הכלי טוב, תרצה להישאר. ואם לא — אין סיבה שנחזיק אותך בכוח.',
  },
  {
    q: 'האם הנתונים שלי מאובטחים?',
    a: 'לחלוטין. השרתים שלנו בישראל, עם הצפנה מלאה. אנחנו עומדים בכל דרישות הגנת הפרטיות הישראליות. המידע שלך לא נמכר, לא משותף ולא משמש לשום מטרה אחרת מלבד לתת לך שירות מעולה.',
  },
];

export default function Pricing() {
  useSEO(
    'מחירים | Quieteyes',
    'גלה את תוכניות המחירים של Quieteyes — מודיעין עסקי מתקדם מ-₪0. 14 יום ניסיון חינם, ביטול בכל עת, ללא כרטיס אשראי.'
  );

  const [annual, setAnnual] = useState(false);

  return (
    <div className="pt-16" style={{ background: '#0a0e1a' }}>
      {/* Hero */}
      <section className="py-24">
        <div className="max-w-[1200px] mx-auto px-6 text-center">
          <FadeInSection>
            <p
              className="text-sm tracking-[0.15em] mb-4 uppercase"
              style={{ color: '#00d4ff', fontFamily: "'JetBrains Mono', monospace" }}
            >
              PRICING
            </p>
            <h1
              className="text-4xl md:text-6xl font-extrabold mb-6"
              style={{ color: '#f0f4ff', letterSpacing: '-0.03em' }}
            >
              כמה שווה לדעת מה קורה בשוק שלך?
            </h1>
            <p className="text-lg md:text-xl mb-10 max-w-2xl mx-auto" style={{ color: '#8899aa' }}>
              פחות ממה שאתה חושב. הרבה יותר ממה שאתה מרוויח בלי זה.
            </p>

            {/* Toggle */}
            <div
              className="inline-flex items-center gap-0 rounded-lg p-1"
              style={{ background: '#111827', border: '1px solid rgba(30,45,69,0.3)' }}
            >
              <button
                className="px-5 py-2.5 text-sm font-medium rounded-md transition-colors duration-200"
                style={
                  !annual
                    ? { background: '#00d4ff', color: '#0a0e1a' }
                    : { color: '#8899aa' }
                }
                onClick={() => setAnnual(false)}
              >
                תשלום חודשי
              </button>
              <button
                className="px-5 py-2.5 text-sm font-medium rounded-md transition-colors duration-200"
                style={
                  annual
                    ? { background: '#00d4ff', color: '#0a0e1a' }
                    : { color: '#8899aa' }
                }
                onClick={() => setAnnual(true)}
              >
                תשלום שנתי — חסוך 2 חודשים
              </button>
            </div>
          </FadeInSection>
        </div>
      </section>

      {/* Plans */}
      <section className="pb-24">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            {plans.map((plan, i) => {
              const displayPrice = annual ? plan.annualPrice : plan.monthlyPrice;
              const isFree = plan.monthlyPrice === 0;

              return (
                <FadeInSection key={i} delay={i * 80}>
                  <div
                    className="rounded-lg p-6 relative h-full flex flex-col"
                    style={{
                      background: '#111827',
                      border: plan.popular
                        ? '1px solid rgba(0,212,255,0.4)'
                        : '1px solid rgba(30,45,69,0.3)',
                    }}
                  >
                    {/* Popular Badge */}
                    {plan.popular && (
                      <span
                        className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-bold px-4 py-1 rounded-full whitespace-nowrap"
                        style={{ background: '#00d4ff', color: '#0a0e1a' }}
                      >
                        הכי פופולרי
                      </span>
                    )}

                    {/* Name */}
                    <p
                      className="text-[10px] tracking-[0.15em] uppercase mb-1"
                      style={{
                        color: '#4a5568',
                        fontFamily: "'JetBrains Mono', monospace",
                      }}
                    >
                      {plan.nameEn}
                    </p>
                    <h3
                      className="text-xl font-bold mb-1"
                      style={{ color: '#f0f4ff' }}
                    >
                      {plan.name}
                    </h3>
                    <p
                      className="text-xs mb-4"
                      style={{ color: '#8899aa' }}
                    >
                      {plan.tagline}
                    </p>

                    {/* Price */}
                    <div className="mb-6">
                      {isFree ? (
                        <span
                          className="text-3xl font-extrabold"
                          style={{
                            color: '#f0f4ff',
                            fontFamily: "'JetBrains Mono', monospace",
                          }}
                        >
                          ₪0 לתמיד
                        </span>
                      ) : (
                        <div className="flex items-baseline gap-2 flex-wrap">
                          {annual && (
                            <span
                              className="text-lg line-through"
                              style={{
                                color: '#4a5568',
                                fontFamily: "'JetBrains Mono', monospace",
                              }}
                            >
                              ₪{plan.monthlyPrice}
                            </span>
                          )}
                          <span
                            className="text-3xl font-extrabold"
                            style={{
                              color: '#f0f4ff',
                              fontFamily: "'JetBrains Mono', monospace",
                            }}
                          >
                            ₪{displayPrice}
                          </span>
                          <span className="text-sm" style={{ color: '#8899aa' }}>
                            /חודש
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Features */}
                    <ul className="space-y-3 mb-6 flex-1">
                      {plan.features.map((f, j) => (
                        <li
                          key={j}
                          className="flex items-start gap-2.5 text-sm"
                          style={{
                            color: f.included ? '#f0f4ff' : '#4a5568',
                          }}
                        >
                          <span
                            className="mt-0.5 flex-shrink-0"
                            style={{
                              color: f.included ? '#00ff88' : '#4a5568',
                              fontSize: 13,
                            }}
                          >
                            {f.included ? '\u2705' : '\u274C'}
                          </span>
                          {f.text}
                        </li>
                      ))}
                    </ul>

                    {/* ROI Box */}
                    {plan.roi && (
                      <div
                        className="mb-6 p-3 rounded-md text-xs leading-relaxed text-center"
                        style={{
                          background: 'rgba(0,212,255,0.05)',
                          border: '1px solid rgba(0,212,255,0.2)',
                          color: '#00d4ff',
                        }}
                      >
                        {plan.roi}
                      </div>
                    )}

                    {/* CTA */}
                    <Link
                      to="/register"
                      className="block py-3 rounded-md text-sm font-bold text-center transition-colors duration-200"
                      style={
                        plan.popular
                          ? { background: '#00d4ff', color: '#0a0e1a' }
                          : { border: '1px solid rgba(30,45,69,0.5)', color: '#8899aa' }
                      }
                      onMouseEnter={(e) => {
                        if (plan.popular) {
                          e.currentTarget.style.background = '#00bfe6';
                        } else {
                          e.currentTarget.style.borderColor = 'rgba(0,212,255,0.4)';
                          e.currentTarget.style.color = '#00d4ff';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (plan.popular) {
                          e.currentTarget.style.background = '#00d4ff';
                        } else {
                          e.currentTarget.style.borderColor = 'rgba(30,45,69,0.5)';
                          e.currentTarget.style.color = '#8899aa';
                        }
                      }}
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

      {/* Common Features */}
      <section className="pb-24">
        <div className="max-w-[1200px] mx-auto px-6">
          <FadeInSection>
            <div
              className="rounded-lg p-8 text-center"
              style={{
                background: '#111827',
                border: '1px solid rgba(30,45,69,0.3)',
              }}
            >
              <h3
                className="text-xl font-bold mb-6"
                style={{ color: '#f0f4ff' }}
              >
                כל התוכניות כוללות:
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
                {commonFeatures.map((feature, i) => (
                  <div key={i} className="flex flex-col items-center gap-2">
                    <span style={{ color: '#00ff88', fontSize: 18 }}>{'\u2713'}</span>
                    <span className="text-sm" style={{ color: '#8899aa' }}>
                      {feature}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </FadeInSection>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24" style={{ background: '#0d1526' }}>
        <div className="max-w-[700px] mx-auto px-6">
          <FadeInSection>
            <h2
              className="text-3xl font-extrabold text-center mb-12"
              style={{ color: '#f0f4ff', letterSpacing: '-0.03em' }}
            >
              שאלות נפוצות
            </h2>
          </FadeInSection>

          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <FadeInSection key={i} delay={i * 60}>
                <details
                  className="group rounded-lg"
                  style={{
                    background: '#111827',
                    border: '1px solid rgba(30,45,69,0.3)',
                  }}
                >
                  <summary
                    className="cursor-pointer px-6 py-4 text-sm font-semibold flex items-center justify-between"
                    style={{ color: '#f0f4ff' }}
                  >
                    {faq.q}
                    <span
                      className="transition-transform duration-200 group-open:rotate-45 text-lg"
                      style={{ color: '#00d4ff' }}
                    >
                      +
                    </span>
                  </summary>
                  <div
                    className="px-6 pb-4 text-sm leading-relaxed"
                    style={{ color: '#8899aa' }}
                  >
                    {faq.a}
                  </div>
                </details>
              </FadeInSection>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 text-center">
        <div className="max-w-[1200px] mx-auto px-6">
          <FadeInSection>
            <h2
              className="text-3xl md:text-4xl font-extrabold mb-4"
              style={{ color: '#f0f4ff', letterSpacing: '-0.03em' }}
            >
              מוכן לראות מה קורה בשוק שלך?
            </h2>
            <p className="text-lg mb-8 max-w-xl mx-auto" style={{ color: '#8899aa' }}>
              14 יום ניסיון חינם. ללא כרטיס אשראי. ללא התחייבות.
            </p>
            <Link
              to="/register"
              className="inline-block px-10 py-4 font-bold rounded-md text-lg transition-colors duration-200"
              style={{ background: '#00d4ff', color: '#0a0e1a' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#00bfe6')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#00d4ff')}
            >
              התחל עכשיו — חינם
            </Link>
          </FadeInSection>
        </div>
      </section>
    </div>
  );
}
