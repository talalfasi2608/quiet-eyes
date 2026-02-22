import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSubscription } from '../../context/SubscriptionContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useSimulation } from '../../context/SimulationContext';
import { apiFetch } from '../../services/api';
import {
  Eye,
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
  Ghost,
  CreditCard,
  Archive,
  Users,
  FileDown,
} from 'lucide-react';
import { useState } from 'react';

const navItems = [
  { path: '/dashboard', label: 'הקוקפיט', icon: Home, description: 'תדריך יומי ומודיעין', end: true },
  { path: '/dashboard/focus', label: 'מיקוד', icon: Focus, description: 'מרכז השליטה' },
  { path: '/dashboard/landscape', label: 'נוף', icon: Map, description: 'מתחרים' },
  { path: '/dashboard/intelligence', label: 'מודיעין', icon: Radar, description: 'מחירים ופרסום' },
  { path: '/dashboard/sniper', label: 'צלף הזדמנויות', icon: Crosshair, description: 'לידים חיים' },
  { path: '/dashboard/horizon', label: 'אופק', icon: TrendingUp, description: 'מגמות' },
  { path: '/dashboard/reflection', label: 'השתקפות', icon: MessageSquare, description: 'מוניטין' },
  { path: '/dashboard/knowledge', label: 'ידע', icon: BookOpen, description: 'בסיס ידע ונישה' },
  { path: '/dashboard/vault', label: 'הכספת', icon: Archive, description: 'ארכיון מודיעין' },
  { path: '/dashboard/reports', label: 'דו"חות', icon: FileDown, description: 'דו"ח אסטרטגי שבועי' },
  { path: '/dashboard/staff', label: 'צוות', icon: Users, description: 'ניהול חברי צוות', minRole: 'admin' as const },
  { path: '/dashboard/billing', label: 'מנוי', icon: CreditCard, description: 'ניהול תוכנית ותשלום' },
  { path: '/dashboard/settings', label: 'הגדרות', icon: Settings, description: 'פרופיל העסק' },
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
  const { tier, tierName, creditsRemaining, creditsLimit, isLoading: subLoading } = useSubscription();
  const { role } = useWorkspace();
  const { currentProfile } = useSimulation();
  const [signingOut, setSigningOut] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const handleDownloadPDF = async () => {
    if (!currentProfile?.id || downloading) return;
    setDownloading(true);
    try {
      const response = await apiFetch(`/reports/weekly-brief/${currentProfile.id}`);
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
      console.error('PDF download error:', err);
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
    await signOut();
    // The AuthContext will handle the state change and App.tsx will show AuthPage
  };

  return (
    <aside className="sidebar fixed top-0 right-0 h-screen w-72 glass border-l border-gray-700/50 flex flex-col z-50">
      {/* Logo Section */}
      <div className="p-6 border-b border-gray-700/30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center glow-primary">
            <Ghost className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Strategic Ghost</h1>
            <p className="text-xs text-gray-400">מודיעין עסקי</p>
          </div>
        </div>
        {/* Plan Badge + Credits */}
        {!subLoading && (
          <div className="mt-3 flex items-center justify-between">
            <span className={`px-2 py-0.5 rounded text-xs font-medium text-white ${TIER_COLORS[tier] || 'bg-gray-600'}`}>
              {tierName}
            </span>
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <CreditCard className="w-3 h-3" />
              {tier === 'elite' ? '∞' : creditsRemaining}/{tier === 'elite' ? '∞' : creditsLimit}
            </span>
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
            className={({ isActive }) =>
              "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group " +
              (isActive
                ? "bg-indigo-500/20 border border-indigo-500/30 text-white"
                : "text-gray-400 hover:bg-gray-800/50 hover:text-white")
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
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-medium text-sm transition-all duration-300 disabled:opacity-50 glow-primary"
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
          className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all duration-300 disabled:opacity-50"
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
  );
}
