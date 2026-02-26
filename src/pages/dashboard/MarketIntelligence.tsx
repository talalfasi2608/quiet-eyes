import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSimulation } from '../../context/SimulationContext';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  Radar, Zap, DollarSign, Megaphone, Users,
  AlertTriangle, Loader2, Eye, Radio,
  Instagram, Facebook, Globe, Building2, MapPin, AlertCircle,
  CheckCircle2, Flame, Tag, ArrowUpRight, Activity, Shield,
  ChevronLeft,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { apiFetch } from '../../services/api';
import EmptyState from '../../components/ui/EmptyState';
import PageLoader from '../../components/ui/PageLoader';

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
// HELPERS — card props per feed category
// ═══════════════════════════════════════════════════════════════════════════════

function cardPropsForCategory(category: string) {
  switch (category) {
    case 'opportunities':
      return { borderColor: 'border-emerald-500', iconBg: 'bg-emerald-500/20', icon: Users, actionPath: '/dashboard/sniper', actionText: 'תפוס ליד' };
    case 'price_alerts':
      return { borderColor: 'border-amber-500', iconBg: 'bg-amber-500/20', icon: Tag, actionPath: '/dashboard/landscape', actionText: 'נתח השפעה' };
    case 'ad_insights':
      return { borderColor: 'border-cyan-500', iconBg: 'bg-cyan-500/20', icon: Megaphone, actionPath: '/dashboard/landscape', actionText: 'צפה בפרטים' };
    case 'other_alerts':
    default:
      return { borderColor: 'border-gray-500', iconBg: 'bg-gray-500/20', icon: Zap, actionPath: '/dashboard/landscape', actionText: 'פרטים' };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function MarketIntelligence() {
  const { currentProfile } = useSimulation();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [feed, setFeed] = useState<IntelligenceFeed | null>(null);
  const [_timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  // ═══════════════════════════════════════════════════════════════════════════
  // Sort ALL items from all categories into 3 severity columns
  // ═══════════════════════════════════════════════════════════════════════════

  const { urgentItems, importantItems, monitoringItems } = useMemo(() => {
    const tagged: { item: IntelItem; category: string }[] = [
      ...(feed?.opportunities || []).map(i => ({ item: i, category: 'opportunities' })),
      ...(feed?.price_alerts || []).map(i => ({ item: i, category: 'price_alerts' })),
      ...(feed?.ad_insights || []).map(i => ({ item: i, category: 'ad_insights' })),
      ...(feed?.other_alerts || []).map(i => ({ item: i, category: 'other_alerts' })),
    ];

    return {
      urgentItems: tagged.filter(t => t.item.priority === 'high'),
      importantItems: tagged.filter(t => t.item.priority === 'medium'),
      monitoringItems: tagged.filter(t => t.item.priority === 'low'),
    };
  }, [feed]);

  const totals = {
    all: feed?.total_count || 0,
    urgent: urgentItems.length,
    important: importantItems.length,
    monitoring: monitoringItems.length,
  };

  const highThreatCompetitors = competitors.filter(c =>
    (c.perceived_threat_level || '').toLowerCase() === 'high'
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER — Loading / Error / Empty states
  // ═══════════════════════════════════════════════════════════════════════════

  if (loading) {
    return (
      <div dir="rtl" style={{ height: 'calc(100vh - 60px)', overflow: 'hidden' }}>
        <PageLoader message="טוען מודיעין שוק..." />
      </div>
    );
  }

  if (error && !feed) {
    return (
      <div dir="rtl" style={{ height: 'calc(100vh - 60px)', overflow: 'hidden' }} className="flex items-center justify-center">
        <EmptyState
          icon={AlertTriangle}
          iconColor="text-red-400"
          title="טעינת המודיעין נכשלה"
          description={error}
          actionLabel="נסה שוב"
          onAction={fetchFeed}
          actionIcon={Radar}
        />
      </div>
    );
  }

  if (!feed || feed.total_count === 0) {
    return (
      <div dir="rtl" style={{ height: 'calc(100vh - 60px)', overflow: 'hidden' }} className="flex items-center justify-center">
        <EmptyState
          icon={Radar}
          iconColor="text-red-400"
          title="אין מודיעין עדיין"
          description="הפעל סריקת שוק מלאה כדי לגלות איומים, הזדמנויות ופעילות מתחרים באזור שלך."
          actionLabel="התחל סריקה ראשונה"
          onAction={triggerScan}
          actionIcon={Radar}
        />
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER — Main 3-column severity layout (single screen, no page scroll)
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div
      dir="rtl"
      className="fade-in"
      style={{
        display: 'grid',
        height: 'calc(100vh - 60px)',
        overflow: 'hidden',
        gridTemplateAreas: `
          "header header header"
          "urgent important monitoring"
        `,
        gridTemplateRows: '46px 1fr',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: 0,
      }}
    >
      {/* ══════════════════════════════════════════════════════════════════════
          HEADER ROW (46px compact)
         ══════════════════════════════════════════════════════════════════════ */}
      <header
        style={{ gridArea: 'header' }}
        className="flex items-center justify-between px-4 bg-gray-900/80 backdrop-blur border-b border-gray-700/50"
      >
        {/* Right side: radar icon + title + scanning indicator + competitors banner */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-600 to-orange-600 flex items-center justify-center shadow-md flex-shrink-0">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <h1 className="text-lg font-bold text-white whitespace-nowrap">מי מאיים עליי?</h1>
          {scanning && (
            <span className="text-xs font-normal text-cyan-400 flex items-center gap-1 flex-shrink-0">
              <Loader2 className="w-3 h-3 animate-spin" />
              סורק...
            </span>
          )}

          {/* High-threat competitors compact banner (1 line) */}
          {highThreatCompetitors.length > 0 && (
            <div className="flex items-center gap-2 mr-4 px-3 py-1 rounded-lg bg-orange-500/10 border border-orange-500/20 min-w-0">
              <Flame className="w-3 h-3 text-orange-400 flex-shrink-0" />
              <span className="text-xs text-orange-300 whitespace-nowrap truncate">
                {highThreatCompetitors.length} מתחרים מסוכנים: {highThreatCompetitors.map(c => c.name).join(', ')}
              </span>
              <button
                onClick={() => navigate('/dashboard/landscape')}
                className="text-cyan-400 text-xs flex items-center hover:text-cyan-300 flex-shrink-0"
              >
                <ChevronLeft className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {/* Left side: stat badges + scan button */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Stat badges inline */}
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/15 border border-red-500/30 text-xs text-red-400">
              <AlertTriangle className="w-3 h-3" />
              {totals.urgent}
            </span>
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-xs text-amber-400">
              <AlertCircle className="w-3 h-3" />
              {totals.important}
            </span>
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-xs text-blue-400">
              <Eye className="w-3 h-3" />
              {totals.monitoring}
            </span>
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-500/15 border border-gray-500/30 text-xs text-gray-400">
              <Activity className="w-3 h-3" />
              {totals.all}
            </span>
          </div>

          {/* Scan button */}
          <button
            onClick={triggerScan}
            disabled={scanning}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              scanning
                ? 'bg-gray-600/50 text-gray-300 cursor-wait'
                : 'bg-gradient-to-r from-red-600 to-orange-600 text-white hover:shadow-lg hover:shadow-red-500/30'
            }`}
          >
            {scanning ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                סורק...
              </>
            ) : (
              <>
                <Radar className="w-4 h-4" />
                סריקה מלאה
              </>
            )}
          </button>
        </div>
      </header>

      {/* ══════════════════════════════════════════════════════════════════════
          COLUMN 1 — URGENT (red)
         ══════════════════════════════════════════════════════════════════════ */}
      <div
        style={{ gridArea: 'urgent' }}
        className="flex flex-col min-h-0 border-l border-gray-700/30"
      >
        {/* Column header strip */}
        <div className="flex items-center justify-between px-3 py-2 bg-red-500/10 border-b-2 border-red-500/60 flex-shrink-0">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <span className="text-sm font-bold text-red-400">דחוף</span>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-xs font-semibold">
            {totals.urgent}
          </span>
        </div>

        {/* Column body — ONLY scrollable area */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {urgentItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
              <CheckCircle2 className="w-8 h-8 mb-2 text-gray-600" />
              <span className="text-sm">אין התראות דחופות</span>
            </div>
          ) : (
            urgentItems.map(({ item, category }) => {
              const props = cardPropsForCategory(category);
              return (
                <IntelCard
                  key={item.id}
                  item={item}
                  borderColor={props.borderColor}
                  iconBg={props.iconBg}
                  icon={props.icon}
                  actionPath={props.actionPath}
                  actionText={props.actionText}
                />
              );
            })
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          COLUMN 2 — IMPORTANT (amber)
         ══════════════════════════════════════════════════════════════════════ */}
      <div
        style={{ gridArea: 'important' }}
        className="flex flex-col min-h-0 border-l border-gray-700/30"
      >
        {/* Column header strip */}
        <div className="flex items-center justify-between px-3 py-2 bg-amber-500/10 border-b-2 border-amber-500/60 flex-shrink-0">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-bold text-amber-400">חשוב</span>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-xs font-semibold">
            {totals.important}
          </span>
        </div>

        {/* Column body — ONLY scrollable area */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {importantItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
              <CheckCircle2 className="w-8 h-8 mb-2 text-gray-600" />
              <span className="text-sm">אין פריטים חשובים</span>
            </div>
          ) : (
            importantItems.map(({ item, category }) => {
              const props = cardPropsForCategory(category);
              return (
                <IntelCard
                  key={item.id}
                  item={item}
                  borderColor={props.borderColor}
                  iconBg={props.iconBg}
                  icon={props.icon}
                  actionPath={props.actionPath}
                  actionText={props.actionText}
                />
              );
            })
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          COLUMN 3 — MONITORING (blue/gray)
         ══════════════════════════════════════════════════════════════════════ */}
      <div
        style={{ gridArea: 'monitoring' }}
        className="flex flex-col min-h-0"
      >
        {/* Column header strip */}
        <div className="flex items-center justify-between px-3 py-2 bg-blue-500/10 border-b-2 border-blue-500/60 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-bold text-blue-400">מעקב</span>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-xs font-semibold">
            {totals.monitoring}
          </span>
        </div>

        {/* Column body — ONLY scrollable area */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {monitoringItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
              <CheckCircle2 className="w-8 h-8 mb-2 text-gray-600" />
              <span className="text-sm">אין פריטים למעקב</span>
            </div>
          ) : (
            monitoringItems.map(({ item, category }) => {
              const props = cardPropsForCategory(category);
              return (
                <IntelCard
                  key={item.id}
                  item={item}
                  borderColor={props.borderColor}
                  iconBg={props.iconBg}
                  icon={props.icon}
                  actionPath={props.actionPath}
                  actionText={props.actionText}
                />
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
