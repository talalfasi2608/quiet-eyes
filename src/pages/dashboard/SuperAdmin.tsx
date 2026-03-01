import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { apiFetch } from '../../services/api';
import {
  ShieldAlert,
  Users,
  Building2,
  Crosshair,
  Map,
  CreditCard,
  Activity,
  Loader2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  Search,
  Crown,
  TrendingUp,
  UserX,
  Trash2,
  MessageCircle,
  Percent,
  Clock,
  Ban,
  Send,
  Server,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Megaphone,
  Plus,
  RefreshCw,
  DollarSign,
  UserPlus,
  ChevronLeft,
  ChevronRight,
  Rocket,
  Star as StarIcon,
  Hash,
  Smile,
  Frown,
  Meh,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import PageLoader from '../../components/ui/PageLoader';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

type TabId = 'overview' | 'users' | 'subscriptions' | 'health' | 'announcements' | 'beta';
type SortDir = 'asc' | 'desc';

interface OverviewData {
  total_users: number;
  active_subscriptions: number;
  tier_breakdown: Record<string, number>;
  active_trials: number;
  mrr: number;
  arr: number;
  new_signups_week: number;
  churn_month: number;
  api_calls_24h: number;
  total_businesses: number;
  total_leads: number;
  total_competitors: number;
  api_status: Record<string, boolean>;
}

interface UserRow {
  id: string;
  email: string;
  name: string;
  tier: string;
  status: string;
  is_trial: boolean;
  trial_ends_at: string | null;
  discount_percent: number;
  joined: string;
  last_sign_in: string;
  workspace_id: string | null;
  mrr: number;
}

interface RevenueMonth {
  month: string;
  label: string;
  mrr: number;
  new_subscriptions: number;
  churned: number;
}

interface ApiHealth {
  status: string;
  message: string;
}

interface JobStatus {
  job_type: string;
  active_count: number;
  paused_count: number;
  last_run_at: string | null;
  next_run_at: string | null;
}

interface ApiHealthResult {
  name: string;
  status: 'ok' | 'error' | 'not_configured';
  optional?: boolean;
  response_time_ms: number;
  error: string | null;
  details: string | null;
}

interface ApiHealthData {
  checked_at: string;
  apis: ApiHealthResult[];
  summary: { total: number; ok: number; error: number; not_configured: number };
}

interface HealthData {
  apis: Record<string, ApiHealth>;
  scheduler: {
    radar_running: boolean;
    jobs: JobStatus[];
  };
  error_logs: Array<{
    method: string;
    path: string;
    status_code: number;
    created_at: string;
    user_id: string;
    response_time_ms: number;
  }>;
}

interface ModalState {
  type: 'plan' | 'discount' | 'extend' | 'whatsapp' | 'suspend' | 'delete' | 'create_sub' | null;
  user?: UserRow;
}

const TIER_COLORS: Record<string, string> = {
  none: 'bg-gray-600',
  starter: 'bg-blue-600',
  pro: 'bg-indigo-600',
  agency: 'bg-amber-600',
};

const TIER_LABELS: Record<string, string> = {
  none: 'ללא',
  starter: 'סטארטר',
  pro: 'פרו',
  agency: 'אייג\'נסי',
};

const TABS: { id: TabId; label: string; icon: typeof Users }[] = [
  { id: 'overview', label: 'סקירה כללית', icon: Activity },
  { id: 'users', label: 'ניהול משתמשים', icon: Users },
  { id: 'subscriptions', label: 'מנויים והכנסות', icon: CreditCard },
  { id: 'health', label: 'בריאות מערכת', icon: Server },
  { id: 'announcements', label: 'הודעות', icon: Megaphone },
  { id: 'beta', label: 'בטא', icon: Rocket },
];

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function SuperAdmin() {
  const { session } = useAuth();
  const { impersonate, stopImpersonating, isImpersonating, workspaceName: impersonatedName } = useWorkspace();

  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Overview
  const [overview, setOverview] = useState<OverviewData | null>(null);

  // Users
  const [users, setUsers] = useState<UserRow[]>([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [usersPage, setUsersPage] = useState(0);
  const [usersSearch, setUsersSearch] = useState('');
  const [usersPlanFilter, setUsersPlanFilter] = useState('');
  const [usersStatusFilter, setUsersStatusFilter] = useState('');
  const [usersSortBy, setUsersSortBy] = useState('joined');
  const [usersSortDir, setUsersSortDir] = useState<SortDir>('desc');
  const [usersLoading, setUsersLoading] = useState(false);

  // Subscriptions
  const [revenueData, setRevenueData] = useState<RevenueMonth[]>([]);

  // Health
  const [health, setHealth] = useState<HealthData | null>(null);
  const [apiHealth, setApiHealth] = useState<ApiHealthData | null>(null);
  const [apiHealthLoading, setApiHealthLoading] = useState(false);

  // Modals
  const [modal, setModal] = useState<ModalState>({ type: null });
  const [modalInput, setModalInput] = useState<Record<string, string>>({});
  const [modalLoading, setModalLoading] = useState(false);

  // Beta
  const [betaStats, setBetaStats] = useState<{
    total: number; total_waiting: number; total_invited: number;
    total_activated: number; conversion_rate: number;
    signups_by_source: Record<string, number>; top_referrers: Array<{ id: string; name: string; count: number }>;
  } | null>(null);
  const [betaEntries, setBetaEntries] = useState<Array<Record<string, any>>>([]);
  const [betaFeedback, setBetaFeedback] = useState<Array<Record<string, any>>>([]);
  const [npsSummary, setNpsSummary] = useState<{
    nps_score: number; average_score: number; promoters: number;
    passives: number; detractors: number; total_responses: number; response_rate: number;
  } | null>(null);
  const [betaLoading, setBetaLoading] = useState(false);
  const [betaInviteCount, setBetaInviteCount] = useState('5');

  // Broadcast
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [broadcastChannel, setBroadcastChannel] = useState('in_app');
  const [broadcastTier, setBroadcastTier] = useState('');
  const [broadcastResult, setBroadcastResult] = useState<string | null>(null);
  const [broadcastLoading, setBroadcastLoading] = useState(false);

  // ── Initial load ──
  useEffect(() => {
    const init = async () => {
      try {
        const res = await apiFetch('/admin/overview');
        if (res.status === 403) {
          setError('אין הרשאה. גישה למנהלי-על בלבד.');
          return;
        }
        if (!res.ok) throw new Error('Failed');
        setOverview(await res.json());
      } catch {
        setError('שגיאה בטעינת נתונים');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  // ── Users fetch ──
  const fetchUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const params = new URLSearchParams();
      if (usersSearch) params.set('search', usersSearch);
      if (usersPlanFilter) params.set('plan', usersPlanFilter);
      if (usersStatusFilter) params.set('status', usersStatusFilter);
      params.set('limit', '20');
      params.set('offset', String(usersPage * 20));
      const res = await apiFetch(`/admin/users?${params}`);
      if (res.ok) {
        const data = await res.json();
        let rows = data.users || [];
        // Client-side sort
        rows.sort((a: UserRow, b: UserRow) => {
          const av = (a as any)[usersSortBy] ?? '';
          const bv = (b as any)[usersSortBy] ?? '';
          const cmp = av > bv ? 1 : av < bv ? -1 : 0;
          return usersSortDir === 'desc' ? -cmp : cmp;
        });
        setUsers(rows);
        setUsersTotal(data.total || rows.length);
      }
    } catch { /* silent */ }
    setUsersLoading(false);
  }, [usersSearch, usersPlanFilter, usersStatusFilter, usersPage, usersSortBy, usersSortDir]);

  useEffect(() => {
    if (activeTab === 'users' && !error) fetchUsers();
  }, [activeTab, fetchUsers, error]);

  // ── Revenue fetch ──
  useEffect(() => {
    if (activeTab !== 'subscriptions' || error) return;
    (async () => {
      try {
        const res = await apiFetch('/admin/revenue?months=6');
        if (res.ok) {
          const data = await res.json();
          setRevenueData(data.chart_data || []);
        }
      } catch { /* silent */ }
    })();
  }, [activeTab, error]);

  // ── Health fetch ──
  useEffect(() => {
    if (activeTab !== 'health' || error) return;
    (async () => {
      try {
        const res = await apiFetch('/admin/system-health');
        if (res.ok) setHealth(await res.json());
      } catch { /* silent */ }
    })();
  }, [activeTab, error]);

  const fetchApiHealth = useCallback(async () => {
    setApiHealthLoading(true);
    try {
      const res = await apiFetch('/admin/api-health');
      if (res.ok) setApiHealth(await res.json());
    } catch { /* silent */ }
    setApiHealthLoading(false);
  }, []);

  useEffect(() => {
    if (activeTab === 'health' && !apiHealth) fetchApiHealth();
  }, [activeTab, apiHealth, fetchApiHealth]);

  // ── Beta fetch ──
  const fetchBetaData = useCallback(async () => {
    setBetaLoading(true);
    try {
      const [statsRes, entriesRes, feedbackRes, npsRes] = await Promise.all([
        apiFetch('/waitlist/stats'),
        apiFetch('/waitlist/entries?limit=50'),
        apiFetch('/feedback/all?limit=50'),
        apiFetch('/feedback/nps-summary'),
      ]);
      if (statsRes.ok) setBetaStats(await statsRes.json());
      if (entriesRes.ok) { const d = await entriesRes.json(); setBetaEntries(d.entries || []); }
      if (feedbackRes.ok) { const d = await feedbackRes.json(); setBetaFeedback(d.feedback || []); }
      if (npsRes.ok) setNpsSummary(await npsRes.json());
    } catch { /* silent */ }
    setBetaLoading(false);
  }, []);

  useEffect(() => {
    if (activeTab === 'beta' && !betaStats && !error) fetchBetaData();
  }, [activeTab, betaStats, error, fetchBetaData]);

  const handleBetaInvite = async (waitlistId: string) => {
    try {
      const res = await apiFetch(`/waitlist/invite/${waitlistId}`, { method: 'POST' });
      if (res.ok) fetchBetaData();
    } catch { /* silent */ }
  };

  const handleBetaInviteBatch = async () => {
    try {
      const res = await apiFetch('/waitlist/invite-batch', {
        method: 'POST',
        body: JSON.stringify({ count: parseInt(betaInviteCount) || 5 }),
      });
      if (res.ok) fetchBetaData();
    } catch { /* silent */ }
  };

  // ── User sort ──
  const handleUserSort = (col: string) => {
    if (usersSortBy === col) {
      setUsersSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setUsersSortBy(col);
      setUsersSortDir('asc');
    }
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (usersSortBy !== column) return <ArrowUpDown className="w-3 h-3 opacity-40" />;
    return usersSortDir === 'asc'
      ? <ArrowUp className="w-3 h-3 text-indigo-400" />
      : <ArrowDown className="w-3 h-3 text-indigo-400" />;
  };

  // ── Modal Actions ──
  const handleModalConfirm = async () => {
    if (!modal.type || !modal.user) return;
    setModalLoading(true);
    const uid = modal.user.id;

    try {
      let res: Response | null = null;

      switch (modal.type) {
        case 'plan':
          res = await apiFetch(`/admin/users/${uid}/plan`, {
            method: 'PATCH',
            body: JSON.stringify({ tier: modalInput.tier || 'starter' }),
          });
          break;

        case 'discount':
          res = await apiFetch(`/admin/users/${uid}/discount`, {
            method: 'POST',
            body: JSON.stringify({
              discount_percent: parseInt(modalInput.discount || '0'),
              reason: modalInput.reason || '',
            }),
          });
          break;

        case 'extend':
          res = await apiFetch(`/admin/users/${uid}/extend-trial`, {
            method: 'POST',
            body: JSON.stringify({
              extra_days: parseInt(modalInput.days || '14'),
            }),
          });
          break;

        case 'whatsapp':
          res = await apiFetch(`/admin/users/${uid}/whatsapp?message=${encodeURIComponent(modalInput.message || '')}`, {
            method: 'POST',
          });
          break;

        case 'suspend':
          res = await apiFetch(`/admin/users/${uid}/suspend`, { method: 'POST' });
          break;

        case 'delete':
          res = await apiFetch(`/admin/users/${uid}`, { method: 'DELETE' });
          break;
      }

      if (res && res.ok) {
        setModal({ type: null });
        setModalInput({});
        fetchUsers();
      }
    } catch { /* silent */ }
    setModalLoading(false);
  };

  // ── Broadcast ──
  const handleBroadcast = async () => {
    if (!broadcastMsg.trim()) return;
    setBroadcastLoading(true);
    setBroadcastResult(null);
    try {
      const res = await apiFetch('/admin/broadcast', {
        method: 'POST',
        body: JSON.stringify({
          message: broadcastMsg,
          channel: broadcastChannel,
          target_tier: broadcastTier || null,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setBroadcastResult(`נשלח ל-${data.sent} משתמשים (${data.failed} נכשלו)`);
        setBroadcastMsg('');
      } else {
        setBroadcastResult('שגיאה בשליחה');
      }
    } catch {
      setBroadcastResult('שגיאה בשליחה');
    }
    setBroadcastLoading(false);
  };

  // ── Create subscription ──
  const handleCreateSub = async () => {
    setModalLoading(true);
    try {
      const res = await apiFetch('/admin/subscriptions/create', {
        method: 'POST',
        body: JSON.stringify({
          user_id: modalInput.user_id,
          tier: modalInput.tier || 'starter',
          discount_percent: parseInt(modalInput.discount || '0'),
          discount_reason: modalInput.reason || '',
        }),
      });
      if (res.ok) {
        setModal({ type: null });
        setModalInput({});
      }
    } catch { /* silent */ }
    setModalLoading(false);
  };

  // ── Helpers ──
  const formatDate = (d: string | null) => {
    if (!d) return '—';
    const date = new Date(d);
    const now = new Date();
    const diffH = Math.floor((now.getTime() - date.getTime()) / 3600000);
    if (diffH < 1) return 'עכשיו';
    if (diffH < 24) return `לפני ${diffH} שע׳`;
    const diffD = Math.floor(diffH / 24);
    if (diffD < 7) return `לפני ${diffD} ימים`;
    return date.toLocaleDateString('he-IL');
  };

  const formatILS = (n: number) => `${n.toLocaleString()} ₪`;

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  if (loading) return <PageLoader message="טוען לוח בקרה..." />;

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
    <div className="space-y-6" dir="rtl">
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
          <p className="text-gray-400">ניהול פלטפורמה מלא</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 bg-gray-800/50 rounded-xl p-1 overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-indigo-600 text-white shadow-lg'
                : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ═════════════════════════════ OVERVIEW TAB ═════════════════════════════ */}
      {activeTab === 'overview' && overview && (
        <div className="space-y-6">
          {/* Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <StatCard icon={DollarSign} label="MRR" value={formatILS(overview.mrr)} color="from-green-500 to-emerald-600" />
            <StatCard icon={Users} label="משתמשים" value={overview.total_users} color="from-blue-500 to-blue-600" />
            <StatCard icon={CreditCard} label="מנויים פעילים" value={overview.active_subscriptions} color="from-indigo-500 to-indigo-600" />
            <StatCard icon={UserPlus} label="הצטרפו השבוע" value={overview.new_signups_week} color="from-cyan-500 to-cyan-600" />
            <StatCard icon={UserX} label="נטישה (חודש)" value={overview.churn_month} color="from-red-500 to-red-600" />
            <StatCard icon={Activity} label="API (24 שע)" value={overview.api_calls_24h} color="from-cyan-500 to-cyan-600" />
          </div>

          {/* Tier Breakdown + Platform Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="glass-card p-5">
              <p className="text-sm text-gray-400 mb-3 font-medium">חלוקת מנויים</p>
              <div className="flex gap-3 flex-wrap">
                {Object.entries(overview.tier_breakdown || {}).map(([tier, count]) => (
                  <div key={tier} className={`px-4 py-2 rounded-xl text-sm font-medium text-white ${TIER_COLORS[tier] || 'bg-gray-600'}`}>
                    {TIER_LABELS[tier] || tier}: {count}
                  </div>
                ))}
                {overview.active_trials > 0 && (
                  <div className="px-4 py-2 rounded-xl text-sm font-medium text-yellow-300 bg-yellow-500/20 border border-yellow-500/30">
                    ניסיון: {overview.active_trials}
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-3">ARR: {formatILS(overview.arr)}</p>
            </div>

            <div className="glass-card p-5">
              <p className="text-sm text-gray-400 mb-3 font-medium">נתוני פלטפורמה</p>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-2xl font-bold text-white">{overview.total_businesses}</p>
                  <p className="text-xs text-gray-400">עסקים</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{(overview.total_leads || 0).toLocaleString()}</p>
                  <p className="text-xs text-gray-400">לידים</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{(overview.total_competitors || 0).toLocaleString()}</p>
                  <p className="text-xs text-gray-400">מתחרים</p>
                </div>
              </div>
            </div>
          </div>

          {/* API Status Quick View */}
          <div className="glass-card p-5">
            <p className="text-sm text-gray-400 mb-3 font-medium">סטטוס שירותים</p>
            <div className="flex gap-3 flex-wrap">
              {Object.entries(overview.api_status || {}).map(([name, ok]) => (
                <div
                  key={name}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium ${
                    ok ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                  }`}
                >
                  {ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                  {name}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════ USERS TAB ═════════════════════════════ */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          {/* Search & Filters */}
          <div className="glass-card p-4">
            <div className="flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="חיפוש לפי שם או אימייל..."
                  value={usersSearch}
                  onChange={e => { setUsersSearch(e.target.value); setUsersPage(0); }}
                  className="w-full bg-gray-800/50 border border-gray-700 rounded-lg pl-3 pr-10 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <select
                value={usersPlanFilter}
                onChange={e => { setUsersPlanFilter(e.target.value); setUsersPage(0); }}
                className="bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="">כל התוכניות</option>
                <option value="starter">סטארטר</option>
                <option value="pro">פרו</option>
                <option value="agency">אייג'נסי</option>
                <option value="none">ללא מנוי</option>
              </select>

              <select
                value={usersStatusFilter}
                onChange={e => { setUsersStatusFilter(e.target.value); setUsersPage(0); }}
                className="bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="">כל הסטטוסים</option>
                <option value="active">פעיל</option>
                <option value="trial">ניסיון</option>
                <option value="expired">פג תוקף</option>
                <option value="canceled">מבוטל</option>
              </select>

              <button
                onClick={fetchUsers}
                className="p-2 rounded-lg bg-gray-700/50 hover:bg-gray-600/50 text-gray-400 hover:text-white transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${usersLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Users Table */}
          <div className="glass-card overflow-hidden">
            {usersLoading && users.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
              </div>
            ) : users.length === 0 ? (
              <p className="text-center text-gray-500 py-12">לא נמצאו משתמשים</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-700/50 bg-gray-800/30">
                      {[
                        { key: 'name', label: 'שם' },
                        { key: 'email', label: 'אימייל' },
                        { key: 'tier', label: 'תוכנית' },
                        { key: 'status', label: 'סטטוס' },
                        { key: 'mrr', label: 'MRR' },
                        { key: 'joined', label: 'הצטרפות' },
                        { key: 'last_sign_in', label: 'כניסה אחרונה' },
                      ].map(col => (
                        <th
                          key={col.key}
                          className="py-3 px-3 text-right text-xs font-medium text-gray-400 cursor-pointer hover:text-white transition-colors select-none"
                          onClick={() => handleUserSort(col.key)}
                        >
                          <span className="inline-flex items-center gap-1">
                            {col.label}
                            <SortIcon column={col.key} />
                          </span>
                        </th>
                      ))}
                      <th className="py-3 px-3 text-right text-xs font-medium text-gray-400">פעולות</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(user => (
                      <tr key={user.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                        <td className="py-3 px-3 text-white font-medium">{user.name}</td>
                        <td className="py-3 px-3 text-gray-300 text-xs">{user.email}</td>
                        <td className="py-3 px-3">
                          <span className={`px-2.5 py-0.5 rounded-lg text-xs font-medium text-white ${TIER_COLORS[user.tier] || 'bg-gray-600'}`}>
                            {TIER_LABELS[user.tier] || user.tier}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            user.status === 'active' ? 'text-green-400 bg-green-500/10' :
                            user.status === 'trial' ? 'text-yellow-400 bg-yellow-500/10' :
                            user.status === 'expired' ? 'text-red-400 bg-red-500/10' :
                            user.status === 'canceled' ? 'text-gray-400 bg-gray-500/10' :
                            'text-gray-500 bg-gray-500/10'
                          }`}>
                            {user.status === 'active' ? 'פעיל' :
                             user.status === 'trial' ? 'ניסיון' :
                             user.status === 'expired' ? 'פג תוקף' :
                             user.status === 'canceled' ? 'מבוטל' :
                             user.status}
                          </span>
                          {user.is_trial && user.trial_ends_at && (
                            <span className="block text-[10px] text-gray-500 mt-0.5">
                              עד {new Date(user.trial_ends_at).toLocaleDateString('he-IL')}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-gray-300 text-xs">{user.mrr > 0 ? formatILS(user.mrr) : '—'}</td>
                        <td className="py-3 px-3 text-gray-400 text-xs">{formatDate(user.joined)}</td>
                        <td className="py-3 px-3 text-gray-400 text-xs">{formatDate(user.last_sign_in)}</td>
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-1 flex-wrap">
                            <ActionBtn
                              icon={Crown}
                              tip="שנה תוכנית"
                              color="text-indigo-400"
                              onClick={() => { setModal({ type: 'plan', user }); setModalInput({ tier: user.tier }); }}
                            />
                            <ActionBtn
                              icon={Percent}
                              tip="הנחה"
                              color="text-green-400"
                              onClick={() => { setModal({ type: 'discount', user }); setModalInput({ discount: String(user.discount_percent) }); }}
                            />
                            {user.is_trial && (
                              <ActionBtn
                                icon={Clock}
                                tip="הארך ניסיון"
                                color="text-yellow-400"
                                onClick={() => { setModal({ type: 'extend', user }); setModalInput({ days: '14' }); }}
                              />
                            )}
                            <ActionBtn
                              icon={MessageCircle}
                              tip="WhatsApp"
                              color="text-emerald-400"
                              onClick={() => { setModal({ type: 'whatsapp', user }); setModalInput({}); }}
                            />
                            {user.workspace_id && (
                              <ActionBtn
                                icon={Eye}
                                tip="התחזה"
                                color="text-amber-400"
                                onClick={() => {
                                  impersonate({
                                    workspace_id: user.workspace_id!,
                                    workspace_name: user.name,
                                    role: 'owner',
                                  });
                                }}
                              />
                            )}
                            <ActionBtn
                              icon={Ban}
                              tip="השעה"
                              color="text-orange-400"
                              onClick={() => setModal({ type: 'suspend', user })}
                            />
                            <ActionBtn
                              icon={Trash2}
                              tip="מחק"
                              color="text-red-400"
                              onClick={() => setModal({ type: 'delete', user })}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {usersTotal > 20 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-700/50">
                <span className="text-xs text-gray-400">
                  {usersPage * 20 + 1}-{Math.min((usersPage + 1) * 20, usersTotal)} מתוך {usersTotal}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setUsersPage(p => Math.max(0, p - 1))}
                    disabled={usersPage === 0}
                    className="p-1.5 rounded-lg bg-gray-700/50 hover:bg-gray-600/50 text-gray-400 disabled:opacity-30 transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setUsersPage(p => p + 1)}
                    disabled={(usersPage + 1) * 20 >= usersTotal}
                    className="p-1.5 rounded-lg bg-gray-700/50 hover:bg-gray-600/50 text-gray-400 disabled:opacity-30 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════ SUBSCRIPTIONS TAB ═══════════════════════════ */}
      {activeTab === 'subscriptions' && (
        <div className="space-y-6">
          {/* Revenue Chart */}
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-400" />
                הכנסות חודשיות (MRR)
              </h2>
            </div>
            {revenueData.length > 0 ? (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="label" tick={{ fill: '#9CA3AF', fontSize: 12 }} />
                    <YAxis tick={{ fill: '#9CA3AF', fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }}
                      labelStyle={{ color: '#fff' }}
                      formatter={(value: number | undefined, name: string | undefined) => {
                        if (value === undefined || value === null) return ['', ''];
                        const n = name ?? '';
                        return [
                          n === 'mrr' ? `${value.toLocaleString()} ₪` : value,
                          n === 'mrr' ? 'MRR' : n === 'new_subscriptions' ? 'חדשים' : 'נטישה',
                        ];
                      }}
                    />
                    <Bar dataKey="mrr" fill="#6366f1" radius={[4, 4, 0, 0]} name="mrr" />
                    <Bar dataKey="new_subscriptions" fill="#22c55e" radius={[4, 4, 0, 0]} name="new_subscriptions" />
                    <Bar dataKey="churned" fill="#ef4444" radius={[4, 4, 0, 0]} name="churned" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-center text-gray-500 py-12">אין נתוני הכנסות</p>
            )}
          </div>

          {/* Manual Subscription Creation */}
          <div className="glass-card p-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5 text-indigo-400" />
              צור מנוי ידני
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <input
                type="text"
                placeholder="User ID"
                value={modalInput.sub_user_id || ''}
                onChange={e => setModalInput(p => ({ ...p, sub_user_id: e.target.value }))}
                className="bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
              />
              <select
                value={modalInput.sub_tier || 'starter'}
                onChange={e => setModalInput(p => ({ ...p, sub_tier: e.target.value }))}
                className="bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="starter">סטארטר (149 ₪)</option>
                <option value="pro">פרו (399 ₪)</option>
                <option value="agency">אייג'נסי (899 ₪)</option>
              </select>
              <input
                type="number"
                placeholder="הנחה %"
                value={modalInput.sub_discount || ''}
                onChange={e => setModalInput(p => ({ ...p, sub_discount: e.target.value }))}
                className="bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
              />
              <button
                onClick={async () => {
                  if (!modalInput.sub_user_id) return;
                  const res = await apiFetch('/admin/subscriptions/create', {
                    method: 'POST',
                    body: JSON.stringify({
                      user_id: modalInput.sub_user_id,
                      tier: modalInput.sub_tier || 'starter',
                      discount_percent: parseInt(modalInput.sub_discount || '0'),
                    }),
                  });
                  if (res.ok) {
                    setModalInput(p => ({ ...p, sub_user_id: '', sub_discount: '' }));
                  }
                }}
                className="btn-primary flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                צור מנוי
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════ HEALTH TAB ═════════════════════════════ */}
      {activeTab === 'health' && (
        <div className="space-y-6">
          {/* API Health Dashboard */}
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Server className="w-5 h-5 text-blue-400" />
                בדיקת API חיצוניים
              </h2>
              <div className="flex items-center gap-3">
                {apiHealth && (
                  <span className="text-xs text-gray-500">
                    נבדק: {new Date(apiHealth.checked_at).toLocaleString('he-IL')}
                  </span>
                )}
                <button
                  onClick={fetchApiHealth}
                  disabled={apiHealthLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600/20 text-blue-400 text-sm hover:bg-blue-600/30 border border-blue-500/30 disabled:opacity-50 transition-all"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${apiHealthLoading ? 'animate-spin' : ''}`} />
                  בדוק שוב
                </button>
              </div>
            </div>

            {apiHealth && apiHealth.summary && (() => {
              const optionalCount = apiHealth.apis.filter(a => a.optional && a.status !== 'ok').length;
              const realErrors = apiHealth.summary.error - apiHealth.apis.filter(a => a.optional && a.status === 'error').length;
              return (
                <div className="flex gap-4 mb-4 text-sm">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
                    <span className="text-gray-300">{apiHealth.summary.ok} תקין</span>
                  </span>
                  {realErrors > 0 && (
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
                      <span className="text-gray-300">{realErrors} שגיאה</span>
                    </span>
                  )}
                  {apiHealth.summary.not_configured > 0 && (
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-gray-500" />
                      <span className="text-gray-300">{apiHealth.summary.not_configured - optionalCount} לא מוגדר</span>
                    </span>
                  )}
                  {optionalCount > 0 && (
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-gray-400/50" />
                      <span className="text-gray-400">{optionalCount} אופציונלי</span>
                    </span>
                  )}
                </div>
              );
            })()}

            {apiHealthLoading && !apiHealth ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
                <span className="text-gray-400 mr-3">בודק שירותים...</span>
              </div>
            ) : apiHealth ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {apiHealth.apis.map((api) => (
                  <div
                    key={api.name}
                    className={`p-4 rounded-xl border transition-all ${
                      api.status === 'ok'
                        ? 'bg-green-500/5 border-green-500/20'
                        : api.status === 'error' && !api.optional
                        ? 'bg-red-500/5 border-red-500/20'
                        : 'bg-gray-500/5 border-gray-600/20'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${
                          api.status === 'ok' ? 'bg-green-400' :
                          api.status === 'error' && !api.optional ? 'bg-red-400' :
                          api.optional ? 'bg-gray-400/50' :
                          'bg-gray-500'
                        }`} />
                        <span className="text-sm font-medium text-white">{api.name}</span>
                        {api.optional && (
                          <span className="text-[10px] text-gray-500 bg-gray-700/50 px-1.5 py-0.5 rounded">אופציונלי</span>
                        )}
                      </div>
                      {api.status === 'ok' && (
                        <span className="text-xs text-gray-500">{api.response_time_ms}ms</span>
                      )}
                    </div>
                    <p className={`text-xs ${
                      api.status === 'ok' ? 'text-green-400' :
                      api.status === 'error' && !api.optional ? 'text-red-400' :
                      'text-gray-500'
                    }`}>
                      {api.status === 'ok' ? (api.details || 'תקין') :
                       api.status === 'error' && !api.optional ? (api.error || 'שגיאה') :
                       api.optional ? (api.details || 'לא מוגדר — אופציונלי') :
                       'לא מוגדר'}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {/* Existing API Status from system-health */}
          {health && (
            <>
              <div className="glass-card p-6">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-cyan-400" />
                  תזמון משימות (GlobalRadar: {health.scheduler.radar_running ? (
                    <span className="text-green-400 text-sm">פעיל</span>
                  ) : (
                    <span className="text-red-400 text-sm">כבוי</span>
                  )})
                </h2>
                {(health.scheduler?.jobs || []).length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-700/50">
                          <th className="py-2 px-3 text-right text-xs text-gray-400">סוג משימה</th>
                          <th className="py-2 px-3 text-right text-xs text-gray-400">פעילות</th>
                          <th className="py-2 px-3 text-right text-xs text-gray-400">מושהות</th>
                          <th className="py-2 px-3 text-right text-xs text-gray-400">ריצה אחרונה</th>
                          <th className="py-2 px-3 text-right text-xs text-gray-400">ריצה הבאה</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(health.scheduler?.jobs || []).map(job => (
                          <tr key={job.job_type} className="border-b border-gray-800/50">
                            <td className="py-2 px-3 text-white font-medium">{job.job_type}</td>
                            <td className="py-2 px-3 text-green-400">{job.active_count}</td>
                            <td className="py-2 px-3 text-gray-400">{job.paused_count}</td>
                            <td className="py-2 px-3 text-gray-400 text-xs">{formatDate(job.last_run_at)}</td>
                            <td className="py-2 px-3 text-gray-400 text-xs">{formatDate(job.next_run_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-center text-gray-500 py-6">אין משימות מתוזמנות</p>
                )}
              </div>

              <div className="glass-card p-6">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                  שגיאות אחרונות ({(health.error_logs || []).length})
                </h2>
                {(health.error_logs || []).length > 0 ? (
                  <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-gray-900">
                        <tr className="border-b border-gray-700/50">
                          <th className="py-2 px-3 text-right text-xs text-gray-400">זמן</th>
                          <th className="py-2 px-3 text-right text-xs text-gray-400">Method</th>
                          <th className="py-2 px-3 text-right text-xs text-gray-400">Path</th>
                          <th className="py-2 px-3 text-right text-xs text-gray-400">Status</th>
                          <th className="py-2 px-3 text-right text-xs text-gray-400">Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(health.error_logs || []).map((log, i) => (
                          <tr key={i} className="border-b border-gray-800/50">
                            <td className="py-2 px-3 text-gray-400 text-xs">{formatDate(log.created_at)}</td>
                            <td className="py-2 px-3 text-white">{log.method}</td>
                            <td className="py-2 px-3 text-gray-300 text-xs font-mono max-w-[200px] truncate">{log.path}</td>
                            <td className="py-2 px-3">
                              <span className={`px-1.5 py-0.5 rounded text-xs ${
                                log.status_code >= 500 ? 'bg-red-500/20 text-red-400' :
                                log.status_code >= 400 ? 'bg-amber-500/20 text-amber-400' :
                                'bg-gray-500/20 text-gray-400'
                              }`}>
                                {log.status_code}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-gray-500 text-xs">{log.response_time_ms}ms</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-center text-gray-500 py-6">אין שגיאות אחרונות</p>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══════════════════════════ ANNOUNCEMENTS TAB ═══════════════════════════ */}
      {activeTab === 'announcements' && (
        <div className="glass-card p-6 max-w-2xl">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-amber-400" />
            שליחת הודעה לכל המשתמשים
          </h2>

          <div className="space-y-4">
            <textarea
              value={broadcastMsg}
              onChange={e => setBroadcastMsg(e.target.value)}
              placeholder="כתוב את ההודעה כאן..."
              rows={4}
              className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 resize-none"
            />

            <div className="flex gap-3 flex-wrap">
              <div>
                <label className="text-xs text-gray-400 block mb-1">ערוץ</label>
                <select
                  value={broadcastChannel}
                  onChange={e => setBroadcastChannel(e.target.value)}
                  className="bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="in_app">הודעה במערכת</option>
                  <option value="whatsapp">WhatsApp</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1">יעד</label>
                <select
                  value={broadcastTier}
                  onChange={e => setBroadcastTier(e.target.value)}
                  className="bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="">כל המשתמשים</option>
                  <option value="starter">סטארטר בלבד</option>
                  <option value="pro">פרו בלבד</option>
                  <option value="agency">אייג'נסי בלבד</option>
                </select>
              </div>
            </div>

            <button
              onClick={handleBroadcast}
              disabled={broadcastLoading || !broadcastMsg.trim()}
              className="btn-primary flex items-center gap-2 disabled:opacity-50"
            >
              {broadcastLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              שלח הודעה
            </button>

            {broadcastResult && (
              <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-lg px-4 py-2 text-sm text-indigo-300">
                {broadcastResult}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════ BETA TAB ═══════════════════════════ */}
      {activeTab === 'beta' && (
        <div className="space-y-6">
          {betaLoading && !betaStats ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
            </div>
          ) : betaStats && (
            <>
              {/* Stats Cards */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <StatCard icon={Users} label="ברשימת המתנה" value={betaStats.total_waiting} color="from-blue-500 to-blue-600" />
                <StatCard icon={Send} label="הוזמנו" value={betaStats.total_invited} color="from-indigo-500 to-indigo-600" />
                <StatCard icon={CheckCircle2} label="הופעלו" value={betaStats.total_activated} color="from-emerald-500 to-emerald-600" />
                <StatCard icon={Activity} label="המרה %" value={`${betaStats.conversion_rate}%`} color="from-cyan-500 to-cyan-600" />
                <StatCard icon={StarIcon} label="NPS" value={npsSummary?.nps_score ?? '—'} color="from-amber-500 to-amber-600" />
                <StatCard icon={Hash} label="סה״כ" value={betaStats.total} color="from-gray-500 to-gray-600" />
              </div>

              {/* Invite Batch */}
              <div className="glass-card p-5 flex items-center gap-4 flex-wrap">
                <span className="text-sm text-gray-300 font-medium">הזמנה מהירה:</span>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={betaInviteCount}
                  onChange={e => setBetaInviteCount(e.target.value)}
                  className="w-20 bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
                <button
                  onClick={handleBetaInviteBatch}
                  className="btn-primary flex items-center gap-2 text-sm"
                >
                  <Send className="w-4 h-4" />
                  הזמן את {betaInviteCount} הבאים ברשימה
                </button>
                <button
                  onClick={fetchBetaData}
                  className="p-2 rounded-lg bg-gray-700/50 hover:bg-gray-600/50 text-gray-400 hover:text-white transition-colors"
                >
                  <RefreshCw className={`w-4 h-4 ${betaLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {/* Source Breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="glass-card p-5">
                  <p className="text-sm text-gray-400 mb-3 font-medium">מקורות הרשמה</p>
                  <div className="space-y-2">
                    {Object.entries(betaStats.signups_by_source || {}).map(([source, count]) => (
                      <div key={source} className="flex items-center justify-between">
                        <span className="text-sm text-gray-300 capitalize">{source}</span>
                        <div className="flex items-center gap-2">
                          <div className="h-2 bg-indigo-500/30 rounded-full overflow-hidden w-24">
                            <div
                              className="h-full bg-indigo-500 rounded-full"
                              style={{ width: `${Math.min(100, (count / betaStats.total) * 100)}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500 w-8 text-left">{count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* NPS Summary */}
                {npsSummary && npsSummary.total_responses > 0 && (
                  <div className="glass-card p-5">
                    <p className="text-sm text-gray-400 mb-3 font-medium">NPS סיכום</p>
                    <div className="grid grid-cols-3 gap-3 mb-3">
                      <div className="text-center p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                        <Smile className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
                        <p className="text-lg font-bold text-emerald-400">{npsSummary.promoters}</p>
                        <p className="text-[10px] text-gray-500">מקדמים (9-10)</p>
                      </div>
                      <div className="text-center p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                        <Meh className="w-5 h-5 text-amber-400 mx-auto mb-1" />
                        <p className="text-lg font-bold text-amber-400">{npsSummary.passives}</p>
                        <p className="text-[10px] text-gray-500">פסיביים (7-8)</p>
                      </div>
                      <div className="text-center p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                        <Frown className="w-5 h-5 text-red-400 mx-auto mb-1" />
                        <p className="text-lg font-bold text-red-400">{npsSummary.detractors}</p>
                        <p className="text-[10px] text-gray-500">מבקרים (0-6)</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>ממוצע: {npsSummary.average_score}</span>
                      <span>שיעור תגובה: {npsSummary.response_rate}%</span>
                    </div>
                  </div>
                )}

                {/* Top Referrers */}
                {betaStats.top_referrers.length > 0 && (
                  <div className="glass-card p-5">
                    <p className="text-sm text-gray-400 mb-3 font-medium">מפנים מובילים</p>
                    <div className="space-y-2">
                      {betaStats.top_referrers.slice(0, 5).map((ref, i) => (
                        <div key={ref.id} className="flex items-center justify-between">
                          <span className="text-sm text-gray-300">
                            <span className="text-gray-500 ml-2">#{i + 1}</span>
                            {ref.name}
                          </span>
                          <span className="text-xs text-indigo-400 font-bold">{ref.count} הפניות</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Waitlist Table */}
              <div className="glass-card overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-700/50 flex items-center justify-between">
                  <h3 className="text-sm font-medium text-white">רשימת המתנה</h3>
                </div>
                {betaEntries.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-700/50 bg-gray-800/30">
                          <th className="py-2 px-3 text-right text-xs text-gray-400">#</th>
                          <th className="py-2 px-3 text-right text-xs text-gray-400">שם</th>
                          <th className="py-2 px-3 text-right text-xs text-gray-400">אימייל</th>
                          <th className="py-2 px-3 text-right text-xs text-gray-400">טלפון</th>
                          <th className="py-2 px-3 text-right text-xs text-gray-400">סוג עסק</th>
                          <th className="py-2 px-3 text-right text-xs text-gray-400">סטטוס</th>
                          <th className="py-2 px-3 text-right text-xs text-gray-400">הפניות</th>
                          <th className="py-2 px-3 text-right text-xs text-gray-400">פעולות</th>
                        </tr>
                      </thead>
                      <tbody>
                        {betaEntries.map(entry => (
                          <tr key={entry.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                            <td className="py-2 px-3 text-gray-500 text-xs">{entry.position}</td>
                            <td className="py-2 px-3 text-white font-medium">{entry.name}</td>
                            <td className="py-2 px-3 text-gray-300 text-xs">{entry.email}</td>
                            <td className="py-2 px-3 text-gray-400 text-xs" dir="ltr">{entry.phone || '—'}</td>
                            <td className="py-2 px-3 text-gray-400 text-xs">{entry.business_type || '—'}</td>
                            <td className="py-2 px-3">
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                entry.status === 'activated' ? 'text-emerald-400 bg-emerald-500/10' :
                                entry.status === 'invited' ? 'text-blue-400 bg-blue-500/10' :
                                entry.status === 'waiting' ? 'text-amber-400 bg-amber-500/10' :
                                'text-gray-400 bg-gray-500/10'
                              }`}>
                                {entry.status === 'activated' ? 'פעיל' :
                                 entry.status === 'invited' ? 'הוזמן' :
                                 entry.status === 'waiting' ? 'ממתין' :
                                 entry.status}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-gray-400 text-xs">{entry.referral_count || 0}</td>
                            <td className="py-2 px-3">
                              {entry.status === 'waiting' && (
                                <button
                                  onClick={() => handleBetaInvite(entry.id)}
                                  className="px-2.5 py-1 rounded-lg bg-indigo-600/20 text-indigo-400 text-xs hover:bg-indigo-600/30 transition-colors"
                                >
                                  הזמן
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-center text-gray-500 py-8">אין רשומות ברשימת ההמתנה</p>
                )}
              </div>

              {/* Feedback List */}
              {betaFeedback.length > 0 && (
                <div className="glass-card overflow-hidden">
                  <div className="px-5 py-3 border-b border-gray-700/50">
                    <h3 className="text-sm font-medium text-white">פידבקים אחרונים</h3>
                  </div>
                  <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-gray-900">
                        <tr className="border-b border-gray-700/50">
                          <th className="py-2 px-3 text-right text-xs text-gray-400">סוג</th>
                          <th className="py-2 px-3 text-right text-xs text-gray-400">ציון</th>
                          <th className="py-2 px-3 text-right text-xs text-gray-400">הודעה</th>
                          <th className="py-2 px-3 text-right text-xs text-gray-400">טריגר</th>
                          <th className="py-2 px-3 text-right text-xs text-gray-400">תאריך</th>
                        </tr>
                      </thead>
                      <tbody>
                        {betaFeedback.map(fb => (
                          <tr key={fb.id} className="border-b border-gray-800/50">
                            <td className="py-2 px-3">
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                fb.type === 'nps' ? 'text-amber-400 bg-amber-500/10' :
                                fb.type === 'bug' ? 'text-red-400 bg-red-500/10' :
                                fb.type === 'feature_request' ? 'text-blue-400 bg-blue-500/10' :
                                'text-gray-400 bg-gray-500/10'
                              }`}>
                                {fb.type}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-gray-300">{fb.score ?? '—'}</td>
                            <td className="py-2 px-3 text-gray-400 text-xs max-w-[300px] truncate">{fb.message || '—'}</td>
                            <td className="py-2 px-3 text-gray-500 text-xs">{fb.trigger}</td>
                            <td className="py-2 px-3 text-gray-500 text-xs">{formatDate(fb.created_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ═══════════════════════════════ MODALS ═══════════════════════════════ */}

      {/* Change Plan Modal */}
      {modal.type === 'plan' && modal.user && (
        <Modal
          title={`שנה תוכנית: ${modal.user.name}`}
          onClose={() => setModal({ type: null })}
          onConfirm={handleModalConfirm}
          loading={modalLoading}
        >
          <select
            value={modalInput.tier || 'starter'}
            onChange={e => setModalInput(p => ({ ...p, tier: e.target.value }))}
            className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
          >
            <option value="starter">סטארטר (149 ₪/חודש)</option>
            <option value="pro">פרו (399 ₪/חודש)</option>
            <option value="agency">אייג'נסי (899 ₪/חודש)</option>
          </select>
        </Modal>
      )}

      {/* Discount Modal */}
      {modal.type === 'discount' && modal.user && (
        <Modal
          title={`הנחה: ${modal.user.name}`}
          onClose={() => setModal({ type: null })}
          onConfirm={handleModalConfirm}
          loading={modalLoading}
        >
          <div className="space-y-3">
            <input
              type="number"
              min="0"
              max="100"
              placeholder="אחוז הנחה"
              value={modalInput.discount || ''}
              onChange={e => setModalInput(p => ({ ...p, discount: e.target.value }))}
              className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
            />
            <input
              type="text"
              placeholder="סיבה (אופציונלי)"
              value={modalInput.reason || ''}
              onChange={e => setModalInput(p => ({ ...p, reason: e.target.value }))}
              className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </Modal>
      )}

      {/* Extend Trial Modal */}
      {modal.type === 'extend' && modal.user && (
        <Modal
          title={`הארך ניסיון: ${modal.user.name}`}
          onClose={() => setModal({ type: null })}
          onConfirm={handleModalConfirm}
          loading={modalLoading}
        >
          <input
            type="number"
            min="1"
            max="90"
            placeholder="מספר ימים"
            value={modalInput.days || '14'}
            onChange={e => setModalInput(p => ({ ...p, days: e.target.value }))}
            className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
          />
        </Modal>
      )}

      {/* WhatsApp Modal */}
      {modal.type === 'whatsapp' && modal.user && (
        <Modal
          title={`WhatsApp: ${modal.user.name}`}
          onClose={() => setModal({ type: null })}
          onConfirm={handleModalConfirm}
          loading={modalLoading}
          confirmText="שלח"
        >
          <textarea
            placeholder="הקלד הודעה..."
            value={modalInput.message || ''}
            onChange={e => setModalInput(p => ({ ...p, message: e.target.value }))}
            rows={3}
            className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 resize-none"
          />
        </Modal>
      )}

      {/* Suspend Modal */}
      {modal.type === 'suspend' && modal.user && (
        <Modal
          title="השעיית משתמש"
          onClose={() => setModal({ type: null })}
          onConfirm={handleModalConfirm}
          loading={modalLoading}
          confirmText="השעה"
          danger
        >
          <p className="text-gray-300 text-sm">
            האם להשעות את <span className="text-white font-bold">{modal.user.email}</span>?
            <br />
            <span className="text-red-400 text-xs">פעולה זו תבטל את המנוי ותחסום את הגישה.</span>
          </p>
        </Modal>
      )}

      {/* Delete Modal */}
      {modal.type === 'delete' && modal.user && (
        <Modal
          title="מחיקת משתמש"
          onClose={() => setModal({ type: null })}
          onConfirm={handleModalConfirm}
          loading={modalLoading}
          confirmText="מחק לצמיתות"
          danger
        >
          <p className="text-gray-300 text-sm">
            האם למחוק לצמיתות את <span className="text-white font-bold">{modal.user.email}</span>?
            <br />
            <span className="text-red-400 text-xs">פעולה זו בלתי הפיכה!</span>
          </p>
        </Modal>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function StatCard({ icon: Icon, label, value, color }: {
  icon: typeof Users;
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center shrink-0`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-xl font-bold text-white truncate">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
          <p className="text-xs text-gray-400">{label}</p>
        </div>
      </div>
    </div>
  );
}

function ActionBtn({ icon: Icon, tip, color, onClick }: {
  icon: typeof Users;
  tip: string;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={tip}
      className={`p-1.5 rounded-lg hover:bg-gray-700/50 ${color} transition-colors`}
    >
      <Icon className="w-3.5 h-3.5" />
    </button>
  );
}

function Modal({ title, children, onClose, onConfirm, loading, confirmText = 'אישור', danger = false }: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
  confirmText?: string;
  danger?: boolean;
}) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEsc);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = 'unset';
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative glass-card max-w-md w-full mx-4 p-6 fade-in" dir="rtl">
        <h2 className="text-lg font-bold text-white mb-4">{title}</h2>
        <div className="mb-6">{children}</div>
        <div className="flex gap-3">
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium text-white transition-colors flex items-center justify-center gap-2 ${
              danger
                ? 'bg-red-600 hover:bg-red-700 disabled:bg-red-800'
                : 'bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-800'
            }`}
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {confirmText}
          </button>
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-300 bg-gray-700/50 hover:bg-gray-600/50 transition-colors">
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}
