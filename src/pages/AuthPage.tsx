import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Mail, Lock, Loader2, AlertCircle, Sparkles, Shield, Radar,
  TrendingUp, Zap, User, Phone, Building2, MapPin, ChevronDown,
} from 'lucide-react';
import { loadGoogleMaps } from '../lib/googleMaps';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES & CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

interface SignupFormData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone: string;
  businessName: string;
  businessType: string;
  customIndustry: string;
  businessAddress: string;
  latitude: number | null;
  longitude: number | null;
  activityRadius: string;
}

interface FieldErrors {
  [key: string]: string;
}

const BUSINESS_TYPES = [
  { value: 'restaurant', label: 'מסעדה / בית קפה', icon: '🍜' },
  { value: 'beauty', label: 'יופי / קוסמטיקה / שיער', icon: '💇' },
  { value: 'fitness', label: 'כושר / בריאות / ספא', icon: '🏋️' },
  { value: 'realestate', label: 'נדל"ן / תיווך', icon: '🏠' },
  { value: 'ecommerce', label: 'חנות / e-Commerce', icon: '🛒' },
  { value: 'marketing', label: 'סוכנות שיווק / פרסום', icon: '📢' },
  { value: 'health', label: 'בריאות / רפואה / קליניקה', icon: '🏥' },
  { value: 'legal', label: 'משפטים / ייעוץ', icon: '⚖️' },
  { value: 'delivery', label: 'משלוחים / קייטרינג', icon: '🍕' },
  { value: 'services', label: 'שירותים (אינסטלציה, חשמל, וכו׳)', icon: '🔧' },
  { value: 'education', label: 'חינוך / הדרכה', icon: '📚' },
  { value: 'tourism', label: 'תיירות / מלונאות', icon: '🏨' },
  { value: 'tech', label: 'טכנולוגיה / הייטק', icon: '💻' },
  { value: 'other', label: 'אחר', icon: '🔵' },
] as const;

const RADIUS_OPTIONS = ['1 ק"מ', '3 ק"מ', '5 ק"מ', '10 ק"מ', 'ארצי'] as const;

const INITIAL_SIGNUP_DATA: SignupFormData = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  phone: '',
  businessName: '',
  businessType: '',
  customIndustry: '',
  businessAddress: '',
  latitude: null,
  longitude: null,
  activityRadius: '',
};

// ═══════════════════════════════════════════════════════════════════════════════
// PASSWORD STRENGTH HELPER
// ═══════════════════════════════════════════════════════════════════════════════

function getPasswordStrength(password: string): { label: string; color: string; width: string } | null {
  if (!password || password.length < 8) return null;

  const hasNumbers = /\d/.test(password);
  const hasUpperOrSpecial = /[A-Z]/.test(password) || /[^A-Za-z0-9]/.test(password);

  if (hasNumbers && hasUpperOrSpecial) {
    return { label: 'חזקה', color: 'bg-green-500', width: '100%' };
  }
  if (hasNumbers) {
    return { label: 'בינונית', color: 'bg-yellow-500', width: '66%' };
  }
  return { label: 'חלשה', color: 'bg-red-500', width: '33%' };
}

// ═══════════════════════════════════════════════════════════════════════════════
// BRAND VISUAL — Animated radar + feature highlights (for LOGIN)
// ═══════════════════════════════════════════════════════════════════════════════

function BrandVisual() {
  return (
    <div className="hidden lg:flex flex-col items-center justify-center h-full relative overflow-hidden px-12">
      {/* Background glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#00d4ff]/5 rounded-full blur-[100px]" />
      <div className="absolute bottom-1/4 right-0 w-80 h-80 bg-[#0066cc]/8 rounded-full blur-[80px]" />

      {/* Grid overlay */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="auth-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(0,212,255,0.08)" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#auth-grid)" />
        </svg>
      </div>

      {/* Animated radar */}
      <div className="relative w-48 h-48 mb-12">
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 200 200">
          <circle cx="100" cy="100" r="90" fill="none" stroke="rgba(0,212,255,0.15)" strokeWidth="1" />
          <circle cx="100" cy="100" r="60" fill="none" stroke="rgba(0,212,255,0.12)" strokeWidth="1" />
          <circle cx="100" cy="100" r="30" fill="none" stroke="rgba(0,212,255,0.08)" strokeWidth="1" />
          <line x1="100" y1="5" x2="100" y2="195" stroke="rgba(0,212,255,0.06)" strokeWidth="0.5" />
          <line x1="5" y1="100" x2="195" y2="100" stroke="rgba(0,212,255,0.06)" strokeWidth="0.5" />
          <circle cx="100" cy="100" r="4" fill="#00d4ff" opacity="0.6">
            <animate attributeName="opacity" values="0.6;1;0.6" dur="2s" repeatCount="indefinite" />
          </circle>
          <g>
            <animateTransform attributeName="transform" type="rotate" from="0 100 100" to="360 100 100" dur="4s" repeatCount="indefinite" />
            <defs>
              <linearGradient id="auth-sweep" gradientTransform="rotate(90)">
                <stop offset="0%" stopColor="#00d4ff" stopOpacity="0" />
                <stop offset="100%" stopColor="#00d4ff" stopOpacity="0.2" />
              </linearGradient>
            </defs>
            <path d="M 100,100 L 100,10 A 90,90 0 0,1 163.6,36.4 Z" fill="url(#auth-sweep)" />
            <line x1="100" y1="100" x2="100" y2="10" stroke="#00d4ff" strokeWidth="1.5" opacity="0.5" />
          </g>
          {/* Blip dots */}
          <circle cx="72" cy="52" r="3" fill="#00d4ff" opacity="0">
            <animate attributeName="opacity" values="0;0.8;0" dur="4s" begin="0.5s" repeatCount="indefinite" />
          </circle>
          <circle cx="145" cy="78" r="2.5" fill="#00d4ff" opacity="0">
            <animate attributeName="opacity" values="0;0.6;0" dur="4s" begin="1.5s" repeatCount="indefinite" />
          </circle>
          <circle cx="55" cy="135" r="2" fill="#00d4ff" opacity="0">
            <animate attributeName="opacity" values="0;0.7;0" dur="4s" begin="2.5s" repeatCount="indefinite" />
          </circle>
        </svg>
      </div>

      {/* Brand text */}
      <h2
        className="text-4xl font-bold text-white mb-3 text-center"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        Quiet<span className="text-[#00d4ff]">eyes</span>
      </h2>
      <p className="text-[var(--text-secondary)] text-center text-lg mb-10 max-w-sm">
        מודיעין עסקי בזמן אמת. הרשת יודעת הכל על העסק שלך.
      </p>

      {/* Feature pills */}
      <div className="space-y-3 w-full max-w-xs">
        {[
          { icon: Radar, text: 'סריקת מתחרים אוטומטית', color: 'text-[#00d4ff]', bg: 'bg-[#00d4ff]/10' },
          { icon: TrendingUp, text: 'מעקב מגמות בזמן אמת', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
          { icon: Zap, text: 'לידים חמים מהרשת', color: 'text-amber-400', bg: 'bg-amber-500/10' },
          { icon: Shield, text: 'הגנה על המוניטין שלך', color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
        ].map(({ icon: Icon, text, color, bg }, i) => (
          <div
            key={i}
            className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-sm"
            style={{ animationDelay: `${i * 0.15}s` }}
          >
            <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center flex-shrink-0`}>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <span className="text-sm text-gray-300">{text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// REGISTRATION PREVIEW — Live dashboard preview (for SIGNUP, desktop only)
// ═══════════════════════════════════════════════════════════════════════════════

function RegistrationPreview({ formData }: { formData: SignupFormData }) {
  const displayName = formData.businessName || 'העסק שלך';
  const selectedType = BUSINESS_TYPES.find((t) => t.value === formData.businessType);
  const typeIcon = selectedType?.icon || '🔍';
  const typeLabel = formData.businessType === 'other' && formData.customIndustry
    ? formData.customIndustry
    : selectedType?.label || 'סוג העסק';

  const competitorCount = Math.floor(Math.random() * 5) + 8;

  return (
    <div className="hidden lg:flex flex-col items-center justify-center h-full relative overflow-hidden px-8">
      {/* Background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-[#00d4ff]/5 rounded-full blur-[100px]" />
      <div className="absolute bottom-1/3 right-0 w-64 h-64 bg-[#0066cc]/8 rounded-full blur-[80px]" />

      {/* Logo */}
      <h2
        className="text-3xl font-bold text-white mb-8 text-center"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        Quiet<span className="text-[#00d4ff]">eyes</span>
      </h2>

      {/* Mock dashboard card */}
      <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--glass)] backdrop-blur-xl p-6 mb-6">
        {/* Business header */}
        <div className="flex items-center gap-3 mb-5 pb-4 border-b border-[var(--border)]">
          <div className="w-12 h-12 rounded-xl bg-[#00d4ff]/10 border border-[#00d4ff]/20 flex items-center justify-center text-xl">
            {typeIcon}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-white font-semibold text-base truncate">{displayName}</h3>
            <p className="text-[var(--text-muted)] text-xs truncate">{typeLabel}</p>
          </div>
        </div>

        {/* Scanner animation text */}
        <div className="flex items-center gap-2 mb-5">
          <div className="relative w-5 h-5 flex-shrink-0">
            <div className="absolute inset-0 rounded-full border-2 border-[#00d4ff]/30" />
            <div
              className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#00d4ff]"
              style={{ animation: 'spin 1s linear infinite' }}
            />
          </div>
          <span className="text-[#00d4ff] text-sm">
            סורק {competitorCount} מתחרים באזורך...
          </span>
        </div>

        {/* Mini stat boxes */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)] p-3 text-center">
            <p className="text-[#00d4ff] text-lg font-bold">24</p>
            <p className="text-[var(--text-muted)] text-[10px] mt-0.5">מתחרים</p>
          </div>
          <div className="rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)] p-3 text-center">
            <p className="text-emerald-400 text-lg font-bold">4.7</p>
            <p className="text-[var(--text-muted)] text-[10px] mt-0.5">דירוג ממוצע</p>
          </div>
          <div className="rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)] p-3 text-center">
            <p className="text-amber-400 text-lg font-bold">12</p>
            <p className="text-[var(--text-muted)] text-[10px] mt-0.5">לידים חמים</p>
          </div>
        </div>
      </div>

      {/* Feature highlights */}
      <div className="space-y-2.5 w-full max-w-sm">
        {[
          { icon: Radar, text: 'סריקת מתחרים אוטומטית', color: 'text-[#00d4ff]', bg: 'bg-[#00d4ff]/10' },
          { icon: TrendingUp, text: 'מעקב מגמות בזמן אמת', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
          { icon: Zap, text: 'לידים חמים מהרשת', color: 'text-amber-400', bg: 'bg-amber-500/10' },
          { icon: Shield, text: 'הגנה על המוניטין שלך', color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
        ].map(({ icon: Icon, text, color, bg }, i) => (
          <div
            key={i}
            className="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-sm"
          >
            <div className={`w-7 h-7 rounded-lg ${bg} flex items-center justify-center flex-shrink-0`}>
              <Icon className={`w-3.5 h-3.5 ${color}`} />
            </div>
            <span className="text-xs text-gray-300">{text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUTH PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export default function AuthPage() {
  const { signIn, signUp, resetPassword } = useAuth();
  const [searchParams] = useSearchParams();
  const [isSignUp, setIsSignUp] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  // Login state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Signup state
  const [signupData, setSignupData] = useState<SignupFormData>({ ...INITIAL_SIGNUP_DATA });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  // Shared state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Google Places ref
  const addressInputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  // Read URL params
  useEffect(() => {
    if (searchParams.get('tab') === 'register') {
      setIsSignUp(true);
    }
    const plan = searchParams.get('plan');
    if (plan) {
      localStorage.setItem('quieteyes_selected_plan', plan);
    }
  }, [searchParams]);

  // Initialize Google Places Autocomplete
  useEffect(() => {
    if (!isSignUp) return;

    let isCancelled = false;

    const initAutocomplete = async () => {
      try {
        await loadGoogleMaps();
        if (isCancelled || !addressInputRef.current) return;

        // Avoid creating duplicate autocomplete instances
        if (autocompleteRef.current) return;

        const autocomplete = new google.maps.places.Autocomplete(addressInputRef.current, {
          componentRestrictions: { country: 'il' },
          fields: ['formatted_address', 'geometry', 'name'],
        });

        autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace();
          if (place.geometry?.location) {
            setSignupData((prev) => ({
              ...prev,
              businessAddress: place.formatted_address || place.name || '',
              latitude: place.geometry!.location!.lat(),
              longitude: place.geometry!.location!.lng(),
            }));
            setFieldErrors((prev) => {
              const next = { ...prev };
              delete next.businessAddress;
              return next;
            });
          }
        });

        autocompleteRef.current = autocomplete;
      } catch {
        // Google Maps may not be available — user can still type address manually
      }
    };

    initAutocomplete();

    return () => {
      isCancelled = true;
    };
  }, [isSignUp]);

  // ── Field update helper ──────────────────────────────────────────────
  const updateSignupField = useCallback(
    (field: keyof SignupFormData, value: string | number | null) => {
      setSignupData((prev) => ({ ...prev, [field]: value }));
      // Clear field error on change
      setFieldErrors((prev) => {
        if (prev[field]) {
          const next = { ...prev };
          delete next[field];
          return next;
        }
        return prev;
      });
    },
    [],
  );

  // ── Phone blur validation ────────────────────────────────────────────
  const handlePhoneBlur = () => {
    const cleaned = signupData.phone.replace(/[-\s]/g, '');
    if (cleaned && (!/^05\d{8}$/.test(cleaned))) {
      setFieldErrors((prev) => ({
        ...prev,
        phone: 'פורמט טלפון לא תקין (05X-XXXXXXX)',
      }));
    }
  };

  // ── Signup validation ────────────────────────────────────────────────
  const validateSignup = (): boolean => {
    const errors: FieldErrors = {};

    if (!signupData.firstName.trim()) errors.firstName = 'שדה חובה';
    if (!signupData.lastName.trim()) errors.lastName = 'שדה חובה';

    if (!signupData.email.trim()) {
      errors.email = 'שדה חובה';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signupData.email)) {
      errors.email = 'כתובת אימייל לא תקינה';
    }

    if (!signupData.password) {
      errors.password = 'שדה חובה';
    } else if (signupData.password.length < 8) {
      errors.password = 'סיסמה חייבת להכיל לפחות 8 תווים';
    }

    const phoneCleaned = signupData.phone.replace(/[-\s]/g, '');
    if (!phoneCleaned) {
      errors.phone = 'שדה חובה';
    } else if (!/^05\d{8}$/.test(phoneCleaned)) {
      errors.phone = 'פורמט טלפון לא תקין (05X-XXXXXXX)';
    }

    if (!signupData.businessName.trim()) errors.businessName = 'שדה חובה';
    if (!signupData.businessType) errors.businessType = 'שדה חובה';
    if (signupData.businessType === 'other' && !signupData.customIndustry.trim()) {
      errors.customIndustry = 'שדה חובה';
    }
    if (!signupData.businessAddress.trim()) errors.businessAddress = 'שדה חובה';
    if (!signupData.activityRadius) errors.activityRadius = 'שדה חובה';

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ── Error message translation ────────────────────────────────────────
  const getErrorMessage = (message: string): string => {
    if (message.includes('Invalid login credentials')) return 'אימייל או סיסמה שגויים';
    if (message.includes('Email not confirmed')) return 'יש לאמת את האימייל לפני הכניסה';
    if (message.includes('User already registered')) return 'משתמש עם אימייל זה כבר קיים';
    if (message.includes('Password should be at least')) return 'הסיסמה חייבת להיות לפחות 8 תווים';
    if (message.includes('Invalid email')) return 'כתובת אימייל לא תקינה';
    return message;
  };

  // ── Login submit ─────────────────────────────────────────────────────
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      if (showForgotPassword) {
        const { error } = await resetPassword(loginEmail);
        if (error) {
          setError(getErrorMessage(error.message));
        } else {
          setSuccessMessage('נשלח אליך מייל לאיפוס סיסמה. בדוק את תיבת הדואר שלך.');
        }
      } else {
        const { error } = await signIn(loginEmail, loginPassword);
        if (error) {
          setError(getErrorMessage(error.message));
        }
      }
    } catch {
      setError('שגיאה לא צפויה. נסה שוב מאוחר יותר.');
    } finally {
      setLoading(false);
    }
  };

  // ── Signup submit ────────────────────────────────────────────────────
  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!validateSignup()) return;

    setLoading(true);

    try {
      const { error } = await signUp(signupData.email, signupData.password, {
        first_name: signupData.firstName,
        last_name: signupData.lastName,
      });

      if (error) {
        setError(getErrorMessage(error.message));
      } else {
        // Save registration data for onboarding wizard
        localStorage.setItem(
          'qe_registration_data',
          JSON.stringify({
            firstName: signupData.firstName,
            lastName: signupData.lastName,
            phone: signupData.phone,
            businessName: signupData.businessName,
            businessType: signupData.businessType,
            customIndustry: signupData.customIndustry,
            businessAddress: signupData.businessAddress,
            latitude: signupData.latitude,
            longitude: signupData.longitude,
            activityRadius: signupData.activityRadius,
          }),
        );
        setSuccessMessage('נשלח אליך מייל אימות. בדוק את תיבת הדואר שלך ולאחר מכן התחבר.');
        setSignupData({ ...INITIAL_SIGNUP_DATA });
      }
    } catch {
      setError('שגיאה לא צפויה. נסה שוב מאוחר יותר.');
    } finally {
      setLoading(false);
    }
  };

  // ── Mode switch helper ───────────────────────────────────────────────
  const switchMode = (toSignUp: boolean) => {
    setIsSignUp(toSignUp);
    setError(null);
    setSuccessMessage(null);
    setShowForgotPassword(false);
    setFieldErrors({});
  };

  // ── Shared input class ───────────────────────────────────────────────
  const inputClass = (fieldName?: string) =>
    `w-full bg-[var(--bg-elevated)] border rounded-xl py-3 px-4 text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)]/50 transition-all ${
      fieldName && fieldErrors[fieldName]
        ? 'border-[var(--danger)]'
        : 'border-[var(--border)]'
    }`;

  const inputWithIconClass = (fieldName?: string) =>
    `w-full bg-[var(--bg-elevated)] border rounded-xl py-3 pr-12 pl-4 text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)]/50 transition-all ${
      fieldName && fieldErrors[fieldName]
        ? 'border-[var(--danger)]'
        : 'border-[var(--border)]'
    }`;

  // ── Password strength bar ────────────────────────────────────────────
  const passwordStrength = getPasswordStrength(signupData.password);

  // ═════════════════════════════════════════════════════════════════════
  // RENDER — SIGNUP MODE
  // ═════════════════════════════════════════════════════════════════════

  if (isSignUp) {
    return (
      <div className="min-h-screen flex" dir="rtl">
        {/* ── Right side: Signup Form (60% on desktop) ────────────────── */}
        <div className="flex-1 lg:w-[60%] lg:flex-none flex flex-col bg-[var(--bg-primary)] relative overflow-hidden">
          {/* Subtle background effects */}
          <div className="absolute top-1/4 -right-32 w-72 h-72 bg-[#00d4ff]/[0.04] rounded-full blur-[80px] pointer-events-none" />
          <div className="absolute bottom-1/4 -left-32 w-72 h-72 bg-[#0066cc]/[0.04] rounded-full blur-[80px] pointer-events-none" />

          <div className="relative flex-1 overflow-y-auto">
            <div className="w-full max-w-2xl mx-auto px-6 py-8">
              {/* Progress indicator */}
              <div className="flex items-center justify-center gap-3 mb-6">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-[#00d4ff] text-[var(--bg-primary)] flex items-center justify-center text-sm font-bold">
                    1
                  </div>
                  <span className="text-sm text-[var(--text-primary)] font-medium">הרשמה</span>
                </div>
                <div className="w-8 h-px bg-[var(--border)]" />
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text-muted)] flex items-center justify-center text-sm font-medium">
                    2
                  </div>
                  <span className="text-sm text-[var(--text-muted)]">אתר</span>
                </div>
                <div className="w-8 h-px bg-[var(--border)]" />
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text-muted)] flex items-center justify-center text-sm font-medium">
                    3
                  </div>
                  <span className="text-sm text-[var(--text-muted)]">אסטרטגיה</span>
                </div>
              </div>

              <p className="text-center text-[var(--text-secondary)] text-sm mb-6">שלב 1 מתוך 3</p>

              {/* Glass card */}
              <div className="rounded-2xl p-6 sm:p-8 border border-[var(--border)] bg-[var(--glass)] backdrop-blur-xl">
                {/* Header */}
                <div className="text-center mb-6">
                  <img
                    src="/logo-icon-only.svg"
                    alt="Quieteyes"
                    className="w-12 h-12 mx-auto mb-3 drop-shadow-[0_0_20px_rgba(0,212,255,0.3)] lg:hidden"
                  />
                  <h1 className="text-2xl font-bold text-white mb-1">צור חשבון</h1>
                  <p className="text-[var(--text-secondary)] text-sm">הצטרף ל-Quieteyes והתחל לעקוב אחרי השוק</p>
                </div>

                {/* Error / Success messages */}
                {error && (
                  <div className="mb-5 p-3 rounded-xl bg-[var(--danger-bg)] border border-[var(--danger)]/30 flex items-center gap-3 text-[var(--danger)] fade-in">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <p className="text-sm">{error}</p>
                  </div>
                )}
                {successMessage && (
                  <div className="mb-5 p-3 rounded-xl bg-[var(--success-bg)] border border-[var(--success)]/30 flex items-center gap-3 text-[var(--success)] fade-in">
                    <Sparkles className="w-5 h-5 flex-shrink-0" />
                    <p className="text-sm">{successMessage}</p>
                  </div>
                )}

                <form onSubmit={handleSignupSubmit} className="space-y-5" noValidate>
                  {/* ── Section 1A: Personal Info ────────────────────────── */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-[var(--text-secondary)] flex items-center gap-2">
                      <User className="w-4 h-4" />
                      פרטים אישיים
                    </h3>

                    {/* Name row */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* First name */}
                      <div>
                        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                          שם פרטי <span className="text-[var(--danger)]">*</span>
                        </label>
                        <input
                          type="text"
                          value={signupData.firstName}
                          onChange={(e) => updateSignupField('firstName', e.target.value)}
                          placeholder="ישראל"
                          className={inputClass('firstName')}
                        />
                        {fieldErrors.firstName && (
                          <p className="text-[var(--danger)] text-xs mt-1">{fieldErrors.firstName}</p>
                        )}
                      </div>

                      {/* Last name */}
                      <div>
                        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                          שם משפחה <span className="text-[var(--danger)]">*</span>
                        </label>
                        <input
                          type="text"
                          value={signupData.lastName}
                          onChange={(e) => updateSignupField('lastName', e.target.value)}
                          placeholder="ישראלי"
                          className={inputClass('lastName')}
                        />
                        {fieldErrors.lastName && (
                          <p className="text-[var(--danger)] text-xs mt-1">{fieldErrors.lastName}</p>
                        )}
                      </div>
                    </div>

                    {/* Email */}
                    <div>
                      <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                        אימייל <span className="text-[var(--danger)]">*</span>
                      </label>
                      <div className="relative">
                        <Mail className="absolute right-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" />
                        <input
                          type="email"
                          value={signupData.email}
                          onChange={(e) => updateSignupField('email', e.target.value)}
                          placeholder="your@email.com"
                          dir="ltr"
                          className={inputWithIconClass('email')}
                        />
                      </div>
                      {fieldErrors.email && (
                        <p className="text-[var(--danger)] text-xs mt-1">{fieldErrors.email}</p>
                      )}
                    </div>

                    {/* Password */}
                    <div>
                      <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                        סיסמה <span className="text-[var(--danger)]">*</span>
                      </label>
                      <div className="relative">
                        <Lock className="absolute right-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" />
                        <input
                          type="password"
                          value={signupData.password}
                          onChange={(e) => updateSignupField('password', e.target.value)}
                          placeholder="לפחות 8 תווים"
                          dir="ltr"
                          className={inputWithIconClass('password')}
                        />
                      </div>
                      {/* Strength indicator */}
                      {passwordStrength && (
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-[var(--bg-elevated)] rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${passwordStrength.color}`}
                              style={{ width: passwordStrength.width }}
                            />
                          </div>
                          <span
                            className={`text-xs font-medium ${
                              passwordStrength.label === 'חזקה'
                                ? 'text-green-400'
                                : passwordStrength.label === 'בינונית'
                                  ? 'text-yellow-400'
                                  : 'text-red-400'
                            }`}
                          >
                            {passwordStrength.label}
                          </span>
                        </div>
                      )}
                      {fieldErrors.password && (
                        <p className="text-[var(--danger)] text-xs mt-1">{fieldErrors.password}</p>
                      )}
                    </div>

                    {/* Phone */}
                    <div>
                      <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                        טלפון נייד <span className="text-[var(--danger)]">*</span>
                      </label>
                      <div className="relative">
                        <Phone className="absolute right-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" />
                        <input
                          type="tel"
                          value={signupData.phone}
                          onChange={(e) => updateSignupField('phone', e.target.value)}
                          onBlur={handlePhoneBlur}
                          placeholder="05X-XXXXXXX"
                          dir="ltr"
                          className={inputWithIconClass('phone')}
                        />
                      </div>
                      <p className="text-[var(--text-muted)] text-xs mt-1">לקבלת התראות וואטסאפ</p>
                      {fieldErrors.phone && (
                        <p className="text-[var(--danger)] text-xs mt-1">{fieldErrors.phone}</p>
                      )}
                    </div>
                  </div>

                  {/* ── Divider ──────────────────────────────────────────── */}
                  <div className="relative py-1">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-[var(--border)]" />
                    </div>
                  </div>

                  {/* ── Section 1B: Business Info ────────────────────────── */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-[var(--text-secondary)] flex items-center gap-2">
                      <Building2 className="w-4 h-4" />
                      פרטי העסק
                    </h3>

                    {/* Business name */}
                    <div>
                      <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                        שם העסק <span className="text-[var(--danger)]">*</span>
                      </label>
                      <div className="relative">
                        <Building2 className="absolute right-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" />
                        <input
                          type="text"
                          value={signupData.businessName}
                          onChange={(e) => updateSignupField('businessName', e.target.value)}
                          placeholder="שם העסק שלך"
                          className={inputWithIconClass('businessName')}
                        />
                      </div>
                      {fieldErrors.businessName && (
                        <p className="text-[var(--danger)] text-xs mt-1">{fieldErrors.businessName}</p>
                      )}
                    </div>

                    {/* Business type */}
                    <div>
                      <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                        סוג העסק <span className="text-[var(--danger)]">*</span>
                      </label>
                      <div className="relative">
                        <ChevronDown className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)] pointer-events-none" />
                        <select
                          value={signupData.businessType}
                          onChange={(e) => updateSignupField('businessType', e.target.value)}
                          className={`${inputClass('businessType')} appearance-none cursor-pointer ${
                            !signupData.businessType ? 'text-[var(--text-muted)]' : ''
                          }`}
                        >
                          <option value="">בחר סוג עסק</option>
                          {BUSINESS_TYPES.map((bt) => (
                            <option key={bt.value} value={bt.value}>
                              {bt.icon} {bt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      {fieldErrors.businessType && (
                        <p className="text-[var(--danger)] text-xs mt-1">{fieldErrors.businessType}</p>
                      )}

                      {/* Custom industry input when "other" is selected */}
                      {signupData.businessType === 'other' && (
                        <div className="mt-3">
                          <input
                            type="text"
                            value={signupData.customIndustry}
                            onChange={(e) => updateSignupField('customIndustry', e.target.value)}
                            placeholder="הזן את סוג העסק שלך"
                            className={inputClass('customIndustry')}
                          />
                          {fieldErrors.customIndustry && (
                            <p className="text-[var(--danger)] text-xs mt-1">{fieldErrors.customIndustry}</p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Business address (Google Places) */}
                    <div>
                      <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                        כתובת העסק <span className="text-[var(--danger)]">*</span>
                      </label>
                      <div className="relative">
                        <MapPin className="absolute right-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" />
                        <input
                          ref={addressInputRef}
                          type="text"
                          value={signupData.businessAddress}
                          onChange={(e) => updateSignupField('businessAddress', e.target.value)}
                          placeholder="התחל להקליד כתובת..."
                          className={inputWithIconClass('businessAddress')}
                        />
                      </div>
                      {fieldErrors.businessAddress && (
                        <p className="text-[var(--danger)] text-xs mt-1">{fieldErrors.businessAddress}</p>
                      )}
                    </div>

                    {/* Activity radius */}
                    <div>
                      <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                        אזור פעילות <span className="text-[var(--danger)]">*</span>
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {RADIUS_OPTIONS.map((radius) => (
                          <button
                            key={radius}
                            type="button"
                            onClick={() => updateSignupField('activityRadius', radius)}
                            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 border ${
                              signupData.activityRadius === radius
                                ? 'bg-[#00d4ff]/15 text-[#00d4ff] border-[#00d4ff]/30 shadow-[0_0_12px_rgba(0,212,255,0.1)]'
                                : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--border)] hover:border-[var(--text-muted)]'
                            }`}
                          >
                            {radius}
                          </button>
                        ))}
                      </div>
                      {fieldErrors.activityRadius && (
                        <p className="text-[var(--danger)] text-xs mt-1.5">{fieldErrors.activityRadius}</p>
                      )}
                    </div>
                  </div>

                  {/* Submit button */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 rounded-xl font-medium transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mt-6"
                    style={{
                      background: 'linear-gradient(135deg, var(--accent-secondary) 0%, var(--accent-primary) 100%)',
                      color: 'var(--bg-primary)',
                      boxShadow: '0 0 20px rgba(0, 212, 255, 0.15)',
                    }}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>יוצר חשבון...</span>
                      </>
                    ) : (
                      <span>צור חשבון והתחל</span>
                    )}
                  </button>
                </form>

                {/* Footer */}
                <p className="text-center text-[var(--text-muted)] text-sm mt-5">
                  כבר יש לי חשבון?{' '}
                  <button
                    type="button"
                    onClick={() => switchMode(false)}
                    className="text-[var(--accent-primary)] hover:text-[var(--accent-primary)]/80 transition-colors font-medium"
                  >
                    התחבר
                  </button>
                </p>
              </div>

              {/* Bottom text */}
              <p className="text-center text-[var(--text-muted)] text-xs mt-5 pb-6">
                בהרשמה אתה מסכים ל
                <a href="#" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"> תנאי השימוש </a>
                ול
                <a href="#" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"> מדיניות הפרטיות</a>
              </p>
            </div>
          </div>
        </div>

        {/* ── Left side: Live Preview (40% on desktop, hidden on mobile) ── */}
        <div className="hidden lg:block lg:w-[40%] bg-[var(--bg-primary)] border-r border-white/[0.06] relative">
          <RegistrationPreview formData={signupData} />
        </div>
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════════════
  // RENDER — LOGIN MODE
  // ═════════════════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen flex" dir="rtl">
      {/* ── Left panel: Brand Visual (desktop only) ───────────────────── */}
      <div className="hidden lg:block lg:w-1/2 bg-[var(--bg-primary)] border-l border-white/[0.06] relative">
        <BrandVisual />
      </div>

      {/* ── Right panel: Auth Form ────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6 relative overflow-hidden bg-[var(--bg-primary)]">
        {/* Subtle background effects */}
        <div className="absolute top-1/4 -right-32 w-72 h-72 bg-[#00d4ff]/[0.04] rounded-full blur-[80px] pointer-events-none" />
        <div className="absolute bottom-1/4 -left-32 w-72 h-72 bg-[#0066cc]/[0.04] rounded-full blur-[80px] pointer-events-none" />

        <div className="relative w-full max-w-md fade-in">
          {/* Logo */}
          <div className="text-center mb-8">
            <img
              src="/logo-icon-only.svg"
              alt="Quieteyes"
              className="w-14 h-14 mx-auto mb-4 drop-shadow-[0_0_20px_rgba(0,212,255,0.3)]"
            />
            <h1
              className="text-3xl font-bold text-white mb-2"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Quiet<span className="text-[#00d4ff]">eyes</span>
            </h1>
            <p className="text-[var(--text-secondary)]">
              ברוך שובך. היכנס לחשבון שלך
            </p>
          </div>

          {/* Glass Card */}
          <div className="rounded-2xl p-8 border border-[var(--border)] bg-[var(--glass)] backdrop-blur-xl">
            {/* Toggle */}
            <div className="flex gap-1 p-1 bg-[var(--bg-elevated)] rounded-xl mb-6">
              <button
                type="button"
                onClick={() => switchMode(false)}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all duration-300 ${
                  !isSignUp
                    ? 'bg-[#00d4ff]/15 text-[#00d4ff] border border-[#00d4ff]/30 shadow-[0_0_12px_rgba(0,212,255,0.1)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }`}
              >
                התחברות
              </button>
              <button
                type="button"
                onClick={() => switchMode(true)}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all duration-300 ${
                  isSignUp
                    ? 'bg-[#00d4ff]/15 text-[#00d4ff] border border-[#00d4ff]/30 shadow-[0_0_12px_rgba(0,212,255,0.1)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }`}
              >
                הרשמה
              </button>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-4 p-3 rounded-xl bg-[var(--danger-bg)] border border-[var(--danger)]/30 flex items-center gap-3 text-[var(--danger)] fade-in">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <p className="text-sm">{error}</p>
              </div>
            )}

            {/* Success Message */}
            {successMessage && (
              <div className="mb-4 p-3 rounded-xl bg-[var(--success-bg)] border border-[var(--success)]/30 flex items-center gap-3 text-[var(--success)] fade-in">
                <Sparkles className="w-5 h-5 flex-shrink-0" />
                <p className="text-sm">{successMessage}</p>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleLoginSubmit} className="space-y-5">
              {/* Email Field */}
              <div>
                <label htmlFor="login-email" className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                  אימייל
                </label>
                <div className="relative">
                  <Mail className="absolute right-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" />
                  <input
                    id="login-email"
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                    dir="ltr"
                    className="w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl py-3 pr-12 pl-4 text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)]/50 transition-all"
                  />
                </div>
              </div>

              {/* Password Field */}
              {!showForgotPassword && (
                <div>
                  <label htmlFor="login-password" className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                    סיסמה
                  </label>
                  <div className="relative">
                    <Lock className="absolute right-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" />
                    <input
                      id="login-password"
                      type="password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="הזן סיסמה"
                      required
                      dir="ltr"
                      className="w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl py-3 pr-12 pl-4 text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)]/50 transition-all"
                    />
                  </div>
                </div>
              )}

              {/* Forgot Password Link */}
              {!showForgotPassword && (
                <div className="text-left">
                  <button
                    type="button"
                    onClick={() => { setShowForgotPassword(true); setError(null); setSuccessMessage(null); }}
                    className="text-sm text-[var(--accent-primary)] hover:text-[var(--accent-primary)]/80 transition-colors"
                  >
                    שכחת סיסמה?
                  </button>
                </div>
              )}

              {showForgotPassword && (
                <div className="text-left">
                  <button
                    type="button"
                    onClick={() => { setShowForgotPassword(false); setError(null); setSuccessMessage(null); }}
                    className="text-sm text-[var(--accent-primary)] hover:text-[var(--accent-primary)]/80 transition-colors"
                  >
                    חזרה להתחברות
                  </button>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl font-medium transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: 'linear-gradient(135deg, var(--accent-secondary) 0%, var(--accent-primary) 100%)',
                  color: 'var(--bg-primary)',
                  boxShadow: '0 0 20px rgba(0, 212, 255, 0.15)',
                }}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>{showForgotPassword ? 'שולח...' : 'מתחבר...'}</span>
                  </>
                ) : (
                  <span>{showForgotPassword ? 'שלח לינק לאיפוס' : 'התחבר'}</span>
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[var(--border)]" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-3 bg-[var(--glass)] text-[var(--text-muted)]">או</span>
              </div>
            </div>

            {/* Footer text */}
            <p className="text-center text-[var(--text-muted)] text-sm">
              אין לך חשבון?{' '}
              <button
                type="button"
                onClick={() => switchMode(true)}
                className="text-[var(--accent-primary)] hover:text-[var(--accent-primary)]/80 transition-colors font-medium"
              >
                הירשם עכשיו
              </button>
            </p>
          </div>

          {/* Bottom text */}
          <p className="text-center text-[var(--text-muted)] text-xs mt-6">
            בהתחברות אתה מסכים ל
            <a href="#" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"> תנאי השימוש </a>
            ול
            <a href="#" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"> מדיניות הפרטיות</a>
          </p>
        </div>
      </div>
    </div>
  );
}
