import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  ShieldAlert,
  Users,
  Building2,
  Crosshair,
  Map,
  CreditCard,
  Activity,
  Loader2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

const API_BASE = 'http://localhost:8015';

interface GlobalStats {
  total_users: number;
  total_workspaces: number;
  total_businesses: number;
  total_leads: number;
  total_competitors: number;
  total_credits_spent: number;
  api_calls_24h: number;
  tier_breakdown: Record<string, number>;
}

interface Workspace {
  id: number;
  name: string;
  created_at: string;
}

interface WorkspaceDetail {
  workspace: any;
  members: any[];
  subscription: any;
  businesses: any[];
}

const TIER_COLORS: Record<string, string> = {
  free: 'bg-gray-600',
  basic: 'bg-blue-600',
  pro: 'bg-indigo-600',
  elite: 'bg-amber-600',
};

export default function SuperAdmin() {
  const { session } = useAuth();
  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedWs, setExpandedWs] = useState<number | null>(null);
  const [wsDetail, setWsDetail] = useState<Record<number, WorkspaceDetail>>({});

  const authHeaders = () => ({
    'Content-Type': 'application/json',
    ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
  });

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const res = await fetch(`${API_BASE}/admin/super-dashboard`, {
          headers: authHeaders(),
        });
        if (res.status === 403) {
          setError('אין הרשאה. גישה למנהלי-על בלבד.');
          return;
        }
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        setStats(data.global_stats);
        setWorkspaces(data.workspaces || []);
      } catch {
        setError('שגיאה בטעינת נתונים');
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  const toggleWorkspace = async (wsId: number) => {
    if (expandedWs === wsId) {
      setExpandedWs(null);
      return;
    }
    setExpandedWs(wsId);
    if (!wsDetail[wsId]) {
      try {
        const res = await fetch(`${API_BASE}/admin/super-dashboard/workspace/${wsId}`, {
          headers: authHeaders(),
        });
        if (res.ok) {
          const data = await res.json();
          setWsDetail(prev => ({ ...prev, [wsId]: data }));
        }
      } catch { /* silent */ }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-10 h-10 text-red-500 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="glass-card p-8 text-center max-w-md">
          <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">גישה נדחתה</h2>
          <p className="text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-red-600 to-orange-600 flex items-center justify-center">
          <ShieldAlert className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-white">מנהל-על</h1>
          <p className="text-gray-400">סטטיסטיקות גלובליות וניהול פלטפורמה</p>
        </div>
      </div>

      {/* Global Stats Grid */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={Users} label="משתמשים" value={stats.total_users} color="from-blue-500 to-blue-600" />
          <StatCard icon={Building2} label="עסקים" value={stats.total_businesses} color="from-emerald-500 to-emerald-600" />
          <StatCard icon={Crosshair} label="לידים" value={stats.total_leads} color="from-red-500 to-red-600" />
          <StatCard icon={Map} label="מתחרים" value={stats.total_competitors} color="from-purple-500 to-purple-600" />
          <StatCard icon={CreditCard} label="קרדיטים שנוצלו" value={stats.total_credits_spent} color="from-amber-500 to-amber-600" />
          <StatCard icon={Activity} label="API קריאות (24 שע)" value={stats.api_calls_24h} color="from-indigo-500 to-indigo-600" />
          <div className="glass-card p-4 col-span-2">
            <p className="text-xs text-gray-400 mb-2">חלוקת מנויים</p>
            <div className="flex gap-2 flex-wrap">
              {Object.entries(stats.tier_breakdown).map(([tier, count]) => (
                <span key={tier} className={`px-3 py-1 rounded-lg text-xs font-medium text-white ${TIER_COLORS[tier] || 'bg-gray-600'}`}>
                  {tier}: {count}
                </span>
              ))}
              {Object.keys(stats.tier_breakdown).length === 0 && (
                <span className="text-gray-500 text-xs">אין מנויים</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Workspaces Table */}
      <div className="glass-card p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Building2 className="w-5 h-5 text-indigo-400" />
          Workspaces ({workspaces.length})
        </h2>

        {workspaces.length === 0 ? (
          <p className="text-center text-gray-500 py-8">אין workspaces במערכת</p>
        ) : (
          <div className="space-y-2">
            {workspaces.map((ws) => (
              <div key={ws.id} className="rounded-xl bg-gray-800/50 border border-gray-700/30 overflow-hidden">
                <button
                  onClick={() => toggleWorkspace(ws.id)}
                  className="w-full flex items-center justify-between p-4 hover:bg-gray-800/70 transition-all text-right"
                >
                  <div>
                    <p className="text-white font-medium">{ws.name || `Workspace #${ws.id}`}</p>
                    <p className="text-xs text-gray-500">
                      נוצר {new Date(ws.created_at).toLocaleDateString('he-IL')}
                    </p>
                  </div>
                  {expandedWs === ws.id ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </button>

                {expandedWs === ws.id && wsDetail[ws.id] && (
                  <div className="px-4 pb-4 border-t border-gray-700/30 space-y-3">
                    {/* Members */}
                    <div className="mt-3">
                      <p className="text-xs text-gray-400 mb-2">חברי צוות ({wsDetail[ws.id].members.length})</p>
                      {wsDetail[ws.id].members.map((m: any, i: number) => (
                        <div key={i} className="flex items-center justify-between py-1 text-sm">
                          <span className="text-gray-300">{m.invited_email || m.user_id?.slice(0, 8) || '—'}</span>
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            m.role === 'owner' ? 'bg-amber-500/20 text-amber-400' :
                            m.role === 'admin' ? 'bg-indigo-500/20 text-indigo-400' :
                            'bg-gray-500/20 text-gray-400'
                          }`}>
                            {m.role}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Subscription */}
                    {wsDetail[ws.id].subscription && (
                      <div>
                        <p className="text-xs text-gray-400 mb-1">מנוי</p>
                        <span className={`px-3 py-1 rounded-lg text-xs font-medium text-white ${TIER_COLORS[wsDetail[ws.id].subscription.tier] || 'bg-gray-600'}`}>
                          {wsDetail[ws.id].subscription.tier} — {wsDetail[ws.id].subscription.credits_remaining} קרדיטים
                        </span>
                      </div>
                    )}

                    {/* Businesses */}
                    {wsDetail[ws.id].businesses.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-400 mb-1">עסקים ({wsDetail[ws.id].businesses.length})</p>
                        {wsDetail[ws.id].businesses.map((b: any) => (
                          <p key={b.id} className="text-sm text-gray-300">
                            {b.business_name} — {b.industry}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: {
  icon: typeof Users;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="text-2xl font-bold text-white">{value.toLocaleString()}</p>
          <p className="text-xs text-gray-400">{label}</p>
        </div>
      </div>
    </div>
  );
}
