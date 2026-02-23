import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
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
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
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

interface WorkspaceRow {
  id: number;
  name: string;
  owner_email: string;
  tier: string;
  api_usage_24h: number;
  last_active: string;
  total_leads: number;
  total_competitors: number;
  businesses_count: number;
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

type SortDir = 'asc' | 'desc';

export default function SuperAdmin() {
  const { session } = useAuth();
  const { impersonate, stopImpersonating, isImpersonating, workspaceName: impersonatedName } = useWorkspace();
  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [workspaceRows, setWorkspaceRows] = useState<WorkspaceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedWs, setExpandedWs] = useState<number | null>(null);
  const [wsDetail, setWsDetail] = useState<Record<number, WorkspaceDetail>>({});
  const [sortBy, setSortBy] = useState<string>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const authHeaders = () => ({
    'Content-Type': 'application/json',
    ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
  });

  const userId = (session as any)?.user?.id || '';

  // Fetch global stats
  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const res = await fetch(`${API_BASE}/admin/super-dashboard?user_id=${userId}`, {
          headers: authHeaders(),
        });
        if (res.status === 403) {
          setError('אין הרשאה. גישה למנהלי-על בלבד.');
          return;
        }
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        setStats(data.global_stats);
      } catch {
        setError('שגיאה בטעינת נתונים');
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  // Fetch sortable workspaces table
  const fetchWorkspacesTable = async (sort: string, dir: SortDir) => {
    setTableLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/admin/super-dashboard/workspaces-table?user_id=${userId}&sort_by=${sort}&sort_dir=${dir}`,
        { headers: authHeaders() }
      );
      if (res.ok) {
        const data = await res.json();
        setWorkspaceRows(data.rows || []);
      }
    } catch {
      // silent — table will remain empty
    } finally {
      setTableLoading(false);
    }
  };

  useEffect(() => {
    if (!error) {
      fetchWorkspacesTable(sortBy, sortDir);
    }
  }, [sortBy, sortDir, error]);

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sortBy !== column) return <ArrowUpDown className="w-3 h-3 opacity-40" />;
    return sortDir === 'asc'
      ? <ArrowUp className="w-3 h-3 text-indigo-400" />
      : <ArrowDown className="w-3 h-3 text-indigo-400" />;
  };

  const toggleWorkspace = async (wsId: number) => {
    if (expandedWs === wsId) {
      setExpandedWs(null);
      return;
    }
    setExpandedWs(wsId);
    if (!wsDetail[wsId]) {
      try {
        const res = await fetch(
          `${API_BASE}/admin/super-dashboard/workspace/${wsId}?user_id=${userId}`,
          { headers: authHeaders() }
        );
        if (res.ok) {
          const data = await res.json();
          setWsDetail(prev => ({ ...prev, [wsId]: data }));
        }
      } catch { /* silent */ }
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffHours = Math.floor(diffMs / 3600000);
    if (diffHours < 1) return 'עכשיו';
    if (diffHours < 24) return `לפני ${diffHours} שע׳`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `לפני ${diffDays} ימים`;
    return d.toLocaleDateString('he-IL');
  };

  const handleImpersonate = async (wsId: number) => {
    try {
      const res = await fetch(
        `${API_BASE}/admin/impersonate/${wsId}?user_id=${userId}`,
        { method: 'POST', headers: authHeaders() }
      );
      if (res.ok) {
        const data = await res.json();
        const imp = data.impersonation;
        impersonate({
          workspace_id: imp.workspace_id,
          workspace_name: imp.workspace_name,
          role: imp.role,
        });
      }
    } catch { /* silent */ }
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
      {/* Impersonation Banner */}
      {isImpersonating && (
        <div className="bg-amber-500/20 border border-amber-500/40 rounded-xl px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Eye className="w-5 h-5 text-amber-400" />
            <span className="text-amber-200 text-sm font-medium">
              צופה כ-Workspace: <span className="text-white font-bold">{impersonatedName}</span>
            </span>
          </div>
          <button
            onClick={stopImpersonating}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/30 hover:bg-amber-500/50 text-amber-200 text-xs font-medium transition-colors"
          >
            <EyeOff className="w-3.5 h-3.5" />
            הפסק התחזות
          </button>
        </div>
      )}

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

      {/* Sortable Workspaces Table */}
      <div className="glass-card p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Building2 className="w-5 h-5 text-indigo-400" />
          Workspaces ({workspaceRows.length})
        </h2>

        {tableLoading && workspaceRows.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
          </div>
        ) : workspaceRows.length === 0 ? (
          <p className="text-center text-gray-500 py-8">אין workspaces במערכת</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700/50">
                  {[
                    { key: 'name', label: 'Name' },
                    { key: 'owner_email', label: 'Owner' },
                    { key: 'tier', label: 'Tier' },
                    { key: 'api_usage_24h', label: 'API (24h)' },
                    { key: 'last_active', label: 'Last Active' },
                    { key: 'total_leads', label: 'Leads' },
                    { key: 'total_competitors', label: 'Competitors' },
                    { key: 'businesses_count', label: 'Businesses' },
                  ].map(col => (
                    <th
                      key={col.key}
                      className="py-3 px-3 text-right text-xs font-medium text-gray-400 cursor-pointer hover:text-white transition-colors select-none"
                      onClick={() => handleSort(col.key)}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        {col.label}
                        <SortIcon column={col.key} />
                      </span>
                    </th>
                  ))}
                  <th className="py-3 px-3 text-right text-xs font-medium text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {workspaceRows.map(row => (
                  <>
                    <tr
                      key={row.id}
                      className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors"
                    >
                      <td className="py-3 px-3 text-white font-medium">{row.name}</td>
                      <td className="py-3 px-3 text-gray-300 text-xs">{row.owner_email || '—'}</td>
                      <td className="py-3 px-3">
                        <span className={`px-2.5 py-0.5 rounded-lg text-xs font-medium text-white ${TIER_COLORS[row.tier] || 'bg-gray-600'}`}>
                          {row.tier}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-gray-300">{row.api_usage_24h.toLocaleString()}</td>
                      <td className="py-3 px-3 text-gray-400 text-xs">{formatDate(row.last_active)}</td>
                      <td className="py-3 px-3 text-gray-300">{row.total_leads}</td>
                      <td className="py-3 px-3 text-gray-300">{row.total_competitors}</td>
                      <td className="py-3 px-3 text-gray-300">{row.businesses_count}</td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleWorkspace(row.id)}
                            className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1"
                          >
                            Details
                            {expandedWs === row.id
                              ? <ChevronUp className="w-3.5 h-3.5" />
                              : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            onClick={() => handleImpersonate(row.id)}
                            className="text-xs text-amber-400 hover:text-amber-300 transition-colors flex items-center gap-1"
                            title="התחזה ל-Workspace"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Expanded detail row */}
                    {expandedWs === row.id && wsDetail[row.id] && (
                      <tr key={`detail-${row.id}`}>
                        <td colSpan={9} className="bg-gray-800/20 px-6 py-4 border-b border-gray-700/30">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Members */}
                            <div>
                              <p className="text-xs text-gray-400 mb-2 font-medium">
                                חברי צוות ({wsDetail[row.id].members.length})
                              </p>
                              {wsDetail[row.id].members.map((m: any, i: number) => (
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
                            <div>
                              <p className="text-xs text-gray-400 mb-2 font-medium">מנוי</p>
                              {wsDetail[row.id].subscription ? (
                                <span className={`px-3 py-1 rounded-lg text-xs font-medium text-white ${TIER_COLORS[wsDetail[row.id].subscription.tier] || 'bg-gray-600'}`}>
                                  {wsDetail[row.id].subscription.tier} — {wsDetail[row.id].subscription.credits_remaining} קרדיטים
                                </span>
                              ) : (
                                <span className="text-gray-500 text-xs">אין מנוי</span>
                              )}
                            </div>

                            {/* Businesses */}
                            <div>
                              <p className="text-xs text-gray-400 mb-2 font-medium">
                                עסקים ({wsDetail[row.id].businesses.length})
                              </p>
                              {wsDetail[row.id].businesses.length > 0 ? (
                                wsDetail[row.id].businesses.map((b: any) => (
                                  <p key={b.id} className="text-sm text-gray-300">
                                    {b.business_name} — {b.industry}
                                  </p>
                                ))
                              ) : (
                                <span className="text-gray-500 text-xs">אין עסקים</span>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
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
