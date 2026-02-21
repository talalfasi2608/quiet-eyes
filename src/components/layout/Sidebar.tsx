import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
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
} from 'lucide-react';
import { useState } from 'react';

const navItems = [
  { path: '/dashboard', label: 'בית', icon: Home, description: 'Business DNA', end: true },
  { path: '/dashboard/focus', label: 'מיקוד', icon: Focus, description: 'מרכז השליטה' },
  { path: '/dashboard/landscape', label: 'נוף', icon: Map, description: 'מתחרים' },
  { path: '/dashboard/intelligence', label: 'מודיעין', icon: Radar, description: 'מחירים ופרסום' },
  { path: '/dashboard/sniper', label: 'צלף לידים', icon: Crosshair, description: 'לידים חיים' },
  { path: '/dashboard/horizon', label: 'אופק', icon: TrendingUp, description: 'מגמות' },
  { path: '/dashboard/reflection', label: 'השתקפות', icon: MessageSquare, description: 'מוניטין' },
  { path: '/dashboard/knowledge', label: 'ידע', icon: BookOpen, description: 'בסיס ידע ונישה' },
  { path: '/dashboard/settings', label: 'הגדרות', icon: Settings, description: 'פרופיל העסק' },
];

export default function Sidebar() {
  const { user, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

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
            <Eye className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Quiet Eyes</h1>
            <p className="text-xs text-gray-400">מודיעין עסקי</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {navItems.map((item) => (
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
