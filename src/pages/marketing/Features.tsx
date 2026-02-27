import { Link } from 'react-router-dom';
import FadeInSection from '../../components/marketing/FadeInSection';

/* ── Mockup visuals ── */

function LeadCardMockup() {
  return (
    <div className="rounded p-5 space-y-3" style={{ background: '#111827', border: '1px solid rgba(30,45,69,0.4)' }}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold px-2 py-0.5 rounded" style={{ background: 'rgba(0,212,255,0.15)', color: '#00d4ff' }}>ליד חדש</span>
        <span className="text-xs" style={{ color: '#4a5568' }}>לפני 3 דקות</span>
      </div>
      <p className="text-sm font-semibold" style={{ color: '#f0f4ff' }}>"מישהו יודע על מסעדה איטלקית טובה בצפון?"</p>
      <p className="text-xs" style={{ color: '#8899aa' }}>פייסבוק &middot; קבוצת "אוכל בצפון"</p>
      <div className="mt-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs" style={{ color: '#8899aa' }}>ציון רלוונטיות</span>
          <span className="text-xs font-bold" style={{ color: '#00ff88', fontFamily: "'JetBrains Mono', monospace" }}>94/100</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: '#1e2d45' }}>
          <div className="h-full rounded-full" style={{ width: '94%', background: 'linear-gradient(90deg, #00d4ff, #00ff88)' }} />
        </div>
      </div>
      <div className="rounded p-3 mt-2" style={{ background: '#0d1526', border: '1px solid rgba(30,45,69,0.3)' }}>
        <p className="text-xs" style={{ color: '#8899aa' }}>
          <span style={{ color: '#00d4ff' }}>AI:</span> הליד רלוונטי מאוד. מומלץ להגיב עם הצעת ערך ייחודית תוך שעה.
        </p>
      </div>
    </div>
  );
}

function CompetitorMapMockup() {
  return (
    <div className="rounded relative overflow-hidden" style={{ background: '#111827', border: '1px solid rgba(30,45,69,0.4)', height: 280 }}>
      <div className="absolute inset-0" style={{ opacity: 0.1, backgroundImage: 'linear-gradient(rgba(0,212,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,0.3) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
      {/* Your business */}
      <div className="absolute flex flex-col items-center" style={{ top: '40%', right: '45%' }}>
        <div className="w-4 h-4 rounded-full" style={{ background: '#00d4ff', boxShadow: '0 0 12px rgba(0,212,255,0.5)' }} />
        <span className="text-[10px] mt-1 font-semibold" style={{ color: '#00d4ff' }}>העסק שלך</span>
      </div>
      {/* Competitors */}
      {[
        { top: '25%', right: '25%', name: 'מתחרה A', threat: 'high' },
        { top: '55%', right: '65%', name: 'מתחרה B', threat: 'medium' },
        { top: '30%', right: '70%', name: 'מתחרה C', threat: 'high' },
        { top: '65%', right: '30%', name: 'חדש!', threat: 'new' },
      ].map((c, i) => (
        <div key={i} className="absolute flex flex-col items-center" style={{ top: c.top, right: c.right }}>
          <div
            className="w-3 h-3 rounded-full"
            style={{ background: c.threat === 'new' ? '#ffaa00' : c.threat === 'high' ? '#ff4466' : '#8899aa' }}
          />
          <span className="text-[9px] mt-0.5" style={{ color: '#4a5568' }}>{c.name}</span>
        </div>
      ))}
      {/* Legend */}
      <div className="absolute bottom-3 right-3 flex gap-3">
        {[
          { color: '#00d4ff', label: 'אתה' },
          { color: '#ff4466', label: 'איום גבוה' },
          { color: '#ffaa00', label: 'חדש' },
        ].map((l, i) => (
          <div key={i} className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full" style={{ background: l.color }} />
            <span style={{ fontSize: 9, color: '#4a5568' }}>{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function HealthGaugeMockup() {
  return (
    <div className="rounded p-6 text-center" style={{ background: '#111827', border: '1px solid rgba(30,45,69,0.4)' }}>
      <div className="relative w-32 h-32 mx-auto mb-4">
        <svg viewBox="0 0 120 120" className="w-full h-full">
          <circle cx="60" cy="60" r="52" fill="none" stroke="#1e2d45" strokeWidth="8" />
          <circle
            cx="60" cy="60" r="52" fill="none" stroke="#00ff88" strokeWidth="8"
            strokeDasharray={`${(72 / 100) * 327} 327`}
            strokeLinecap="round"
            transform="rotate(-90 60 60)"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-extrabold" style={{ color: '#00ff88', fontFamily: "'JetBrains Mono', monospace" }}>72</span>
          <span className="text-[10px]" style={{ color: '#8899aa' }}>Health Score</span>
        </div>
      </div>
      <div className="space-y-2 text-right">
        {[
          { label: 'דירוג Google', val: '4.2/5', color: '#00ff88' },
          { label: 'לידים חדשים', val: '+12 השבוע', color: '#00d4ff' },
          { label: 'איומי מתחרים', val: '2 פעילים', color: '#ff4466' },
        ].map((r, i) => (
          <div key={i} className="flex justify-between text-xs">
            <span style={{ color: r.color, fontFamily: "'JetBrains Mono', monospace" }}>{r.val}</span>
            <span style={{ color: '#8899aa' }}>{r.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function WhatsAppMockup() {
  return (
    <div className="rounded overflow-hidden" style={{ background: '#111827', border: '1px solid rgba(30,45,69,0.4)' }}>
      <div className="px-4 py-2.5 flex items-center gap-3" style={{ background: '#0d1526', borderBottom: '1px solid rgba(30,45,69,0.3)' }}>
        <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'rgba(0,212,255,0.15)' }}>
          <span style={{ color: '#00d4ff', fontSize: 14 }}>Q</span>
        </div>
        <div>
          <p className="text-xs font-semibold" style={{ color: '#f0f4ff' }}>Quieteyes Alerts</p>
          <p style={{ fontSize: 10, color: '#4a5568' }}>online</p>
        </div>
      </div>
      <div className="p-4 space-y-3">
        {[
          { text: 'ליד חם זוהה! ציון 92/100\n"מחפש סלון יופי באזור הרצליה"\nמקור: פייסבוק\nהגב תוך שעה למקסום סיכוי.', time: '09:14' },
          { text: 'התראת מתחרה\nCoffeeX עדכן מחירים — ירידה של 15%.\nמומלץ לבדוק את התמחור שלך.', time: '11:30' },
        ].map((m, i) => (
          <div key={i} className="rounded p-3 max-w-[85%]" style={{ background: '#0d1526', border: '1px solid rgba(30,45,69,0.3)' }}>
            <p className="text-xs whitespace-pre-line leading-relaxed" style={{ color: '#f0f4ff' }}>{m.text}</p>
            <p className="text-left mt-1" style={{ fontSize: 9, color: '#4a5568' }}>{m.time}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function PdfMockup() {
  return (
    <div className="rounded p-5" style={{ background: '#111827', border: '1px solid rgba(30,45,69,0.4)' }}>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-12 rounded flex items-center justify-center" style={{ background: '#1e2d45' }}>
          <span style={{ fontSize: 10, color: '#ff4466' }}>PDF</span>
        </div>
        <div>
          <p className="text-sm font-semibold" style={{ color: '#f0f4ff' }}>דו"ח מודיעין שבועי</p>
          <p className="text-xs" style={{ color: '#4a5568' }}>20/02/2026 - 27/02/2026</p>
        </div>
      </div>
      <div className="space-y-2">
        {['סיכום מנהלים', 'ציון בריאות: 72/100', 'ניתוח מתחרים', 'לידים: 12 חדשים', 'תוכנית פעולה'].map((item, i) => (
          <div key={i} className="flex items-center gap-2 py-1" style={{ borderBottom: '1px solid rgba(30,45,69,0.2)' }}>
            <span style={{ color: '#00d4ff', fontSize: 10 }}>&#9654;</span>
            <span className="text-xs" style={{ color: '#8899aa' }}>{item}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 flex gap-2">
        <button className="flex-1 py-1.5 text-xs rounded font-medium" style={{ background: '#00d4ff', color: '#0a0e1a' }}>הורד PDF</button>
        <button className="flex-1 py-1.5 text-xs rounded font-medium" style={{ border: '1px solid rgba(30,45,69,0.5)', color: '#8899aa' }}>תצוגה מקדימה</button>
      </div>
    </div>
  );
}

function ChatMockup() {
  return (
    <div className="rounded overflow-hidden" style={{ background: '#111827', border: '1px solid rgba(30,45,69,0.4)' }}>
      <div className="px-4 py-2.5" style={{ background: '#0d1526', borderBottom: '1px solid rgba(30,45,69,0.3)' }}>
        <p className="text-xs font-semibold" style={{ color: '#f0f4ff' }}>AI Advisor</p>
      </div>
      <div className="p-4 space-y-3">
        <div className="rounded p-3 max-w-[80%] mr-auto" style={{ background: '#0d1526' }}>
          <p className="text-xs" style={{ color: '#f0f4ff' }}>מה הסטטוס של המתחרים שלי השבוע?</p>
        </div>
        <div className="rounded p-3 max-w-[85%]" style={{ background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.15)' }}>
          <p className="text-xs leading-relaxed" style={{ color: '#f0f4ff' }}>
            <span style={{ color: '#00d4ff' }}>AI:</span> זיהיתי 3 שינויים משמעותיים השבוע:
            <br />1. CoffeeX הוריד מחירים ב-15%
            <br />2. BeanBar קיבל 12 ביקורות חדשות (4.6 ממוצע)
            <br />3. מתחרה חדש "BrewLab" נפתח ב-500 מ' ממך.
            <br /><br />מומלץ: עדכן את הצעת הערך שלך מול BrewLab.
          </p>
        </div>
      </div>
      <div className="px-4 py-3" style={{ borderTop: '1px solid rgba(30,45,69,0.3)' }}>
        <div className="flex gap-2">
          <div className="flex-1 rounded px-3 py-1.5 text-xs" style={{ background: '#0d1526', border: '1px solid rgba(30,45,69,0.3)', color: '#4a5568' }}>
            שאל שאלה...
          </div>
          <button className="px-3 py-1.5 rounded text-xs font-medium" style={{ background: '#00d4ff', color: '#0a0e1a' }}>שלח</button>
        </div>
      </div>
    </div>
  );
}

const mockups: Record<string, () => JSX.Element> = {
  lead: LeadCardMockup,
  competitor: CompetitorMapMockup,
  health: HealthGaugeMockup,
  whatsapp: WhatsAppMockup,
  pdf: PdfMockup,
  chat: ChatMockup,
};

/* ═══════════════════════════════════════ */

const features = [
  {
    id: 'lead',
    title: 'צלף לידים',
    desc: 'מוצא שיחות רלוונטיות בפייסבוק, גוגל ורשתות נוספות. כל ליד מקבל ציון רלוונטיות 0-100 ותיאור AI של הפעולה המומלצת.',
  },
  {
    id: 'competitor',
    title: 'מודיעין מתחרים',
    desc: 'עוקב אחרי כל שינוי — פתיחה/סגירה, מחירים, ביקורות, פרסומות. מתראה תוך 24 שעות.',
  },
  {
    id: 'health',
    title: 'ניתוח שוק AI',
    desc: 'ניתוח שוק שבועי עם תובנות מותאמות לסוג העסק שלך. המלצות פעולה ספציפיות.',
  },
  {
    id: 'whatsapp',
    title: 'התראות וואטסאפ',
    desc: 'כל ליד חם, כל שינוי אצל מתחרה — ישירות לוואטסאפ שלך. לא צריך להיכנס לפלטפורמה כדי לפעול.',
  },
  {
    id: 'pdf',
    title: 'דוח שבועי PDF',
    desc: 'דוח מנהלים אוטומטי עם כל הנתונים, מגמות ותוכנית פעולה לשבוע הבא.',
  },
  {
    id: 'chat',
    title: 'AI Advisor',
    desc: "צ'אט עם AI שמכיר את העסק שלך, את המתחרים שלך ואת הנתונים שלך. שאל כל שאלה, קבל תשובה מבוססת נתונים.",
  },
];

export default function Features() {
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
              FEATURES
            </p>
            <h1 className="text-4xl md:text-6xl font-extrabold mb-6" style={{ letterSpacing: '-0.03em' }}>
              יכולות שעד עכשיו היו רק לתאגידים
            </h1>
            <p className="text-lg max-w-xl mx-auto" style={{ color: '#8899aa' }}>
              כלי מודיעין ברמה צבאית, מותאמים לעסקים קטנים ובינוניים
            </p>
          </FadeInSection>
        </div>
      </section>

      {/* Feature sections */}
      {features.map((feat, i) => {
        const MockupComponent = mockups[feat.id];
        const reversed = i % 2 === 1;
        return (
          <section
            key={feat.id}
            className="py-20"
            style={{ background: reversed ? '#0d1526' : '#0a0e1a' }}
          >
            <div className="max-w-[1200px] mx-auto px-6 grid md:grid-cols-2 gap-16 items-center">
              <FadeInSection className={reversed ? 'md:order-2' : ''}>
                <p className="text-xs tracking-[0.15em] uppercase mb-3" style={{ color: '#00d4ff', fontFamily: "'JetBrains Mono', monospace" }}>
                  {String(i + 1).padStart(2, '0')}
                </p>
                <h2 className="text-2xl md:text-4xl font-extrabold mb-4" style={{ letterSpacing: '-0.03em' }}>
                  {feat.title}
                </h2>
                <p className="text-lg leading-relaxed" style={{ color: '#8899aa' }}>
                  {feat.desc}
                </p>
              </FadeInSection>

              <FadeInSection delay={200} className={reversed ? 'md:order-1' : ''}>
                <MockupComponent />
              </FadeInSection>
            </div>
          </section>
        );
      })}

      {/* Bottom CTA */}
      <section className="py-24 text-center" style={{ background: 'radial-gradient(circle at 50% 50%, rgba(0,212,255,0.06) 0%, transparent 60%)' }}>
        <FadeInSection>
          <h2 className="text-3xl md:text-4xl font-extrabold mb-6" style={{ letterSpacing: '-0.03em' }}>
            מוכן להתחיל?
          </h2>
          <p className="mb-8" style={{ color: '#8899aa' }}>14 יום חינם. ללא כרטיס אשראי.</p>
          <Link
            to="/login"
            className="inline-block px-8 py-4 font-bold rounded transition-colors duration-200"
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
