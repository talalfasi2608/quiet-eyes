import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useSimulation } from '../../context/SimulationContext';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../services/api';
import AnimatedGauge from '../../components/AnimatedGauge';
import {
  Radar, Target, RefreshCw, Loader2, Star,
  ChevronRight, Sparkles,
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

function getGreeting(name: string): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 11) return `בוקר טוב${name ? ` ${name}` : ''} ☀️`;
  if (h >= 11 && h < 17) return `שלום${name ? ` ${name}` : ''} 👋`;
  if (h >= 17 && h < 21) return `ערב טוב${name ? ` ${name}` : ''} 🌙`;
  return `לילה טוב${name ? ` ${name}` : ''} 🌜`;
}

function getHealthLabel(score: number): { label: string; color: string } {
  if (score >= 90) return { label: 'מצוין 🚀', color: 'text-emerald-400' };
  if (score >= 70) return { label: 'טוב 😊', color: 'text-cyan-400' };
  if (score >= 50) return { label: 'יש מקום לשיפור 💪', color: 'text-amber-400' };
  return { label: 'בוא נעבוד על זה 🤝', color: 'text-red-400' };
}

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
  const [topLeads, setTopLeads] = useState<Array<{ id: string; summary: string; relevance_score: number; created_at: string }>>([]);
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
      toast.error('אופס, לא הצלחנו לטעון את הנתונים. נסה שוב בעוד רגע');
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
      toast.error('לא הצלחנו לטעון אירועים — נסה לרענן');
    }
  }, [currentProfile?.id]);

  // Fetch leads (top 3 + count)
  const fetchLeadsCount = useCallback(async () => {
    if (!currentProfile?.id) return;
    try {
      const res = await apiFetch(`/leads/${currentProfile.id}?limit=10`);
      if (res.ok) {
        const d = await res.json();
        setLeadsCount(d.total || 0);
        // Sort by relevance score and take top 3
        const leads = (d.leads || [])
          .sort((a: any, b: any) => (b.relevance_score || 0) - (a.relevance_score || 0))
          .slice(0, 3);
        setTopLeads(leads);
      }
    } catch {
      // Silent — don't show toast for non-critical data
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
      toast.error('הסריקה לא הצליחה. נסה שוב בעוד רגע');
    } finally {
      setScanning(false);
    }
  };

  // Loading
  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-60px)] md:h-[calc(100vh-60px)]" dir="rtl">
        <div className="text-center space-y-3">
          <Loader2 className="w-12 h-12 text-cyan-500 animate-spin mx-auto" />
          <p className="text-gray-400 text-sm">👁️ עיני אוסף נתונים...</p>
        </div>
      </div>
    );
  }

  if (!data?.business_info) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-60px)]" dir="rtl">
        <div className="text-center space-y-4">
          <Sparkles className="w-16 h-16 text-cyan-500 mx-auto" />
          <h2 className="text-2xl font-bold text-white">העוזרים שלך מתחילים לעבוד...</h2>
          <p className="text-gray-400">👁️ עיני סורק את האזור שלך. זה לוקח כמה דקות.</p>
        </div>
      </div>
    );
  }

  const { business_info: biz, competitors, strategy_feed, market_stats } = data;
  const healthScore = biz.market_health_score || 0;
  const healthInfo = getHealthLabel(healthScore);
  const firstName = user?.user_metadata?.first_name || '';
  const greetingText = getGreeting(firstName);
  const topOpportunity = strategy_feed.find(s => s.priority === 'high') || strategy_feed[0];
  const todayTasks = strategy_feed.slice(0, 3);
  const topCompetitors = competitors.slice(0, 4);

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
              <h1 className="text-lg font-bold text-white leading-tight">{greetingText}</h1>
              <span className="text-xs text-gray-500">
                {biz.name_hebrew || biz.name}
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
              {scanning ? '👁️ עיני סורק...' : 'סריקה'}
            </button>
          </div>
        </div>

        {/* HEALTH GAUGE */}
        <div style={{ gridArea: 'health' }} className="glass-card flex flex-col items-center justify-center p-4">
          <AnimatedGauge value={healthScore} size={180} label="בריאות העסק" />
          <div className="mt-3 text-center">
            <span className={`text-sm font-bold ${healthInfo.color}`}>{healthInfo.label}</span>
            <div className="flex items-center justify-center gap-1 text-sm mt-1">
              <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
              <span className="text-white font-bold">{market_stats.your_rating > 0 ? market_stats.your_rating.toFixed(1) : '—'}</span>
              <span className="text-gray-500 text-xs">מול {market_stats.avg_market_rating > 0 ? market_stats.avg_market_rating.toFixed(1) : '—'} שוק</span>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {market_stats.high_threat_competitors || 0} מתחרים חזקים מתוך {market_stats.total_competitors || 0}
            </div>
          </div>
        </div>

        {/* TODAY'S MISSION */}
        <div style={{ gridArea: 'mission' }} className="glass-card p-4 flex flex-col overflow-hidden">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-1 flex-shrink-0">
            <Target className="w-4 h-4 text-cyan-400" />
            3 דברים שיזיזו את היום שלך
          </h3>
          <p className="text-[10px] text-gray-500 mb-3 flex-shrink-0">🧠 המוח הכין אלה בשבילך הבוקר</p>
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
                המוח מכין משימות... ☕
              </div>
            )}
          </div>
        </div>

        {/* TOP LEADS — מי מחפש אותך? */}
        <div style={{ gridArea: 'opportunity' }} className="glass-card p-4 flex flex-col overflow-hidden">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-3 flex-shrink-0">
            <Target className="w-4 h-4 text-cyan-400" />
            מי מחפש אותך? 🎯
          </h3>
          <div className="space-y-2 flex-1 overflow-y-auto min-h-0">
            {topLeads.length > 0 ? topLeads.map((lead) => (
              <div
                key={lead.id}
                className="flex items-start gap-3 p-2.5 rounded-lg bg-gray-800/40 hover:bg-gray-800/60 cursor-pointer transition-colors group"
                onClick={() => navigate('/dashboard/sniper')}
              >
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold flex-shrink-0 mt-0.5 ${
                  (lead.relevance_score || 0) >= 80 ? 'bg-emerald-500/20 text-emerald-400' :
                  (lead.relevance_score || 0) >= 60 ? 'bg-cyan-500/20 text-cyan-400' :
                  'bg-gray-700 text-gray-400'
                }`}>
                  {lead.relevance_score || 0}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-200 line-clamp-2">{(lead.summary || '').slice(0, 100)}</p>
                  <span className="text-[10px] text-gray-600">{formatTimeAgo(lead.created_at)}</span>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); navigate('/dashboard/sniper'); }}
                  className="text-[10px] text-cyan-400 hover:text-cyan-300 whitespace-nowrap flex-shrink-0"
                >
                  פנה עכשיו
                </button>
              </div>
            )) : (
              <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                עיני עוד סורק... בדרך כלל עד כמה שעות 👀
              </div>
            )}
          </div>
        </div>

        {/* TOP COMPETITORS — המתחרים שלך */}
        <div style={{ gridArea: 'intel' }} className="glass-card p-4 flex flex-col overflow-hidden">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-3 flex-shrink-0">
            <Radar className="w-4 h-4 text-blue-400" />
            המתחרים שלך 👀
          </h3>
          <div className="space-y-2 flex-1 overflow-y-auto min-h-0">
            {topCompetitors.length > 0 ? topCompetitors.map((comp) => (
              <div
                key={comp.id}
                className="flex items-center gap-3 p-2.5 rounded-lg bg-gray-800/40 hover:bg-gray-800/60 cursor-pointer transition-colors"
                onClick={() => navigate('/dashboard/landscape')}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-200 truncate">{comp.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="flex items-center gap-0.5 text-xs">
                      <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                      <span className="text-gray-300">{comp.google_rating > 0 ? comp.google_rating.toFixed(1) : '—'}</span>
                    </span>
                    <span className="text-[10px] text-gray-500">{comp.google_reviews_count} ביקורות</span>
                  </div>
                </div>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                  comp.threat_level === 'high' ? 'bg-red-500/20 text-red-400' :
                  comp.threat_level === 'medium' ? 'bg-amber-500/20 text-amber-400' :
                  'bg-gray-700 text-gray-400'
                }`}>
                  {comp.threat_level === 'high' ? 'חזק' : comp.threat_level === 'medium' ? 'בינוני' : 'נמוך'}
                </span>
              </div>
            )) : (
              <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                עיני מציר את המפה... מחר תראה הכל 🗺️
              </div>
            )}
          </div>
        </div>

        {/* KPI ROW */}
        <div style={{ gridArea: 'kpi' }} className="grid grid-cols-4 gap-3">
          {[
            { label: 'מי מחפש אותי', value: leadsCount, link: '/dashboard/sniper', icon: '🎯', color: 'text-cyan-400' },
            { label: 'מתחרים', value: market_stats.total_competitors || 0, link: '/dashboard/landscape', icon: '👀', color: 'text-blue-400' },
            { label: 'אירועים', value: eventsCount, link: '/dashboard/intelligence', icon: '💡', color: 'text-amber-400' },
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
              <h1 className="text-base font-bold text-white leading-tight truncate">{greetingText}</h1>
              <span className="text-[11px] text-gray-500 truncate block">
                {biz.name_hebrew || biz.name}
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
              {scanning ? '👁️ עיני סורק...' : 'סריקה'}
            </button>
          </div>
        </div>

        {/* KPI Row - 2x2 grid on mobile */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'מי מחפש אותי', value: leadsCount, link: '/dashboard/sniper', icon: '🎯', color: 'text-cyan-400' },
            { label: 'מתחרים', value: market_stats.total_competitors || 0, link: '/dashboard/landscape', icon: '👀', color: 'text-blue-400' },
            { label: 'אירועים', value: eventsCount, link: '/dashboard/intelligence', icon: '💡', color: 'text-amber-400' },
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
            <h3 className="text-sm font-bold text-white mb-1">בריאות העסק</h3>
            <span className={`text-xs font-bold ${healthInfo.color}`}>{healthInfo.label}</span>
            <div className="flex items-center gap-1 text-sm mt-1">
              <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
              <span className="text-white font-bold">{market_stats.your_rating > 0 ? market_stats.your_rating.toFixed(1) : '—'}</span>
              <span className="text-gray-500 text-xs">מול {market_stats.avg_market_rating > 0 ? market_stats.avg_market_rating.toFixed(1) : '—'} שוק</span>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {market_stats.high_threat_competitors || 0} מתחרים חזקים מתוך {market_stats.total_competitors || 0}
            </div>
          </div>
        </div>

        {/* Top Leads — מי מחפש אותך? */}
        <div className="glass-card p-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-3">
            <Target className="w-4 h-4 text-cyan-400" />
            מי מחפש אותך? 🎯
          </h3>
          <div className="space-y-2">
            {topLeads.length > 0 ? topLeads.map((lead) => (
              <div
                key={lead.id}
                className="flex items-start gap-3 p-3 rounded-lg bg-gray-800/40 active:bg-gray-800/60 cursor-pointer transition-colors min-h-[48px]"
                onClick={() => navigate('/dashboard/sniper')}
              >
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold flex-shrink-0 mt-0.5 ${
                  (lead.relevance_score || 0) >= 80 ? 'bg-emerald-500/20 text-emerald-400' :
                  (lead.relevance_score || 0) >= 60 ? 'bg-cyan-500/20 text-cyan-400' :
                  'bg-gray-700 text-gray-400'
                }`}>
                  {lead.relevance_score || 0}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-200 line-clamp-2">{(lead.summary || '').slice(0, 100)}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[10px] text-gray-600">{formatTimeAgo(lead.created_at)}</span>
                    <span className="text-[10px] text-cyan-400">פנה עכשיו</span>
                  </div>
                </div>
              </div>
            )) : (
              <div className="flex items-center justify-center py-4 text-gray-500 text-sm">
                עיני עוד סורק... בדרך כלל עד כמה שעות 👀
              </div>
            )}
          </div>
        </div>

        {/* Top Competitors — המתחרים שלך */}
        <div className="glass-card p-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-3">
            <Radar className="w-4 h-4 text-blue-400" />
            המתחרים שלך 👀
          </h3>
          <div className="space-y-2">
            {topCompetitors.length > 0 ? topCompetitors.map((comp) => (
              <div
                key={comp.id}
                className="flex items-center gap-3 p-3 rounded-lg bg-gray-800/40 active:bg-gray-800/60 cursor-pointer transition-colors min-h-[48px]"
                onClick={() => navigate('/dashboard/landscape')}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-200 truncate">{comp.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="flex items-center gap-0.5 text-xs">
                      <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                      <span className="text-gray-300">{comp.google_rating > 0 ? comp.google_rating.toFixed(1) : '—'}</span>
                    </span>
                    <span className="text-[10px] text-gray-500">{comp.google_reviews_count} ביקורות</span>
                  </div>
                </div>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                  comp.threat_level === 'high' ? 'bg-red-500/20 text-red-400' :
                  comp.threat_level === 'medium' ? 'bg-amber-500/20 text-amber-400' :
                  'bg-gray-700 text-gray-400'
                }`}>
                  {comp.threat_level === 'high' ? 'חזק' : comp.threat_level === 'medium' ? 'בינוני' : 'נמוך'}
                </span>
              </div>
            )) : (
              <div className="flex items-center justify-center py-4 text-gray-500 text-sm">
                עיני מציר את המפה... מחר תראה הכל 🗺️
              </div>
            )}
          </div>
        </div>

        {/* Today's Tasks */}
        <div className="glass-card p-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-1">
            <Target className="w-4 h-4 text-cyan-400" />
            3 דברים שיזיזו את היום שלך
          </h3>
          <p className="text-[10px] text-gray-500 mb-3">🧠 המוח הכין אלה בשבילך הבוקר</p>
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
                המוח מכין משימות... ☕
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
