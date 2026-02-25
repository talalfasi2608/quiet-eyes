import { useState, useEffect, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useSimulation } from '../../context/SimulationContext';
import { useAuth } from '../../context/AuthContext';
import { useLiveMarketData } from '../../hooks/useLiveMarketData';
import { loadGoogleMaps } from '../../lib/googleMaps';
import {
  Radar,
  Target,
  Zap,
  AlertTriangle,
  TrendingUp,
  Crown,
  DollarSign,
  Users,
  Globe,
  MapPin,
  RefreshCw,
  Loader2,
  Building2,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  ArrowUpRight,
  MessageSquare,
  Instagram,
  Facebook,
  Star,
  Activity,
  Clock,
  TrendingDown,
  Minus,
  BarChart3,
  Wrench,
  Lightbulb,
  ChevronRight,
  Bell,
  BellDot,
  Flame,
  Crosshair,
  Megaphone,
} from 'lucide-react';
import CompetitorDrawer from '../../components/ui/CompetitorDrawer';
import DailyBriefing from '../../components/cockpit/DailyBriefing';
import PredictionCard from '../../components/cockpit/PredictionCard';
import ROITracker from '../../components/cockpit/ROITracker';
import ScannerLoader from '../../components/ui/ScannerLoader';
import { apiFetch } from '../../services/api';

// ═══════════════════════════════════════════════════════════════════════════════
// INTELLIGENCE TIMELINE
// ═══════════════════════════════════════════════════════════════════════════════

interface IntelEvent {
  id: number;
  business_id: string;
  event_type: string;
  title: string;
  description: string | null;
  severity: string;
  source: string | null;
  metadata: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string;
}

const EVENT_CONFIG: Record<string, { icon: typeof Bell; color: string; bg: string }> = {
  lead_found: { icon: Target, color: 'text-emerald-400', bg: 'bg-emerald-500/15' },
  competitor_change: { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/15' },
  price_alert: { icon: DollarSign, color: 'text-red-400', bg: 'bg-red-500/15' },
  scan_completed: { icon: Radar, color: 'text-blue-400', bg: 'bg-blue-500/15' },
  blueprint_matched: { icon: Sparkles, color: 'text-cyan-400', bg: 'bg-cyan-500/15' },
  feedback_received: { icon: CheckCircle2, color: 'text-teal-400', bg: 'bg-teal-500/15' },
  radar_alert: { icon: Zap, color: 'text-orange-400', bg: 'bg-orange-500/15' },
};

function IntelligenceTimeline({ businessId }: { businessId: string }) {
  const [events, setEvents] = useState<IntelEvent[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!businessId) return;
    Promise.all([
      apiFetch(`/intelligence/${businessId}/events?limit=8`).then(r => r.json()),
      apiFetch(`/intelligence/${businessId}/events/unread-count`).then(r => r.json()),
    ]).then(([eventsData, countData]) => {
      setEvents(eventsData.events || []);
      setUnreadCount(countData.unread_count || 0);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [businessId]);

  const markAllRead = async () => {
    await apiFetch(`/intelligence/${businessId}/events/mark-all-read`, { method: 'POST' });
    setUnreadCount(0);
    setEvents(prev => prev.map(e => ({ ...e, is_read: true })));
  };

  if (loading) return null;
  if (events.length === 0) return null;

  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          {unreadCount > 0 ? <BellDot className="w-4 h-4 text-red-400" /> : <Bell className="w-4 h-4 text-gray-400" />}
          מודיעין אחרון
          {unreadCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-xs">{unreadCount}</span>
          )}
        </h3>
        {unreadCount > 0 && (
          <button onClick={markAllRead} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
            סמן הכל כנקרא
          </button>
        )}
      </div>
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {events.map((ev) => {
          const cfg = EVENT_CONFIG[ev.event_type] || { icon: Bell, color: 'text-gray-400', bg: 'bg-gray-500/15' };
          const Icon = cfg.icon;
          const timeStr = new Date(ev.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
          return (
            <div key={ev.id} className={`flex items-start gap-3 p-2 rounded-lg transition-colors ${!ev.is_read ? 'bg-gray-800/40' : ''}`}>
              <div className={`w-7 h-7 rounded-lg ${cfg.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-xs leading-relaxed ${!ev.is_read ? 'text-white font-medium' : 'text-gray-400'}`}>
                  {ev.title}
                </p>
                {ev.description && (
                  <p className="text-[10px] text-gray-500 mt-0.5 truncate">{ev.description}</p>
                )}
              </div>
              <span className="text-[10px] text-gray-600 flex-shrink-0">{timeStr}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// HOT AUDIENCES CARD
// ═══════════════════════════════════════════════════════════════════════════════

interface AudienceOpportunity {
  id: string;
  title: string;
  audience_description: string;
  suggested_ad_message: string;
  platform: string;
  targeting_keywords: string[];
  intent_level: string;
  urgency: string;
  estimated_size: string;
  demographics: string;
  confidence_score: number;
  created_at: string;
}

const PLATFORM_CONFIG: Record<string, { icon: typeof Facebook; color: string; bg: string; label: string }> = {
  facebook: { icon: Facebook, color: 'text-blue-400', bg: 'bg-blue-500/15', label: 'פייסבוק' },
  instagram: { icon: Instagram, color: 'text-pink-400', bg: 'bg-pink-500/15', label: 'אינסטגרם' },
  google: { icon: Globe, color: 'text-emerald-400', bg: 'bg-emerald-500/15', label: 'גוגל' },
};

const URGENCY_CONFIG: Record<string, { color: string; bg: string; border: string; label: string }> = {
  hot: { color: 'text-red-400', bg: 'bg-red-500/15', border: 'border-red-500/30', label: 'חם מאוד' },
  critical: { color: 'text-red-400', bg: 'bg-red-500/15', border: 'border-red-500/30', label: 'חם מאוד' },
  warm: { color: 'text-amber-400', bg: 'bg-amber-500/15', border: 'border-amber-500/30', label: 'חם' },
  high: { color: 'text-amber-400', bg: 'bg-amber-500/15', border: 'border-amber-500/30', label: 'חם' },
  mild: { color: 'text-blue-400', bg: 'bg-blue-500/15', border: 'border-blue-500/30', label: 'פושר' },
  medium: { color: 'text-blue-400', bg: 'bg-blue-500/15', border: 'border-blue-500/30', label: 'פושר' },
};

function HotAudiencesCard({ businessId }: { businessId: string }) {
  const [opportunities, setOpportunities] = useState<AudienceOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!businessId) return;
    apiFetch(`/audience/current-opportunities/${businessId}?limit=5`)
      .then(r => r.json())
      .then(data => setOpportunities(data.opportunities || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [businessId]);

  if (loading) return null;
  if (opportunities.length === 0) return null;

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Crosshair className="w-4 h-4 text-red-400" />
          קהלים חמים עכשיו
          <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-xs">
            {opportunities.length}
          </span>
        </h3>
        <span className="text-[10px] text-gray-500">אנשים שמחפשים עכשיו</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
        {opportunities.map((opp) => {
          const platform = PLATFORM_CONFIG[opp.platform] || PLATFORM_CONFIG.google;
          const urgency = URGENCY_CONFIG[opp.urgency] || URGENCY_CONFIG.mild;
          const PlatformIcon = platform.icon;
          const isExpanded = expanded === opp.id;

          return (
            <div
              key={opp.id}
              onClick={() => setExpanded(isExpanded ? null : opp.id)}
              className={`p-3 rounded-xl border transition-all cursor-pointer ${
                opp.urgency === 'hot' || opp.urgency === 'critical'
                  ? 'bg-red-500/5 border-red-500/30 hover:bg-red-500/10'
                  : 'bg-gray-800/40 border-gray-700/40 hover:bg-gray-800/60'
              }`}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-2">
                <div className={`w-7 h-7 rounded-lg ${platform.bg} flex items-center justify-center`}>
                  <PlatformIcon className={`w-3.5 h-3.5 ${platform.color}`} />
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${urgency.bg} ${urgency.color} ${urgency.border}`}>
                  {urgency.label}
                </span>
              </div>

              {/* Description */}
              <p className={`text-xs text-gray-200 mb-2 leading-relaxed ${isExpanded ? '' : 'line-clamp-2'}`}>
                {opp.audience_description}
              </p>

              {/* Keywords */}
              <div className="flex flex-wrap gap-1 mb-2">
                {(opp.targeting_keywords || []).slice(0, 3).map((kw, i) => (
                  <span key={i} className="px-1.5 py-0.5 rounded text-[10px] bg-gray-700/60 text-gray-400">
                    {kw}
                  </span>
                ))}
              </div>

              {/* Expanded: Ad suggestion */}
              {isExpanded && opp.suggested_ad_message && (
                <div className="mt-2 pt-2 border-t border-gray-700/40">
                  <div className="flex items-start gap-1.5">
                    <Megaphone className="w-3 h-3 text-cyan-400 mt-0.5 flex-shrink-0" />
                    <p className="text-[11px] text-cyan-300 leading-relaxed">{opp.suggested_ad_message}</p>
                  </div>
                  {opp.demographics && (
                    <p className="text-[10px] text-gray-500 mt-1.5 flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {opp.demographics}
                    </p>
                  )}
                </div>
              )}

              {/* Bottom bar */}
              <div className="flex items-center justify-between mt-2 pt-1.5">
                <span className="text-[10px] text-gray-500">{platform.label}</span>
                {(opp.urgency === 'hot' || opp.urgency === 'critical') && (
                  <Flame className="w-3 h-3 text-red-400" />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

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
  website: string | null;
  latitude: number | null;
  longitude: number | null;
  price_tier: string;
  services: string[];
  usp: string;
  weaknesses: Weakness[];
  tone: string;
  market_health_score: number;
  summary: string;
}

interface Competitor {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  google_rating: number;
  google_reviews_count: number;
  trust_score: number;
  is_top: boolean;
  threat_level: 'high' | 'medium' | 'low';
  website: string | null;
  phone: string | null;
  price_level: number | null;
  last_scanned: string | null;
}

interface StrategyFeedItem {
  id: string;
  type: string;
  title: string;
  description: string;
  source: string;
  source_url: string | null;
  priority: 'high' | 'medium' | 'low';
  action_label: string;
  timestamp: string;
  competitor_name: string | null;
}

interface MarketStats {
  total_competitors: number;
  top_competitors: number;
  high_threat_competitors: number;
  avg_market_rating: number;
  your_rating: number;
  rating_difference: number | null;
  avg_competitor_reviews: number;
  total_competitor_reviews: number;
  market_saturation: 'high' | 'medium' | 'low';
  competitive_advantage: 'above' | 'below' | 'equal';
}

interface DashboardData {
  business_info: BusinessInfo;
  competitors: Competitor[];
  strategy_feed: StrategyFeedItem[];
  market_stats: MarketStats;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SKELETON COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function SkeletonPulse({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-gray-700/50 rounded ${className}`} />
  );
}

function StatusBarSkeleton() {
  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <SkeletonPulse className="w-12 h-12 rounded-xl" />
          <div className="space-y-2">
            <SkeletonPulse className="w-40 h-6" />
            <div className="flex gap-2">
              <SkeletonPulse className="w-24 h-4" />
              <SkeletonPulse className="w-16 h-4 rounded" />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <SkeletonPulse className="w-24 h-9 rounded-lg" />
          <SkeletonPulse className="w-28 h-28 rounded-full" />
        </div>
      </div>
    </div>
  );
}

function KPIRowSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="glass-card p-4 border-t-2 border-t-gray-700/50">
          <div className="flex items-center justify-between mb-3">
            <SkeletonPulse className="w-8 h-8 rounded" />
            <SkeletonPulse className="w-12 h-3" />
          </div>
          <SkeletonPulse className="w-20 h-8 mb-2" />
          <SkeletonPulse className="w-16 h-3" />
        </div>
      ))}
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="glass-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <SkeletonPulse className="w-32 h-5" />
        <SkeletonPulse className="w-8 h-8 rounded" />
      </div>
      <div className="space-y-3">
        <SkeletonPulse className="w-full h-16 rounded-lg" />
        <SkeletonPulse className="w-full h-16 rounded-lg" />
        <SkeletonPulse className="w-3/4 h-16 rounded-lg" />
      </div>
    </div>
  );
}

function MapSkeleton() {
  return (
    <div className="glass-card p-4 h-[500px]">
      <div className="h-full rounded-xl bg-gray-800/50 flex items-center justify-center">
        <ScannerLoader size="lg" message="טוען את הרדאר..." />
      </div>
    </div>
  );
}

function FeedSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="glass-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <SkeletonPulse className="w-24 h-5 rounded-full" />
            <SkeletonPulse className="w-16 h-4" />
          </div>
          <SkeletonPulse className="w-full h-4" />
          <SkeletonPulse className="w-3/4 h-4" />
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MINI SPARKLINE
// ═══════════════════════════════════════════════════════════════════════════════

function MiniSparkline({ values, color = '#00d4ff', width = 64, height = 28 }: { values: number[]; color?: string; width?: number; height?: number }) {
  if (values.length < 2) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = height - 2 - ((v - min) / range) * (height - 4);
    return `${x},${y}`;
  });
  const lastVal = values[values.length - 1];
  const lx = width;
  const ly = height - 2 - ((lastVal - min) / range) * (height - 4);
  return (
    <svg width={width} height={height} className="opacity-50 group-hover:opacity-80 transition-opacity">
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lx} cy={ly} r="2" fill={color} />
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function HealthGauge({ score }: { score: number }) {
  const getColor = () => {
    if (score >= 80) return { ring: 'text-emerald-500', bg: 'from-emerald-500/20 to-emerald-600/20', text: 'text-emerald-400' };
    if (score >= 60) return { ring: 'text-blue-500', bg: 'from-blue-500/20 to-blue-600/20', text: 'text-blue-400' };
    if (score >= 40) return { ring: 'text-amber-500', bg: 'from-amber-500/20 to-orange-600/20', text: 'text-amber-400' };
    return { ring: 'text-red-500', bg: 'from-red-500/20 to-red-600/20', text: 'text-red-400' };
  };

  const colors = getColor();
  const circumference = 2 * Math.PI * 45;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative w-32 h-32">
      <svg className="w-32 h-32 transform -rotate-90">
        <circle cx="64" cy="64" r="45" fill="none" stroke="currentColor" strokeWidth="8" className="text-gray-800" />
        <circle
          cx="64" cy="64" r="45" fill="none" stroke="currentColor" strokeWidth="8"
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
          className={`${colors.ring} transition-all duration-1000`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-3xl font-bold ${colors.text}`}>{score}</span>
        <span className="text-xs text-gray-500">/ 100</span>
      </div>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: 'high' | 'medium' | 'low' }) {
  const config = {
    high: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30', label: 'קריטי' },
    medium: { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30', label: 'בינוני' },
    low: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30', label: 'נמוך' },
  };
  const { bg, text, border, label } = config[severity];
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${bg} ${text} border ${border}`}>{label}</span>;
}

function PriceTierBadge({ tier }: { tier: string }) {
  const config: Record<string, { color: string; label: string; icons: number }> = {
    'Budget': { color: 'text-emerald-400', label: 'תקציבי', icons: 1 },
    'Mid-Range': { color: 'text-blue-400', label: 'בינוני', icons: 2 },
    'Premium': { color: 'text-cyan-400', label: 'פרימיום', icons: 3 },
  };
  const { color, label, icons } = config[tier] || config['Mid-Range'];
  return (
    <div className={`flex items-center gap-2 ${color}`}>
      <div className="flex">{Array(icons).fill(0).map((_, i) => <DollarSign key={i} className="w-4 h-4 -ml-1 first:ml-0" />)}</div>
      <span className="font-semibold">{label}</span>
    </div>
  );
}

function SourceTag({ source }: { source: string }) {
  const getSourceConfig = (src: string) => {
    const lower = src.toLowerCase();
    if (lower.includes('instagram')) return { icon: Instagram, color: 'bg-pink-500/20 text-pink-400 border-pink-500/30' };
    if (lower.includes('facebook')) return { icon: Facebook, color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' };
    if (lower.includes('google') || lower.includes('maps')) return { icon: MapPin, color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' };
    if (lower.includes('madlan')) return { icon: Building2, color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' };
    if (lower.includes('website')) return { icon: Globe, color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' };
    return { icon: Zap, color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' };
  };
  const { icon: Icon, color } = getSourceConfig(source);
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs border ${color}`}>
      <Icon className="w-3 h-3" />
      {source}
    </span>
  );
}

function RatingComparison({ yourRating, marketAvg }: { yourRating: number; marketAvg: number }) {
  const diff = yourRating - marketAvg;
  const isAbove = diff > 0;
  const isEqual = Math.abs(diff) < 0.1;

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1">
        <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
        <span className="text-white font-bold text-lg">{yourRating > 0 ? yourRating.toFixed(1) : 'N/A'}</span>
      </div>
      {yourRating > 0 && marketAvg > 0 && (
        <div className={`flex items-center gap-1 text-sm ${isEqual ? 'text-gray-400' : isAbove ? 'text-emerald-400' : 'text-red-400'}`}>
          {isEqual ? <Minus className="w-4 h-4" /> : isAbove ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          <span>{isEqual ? 'שווה' : `${isAbove ? '+' : ''}${diff.toFixed(1)} מול השוק`}</span>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// GOOGLE MAP COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

interface GoogleMapProps {
  center: { lat: number; lng: number };
  competitors: Competitor[];
  businessName: string;
}

function GoogleMapRadar({ center, competitors, businessName }: GoogleMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);

  const initMap = useCallback(() => {
    if (!mapRef.current || !window.google?.maps) return;

    const map = new window.google.maps.Map(mapRef.current, {
      center,
      zoom: 14,
      styles: [
        { elementType: 'geometry', stylers: [{ color: '#1a1a2e' }] },
        { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a2e' }] },
        { elementType: 'labels.text.fill', stylers: [{ color: '#8b8b8b' }] },
        { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2d2d44' }] },
        { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e1626' }] },
        { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
      ],
      disableDefaultUI: true,
      zoomControl: true,
    });

    mapInstanceRef.current = map;

    // Your location marker (Blue)
    new window.google.maps.Marker({
      position: center,
      map,
      title: businessName,
      icon: {
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: 14,
        fillColor: '#3B82F6',
        fillOpacity: 1,
        strokeColor: '#1E40AF',
        strokeWeight: 3,
      },
      zIndex: 100,
    });

    // Competitor markers
    competitors.forEach((comp) => {
      if (!comp.latitude || !comp.longitude) return;

      const color = comp.is_top ? '#F59E0B' : '#EF4444';
      const strokeColor = comp.is_top ? '#D97706' : '#DC2626';

      const marker = new window.google.maps.Marker({
        position: { lat: comp.latitude, lng: comp.longitude },
        map,
        title: comp.name,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: comp.is_top ? 10 : 8,
          fillColor: color,
          fillOpacity: 1,
          strokeColor: strokeColor,
          strokeWeight: 2,
        },
      });

      const infoWindow = new window.google.maps.InfoWindow({
        content: `
          <div style="color: #1a1a2e; padding: 8px; min-width: 150px;">
            <strong style="font-size: 14px;">${comp.name}</strong>
            <div style="margin-top: 8px; font-size: 12px;">
              ${comp.google_rating ? `<div>⭐ ${comp.google_rating} (${comp.google_reviews_count} ביקורות)</div>` : ''}
              ${comp.is_top ? '<div style="color: #D97706; margin-top: 4px;">🏆 מתחרה מוביל</div>' : ''}
            </div>
          </div>
        `,
      });

      marker.addListener('click', () => infoWindow.open(map, marker));
    });

    setMapLoaded(true);
  }, [center, competitors, businessName]);

  useEffect(() => {
    loadGoogleMaps().then(initMap).catch(() => {});
  }, [initMap]);

  return (
    <div className="relative h-full min-h-[400px] rounded-xl overflow-hidden">
      <div ref={mapRef} className="w-full h-full" />
      {!mapLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
          <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
        </div>
      )}
      <div className="absolute bottom-4 left-4 bg-gray-900/90 backdrop-blur-sm rounded-lg p-3 border border-gray-700">
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500 border-2 border-blue-700" />
            <span className="text-gray-300">אתה</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-amber-500 border-2 border-amber-600" />
            <span className="text-gray-300">מתחרים מובילים</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500 border-2 border-red-600" />
            <span className="text-gray-300">אחרים</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// WELCOME / EMPTY STATE
// ═══════════════════════════════════════════════════════════════════════════════

function WelcomeState({ businessName }: { businessName?: string }) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="glass-card p-12 max-w-lg text-center space-y-6" dir="rtl">
        <ScannerLoader size="lg" message="" />

        <div>
          <h2 className="text-2xl font-bold text-white mb-2">
            {businessName ? `שלום, ${businessName}` : 'שלום'}!
          </h2>
          <p className="text-gray-400">
            הבינה המלאכותית שלנו אוספת מודיעין שוק עבורך...
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 bg-cyan-500/10 rounded-lg border border-cyan-500/30">
            <Loader2 className="w-5 h-5 text-cyan-400 animate-spin flex-shrink-0" />
            <span className="text-cyan-300 text-sm">סורק מתחרים בסביבה...</span>
          </div>
          <div className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg border border-gray-700/50">
            <Clock className="w-5 h-5 text-gray-500 flex-shrink-0" />
            <span className="text-gray-400 text-sm">מנתח מגמות שוק...</span>
          </div>
          <div className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg border border-gray-700/50">
            <Clock className="w-5 h-5 text-gray-500 flex-shrink-0" />
            <span className="text-gray-400 text-sm">בונה תוכנית פעולה...</span>
          </div>
        </div>

        <p className="text-gray-500 text-sm">
          זה בדרך כלל לוקח 2-5 דקות. חזור בקרוב!
        </p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN DASHBOARD COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function Dashboard() {
  const { user } = useAuth();
  const { currentProfile } = useSimulation();

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{ success: boolean; message: string } | null>(null);
  const [selectedCompetitorId, setSelectedCompetitorId] = useState<string | null>(null);

  // Supabase Realtime subscriptions
  const { newLeads, newCompetitors, newStrategyItems, isConnected, lastEvent, clearNewItems } =
    useLiveMarketData(currentProfile?.id);

  // Toast notifications when new data arrives
  useEffect(() => {
    if (!lastEvent) return;

    const messages: Record<string, string> = {
      leads_discovered: '\u{1F4E1} התקבל ליד חדש מהשטח!',
      competitors: '\u{1F50D} התקבל נתון חדש על מתחרה!',
      strategy_feed: '\u{26A1} פריט חדש בתוכנית הפעולה!',
    };

    const msg = messages[lastEvent.table] || '\u{1F4E1} התקבל נתון חדש מהשטח!';

    toast(msg, {
      icon: lastEvent.table === 'leads_discovered' ? '\u{1F3AF}' : lastEvent.table === 'strategy_feed' ? '\u{1F4A1}' : '\u{1F4CD}',
      duration: 4000,
      style: {
        background: '#1e1e2e',
        color: '#e2e8f0',
        border: '1px solid rgba(99, 102, 241, 0.3)',
        direction: 'rtl',
      },
    });
  }, [lastEvent]);

  // Auto-refresh dashboard when new data arrives (debounced)
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const totalNew = newLeads.length + newCompetitors.length + newStrategyItems.length;
    if (totalNew === 0) return;

    // Debounce: refresh 2s after last event to batch multiple arrivals
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => {
      fetchDashboardData(true);
      clearNewItems();
    }, 2000);

    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, [newLeads.length, newCompetitors.length, newStrategyItems.length]);

  // Fetch dashboard data
  const fetchDashboardData = useCallback(async (showRefresh = false) => {
    if (!currentProfile?.id) return;

    try {
      if (showRefresh) setRefreshing(true);
      else setLoading(true);

      const response = await apiFetch(`/dashboard/summary/${currentProfile.id}`);

      if (response.ok) {
        const result = await response.json();
        setData(result);
        setError(null);
      } else if (response.status === 404) {
        setData(null);
        setError(null); // No error, just no data yet
      } else {
        throw new Error('Failed to load dashboard');
      }
    } catch (err) {
      setError('לא ניתן לטעון את נתוני הדשבורד');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentProfile?.id]);

  // Trigger a full market re-scan for the current business
  const triggerMarketRescan = useCallback(async () => {
    if (!currentProfile?.id || scanning) return;

    setScanning(true);
    setScanResult(null);

    try {
      const response = await apiFetch(`/radar/sync/${currentProfile.id}`, {
        method: 'POST',
      });

      if (response.ok) {
        const result = await response.json();
        const found = result.new_competitors_found || 0;
        setScanResult({
          success: true,
          message: found > 0
            ? `נמצאו ${found} מתחרים חדשים!`
            : 'לא נמצאו מתחרים חדשים - השוק יציב'
        });
        // Refresh dashboard data to show new competitors
        await fetchDashboardData(true);
      } else {
        const err = await response.json().catch(() => ({}));
        setScanResult({
          success: false,
          message: err.detail || 'שגיאה בסריקת השוק'
        });
      }
    } catch (err) {
      setScanResult({
        success: false,
        message: 'שגיאת רשת - נסה שוב'
      });
    } finally {
      setScanning(false);
      // Clear result after 8 seconds
      setTimeout(() => setScanResult(null), 8000);
    }
  }, [currentProfile?.id, scanning, fetchDashboardData]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Loading state with skeletons
  if (loading) {
    return (
      <div className="space-y-5 fade-in" dir="rtl">
        <StatusBarSkeleton />
        <KPIRowSkeleton />
        <div className="glass-card p-5 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gray-700/50" />
            <div className="space-y-2 flex-1">
              <SkeletonPulse className="w-48 h-5" />
              <SkeletonPulse className="w-full h-4" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-7 space-y-4">
            <MapSkeleton />
          </div>
          <div className="lg:col-span-5 space-y-4">
            <FeedSkeleton />
            <CardSkeleton />
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="glass-card p-8 text-center space-y-4 max-w-md">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
          <h2 className="text-xl font-bold text-white" dir="rtl">אופס! משהו השתבש</h2>
          <p className="text-gray-400" dir="rtl">{error}</p>
          <button
            onClick={() => fetchDashboardData()}
            className="px-6 py-2 bg-[#0066cc] text-white rounded-lg hover:bg-[#0077cc] transition-colors"
          >
            נסה שוב
          </button>
        </div>
      </div>
    );
  }

  // Welcome state (no data yet)
  if (!data || !data.business_info) {
    return <WelcomeState businessName={currentProfile?.nameHebrew} />;
  }

  const { business_info, competitors, strategy_feed, market_stats } = data;

  // ═══════════════════════════════════════════════════════════════════════════════
  // MAIN RENDER
  // ═══════════════════════════════════════════════════════════════════════════════

  return (
    <div className="space-y-5 fade-in" dir="rtl">

      {/* ═══════════════════════════════════════════════════════════════════════════
          OPERATIONS STATUS BAR
          ═══════════════════════════════════════════════════════════════════════════ */}
      <header className="glass-card p-4 border border-[var(--border)]">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          {/* Business Identity + Scanner Status */}
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/20 flex items-center justify-center">
              <span className="text-xl">👁️</span>
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-lg font-bold text-white" style={{ fontFamily: "var(--font-display)" }}>{business_info.name_hebrew}</h1>
                <span className="px-2 py-0.5 rounded text-[11px] bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] border border-[var(--accent-primary)]/20">
                  {business_info.industry}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1.5">
                <div className="flex items-center gap-1.5 text-[var(--accent-primary)]">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--accent-primary)] opacity-50" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--accent-primary)]" />
                  </span>
                  <span className="text-xs font-medium">{scanning ? 'סורק עכשיו' : 'פעיל'}</span>
                </div>
                <span className="text-gray-600">•</span>
                <span className="text-xs text-[var(--text-muted)]">עודכן לפני {refreshing ? '...' : '3 דקות'}</span>
                {business_info.address && (
                  <>
                    <span className="text-gray-600">•</span>
                    <span className="text-[var(--text-muted)] text-xs flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {business_info.address}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Actions + Health Gauge */}
          <div className="flex items-center gap-3">
            {/* Scan Result */}
            {scanResult && (
              <div className={`text-xs px-3 py-1.5 rounded-lg border ${
                scanResult.success
                  ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] border-[var(--accent-primary)]/30'
                  : 'bg-red-500/10 text-red-400 border-red-500/30'
              }`}>
                <div className="flex items-center gap-1.5">
                  {scanResult.success ? (
                    <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  )}
                  {scanResult.message}
                </div>
              </div>
            )}

            <button
              onClick={() => fetchDashboardData(true)}
              disabled={refreshing}
              className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800/50 transition-colors disabled:opacity-50"
              title="רענן נתונים"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={triggerMarketRescan}
              disabled={scanning || refreshing}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] border border-[var(--accent-primary)]/25 hover:bg-[var(--accent-primary)]/20 text-sm transition-colors disabled:opacity-50"
            >
              {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radar className="w-4 h-4" />}
              <span className="hidden sm:inline">{scanning ? 'סורק...' : 'סריקת שוק'}</span>
            </button>

            <div className="hidden md:block">
              <HealthGauge score={business_info.market_health_score || 0} />
            </div>
          </div>
        </div>
      </header>

      {/* ═══════════════════════════════════════════════════════════════════════════
          KPI CARDS
          ═══════════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Competitors */}
        <div className="glass-card p-4 border-t-2 border-t-blue-500/50 hover:border-t-blue-400 transition-all group">
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 rounded-lg bg-blue-500/15 flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-400" />
            </div>
            <MiniSparkline values={[3, 5, 4, 7, 6, 8, market_stats.total_competitors]} color="#60a5fa" />
          </div>
          {market_stats.total_competitors > 0 ? (
            <>
              <span className="text-3xl font-bold text-white block" style={{ fontFamily: "var(--font-mono)" }}>
                {market_stats.total_competitors}
              </span>
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-xs text-gray-500">מתחרים</span>
                <span className="text-[10px] text-emerald-400 flex items-center gap-0.5">
                  <TrendingUp className="w-3 h-3" />
                  +{market_stats.top_competitors} מובילים
                </span>
              </div>
            </>
          ) : (
            <>
              <SkeletonPulse className="w-16 h-8 mb-2" />
              <span className="text-xs text-gray-500">מתחרים</span>
            </>
          )}
        </div>

        {/* Threats */}
        <div className="glass-card p-4 border-t-2 border-t-red-500/50 hover:border-t-red-400 transition-all group">
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 rounded-lg bg-red-500/15 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-400" />
            </div>
            <MiniSparkline values={[1, 2, 1, 3, 2, 3, market_stats.high_threat_competitors]} color="#f87171" />
          </div>
          {market_stats.high_threat_competitors > 0 ? (
            <>
              <span className="text-3xl font-bold text-red-400 block" style={{ fontFamily: "var(--font-mono)" }}>
                {market_stats.high_threat_competitors}
              </span>
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-xs text-gray-500">איומים</span>
                <span className="text-[10px] text-red-400 flex items-center gap-0.5">
                  <AlertTriangle className="w-3 h-3" />
                  ברמה גבוהה
                </span>
              </div>
            </>
          ) : (
            <>
              <span className="text-3xl font-bold text-emerald-400 block" style={{ fontFamily: "var(--font-mono)" }}>0</span>
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-xs text-gray-500">איומים</span>
                <span className="text-[10px] text-emerald-400">ללא איומים</span>
              </div>
            </>
          )}
        </div>

        {/* Your Rating */}
        <div className="glass-card p-4 border-t-2 border-t-amber-500/50 hover:border-t-amber-400 transition-all group">
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/15 flex items-center justify-center">
              <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
            </div>
            <MiniSparkline values={[3.8, 4.0, 3.9, 4.1, 4.0, 4.2, market_stats.your_rating || 4.0]} color="#fbbf24" />
          </div>
          {market_stats.your_rating > 0 ? (
            <>
              <span className="text-3xl font-bold text-white block" style={{ fontFamily: "var(--font-mono)" }}>
                {market_stats.your_rating.toFixed(1)}
              </span>
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-xs text-gray-500">דירוג</span>
                {market_stats.avg_market_rating > 0 && (
                  <span className={`text-[10px] flex items-center gap-0.5 ${market_stats.your_rating >= market_stats.avg_market_rating ? 'text-emerald-400' : 'text-red-400'}`}>
                    {market_stats.your_rating >= market_stats.avg_market_rating ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {market_stats.your_rating >= market_stats.avg_market_rating ? '+' : ''}{(market_stats.your_rating - market_stats.avg_market_rating).toFixed(1)} מהשוק
                  </span>
                )}
              </div>
            </>
          ) : (
            <>
              <SkeletonPulse className="w-16 h-8 mb-2" />
              <span className="text-xs text-gray-500">דירוג</span>
            </>
          )}
        </div>

        {/* Market Saturation */}
        <div className="glass-card p-4 border-t-2 border-t-cyan-500/50 hover:border-t-cyan-400 transition-all group">
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 rounded-lg bg-cyan-500/15 flex items-center justify-center">
              <Activity className="w-5 h-5 text-cyan-400" />
            </div>
            <MiniSparkline values={[40, 45, 50, 48, 55, 52, 58]} color="#00d4ff" />
          </div>
          <span className={`text-2xl font-bold block ${
            market_stats.market_saturation === 'high' ? 'text-red-400' :
            market_stats.market_saturation === 'medium' ? 'text-amber-400' : 'text-emerald-400'
          }`}>
            {market_stats.market_saturation === 'high' ? 'גבוהה' : market_stats.market_saturation === 'medium' ? 'בינונית' : 'נמוכה'}
          </span>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-xs text-gray-500">רוויה</span>
            <span className="text-[10px] text-gray-400" style={{ fontFamily: "var(--font-mono)" }}>
              {(market_stats.total_competitor_reviews || 0).toLocaleString()} ביקורות
            </span>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════════
          DAILY BRIEFING
          ═══════════════════════════════════════════════════════════════════════════ */}
      <DailyBriefing businessId={currentProfile.id} />

      {/* ═══════════════════════════════════════════════════════════════════════════
          WEEKLY PREDICTION
          ═══════════════════════════════════════════════════════════════════════════ */}
      <PredictionCard businessId={currentProfile.id} />

      {/* ═══════════════════════════════════════════════════════════════════════════
          INTELLIGENCE TIMELINE
          ═══════════════════════════════════════════════════════════════════════════ */}
      <IntelligenceTimeline businessId={currentProfile.id} />

      {/* ═══════════════════════════════════════════════════════════════════════════
          MAIN OPERATIONAL GRID (7 + 5)
          ═══════════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

        {/* ─── LEFT: Radar Map + Competitors + Market Intel ─── */}
        <div className="lg:col-span-7 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Radar className="w-5 h-5 text-[var(--accent-primary,#00d4ff)]" />
              הרדאר
            </h2>
            {business_info.address && (
              <span className="text-gray-600 text-xs">{business_info.industry} | {business_info.address}</span>
            )}
          </div>

          <div className="glass-card p-4 h-[500px]">
            {business_info.latitude && business_info.longitude ? (
              <GoogleMapRadar
                center={{ lat: business_info.latitude, lng: business_info.longitude }}
                competitors={competitors}
                businessName={business_info.name_hebrew}
              />
            ) : (
              <div className="h-full flex flex-col items-center justify-center">
                <ScannerLoader size="md" message="טוען את מפת העסקים באזור שלך..." />
                {business_info.address && !business_info.latitude && (
                  <button
                    onClick={triggerMarketRescan}
                    disabled={scanning}
                    className="mt-4 px-4 py-2 bg-[#0066cc] text-white rounded-lg hover:bg-[#0077cc] transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radar className="w-4 h-4" />}
                    {scanning ? 'סורק...' : 'סרוק עכשיו'}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Top Competitors */}
          {competitors.length > 0 && (
            <div className="glass-card p-4">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <Crown className="w-4 h-4 text-amber-400" />
                מתחרים מובילים
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {competitors.filter(c => c.is_top).slice(0, 4).map((comp) => (
                  <div
                    key={comp.id}
                    onClick={() => setSelectedCompetitorId(comp.id)}
                    className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 hover:bg-amber-500/10 hover:border-amber-500/40 transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5 mb-2">
                      <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
                        <span className="text-amber-300 text-xs font-bold">{comp.name.charAt(0)}</span>
                      </div>
                      <span className="text-amber-200 text-sm font-medium truncate group-hover:text-amber-100">{comp.name}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-400 flex items-center gap-1">
                        <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                        {comp.google_rating || 'N/A'}
                      </span>
                      <span className="text-gray-500">{comp.google_reviews_count} ביקורות</span>
                    </div>
                  </div>
                ))}
              </div>
              {competitors.length > 4 && (
                <button className="mt-3 w-full py-2 text-sm text-cyan-400 hover:text-cyan-300 flex items-center justify-center gap-1 transition-colors">
                  צפה בכל {competitors.length} המתחרים
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          )}

          {/* Market Intelligence Stats */}
          <div className="glass-card p-4">
            <h3 className="text-sm text-gray-400 mb-3 flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              מודיעין שוק
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 rounded-lg bg-gray-800/30">
                <span className="text-lg font-bold text-white block" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  {(market_stats.total_competitor_reviews || 0).toLocaleString()}
                </span>
                <span className="text-gray-500 text-xs">ביקורות בשוק</span>
              </div>
              <div className="text-center p-3 rounded-lg bg-gray-800/30">
                <span className="text-lg font-bold text-white block" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  {market_stats.avg_competitor_reviews}
                </span>
                <span className="text-gray-500 text-xs">ממוצע/מתחרה</span>
              </div>
              <div className="text-center p-3 rounded-lg bg-gray-800/30">
                <span className="text-lg font-bold text-red-400 block" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  {market_stats.high_threat_competitors}
                </span>
                <span className="text-gray-500 text-xs">איומים גבוהים</span>
              </div>
            </div>
          </div>
        </div>

        {/* ─── RIGHT: Strategy + Business Mirror + ROI ─── */}
        <div className="lg:col-span-5 space-y-5">

          {/* Strategy Feed / Action Plan */}
          <div>
            <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
              <Zap className="w-5 h-5 text-amber-400" />
              תוכנית פעולה
            </h2>

            {strategy_feed.length > 0 ? (
              <div className="space-y-3">
                {strategy_feed.map((item) => (
                  <div
                    key={item.id}
                    className={`glass-card p-4 border-l-2 hover:bg-gray-800/30 transition-all cursor-pointer ${
                      item.priority === 'high' ? 'border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.12)] hover:shadow-[0_0_25px_rgba(239,68,68,0.2)]' :
                      item.priority === 'medium' ? 'border-amber-500' : 'border-blue-500'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <SourceTag source={item.source} />
                      <span className="text-xs text-gray-500">
                        {new Date(item.timestamp).toLocaleDateString('he-IL')}
                      </span>
                    </div>

                    <h4 className="font-medium text-white text-sm mb-1">{item.title}</h4>
                    <p className="text-gray-400 text-xs line-clamp-2">{item.description}</p>

                    {item.competitor_name && (
                      <span className="inline-block mt-2 text-xs text-gray-500">
                        Re: {item.competitor_name}
                      </span>
                    )}

                    <button
                      onClick={() => {
                        if (item.type === 'lead') window.location.href = '/dashboard/sniper';
                        else if (item.type === 'competitor') window.location.href = '/dashboard/landscape';
                        else if (item.type === 'review') window.location.href = '/dashboard/reflection';
                        else window.location.href = '/dashboard/intelligence';
                      }}
                      className="mt-3 w-full py-2 bg-cyan-500/15 text-cyan-400 rounded-lg text-sm font-medium hover:bg-cyan-500/25 transition-colors flex items-center justify-center gap-2 border border-cyan-500/20"
                    >
                      <ArrowUpRight className="w-4 h-4" />
                      {item.action_label}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="glass-card p-8">
                <ScannerLoader size="sm" message="סורק את השוק לתוכנית פעולה..." />
              </div>
            )}
          </div>

          {/* Urgent Tasks */}
          <div className="glass-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <Wrench className="w-4 h-4 text-red-400" />
                משימות דחופות
              </h3>
              <span className="text-xs text-gray-500">{(business_info.weaknesses || []).length} בעיות</span>
            </div>

            {(business_info.weaknesses || []).length > 0 ? (
              <div className="space-y-3">
                {(business_info.weaknesses || []).map((weakness, i) => (
                  <div key={i} className={`p-3 rounded-lg border-l-2 ${
                    weakness.severity === 'high' ? 'bg-red-500/10 border-red-500' :
                    weakness.severity === 'medium' ? 'bg-amber-500/10 border-amber-500' :
                    'bg-blue-500/10 border-blue-500'
                  }`}>
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className="text-gray-200 text-sm font-medium">{weakness.issue}</span>
                      <SeverityBadge severity={weakness.severity} />
                    </div>
                    <p className="text-xs text-gray-500 flex items-start gap-1">
                      <Lightbulb className="w-3 h-3 mt-0.5 text-amber-400 flex-shrink-0" />
                      {weakness.fix}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                <p className="text-gray-400 text-sm">לא נמצאו בעיות דחופות!</p>
              </div>
            )}
          </div>

          {/* Market Position */}
          <div className="glass-card p-5 space-y-4">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <Target className="w-4 h-4 text-emerald-400" />
              מיצוב שוק
            </h3>

            {business_info.usp && (
              <div className="p-3 bg-gradient-to-l from-cyan-500/10 to-blue-500/10 rounded-lg border border-cyan-500/20">
                <span className="text-xs text-cyan-400 block mb-1">הייחוד שלך</span>
                <p className="text-white text-sm">{business_info.usp}</p>
              </div>
            )}

            <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
              <span className="text-gray-400 text-sm">רמת מחיר</span>
              <PriceTierBadge tier={business_info.price_tier} />
            </div>

            {(business_info.services || []).length > 0 && (
              <div>
                <span className="text-gray-400 text-xs block mb-2">שירותים מובילים</span>
                <div className="flex flex-wrap gap-1.5">
                  {(business_info.services || []).slice(0, 4).map((service, i) => (
                    <span key={i} className="px-2 py-1 bg-gray-700/50 text-gray-300 text-xs rounded-full border border-gray-600/50">
                      {service}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ROI Tracker */}
          <ROITracker businessId={currentProfile.id} />
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════════
          HOT AUDIENCES
          ═══════════════════════════════════════════════════════════════════════════ */}
      <HotAudiencesCard businessId={currentProfile.id} />

      {/* ═══════════════════════════════════════════════════════════════════════════
          COMPETITOR DETAIL DRAWER
          ═══════════════════════════════════════════════════════════════════════════ */}
      {selectedCompetitorId && (
        <CompetitorDrawer
          competitorId={selectedCompetitorId}
          onClose={() => setSelectedCompetitorId(null)}
        />
      )}
    </div>
  );
}

// Type declarations
declare global {
  interface Window {
    google?: typeof google;
  }
}
