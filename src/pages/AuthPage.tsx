import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Eye, Mail, Lock, Loader2, AlertCircle, Sparkles } from 'lucide-react';

export default function AuthPage() {
  const { signIn, signUp } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
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
      if (isSignUp) {
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
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-indigo-950 to-gray-900" />
      <div className="absolute top-1/4 -right-32 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 -left-32 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl" />

      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-indigo-400/30 rounded-full animate-pulse"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 3}s`,
              animationDuration: `${2 + Math.random() * 3}s`,
            }}
          />
        ))}
      </div>

      {/* Auth Card */}
      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 mb-4 shadow-lg shadow-indigo-500/30">
            <Eye className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Quiet Eyes</h1>
          <p className="text-gray-400">מודיעין עסקי חכם לעסקים קטנים</p>
        </div>

        {/* Glass Card */}
        <div className="glass-card p-8 border border-gray-700/50 backdrop-blur-xl">
          {/* Toggle */}
          <div className="flex gap-2 p-1 bg-gray-800/50 rounded-xl mb-6">
            <button
              type="button"
              onClick={() => { setIsSignUp(false); setError(null); setSuccessMessage(null); }}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                !isSignUp
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              התחברות
            </button>
            <button
              type="button"
              onClick={() => { setIsSignUp(true); setError(null); setSuccessMessage(null); }}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isSignUp
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              הרשמה
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center gap-3 text-red-400 fade-in">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          {/* Success Message */}
          {successMessage && (
            <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3 text-emerald-400 fade-in">
              <Sparkles className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm">{successMessage}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                אימייל
              </label>
              <div className="relative">
                <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  dir="ltr"
                  className="w-full bg-gray-800/50 border border-gray-700 rounded-xl py-3 pr-11 pl-4 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                סיסמה
              </label>
              <div className="relative">
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isSignUp ? 'לפחות 6 תווים' : 'הזן סיסמה'}
                  required
                  minLength={6}
                  dir="ltr"
                  className="w-full bg-gray-800/50 border border-gray-700 rounded-xl py-3 pr-11 pl-4 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-medium shadow-lg shadow-indigo-500/30 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>{isSignUp ? 'יוצר חשבון...' : 'מתחבר...'}</span>
                </>
              ) : (
                <span>{isSignUp ? 'צור חשבון' : 'התחבר'}</span>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-700/50" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-gray-900/50 text-gray-500">או</span>
            </div>
          </div>

          {/* Footer text */}
          <p className="text-center text-gray-500 text-sm">
            {isSignUp ? (
              <>
                יש לך כבר חשבון?{' '}
                <button
                  type="button"
                  onClick={() => setIsSignUp(false)}
                  className="text-indigo-400 hover:text-indigo-300 transition-colors"
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
                  className="text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  הירשם עכשיו
                </button>
              </>
            )}
          </p>
        </div>

        {/* Bottom text */}
        <p className="text-center text-gray-600 text-xs mt-6">
          בהתחברות אתה מסכים ל
          <a href="#" className="text-gray-500 hover:text-gray-400"> תנאי השימוש </a>
          ול
          <a href="#" className="text-gray-500 hover:text-gray-400"> מדיניות הפרטיות</a>
        </p>
      </div>
    </div>
  );
}
