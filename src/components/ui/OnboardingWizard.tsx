import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSimulation } from '../../context/SimulationContext';
import {
  Check,
  Loader2,
  Eye,
  Mail,
  FileText,
  Clock,
  MessageCircle,
  ArrowLeft,
  Users,
  Star,
  BarChart3,
  Timer,
} from 'lucide-react';
import { apiFetch } from '../../services/api';

// ── Mock competitor data ─────────────────────────────────────────────────────

const MOCK_COMPETITORS = [
  { name: 'קפה רוטשילד', rating: 4.2, distance: '300 מ\'' },
  { name: 'סלון ביוטי פלוס', rating: 3.8, distance: '500 מ\'' },
  { name: 'מספרת הכיכר', rating: 4.5, distance: '200 מ\'' },
  { name: 'סטודיו פיט', rating: 3.6, distance: '800 מ\'' },
  { name: 'דליקטסן השכונה', rating: 4.0, distance: '650 מ\'' },
];

// ── Types ────────────────────────────────────────────────────────────────────

interface RegistrationData {
  firstName: string;
  lastName: string;
  phone: string;
  businessName: string;
  businessType: string;
  customIndustry?: string;
  businessAddress: string;
  latitude: number | null;
  longitude: number | null;
  activityRadius: number;
}

interface CompetitorCard {
  name: string;
  rating: number;
  distance: string;
  checked: boolean;
}

interface NotificationPrefs {
  whatsapp: boolean;
  email: boolean;
  weeklyReport: boolean;
  morningTime: string;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function OnboardingWizard() {
  const { user } = useAuth();
  const { refreshProfile } = useSimulation();
  const navigate = useNavigate();

  const [currentStep, setCurrentStep] = useState(1);

  // Step 1 state
  const [isScanning, setIsScanning] = useState(true);
  const [scanProgress, setScanProgress] = useState(0);
  const [apiDone, setApiDone] = useState(false);
  const [showCompetitors, setShowCompetitors] = useState(false);
  const [competitors, setCompetitors] = useState<CompetitorCard[]>([]);
  const [competitorsFound, setCompetitorsFound] = useState(4);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [registrationPhone, setRegistrationPhone] = useState('');

  // Step 2 state
  const [notifPrefs, setNotifPrefs] = useState<NotificationPrefs>({
    whatsapp: true,
    email: true,
    weeklyReport: false,
    morningTime: '09:00',
  });

  // Step 3 state
  const [isSavingPrefs, setIsSavingPrefs] = useState(false);
  const [step3Ready, setStep3Ready] = useState(false);

  // ── Step 1: Create business and scan ─────────────────────────────────────

  useEffect(() => {
    if (currentStep !== 1) return;

    let cancelled = false;

    const createBusiness = async () => {
      const raw = localStorage.getItem('qe_registration_data');
      if (!raw || !user?.id) return;

      let data: RegistrationData;
      try {
        data = JSON.parse(raw);
      } catch {
        return;
      }

      setRegistrationPhone(data.phone || '');

      try {
        const response = await apiFetch('/onboard/wizard', {
          method: 'POST',
          body: JSON.stringify({
            user_id: user.id,
            business_name: data.businessName,
            address: data.businessAddress,
            industry: data.businessType === 'other' ? data.customIndustry : data.businessType,
            phone: data.phone,
            first_name: data.firstName,
            last_name: data.lastName,
            business_type: data.businessType,
            activity_radius_km: data.activityRadius,
            latitude: data.latitude,
            longitude: data.longitude,
          }),
        });

        if (!response.ok) throw new Error('Failed to create business');

        const result = await response.json();
        if (!cancelled) {
          localStorage.setItem('qe_business_id', result.business_id);
          setBusinessId(result.business_id);
          if (result.leads_found) {
            setCompetitorsFound(result.leads_found);
          }
          setApiDone(true);
        }
      } catch (err) {
        console.error('Onboarding wizard API error:', err);
        if (!cancelled) {
          setApiDone(true);
        }
      }
    };

    createBusiness();
    return () => { cancelled = true; };
  }, [currentStep, user?.id]);

  // Scan progress animation
  useEffect(() => {
    if (currentStep !== 1 || !isScanning) return;

    let frame: number;
    const startTime = Date.now();

    const tick = () => {
      const elapsed = Date.now() - startTime;
      let progress: number;

      if (elapsed < 3000) {
        // 0-80% in first 3 seconds
        progress = (elapsed / 3000) * 80;
      } else {
        // 80-95% slowly after that
        const extra = elapsed - 3000;
        progress = 80 + Math.min(15, (extra / 10000) * 15);
      }

      setScanProgress(Math.min(progress, 95));
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [currentStep, isScanning]);

  // Transition from scanning to competitor cards after minimum delay
  useEffect(() => {
    if (!apiDone || !isScanning) return;

    const minDelay = 3000 + Math.random() * 2000; // 3-5 seconds total minimum
    const timer = setTimeout(() => {
      setScanProgress(100);
      setTimeout(() => {
        setIsScanning(false);
        // Reveal competitor cards with staggered animation
        const cards = MOCK_COMPETITORS.map(c => ({ ...c, checked: true }));
        setCompetitors(cards);
        setShowCompetitors(true);
      }, 400);
    }, minDelay);

    return () => clearTimeout(timer);
  }, [apiDone, isScanning]);

  // ── Step 3: Save preferences and finish ──────────────────────────────────

  const savePreferencesAndFinish = useCallback(async () => {
    const bId = businessId || localStorage.getItem('qe_business_id');
    if (!bId) return;

    setIsSavingPrefs(true);
    try {
      await apiFetch(`/business/profile/${bId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          notification_whatsapp: notifPrefs.whatsapp,
          notification_email: notifPrefs.email,
          notification_weekly_report: notifPrefs.weeklyReport,
          morning_alert_time: notifPrefs.morningTime,
          whatsapp_number: registrationPhone,
          onboarding_completed: true,
        }),
      });
    } catch (err) {
      console.error('Failed to save notification prefs:', err);
    }

    localStorage.setItem('qe_onboarding_done', 'true');
    await refreshProfile();
    setIsSavingPrefs(false);
    setStep3Ready(true);
  }, [businessId, notifPrefs, registrationPhone, refreshProfile]);

  useEffect(() => {
    if (currentStep === 3 && !step3Ready && !isSavingPrefs) {
      savePreferencesAndFinish();
    }
  }, [currentStep, step3Ready, isSavingPrefs, savePreferencesAndFinish]);

  // ── Helpers ──────────────────────────────────────────────────────────────

  const toggleCompetitor = (index: number) => {
    setCompetitors(prev =>
      prev.map((c, i) => (i === index ? { ...c, checked: !c.checked } : c))
    );
  };

  const maskPhone = (phone: string): string => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 7) return phone;
    return digits.slice(0, 3) + '-XXX-' + digits.slice(-4);
  };

  const timeOptions = ['07:00', '08:00', '09:00', '10:00'];

  // ── Step indicator ─────────────────────────────────────────────────────

  const steps = [
    { num: 1, label: 'מוצאים מתחרים' },
    { num: 2, label: 'מגדירים התראות' },
    { num: 3, label: 'הפלטפורמה מוכנה!' },
  ];

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center mb-10">
      {steps.map((step, index) => (
        <div key={step.num} className="flex items-center">
          <div className="flex flex-col items-center">
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center font-semibold text-lg transition-all duration-300 ${
                step.num === currentStep
                  ? 'bg-gradient-to-br from-cyan-500 to-indigo-600 text-white shadow-lg shadow-cyan-500/30 scale-110'
                  : step.num < currentStep
                  ? 'bg-emerald-500 text-white'
                  : 'bg-gray-800 text-gray-500 border border-gray-700'
              }`}
            >
              {step.num < currentStep ? <Check className="w-6 h-6" /> : step.num}
            </div>
            <span
              className={`mt-2 text-xs sm:text-sm font-medium text-center max-w-[80px] sm:max-w-none ${
                step.num === currentStep ? 'text-cyan-400' : step.num < currentStep ? 'text-emerald-400' : 'text-gray-500'
              }`}
            >
              {step.label}
            </span>
          </div>
          {index < steps.length - 1 && (
            <div
              className={`w-12 sm:w-20 h-0.5 mx-2 sm:mx-4 transition-colors duration-300 ${
                step.num < currentStep ? 'bg-emerald-500' : 'bg-gray-800'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );

  // ── Step 1 Render ──────────────────────────────────────────────────────

  const renderStep1 = () => {
    if (isScanning) {
      return (
        <div className="animate-fadeIn text-center py-8">
          {/* Radar animation */}
          <div className="relative w-40 h-40 mx-auto mb-8">
            {/* Grid background */}
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 160 160">
              <defs>
                <pattern id="scan-grid" width="20" height="20" patternUnits="userSpaceOnUse">
                  <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(0,212,255,0.06)" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width="160" height="160" fill="url(#scan-grid)" rx="80" />
            </svg>

            {/* Pulsing circles */}
            <div className="absolute inset-0 rounded-full border border-cyan-500/20 animate-ping" style={{ animationDuration: '2.5s' }} />
            <div className="absolute inset-4 rounded-full border border-cyan-500/15 animate-ping" style={{ animationDuration: '3s', animationDelay: '0.5s' }} />
            <div className="absolute inset-8 rounded-full border border-cyan-500/10 animate-ping" style={{ animationDuration: '3.5s', animationDelay: '1s' }} />

            {/* Radar sweep */}
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 160 160">
              <circle cx="80" cy="80" r="70" fill="none" stroke="rgba(0,212,255,0.15)" strokeWidth="1" />
              <circle cx="80" cy="80" r="45" fill="none" stroke="rgba(0,212,255,0.12)" strokeWidth="1" />
              <circle cx="80" cy="80" r="20" fill="none" stroke="rgba(0,212,255,0.08)" strokeWidth="1" />
              <circle cx="80" cy="80" r="4" fill="#00d4ff" opacity="0.8" />
              <g>
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  from="0 80 80"
                  to="360 80 80"
                  dur="3s"
                  repeatCount="indefinite"
                />
                <defs>
                  <linearGradient id="sweep-grad" gradientTransform="rotate(90)">
                    <stop offset="0%" stopColor="#00d4ff" stopOpacity="0" />
                    <stop offset="100%" stopColor="#00d4ff" stopOpacity="0.25" />
                  </linearGradient>
                </defs>
                <path d="M 80,80 L 80,10 A 70,70 0 0,1 129.5,31 Z" fill="url(#sweep-grad)" />
                <line x1="80" y1="80" x2="80" y2="10" stroke="#00d4ff" strokeWidth="1.5" opacity="0.6" />
              </g>
              {/* Blip dots */}
              <circle cx="55" cy="40" r="3" fill="#00d4ff" opacity="0">
                <animate attributeName="opacity" values="0;0.8;0" dur="3s" begin="0.3s" repeatCount="indefinite" />
              </circle>
              <circle cx="115" cy="65" r="2.5" fill="#00d4ff" opacity="0">
                <animate attributeName="opacity" values="0;0.6;0" dur="3s" begin="1s" repeatCount="indefinite" />
              </circle>
              <circle cx="45" cy="110" r="2" fill="#00d4ff" opacity="0">
                <animate attributeName="opacity" values="0;0.7;0" dur="3s" begin="2s" repeatCount="indefinite" />
              </circle>
            </svg>
          </div>

          <h2 className="text-2xl font-bold text-white mb-2">
            Quieteyes סורקת את האזור שלך...
          </h2>
          <p className="text-gray-400 mb-8">מחפשים עסקים דומים בקרבתך</p>

          {/* Progress bar */}
          <div className="w-64 mx-auto h-2 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-blue-600 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${scanProgress}%` }}
            />
          </div>
          <p className="text-gray-500 text-sm mt-2" dir="ltr">{Math.round(scanProgress)}%</p>
        </div>
      );
    }

    // Competitor cards view
    return (
      <div className="animate-fadeIn">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-white mb-2">אלה המתחרים שלך?</h2>
          <p className="text-gray-400">בטל סימון אם מישהו לא רלוונטי</p>
        </div>

        <div className="space-y-3">
          {competitors.map((comp, index) => (
            <div
              key={index}
              className="flex items-center gap-4 p-4 rounded-xl bg-gray-800/40 border border-gray-700/50 hover:border-gray-600/50 transition-all duration-300 cursor-pointer"
              style={{
                animation: `slideInRight 0.4s ease-out ${index * 0.12}s both`,
              }}
              onClick={() => toggleCompetitor(index)}
            >
              {/* Checkbox */}
              <div
                className={`w-6 h-6 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all duration-200 ${
                  comp.checked
                    ? 'bg-cyan-500 border-cyan-500'
                    : 'border-gray-600 bg-transparent'
                }`}
              >
                {comp.checked && <Check className="w-4 h-4 text-white" />}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <span className="text-white font-medium">{comp.name}</span>
              </div>

              {/* Rating */}
              <div className="flex items-center gap-1 text-amber-400 text-sm">
                <Star className="w-4 h-4 fill-current" />
                <span>{comp.rating}</span>
              </div>

              {/* Distance */}
              <span className="text-gray-500 text-sm whitespace-nowrap">{comp.distance}</span>
            </div>
          ))}
        </div>

        <button
          onClick={() => setCurrentStep(2)}
          className="w-full mt-8 flex items-center justify-center gap-2 px-8 py-3.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/40 hover:scale-[1.01] transition-all"
        >
          <span>המשך</span>
          <ArrowLeft className="w-5 h-5" />
        </button>
      </div>
    );
  };

  // ── Step 2 Render ──────────────────────────────────────────────────────

  const renderStep2 = () => (
    <div className="animate-fadeIn">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-white mb-2">איך תרצה לקבל התראות?</h2>
        <p className="text-gray-400">בחר את ערוצי ההתראה המועדפים עליך</p>
      </div>

      {/* Notification toggles */}
      <div className="space-y-3 mb-8">
        {/* WhatsApp */}
        <div
          className={`flex items-center gap-4 p-4 rounded-xl border transition-all duration-200 ${
            notifPrefs.whatsapp
              ? 'bg-emerald-500/5 border-emerald-500/30'
              : 'bg-gray-800/40 border-gray-700/50'
          }`}
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
            <MessageCircle className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-white font-medium">WhatsApp</span>
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full">מומלץ</span>
            </div>
            <p className="text-gray-500 text-sm mt-0.5">
              נשלח ל-{maskPhone(registrationPhone)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setNotifPrefs(p => ({ ...p, whatsapp: !p.whatsapp }))}
            className={`relative w-12 h-7 rounded-full transition-colors duration-200 flex-shrink-0 ${
              notifPrefs.whatsapp ? 'bg-emerald-500' : 'bg-gray-700'
            }`}
          >
            <div
              className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-all duration-200 ${
                notifPrefs.whatsapp ? 'left-1' : 'left-6'
              }`}
            />
          </button>
        </div>

        {/* Email */}
        <div
          className={`flex items-center gap-4 p-4 rounded-xl border transition-all duration-200 ${
            notifPrefs.email
              ? 'bg-blue-500/5 border-blue-500/30'
              : 'bg-gray-800/40 border-gray-700/50'
          }`}
        >
          <div className="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center flex-shrink-0">
            <Mail className="w-5 h-5 text-blue-400" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-white font-medium">אימייל</span>
            <p className="text-gray-500 text-sm mt-0.5">התראות ישירות למייל שלך</p>
          </div>
          <button
            type="button"
            onClick={() => setNotifPrefs(p => ({ ...p, email: !p.email }))}
            className={`relative w-12 h-7 rounded-full transition-colors duration-200 flex-shrink-0 ${
              notifPrefs.email ? 'bg-blue-500' : 'bg-gray-700'
            }`}
          >
            <div
              className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-all duration-200 ${
                notifPrefs.email ? 'left-1' : 'left-6'
              }`}
            />
          </button>
        </div>

        {/* Weekly PDF Report */}
        <div
          className={`flex items-center gap-4 p-4 rounded-xl border transition-all duration-200 ${
            notifPrefs.weeklyReport
              ? 'bg-orange-500/5 border-orange-500/30'
              : 'bg-gray-800/40 border-gray-700/50'
          }`}
        >
          <div className="w-10 h-10 rounded-xl bg-orange-500/15 flex items-center justify-center flex-shrink-0">
            <FileText className="w-5 h-5 text-orange-400" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-white font-medium">דוח שבועי PDF</span>
            <p className="text-gray-500 text-sm mt-0.5">סיכום שבועי מלא בפורמט PDF</p>
          </div>
          <button
            type="button"
            onClick={() => setNotifPrefs(p => ({ ...p, weeklyReport: !p.weeklyReport }))}
            className={`relative w-12 h-7 rounded-full transition-colors duration-200 flex-shrink-0 ${
              notifPrefs.weeklyReport ? 'bg-orange-500' : 'bg-gray-700'
            }`}
          >
            <div
              className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-all duration-200 ${
                notifPrefs.weeklyReport ? 'left-1' : 'left-6'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Morning time preference */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-cyan-400" />
          <span className="text-white font-medium">מתי לשלוח הודעת בוקר יומית?</span>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {timeOptions.map(time => (
            <button
              key={time}
              type="button"
              onClick={() => setNotifPrefs(p => ({ ...p, morningTime: time }))}
              className={`py-3 rounded-xl border text-center font-medium transition-all duration-200 ${
                notifPrefs.morningTime === time
                  ? 'border-cyan-500 bg-cyan-500/10 text-cyan-300 shadow-lg shadow-cyan-500/10'
                  : 'border-gray-700 bg-gray-800/40 text-gray-400 hover:border-gray-600 hover:text-gray-300'
              }`}
            >
              {time}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={() => setCurrentStep(3)}
        className="w-full flex items-center justify-center gap-2 px-8 py-3.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/40 hover:scale-[1.01] transition-all"
      >
        <span>המשך</span>
        <ArrowLeft className="w-5 h-5" />
      </button>
    </div>
  );

  // ── Step 3 Render ──────────────────────────────────────────────────────

  const renderStep3 = () => {
    if (isSavingPrefs || !step3Ready) {
      return (
        <div className="animate-fadeIn text-center py-12">
          <Loader2 className="w-12 h-12 text-cyan-400 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">שומר הגדרות...</p>
        </div>
      );
    }

    return (
      <div className="animate-fadeIn text-center">
        {/* Celebration animation */}
        <div className="relative w-28 h-28 mx-auto mb-8">
          {/* Outer glow */}
          <div
            className="absolute inset-0 rounded-full bg-cyan-500/20"
            style={{
              animation: 'celebrationPulse 2s ease-in-out infinite',
            }}
          />
          {/* Middle glow */}
          <div
            className="absolute inset-3 rounded-full bg-cyan-500/15"
            style={{
              animation: 'celebrationPulse 2s ease-in-out 0.3s infinite',
            }}
          />
          {/* Inner circle */}
          <div className="absolute inset-5 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-2xl shadow-cyan-500/40">
            <Check className="w-10 h-10 text-white" />
          </div>
        </div>

        <h2 className="text-3xl font-bold text-white mb-3">העסק שלך מחובר למודיעין</h2>
        <p className="text-gray-400 mb-8 leading-relaxed">
          הסריקה הראשונה תסתיים תוך ~12 שעות.
          <br />
          בינתיים, הנה מה שכבר יודעים על האזור שלך:
        </p>

        {/* Teaser stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          <div
            className="p-5 rounded-2xl bg-gray-800/40 border border-gray-700/50"
            style={{ animation: 'slideUp 0.5s ease-out 0.2s both' }}
          >
            <div className="w-10 h-10 rounded-xl bg-cyan-500/15 flex items-center justify-center mx-auto mb-3">
              <Users className="w-5 h-5 text-cyan-400" />
            </div>
            <p className="text-2xl font-bold text-white mb-1">{competitorsFound}</p>
            <p className="text-gray-500 text-sm">מתחרים זוהו באזורך</p>
          </div>

          <div
            className="p-5 rounded-2xl bg-gray-800/40 border border-gray-700/50"
            style={{ animation: 'slideUp 0.5s ease-out 0.4s both' }}
          >
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center mx-auto mb-3">
              <BarChart3 className="w-5 h-5 text-amber-400" />
            </div>
            <p className="text-2xl font-bold text-white mb-1">3.9 <Star className="w-4 h-4 inline text-amber-400 fill-amber-400 -mt-1" /></p>
            <p className="text-gray-500 text-sm">הדירוג הממוצע של המתחרים</p>
          </div>

          <div
            className="p-5 rounded-2xl bg-gray-800/40 border border-gray-700/50"
            style={{ animation: 'slideUp 0.5s ease-out 0.6s both' }}
          >
            <div className="w-10 h-10 rounded-xl bg-indigo-500/15 flex items-center justify-center mx-auto mb-3">
              <Timer className="w-5 h-5 text-indigo-400" />
            </div>
            <p className="text-2xl font-bold text-white mb-1">12 שעות</p>
            <p className="text-gray-500 text-sm">הסריקה הבאה</p>
          </div>
        </div>

        <button
          onClick={() => navigate('/dashboard/focus')}
          className="inline-flex items-center gap-2 px-10 py-4 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-bold text-lg shadow-xl shadow-cyan-500/25 hover:shadow-cyan-500/40 hover:scale-[1.02] transition-all"
        >
          <span>כנס לפלטפורמה</span>
          <ArrowLeft className="w-5 h-5" />
        </button>
      </div>
    );
  };

  // ── Main render ────────────────────────────────────────────────────────

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-600/5 rounded-full blur-3xl" />
        {/* Subtle grid */}
        <svg className="absolute inset-0 w-full h-full opacity-30" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="wizard-grid" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M 60 0 L 0 0 0 60" fill="none" stroke="rgba(0,212,255,0.03)" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#wizard-grid)" />
        </svg>
      </div>

      <div className="relative z-10 flex items-center justify-center min-h-screen p-4 sm:p-6">
        <div className="w-full max-w-2xl">
          {/* Logo */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-3 mb-1">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                <Eye className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white">Quiet Eyes</h1>
            </div>
          </div>

          {/* Wizard Card */}
          <div className="bg-gray-800/50 backdrop-blur-xl border border-gray-700/50 rounded-3xl p-6 sm:p-8 shadow-2xl">
            {renderStepIndicator()}

            {/* Step Content */}
            {currentStep === 1 && renderStep1()}
            {currentStep === 2 && renderStep2()}
            {currentStep === 3 && renderStep3()}
          </div>
        </div>
      </div>

      {/* CSS for animations */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.4s ease-out;
        }
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(30px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes celebrationPulse {
          0%, 100% { transform: scale(1); opacity: 0.3; }
          50% { transform: scale(1.15); opacity: 0.6; }
        }
      `}</style>
    </div>
  );
}

// Type declarations
declare global {
  interface Window {
    google?: {
      maps?: {
        places?: {
          Autocomplete: new (
            input: HTMLInputElement,
            options?: google.maps.places.AutocompleteOptions
          ) => google.maps.places.Autocomplete;
        };
      };
    };
  }
}
