import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Eye, Mail, Lock, ChevronLeft } from 'lucide-react';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessName.trim()) return;

    setIsLoading(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    login(businessName);
    setIsLoading(false);
    navigate('/onboarding');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center glow-primary mb-4">
            <Eye className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Quiet Eyes</h1>
          <p className="text-gray-400">מודיעין עסקי חכם</p>
        </div>

        {/* Login Card */}
        <div className="glass-card">
          <h2 className="text-xl font-semibold text-white mb-6 text-center">
            התחבר לחשבון שלך
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-gray-400 text-sm mb-2">שם העסק</label>
              <div className="relative">
                <Mail className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="לדוגמה: פיצה רומא"
                  className="input-glass pr-12"
                  dir="rtl"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-gray-400 text-sm mb-2">אימייל</label>
              <div className="relative">
                <Lock className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@example.com"
                  className="input-glass pr-12"
                  dir="ltr"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={!businessName.trim() || isLoading}
              className="btn-primary w-full flex items-center justify-center gap-2 mt-6 disabled:opacity-50"
            >
              {isLoading ? (
                <span>מתחבר...</span>
              ) : (
                <>
                  <span>התחל</span>
                  <ChevronLeft className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-700/50 text-center">
            <p className="text-gray-500 text-sm">
              אין לך חשבון?{' '}
              <button className="text-indigo-400 hover:text-indigo-300 transition-colors">
                הרשם עכשיו
              </button>
            </p>
          </div>
        </div>

        {/* Demo Mode Notice */}
        <div className="mt-4 text-center">
          <p className="text-gray-500 text-sm">
            גרסת דמו - פשוט הכנס שם עסק להתחלה
          </p>
        </div>
      </div>
    </div>
  );
}
