import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSimulation } from '../../context/SimulationContext';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../services/api';
import {
  Target, Shield, Radio, TrendingUp, Search, Zap,
  ChevronLeft, Loader2, Sparkles, Clock, CheckCircle2,
  AlertTriangle, ArrowUpRight, Calendar, ExternalLink,
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
    if (!user?.id) {
      setLoading(false);
      return;
    }
    fetchDailyFocus();
  }, [user?.id]);

  // Safety timeout
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
      const json = await res.json();
      setData(json);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'שגיאה';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'בוקר טוב';
    if (hour < 17) return 'צהריים טובים';
    if (hour < 21) return 'ערב טוב';
    return 'לילה טוב';
  };

  const getIcon = (iconName: string) => {
    const Icon = ICON_MAP[iconName] || Zap;
    return Icon;
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <Loader2 className="w-12 h-12 text-cyan-500 animate-spin" />
        <p className="text-gray-400">טוען את המשימות שלך...</p>
      </div>
    );
  }

  const businessName = data?.business_name || currentProfile?.nameHebrew || '';

  return (
    <div className="space-y-6 fade-in" dir="rtl">
      {/* Header */}
      <header className="mb-2">
        <h1 className="text-3xl font-bold text-white mb-1">
          {getGreeting()}{businessName ? `, ${businessName}` : ''}
        </h1>
        <p className="text-lg text-gray-400">
          מה אני עושה היום? {currentProfile?.emoji || '🎯'}
        </p>
      </header>

      {error && (
        <div className="glass-card p-4 border border-red-500/30 bg-red-500/5 flex items-center justify-between">
          <span className="text-red-400 text-sm">{error}</span>
          <button onClick={fetchDailyFocus} className="text-cyan-400 text-sm hover:underline">נסה שוב</button>
        </div>
      )}

      {/* ═══ SECTION A: משימות היום ═══ */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-600 to-blue-600 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">משימות היום</h2>
            <p className="text-sm text-gray-500">3 הדברים הכי חשובים שצריך לעשות עכשיו</p>
          </div>
        </div>

        {(!data?.tasks || data.tasks.length === 0) ? (
          <div className="glass-card p-8 text-center border border-gray-700/50">
            <Sparkles className="w-10 h-10 text-cyan-500 mx-auto mb-3" />
            <h3 className="text-white font-semibold mb-1">הכל מסודר!</h3>
            <p className="text-gray-400 text-sm">אין משימות דחופות כרגע. המערכת ממשיכה לסרוק.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {data.tasks.map((task, idx) => {
              const Icon = getIcon(task.icon);
              return (
                <div
                  key={task.id}
                  className={`glass-card p-5 border ${PRIORITY_COLORS[task.priority]} transition-all hover:scale-[1.01] cursor-pointer group`}
                  onClick={() => navigate(task.action_path)}
                >
                  <div className="flex items-start gap-4">
                    {/* Task number */}
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-cyan-600 to-blue-600 flex items-center justify-center text-white font-bold text-sm">
                      {idx + 1}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Icon className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                        <h3 className="text-white font-semibold truncate">{task.title}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-xs ${PRIORITY_BADGE[task.priority]}`}>
                          {PRIORITY_LABELS[task.priority]}
                        </span>
                      </div>
                      <p className="text-gray-400 text-sm line-clamp-2">{task.description}</p>
                      <div className="flex items-center justify-between mt-3">
                        <span className="text-xs text-gray-500">{task.metric}</span>
                        <span className="text-cyan-400 text-sm font-medium flex items-center gap-1 group-hover:gap-2 transition-all">
                          {task.action_label}
                          <ChevronLeft className="w-4 h-4" />
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ═══ SECTION B: ההזדמנות הכי גדולה היום ═══ */}
      {data?.biggest_opportunity && (
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-green-600 flex items-center justify-center">
              <ArrowUpRight className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">ההזדמנות הכי גדולה היום</h2>
              <p className="text-sm text-gray-500">אל תפספס את זה</p>
            </div>
          </div>

          <div
            className="glass-card p-6 border border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 to-green-500/5 cursor-pointer hover:scale-[1.01] transition-all group"
            onClick={() => navigate(data.biggest_opportunity!.action_path)}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-white font-bold text-lg">{data.biggest_opportunity.title}</h3>
                </div>
                <p className="text-gray-300 text-sm mb-3">{data.biggest_opportunity.description}</p>
                <div className="flex items-center gap-4">
                  <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-medium">
                    {data.biggest_opportunity.source}
                  </span>
                  {data.biggest_opportunity.relevance_score > 0 && (
                    <span className="text-xs text-gray-500">
                      רלוונטיות: {data.biggest_opportunity.relevance_score}%
                    </span>
                  )}
                </div>
              </div>
              <div className="flex-shrink-0 flex flex-col items-center gap-2">
                {data.biggest_opportunity.relevance_score >= 80 && (
                  <div className="w-14 h-14 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <span className="text-2xl font-bold text-emerald-400">{data.biggest_opportunity.relevance_score}</span>
                  </div>
                )}
                <span className="text-cyan-400 text-sm font-medium flex items-center gap-1 group-hover:gap-2 transition-all">
                  {data.biggest_opportunity.action_label}
                  <ChevronLeft className="w-4 h-4" />
                </span>
              </div>
            </div>
            {data.biggest_opportunity.url && (
              <a
                href={data.biggest_opportunity.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 mt-3 text-xs text-gray-500 hover:text-cyan-400 transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                קישור למקור
              </a>
            )}
          </div>
        </section>
      )}

      {/* ═══ SECTION C: מה עשית אתמול ═══ */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-purple-600 flex items-center justify-center">
            <Clock className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">מה קרה אתמול</h2>
            <p className="text-sm text-gray-500">סיכום הפעילות מיום קודם</p>
          </div>
        </div>

        <div className="glass-card p-5 border border-gray-700/50">
          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
            <div className="text-center p-3 rounded-lg bg-gray-800/50">
              <div className="text-2xl font-bold text-cyan-400">{data?.yesterday_summary?.leads_found ?? 0}</div>
              <div className="text-xs text-gray-500 mt-1">לידים נמצאו</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-gray-800/50">
              <div className="text-2xl font-bold text-emerald-400">{data?.yesterday_summary?.leads_actioned ?? 0}</div>
              <div className="text-xs text-gray-500 mt-1">לידים טופלו</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-gray-800/50">
              <div className="text-2xl font-bold text-amber-400">{data?.yesterday_summary?.events_count ?? 0}</div>
              <div className="text-xs text-gray-500 mt-1">עדכוני מודיעין</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-gray-800/50">
              <div className="flex items-center justify-center gap-1">
                <Calendar className="w-4 h-4 text-violet-400" />
                <span className="text-2xl font-bold text-violet-400">{data?.yesterday_summary?.streak_days ?? 0}</span>
              </div>
              <div className="text-xs text-gray-500 mt-1">ימים רצופים</div>
            </div>
          </div>

          {/* Summary text */}
          <div className="flex items-center gap-2 pt-3 border-t border-gray-700/50">
            {(data?.yesterday_summary?.leads_found ?? 0) > 0 || (data?.yesterday_summary?.events_count ?? 0) > 0 ? (
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            )}
            <p className="text-gray-300 text-sm">
              {data?.yesterday_summary?.summary_text || 'אין נתונים מאתמול'}
            </p>
          </div>
        </div>
      </section>

      {/* ═══ Quick Stats Bar ═══ */}
      <section className="glass-card p-4 border border-gray-700/50">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-cyan-400" />
              <span className="text-sm text-gray-400">לידים חדשים:</span>
              <span className="text-white font-semibold">{data?.new_leads_count ?? 0}</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-red-400" />
              <span className="text-sm text-gray-400">מתחרים:</span>
              <span className="text-white font-semibold">{data?.competitors_count ?? 0}</span>
            </div>
            {data?.industry && (
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <span className="text-sm text-gray-400">{data.industry}</span>
                {data.location && <span className="text-gray-600">|</span>}
                {data.location && <span className="text-sm text-gray-500">{data.location}</span>}
              </div>
            )}
          </div>
          <button
            onClick={fetchDailyFocus}
            className="text-cyan-400 text-sm hover:text-cyan-300 transition-colors flex items-center gap-1"
          >
            <Zap className="w-3 h-3" />
            רענן
          </button>
        </div>
      </section>
    </div>
  );
}
