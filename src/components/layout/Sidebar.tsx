import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSubscription } from '../../context/SubscriptionContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useSimulation } from '../../context/SimulationContext';
import { apiFetch } from '../../services/api';
import {
  Focus,
  Map,
  TrendingUp,
  MessageSquare,
  Settings,
  LogOut,
  User,
  Loader2,
  BookOpen,
  Home,
  Radar,
  Crosshair,
  CreditCard,
  Archive,
  Users,
  FileDown,
  Menu,
  X,
  Zap,
  Megaphone,
  MoreHorizontal,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

const navItems = [
  { path: '/dashboard', label: 'הבית שלי', icon: Home, description: 'סיכום יומי והזדמנויות', end: true, emoji: '🏠' },
  { path: '/dashboard/focus', label: 'מה לעשות היום', icon: Focus, description: 'המוח הכין לך משימות', emoji: '🧠' },
  { path: '/dashboard/sniper', label: 'מי מחפש אותי', icon: Crosshair, description: 'לידים שעיני מצא', emoji: '🎯' },
  { path: '/dashboard/landscape', label: 'המתחרים שלי', icon: Map, description: 'מה הם עושים', emoji: '👀' },
  { path: '/dashboard/intelligence', label: 'מה קרה בזמן שישנתי', icon: Radar, description: 'עיני עקב בשבילך', emoji: '💡' },
  { path: '/dashboard/marketing', label: 'הקול שלי', icon: Megaphone, description: 'תוכן ושיווק', emoji: '📢' },
  { path: '/dashboard/horizon', label: 'מה מגיע אליי', icon: TrendingUp, description: 'הטווח מסתכל קדימה', emoji: '🔭' },
  { path: '/dashboard/reflection', label: 'אני מול המתחרים', icon: MessageSquare, description: 'מוניטין וביקורות', emoji: '📊' },
  { path: '/dashboard/knowledge', label: 'שאל אותי כל דבר', icon: BookOpen, description: 'בסיס ידע AI', emoji: '💬' },
  { path: '/dashboard/vault', label: 'הדוחות שלי', icon: Archive, description: 'ארכיון ודוחות', emoji: '📂' },
  { path: '/dashboard/reports', label: 'דוח שבועי', icon: FileDown, description: 'דוח מודיעין PDF', emoji: '📊' },
  { path: '/dashboard/automations', label: 'העוזרים שלי', icon: Zap, description: '6 העוזרים החכמים', emoji: '🤖' },
  { path: '/dashboard/staff', label: 'צוות', icon: Users, description: 'ניהול חברי צוות', minRole: 'admin' as const, emoji: '👥' },
  { path: '/dashboard/billing', label: 'התוכנית שלי', icon: CreditCard, description: 'ניהול מנוי ותשלום', emoji: '⭐' },
  { path: '/dashboard/settings', label: 'הגדרות', icon: Settings, description: 'הגדרות העסק', emoji: '⚙️' },
];

// Bottom nav shows these 5 items on mobile
const BOTTOM_NAV_ITEMS = [
  { path: '/dashboard', label: 'בית', icon: Home, end: true },
  { path: '/dashboard/sniper', label: 'לידים', icon: Crosshair },
  { path: '/dashboard/landscape', label: 'מתחרים', icon: Map },
  { path: '/dashboard/intelligence', label: 'מודיעין', icon: Radar },
];

const ROLE_LEVEL: Record<string, number> = { owner: 4, admin: 3, member: 2, viewer: 1 };

const TIER_COLORS: Record<string, string> = {
  free: 'bg-gray-600',
  basic: 'bg-blue-600',
  pro: 'bg-indigo-600',
  elite: 'bg-amber-600',
};

export default function Sidebar() {
  const { user, signOut } = useAuth();
  const { tier, tierName, creditsRemaining, creditsLimit, isLoading: subLoading, isTrial, trialDaysRemaining, isTrialExpired } = useSubscription();
  const { role } = useWorkspace();
  const { currentProfile } = useSimulation();
  const [signingOut, setSigningOut] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  // Close drawer on route change
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  const handleDownloadPDF = async () => {
    if (!currentProfile?.id || downloading) return;
    setDownloading(true);
    try {
      const response = await apiFetch(`/reports/weekly-brief/${currentProfile.id}`);
      if (response.status === 404) {
        toast.error('הדו"ח עדיין לא מוכן. המערכת תייצר אותו בקרוב.');
        return;
      }
      if (!response.ok) throw new Error('PDF generation failed');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `strategic-brief-${currentProfile.id.slice(0, 8)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error('לא הצלחנו להוריד את הדוח. נסה שוב');
    } finally {
      setDownloading(false);
    }
  };

  // Role-based nav filtering: default to full access (owner) if no workspace loaded yet
  const userLevel = role ? ROLE_LEVEL[role] || 0 : 4;
  const visibleItems = navItems.filter(item => {
    if (!item.minRole) return true;
    return userLevel >= (ROLE_LEVEL[item.minRole] || 0);
  });

  const handleLogout = async () => {
    setSigningOut(true);
    try {
      await signOut();
    } catch {
      toast.error('ההתנתקות לא הצליחה. נסה שוב');
      setSigningOut(false);
    }
  };

  return (
    <>
      {/* ═══════════════════════════════════════════════════════
          MOBILE BOTTOM NAV BAR (visible < md)
         ═══════════════════════════════════════════════════════ */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0a1628]/95 backdrop-blur-xl border-t border-gray-700/50 safe-area-bottom">
        <div className="flex items-center justify-around h-16">
          {BOTTOM_NAV_ITEMS.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end || false}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-0.5 py-1 px-3 min-w-[56px] min-h-[44px] rounded-lg transition-colors ${
                  isActive
                    ? 'text-cyan-400'
                    : 'text-gray-500'
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </NavLink>
          ))}
          {/* More button opens drawer */}
          <button
            onClick={() => setIsOpen(true)}
            className="flex flex-col items-center justify-center gap-0.5 py-1 px-3 min-w-[56px] min-h-[44px] rounded-lg text-gray-500 transition-colors"
          >
            <MoreHorizontal className="w-5 h-5" />
            <span className="text-[10px] font-medium">עוד</span>
          </button>
        </div>
      </nav>

      {/* ═══════════════════════════════════════════════════════
          MOBILE DRAWER OVERLAY (triggered by "More" or hamburger)
         ═══════════════════════════════════════════════════════ */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-[60] backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* ═══════════════════════════════════════════════════════
          SIDEBAR / DRAWER
          Desktop: always visible on right side
          Mobile: slide-in drawer from right
         ═══════════════════════════════════════════════════════ */}
      <aside className={`sidebar fixed top-0 right-0 h-screen w-72 glass border-l border-gray-700/50 flex flex-col z-[70] transition-transform duration-300 ${isOpen ? 'translate-x-0' : 'translate-x-full'} md:translate-x-0`}>
        {/* Close button - mobile only */}
        <button
          onClick={() => setIsOpen(false)}
          className="md:hidden absolute top-4 left-4 w-10 h-10 rounded-xl bg-gray-800/80 flex items-center justify-center text-gray-400 hover:text-white z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Logo Section */}
        <div className="p-6 border-b border-gray-700/30">
          <div className="flex items-center gap-3">
            <img src="/logo-icon-only.svg" alt="Quieteyes" className="w-10 h-10" />
            <div>
              <h1 className="text-xl font-bold text-white" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                Quiet<span className="text-[#00d4ff]">eyes</span>
              </h1>
              <p className="text-xs text-gray-400">מודיעין עסקי</p>
            </div>
          </div>
          {/* Plan Badge + Credits */}
          {!subLoading && (
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className={`px-2 py-0.5 rounded text-xs font-medium text-white ${TIER_COLORS[tier] || 'bg-gray-600'}`}>
                  {tierName}
                </span>
                <span className="text-xs text-gray-400" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  {tier === 'elite' ? '∞' : creditsRemaining}/{tier === 'elite' ? '∞' : creditsLimit}
                </span>
              </div>
              {tier !== 'elite' && creditsLimit > 0 && (
                <div className="h-1 bg-gray-700/50 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, (creditsRemaining / creditsLimit) * 100)}%` }}
                  />
                </div>
              )}
              {/* Trial indicator */}
              {isTrial && trialDaysRemaining > 0 && (
                <div className={`mt-2 px-3 py-1.5 rounded-lg text-xs font-medium text-center ${
                  trialDaysRemaining <= 2
                    ? 'bg-red-500/20 text-red-400 animate-pulse'
                    : trialDaysRemaining <= 5
                      ? 'bg-amber-500/20 text-amber-400'
                      : 'bg-emerald-500/20 text-emerald-400'
                }`}>
                  {trialDaysRemaining <= 2
                    ? `🔴 ${trialDaysRemaining} ימים נותרו`
                    : trialDaysRemaining <= 5
                      ? `⚠️ ${trialDaysRemaining} ימים נותרו | שדרג`
                      : `✓ ניסיון חינמי | ${trialDaysRemaining} ימים נותרו`
                  }
                </div>
              )}
              {isTrialExpired && (
                <NavLink
                  to="/dashboard/billing"
                  className="mt-2 block px-3 py-1.5 rounded-lg text-xs font-medium text-center bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                >
                  הניסיון הסתיים — שדרג לגרסה מלאה
                </NavLink>
              )}
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {visibleItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end || false}
              onClick={() => setIsOpen(false)}
              title={item.description}
              className={({ isActive }) =>
                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group min-h-[44px] " +
                (isActive
                  ? "bg-cyan-500/10 text-white border-l-2 border-l-cyan-400"
                  : "text-gray-400 hover:bg-gray-800/50 hover:text-white border-l-2 border-l-transparent")
              }
            >
              <item.icon className="w-5 h-5" />
              <div className="flex-1">
                <span className="block font-medium">{item.label}</span>
                <span className="text-xs text-gray-500 group-hover:text-gray-400">
                  {item.description}
                </span>
              </div>
            </NavLink>
          ))}
        </nav>

        {/* Download Strategy PDF */}
        {currentProfile?.id && (
          <div className="px-4 pb-2">
            <button
              onClick={handleDownloadPDF}
              disabled={downloading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#0066cc] to-[#00d4ff] hover:from-[#0077dd] hover:to-[#00e0ff] text-black font-medium text-sm transition-all duration-300 disabled:opacity-50 shadow-[0_0_20px_rgba(0,212,255,0.15)] min-h-[44px]"
            >
              {downloading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>מייצר PDF...</span>
                </>
              ) : (
                <>
                  <FileDown className="w-4 h-4" />
                  <span>הורד דו"ח אסטרטגי</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* User Section */}
        <div className="p-4 border-t border-gray-700/30">
          <div className="glass-card p-4 mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                <User className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {user?.email || 'משתמש'}
                </p>
                <p className="text-xs text-gray-400">
                  חשבון פעיל
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            disabled={signingOut}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all duration-300 disabled:opacity-50 min-h-[44px]"
          >
            {signingOut ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>מתנתק...</span>
              </>
            ) : (
              <>
                <LogOut className="w-4 h-4" />
                <span>התנתק</span>
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}
