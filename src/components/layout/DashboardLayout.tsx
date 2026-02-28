import { Outlet, NavLink } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Sidebar from './Sidebar';
import AiAssistant from '../ui/AiAssistant';
import { useSubscription } from '../../context/SubscriptionContext';
import { AlertTriangle, X } from 'lucide-react';
import { useState } from 'react';

export default function DashboardLayout() {
  const { isTrial, isTrialExpired, trialDaysRemaining } = useSubscription();
  const [bannerDismissed, setBannerDismissed] = useState(() => {
    try { return localStorage.getItem('qe_banner_dismissed') === '1'; } catch { return false; }
  });

  // Show urgency banner from day 12 onward (3 days or less remaining)
  const showBanner = !bannerDismissed && (
    (isTrial && trialDaysRemaining <= 3 && trialDaysRemaining > 0) || isTrialExpired
  );

  return (
    <div className="min-h-screen flex">
      {/* Sidebar - Fixed on Right (RTL), hidden on mobile (bottom nav replaces it) */}
      <Sidebar />

      {/* Mobile Top Header */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 h-14 bg-[#0a1628]/95 backdrop-blur-xl border-b border-gray-700/50 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <img src="/logo-icon-only.svg" alt="Quieteyes" className="w-8 h-8" />
          <span className="text-lg font-bold text-white" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Quiet<span className="text-[#00d4ff]">eyes</span>
          </span>
        </div>
      </header>

      {/* Main Content
          Desktop: offset for sidebar (mr-72), small top padding
          Mobile: offset for top header (pt-14), offset for bottom nav (pb-20)
      */}
      <main className="flex-1 md:mr-72 pt-14 md:pt-6 pb-20 md:pb-0 p-4 md:p-6 overflow-y-auto">
        {/* Trial urgency banner */}
        {showBanner && (
          <div className={`mb-4 p-3 md:p-4 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 ${
            isTrialExpired
              ? 'bg-red-500/10 border-red-500/30'
              : 'bg-amber-500/10 border-amber-500/30'
          }`} dir="rtl">
            <div className="flex items-center gap-3">
              <AlertTriangle className={`w-5 h-5 flex-shrink-0 ${
                isTrialExpired ? 'text-red-400' : 'text-amber-400'
              }`} />
              <div>
                <p className={`font-medium text-sm ${
                  isTrialExpired ? 'text-red-300' : 'text-amber-300'
                }`}>
                  {isTrialExpired
                    ? 'הניסיון החינמי שלך הסתיים'
                    : `נותרו ${trialDaysRemaining} ימים בניסיון החינמי שלך`
                  }
                </p>
                <p className="text-gray-400 text-xs mt-0.5">
                  {isTrialExpired
                    ? 'אל תאבד את הלידים והמעקבים שלך'
                    : 'שדרג כדי להמשיך לקבל מודיעין עסקי מלא'
                  }
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 w-full sm:w-auto">
              <NavLink
                to="/dashboard/billing"
                className="flex-1 sm:flex-initial text-center px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-sm font-medium transition-all min-h-[44px] flex items-center justify-center"
              >
                {isTrialExpired ? 'שדרג עכשיו' : `שדרג עכשיו — ₪149/חודש`}
              </NavLink>
              {!isTrialExpired && (
                <button
                  onClick={() => { setBannerDismissed(true); try { localStorage.setItem('qe_banner_dismissed', '1'); } catch {} }}
                  className="p-2 rounded-lg text-gray-500 hover:text-white hover:bg-gray-800 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}

        <div className="max-w-7xl mx-auto animate-[fadeIn_0.3s_ease-out]">
          <Outlet />
        </div>
      </main>

      {/* Floating AI Assistant - hidden on mobile to avoid overlap with bottom nav */}
      <div className="hidden md:block">
        <AiAssistant />
      </div>

      {/* Toast Notifications */}
      <Toaster
        position="top-left"
        toastOptions={{
          className: 'text-sm',
          style: {
            background: '#1e1e2e',
            color: '#e2e8f0',
            border: '1px solid rgba(0, 212, 255, 0.3)',
            direction: 'rtl',
          },
        }}
      />
    </div>
  );
}
