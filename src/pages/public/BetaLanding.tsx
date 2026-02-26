import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Zap, Target, MessageSquare, ChevronDown, Check, Users, Copy, Share2,
  Loader2, Star, Shield, Eye, Clock,
} from 'lucide-react';
import { API_BASE as API_BASE_URL } from '../../config/api';

/* ═══════════════════════════════════════════════════════════════════════════════
   ANIMATED BACKGROUNDS (reused from LandingPage)
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
   DATA
   ═══════════════════════════════════════════════════════════════════════════════ */

const industries = [
  { id: 'restaurant', label: 'מסעדה/בית קפה', icon: '🍽️' },
  { id: 'beauty', label: 'יופי וטיפוח', icon: '💅' },
  { id: 'fitness', label: 'כושר ובריאות', icon: '💪' },
  { id: 'realestate', label: 'נדל"ן', icon: '🏠' },
  { id: 'ecommerce', label: 'איקומרס', icon: '🛒' },
  { id: 'agency', label: 'סוכנות שיווק', icon: '📢' },
  { id: 'other', label: 'אחר', icon: '🏢' },
];

const WOW_MOMENTS = [
  { icon: Target, title: 'סריקת מתחרים ב-30 שניות', desc: 'תמונה מלאה של מחירים, דירוגים ושינויים — בלחיצת כפתור.', color: 'from-blue-500 to-cyan-500' },
  { icon: Zap, title: 'גילוי לידים חמים אוטומטי', desc: 'המערכת מזהה לידים רלוונטיים בפורומים וברשתות — ומציגה אותם מיד.', color: 'from-emerald-500 to-teal-500' },
  { icon: MessageSquare, title: 'תדריך בוקר יומי ב-WhatsApp', desc: 'כל בוקר מקבלים סיכום אישי של מה שהשתנה בשוק, ישירות ל-WhatsApp.', color: 'from-amber-500 to-orange-500' },
];

const FAQ_ITEMS = [
  { q: 'מה זה Quieteyes ולמי זה מתאים?', a: 'Quieteyes היא פלטפורמת מודיעין עסקי מבוססת AI, שמיועדת לבעלי עסקים קטנים ובינוניים שרוצים לקבל תמונה ברורה של השוק, המתחרים וההזדמנויות — בלי להשקיע שעות במחקר ידני.' },
  { q: 'מה כולל תקופת הבטא?', a: 'משתמשי בטא מקבלים גישה מלאה לכל הפיצ\'רים: סריקת מתחרים, גילוי לידים, תדריך יומי, צ\'אט AI ועוד — עם 50% הנחה על 3 החודשים הראשונים.' },
  { q: 'כמה זמן נמשכת הבטא?', a: 'תקופת הבטא תמשך כ-30 יום. בסיום, תוכלו להמשיך עם תוכנית בתשלום (עם הנחת מייסד!).' },
  { q: 'האם המידע שלי בטוח?', a: 'בהחלט. אנחנו אוספים רק מידע ממקורות פתוחים (OSINT) ומאחסנים הכל בהצפנה מלאה.' },
  { q: 'אפשר לבטל בכל רגע?', a: 'כן. ללא התחייבות, ללא דמי ביטול. ניתן לעזוב בכל עת.' },
];

/* ═══════════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════════════════ */

export default function BetaLanding() {
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    business_type: '',
    referral_code: '',
  });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // After-join state
  const [joined, setJoined] = useState(false);
  const [joinResult, setJoinResult] = useState<{
    position: number;
    referral_code: string;
    total_ahead: number;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  // Waitlist count
  const [waitlistCount, setWaitlistCount] = useState(0);
  useEffect(() => {
    fetch(`${API_BASE_URL}/waitlist/count`)
      .then(r => r.json())
      .then(d => setWaitlistCount(d.count || 0))
      .catch(() => {});
  }, []);

  // Read referral code from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref) {
      setFormData(prev => ({ ...prev, referral_code: ref }));
    }
  }, []);

  const scrollToForm = useCallback(() => {
    formRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim()) {
      setFormError('נא למלא שם ואימייל');
      return;
    }

    setFormLoading(true);
    setFormError(null);

    try {
      const res = await fetch(`${API_BASE_URL}/waitlist/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim() || undefined,
          business_type: formData.business_type || undefined,
          source: formData.referral_code ? 'referral' : 'organic',
          referral_code: formData.referral_code.trim() || undefined,
        }),
      });

      if (!res.ok) throw new Error('Failed');

      const data = await res.json();
      setJoinResult({
        position: data.position,
        referral_code: data.referral_code,
        total_ahead: data.total_ahead,
      });
      setJoined(true);
    } catch {
      setFormError('שגיאה בשליחה, נסה שוב');
    } finally {
      setFormLoading(false);
    }
  };

  const shareUrl = joinResult
    ? `${window.location.origin}/beta?ref=${joinResult.referral_code}`
    : '';

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsAppShare = () => {
    const text = `הצטרפתי לבטא הסגורה של Quieteyes — מודיעין עסקי מבוסס AI! 🚀\nהצטרף גם:\n${shareUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  // Scroll-reveal observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add('visible');
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    );
    document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen text-white overflow-x-hidden" dir="rtl" style={{ background: '#0a0e1a' }}>

      {/* ═══════════ NAVBAR ═══════════ */}
      <nav className="fixed top-0 w-full z-50 bg-[#0a0e1a]/80 backdrop-blur-2xl border-b border-white/[0.04]">
        <div className="max-w-7xl mx-auto px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/logo-icon-only.svg" alt="" className="w-8 h-8" />
            <span className="text-lg font-bold text-white" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Quiet<span className="text-[#00d4ff]">eyes</span>
            </span>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider text-white" style={{ background: 'linear-gradient(135deg, #6366f1, #06b6d4)' }}>
              BETA
            </span>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/login')} className="text-sm text-gray-400 hover:text-white transition-colors">
              התחברות
            </button>
            <button
              onClick={scrollToForm}
              className="px-5 py-2 text-sm font-medium rounded-lg bg-[#00d4ff]/10 text-[#00d4ff] border border-[#00d4ff]/30 hover:bg-[#00d4ff]/20 transition-all"
            >
              הצטרף לרשימה
            </button>
          </div>
        </div>
      </nav>

      {/* ═══════════ HERO ═══════════ */}
      <section className="relative pt-28 md:pt-36 pb-20 md:pb-28 px-6 overflow-hidden">
        <StarField />
        <FloatingParticles />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#00d4ff]/[0.04] rounded-full blur-[150px] pointer-events-none" />

        <div className="max-w-4xl mx-auto relative z-20 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/[0.1] border border-amber-500/25 text-amber-400 text-xs tracking-wide mb-8">
            <Clock className="w-3.5 h-3.5" />
            <span>מקומות מוגבלים — 50 עסקים בלבד</span>
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold leading-[1.15] mb-6">
            <span className="block text-white">הכלי שיגלה לך מה שהמתחרים</span>
            <span className="block bg-gradient-to-l from-[#00d4ff] to-[#0066cc] bg-clip-text text-transparent">שלך מנסים להסתיר</span>
          </h1>

          <p className="text-lg text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">
            Quieteyes סורקת את הרשת 24/7 ומספקת לך מודיעין עסקי, לידים חמים וטרנדים — בזמן אמת, ישירות ל-WhatsApp ולדשבורד שלך.
          </p>

          <button
            onClick={scrollToForm}
            className="px-10 py-4 bg-[#00d4ff] hover:bg-[#00bfe0] text-black rounded-xl text-lg font-bold transition-all shadow-[0_0_30px_rgba(0,212,255,0.3)] hover:shadow-[0_0_50px_rgba(0,212,255,0.4)] hover:-translate-y-0.5"
          >
            הצטרף לרשימת ההמתנה
          </button>

          <div className="mt-6 flex items-center justify-center gap-3">
            <div className="flex -space-x-2 rtl:space-x-reverse">
              {['from-blue-400 to-blue-600', 'from-emerald-400 to-emerald-600', 'from-cyan-400 to-cyan-600'].map((g, i) => (
                <div key={i} className={`w-7 h-7 rounded-full bg-gradient-to-br ${g} border-2 border-[#0a0e1a] flex items-center justify-center`}>
                  <Users className="w-3 h-3 text-white" />
                </div>
              ))}
            </div>
            <span className="text-sm text-gray-400">
              כבר נרשמו <span className="text-white font-medium">{waitlistCount || '...'}</span> עסקים
            </span>
          </div>
        </div>
      </section>

      {/* ═══════════ 3 WOW MOMENTS ═══════════ */}
      <section className="py-16 md:py-24 px-6 reveal">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-3 gap-5">
            {WOW_MOMENTS.map((item, i) => {
              const Icon = item.icon;
              return (
                <div key={i} className="p-7 rounded-2xl bg-[#0d1117]/60 border border-white/[0.04] hover:border-[#00d4ff]/20 transition-all text-center group">
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${item.color} mx-auto mb-5 flex items-center justify-center shadow-lg`}>
                    <Icon className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══════════ BETA OFFER BOX ═══════════ */}
      <section className="py-16 px-6 reveal">
        <div className="max-w-3xl mx-auto">
          <div className="relative rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-900/15 to-transparent p-8 md:p-10 text-center overflow-hidden">
            <div className="absolute top-0 right-0 w-60 h-60 bg-amber-500/[0.06] rounded-full blur-[100px] pointer-events-none" />
            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm font-medium mb-6">
                <Star className="w-4 h-4" />
                הצעה למשתמשי בטא
              </div>
              <h2 className="text-2xl md:text-3xl font-bold mb-6">מקומות מוגבלים: 50 עסקים בלבד</h2>
              <div className="grid md:grid-cols-3 gap-4 mb-6">
                {[
                  { icon: '💰', text: '50% הנחה על 3 החודשים הראשונים' },
                  { icon: '🏅', text: 'תג "משתמש בטא מייסד" לנצח' },
                  { icon: '💬', text: 'גישה ישירה למייסדים' },
                ].map((perk, i) => (
                  <div key={i} className="flex items-center gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                    <span className="text-2xl">{perk.icon}</span>
                    <span className="text-sm text-gray-300">{perk.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════ BUSINESS TYPE SELECTOR + WAITLIST FORM ═══════════ */}
      <section ref={formRef} id="waitlist-form" className="py-16 md:py-24 px-6 reveal">
        <div className="max-w-2xl mx-auto">
          {!joined ? (
            <>
              <div className="text-center mb-10">
                <h2 className="text-3xl font-bold mb-3">הצטרף לרשימת ההמתנה</h2>
                <p className="text-gray-400">מלא את הפרטים ונודיע לך כשהתור שלך יגיע</p>
              </div>

              <form onSubmit={handleSubmit} className="glass-card p-8 space-y-6">
                {/* Business Type Selector */}
                <div>
                  <label className="block text-sm text-gray-300 mb-3">סוג העסק</label>
                  <div className="grid grid-cols-4 md:grid-cols-7 gap-2">
                    {industries.map(ind => (
                      <button
                        key={ind.id}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, business_type: ind.id }))}
                        className={`p-3 rounded-xl border text-center transition-all ${
                          formData.business_type === ind.id
                            ? 'bg-indigo-600/20 border-indigo-500/40 text-white'
                            : 'bg-gray-800/30 border-gray-700/30 text-gray-400 hover:border-gray-600'
                        }`}
                      >
                        <span className="text-xl block mb-1">{ind.icon}</span>
                        <span className="text-[10px]">{ind.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Name + Email */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-300 mb-1.5">שם מלא *</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                      placeholder="ישראל ישראלי"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-300 mb-1.5">אימייל *</label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                      placeholder="you@company.com"
                      dir="ltr"
                    />
                  </div>
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-sm text-gray-300 mb-1.5">טלפון (אופציונלי — לקבלת WhatsApp)</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                    placeholder="050-1234567"
                    dir="ltr"
                  />
                </div>

                {/* Referral Code */}
                {formData.referral_code && (
                  <div>
                    <label className="block text-sm text-gray-300 mb-1.5">קוד הפניה</label>
                    <input
                      type="text"
                      value={formData.referral_code}
                      onChange={e => setFormData(prev => ({ ...prev, referral_code: e.target.value }))}
                      className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                      dir="ltr"
                    />
                  </div>
                )}

                {formError && <p className="text-red-400 text-sm text-center">{formError}</p>}

                <button
                  type="submit"
                  disabled={formLoading}
                  className="w-full py-3.5 bg-[#00d4ff] hover:bg-[#00bfe0] text-black rounded-xl text-base font-bold transition-all shadow-[0_0_20px_rgba(0,212,255,0.2)] disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {formLoading && <Loader2 className="w-5 h-5 animate-spin" />}
                  הצטרף לרשימת ההמתנה
                </button>

                <p className="text-center text-xs text-gray-500">
                  <Shield className="w-3 h-3 inline-block ml-1" />
                  ללא ספאם. ללא התחייבות. תשלח הודעה אחת כשהתור יגיע.
                </p>
              </form>
            </>
          ) : joinResult && (
            /* ═══════════ AFTER-JOIN VIEW ═══════════ */
            <div className="glass-card p-8 md:p-10 text-center">
              <div className="text-5xl mb-4">🎉</div>
              <h2 className="text-2xl font-bold mb-2">נרשמת בהצלחה!</h2>
              <p className="text-gray-400 mb-8">
                אתה במקום <span className="text-[#00d4ff] font-bold text-xl" style={{ fontFamily: "'JetBrains Mono', monospace" }}>#{joinResult.position}</span> ברשימה
                {joinResult.total_ahead > 0 && (
                  <span className="block text-sm mt-1">
                    {joinResult.total_ahead} לפניך
                  </span>
                )}
              </p>

              {/* Referral section */}
              <div className="bg-[#0d1117] rounded-2xl p-6 border border-white/[0.06] mb-6">
                <h3 className="text-lg font-semibold mb-3">קפוץ קדימה ברשימה!</h3>
                <p className="text-gray-400 text-sm mb-4">
                  על כל חבר שנרשם עם הקוד שלך, אתה קופץ <span className="text-[#00d4ff] font-bold">3 מקומות</span> קדימה.
                </p>

                {/* Referral code */}
                <div className="bg-gray-800/50 rounded-xl p-4 mb-4 flex items-center justify-between gap-3">
                  <span className="text-lg font-bold text-[#00d4ff] tracking-wider" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                    {joinResult.referral_code}
                  </span>
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm text-gray-300 transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    {copied ? 'הועתק!' : 'העתק'}
                  </button>
                </div>

                {/* Share buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={handleWhatsAppShare}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-600/30 transition-all font-medium text-sm"
                  >
                    <MessageSquare className="w-4 h-4" />
                    שתף ב-WhatsApp
                  </button>
                  <button
                    onClick={handleCopy}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gray-700/50 border border-gray-600/30 text-gray-300 hover:bg-gray-700 transition-all font-medium text-sm"
                  >
                    <Share2 className="w-4 h-4" />
                    העתק קישור
                  </button>
                </div>
              </div>

              <p className="text-xs text-gray-500">נשלח לך הודעה כשהתור שלך יגיע</p>
            </div>
          )}
        </div>
      </section>

      {/* ═══════════ SOCIAL PROOF ═══════════ */}
      {waitlistCount > 5 && (
        <section className="py-12 px-6 reveal">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-3 px-6 py-3 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-gray-300">
                כבר נרשמו <span className="text-[#00d4ff] font-bold" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{waitlistCount}</span> עסקים לרשימת ההמתנה
              </span>
            </div>
          </div>
        </section>
      )}

      {/* ═══════════ FAQ ═══════════ */}
      <section className="py-16 md:py-24 px-6 reveal">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold mb-12 text-center">שאלות נפוצות</h2>
          <div className="space-y-0">
            {FAQ_ITEMS.map((item, i) => (
              <div key={i} className="border-b border-white/[0.06] last:border-b-0">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between py-5 text-start group"
                >
                  <span className="font-medium text-sm text-gray-200 group-hover:text-white transition-colors">{item.q}</span>
                  <ChevronDown className={`w-4 h-4 text-gray-500 shrink-0 ms-4 transition-transform duration-300 ${openFaq === i ? 'rotate-180 text-[#00d4ff]' : ''}`} />
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

      {/* ═══════════ FOOTER ═══════════ */}
      <footer className="py-8 px-6 border-t border-white/[0.04]">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-sm text-gray-500">
          <div className="flex items-center gap-2">
            <img src="/logo-icon-only.svg" alt="" className="w-5 h-5 opacity-50" />
            <span>Quieteyes &copy; 2026</span>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/')} className="hover:text-gray-300 transition-colors">דף הבית</button>
            <a href="#" className="hover:text-gray-300 transition-colors">פרטיות</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
