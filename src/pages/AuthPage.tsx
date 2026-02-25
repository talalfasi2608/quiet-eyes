import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, Loader2, AlertCircle, Sparkles, Shield, Radar, TrendingUp, Zap } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// BRAND VISUAL — Animated radar + feature highlights
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
        style={{ fontFamily: "var(--font-display)" }}
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
// AUTH PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export default function AuthPage() {
  const { signIn, signUp, resetPassword } = useAuth();
  const [searchParams] = useSearchParams();
  const [isSignUp, setIsSignUp] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  // Read URL params: ?tab=register opens signup, ?plan=pro stores selected plan
  useEffect(() => {
    if (searchParams.get('tab') === 'register') {
      setIsSignUp(true);
    }
    const plan = searchParams.get('plan');
    if (plan) {
      localStorage.setItem('quieteyes_selected_plan', plan);
    }
  }, [searchParams]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      if (showForgotPassword) {
        const { error } = await resetPassword(email);
        if (error) {
          setError(getErrorMessage(error.message));
        } else {
          setSuccessMessage('נשלח אליך מייל לאיפוס סיסמה. בדוק את תיבת הדואר שלך.');
        }
      } else if (isSignUp) {
        const { error } = await signUp(email, password);
        if (error) {
          setError(getErrorMessage(error.message));
        } else {
          setSuccessMessage('נשלח אליך מייל אימות. בדוק את תיבת הדואר שלך.');
          setEmail('');
          setPassword('');
        }
      } else {
        const { error } = await signIn(email, password);
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

  const getErrorMessage = (message: string): string => {
    if (message.includes('Invalid login credentials')) {
      return 'אימייל או סיסמה שגויים';
    }
    if (message.includes('Email not confirmed')) {
      return 'יש לאמת את האימייל לפני הכניסה';
    }
    if (message.includes('User already registered')) {
      return 'משתמש עם אימייל זה כבר קיים';
    }
    if (message.includes('Password should be at least')) {
      return 'הסיסמה חייבת להיות לפחות 6 תווים';
    }
    if (message.includes('Invalid email')) {
      return 'כתובת אימייל לא תקינה';
    }
    return message;
  };

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
              style={{ fontFamily: "var(--font-display)" }}
            >
              Quiet<span className="text-[#00d4ff]">eyes</span>
            </h1>
            <p className="text-[var(--text-secondary)]">
              {isSignUp ? 'צור חשבון והתחל לעקוב אחרי השוק' : 'ברוך שובך. היכנס לחשבון שלך'}
            </p>
          </div>

          {/* Glass Card */}
          <div className="rounded-2xl p-8 border border-[var(--border)] bg-[var(--glass)] backdrop-blur-xl">
            {/* Toggle */}
            <div className="flex gap-1 p-1 bg-[var(--bg-elevated)] rounded-xl mb-6">
              <button
                type="button"
                onClick={() => { setIsSignUp(false); setError(null); setSuccessMessage(null); }}
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
                onClick={() => { setIsSignUp(true); setError(null); setSuccessMessage(null); }}
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

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email Field */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                  אימייל
                </label>
                <div className="relative">
                  <Mail className="absolute right-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
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
                  <label htmlFor="password" className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                    סיסמה
                  </label>
                  <div className="relative">
                    <Lock className="absolute right-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" />
                    <input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={isSignUp ? 'לפחות 6 תווים' : 'הזן סיסמה'}
                      required
                      minLength={6}
                      dir="ltr"
                      className="w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl py-3 pr-12 pl-4 text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)]/50 transition-all"
                    />
                  </div>
                </div>
              )}

              {/* Forgot Password Link */}
              {!isSignUp && !showForgotPassword && (
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
                    <span>{showForgotPassword ? 'שולח...' : isSignUp ? 'יוצר חשבון...' : 'מתחבר...'}</span>
                  </>
                ) : (
                  <span>{showForgotPassword ? 'שלח לינק לאיפוס' : isSignUp ? 'צור חשבון' : 'התחבר'}</span>
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
              {isSignUp ? (
                <>
                  יש לך כבר חשבון?{' '}
                  <button
                    type="button"
                    onClick={() => setIsSignUp(false)}
                    className="text-[var(--accent-primary)] hover:text-[var(--accent-primary)]/80 transition-colors font-medium"
                  >
                    התחבר
                  </button>
                </>
              ) : (
                <>
                  אין לך חשבון?{' '}
                  <button
                    type="button"
                    onClick={() => setIsSignUp(true)}
                    className="text-[var(--accent-primary)] hover:text-[var(--accent-primary)]/80 transition-colors font-medium"
                  >
                    הירשם עכשיו
                  </button>
                </>
              )}
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
