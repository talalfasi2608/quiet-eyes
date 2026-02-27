import { Link } from 'react-router-dom';
import FadeInSection from '../../components/marketing/FadeInSection';

const posts = [
  {
    category: 'מודיעין עסקי',
    title: 'איך OSINT משנה את המשחק לעסקים קטנים בישראל',
    excerpt: 'כלי מודיעין פתוח (OSINT) שפעם היו נחלת סוכנויות ביון הפכו נגישים לכל עסק. למדו איך להשתמש בהם כדי להבין את השוק שלכם.',
    date: '25 פברואר 2026',
    readTime: '5 דק\' קריאה',
    tag: 'OSINT',
  },
  {
    category: 'לידים',
    title: '7 שיטות למצוא לידים חמים ברשתות חברתיות — בלי לשלם על פרסום',
    excerpt: 'לידים אורגניים הם הלידים הכי איכותיים. הנה 7 שיטות מוכחות שעוזרות לעסקים קטנים למצוא לקוחות פוטנציאלים בקבוצות פייסבוק, גוגל ועוד.',
    date: '20 פברואר 2026',
    readTime: '7 דק\' קריאה',
    tag: 'LEADS',
  },
  {
    category: 'מתחרים',
    title: 'המתחרה שלך הוריד מחירים — מה עושים עכשיו?',
    excerpt: 'כשמתחרה מוריד מחירים, התגובה הראשונה היא להוריד גם. אבל זה כמעט תמיד טעות. הנה 5 אסטרטגיות חכמות יותר.',
    date: '15 פברואר 2026',
    readTime: '4 דק\' קריאה',
    tag: 'STRATEGY',
  },
  {
    category: 'AI',
    title: 'איך AI יכול לחסוך 10 שעות עבודה בשבוע לבעל עסק קטן',
    excerpt: 'מחקר שוק, ניתוח ביקורות, כתיבת תוכן, מעקב אחר מתחרים — כל אלה משימות ש-AI יכול לעשות בשבילכם. הנה איך.',
    date: '10 פברואר 2026',
    readTime: '6 דק\' קריאה',
    tag: 'AI',
  },
  {
    category: 'ביקורות',
    title: 'מדריך מלא: איך לנהל ביקורות גוגל כמו מקצוען',
    excerpt: 'ביקורות גוגל הן אחד הגורמים החשובים ביותר להחלטת רכישה. למדו איך לנהל, להגיב ולשפר את הדירוג שלכם.',
    date: '5 פברואר 2026',
    readTime: '8 דק\' קריאה',
    tag: 'REVIEWS',
  },
  {
    category: 'צמיחה',
    title: 'מ-0 ל-50 לקוחות חדשים בחודש: סיפור של מסעדה בחיפה',
    excerpt: 'איך מסעדה קטנה בחיפה השתמשה בכלי מודיעין עסקי כדי למצוא לידים, לעקוב אחרי מתחרים ולהגדיל הכנסות ב-40%.',
    date: '1 פברואר 2026',
    readTime: '5 דק\' קריאה',
    tag: 'CASE STUDY',
  },
];

const tagColors: Record<string, string> = {
  OSINT: '#00d4ff',
  LEADS: '#00ff88',
  STRATEGY: '#ffaa00',
  AI: '#a78bfa',
  REVIEWS: '#ff4466',
  'CASE STUDY': '#f97316',
};

export default function Blog() {
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
              מדריכים, טיפים ותובנות על מודיעין עסקי, לידים, מתחרים ו-AI
            </p>
          </FadeInSection>
        </div>
      </section>

      {/* Posts grid */}
      <section className="py-16">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {posts.map((post, i) => (
              <FadeInSection key={i} delay={i * 80}>
                <article
                  className="rounded h-full flex flex-col transition-colors duration-200"
                  style={{ background: '#111827', border: '1px solid rgba(30,45,69,0.3)' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(0,212,255,0.3)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(30,45,69,0.3)')}
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
                    <h2 className="text-lg font-bold mb-3 leading-snug" style={{ color: '#f0f4ff' }}>
                      {post.title}
                    </h2>
                    <p className="text-sm leading-relaxed flex-1 mb-4" style={{ color: '#8899aa' }}>
                      {post.excerpt}
                    </p>
                    <div className="flex items-center justify-between pt-3" style={{ borderTop: '1px solid rgba(30,45,69,0.3)' }}>
                      <span className="text-xs" style={{ color: '#4a5568' }}>{post.date}</span>
                      <span
                        className="text-xs font-medium cursor-pointer"
                        style={{ color: '#00d4ff' }}
                      >
                        קרא עוד &larr;
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
            <div className="flex gap-3 max-w-md mx-auto">
              <input
                type="email"
                placeholder="הכנס אימייל..."
                className="flex-1 px-4 py-2.5 rounded text-sm outline-none"
                style={{ background: '#111827', border: '1px solid rgba(30,45,69,0.5)', color: '#f0f4ff' }}
              />
              <button
                className="px-6 py-2.5 rounded text-sm font-semibold transition-colors duration-200"
                style={{ background: '#00d4ff', color: '#0a0e1a' }}
              >
                הרשם
              </button>
            </div>
          </FadeInSection>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 text-center">
        <FadeInSection>
          <p className="mb-4" style={{ color: '#8899aa' }}>רוצה לראות את הכלים בפעולה?</p>
          <Link
            to="/login"
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
