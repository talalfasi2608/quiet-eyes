import { Outlet, NavLink } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Sidebar from './Sidebar';
import AiAssistant from '../ui/AiAssistant';
import { useSubscription } from '../../context/SubscriptionContext';
import { AlertTriangle, X } from 'lucide-react';
import { useState } from 'react';

export default function DashboardLayout() {
  const { isTrial, isTrialExpired, trialDaysRemaining } = useSubscription();
  const [bannerDismissed, setBannerDismissed] = useState(false);

  // Show urgency banner from day 12 onward (3 days or less remaining)
  const showBanner = !bannerDismissed && (
    (isTrial && trialDaysRemaining <= 3 && trialDaysRemaining > 0) || isTrialExpired
  );

  return (
    <div className="min-h-screen flex">
      {/* Sidebar - Fixed on Right (RTL) */}
      <Sidebar />

      {/* Main Content - Offset for sidebar */}
      <main className="flex-1 md:mr-72 pt-16 md:pt-6 p-4 md:p-6 overflow-y-auto">
        {/* Trial urgency banner */}
        {showBanner && (
          <div className={`mb-4 p-4 rounded-2xl border flex items-center justify-between gap-4 ${
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
                    : `⚠️ נותרו ${trialDaysRemaining} ימים בניסיון החינמי שלך`
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
            <div className="flex items-center gap-2 flex-shrink-0">
              <NavLink
                to="/dashboard/billing"
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-sm font-medium transition-all"
              >
                {isTrialExpired ? 'שדרג עכשיו' : `שדרג עכשיו — ₪149/חודש`}
              </NavLink>
              {!isTrialExpired && (
                <button
                  onClick={() => setBannerDismissed(true)}
                  className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-gray-800 transition-colors"
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

      {/* Floating AI Assistant */}
      <AiAssistant />

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
