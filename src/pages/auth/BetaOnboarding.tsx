import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../services/api';
import { Loader2, Check, Sparkles, Target, Users, BarChart3, Zap } from 'lucide-react';

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

const BETA_PERKS = [
  'גישה מלאה לכל הפיצ\'רים',
  '50% הנחה על 3 חודשים ראשונים',
  'תג "משתמש בטא מייסד" לנצח',
  'גישה ישירה למייסדים',
];

const PRIORITIES = [
  { id: 'leads', label: 'גילוי לידים חמים', icon: Target },
  { id: 'competitors', label: 'מעקב מתחרים', icon: Users },
  { id: 'market', label: 'מודיעין שוק', icon: BarChart3 },
  { id: 'automations', label: 'אוטומציות שיווקיות', icon: Zap },
];

const steps = [
  { num: 1, label: 'ברוכים הבאים' },
  { num: 2, label: 'פרטי עסק' },
  { num: 3, label: 'אתר ופעילות' },
  { num: 4, label: 'אסטרטגיה' },
  { num: 5, label: 'סדר עדיפויות' },
];

/* ═══════════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════════════════ */

export default function BetaOnboarding() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 2: Business details
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');

  // Step 3: Website + analysis
  const [websiteUrl, setWebsiteUrl] = useState('');

  // Step 4: Strategy
  const [mainChallenge, setMainChallenge] = useState('');
  const [competitors, setCompetitors] = useState(['', '', '']);

  // Step 5: Beta-specific priorities
  const [selectedPriorities, setSelectedPriorities] = useState<string[]>([]);
  const [expectations, setExpectations] = useState('');

  const next = () => {
    if (currentStep === 2 && (!businessName.trim() || !businessType)) {
      setError('נא למלא שם עסק וסוג');
      return;
    }
    setError(null);
    setCurrentStep(s => Math.min(s + 1, 5));
  };

  const back = () => {
    setError(null);
    setCurrentStep(s => Math.max(s - 1, 1));
  };

  const togglePriority = (id: string) => {
    setSelectedPriorities(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const handleSubmit = async () => {
    if (!user?.id) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const resolvedIndustry = businessType === 'other' ? 'other' : businessType;
      const competitorsList = competitors.filter(c => c.trim()).join(', ');

      // Call existing onboarding endpoint
      const response = await apiFetch('/onboard/wizard', {
        method: 'POST',
        body: JSON.stringify({
          user_id: user.id,
          business_name: businessName,
          address: city,
          industry: resolvedIndustry,
          website_url: websiteUrl || null,
          exact_address: address || null,
          phone: phone || null,
          main_challenge: mainChallenge || null,
          competitors_list: competitorsList || null,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save business');
      }

      const result = await response.json();
      localStorage.setItem('qe_business_id', result.business_id);
      localStorage.setItem('qe_onboarding_done', 'true');
      localStorage.setItem('qe_beta_activated_at', new Date().toISOString());

      // Mark waitlist entry as activated (best effort)
      try {
        const email = user.email;
        if (email) {
          await apiFetch('/waitlist/activate', {
            method: 'POST',
            body: JSON.stringify({ email }),
          });
        }
      } catch {
        // Non-critical
      }

      // Submit initial feedback with priorities
      if (selectedPriorities.length > 0 || expectations.trim()) {
        try {
          await apiFetch('/feedback/submit', {
            method: 'POST',
            body: JSON.stringify({
              type: 'general',
              trigger: 'manual',
              message: `Beta priorities: ${selectedPriorities.join(', ')}. Expectations: ${expectations}`,
            }),
          });
        } catch {
          // Non-critical
        }
      }

      navigate('/dashboard/focus');
    } catch (err) {
      setError('השמירה נכשלה. נסה שוב.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 py-12 px-4" dir="rtl">
      <div className="w-full max-w-2xl">
        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            {steps.map(step => (
              <div key={step.num} className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                  step.num < currentStep ? 'bg-emerald-500 text-white' :
                  step.num === currentStep ? 'bg-indigo-600 text-white' :
                  'bg-gray-700 text-gray-400'
                }`}>
                  {step.num < currentStep ? <Check className="w-4 h-4" /> : step.num}
                </div>
                <span className={`text-xs hidden md:block ${step.num === currentStep ? 'text-white' : 'text-gray-500'}`}>
                  {step.label}
                </span>
              </div>
            ))}
          </div>
          <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 rounded-full transition-all duration-500"
              style={{ width: `${(currentStep / 5) * 100}%` }}
            />
          </div>
        </div>

        {/* Card */}
        <div className="glass-card p-8">

          {/* ═══════ Step 1: Welcome ═══════ */}
          {currentStep === 1 && (
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-cyan-400 mx-auto mb-6 flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold mb-2">ברוכים הבאים לבטא!</h2>
              <p className="text-gray-400 mb-8">הצטרפת לקבוצה מצומצמת של עסקים שמשתמשים ב-Quieteyes לפני כולם.</p>

              <div className="space-y-3 text-start mb-8">
                {BETA_PERKS.map((perk, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-gray-800/30 border border-gray-700/30">
                    <Check className="w-5 h-5 text-emerald-400 shrink-0" />
                    <span className="text-gray-300 text-sm">{perk}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ═══════ Step 2: Business Details ═══════ */}
          {currentStep === 2 && (
            <div>
              <h2 className="text-xl font-bold mb-6">ספר לנו על העסק שלך</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-300 mb-1.5">שם העסק *</label>
                  <input
                    type="text"
                    value={businessName}
                    onChange={e => setBusinessName(e.target.value)}
                    className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                    placeholder="שם העסק שלך"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-300 mb-2">סוג העסק *</label>
                  <div className="grid grid-cols-4 gap-2">
                    {industries.map(ind => (
                      <button
                        key={ind.id}
                        type="button"
                        onClick={() => setBusinessType(ind.id)}
                        className={`p-3 rounded-xl border text-center transition-all ${
                          businessType === ind.id
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

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-300 mb-1.5">עיר</label>
                    <input
                      type="text"
                      value={city}
                      onChange={e => setCity(e.target.value)}
                      className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                      placeholder="תל אביב"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-300 mb-1.5">טלפון</label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                      placeholder="050-1234567"
                      dir="ltr"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-gray-300 mb-1.5">כתובת מדויקת (אופציונלי)</label>
                  <input
                    type="text"
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                    className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                    placeholder="רחוב, מספר"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ═══════ Step 3: Website + AI Analysis ═══════ */}
          {currentStep === 3 && (
            <div>
              <h2 className="text-xl font-bold mb-6">אתר ופעילות אונליין</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-300 mb-1.5">כתובת אתר (אופציונלי)</label>
                  <input
                    type="url"
                    value={websiteUrl}
                    onChange={e => setWebsiteUrl(e.target.value)}
                    className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                    placeholder="https://your-business.com"
                    dir="ltr"
                  />
                  <p className="text-xs text-gray-500 mt-1.5">
                    אם תזין כתובת, ה-AI שלנו ינתח את האתר ויבנה פרופיל עסקי חכם.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ═══════ Step 4: Strategy ═══════ */}
          {currentStep === 4 && (
            <div>
              <h2 className="text-xl font-bold mb-6">אסטרטגיה ומתחרים</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-300 mb-2">מה האתגר העיקרי שלך?</label>
                  <div className="grid grid-cols-1 gap-2">
                    {[
                      { id: 'customers', label: 'למשוך לקוחות חדשים' },
                      { id: 'competition', label: 'להתמודד עם מתחרים' },
                      { id: 'retention', label: 'לשמר לקוחות קיימים' },
                      { id: 'pricing', label: 'לתמחר נכון' },
                      { id: 'growth', label: 'לצמוח ולהתרחב' },
                    ].map(ch => (
                      <button
                        key={ch.id}
                        type="button"
                        onClick={() => setMainChallenge(ch.id)}
                        className={`px-4 py-3 rounded-xl border text-start text-sm transition-all ${
                          mainChallenge === ch.id
                            ? 'bg-indigo-600/20 border-indigo-500/40 text-white'
                            : 'bg-gray-800/30 border-gray-700/30 text-gray-400 hover:border-gray-600'
                        }`}
                      >
                        {ch.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-gray-300 mb-2">מתחרים עיקריים (אופציונלי)</label>
                  <div className="space-y-2">
                    {competitors.map((comp, i) => (
                      <input
                        key={i}
                        type="text"
                        value={comp}
                        onChange={e => {
                          const updated = [...competitors];
                          updated[i] = e.target.value;
                          setCompetitors(updated);
                        }}
                        className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                        placeholder={`מתחרה ${i + 1}`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══════ Step 5: Beta Priorities ═══════ */}
          {currentStep === 5 && (
            <div>
              <h2 className="text-xl font-bold mb-2">מה הכי חשוב לך?</h2>
              <p className="text-gray-400 text-sm mb-6">בחר את התחומים שהכי מעניינים אותך (בחר כמה שתרצה)</p>

              <div className="grid grid-cols-2 gap-3 mb-6">
                {PRIORITIES.map(p => {
                  const Icon = p.icon;
                  const selected = selectedPriorities.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => togglePriority(p.id)}
                      className={`p-4 rounded-xl border text-start transition-all ${
                        selected
                          ? 'bg-indigo-600/20 border-indigo-500/40'
                          : 'bg-gray-800/30 border-gray-700/30 hover:border-gray-600'
                      }`}
                    >
                      <Icon className={`w-6 h-6 mb-2 ${selected ? 'text-indigo-400' : 'text-gray-500'}`} />
                      <span className={`text-sm ${selected ? 'text-white' : 'text-gray-400'}`}>{p.label}</span>
                    </button>
                  );
                })}
              </div>

              <div>
                <label className="block text-sm text-gray-300 mb-1.5">ציפיות ובקשות (אופציונלי)</label>
                <textarea
                  value={expectations}
                  onChange={e => setExpectations(e.target.value)}
                  className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 resize-none"
                  rows={3}
                  placeholder="מה היית רוצה שנפתור לך? מה הכי חשוב?"
                />
              </div>
            </div>
          )}

          {/* Error */}
          {error && <p className="text-red-400 text-sm text-center mt-4">{error}</p>}

          {/* Navigation buttons */}
          <div className="flex gap-3 mt-8">
            {currentStep > 1 && (
              <button
                onClick={back}
                className="flex-1 py-3 rounded-xl text-sm font-medium text-gray-300 bg-gray-700/50 hover:bg-gray-600/50 transition-colors"
              >
                חזור
              </button>
            )}
            {currentStep < 5 ? (
              <button
                onClick={next}
                className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition-all"
              >
                המשך
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-500 text-white font-bold transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmitting && <Loader2 className="w-5 h-5 animate-spin" />}
                סיים וכנס לדשבורד
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
