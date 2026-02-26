import { useState, useEffect } from 'react';
import { useSimulation } from '../../context/SimulationContext';
import { Calendar, TrendingUp, Zap, Loader2, CalendarX, Sparkles, CheckCircle2, Clock, AlertTriangle, Flame, ArrowUpRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiFetch } from '../../services/api';
import PageLoader from '../../components/ui/PageLoader';
import EmptyState from '../../components/ui/EmptyState';

interface TrendItem {
  id: string;
  keyword: string;
  title: string;
  analysis: string;
  action: string;
  level: 'breakout' | 'emerging' | 'stable';
  change_pct: number;
  sources: string[];
  evidence: string[];
  relevance_score: number;
  urgency: string;
  created_at: string;
}

interface PredictionEvent {
  name_hebrew: string;
  name_english: string;
  date: string;
  days_until: number;
  duration_days: number;
  business_impact: string;
  relevance: string;
  categories: string[];
  matching_categories: string[];
  description: string;
  recommendations: string[];
}

interface PredictionsData {
  events: PredictionEvent[];
  business_context: {
    id: string;
    name: string;
    name_hebrew: string;
    industry: string;
    detected_categories: string[];
  };
  insights: string[];
}

export default function Horizon() {
  const { currentProfile } = useSimulation();
  const [predictions, setPredictions] = useState<PredictionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trends, setTrends] = useState<TrendItem[]>([]);
  const [trendsLoading, setTrendsLoading] = useState(true);

  // Safety timeout: resets each time loading becomes true
  useEffect(() => {
    if (!loading) return;
    const timeout = setTimeout(() => setLoading(false), 10000);
    return () => clearTimeout(timeout);
  }, [loading]);

  useEffect(() => {
    if (!trendsLoading) return;
    const timeout = setTimeout(() => setTrendsLoading(false), 10000);
    return () => clearTimeout(timeout);
  }, [trendsLoading]);

  useEffect(() => {
    if (!currentProfile?.id) return;
    let cancelled = false;

    const fetchPredictions = async () => {
      setLoading(true);
      setError(null);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      try {
        const response = await apiFetch(
          `/predictions/upcoming/${currentProfile.id}?days_ahead=90`,
          { signal: controller.signal }
        );
        clearTimeout(timeout);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        if (!cancelled) setPredictions(data);
      } catch (err: any) {
        clearTimeout(timeout);
        if (!cancelled) {
          const msg = err.name === 'AbortError' ? 'הזמן הקצוב חלף' : (err.message || 'שגיאה בטעינת תחזיות');
          setError(msg);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchPredictions();
    return () => { cancelled = true; };
  }, [currentProfile?.id]);

  // Fetch live trends from Trend Radar API
  useEffect(() => {
    if (!currentProfile?.id) return;
    let cancelled = false;

    const fetchTrends = async () => {
      setTrendsLoading(true);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      try {
        const response = await apiFetch(
          `/trends/current/${currentProfile.id}?limit=10`,
          { signal: controller.signal }
        );
        clearTimeout(timeout);
        if (response.ok) {
          const data = await response.json();
          if (!cancelled) setTrends(data.trends || []);
        }
      } catch {
        clearTimeout(timeout);
      } finally {
        if (!cancelled) setTrendsLoading(false);
      }
    };

    fetchTrends();
    return () => { cancelled = true; };
  }, [currentProfile?.id]);

  // Loading state
  if (!currentProfile) {
    return (
      <PageLoader message="טוען תחזיות..." />
    );
  }

  const { trendingTopics, nameHebrew, emoji } = currentProfile;

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'medium': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getImpactLabel = (impact: string) => {
    switch (impact) {
      case 'high': return 'השפעה גבוהה';
      case 'medium': return 'השפעה בינונית';
      default: return 'השפעה נמוכה';
    }
  };

  const getRelevanceColor = (relevance: string) => {
    switch (relevance) {
      case 'high': return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      case 'medium': return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getRelevanceLabel = (relevance: string) => {
    switch (relevance) {
      case 'high': return 'רלוונטיות גבוהה';
      case 'medium': return 'רלוונטיות בינונית';
      default: return 'רלוונטיות נמוכה';
    }
  };

  const getDaysUntilColor = (days: number) => {
    if (days <= 7) return 'text-red-400';
    if (days <= 21) return 'text-amber-400';
    return 'text-gray-400';
  };

  const events = predictions?.events || [];
  const insights = predictions?.insights || [];

  return (
    <div className="space-y-6 fade-in">
      <header>
        <h1 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: "var(--font-display)" }}>האופק</h1>
        <p className="text-[var(--text-secondary)]">מגמות, אירועים והזדמנויות עתידיות עבור {nameHebrew} {emoji}</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Widget - Events from API */}
        <div className="lg:col-span-2">
          <div className="glass-card">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">אירועים קרובים</h2>
                <p className="text-gray-400 text-sm">הזדמנויות להכנה מראש</p>
              </div>
            </div>

            {loading ? (
              <div className="text-center py-12">
                <Loader2 className="w-10 h-10 text-cyan-400 animate-spin mx-auto mb-4" />
                <p className="text-gray-400">מנתח אירועים...</p>
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-4" />
                <p className="text-gray-400">לא ניתן לטעון תחזיות</p>
                <p className="text-gray-500 text-sm mt-2">{error}</p>
              </div>
            ) : events.length === 0 ? (
              <EmptyState icon={CalendarX} title="אין אירועים מתוכננים" description="אירועים יופיעו כאן כשנזהה הזדמנויות עסקיות" />
            ) : (
              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
                {events.map((event, index) => (
                  <div
                    key={index}
                    className="p-4 rounded-xl bg-gray-800/50 hover:bg-gray-800/70 transition-colors border border-gray-700/50"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-2 ${
                          event.business_impact === 'high' ? 'bg-emerald-400' :
                          event.business_impact === 'medium' ? 'bg-amber-400' : 'bg-gray-400'
                        }`} />
                        <div>
                          <h3 className="text-white font-semibold">{event.name_hebrew}</h3>
                          <p className="text-gray-500 text-xs">{event.name_english}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`px-2 py-1 rounded-full text-xs border ${getRelevanceColor(event.relevance)}`}>
                          {getRelevanceLabel(event.relevance)}
                        </span>
                        <span className={`px-2 py-1 rounded-full text-xs border ${getImpactColor(event.business_impact)}`}>
                          {getImpactLabel(event.business_impact)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 mb-3 text-sm">
                      <span className="flex items-center gap-1 text-gray-400">
                        <Calendar className="w-3.5 h-3.5" />
                        {event.date}
                      </span>
                      <span className={`flex items-center gap-1 font-medium ${getDaysUntilColor(event.days_until)}`}>
                        <Clock className="w-3.5 h-3.5" />
                        {event.days_until === 0
                          ? 'היום!'
                          : event.days_until === 1
                          ? 'מחר'
                          : `בעוד ${event.days_until} ימים`}
                      </span>
                      {event.duration_days > 1 && (
                        <span className="text-gray-500 text-xs">
                          ({event.duration_days} ימים)
                        </span>
                      )}
                    </div>

                    {event.recommendations && event.recommendations.length > 0 && (
                      <div className="mt-3 space-y-2 border-t border-gray-700/50 pt-3">
                        <p className="text-gray-400 text-xs font-medium mb-2">המלצות להכנה:</p>
                        {event.recommendations.map((rec, rIdx) => (
                          <div key={rIdx} className="flex items-start gap-2">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />
                            <p className="text-gray-300 text-sm">{rec}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* AI Insights Sidebar */}
        <div className="lg:col-span-1">
          <div className="glass-card">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">תובנות עסקיות</h2>
                <p className="text-gray-400 text-sm">המלצות מותאמות אישית</p>
              </div>
            </div>

            {loading ? (
              <div className="text-center py-12">
                <Loader2 className="w-10 h-10 text-cyan-400 animate-spin mx-auto mb-4" />
                <p className="text-gray-400">מייצר תובנות...</p>
              </div>
            ) : error ? (
              <div className="text-center py-8">
                <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-3" />
                <p className="text-gray-400 text-sm">הפעל סריקה לקבלת תובנות</p>
              </div>
            ) : insights.length === 0 && events.length === 0 ? (
              <EmptyState icon={Sparkles} title="אין תובנות חדשות" description="תובנות יופיעו לאחר ניתוח אירועים קרובים" />
            ) : (
              <div className="space-y-4">
                {/* AI General Insights */}
                {insights.length > 0 && (
                  <div className="space-y-3">
                    {insights.map((insight, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-lg bg-gradient-to-r from-cyan-500/10 to-indigo-500/10 border border-cyan-500/20"
                      >
                        <div className="flex items-start gap-2">
                          <Zap className="w-4 h-4 text-cyan-400 mt-0.5 flex-shrink-0" />
                          <p className="text-gray-300 text-sm">{insight}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Quick Stats */}
                {events.length > 0 && (
                  <div className="space-y-3 border-t border-gray-700/50 pt-4">
                    <h3 className="text-gray-400 text-xs font-medium">סיכום אירועים</h3>
                    <div className="grid grid-cols-1 gap-2">
                      <div className="flex items-center justify-between p-2 rounded-lg bg-gray-800/50">
                        <span className="text-gray-400 text-sm">סה"כ אירועים</span>
                        <span className="text-white font-semibold" style={{ fontFamily: "var(--font-mono)" }}>{events.length}</span>
                      </div>
                      <div className="flex items-center justify-between p-2 rounded-lg bg-gray-800/50">
                        <span className="text-gray-400 text-sm">רלוונטיות גבוהה</span>
                        <span className="text-emerald-400 font-semibold" style={{ fontFamily: "var(--font-mono)" }}>
                          {events.filter(e => e.relevance === 'high').length}
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-2 rounded-lg bg-gray-800/50">
                        <span className="text-gray-400 text-sm">תוך שבועיים</span>
                        <span className="text-amber-400 font-semibold" style={{ fontFamily: "var(--font-mono)" }}>
                          {events.filter(e => e.days_until <= 14).length}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Closest event highlight */}
                {events.length > 0 && events[0].days_until <= 30 && (
                  <div className="p-3 rounded-lg bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/20">
                    <p className="text-gray-400 text-xs mb-1">האירוע הקרוב ביותר</p>
                    <p className="text-white font-semibold text-sm">{events[0].name_hebrew}</p>
                    <p className={`text-sm font-medium mt-1 ${getDaysUntilColor(events[0].days_until)}`}>
                      {events[0].days_until === 0
                        ? 'היום!'
                        : events[0].days_until === 1
                        ? 'מחר'
                        : `בעוד ${events[0].days_until} ימים`}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Trends Section - Live data from Trend Radar API */}
      <div className="glass-card">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">רדאר מגמות</h2>
            <p className="text-gray-400 text-sm">טרנדים שזוהו ממספר מקורות בזמן אמת</p>
          </div>
          {trends.length > 0 && (
            <div className="mr-auto flex items-center gap-2">
              <span className="px-2 py-1 rounded-full text-xs bg-red-500/20 text-red-300 border border-red-500/30">
                {trends.filter(t => t.level === 'breakout').length} פורצים
              </span>
              <span className="px-2 py-1 rounded-full text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {trends.filter(t => t.level === 'emerging').length} עולים
              </span>
            </div>
          )}
        </div>

        {trendsLoading ? (
          <div className="text-center py-12">
            <Loader2 className="w-10 h-10 text-cyan-400 animate-spin mx-auto mb-4" />
            <p className="text-gray-400">סורק מגמות...</p>
          </div>
        ) : trends.length === 0 ? (
          <EmptyState icon={TrendingUp} title="לא זוהו מגמות עדיין" description="מגמות יופיעו לאחר סריקת רדאר הטרנדים" />
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {trends.map((trend) => (
                <div
                  key={trend.id}
                  className={`p-4 rounded-xl transition-colors border ${
                    trend.level === 'breakout'
                      ? 'bg-red-500/10 hover:bg-red-500/15 border-red-500/30'
                      : trend.level === 'emerging'
                      ? 'bg-amber-500/10 hover:bg-amber-500/15 border-amber-500/30'
                      : 'bg-gray-800/50 hover:bg-gray-800/70 border-gray-700/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {trend.level === 'breakout' ? (
                        <Flame className="w-4 h-4 text-red-400" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4 text-amber-400" />
                      )}
                      <h3 className="text-white font-semibold text-sm">{trend.keyword}</h3>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      trend.level === 'breakout'
                        ? 'bg-red-500/20 text-red-300'
                        : 'bg-amber-500/20 text-amber-300'
                    }`}>
                      {(trend.change_pct || 0) > 0 ? '+' : ''}{(trend.change_pct || 0).toFixed(0)}%
                    </span>
                  </div>

                  <p className="text-gray-300 text-xs mb-2">{trend.analysis}</p>

                  {trend.action && (
                    <div className="flex items-start gap-1.5 mb-2">
                      <Zap className="w-3 h-3 text-cyan-400 mt-0.5 flex-shrink-0" />
                      <p className="text-cyan-300 text-xs">{trend.action}</p>
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 flex-wrap">
                    {trend.sources.map((src) => (
                      <span key={src} className="px-1.5 py-0.5 rounded text-[10px] bg-gray-700/60 text-gray-400">
                        {src}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Top breakout trend highlight */}
            {trends.some(t => t.level === 'breakout') && (
              <div className="mt-6 p-4 rounded-xl bg-gradient-to-r from-red-500/10 to-cyan-500/10 border border-red-500/20">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center flex-shrink-0">
                    <Flame className="w-6 h-6 text-red-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold mb-1">טרנד פורץ!</h3>
                    <p className="text-gray-300 text-sm">
                      {(() => {
                        const top = trends.find(t => t.level === 'breakout');
                        return top
                          ? `"${top.keyword}" עלה ב-${(top.change_pct || 0).toFixed(0)}% — ${top.analysis || 'הגב מהר לפני המתחרים!'}`
                          : '';
                      })()}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Smart recommendation for emerging trends */}
            {!trends.some(t => t.level === 'breakout') && trends.length > 0 && (
              <div className="mt-6 p-4 rounded-xl bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                    <Zap className="w-6 h-6 text-cyan-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold mb-1">המלצה חכמה</h3>
                    <p className="text-gray-300 text-sm">
                      {`מגמת "${trends[0].keyword}" עולה ב-${(trends[0].change_pct || 0).toFixed(0)}%. שקול לשלב אותה באסטרטגיה השיווקית שלך.`}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
