import { Link } from 'react-router-dom';
import FadeInSection from '../../components/marketing/FadeInSection';
import useSEO from '../../hooks/useSEO';

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

const mockups: Record<string, () => JSX.Element> = {
  lead: LeadCardMockup,
  competitor: CompetitorMapMockup,
  health: HealthGaugeMockup,
  whatsapp: WhatsAppMockup,
  pdf: PdfMockup,
};

/* ═══════════════════════════════════════ */

const features = [
  {
    id: 'lead',
    title: 'צלף לידים — מוצא את הלקוחות הבאים שלך',
    bullets: [
      'כל יום, אלפי אנשים כותבים ברשתות החברתיות שהם מחפשים שירות או מוצר כמו שלך. רובם לא יגיעו אליך — כי אתה לא יודע שהם שם.',
      'Quieteyes סורקת פייסבוק, גוגל, פורומים ועוד עשרות מקורות. כל פוסט, כל שאלה, כל בקשת המלצה — מנותחת על ידי AI ומוערכת לפי הרלוונטיות לעסק שלך.',
    ],
    details: [
      'ציון רלוונטיות 0-100',
      'סיכום AI של מה שהאדם מחפש',
      'המלצת פעולה: \'צור קשר\', \'שלח הצעה\', \'לא רלוונטי\'',
      'קישור ישיר לפוסט המקורי',
    ],
    summary: 'התוצאה: רשימה יומית של אנשים שמחפשים בדיוק את מה שאתה מציע — מוכנים לשמוע ממך.',
  },
  {
    id: 'competitor',
    title: 'מודיעין מתחרים — תמיד צעד אחד קדימה',
    bullets: [
      'בעולם שבו מידע הוא כסף, הבעיה היא לא המידע — הבעיה היא לדעת מה קורה לפני שזה משפיע עליך.',
      'Quieteyes עוקבת כל 12 שעות אחרי כל מתחרה:',
    ],
    details: [
      'שינויי מחירים — גילית לפני הלקוחות שלך',
      'ביקורות חדשות — ראה מה אומרים עליהם',
      'פרסומות ומבצעים — הבן את האסטרטגיה שלהם',
      'עסקים חדשים שנפתחו — התראה תוך 24 שעות',
      'עסקים שנסגרו — הזדמנות לתפוס את הלקוחות שלהם',
    ],
    summary: 'כל שינוי מהותי — הודעת וואטסאפ מיידית. לא צריך לבדוק ידנית. לא צריך לגגל מתחרים. Quieteyes עושה את זה בשבילך.',
  },
  {
    id: 'health',
    title: 'מיקוד יומי — 3 פעולות שמניעות את העסק שלך',
    bullets: [
      'הבעיה של רוב בעלי העסקים היא לא חוסר מידע. הבעיה היא יותר מדי מידע — ולא ברור מה לעשות קודם.',
      'כל בוקר, AI שמכיר את העסק שלך, את המתחרים שלך ואת הנתונים מהסריקה האחרונה — מייצר תוכנית פעולה של 3 משימות בלבד.',
      'לא 20 סעיפים. לא \'כדאי לשקול\'. 3 פעולות ספציפיות שאתה יכול לעשות היום.',
    ],
    details: [],
    examples: [
      '\'יש ליד חם ממסעדה שמחפשת שף — פנה אליה היום\'',
      '\'המתחרה הגדיל מחירים ב-15% — עדכן את ההצעות שלך\'',
      '\'יום ירושלים מחר — פרסם מבצע אחה"צ\'',
    ],
    summary: '',
  },
  {
    id: 'pdf',
    title: 'דוח שוק שבועי — כמו שיש לתאגידים',
    bullets: [
      'כל יום ראשון, דוח PDF מקצועי ממתין לך. לא עוד ניחושים. לא עוד \'נראה לי\'.',
    ],
    details: [
      'ציון בריאות השוק שלך — 0 עד 100',
      'השוואה מלאה למתחרים: דירוג, ביקורות, מחירים',
      'ניתוח לידים: כמה נמצאו, כמה פוטנציאל',
      'מגמות שוק לשבוע הבא',
      'תוכנית פעולה מומלצת לשבוע — 5 נקודות',
    ],
    summary: 'זה הדוח שחברות גדולות משלמות עליו עשרות אלפי שקלים בשנה לחברות יחסי ציבור ומחקר שוק. ב-Quieteyes הוא נוצר אוטומטית, כל שבוע.',
  },
  {
    id: 'whatsapp',
    title: 'התראות וואטסאפ — המודיעין בא אליך',
    bullets: [
      'אתה לא צריך לזכור להיכנס לפלטפורמה. Quieteyes שולחת לוואטסאפ שלך:',
    ],
    alerts: [
      { color: '#ff4466', label: 'דחוף', text: '\'מתחרה חדש נפתח 300 מטר ממך\'' },
      { color: '#ffaa00', label: 'חשוב', text: '\'יש 5 לידים חמים שממתינים לתגובה\'' },
      { color: '#00ff88', label: 'מעקב', text: '\'המתחרה הגדיל מחירים ב-10%\'' },
    ],
    details: [],
    summary: 'הודעת בוקר יומית — סיכום 3 דקות של מה שקרה. התראות מיידיות — רק כשמשהו חשוב קורה. לא ספאם. לא רעש. רק מה שחשוב לפעול עליו.',
  },
];

export default function Features() {
  useSEO(
    'תכונות Quieteyes | מעקב מתחרים, לידים חמים וניתוח שוק AI',
    'גלה את כל יכולות Quieteyes: מעקב מתחרים אוטומטי, צלף לידים, ניתוח שוק AI, התראות וואטסאפ ודוחות שבועיים. מודיעין עסקי לעסקים קטנים.'
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
              FEATURES
            </p>
            <h1 className="text-4xl md:text-6xl font-extrabold mb-6" style={{ letterSpacing: '-0.03em' }}>
              כל הכלים שצריכים לראות את השוק שלך
            </h1>
            <p className="text-lg max-w-2xl mx-auto" style={{ color: '#8899aa' }}>
              יכולות מודיעין עסקי שעד היום היו שמורות לתאגידים גדולים — עכשיו לכל עסק קטן ובינוני בישראל
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
                <h2 className="text-2xl md:text-4xl font-extrabold mb-6" style={{ letterSpacing: '-0.03em' }}>
                  {feat.title}
                </h2>

                <div className="space-y-4 mb-6" style={{ color: '#8899aa' }}>
                  {feat.bullets.map((b, j) => (
                    <p key={j} className="leading-relaxed">{b}</p>
                  ))}
                </div>

                {feat.details.length > 0 && (
                  <ul className="space-y-2 mb-6">
                    {feat.details.map((d, j) => (
                      <li key={j} className="flex items-start gap-2 text-sm" style={{ color: '#f0f4ff' }}>
                        <span style={{ color: '#00d4ff', marginTop: 2 }}>&#9654;</span>
                        <span>{d}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {'examples' in feat && feat.examples && (
                  <div className="rounded p-4 mb-6" style={{ background: 'rgba(0,212,255,0.05)', border: '1px solid rgba(0,212,255,0.15)' }}>
                    <p className="text-xs font-semibold mb-3" style={{ color: '#00d4ff' }}>דוגמאות אמיתיות:</p>
                    <ul className="space-y-2">
                      {(feat as any).examples.map((ex: string, j: number) => (
                        <li key={j} className="text-sm" style={{ color: '#f0f4ff' }}>{ex}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {'alerts' in feat && feat.alerts && (
                  <div className="space-y-3 mb-6">
                    {(feat as any).alerts.map((a: any, j: number) => (
                      <div key={j} className="flex items-start gap-3 text-sm">
                        <span className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: a.color }} />
                        <span style={{ color: '#f0f4ff' }}><span className="font-semibold" style={{ color: a.color }}>{a.label}:</span> {a.text}</span>
                      </div>
                    ))}
                  </div>
                )}

                {feat.summary && (
                  <p className="leading-relaxed font-medium" style={{ color: '#f0f4ff' }}>
                    {feat.summary}
                  </p>
                )}
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
