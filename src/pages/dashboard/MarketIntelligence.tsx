import { useState, useEffect, useCallback } from 'react';
import { useSimulation } from '../../context/SimulationContext';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  Radar, Zap, DollarSign, TrendingDown, TrendingUp, Megaphone, Users,
  AlertTriangle, ExternalLink, Loader2, Target, Eye, Radio, Sparkles,
  Clock, Instagram, Facebook, Globe, Building2, MapPin, AlertCircle,
  CheckCircle2, Flame, Tag, Search, ArrowUpRight, Activity, Shield,
  ChevronLeft, Bell, Star,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { apiFetch } from '../../services/api';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface IntelItem {
  id: string;
  title: string;
  description: string;
  source: string;
  priority: 'high' | 'medium' | 'low';
  competitor_name: string | null;
  action_label: string;
  timestamp: string;
  metadata: string | null;
  is_fresh: boolean;
}

interface IntelligenceFeed {
  opportunities: IntelItem[];
  price_alerts: IntelItem[];
  ad_insights: IntelItem[];
  other_alerts: IntelItem[];
  total_count: number;
}

interface Competitor {
  id: string;
  name: string;
  google_rating: number | null;
  google_reviews_count: number | null;
  perceived_threat_level: string | null;
  created_at: string;
}

interface TimelineEvent {
  id: string;
  title: string;
  description: string;
  event_type: string;
  severity: string;
  source: string;
  created_at: string;
  is_read: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SMALL COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function RadarPulse({ isScanning }: { isScanning: boolean }) {
  return (
    <div className="relative w-20 h-20">
      <div className={`absolute inset-0 rounded-full border-2 border-cyan-500/30 ${isScanning ? 'animate-ping' : ''}`} style={{ animationDuration: '2s' }} />
      <div className={`absolute inset-2 rounded-full border-2 border-cyan-500/40 ${isScanning ? 'animate-ping' : ''}`} style={{ animationDuration: '2.5s' }} />
      <div className={`absolute inset-4 rounded-full border-2 border-cyan-500/50 ${isScanning ? 'animate-pulse' : ''}`} />
      {isScanning && (
        <div
          className="absolute inset-0 rounded-full overflow-hidden animate-spin"
          style={{
            background: 'conic-gradient(from 0deg, transparent 0deg, rgba(6, 182, 212, 0.5) 60deg, transparent 120deg)',
            animationDuration: '2s'
          }}
        />
      )}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br from-red-600 to-orange-600 flex items-center justify-center shadow-lg ${isScanning ? 'animate-pulse' : ''}`}>
          <Shield className="w-5 h-5 text-white" />
        </div>
      </div>
    </div>
  );
}

function FreshBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs border border-emerald-500/30 animate-pulse">
      <Radio className="w-3 h-3" />
      חדש
    </span>
  );
}

function PriorityIndicator({ priority }: { priority: 'high' | 'medium' | 'low' }) {
  const config = {
    high: { color: 'bg-red-500', label: 'דחוף' },
    medium: { color: 'bg-amber-500', label: 'חשוב' },
    low: { color: 'bg-blue-500', label: 'מידע' },
  };
  const { color } = config[priority];
  return <span className={`w-2 h-2 rounded-full ${color} ${priority === 'high' ? 'animate-pulse' : ''}`} />;
}

function SourceIcon({ source }: { source: string }) {
  const lower = source.toLowerCase();
  if (lower.includes('instagram')) return <Instagram className="w-4 h-4 text-pink-400" />;
  if (lower.includes('facebook')) return <Facebook className="w-4 h-4 text-blue-400" />;
  if (lower.includes('google') || lower.includes('maps')) return <MapPin className="w-4 h-4 text-emerald-400" />;
  if (lower.includes('madlan')) return <Building2 className="w-4 h-4 text-amber-400" />;
  if (lower.includes('ad')) return <Megaphone className="w-4 h-4 text-cyan-400" />;
  if (lower.includes('price')) return <DollarSign className="w-4 h-4 text-emerald-400" />;
  return <Globe className="w-4 h-4 text-gray-400" />;
}

// ═══════════════════════════════════════════════════════════════════════════════
// INTEL CARD COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function IntelCard({ item, borderColor, iconBg, icon: Icon, actionPath, actionText }: {
  item: IntelItem;
  borderColor: string;
  iconBg: string;
  icon: typeof Users;
  actionPath: string;
  actionText: string;
}) {
  const navigate = useNavigate();
  return (
    <div className={`glass-card p-4 border-r-4 ${borderColor} hover:bg-gray-800/50 transition-all cursor-pointer group`}
      onClick={() => navigate(actionPath)}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center`}>
            <Icon className="w-4 h-4" />
          </div>
          {item.is_fresh && <FreshBadge />}
        </div>
        <PriorityIndicator priority={item.priority} />
      </div>
      <h4 className="font-semibold text-white text-sm mb-1 group-hover:text-cyan-300 transition-colors">{item.title}</h4>
      {item.competitor_name && (
        <span className="inline-block px-2 py-0.5 rounded bg-gray-800 text-gray-300 text-xs mb-2">{item.competitor_name}</span>
      )}
      <p className="text-gray-400 text-xs mb-3 line-clamp-2">{item.description}</p>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <SourceIcon source={item.source} />
          <span>{item.source}</span>
        </div>
        <span className="flex items-center gap-1 text-cyan-400 text-xs group-hover:text-cyan-300 transition-colors">
          {actionText}
          <ArrowUpRight className="w-3 h-3" />
        </span>
      </div>
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="glass-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gray-700/50 animate-pulse" />
          <div className="w-16 h-4 rounded bg-gray-700/50 animate-pulse" />
        </div>
        <div className="w-4 h-4 rounded-full bg-gray-700/50 animate-pulse" />
      </div>
      <div className="w-3/4 h-4 rounded bg-gray-700/50 animate-pulse" />
      <div className="w-full h-3 rounded bg-gray-700/50 animate-pulse" />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function MarketIntelligence() {
  const { currentProfile } = useSimulation();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [feed, setFeed] = useState<IntelligenceFeed | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'opportunities' | 'prices' | 'ads'>('all');

  // Safety timeout
  useEffect(() => {
    const timeout = setTimeout(() => setLoading(false), 10000);
    return () => clearTimeout(timeout);
  }, []);

  // Fetch intelligence feed + history
  const fetchFeed = useCallback(async () => {
    if (!currentProfile?.id || !user?.id) { setLoading(false); return; }

    try {
      setLoading(true);
      const [feedRes, historyRes] = await Promise.allSettled([
        apiFetch(`/intelligence/feed/${currentProfile.id}?limit=30`),
        apiFetch(`/intelligence/history/business/${user.id}?days=30`),
      ]);

      if (feedRes.status === 'fulfilled' && feedRes.value.ok) {
        const data = await feedRes.value.json();
        setFeed(data);
        setError(null);
      } else {
        throw new Error('טעינת מודיעין השוק נכשלה');
      }

      if (historyRes.status === 'fulfilled' && historyRes.value.ok) {
        const data = await historyRes.value.json();
        setTimeline(data.timeline || []);
        setCompetitors(data.competitors || []);
      }
    } catch {
      toast.error('שגיאה בטעינת מודיעין שוק');
      setError('טעינת מודיעין השוק נכשלה');
    } finally {
      setLoading(false);
    }
  }, [currentProfile?.id, user?.id]);

  const triggerScan = async () => {
    if (!currentProfile?.id || scanning) return;
    setScanning(true);
    try {
      await apiFetch(`/intelligence/scan/${currentProfile.id}`, { method: 'POST' });
      setTimeout(async () => {
        await fetchFeed();
        setScanning(false);
        toast.success('סריקה הושלמה');
      }, 8000);
    } catch {
      toast.error('שגיאה בסריקה');
      setScanning(false);
    }
  };

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  // Urgent alerts (high priority, unread)
  const allItems = [
    ...(feed?.opportunities || []),
    ...(feed?.price_alerts || []),
    ...(feed?.ad_insights || []),
    ...(feed?.other_alerts || []),
  ];
  const urgentAlerts = allItems.filter(i => i.priority === 'high' && i.is_fresh);

  const totals = {
    opportunities: feed?.opportunities?.length || 0,
    prices: feed?.price_alerts?.length || 0,
    ads: feed?.ad_insights?.length || 0,
    all: feed?.total_count || 0,
  };

  const highThreatCompetitors = competitors.filter(c =>
    (c.perceived_threat_level || '').toLowerCase() === 'high'
  );

  // ═══════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════════

  return (
    <div className="space-y-6 fade-in" dir="rtl">
      {/* Header */}
      <header className="glass-card p-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-5">
            <RadarPulse isScanning={scanning} />
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                מי מאיים עליי?
                {scanning && (
                  <span className="text-sm font-normal text-cyan-400 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    סורק...
                  </span>
                )}
              </h1>
              <p className="text-gray-400 mt-1">
                מעקב איומים • מתחרים • הזדמנויות • התראות בזמן אמת
              </p>
            </div>
          </div>

          <button
            onClick={triggerScan}
            disabled={scanning}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all ${
              scanning
                ? 'bg-gray-600/50 text-gray-300 cursor-wait'
                : 'bg-gradient-to-r from-red-600 to-orange-600 text-white hover:shadow-lg hover:shadow-red-500/30'
            }`}
          >
            {scanning ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>סורק שוק...</span>
              </>
            ) : (
              <>
                <Radar className="w-5 h-5" />
                <span>סריקה מלאה</span>
              </>
            )}
          </button>
        </div>

        {/* Stats Bar */}
        <div className="mt-6 pt-6 border-t border-gray-700/50 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { key: 'all' as const, icon: Activity, label: 'כל ההתראות', count: totals.all, activeColor: 'cyan' },
            { key: 'opportunities' as const, icon: Users, label: 'הזדמנויות', count: totals.opportunities, activeColor: 'emerald' },
            { key: 'prices' as const, icon: Tag, label: 'התראות מחיר', count: totals.prices, activeColor: 'amber' },
            { key: 'ads' as const, icon: Megaphone, label: 'תובנות פרסום', count: totals.ads, activeColor: 'cyan' },
          ].map(({ key, icon: TabIcon, label, count, activeColor }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`p-3 rounded-xl border transition-all ${
                activeTab === key
                  ? `bg-${activeColor}-500/20 border-${activeColor}-500/50`
                  : 'bg-gray-800/30 border-gray-700/50 hover:border-gray-600'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <TabIcon className={`w-4 h-4 ${activeTab === key ? `text-${activeColor}-400` : 'text-gray-500'}`} />
                <span className={`text-xl font-bold ${activeTab === key ? `text-${activeColor}-400` : 'text-white'}`}>
                  {count}
                </span>
              </div>
              <span className="text-xs text-gray-400">{label}</span>
            </button>
          ))}
        </div>
      </header>

      {/* ═══ URGENT ALERTS BANNER ═══ */}
      {urgentAlerts.length > 0 && !loading && (
        <section className="glass-card p-4 border border-red-500/30 bg-red-500/5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center">
              <Bell className="w-4 h-4 text-red-400 animate-pulse" />
            </div>
            <h2 className="text-white font-semibold">
              {urgentAlerts.length} התראות דחופות
            </h2>
          </div>
          <div className="space-y-2">
            {urgentAlerts.slice(0, 3).map(alert => (
              <div key={alert.id} className="flex items-start gap-3 p-3 rounded-lg bg-red-500/5 border border-red-500/20">
                <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <h4 className="text-white text-sm font-medium">{alert.title}</h4>
                  <p className="text-gray-400 text-xs line-clamp-1">{alert.description}</p>
                </div>
                <span className="text-xs text-gray-500 flex-shrink-0">
                  {alert.source}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ═══ HIGH-THREAT COMPETITORS ═══ */}
      {highThreatCompetitors.length > 0 && !loading && (
        <section className="glass-card p-4 border border-orange-500/30 bg-orange-500/5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center">
                <Shield className="w-4 h-4 text-orange-400" />
              </div>
              <h2 className="text-white font-semibold">
                {highThreatCompetitors.length} מתחרים מסוכנים
              </h2>
            </div>
            <button
              onClick={() => navigate('/dashboard/landscape')}
              className="text-cyan-400 text-sm flex items-center gap-1 hover:text-cyan-300"
            >
              נוף מלא
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {highThreatCompetitors.map(comp => (
              <div key={comp.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800/50 border border-orange-500/20">
                <Flame className="w-3 h-3 text-orange-400" />
                <span className="text-white text-sm">{comp.name}</span>
                {comp.google_rating && (
                  <span className="text-xs text-gray-500 flex items-center gap-0.5">
                    <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                    {comp.google_rating.toFixed(1)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Loading State */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => <CardSkeleton key={i} />)}
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="glass-card p-8 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">טעינת המודיעין נכשלה</h3>
          <p className="text-gray-400 mb-4">{error}</p>
          <button onClick={fetchFeed} className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-500 transition-colors">
            נסה שוב
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && feed?.total_count === 0 && (
        <div className="glass-card p-12 text-center">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-red-500/20 to-orange-500/20 flex items-center justify-center mx-auto mb-6">
            <Radar className="w-10 h-10 text-red-400" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">אין מודיעין עדיין</h3>
          <p className="text-gray-400 mb-6 max-w-md mx-auto">
            הפעל סריקת שוק מלאה כדי לגלות איומים, הזדמנויות ופעילות מתחרים באזור שלך.
          </p>
          <button
            onClick={triggerScan}
            disabled={scanning}
            className="px-6 py-3 bg-gradient-to-r from-red-600 to-orange-600 text-white rounded-xl font-medium hover:shadow-lg hover:shadow-red-500/30 transition-all"
          >
            <Radar className="w-5 h-5 inline ml-2" />
            התחל סריקה ראשונה
          </button>
        </div>
      )}

      {/* Feed Content */}
      {!loading && !error && feed && feed.total_count > 0 && (
        <div className="space-y-6">
          {/* Opportunities */}
          {(activeTab === 'all' || activeTab === 'opportunities') && (feed.opportunities || []).length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                <Users className="w-5 h-5 text-emerald-400" />
                הזדמנויות חיות
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs">
                  {(feed.opportunities || []).length}
                </span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(feed.opportunities || []).map(item => (
                  <IntelCard
                    key={item.id} item={item}
                    borderColor="border-emerald-500" iconBg="bg-emerald-500/20"
                    icon={Users} actionPath="/dashboard/sniper" actionText="תפוס ליד"
                  />
                ))}
              </div>
            </section>
          )}

          {/* Price Alerts */}
          {(activeTab === 'all' || activeTab === 'prices') && (feed.price_alerts || []).length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                <Tag className="w-5 h-5 text-amber-400" />
                התראות מחיר
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-xs">
                  {(feed.price_alerts || []).length}
                </span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(feed.price_alerts || []).map(item => (
                  <IntelCard
                    key={item.id} item={item}
                    borderColor="border-amber-500" iconBg="bg-amber-500/20"
                    icon={Tag} actionPath="/dashboard/landscape" actionText="נתח השפעה"
                  />
                ))}
              </div>
            </section>
          )}

          {/* Ad Insights */}
          {(activeTab === 'all' || activeTab === 'ads') && (feed.ad_insights || []).length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                <Megaphone className="w-5 h-5 text-cyan-400" />
                תובנות פרסום
                <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 text-xs">
                  {(feed.ad_insights || []).length}
                </span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(feed.ad_insights || []).map(item => (
                  <IntelCard
                    key={item.id} item={item}
                    borderColor="border-cyan-500" iconBg="bg-cyan-500/20"
                    icon={Megaphone} actionPath="/dashboard/landscape" actionText="צפה בפרטים"
                  />
                ))}
              </div>
            </section>
          )}

          {/* Other Alerts */}
          {activeTab === 'all' && (feed.other_alerts || []).length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                <Zap className="w-5 h-5 text-gray-400" />
                התראות נוספות
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(feed.other_alerts || []).map(item => (
                  <div key={item.id} className="glass-card p-4 border-r-4 border-gray-500">
                    <h4 className="font-medium text-white text-sm mb-1">{item.title}</h4>
                    <p className="text-gray-400 text-xs">{item.description}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* ═══ ACTIVITY TIMELINE ═══ */}
      {timeline.length > 0 && !loading && (
        <section className="glass-card">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center">
              <Clock className="w-5 h-5 text-violet-400" />
            </div>
            <h2 className="text-lg font-semibold text-white">ציר זמן — אירועים אחרונים</h2>
          </div>

          <div className="relative pr-6">
            {/* Vertical line */}
            <div className="absolute right-2 top-0 bottom-0 w-px bg-gray-700/50" />

            <div className="space-y-4">
              {timeline.slice(0, 10).map((event, idx) => {
                const severityColor = event.severity === 'high' || event.severity === 'critical'
                  ? 'bg-red-500'
                  : event.severity === 'medium'
                    ? 'bg-amber-500'
                    : 'bg-cyan-500';

                return (
                  <div key={event.id} className="relative flex items-start gap-3">
                    {/* Dot on timeline */}
                    <div className={`absolute -right-[13px] top-1.5 w-3 h-3 rounded-full ${severityColor} ring-2 ring-gray-900`} />

                    <div className="flex-1 p-3 rounded-lg bg-gray-800/30 hover:bg-gray-800/50 transition-colors">
                      <div className="flex items-start justify-between">
                        <h4 className="text-white text-sm font-medium">{event.title}</h4>
                        <span className="text-xs text-gray-500 flex-shrink-0">
                          {new Date(event.created_at).toLocaleDateString('he-IL')}
                        </span>
                      </div>
                      {event.description && (
                        <p className="text-gray-400 text-xs mt-1 line-clamp-2">{event.description}</p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-gray-600">{event.event_type}</span>
                        {!event.is_read && (
                          <span className="px-1.5 py-0.5 rounded text-xs bg-cyan-500/20 text-cyan-400">חדש</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
