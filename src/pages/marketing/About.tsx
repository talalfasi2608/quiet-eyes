import { Link } from 'react-router-dom';
import FadeInSection from '../../components/marketing/FadeInSection';

const values = [
  {
    title: 'שקיפות מלאה',
    desc: 'אנחנו מראים בדיוק מאיפה כל נתון מגיע. בלי קסמים, בלי "קופסה שחורה". כל תובנה מבוססת על מקורות שאפשר לבדוק.',
    icon: '\uD83D\uDD0D',
  },
  {
    title: 'פרטיות ואבטחה',
    desc: 'הנתונים שלך מוצפנים ומאובטחים. אנחנו לא מוכרים מידע, לא חולקים, ולא משתמשים בו למטרות שיווק.',
    icon: '\uD83D\uDD12',
  },
  {
    title: 'מוצר ישראלי לשוק ישראלי',
    desc: 'בנוי מהיסוד בעברית, עבור עסקים ישראלים. אנחנו מבינים את השוק המקומי כי אנחנו חלק ממנו.',
    icon: '\uD83C\uDDEE\uD83C\uDDF1',
  },
  {
    title: 'AI שעובד בשבילך',
    desc: 'אוטומציה חכמה שחוסכת שעות עבודה ביום. המערכת פועלת 24/7, גם כשאתה ישן.',
    icon: '\u26A1',
  },
];

const milestones = [
  { num: '2024', label: 'הרעיון נולד' },
  { num: '2025', label: 'השקה ראשונית' },
  { num: '2,847', label: 'עסקים פעילים' },
  { num: '156K+', label: 'לידים זוהו' },
];

export default function About() {
  return (
    <div className="pt-16">
      {/* Hero */}
      <section
        className="py-24"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(0,212,255,0.06) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      >
        <div className="max-w-[800px] mx-auto px-6 text-center">
          <FadeInSection>
            <p className="text-sm tracking-[0.15em] mb-4 uppercase" style={{ color: '#00d4ff', fontFamily: "'JetBrains Mono', monospace" }}>
              ABOUT US
            </p>
            <h1 className="text-4xl md:text-6xl font-extrabold mb-6" style={{ letterSpacing: '-0.03em' }}>
              אנחנו מאמינים שכל עסק קטן מגיע לאותם כלים כמו תאגידים גדולים
            </h1>
          </FadeInSection>
        </div>
      </section>

      {/* Story */}
      <section className="py-20" style={{ background: '#0d1526' }}>
        <div className="max-w-[800px] mx-auto px-6">
          <FadeInSection>
            <h2 className="text-2xl md:text-3xl font-extrabold mb-8" style={{ letterSpacing: '-0.03em' }}>
              הסיפור שלנו
            </h2>
            <div className="space-y-6 text-lg leading-relaxed" style={{ color: '#8899aa' }}>
              <p>
                Quieteyes נולדה מתסכול. ראינו בעלי עסקים קטנים מתחרים על אוויר מול רשתות גדולות עם מחלקות מחקר שוק שלמות.
              </p>
              <p>
                בעל מסעדה בחיפה לא ידע שנפתח מתחרה חדש ברחוב הסמוך עד שהוא ראה ירידה בלקוחות. בעלת סלון יופי בתל אביב פספסה עשרות לידים חמים שחיפשו בדיוק את השירות שלה בקבוצות פייסבוק.
              </p>
              <p>
                החלטנו לשנות את זה. בנינו פלטפורמה שמביאה כלי מודיעין ברמה צבאית — OSINT, AI, סריקה אוטומטית — לידי כל בעל עסק קטן. בעברית, בממשק פשוט, במחיר נגיש.
              </p>
              <p style={{ color: '#f0f4ff' }}>
                היום Quieteyes עוזרת לאלפי עסקים ישראלים לראות את השוק שלהם — ולפעול לפני המתחרים.
              </p>
            </div>
          </FadeInSection>
        </div>
      </section>

      {/* Milestones */}
      <section className="py-16">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {milestones.map((m, i) => (
              <FadeInSection key={i} delay={i * 100}>
                <div className="text-3xl md:text-4xl font-extrabold mb-2" style={{ color: '#00d4ff', fontFamily: "'JetBrains Mono', monospace" }}>
                  {m.num}
                </div>
                <div className="text-sm" style={{ color: '#8899aa' }}>{m.label}</div>
              </FadeInSection>
            ))}
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-24" style={{ background: '#0d1526' }}>
        <div className="max-w-[1200px] mx-auto px-6">
          <FadeInSection>
            <h2 className="text-3xl md:text-4xl font-extrabold text-center mb-16" style={{ letterSpacing: '-0.03em' }}>
              הערכים שלנו
            </h2>
          </FadeInSection>

          <div className="grid md:grid-cols-2 gap-8">
            {values.map((v, i) => (
              <FadeInSection key={i} delay={i * 100}>
                <div className="rounded p-8" style={{ background: '#111827', border: '1px solid rgba(30,45,69,0.3)' }}>
                  <span className="text-3xl block mb-4">{v.icon}</span>
                  <h3 className="text-lg font-bold mb-3" style={{ color: '#f0f4ff' }}>{v.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: '#8899aa' }}>{v.desc}</p>
                </div>
              </FadeInSection>
            ))}
          </div>
        </div>
      </section>

      {/* Tech stack */}
      <section className="py-20">
        <div className="max-w-[800px] mx-auto px-6">
          <FadeInSection>
            <h2 className="text-2xl md:text-3xl font-extrabold text-center mb-8" style={{ letterSpacing: '-0.03em' }}>
              הטכנולוגיה מאחורי Quieteyes
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {['AI/ML', 'OSINT', 'NLP', 'Real-time', 'Maps API', 'Web Scraping', 'WhatsApp API', 'PDF Reports'].map((tech, i) => (
                <div
                  key={i}
                  className="rounded p-3 text-center text-xs font-medium"
                  style={{ background: '#111827', border: '1px solid rgba(30,45,69,0.3)', color: '#00d4ff', fontFamily: "'JetBrains Mono', monospace" }}
                >
                  {tech}
                </div>
              ))}
            </div>
          </FadeInSection>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 text-center" style={{ background: 'radial-gradient(circle at 50% 50%, rgba(0,212,255,0.06) 0%, transparent 60%)' }}>
        <FadeInSection>
          <h2 className="text-2xl md:text-3xl font-extrabold mb-4" style={{ letterSpacing: '-0.03em' }}>
            בוא נעבוד ביחד
          </h2>
          <p className="mb-8" style={{ color: '#8899aa' }}>
            יש שאלות? רעיונות? פידבק? נשמח לשמוע.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link
              to="/login"
              className="px-8 py-3 font-bold rounded transition-colors duration-200"
              style={{ background: '#00d4ff', color: '#0a0e1a' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#00bfe6')}
              onMouseLeave={e => (e.currentTarget.style.background = '#00d4ff')}
            >
              התחל חינם
            </Link>
            <a
              href="mailto:hello@quieteyes.co.il"
              className="px-8 py-3 font-medium rounded transition-colors duration-200"
              style={{ border: '1px solid rgba(0,212,255,0.4)', color: '#00d4ff' }}
            >
              צור קשר
            </a>
          </div>
        </FadeInSection>
      </section>
    </div>
  );
}
