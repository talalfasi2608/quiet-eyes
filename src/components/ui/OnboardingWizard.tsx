import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSimulation } from '../../context/SimulationContext';
import { apiFetch } from '../../services/api';
import { loadGoogleMaps } from '../../lib/googleMaps';
import {
  Eye,
  Target,
  Zap,
  ArrowLeft,
  ArrowRight,
  Loader2,
  Check,
  Clock,
  TrendingUp,
  Lightbulb,
  Smartphone,
  BarChart3,
  Star,
} from 'lucide-react';

// ── Constants ────────────────────────────────────────────────────────────────

const BUSINESS_TYPES = [
  { value: 'restaurant', label: 'מסעדה / בית קפה' },
  { value: 'beauty', label: 'יופי / קוסמטיקה / שיער' },
  { value: 'fitness', label: 'כושר / בריאות / ספא' },
  { value: 'realestate', label: 'נדל"ן / תיווך' },
  { value: 'ecommerce', label: 'חנות / e-Commerce' },
  { value: 'agency', label: 'סוכנות שיווק / פרסום' },
  { value: 'health', label: 'בריאות / רפואה / קליניקה' },
  { value: 'legal', label: 'משפטים / ייעוץ' },
  { value: 'delivery', label: 'משלוחים / קייטרינג' },
  { value: 'services', label: 'שירותים' },
  { value: 'education', label: 'חינוך / הדרכה' },
  { value: 'tourism', label: 'תיירות / מלונאות' },
  { value: 'tech', label: 'טכנולוגיה / הייטק' },
  { value: 'other', label: 'אחר' },
];

const RADIUS_OPTIONS = [
  { value: 0.5, label: '0.5 ק"מ' },
  { value: 1, label: '1 ק"מ' },
  { value: 2, label: '2 ק"מ' },
  { value: 5, label: '5 ק"מ' },
  { value: 10, label: '10 ק"מ' },
];

const STEP_LABELS = ['ברוך הבא', 'פרטי העסק', 'סריקה', 'תגלית', 'תוכנית פעולה'];

const WIZARD_STORAGE_KEY = 'qe_wizard_progress';

const SCAN_STEPS = [
  { text: 'מחפש עסקים דומים...', icon: '🔍' },
  { text: 'סורק מתחרים באזור...', icon: '👁️' },
  { text: 'מנתח דירוגים וביקורות...', icon: '⭐' },
  { text: 'מחפש לידים ברשתות החברתיות...', icon: '🎯' },
  { text: 'מנתח מגמות שוק...', icon: '📊' },
  { text: 'יוצר פרופיל תחרותי...', icon: '🏆' },
  { text: 'מסכם תובנות עם AI...', icon: '🤖' },
];

const DEFAULT_ACTIONS = [
  {
    title: 'בדוק את הלידים שלך',
    description: 'ראה את הלידים הפוטנציאליים שזיהינו עבורך ותחיל לפעול',
    time: '5 דקות',
    potential: 'גבוה',
    link: '/dashboard/sniper',
  },
  {
    title: 'ראה את המתחרים',
    description: 'סקור את המפה התחרותית שלך ומצא הזדמנויות',
    time: '3 דקות',
    potential: 'גבוה',
    link: '/dashboard/landscape',
  },
  {
    title: 'הגדר התראות',
    description: 'קבל עדכונים אוטומטיים על שינויים בשוק שלך',
    time: '2 דקות',
    potential: 'בינוני',
    link: '/dashboard/settings',
  },
];

// ── Shared Styles ────────────────────────────────────────────────────────────

const INPUT_CLASS =
  'w-full px-4 py-3 rounded-xl bg-gray-800/50 border border-gray-700/50 text-white placeholder-gray-500 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 outline-none transition-all';
const SELECT_CLASS =
  'w-full px-4 py-3 rounded-xl bg-gray-800/50 border border-gray-700/50 text-white placeholder-gray-500 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 outline-none transition-all appearance-none';
const CARD_CLASS =
  'bg-[#0a1628]/60 backdrop-blur-xl border border-gray-700/30 rounded-2xl p-6';
const GRADIENT_BTN =
  'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed';

// ── Types ────────────────────────────────────────────────────────────────────

interface FormData {
  business_name: string;
  business_type: string;
  address: string;
  activity_radius_km: number;
  business_description: string;
  latitude: number | null;
  longitude: number | null;
}

interface ScanResults {
  competitors_found: number;
  leads_found: number;
  top_competitors: Array<{ name: string; rating?: number; distance?: string }>;
  top_leads: Array<{ summary: string; score: number }>;
  health_score: number;
  insight: string;
  actions: Array<{
    title: string;
    description: string;
    time: string;
    potential: string;
    link: string;
  }>;
}

interface WizardProgress {
  step: number;
  formData: FormData;
  businessId: string | null;
  scanResults: ScanResults | null;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function OnboardingWizard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { refreshProfile } = useSimulation();

  // ── State ──────────────────────────────────────────────────────────────────
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<FormData>({
    business_name: '',
    business_type: '',
    address: '',
    activity_radius_km: 2,
    business_description: '',
    latitude: null,
    longitude: null,
  });
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [scanResults, setScanResults] = useState<ScanResults | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanAnimationDone, setScanAnimationDone] = useState(false);
  const [scanApiDone, setScanApiDone] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [visibleScanSteps, setVisibleScanSteps] = useState(0);
  const [showCelebration, setShowCelebration] = useState(false);
  const [dismissedActions, setDismissedActions] = useState<Set<number>>(new Set());

  const addressInputRef = useRef<HTMLInputElement>(null);
  const scanTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scanStepTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Restore progress from localStorage ─────────────────────────────────────
  useEffect(() => {
    try {
      const saved = localStorage.getItem(WIZARD_STORAGE_KEY);
      if (saved) {
        const progress: WizardProgress = JSON.parse(saved);
        if (progress.step) setStep(progress.step);
        if (progress.formData) setFormData(progress.formData);
        if (progress.businessId) setBusinessId(progress.businessId);
        if (progress.scanResults) setScanResults(progress.scanResults);
      }
    } catch {
      // Corrupted data — start fresh
    }
  }, []);

  // ── Save progress to localStorage ──────────────────────────────────────────
  const saveProgress = useCallback(() => {
    try {
      const progress: WizardProgress = {
        step,
        formData,
        businessId,
        scanResults,
      };
      localStorage.setItem(WIZARD_STORAGE_KEY, JSON.stringify(progress));
    } catch {
      // localStorage full or unavailable — ignore
    }
  }, [step, formData, businessId, scanResults]);

  useEffect(() => {
    saveProgress();
  }, [saveProgress]);

  // ── Google Places Autocomplete ─────────────────────────────────────────────
  useEffect(() => {
    if (step !== 2) return;

    const initAutocomplete = () => {
      loadGoogleMaps()
        .then(() => {
          if (addressInputRef.current && window.google?.maps?.places) {
            const autocomplete = new window.google.maps.places.Autocomplete(
              addressInputRef.current,
              { componentRestrictions: { country: 'il' }, language: 'he' }
            );
            autocomplete.addListener('place_changed', () => {
              const place = autocomplete.getPlace();
              if (place.formatted_address) {
                setFormData((prev) => ({
                  ...prev,
                  address: place.formatted_address!,
                }));
              }
              if (place.geometry?.location) {
                setFormData((prev) => ({
                  ...prev,
                  latitude: place.geometry!.location!.lat(),
                  longitude: place.geometry!.location!.lng(),
                }));
              }
            });
          }
        })
        .catch(() => {
          // Google Maps not available — user can still type manually
        });
    };

    // Small delay to ensure DOM is ready
    const timeout = setTimeout(initAutocomplete, 200);
    return () => clearTimeout(timeout);
  }, [step]);

  // ── Scan animation (Step 3) ────────────────────────────────────────────────
  useEffect(() => {
    if (step !== 3 || !isScanning) return;

    // Progress bar: 0 -> 100 over ~15 seconds
    setScanProgress(0);
    setScanAnimationDone(false);
    setVisibleScanSteps(0);

    let progress = 0;
    scanTimerRef.current = setInterval(() => {
      progress += 0.7;
      if (progress >= 100) {
        progress = 100;
        setScanAnimationDone(true);
        if (scanTimerRef.current) clearInterval(scanTimerRef.current);
      }
      setScanProgress(progress);
    }, 100);

    // Log lines appearing one by one
    let stepIndex = 0;
    scanStepTimerRef.current = setInterval(() => {
      stepIndex += 1;
      if (stepIndex >= SCAN_STEPS.length) {
        if (scanStepTimerRef.current) clearInterval(scanStepTimerRef.current);
      }
      setVisibleScanSteps(stepIndex);
    }, 1500);

    return () => {
      if (scanTimerRef.current) clearInterval(scanTimerRef.current);
      if (scanStepTimerRef.current) clearInterval(scanStepTimerRef.current);
    };
  }, [step, isScanning]);

  // ── Auto-advance when scan completes ───────────────────────────────────────
  useEffect(() => {
    if (scanAnimationDone && scanApiDone) {
      const timeout = setTimeout(() => {
        setStep(4);
        setIsScanning(false);
      }, 2000);
      return () => clearTimeout(timeout);
    }
  }, [scanAnimationDone, scanApiDone]);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const userName = user?.user_metadata?.first_name || '';
  const userPhone = user?.user_metadata?.phone || user?.phone || '';

  const getBusinessTypeLabel = (value: string) =>
    BUSINESS_TYPES.find((t) => t.value === value)?.label || value;

  const completeOnboarding = useCallback(async () => {
    try {
      await apiFetch('/onboard/wizard', {
        method: 'POST',
        body: JSON.stringify({
          user_id: user?.id,
          business_name: formData.business_name || 'העסק שלי',
          address: formData.address || 'ישראל',
          industry: formData.business_type || 'services',
          onboarding_completed: true,
          onboarding_step: 5,
        }),
      });
    } catch {
      // Best effort — still continue
    }
    localStorage.setItem('qe_onboarding_done', 'true');
    localStorage.removeItem(WIZARD_STORAGE_KEY);
    await refreshProfile();
  }, [user?.id, formData, refreshProfile]);

  const handleSkip = useCallback(async () => {
    try {
      await apiFetch('/onboard/wizard', {
        method: 'POST',
        body: JSON.stringify({
          user_id: user?.id,
          business_name: 'העסק שלי',
          address: 'ישראל',
          industry: 'services',
          onboarding_completed: true,
        }),
      });
    } catch {
      // Best effort
    }
    localStorage.setItem('qe_onboarding_done', 'true');
    localStorage.removeItem(WIZARD_STORAGE_KEY);
    await refreshProfile();
    // Fallback redirect
    setTimeout(() => {
      window.location.href = '/dashboard';
    }, 2000);
  }, [user?.id, refreshProfile]);

  const validateStep2 = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.business_name.trim()) {
      newErrors.business_name = 'שם העסק הוא שדה חובה';
    }
    if (!formData.business_type) {
      newErrors.business_type = 'יש לבחור סוג עסק';
    }
    if (!formData.address.trim()) {
      newErrors.address = 'כתובת היא שדה חובה';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleStep2Submit = async () => {
    if (!validateStep2()) return;

    setIsSaving(true);
    try {
      const res = await apiFetch('/onboard/wizard', {
        method: 'POST',
        body: JSON.stringify({
          user_id: user?.id,
          business_name: formData.business_name,
          business_type: formData.business_type,
          address: formData.address,
          activity_radius_km: formData.activity_radius_km,
          business_description: formData.business_description,
          latitude: formData.latitude,
          longitude: formData.longitude,
          onboarding_step: 2,
        }),
      });
      const data = await res.json();
      if (data.business_id || data.business?.id) {
        setBusinessId(data.business_id || data.business?.id);
      }
      setStep(3);
    } catch {
      setErrors({ _general: 'שגיאה בשמירת הנתונים. נסה שוב.' });
    } finally {
      setIsSaving(false);
    }
  };

  const startScan = useCallback(async () => {
    setIsScanning(true);
    setScanApiDone(false);
    setScanAnimationDone(false);

    try {
      const res = await apiFetch('/onboard/first-scan', {
        method: 'POST',
        body: JSON.stringify({
          business_id: businessId,
          user_id: user?.id,
        }),
      });
      const data = await res.json();

      setScanResults({
        competitors_found: data.competitors_found ?? 0,
        leads_found: data.leads_found ?? 0,
        top_competitors: data.top_competitors ?? [],
        top_leads: data.top_leads ?? [],
        health_score: data.health_score ?? 0,
        insight: data.insight ?? '',
        actions: data.actions ?? [],
      });
    } catch {
      // Scan failed — allow user to continue with empty results
      setScanResults({
        competitors_found: 0,
        leads_found: 0,
        top_competitors: [],
        top_leads: [],
        health_score: 0,
        insight: '',
        actions: [],
      });
    } finally {
      setScanApiDone(true);
    }
  }, [businessId, user?.id]);

  // Trigger scan when entering step 3
  useEffect(() => {
    if (step === 3 && !isScanning && !scanApiDone) {
      startScan();
    }
  }, [step, isScanning, scanApiDone, startScan]);

  const handleFinalComplete = async () => {
    setShowCelebration(true);
    await completeOnboarding();

    // Brief celebration, then let routing handle it
    setTimeout(() => {
      setShowCelebration(false);
      // Fallback redirect if routing doesn't auto-redirect
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 500);
    }, 1500);
  };

  // ── Render Helpers ─────────────────────────────────────────────────────────

  const renderProgressBar = () => (
    <>
      {/* Thin top bar */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-gray-800 z-50">
        <div
          className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-500"
          style={{ width: `${(step / 5) * 100}%` }}
        />
      </div>

      {/* Step indicators */}
      <div className="flex items-center justify-center gap-2 sm:gap-4 pt-8 pb-4 px-4">
        {STEP_LABELS.map((label, i) => {
          const stepNum = i + 1;
          const isActive = stepNum === step;
          const isComplete = stepNum < step;
          return (
            <div key={stepNum} className="flex items-center gap-1 sm:gap-2">
              <div
                className={`
                  w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all
                  ${isComplete ? 'bg-cyan-500 text-white' : ''}
                  ${isActive ? 'bg-cyan-500/20 border-2 border-cyan-500 text-cyan-400' : ''}
                  ${!isActive && !isComplete ? 'bg-gray-800/50 border border-gray-700/50 text-gray-600' : ''}
                `}
              >
                {isComplete ? <Check className="w-4 h-4" /> : stepNum}
              </div>
              <span
                className={`hidden sm:inline text-xs ${
                  isActive ? 'text-cyan-400' : isComplete ? 'text-gray-400' : 'text-gray-600'
                }`}
              >
                {label}
              </span>
              {i < STEP_LABELS.length - 1 && (
                <div
                  className={`w-6 sm:w-10 h-px ${
                    isComplete ? 'bg-cyan-500' : 'bg-gray-700/50'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </>
  );

  const renderBackButton = () => (
    <button
      onClick={() => setStep((s) => Math.max(1, s - 1))}
      className="text-gray-500 hover:text-white transition-colors flex items-center gap-2 mb-6"
    >
      <ArrowRight className="w-4 h-4" />
      <span>חזרה</span>
    </button>
  );

  // ── STEP 1: Welcome ────────────────────────────────────────────────────────

  const renderStep1 = () => (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-120px)] px-4 animate-fade-in">
      {/* Pulsing eye icon */}
      <div className="relative mb-8">
        <div className="w-28 h-28 rounded-full bg-cyan-500/10 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-cyan-500/20 animate-ping" />
          <div className="relative w-16 h-16 rounded-full bg-cyan-500/30 flex items-center justify-center">
            <Eye className="w-8 h-8 text-cyan-400" />
          </div>
        </div>
      </div>

      {/* Title */}
      <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3 text-center">
        ברוך הבא ל-Quieteyes{userName ? `, ${userName}` : ''}
      </h1>
      <p className="text-gray-400 text-lg text-center mb-10 max-w-lg">
        בעוד 3 דקות תראה את השוק שלך בצורה שמעולם לא ראית אותו.
      </p>

      {/* Feature preview cards */}
      <div className="flex flex-col sm:flex-row gap-4 max-w-2xl mx-auto mb-10 w-full px-4">
        <div className="p-4 rounded-xl bg-gray-800/40 border border-gray-700/30 flex-1">
          <div className="flex items-center gap-3 mb-2">
            <Target className="w-6 h-6 text-cyan-400" />
            <span className="text-white font-medium">לידים חמים</span>
          </div>
          <p className="text-gray-400 text-sm">נמצא לידים חמים שמחפשים אותך עכשיו</p>
        </div>
        <div className="p-4 rounded-xl bg-gray-800/40 border border-gray-700/30 flex-1">
          <div className="flex items-center gap-3 mb-2">
            <Eye className="w-6 h-6 text-cyan-400" />
            <span className="text-white font-medium">מתחרים</span>
          </div>
          <p className="text-gray-400 text-sm">נזהה את המתחרים שלך אוטומטית</p>
        </div>
        <div className="p-4 rounded-xl bg-gray-800/40 border border-gray-700/30 flex-1">
          <div className="flex items-center gap-3 mb-2">
            <Zap className="w-6 h-6 text-cyan-400" />
            <span className="text-white font-medium">תוכנית פעולה</span>
          </div>
          <p className="text-gray-400 text-sm">ניצור תוכנית פעולה אישית לעסק שלך</p>
        </div>
      </div>

      {/* CTA */}
      <button
        onClick={() => setStep(2)}
        className={`${GRADIENT_BTN} px-8 py-4 text-lg flex items-center gap-2`}
      >
        <span>בוא נתחיל</span>
        <ArrowLeft className="w-5 h-5" />
      </button>

      {/* Skip link */}
      <button
        onClick={handleSkip}
        className="mt-6 text-gray-500 hover:text-gray-300 text-sm underline transition-colors"
      >
        דלג — קח אותי לפלטפורמה
      </button>
    </div>
  );

  // ── STEP 2: Business Details ───────────────────────────────────────────────

  const renderStep2 = () => (
    <div className="max-w-xl mx-auto px-4 pb-12 animate-fade-in">
      {renderBackButton()}

      <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2 text-center">
        ספר לנו על העסק שלך
      </h2>
      <p className="text-gray-400 text-center mb-8">
        ככל שנדע יותר — התוצאות יהיו מדויקות יותר
      </p>

      <div className={`${CARD_CLASS} space-y-5`}>
        {/* General error */}
        {errors._general && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-400 text-sm">
            {errors._general}
          </div>
        )}

        {/* Business name */}
        <div>
          <label className="block text-sm text-gray-300 mb-1.5">
            שם העסק <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={formData.business_name}
            onChange={(e) => {
              setFormData((prev) => ({ ...prev, business_name: e.target.value }));
              if (errors.business_name) setErrors((prev) => ({ ...prev, business_name: '' }));
            }}
            placeholder="לדוגמה: קפה שלומי"
            className={`${INPUT_CLASS} ${errors.business_name ? 'border-red-500/50' : ''}`}
          />
          {errors.business_name && (
            <p className="text-red-400 text-xs mt-1">{errors.business_name}</p>
          )}
        </div>

        {/* Business type */}
        <div>
          <label className="block text-sm text-gray-300 mb-1.5">
            סוג עסק <span className="text-red-400">*</span>
          </label>
          <select
            value={formData.business_type}
            onChange={(e) => {
              setFormData((prev) => ({ ...prev, business_type: e.target.value }));
              if (errors.business_type) setErrors((prev) => ({ ...prev, business_type: '' }));
            }}
            className={`${SELECT_CLASS} ${errors.business_type ? 'border-red-500/50' : ''}`}
          >
            <option value="" disabled>
              בחר סוג עסק
            </option>
            {BUSINESS_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          {errors.business_type && (
            <p className="text-red-400 text-xs mt-1">{errors.business_type}</p>
          )}
        </div>

        {/* Address with Google Autocomplete */}
        <div>
          <label className="block text-sm text-gray-300 mb-1.5">
            כתובת <span className="text-red-400">*</span>
          </label>
          <input
            ref={addressInputRef}
            type="text"
            value={formData.address}
            onChange={(e) => {
              setFormData((prev) => ({ ...prev, address: e.target.value }));
              if (errors.address) setErrors((prev) => ({ ...prev, address: '' }));
            }}
            placeholder="הקלד כתובת או שם עיר"
            className={`${INPUT_CLASS} ${errors.address ? 'border-red-500/50' : ''}`}
          />
          {errors.address && (
            <p className="text-red-400 text-xs mt-1">{errors.address}</p>
          )}
        </div>

        {/* Activity radius */}
        <div>
          <label className="block text-sm text-gray-300 mb-1.5">אזור פעילות</label>
          <div className="flex flex-wrap gap-2">
            {RADIUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() =>
                  setFormData((prev) => ({ ...prev, activity_radius_km: opt.value }))
                }
                className={`
                  px-4 py-2.5 rounded-xl text-sm font-medium transition-all min-h-[48px]
                  ${
                    formData.activity_radius_km === opt.value
                      ? 'bg-cyan-500/20 border border-cyan-500/50 text-cyan-400'
                      : 'bg-gray-800/50 border border-gray-700/50 text-gray-400 hover:border-gray-600'
                  }
                `}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Description (optional) */}
        <div>
          <label className="block text-sm text-gray-300 mb-1.5">תיאור קצר</label>
          <textarea
            value={formData.business_description}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, business_description: e.target.value }))
            }
            placeholder="מה מייחד את העסק שלך?"
            rows={3}
            className={`${INPUT_CLASS} resize-none`}
          />
          <p className="text-gray-500 text-xs mt-1">עוזר ל-AI למצוא לידים מדויקים יותר</p>
        </div>

        {/* Live preview */}
        {formData.business_type && formData.address && (
          <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-4">
            <p className="text-cyan-400 font-medium mb-1">Quieteyes תחפש:</p>
            <p className="text-gray-300">
              &quot;{getBusinessTypeLabel(formData.business_type)}&quot; ב&quot;
              {formData.address}&quot; ברדיוס {formData.activity_radius_km} ק&quot;מ
            </p>
          </div>
        )}
      </div>

      {/* CTA */}
      <div className="mt-6 flex justify-center">
        <button
          onClick={handleStep2Submit}
          disabled={isSaving}
          className={`${GRADIENT_BTN} px-8 py-4 text-lg flex items-center gap-2`}
        >
          {isSaving ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>שומר...</span>
            </>
          ) : (
            <>
              <span>המשך</span>
              <ArrowLeft className="w-5 h-5" />
            </>
          )}
        </button>
      </div>
    </div>
  );

  // ── STEP 3: Live Scan ──────────────────────────────────────────────────────

  const renderStep3 = () => {
    const isComplete = scanAnimationDone && scanApiDone;

    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-120px)] px-4 animate-fade-in">
        {/* Radar animation */}
        <div className="relative w-48 h-48 mb-10 flex items-center justify-center">
          {/* Pinging rings */}
          {[0, 0.8, 1.6].map((delay, i) => (
            <div
              key={i}
              className="absolute inset-0 rounded-full border-2 border-cyan-500/40"
              style={{
                animation: 'radar-ping 2.4s ease-out infinite',
                animationDelay: `${delay}s`,
              }}
            />
          ))}
          {/* Center dot */}
          <div className="relative w-4 h-4 bg-cyan-400 rounded-full shadow-lg shadow-cyan-500/50" />
        </div>

        {/* Title */}
        <h2 className="text-2xl sm:text-3xl font-bold text-white mb-6 text-center">
          {isComplete ? 'הסריקה הושלמה!' : 'סורקים את השוק שלך...'}
        </h2>

        {/* Scan teaser on complete */}
        {isComplete && scanResults && (
          <p className="text-cyan-400 text-lg mb-6 text-center animate-fade-in">
            מצאנו {scanResults.competitors_found} מתחרים ו-{scanResults.leads_found} לידים
            פוטנציאליים
          </p>
        )}

        {/* Log lines */}
        <div className="max-w-md w-full space-y-3 mb-8">
          {SCAN_STEPS.map((s, i) => {
            const dynamicText =
              i === 0 && formData.business_name
                ? `מחפש עסקים דומים ל"${formData.business_name}"...`
                : s.text;
            const isVisible = i < visibleScanSteps;
            const isLatest = i === visibleScanSteps - 1 && !scanAnimationDone;

            return (
              <div
                key={i}
                className={`flex items-center gap-3 transition-all duration-500 ${
                  isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
                }`}
              >
                <span className="text-lg">{s.icon}</span>
                <span className={`text-sm ${isLatest ? 'text-white' : 'text-gray-400'}`}>
                  {dynamicText}
                </span>
                {isVisible && !isLatest && (
                  <Check className="w-4 h-4 text-green-400 mr-auto" />
                )}
                {isVisible && isLatest && !scanAnimationDone && (
                  <Loader2 className="w-4 h-4 text-cyan-400 animate-spin mr-auto" />
                )}
                {isVisible && scanAnimationDone && (
                  <Check className="w-4 h-4 text-green-400 mr-auto" />
                )}
              </div>
            );
          })}
        </div>

        {/* Progress bar */}
        <div className="max-w-md w-full h-2 bg-gray-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              isComplete
                ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                : 'bg-gradient-to-r from-cyan-500 to-blue-500'
            }`}
            style={{ width: `${scanProgress}%` }}
          />
        </div>
        <p className="text-gray-500 text-sm mt-2">
          {isComplete
            ? 'מוכן!'
            : scanAnimationDone && !scanApiDone
              ? 'עדיין סורק...'
              : `${Math.round(scanProgress)}%`}
        </p>
      </div>
    );
  };

  // ── STEP 4: Discovery ──────────────────────────────────────────────────────

  const renderStep4 = () => {
    const hasData =
      scanResults &&
      (scanResults.competitors_found > 0 || scanResults.leads_found > 0 || scanResults.health_score > 0);

    return (
      <div className="max-w-4xl mx-auto px-4 pb-12 animate-fade-in">
        {renderBackButton()}

        <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2 text-center">
          הנה מה שגילינו על השוק שלך
        </h2>
        <p className="text-gray-400 text-center mb-8">תוצאות הסריקה הראשונה שלך</p>

        {hasData ? (
          <>
            {/* Three result cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              {/* Competitors card */}
              <div className={CARD_CLASS}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                    <Eye className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-bold">מתחרים</h3>
                    <p className="text-gray-400 text-sm">
                      נמצאו {scanResults!.competitors_found} מתחרים באזורך
                    </p>
                  </div>
                </div>
                {scanResults!.top_competitors.length > 0 && (
                  <div className="space-y-2 mb-4">
                    {scanResults!.top_competitors.slice(0, 3).map((comp, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between text-sm py-2 border-b border-gray-700/30 last:border-0"
                      >
                        <span className="text-gray-300">{comp.name}</span>
                        <div className="flex items-center gap-2">
                          {comp.rating && (
                            <span className="text-yellow-400 flex items-center gap-1">
                              <Star className="w-3 h-3 fill-yellow-400" />
                              {comp.rating}
                            </span>
                          )}
                          {comp.distance && (
                            <span className="text-gray-500 text-xs">{comp.distance}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => navigate('/dashboard/landscape')}
                  className="text-cyan-400 text-sm hover:text-cyan-300 transition-colors"
                >
                  ראה את כולם בעמוד הנוף &larr;
                </button>
              </div>

              {/* Leads card */}
              <div className={CARD_CLASS}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                    <Target className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-bold">לידים</h3>
                    <p className="text-gray-400 text-sm">
                      נמצאו {scanResults!.leads_found} לידים פוטנציאליים
                    </p>
                  </div>
                </div>
                {scanResults!.top_leads.length > 0 && (
                  <div className="space-y-2 mb-4">
                    {scanResults!.top_leads.slice(0, 2).map((lead, i) => (
                      <div
                        key={i}
                        className="text-sm py-2 border-b border-gray-700/30 last:border-0"
                      >
                        <p className="text-gray-300 truncate">&quot;{lead.summary}&quot;</p>
                        <p className="text-gray-500 text-xs mt-1">ציון: {lead.score}/100</p>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => navigate('/dashboard/sniper')}
                  className="text-cyan-400 text-sm hover:text-cyan-300 transition-colors"
                >
                  ראה את כולם בעמוד הלידים &larr;
                </button>
              </div>

              {/* Health score card */}
              <div className={CARD_CLASS}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                    <BarChart3 className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-bold">ציון בריאות</h3>
                    <p className="text-gray-400 text-sm">ציון בריאות השוק שלך</p>
                  </div>
                </div>
                <div className="text-center my-4">
                  <span className="text-5xl font-bold text-cyan-400">
                    {scanResults!.health_score}
                  </span>
                  <span className="text-gray-400 text-lg">/100</span>
                </div>
                <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-1000"
                    style={{ width: `${scanResults!.health_score}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Insight box */}
            {scanResults!.insight && (
              <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-4 mb-8 flex items-start gap-3">
                <Lightbulb className="w-5 h-5 text-cyan-400 mt-0.5 flex-shrink-0" />
                <p className="text-gray-300">{scanResults!.insight}</p>
              </div>
            )}
          </>
        ) : (
          /* Fallback when scan data is empty */
          <div className={`${CARD_CLASS} text-center mb-8`}>
            <p className="text-gray-400 mb-2">
              לא הצלחנו להשלים את הסריקה. אל דאגה — המערכת תמשיך לסרוק ברקע.
            </p>
            <p className="text-gray-500 text-sm">
              תוכל לראות את התוצאות בלוח הבקרה בהמשך.
            </p>
          </div>
        )}

        {/* CTA */}
        <div className="flex justify-center">
          <button
            onClick={() => setStep(5)}
            className={`${GRADIENT_BTN} px-8 py-4 text-lg flex items-center gap-2`}
          >
            <span>מעולה, בוא נראה מה לעשות עם זה</span>
            <ArrowLeft className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  };

  // ── STEP 5: Action Plan ────────────────────────────────────────────────────

  const renderStep5 = () => {
    const actions =
      scanResults?.actions && scanResults.actions.length > 0
        ? scanResults.actions.slice(0, 3)
        : DEFAULT_ACTIONS;

    return (
      <div className="max-w-3xl mx-auto px-4 pb-12 animate-fade-in">
        {renderBackButton()}

        <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2 text-center">
          3 פעולות לעשות היום
        </h2>
        <p className="text-gray-400 text-center mb-8">
          על בסיס הסריקה שלך — הנה מה שיזיז את העסק
        </p>

        {/* Action cards */}
        <div className="space-y-4 mb-8">
          {actions.map((action, i) => {
            const isDismissed = dismissedActions.has(i);
            return (
              <div
                key={i}
                className={`${CARD_CLASS} transition-all duration-300 ${
                  isDismissed ? 'opacity-40' : ''
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* Number badge */}
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-cyan-400 font-bold">{i + 1}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="text-white font-bold">{action.title}</h3>
                      {action.potential && (
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            action.potential === 'גבוה'
                              ? 'bg-green-500/20 text-green-400'
                              : 'bg-yellow-500/20 text-yellow-400'
                          }`}
                        >
                          {action.potential}
                        </span>
                      )}
                    </div>
                    <p className="text-gray-400 text-sm mb-3">{action.description}</p>

                    {action.time && (
                      <div className="flex items-center gap-1 text-gray-500 text-xs mb-3">
                        <Clock className="w-3 h-3" />
                        <span>{action.time}</span>
                      </div>
                    )}

                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => {
                          if (action.link) navigate(action.link);
                        }}
                        className={`${GRADIENT_BTN} px-4 py-2 text-sm rounded-xl min-h-[48px]`}
                      >
                        בצע עכשיו
                      </button>
                      <button
                        onClick={() =>
                          setDismissedActions((prev) => {
                            const next = new Set(prev);
                            next.add(i);
                            return next;
                          })
                        }
                        className="text-gray-500 hover:text-gray-400 text-sm transition-colors min-h-[48px] px-3"
                      >
                        אחר כך
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* WhatsApp setup card */}
        <div className="bg-[#0a1628]/60 backdrop-blur-xl border border-green-500/30 rounded-2xl p-6 mb-8">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center flex-shrink-0">
              <Smartphone className="w-5 h-5 text-green-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-white font-bold mb-1">הפעל התראות וואטסאפ</h3>
              <p className="text-gray-400 text-sm mb-3">
                קבל את הפעולות האלה ישירות לוואטסאפ שלך כל בוקר
              </p>
              {userPhone ? (
                <div className="flex items-center gap-2 text-green-400 text-sm">
                  <Check className="w-4 h-4" />
                  <span>{userPhone}</span>
                </div>
              ) : (
                <button
                  onClick={() => navigate('/dashboard/settings')}
                  className="text-green-400 hover:text-green-300 text-sm transition-colors"
                >
                  הפעל בהגדרות &larr;
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Final CTA */}
        <button
          onClick={handleFinalComplete}
          className={`${GRADIENT_BTN} w-full px-8 py-5 text-lg flex items-center justify-center gap-2`}
        >
          <TrendingUp className="w-5 h-5" />
          <span>כניסה לפלטפורמה — בוא נראה הכל</span>
        </button>
      </div>
    );
  };

  // ── Celebration Overlay ────────────────────────────────────────────────────

  const renderCelebration = () => (
    <div className="fixed inset-0 z-[100] bg-[#060d1b]/95 flex items-center justify-center animate-fade-in">
      <div className="text-center animate-scale-in">
        <div className="relative mb-6 inline-block">
          <div className="w-20 h-20 rounded-full bg-cyan-500/20 flex items-center justify-center mx-auto">
            <Check className="w-10 h-10 text-cyan-400" />
          </div>
        </div>
        <h2 className="text-3xl font-bold text-white mb-2">ברוך הבא ל-Quieteyes!</h2>
        <p className="text-gray-400">מעביר אותך ללוח הבקרה...</p>
      </div>
    </div>
  );

  // ── Main Render ────────────────────────────────────────────────────────────

  return (
    <div dir="rtl" className="min-h-screen bg-[#060d1b] text-white overflow-y-auto">
      {/* Global keyframe styles */}
      <style>{`
        @keyframes radar-ping {
          0% { transform: scale(0.5); opacity: 0.8; }
          100% { transform: scale(2.5); opacity: 0; }
        }
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes scale-in {
          from { opacity: 0; transform: scale(0.8); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fade-in {
          animation: fade-in 0.5s ease-out;
        }
        .animate-scale-in {
          animation: scale-in 0.4s ease-out;
        }
      `}</style>

      {/* Progress bar (hidden on step 1) */}
      {step > 1 && renderProgressBar()}

      {/* Step content */}
      <div className={step === 1 ? '' : 'pt-4'}>
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}
        {step === 5 && renderStep5()}
      </div>

      {/* Celebration overlay */}
      {showCelebration && renderCelebration()}
    </div>
  );
}
