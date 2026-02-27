import { useState } from 'react';
import { Link } from 'react-router-dom';
import FadeInSection from '../../components/marketing/FadeInSection';
import useSEO from '../../hooks/useSEO';

const posts = [
  {
    category: 'מדריכים',
    title: 'איך למצוא לידים חמים בפייסבוק בחינם — מדריך 2026',
    excerpt: 'כל יום אלפי ישראלים כותבים ברשתות שהם מחפשים שירות. רובם לא יגיעו אליך דרך גוגל. הנה איך למצוא אותם לפני המתחרים...',
    date: '25 פברואר 2026',
    readTime: '5 דקות קריאה',
    tag: 'LEADS',
  },
  {
    category: 'אסטרטגיה',
    title: 'ניתוח מתחרים לעסק קטן: המדריך המלא',
    excerpt: 'מה לבדוק, איך לבדוק ומה לעשות עם המידע שמצאת. מדריך שלב אחר שלב לעסקים שרוצים יתרון תחרותי אמיתי...',
    date: '20 פברואר 2026',
    readTime: '8 דקות קריאה',
    tag: 'STRATEGY',
  },
  {
    category: 'מושגים',
    title: 'מה זה OSINT ואיך זה עוזר לעסק שלך',
    excerpt: 'OSINT — Open Source Intelligence — הוא איסוף מידע ממקורות פתוחים. ה-CIA משתמש בזה. עכשיו גם בעל המסעדה שלך יכול...',
    date: '15 פברואר 2026',
    readTime: '4 דקות קריאה',
    tag: 'OSINT',
  },
  {
    category: 'מודיעין',
    title: '5 סימנים שמתחרה חדש עומד לפתוח באזורך',
    excerpt: 'יש סימנים מוקדמים שאפשר לזהות לפני שהמתחרה נפתח רשמית. הנה מה לחפש — ומה לעשות כשמוצאים...',
    date: '10 פברואר 2026',
    readTime: '6 דקות קריאה',
    tag: 'INTEL',
  },
];

const tagColors: Record<string, string> = {
  OSINT: '#00d4ff',
  LEADS: '#00ff88',
  STRATEGY: '#ffaa00',
  INTEL: '#a78bfa',
};

function NewsletterForm() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) return;
    setSubmitted(true);
  };

  if (submitted) {
    return <p className="text-sm" style={{ color: '#00d4ff' }}>תודה! נעדכן אותך בקרוב.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-3 max-w-md mx-auto">
      <input
        type="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        placeholder="הכנס אימייל..."
        required
        className="flex-1 px-4 py-2.5 rounded text-sm outline-none"
        style={{ background: '#111827', border: '1px solid rgba(30,45,69,0.5)', color: '#f0f4ff' }}
      />
      <button
        type="submit"
        className="px-6 py-2.5 rounded text-sm font-semibold transition-colors duration-200"
        style={{ background: '#00d4ff', color: '#0a0e1a' }}
      >
        הרשם
      </button>
    </form>
  );
}

export default function Blog() {
  useSEO(
    'בלוג Quieteyes | מדריכי מודיעין עסקי לעסקים קטנים',
    'מדריכים, טיפים ותובנות על מודיעין עסקי, מעקב מתחרים, לידים חמים ו-AI לעסקים קטנים ובינוניים בישראל.'
  );

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
        <div className="max-w-[1200px] mx-auto px-6 text-center">
          <FadeInSection>
            <p className="text-sm tracking-[0.15em] mb-4 uppercase" style={{ color: '#00d4ff', fontFamily: "'JetBrains Mono', monospace" }}>
              INSIGHTS
            </p>
            <h1 className="text-4xl md:text-6xl font-extrabold mb-6" style={{ letterSpacing: '-0.03em' }}>
              בלוג ותובנות
            </h1>
            <p className="text-lg max-w-lg mx-auto" style={{ color: '#8899aa' }}>
              מדריכים, טיפים ותובנות על מודיעין עסקי, לידים חמים, מעקב מתחרים ו-AI
            </p>
          </FadeInSection>
        </div>
      </section>

      {/* Posts grid */}
      <section className="py-16">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-8">
            {posts.map((post, i) => (
              <FadeInSection key={i} delay={i * 80}>
                <article
                  className="rounded h-full flex flex-col"
                  style={{ background: '#111827', border: '1px solid rgba(30,45,69,0.3)' }}
                >
                  {/* Tag bar */}
                  <div className="px-6 pt-6 pb-3 flex items-center justify-between">
                    <span
                      className="text-[10px] font-bold tracking-[0.1em] px-2 py-0.5 rounded"
                      style={{ background: `${tagColors[post.tag] || '#00d4ff'}15`, color: tagColors[post.tag] || '#00d4ff', fontFamily: "'JetBrains Mono', monospace" }}
                    >
                      {post.tag}
                    </span>
                    <span className="text-xs" style={{ color: '#4a5568' }}>{post.readTime}</span>
                  </div>

                  {/* Content */}
                  <div className="px-6 pb-6 flex-1 flex flex-col">
                    <p className="text-xs mb-2" style={{ color: '#00d4ff' }}>{post.category}</p>
                    <h2 className="text-lg font-bold mb-3 leading-snug" style={{ color: '#f0f4ff' }}>
                      {post.title}
                    </h2>
                    <p className="text-sm leading-relaxed flex-1 mb-4" style={{ color: '#8899aa' }}>
                      {post.excerpt}
                    </p>
                    <div className="flex items-center justify-between pt-3" style={{ borderTop: '1px solid rgba(30,45,69,0.3)' }}>
                      <span className="text-xs" style={{ color: '#4a5568' }}>{post.date}</span>
                      <span
                        className="text-xs font-medium cursor-default"
                        style={{ color: '#8899aa' }}
                      >
                        בקרוב...
                      </span>
                    </div>
                  </div>
                </article>
              </FadeInSection>
            ))}
          </div>
        </div>
      </section>

      {/* Newsletter CTA */}
      <section className="py-20" style={{ background: '#0d1526' }}>
        <div className="max-w-[600px] mx-auto px-6 text-center">
          <FadeInSection>
            <h2 className="text-2xl md:text-3xl font-extrabold mb-4" style={{ letterSpacing: '-0.03em' }}>
              קבל תובנות לתיבה
            </h2>
            <p className="text-sm mb-8" style={{ color: '#8899aa' }}>
              מדריכים, טיפים ועדכונים על מודיעין עסקי — פעם בשבוע, ישירות למייל.
            </p>
            <NewsletterForm />
          </FadeInSection>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 text-center">
        <FadeInSection>
          <p className="mb-4" style={{ color: '#8899aa' }}>רוצה לראות את הכלים בפעולה?</p>
          <Link
            to="/register"
            className="inline-block px-8 py-3 font-bold rounded transition-colors duration-200"
            style={{ background: '#00d4ff', color: '#0a0e1a' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#00bfe6')}
            onMouseLeave={e => (e.currentTarget.style.background = '#00d4ff')}
          >
            התחל 14 יום חינם
          </Link>
        </FadeInSection>
      </section>
    </div>
  );
}
