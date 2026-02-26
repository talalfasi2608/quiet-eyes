import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSimulation } from '../../context/SimulationContext';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../services/api';
import {
  Target, Shield, Radio, TrendingUp, Search, Zap,
  ChevronLeft, Loader2, Sparkles, Clock, CheckCircle2,
  AlertTriangle, ArrowUpRight, Calendar, ExternalLink, Flame,
} from 'lucide-react';

interface DailyTask {
  id: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  category: string;
  action_label: string;
  action_path: string;
  icon: string;
  metric: string;
}

interface BiggestOpportunity {
  title: string;
  description: string;
  source: string;
  relevance_score: number;
  action_path: string;
  action_label: string;
  url: string;
}

interface YesterdaySummary {
  leads_found: number;
  leads_actioned: number;
  events_count: number;
  scans_run: number;
  streak_days: number;
  summary_text: string;
}

interface DailyFocusData {
  tasks: DailyTask[];
  biggest_opportunity: BiggestOpportunity | null;
  yesterday_summary: YesterdaySummary;
  business_name: string;
  industry: string;
  location: string;
  competitors_count: number;
  new_leads_count: number;
}

const ICON_MAP: Record<string, typeof Target> = {
  target: Target,
  shield: Shield,
  radar: Radio,
  trending: TrendingUp,
  search: Search,
};

const PRIORITY_COLORS: Record<string, string> = {
  high: 'border-red-500/40 bg-red-500/5',
  medium: 'border-amber-500/40 bg-amber-500/5',
  low: 'border-blue-500/40 bg-blue-500/5',
};

const PRIORITY_BADGE: Record<string, string> = {
  high: 'bg-red-500/20 text-red-400',
  medium: 'bg-amber-500/20 text-amber-400',
  low: 'bg-blue-500/20 text-blue-400',
};

const PRIORITY_LABELS: Record<string, string> = {
  high: 'דחוף',
  medium: 'חשוב',
  low: 'שגרתי',
};

export default function Focus() {
  const { currentProfile } = useSimulation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<DailyFocusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) { setLoading(false); return; }
    fetchDailyFocus();
  }, [user?.id]);

  useEffect(() => {
    const timeout = setTimeout(() => setLoading(false), 10000);
    return () => clearTimeout(timeout);
  }, []);

  const fetchDailyFocus = async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/business/daily-focus/${user.id}`);
      if (!res.ok) throw new Error(`${res.status}`);
      setData(await res.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'שגיאה');
    } finally {
      setLoading(false);
    }
  };

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'בוקר טוב';
    if (h < 17) return 'צהריים טובים';
    if (h < 21) return 'ערב טוב';
    return 'לילה טוב';
  };

  const getIcon = (name: string) => ICON_MAP[name] || Zap;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-60px)]">
        <Loader2 className="w-12 h-12 text-cyan-500 animate-spin" />
      </div>
    );
  }

  const businessName = data?.business_name || currentProfile?.nameHebrew || '';

  return (
    <div dir="rtl" className="fade-in" style={{
      display: 'grid',
      height: 'calc(100vh - 60px)',
      gridTemplateAreas: `
        "header"
        "tasks"
        "opportunity"
        "yesterday"
      `,
      gridTemplateRows: '56px 1fr auto 52px',
      gap: '12px',
      padding: '16px',
      overflow: 'hidden',
    }}>

      {/* ═══ HEADER ═══ */}
      <div style={{ gridArea: 'header' }} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white leading-tight">
            {getGreeting()}{businessName ? `, ${businessName}` : ''}
          </h1>
          <p className="text-sm text-gray-500">מה אני עושה היום?</p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5">
            <Target className="w-4 h-4 text-cyan-400" />
            <span className="text-gray-400">לידים:</span>
            <span className="text-white font-bold">{data?.new_leads_count ?? 0}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-red-400" />
            <span className="text-gray-400">מתחרים:</span>
            <span className="text-white font-bold">{data?.competitors_count ?? 0}</span>
          </div>
          <button onClick={fetchDailyFocus} className="text-cyan-400 hover:text-cyan-300 transition-colors">
            <Zap className="w-4 h-4" />
          </button>
        </div>
      </div>

      {error && (
        <div className="glass-card p-3 border border-red-500/30 bg-red-500/5 flex items-center justify-between" style={{ gridArea: 'tasks' }}>
          <span className="text-red-400 text-sm">{error}</span>
          <button onClick={fetchDailyFocus} className="text-cyan-400 text-sm hover:underline">נסה שוב</button>
        </div>
      )}

      {/* ═══ TASKS ═══ */}
      {!error && (
        <div style={{ gridArea: 'tasks' }} className="flex flex-col overflow-hidden min-h-0">
          <div className="flex items-center gap-2 mb-3 flex-shrink-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-600 to-blue-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-white" />
            </div>
            <h2 className="text-lg font-bold text-white">משימות היום</h2>
            <span className="text-xs text-gray-500">3 הדברים הכי חשובים</span>
          </div>

          {(!data?.tasks || data.tasks.length === 0) ? (
            <div className="glass-card p-6 text-center flex-1 flex flex-col items-center justify-center">
              <Sparkles className="w-8 h-8 text-cyan-500 mb-2" />
              <h3 className="text-white font-semibold">הכל מסודר!</h3>
              <p className="text-gray-400 text-sm">אין משימות דחופות כרגע</p>
            </div>
          ) : (
            <div className="space-y-2 flex-1 overflow-y-auto min-h-0">
              {data.tasks.slice(0, 3).map((task, idx) => {
                const Icon = getIcon(task.icon);
                return (
                  <div
                    key={task.id}
                    className={`glass-card p-4 border ${PRIORITY_COLORS[task.priority]} transition-all hover:scale-[1.005] cursor-pointer group`}
                    onClick={() => navigate(task.action_path)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-600 to-blue-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <Icon className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                          <h3 className="text-white font-semibold text-sm truncate">{task.title}</h3>
                          <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${PRIORITY_BADGE[task.priority]}`}>
                            {PRIORITY_LABELS[task.priority]}
                          </span>
                        </div>
                        <p className="text-gray-400 text-xs line-clamp-1">{task.description}</p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-[10px] text-gray-500">{task.metric}</span>
                          <span className="text-cyan-400 text-xs font-medium flex items-center gap-1 group-hover:gap-1.5 transition-all">
                            {task.action_label}
                            <ChevronLeft className="w-3 h-3" />
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══ OPPORTUNITY ═══ */}
      <div style={{
        gridArea: 'opportunity',
        border: data?.biggest_opportunity ? '1px solid rgba(0,212,255,0.3)' : undefined,
        boxShadow: data?.biggest_opportunity ? '0 0 20px rgba(0,212,255,0.1)' : undefined,
      }} className="glass-card p-4">
        {data?.biggest_opportunity ? (
          <div
            className="flex items-center gap-4 cursor-pointer group"
            onClick={() => navigate(data.biggest_opportunity!.action_path)}
          >
            <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-600/20 to-cyan-600/20 flex items-center justify-center border border-cyan-500/30">
              <Flame className="w-6 h-6 text-orange-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xs font-semibold text-orange-400 uppercase tracking-wider">הזדמנות היום</span>
                {data.biggest_opportunity.relevance_score >= 80 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px]">
                    {data.biggest_opportunity.relevance_score}%
                  </span>
                )}
              </div>
              <h3 className="text-white font-bold text-base truncate">{data.biggest_opportunity.title}</h3>
              <p className="text-gray-400 text-xs line-clamp-1">{data.biggest_opportunity.description}</p>
            </div>
            <button className="flex-shrink-0 px-4 py-2 rounded-lg font-bold text-sm"
              style={{ background: '#00d4ff', color: '#0a0f1e' }}
            >
              פעל עכשיו →
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">
            <Sparkles className="w-5 h-5 ml-2 text-cyan-500/50" />
            סורק הזדמנויות...
          </div>
        )}
      </div>

      {/* ═══ YESTERDAY - COMPACT ═══ */}
      <div style={{ gridArea: 'yesterday' }} className="flex items-center gap-4 px-4 glass-card">
        <Clock className="w-4 h-4 text-gray-500 flex-shrink-0" />
        <span className="text-xs text-gray-500 flex-shrink-0">אתמול:</span>
        <div className="flex items-center gap-4 text-xs">
          <span className="text-cyan-400 font-semibold">{data?.yesterday_summary?.leads_found ?? 0} לידים</span>
          <span className="text-gray-600">·</span>
          <span className="text-amber-400 font-semibold">{data?.yesterday_summary?.events_count ?? 0} אירועים</span>
          <span className="text-gray-600">·</span>
          <span className="text-emerald-400 font-semibold">{data?.yesterday_summary?.leads_actioned ?? 0} טופלו</span>
          {(data?.yesterday_summary?.streak_days ?? 0) > 0 && (
            <>
              <span className="text-gray-600">·</span>
              <span className="text-violet-400 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {data?.yesterday_summary?.streak_days} ימים רצופים
              </span>
            </>
          )}
        </div>
        {data?.yesterday_summary?.summary_text && (
          <span className="text-gray-500 text-xs truncate flex-1">{data.yesterday_summary.summary_text}</span>
        )}
      </div>
    </div>
  );
}
