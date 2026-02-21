import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSimulation } from '../../context/SimulationContext';
import { onboardBusiness } from '../../services/api';
import {
  Brain, Sparkles, Building, Users, ChevronLeft, Check, AlertCircle,
  Target, DollarSign, Briefcase, Heart, Zap
} from 'lucide-react';

const archetypes = [
  { id: 'Visual', name: 'ויזואלי', description: 'עסקים שמוכרים דרך תמונות - מסעדות, אופנה, עיצוב', icon: '🎨' },
  { id: 'Expert', name: 'מומחה', description: 'שירותים מקצועיים - עורכי דין, רופאים, יועצים', icon: '🎓' },
  { id: 'Field', name: 'שטח', description: 'עסקים עם אזור שירות - שליחויות, שיפוצים, ניקיון', icon: '🚚' },
  { id: 'Merchant', name: 'סוחר', description: 'קמעונאות ומכירות - חנויות, מכירות אונליין', icon: '🛒' },
];

const priceTiers = [
  { id: 'budget', name: 'תקציבי', description: 'מחירים נמוכים, נפח גבוה', icon: '💰' },
  { id: 'mid', name: 'ביניים', description: 'איזון בין מחיר לאיכות', icon: '⚖️' },
  { id: 'premium', name: 'פרימיום', description: 'איכות גבוהה, מחירים גבוהים', icon: '👑' },
];

const businessSizes = [
  { id: 'solo', name: 'עצמאי', description: 'אני לבד' },
  { id: 'small', name: 'קטן', description: '2-10 עובדים' },
  { id: 'medium', name: 'בינוני', description: '11-50 עובדים' },
  { id: 'large', name: 'גדול', description: '50+ עובדים' },
];

const goalOptions = [
  { id: 'sales', label: 'הגדלת מכירות', icon: '📈' },
  { id: 'brand', label: 'בניית מותג', icon: '🏆' },
  { id: 'customers', label: 'גיוס לקוחות חדשים', icon: '👥' },
  { id: 'retention', label: 'שימור לקוחות', icon: '🤝' },
  { id: 'expansion', label: 'הרחבת העסק', icon: '🚀' },
  { id: 'online', label: 'נוכחות דיגיטלית', icon: '🌐' },
];

const valueOptions = [
  { id: 'quality', label: 'איכות', icon: '⭐' },
  { id: 'service', label: 'שירותיות', icon: '🤗' },
  { id: 'innovation', label: 'חדשנות', icon: '💡' },
  { id: 'trust', label: 'אמינות', icon: '🛡️' },
  { id: 'speed', label: 'מהירות', icon: '⚡' },
  { id: 'personal', label: 'יחס אישי', icon: '❤️' },
];

type OnboardingStep = 'describe' | 'archetype' | 'profile' | 'competitor';

export default function Onboarding() {
  const { user } = useAuth();
  const { currentProfile, refreshProfile } = useSimulation();
  const navigate = useNavigate();

  // Basic info
  const [businessDescription, setBusinessDescription] = useState('');
  const [competitor, setCompetitor] = useState('');
  const [selectedArchetype, setSelectedArchetype] = useState<string | null>(null);

  // Deep profile fields
  const [targetAudience, setTargetAudience] = useState('');
  const [uniqueSellingPoint, setUniqueSellingPoint] = useState('');
  const [priceTier, setPriceTier] = useState<string | null>(null);
  const [businessSize, setBusinessSize] = useState<string | null>(null);
  const [mainGoals, setMainGoals] = useState<string[]>([]);
  const [values, setValues] = useState<string[]>([]);

  // UI state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [step, setStep] = useState<OnboardingStep>('describe');
  const [brainPulse, setBrainPulse] = useState(false);
  const [detectedIndustry, setDetectedIndustry] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Brain pulse animation on typing
  useEffect(() => {
    if (businessDescription.length > 0) {
      setBrainPulse(true);
      const timer = setTimeout(() => setBrainPulse(false), 300);
      return () => clearTimeout(timer);
    }
  }, [businessDescription]);

  const toggleGoal = (goalId: string) => {
    setMainGoals(prev =>
      prev.includes(goalId)
        ? prev.filter(g => g !== goalId)
        : [...prev, goalId]
    );
  };

  const toggleValue = (valueId: string) => {
    setValues(prev =>
      prev.includes(valueId)
        ? prev.filter(v => v !== valueId)
        : [...prev, valueId]
    );
  };

  const handleAnalyze = async () => {
    if (!businessDescription.trim() || !user?.id) return;
    setIsAnalyzing(true);
    setError(null);

    try {
      const response = await onboardBusiness(businessDescription, user.id);
      console.log('Onboard Response:', response);

      setDetectedIndustry(response.business.name_hebrew);
      setSelectedArchetype(response.business.archetype);
      await refreshProfile();
      console.log('Business created:', response.business.name_hebrew);

    } catch (err) {
      console.error('Onboard Error:', err);
      setError(err instanceof Error ? err.message : 'שגיאה ביצירת העסק');
      setIsAnalyzing(false);
      return;
    }

    setIsAnalyzing(false);
    setStep('archetype');
  };

  const handleSelectArchetype = (archetypeId: string) => {
    setSelectedArchetype(archetypeId);
    setStep('profile');
  };

  const handleSaveProfile = async () => {
    if (!currentProfile?.id) return;

    setIsSavingProfile(true);
    setError(null);

    try {
      // Save deep profile to backend
      const response = await fetch(`http://localhost:8015/business/profile/${currentProfile.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_audience: targetAudience,
          unique_selling_point: uniqueSellingPoint,
          price_tier: priceTier,
          business_size: businessSize,
          main_goals: mainGoals.map(g => goalOptions.find(o => o.id === g)?.label || g),
          values: values.map(v => valueOptions.find(o => o.id === v)?.label || v),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save profile');
      }

      await refreshProfile();
      setStep('competitor');

    } catch (err) {
      console.error('Profile save error:', err);
      setError(err instanceof Error ? err.message : 'שגיאה בשמירת הפרופיל');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleComplete = () => {
    console.log('Navigating to dashboard with profile:', currentProfile?.nameHebrew);
    navigate('/dashboard/focus');
  };

  const canProceedFromProfile = priceTier && businessSize && mainGoals.length > 0;

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Brain Animation */}
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/30 via-purple-900/20 to-transparent" />

        <div className="relative">
          <div className={"relative w-64 h-64 rounded-full flex items-center justify-center transition-all duration-300 " + (brainPulse ? "scale-105" : "scale-100")}>
            <div className="absolute inset-0 rounded-full border-2 border-indigo-500/30 animate-ping" style={{ animationDuration: '3s' }} />
            <div className="absolute inset-4 rounded-full border border-purple-500/20 animate-pulse" />
            <div className="absolute inset-8 rounded-full border border-indigo-500/10" />

            <div className={(isAnalyzing || isSavingProfile ? "w-40 h-40 rounded-full bg-gradient-to-br from-indigo-600 to-purple-700 flex items-center justify-center glow-pulse" : "w-40 h-40 rounded-full bg-gradient-to-br from-indigo-600 to-purple-700 flex items-center justify-center glow-primary")}>
              <Brain className={"w-20 h-20 text-white transition-all duration-300 " + (brainPulse || isAnalyzing ? "scale-110" : "")} />
            </div>
          </div>

          <div className="absolute -top-4 -right-4 w-8 h-8 rounded-full bg-indigo-500/30 animate-bounce" style={{ animationDelay: '0s' }} />
          <div className="absolute -bottom-8 -left-8 w-6 h-6 rounded-full bg-purple-500/30 animate-bounce" style={{ animationDelay: '0.5s' }} />
          <div className="absolute top-1/2 -left-12 w-4 h-4 rounded-full bg-pink-500/30 animate-bounce" style={{ animationDelay: '1s' }} />
        </div>

        <div className="absolute bottom-12 text-center w-full">
          {isAnalyzing ? (
            <div className="flex items-center justify-center gap-2 text-indigo-400">
              <Sparkles className="w-5 h-5 animate-spin" />
              <span>מנתח את העסק שלך...</span>
            </div>
          ) : isSavingProfile ? (
            <div className="flex items-center justify-center gap-2 text-indigo-400">
              <Sparkles className="w-5 h-5 animate-spin" />
              <span>שומר את הפרופיל...</span>
            </div>
          ) : detectedIndustry ? (
            <div className="flex items-center justify-center gap-2 text-emerald-400">
              <Check className="w-5 h-5" />
              <span>זיהינו: {detectedIndustry} {currentProfile?.emoji}</span>
            </div>
          ) : (
            <p className="text-gray-500">המוח לומד על העסק שלך</p>
          )}
        </div>

        {/* Step indicator */}
        <div className="absolute top-8 left-1/2 -translate-x-1/2 flex items-center gap-2">
          {['describe', 'archetype', 'profile', 'competitor'].map((s, i) => (
            <div
              key={s}
              className={`w-2.5 h-2.5 rounded-full transition-all ${
                step === s ? 'bg-indigo-500 w-6' :
                ['describe', 'archetype', 'profile', 'competitor'].indexOf(step) > i ? 'bg-emerald-500' : 'bg-gray-600'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="flex-1 flex items-center justify-center p-8 overflow-y-auto">
        <div className="w-full max-w-md">
          {/* Step 1: Describe Business */}
          {step === 'describe' && (
            <div className="fade-in space-y-6">
              <div>
                <h1 className="text-3xl font-bold text-white mb-2">ספר לנו על העסק שלך</h1>
                <p className="text-gray-400">תאר את העסק במשפט אחד, והמוח שלנו ילמד להבין אותך</p>
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center gap-3 text-red-400">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <p className="text-sm">{error}</p>
                </div>
              )}

              <div className="space-y-4">
                <div className="relative">
                  <Building className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="text"
                    value={businessDescription}
                    onChange={(e) => setBusinessDescription(e.target.value)}
                    placeholder='לדוגמה: "אני מנהל מספרה בתל אביב"'
                    className="input-glass pr-12"
                    dir="rtl"
                  />
                </div>

                <div className="space-y-2">
                  <p className="text-gray-500 text-sm">בחר סוג עסק לבדיקה:</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setBusinessDescription('אני מנהל מספרה בתל אביב')}
                      className={"px-4 py-2 rounded-full text-sm font-medium transition-all " + (businessDescription.includes('מספרה') ? "bg-purple-500 text-white" : "bg-purple-500/20 text-purple-400 hover:bg-purple-500/30")}
                    >
                      💈 מספרה
                    </button>
                    <button
                      onClick={() => setBusinessDescription('אני עורך דין בחיפה')}
                      className={"px-4 py-2 rounded-full text-sm font-medium transition-all " + (businessDescription.includes('עורך דין') ? "bg-blue-500 text-white" : "bg-blue-500/20 text-blue-400 hover:bg-blue-500/30")}
                    >
                      ⚖️ עורך דין
                    </button>
                    <button
                      onClick={() => setBusinessDescription('יש לי פיצרייה בחדרה')}
                      className={"px-4 py-2 rounded-full text-sm font-medium transition-all " + (businessDescription.includes('פיצ') ? "bg-orange-500 text-white" : "bg-orange-500/20 text-orange-400 hover:bg-orange-500/30")}
                    >
                      🍕 פיצרייה
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleAnalyze}
                  disabled={!businessDescription.trim() || isAnalyzing}
                  className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isAnalyzing ? (
                    <>
                      <Sparkles className="w-5 h-5 animate-spin" />
                      <span>מנתח...</span>
                    </>
                  ) : (
                    <>
                      <span>נתח את העסק</span>
                      <ChevronLeft className="w-5 h-5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Select Archetype */}
          {step === 'archetype' && (
            <div className="fade-in space-y-6">
              <div>
                <h1 className="text-3xl font-bold text-white mb-2">זיהינו את הסגנון שלך</h1>
                <p className="text-gray-400">
                  <span className="text-emerald-400">זיהינו: {detectedIndustry} {currentProfile?.emoji}</span>
                  <br />
                  בחר את הארכיטיפ שמתאים לך ביותר
                </p>
              </div>

              <div className="space-y-3">
                {archetypes.map((archetype) => (
                  <button
                    key={archetype.id}
                    onClick={() => handleSelectArchetype(archetype.id)}
                    className={"w-full glass-card p-4 text-right transition-all duration-300 " + (selectedArchetype === archetype.id ? "border-indigo-500 bg-indigo-500/10" : "hover:border-gray-600")}
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-3xl">{archetype.icon}</span>
                      <div className="flex-1">
                        <h3 className="font-semibold text-white">{archetype.name}</h3>
                        <p className="text-sm text-gray-400">{archetype.description}</p>
                      </div>
                      {selectedArchetype === archetype.id && (
                        <Check className="w-5 h-5 text-emerald-400" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Deep Profile */}
          {step === 'profile' && (
            <div className="fade-in space-y-6">
              <div>
                <h1 className="text-3xl font-bold text-white mb-2">בואו נכיר אותך יותר לעומק</h1>
                <p className="text-gray-400">המידע הזה יעזור לנו לתת לך תובנות מדויקות יותר</p>
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center gap-3 text-red-400">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <p className="text-sm">{error}</p>
                </div>
              )}

              <div className="space-y-5">
                {/* Target Audience */}
                <div>
                  <label className="flex items-center gap-2 text-white font-medium mb-2">
                    <Target className="w-4 h-4 text-indigo-400" />
                    קהל יעד
                  </label>
                  <input
                    type="text"
                    value={targetAudience}
                    onChange={(e) => setTargetAudience(e.target.value)}
                    placeholder="לדוגמה: צעירים בגילאי 20-35, משפחות..."
                    className="input-glass w-full"
                    dir="rtl"
                  />
                </div>

                {/* Unique Selling Point */}
                <div>
                  <label className="flex items-center gap-2 text-white font-medium mb-2">
                    <Zap className="w-4 h-4 text-amber-400" />
                    מה מייחד אותך?
                  </label>
                  <input
                    type="text"
                    value={uniqueSellingPoint}
                    onChange={(e) => setUniqueSellingPoint(e.target.value)}
                    placeholder="לדוגמה: שירות 24/7, מחירים הכי טובים..."
                    className="input-glass w-full"
                    dir="rtl"
                  />
                </div>

                {/* Price Tier */}
                <div>
                  <label className="flex items-center gap-2 text-white font-medium mb-2">
                    <DollarSign className="w-4 h-4 text-emerald-400" />
                    רמת מחירים
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {priceTiers.map((tier) => (
                      <button
                        key={tier.id}
                        onClick={() => setPriceTier(tier.id)}
                        className={`p-3 rounded-xl border text-center transition-all ${
                          priceTier === tier.id
                            ? 'border-indigo-500 bg-indigo-500/20 text-white'
                            : 'border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-600'
                        }`}
                      >
                        <span className="text-xl block mb-1">{tier.icon}</span>
                        <span className="text-sm font-medium">{tier.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Business Size */}
                <div>
                  <label className="flex items-center gap-2 text-white font-medium mb-2">
                    <Briefcase className="w-4 h-4 text-purple-400" />
                    גודל העסק
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {businessSizes.map((size) => (
                      <button
                        key={size.id}
                        onClick={() => setBusinessSize(size.id)}
                        className={`p-2 rounded-xl border text-center transition-all ${
                          businessSize === size.id
                            ? 'border-indigo-500 bg-indigo-500/20 text-white'
                            : 'border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-600'
                        }`}
                      >
                        <span className="text-xs font-medium block">{size.name}</span>
                        <span className="text-[10px] text-gray-500">{size.description}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Main Goals */}
                <div>
                  <label className="flex items-center gap-2 text-white font-medium mb-2">
                    <Target className="w-4 h-4 text-rose-400" />
                    מטרות עיקריות (בחר לפחות אחת)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {goalOptions.map((goal) => (
                      <button
                        key={goal.id}
                        onClick={() => toggleGoal(goal.id)}
                        className={`px-3 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-1.5 ${
                          mainGoals.includes(goal.id)
                            ? 'bg-indigo-500 text-white'
                            : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                        }`}
                      >
                        <span>{goal.icon}</span>
                        <span>{goal.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Values */}
                <div>
                  <label className="flex items-center gap-2 text-white font-medium mb-2">
                    <Heart className="w-4 h-4 text-pink-400" />
                    ערכים (אופציונלי)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {valueOptions.map((value) => (
                      <button
                        key={value.id}
                        onClick={() => toggleValue(value.id)}
                        className={`px-3 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-1.5 ${
                          values.includes(value.id)
                            ? 'bg-purple-500 text-white'
                            : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                        }`}
                      >
                        <span>{value.icon}</span>
                        <span>{value.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleSaveProfile}
                  disabled={!canProceedFromProfile || isSavingProfile}
                  className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mt-4"
                >
                  {isSavingProfile ? (
                    <>
                      <Sparkles className="w-5 h-5 animate-spin" />
                      <span>שומר...</span>
                    </>
                  ) : (
                    <>
                      <span>המשך</span>
                      <ChevronLeft className="w-5 h-5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Competitor */}
          {step === 'competitor' && (
            <div className="fade-in space-y-6">
              <div>
                <h1 className="text-3xl font-bold text-white mb-2">מי המתחרה העיקרי שלך?</h1>
                <p className="text-gray-400">זה יעזור לנו לעקוב אחרי השוק שלך (אופציונלי)</p>
              </div>

              <div className="space-y-4">
                <div className="relative">
                  <Users className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="text"
                    value={competitor}
                    onChange={(e) => setCompetitor(e.target.value)}
                    placeholder="שם המתחרה"
                    className="input-glass pr-12"
                    dir="rtl"
                  />
                </div>

                <button
                  onClick={handleComplete}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  <span>סיים והתחל {currentProfile?.emoji}</span>
                  <ChevronLeft className="w-5 h-5" />
                </button>

                <button
                  onClick={handleComplete}
                  className="w-full text-center text-gray-400 hover:text-white transition-colors"
                >
                  דלג לעכשיו
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
