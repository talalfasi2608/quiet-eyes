import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useSimulation } from '../../context/SimulationContext';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../services/api';
import AnimatedGauge from '../../components/AnimatedGauge';
import {
  Radar, Target, RefreshCw, Loader2, Star, Bell, BellDot,
  ChevronRight, Flame, Sparkles, CheckCircle2,
  Clock,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

interface IntelEvent {
  id: number;
  business_id: string;
  event_type: string;
  title: string;
  description: string | null;
  severity: string;
  source: string | null;
  is_read: boolean;
  created_at: string;
}

interface Weakness {
  issue: string;
  severity: 'high' | 'medium' | 'low';
  fix: string;
}

interface BusinessInfo {
  id: string;
  name: string;
  name_hebrew: string;
  address: string;
  industry: string;
  business_type?: string;
  city?: string;
  website: string | null;
  latitude: number | null;
  longitude: number | null;
  logo_url?: string | null;
  market_health_score: number;
  summary: string;
  weaknesses: Weakness[];
}

interface Competitor {
  id: string;
  name: string;
  google_rating: number;
  google_reviews_count: number;
  is_top: boolean;
  threat_level: 'high' | 'medium' | 'low';
}

interface StrategyFeedItem {
  id: string;
  type: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  action_label: string;
  timestamp: string;
}

interface MarketStats {
  total_competitors: number;
  high_threat_competitors: number;
  avg_market_rating: number;
  your_rating: number;
}

interface DashboardData {
  business_info: BusinessInfo;
  competitors: Competitor[];
  strategy_feed: StrategyFeedItem[];
  market_stats: MarketStats;
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

const EVENT_COLORS: Record<string, string> = {
  lead_found: 'bg-emerald-500',
  competitor_change: 'bg-amber-500',
  price_alert: 'bg-red-500',
  scan_completed: 'bg-blue-500',
  blueprint_matched: 'bg-cyan-500',
  radar_alert: 'bg-orange-500',
};

function formatTimeAgo(dateStr: string | null): string {
  if (!dateStr) return 'לא ידוע';
  const now = new Date();
  const then = new Date(dateStr);
  const mins = Math.floor((now.getTime() - then.getTime()) / 60000);
  if (mins < 1) return 'עכשיו';
  if (mins < 60) return `${mins} דק׳`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} שע׳`;
  return `${Math.floor(hours / 24)} ימים`;
}

// ═══════════════════════════════════════════════════════════════
// MAIN DASHBOARD
// ═══════════════════════════════════════════════════════════════

export default function Dashboard() {
  const { user } = useAuth();
  const { currentProfile } = useSimulation();
  const navigate = useNavigate();

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [events, setEvents] = useState<IntelEvent[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [leadsCount, setLeadsCount] = useState(0);
  const [eventsCount, setEventsCount] = useState(0);
  const [lastScan, setLastScan] = useState<string | null>(null);

  // Fetch dashboard
  const fetchDashboard = useCallback(async (showRefresh = false) => {
    if (!currentProfile?.id) return;
    try {
      if (showRefresh) setRefreshing(true);
      else setLoading(true);

      const res = await apiFetch(`/dashboard/summary/${currentProfile.id}`);
      if (res.ok) {
        const result = await res.json();
        setData(result);
        setLastScan(new Date().toISOString());
      }
    } catch {
      toast.error('שגיאה בטעינת דשבורד');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentProfile?.id]);

  // Fetch intel events
  const fetchEvents = useCallback(async () => {
    if (!currentProfile?.id) return;
    try {
      const [evRes, countRes] = await Promise.all([
        apiFetch(`/intelligence/${currentProfile.id}/events?limit=4`).then(r => r.json()),
        apiFetch(`/intelligence/${currentProfile.id}/events/unread-count`).then(r => r.json()),
      ]);
      setEvents(evRes.events || []);
      setUnreadCount(countRes.unread_count || 0);
      setEventsCount(evRes.total ?? evRes.events?.length ?? 0);
    } catch {
      toast.error('שגיאה בטעינת אירועים');
    }
  }, [currentProfile?.id]);

  // Fetch leads count
  const fetchLeadsCount = useCallback(async () => {
    if (!currentProfile?.id) return;
    try {
      const res = await apiFetch(`/leads/${currentProfile.id}?limit=1`);
      if (res.ok) {
        const d = await res.json();
        setLeadsCount(d.total || 0);
      }
    } catch {
      toast.error('שגיאה בטעינת לידים');
    }
  }, [currentProfile?.id]);

  useEffect(() => {
    fetchDashboard();
    fetchEvents();
    fetchLeadsCount();
  }, [fetchDashboard, fetchEvents, fetchLeadsCount]);

  // Trigger market scan
  const triggerScan = async () => {
    if (!currentProfile?.id || scanning) return;
    setScanning(true);
    try {
      const res = await apiFetch(`/radar/sync/${currentProfile.id}`, { method: 'POST' });
      if (res.ok) {
        toast.success('סריקה הושלמה!');
        await fetchDashboard(true);
        await fetchEvents();
      }
    } catch {
      toast.error('שגיאה בסריקה');
    } finally {
      setScanning(false);
    }
  };

  // Loading
  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-60px)] md:h-[calc(100vh-60px)]">
        <Loader2 className="w-12 h-12 text-cyan-500 animate-spin" />
      </div>
    );
  }

  if (!data?.business_info) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-60px)]" dir="rtl">
        <div className="text-center space-y-4">
          <Sparkles className="w-16 h-16 text-cyan-500 mx-auto" />
          <h2 className="text-2xl font-bold text-white">המערכת אוספת מודיעין...</h2>
          <p className="text-gray-400">חזור בקרוב</p>
        </div>
      </div>
    );
  }

  const { business_info: biz, competitors, strategy_feed, market_stats } = data;
  const healthScore = biz.market_health_score || 0;
  const topOpportunity = strategy_feed.find(s => s.priority === 'high') || strategy_feed[0];
  const todayTasks = strategy_feed.slice(0, 3);

  return (
    <>
      {/* ═══════════════════════════════════════════════════════════
          DESKTOP LAYOUT — 3-column grid (hidden on mobile)
         ═══════════════════════════════════════════════════════════ */}
      <div dir="rtl" className="cockpit-grid fade-in hidden md:grid" style={{
        height: 'calc(100vh - 60px)',
        gridTemplateAreas: `
          "header header header"
          "health mission intel"
          "health opportunity intel"
          "kpi kpi kpi"
        `,
        gridTemplateRows: '56px 1fr 1fr 80px',
        gridTemplateColumns: '220px 1fr 260px',
        gap: '12px',
        padding: '16px',
        overflow: 'hidden',
      }}>
        {/* HEADER */}
        <div style={{ gridArea: 'header' }} className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {biz.logo_url ? (
              <img src={biz.logo_url} alt="" className="w-10 h-10 rounded-xl object-cover border border-gray-700" />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                <span className="text-lg">👁️</span>
              </div>
            )}
            <div>
              <h1 className="text-lg font-bold text-white leading-tight">{biz.name_hebrew || biz.name}</h1>
              <span className="text-xs text-gray-500">
                {biz.industry || biz.business_type}{biz.city ? ` · ${biz.city}` : biz.address ? ` · ${biz.address}` : ''}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              עודכן {formatTimeAgo(lastScan)}
            </span>
            <button
              onClick={() => fetchDashboard(true)}
              disabled={refreshing}
              className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800/50 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={triggerScan}
              disabled={scanning}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/25 hover:bg-cyan-500/20 text-xs transition-colors"
            >
              {scanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Radar className="w-3.5 h-3.5" />}
              {scanning ? 'סורק...' : 'סריקה'}
            </button>
          </div>
        </div>

        {/* HEALTH GAUGE */}
        <div style={{ gridArea: 'health' }} className="glass-card flex flex-col items-center justify-center p-4">
          <AnimatedGauge value={healthScore} size={180} label="ציון בריאות השוק" />
          <div className="mt-3 text-center">
            <div className="flex items-center justify-center gap-1 text-sm">
              <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
              <span className="text-white font-bold">{market_stats.your_rating > 0 ? market_stats.your_rating.toFixed(1) : '—'}</span>
              <span className="text-gray-500 text-xs">מול {market_stats.avg_market_rating > 0 ? market_stats.avg_market_rating.toFixed(1) : '—'} שוק</span>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              #{market_stats.high_threat_competitors || 0} איומים מתוך {market_stats.total_competitors || 0}
            </div>
          </div>
        </div>

        {/* TODAY'S MISSION */}
        <div style={{ gridArea: 'mission' }} className="glass-card p-4 flex flex-col overflow-hidden">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-3 flex-shrink-0">
            <Target className="w-4 h-4 text-cyan-400" />
            משימות היום
          </h3>
          <div className="space-y-2 flex-1 overflow-y-auto min-h-0">
            {todayTasks.length > 0 ? todayTasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center gap-3 p-2.5 rounded-lg bg-gray-800/40 hover:bg-gray-800/60 cursor-pointer transition-colors group"
                onClick={() => {
                  if (task.type === 'lead') navigate('/dashboard/sniper');
                  else if (task.type === 'competitor') navigate('/dashboard/landscape');
                  else navigate('/dashboard/intelligence');
                }}
              >
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  task.priority === 'high' ? 'bg-red-500' : task.priority === 'medium' ? 'bg-amber-500' : 'bg-blue-500'
                }`} />
                <span className="text-sm text-gray-200 flex-1 truncate">{task.title}</span>
                <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-cyan-400 transition-colors rotate-180" />
              </div>
            )) : (
              <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                <CheckCircle2 className="w-4 h-4 ml-2 text-emerald-400" />
                אין משימות דחופות
              </div>
            )}
          </div>
        </div>

        {/* HOT OPPORTUNITY */}
        <div style={{
          gridArea: 'opportunity',
          border: '1px solid rgba(0,212,255,0.3)',
          boxShadow: '0 0 20px rgba(0,212,255,0.1)',
        }} className="glass-card p-4 flex flex-col justify-center overflow-hidden">
          {topOpportunity ? (
            <>
              <div className="flex items-center gap-2 mb-2">
                <Flame className="w-4 h-4 text-orange-400" />
                <span className="text-xs font-semibold text-orange-400 uppercase tracking-wider">הזדמנות היום</span>
              </div>
              <h3 className="text-white font-bold text-base mb-1 line-clamp-2">{topOpportunity.title}</h3>
              <p className="text-gray-400 text-xs line-clamp-2 mb-3">{topOpportunity.description}</p>
              <button
                onClick={() => {
                  if (topOpportunity.type === 'lead') navigate('/dashboard/sniper');
                  else navigate('/dashboard/intelligence');
                }}
                className="w-full py-2.5 rounded-lg font-bold text-sm transition-all"
                style={{ background: '#00d4ff', color: '#0a0f1e' }}
              >
                פעל עכשיו →
              </button>
            </>
          ) : (
            <div className="text-center text-gray-500 text-sm">
              <Sparkles className="w-8 h-8 mx-auto mb-2 text-cyan-500/50" />
              סורק הזדמנויות...
            </div>
          )}
        </div>

        {/* INTEL FEED */}
        <div style={{ gridArea: 'intel' }} className="glass-card p-4 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between mb-3 flex-shrink-0">
            <h4 className="text-sm font-semibold text-white flex items-center gap-2">
              {unreadCount > 0 ? <BellDot className="w-4 h-4 text-red-400" /> : <Bell className="w-4 h-4 text-gray-500" />}
              מודיעין אחרון
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 text-[10px]">{unreadCount}</span>
              )}
            </h4>
          </div>
          <div className="space-y-2 flex-1 overflow-y-auto min-h-0">
            {events.length > 0 ? events.map((ev) => {
              const dotColor = EVENT_COLORS[ev.event_type] || 'bg-gray-500';
              return (
                <div key={ev.id} className={`flex items-start gap-2.5 p-2 rounded-lg ${!ev.is_read ? 'bg-gray-800/40' : ''}`}>
                  <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${dotColor}`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs leading-relaxed ${!ev.is_read ? 'text-white font-medium' : 'text-gray-400'}`}>
                      {ev.title}
                    </p>
                    <span className="text-[10px] text-gray-600">{formatTimeAgo(ev.created_at)}</span>
                  </div>
                </div>
              );
            }) : (
              <div className="flex items-center justify-center h-full text-gray-500 text-xs">
                אין אירועים אחרונים
              </div>
            )}
          </div>
        </div>

        {/* KPI ROW */}
        <div style={{ gridArea: 'kpi' }} className="grid grid-cols-4 gap-3">
          {[
            { label: 'לידים', value: leadsCount, link: '/dashboard/sniper', icon: '🎯', color: 'text-cyan-400' },
            { label: 'מתחרים', value: market_stats.total_competitors || 0, link: '/dashboard/landscape', icon: '👁️', color: 'text-blue-400' },
            { label: 'אירועים', value: eventsCount, link: '/dashboard/intelligence', icon: '⚡', color: 'text-amber-400' },
            { label: 'דירוג', value: market_stats.your_rating > 0 ? market_stats.your_rating.toFixed(1) : '—', link: '/dashboard/reflection', icon: '⭐', color: 'text-emerald-400' },
          ].map(kpi => (
            <div
              key={kpi.label}
              onClick={() => navigate(kpi.link)}
              className="glass-card flex items-center gap-3 px-4 py-2 cursor-pointer hover:bg-gray-800/50 transition-colors group"
            >
              <span className="text-lg">{kpi.icon}</span>
              <div>
                <span className={`text-xl font-bold block ${kpi.color}`} style={{ fontFamily: 'var(--font-mono, monospace)' }}>
                  {kpi.value}
                </span>
                <span className="text-[10px] text-gray-500">{kpi.label}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          MOBILE LAYOUT — single column stack (visible < md)
         ═══════════════════════════════════════════════════════════ */}
      <div dir="rtl" className="md:hidden fade-in flex flex-col gap-3 p-3">
        {/* Mobile Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            {biz.logo_url ? (
              <img src={biz.logo_url} alt="" className="w-9 h-9 rounded-xl object-cover border border-gray-700 flex-shrink-0" />
            ) : (
              <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center flex-shrink-0">
                <span className="text-base">👁️</span>
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-base font-bold text-white leading-tight truncate">{biz.name_hebrew || biz.name}</h1>
              <span className="text-[11px] text-gray-500 truncate block">
                {biz.industry || biz.business_type}{biz.city ? ` · ${biz.city}` : ''}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => fetchDashboard(true)}
              disabled={refreshing}
              className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800/50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={triggerScan}
              disabled={scanning}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/25 text-xs"
            >
              {scanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Radar className="w-3.5 h-3.5" />}
              {scanning ? 'סורק...' : 'סריקה'}
            </button>
          </div>
        </div>

        {/* KPI Row - 2x2 grid on mobile */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'לידים', value: leadsCount, link: '/dashboard/sniper', icon: '🎯', color: 'text-cyan-400' },
            { label: 'מתחרים', value: market_stats.total_competitors || 0, link: '/dashboard/landscape', icon: '👁️', color: 'text-blue-400' },
            { label: 'אירועים', value: eventsCount, link: '/dashboard/intelligence', icon: '⚡', color: 'text-amber-400' },
            { label: 'דירוג', value: market_stats.your_rating > 0 ? market_stats.your_rating.toFixed(1) : '—', link: '/dashboard/reflection', icon: '⭐', color: 'text-emerald-400' },
          ].map(kpi => (
            <div
              key={kpi.label}
              onClick={() => navigate(kpi.link)}
              className="glass-card flex items-center gap-3 px-3 py-3 cursor-pointer active:bg-gray-800/50 transition-colors"
            >
              <span className="text-lg">{kpi.icon}</span>
              <div>
                <span className={`text-xl font-bold block ${kpi.color}`} style={{ fontFamily: 'var(--font-mono, monospace)' }}>
                  {kpi.value}
                </span>
                <span className="text-[11px] text-gray-500">{kpi.label}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Health Score - compact horizontal */}
        <div className="glass-card p-4 flex items-center gap-4">
          <AnimatedGauge value={healthScore} size={100} label="" />
          <div className="flex-1">
            <h3 className="text-sm font-bold text-white mb-1">ציון בריאות השוק</h3>
            <div className="flex items-center gap-1 text-sm">
              <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
              <span className="text-white font-bold">{market_stats.your_rating > 0 ? market_stats.your_rating.toFixed(1) : '—'}</span>
              <span className="text-gray-500 text-xs">מול {market_stats.avg_market_rating > 0 ? market_stats.avg_market_rating.toFixed(1) : '—'} שוק</span>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {market_stats.high_threat_competitors || 0} איומים מתוך {market_stats.total_competitors || 0}
            </div>
          </div>
        </div>

        {/* Hot Opportunity */}
        {topOpportunity && (
          <div className="glass-card p-4" style={{
            border: '1px solid rgba(0,212,255,0.3)',
            boxShadow: '0 0 20px rgba(0,212,255,0.1)',
          }}>
            <div className="flex items-center gap-2 mb-2">
              <Flame className="w-4 h-4 text-orange-400" />
              <span className="text-xs font-semibold text-orange-400 uppercase tracking-wider">הזדמנות היום</span>
            </div>
            <h3 className="text-white font-bold text-base mb-1">{topOpportunity.title}</h3>
            <p className="text-gray-400 text-xs mb-3 line-clamp-2">{topOpportunity.description}</p>
            <button
              onClick={() => {
                if (topOpportunity.type === 'lead') navigate('/dashboard/sniper');
                else navigate('/dashboard/intelligence');
              }}
              className="w-full py-3 rounded-lg font-bold text-sm transition-all min-h-[48px]"
              style={{ background: '#00d4ff', color: '#0a0f1e' }}
            >
              פעל עכשיו →
            </button>
          </div>
        )}

        {/* Today's Tasks */}
        <div className="glass-card p-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-3">
            <Target className="w-4 h-4 text-cyan-400" />
            משימות היום
          </h3>
          <div className="space-y-2">
            {todayTasks.length > 0 ? todayTasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center gap-3 p-3 rounded-lg bg-gray-800/40 active:bg-gray-800/60 cursor-pointer transition-colors group min-h-[48px]"
                onClick={() => {
                  if (task.type === 'lead') navigate('/dashboard/sniper');
                  else if (task.type === 'competitor') navigate('/dashboard/landscape');
                  else navigate('/dashboard/intelligence');
                }}
              >
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  task.priority === 'high' ? 'bg-red-500' : task.priority === 'medium' ? 'bg-amber-500' : 'bg-blue-500'
                }`} />
                <span className="text-sm text-gray-200 flex-1">{task.title}</span>
                <ChevronRight className="w-4 h-4 text-gray-600 rotate-180 flex-shrink-0" />
              </div>
            )) : (
              <div className="flex items-center justify-center py-4 text-gray-500 text-sm">
                <CheckCircle2 className="w-4 h-4 ml-2 text-emerald-400" />
                אין משימות דחופות
              </div>
            )}
          </div>
        </div>

        {/* Intel Feed */}
        <div className="glass-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-white flex items-center gap-2">
              {unreadCount > 0 ? <BellDot className="w-4 h-4 text-red-400" /> : <Bell className="w-4 h-4 text-gray-500" />}
              מודיעין אחרון
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 text-[10px]">{unreadCount}</span>
              )}
            </h4>
          </div>
          <div className="space-y-2">
            {events.length > 0 ? events.map((ev) => {
              const dotColor = EVENT_COLORS[ev.event_type] || 'bg-gray-500';
              return (
                <div key={ev.id} className={`flex items-start gap-2.5 p-2 rounded-lg ${!ev.is_read ? 'bg-gray-800/40' : ''}`}>
                  <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${dotColor}`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs leading-relaxed ${!ev.is_read ? 'text-white font-medium' : 'text-gray-400'}`}>
                      {ev.title}
                    </p>
                    <span className="text-[10px] text-gray-600">{formatTimeAgo(ev.created_at)}</span>
                  </div>
                </div>
              );
            }) : (
              <div className="flex items-center justify-center py-4 text-gray-500 text-xs">
                אין אירועים אחרונים
              </div>
            )}
          </div>
        </div>

        {/* Last updated */}
        <div className="text-center text-xs text-gray-600 pb-2 flex items-center justify-center gap-1">
          <Clock className="w-3 h-3" />
          עודכן {formatTimeAgo(lastScan)}
        </div>
      </div>

    </>
  );
}
