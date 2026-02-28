import { useState, useEffect, useCallback } from 'react';
import { useSimulation } from '../../context/SimulationContext';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../services/api';
import EmptyState from '../../components/ui/EmptyState';
import toast from 'react-hot-toast';
import {
  Megaphone, RefreshCw, User, MapPin, Clock, Globe, Star,
  Copy, Check, MessageSquare, Loader2, Calendar, FileDown,
  Wifi, Search, Send, Eye, Lightbulb, Users, BarChart3,
  CheckCircle2, AlertCircle,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface AudienceProfile {
  age_range: string;
  gender: string;
  area: string;
  networks: string;
  active_hours: string;
  search_terms: string[];
}

interface ChannelRecommendation {
  id: string;
  name: string;
  icon: string;
  stars: number;
  description: string;
  budget: string;
  roi: string;
}

interface WinningMessage {
  id: string;
  text: string;
  usage_tips: string[];
}

interface CompetitorRow {
  id: string;
  name: string;
  active_channels: string;
  posting_frequency: string;
  estimated_success: number;
}

interface DayPlan {
  icon: string;
  action: string;
  topic: string;
}

interface WeeklyPlan {
  sunday: DayPlan;
  monday: DayPlan;
  tuesday: DayPlan;
  wednesday: DayPlan;
  thursday: DayPlan;
  friday: DayPlan;
}

interface MarketingReport {
  audience_profile: AudienceProfile | null;
  channel_recommendations: ChannelRecommendation[];
  winning_messages: WinningMessage[];
  competitor_table: CompetitorRow[];
  competitor_insight: string;
  weekly_plan: WeeklyPlan | null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const GLASS = 'bg-[#0a1628]/60 backdrop-blur-xl border border-gray-700/30 rounded-2xl';

const CHANNEL_ICONS: Record<string, { icon: typeof Globe; color: string; emoji: string }> = {
  facebook:   { icon: Globe,     color: 'text-blue-400',    emoji: '📘' },
  instagram:  { icon: Eye,       color: 'text-pink-400',    emoji: '📸' },
  google_ads: { icon: Search,    color: 'text-yellow-400',  emoji: '🔍' },
  seo:        { icon: BarChart3, color: 'text-cyan-400',    emoji: '📊' },
  whatsapp:   { icon: Send,      color: 'text-green-400',   emoji: '💬' },
};

const DAY_LABELS: Record<string, string> = {
  sunday: 'ראשון',
  monday: 'שני',
  tuesday: 'שלישי',
  wednesday: 'רביעי',
  thursday: 'חמישי',
  friday: 'שישי',
};

const DAY_ORDER = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday'] as const;

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function StarRating({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`w-4 h-4 ${i <= count ? 'text-amber-400 fill-amber-400' : 'text-gray-600'}`}
        />
      ))}
    </div>
  );
}

function SuccessStars({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`w-3 h-3 ${i <= count ? 'text-amber-400 fill-amber-400' : 'text-gray-700'}`}
        />
      ))}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('הטקסט הועתק!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('שגיאה בהעתקה');
    }
  };
  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-medium hover:bg-cyan-500/20 transition-colors"
    >
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? 'הועתק!' : 'העתק מסר'}
    </button>
  );
}

function getDayEmoji(icon: string): string {
  return CHANNEL_ICONS[icon]?.emoji || '📌';
}

// ═══════════════════════════════════════════════════════════════════════════════
// SKELETON
// ═══════════════════════════════════════════════════════════════════════════════

function LoadingSkeleton() {
  return (
    <div dir="rtl" className="min-h-screen bg-gray-900 p-4 md:p-6 space-y-6 font-[Heebo]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gray-700/50 animate-pulse" />
          <div className="space-y-2">
            <div className="w-36 h-6 rounded bg-gray-700/50 animate-pulse" />
            <div className="w-64 h-4 rounded bg-gray-700/50 animate-pulse" />
          </div>
        </div>
        <div className="w-28 h-10 rounded-xl bg-gray-700/50 animate-pulse" />
      </div>
      {/* Persona skeleton */}
      <div className={`${GLASS} p-6 space-y-4`}>
        <div className="w-48 h-6 rounded bg-gray-700/50 animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="h-8 rounded bg-gray-700/50 animate-pulse" />
          ))}
        </div>
      </div>
      {/* Channels skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1,2,3,4,5].map(i => (
          <div key={i} className={`${GLASS} p-5 space-y-3`}>
            <div className="w-32 h-5 rounded bg-gray-700/50 animate-pulse" />
            <div className="w-full h-3 rounded bg-gray-700/50 animate-pulse" />
            <div className="w-3/4 h-3 rounded bg-gray-700/50 animate-pulse" />
          </div>
        ))}
      </div>
      {/* Messages skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1,2,3].map(i => (
          <div key={i} className={`${GLASS} p-5 space-y-3`}>
            <div className="w-full h-16 rounded bg-gray-700/50 animate-pulse" />
            <div className="w-24 h-8 rounded bg-gray-700/50 animate-pulse" />
          </div>
        ))}
      </div>
      {/* Table skeleton */}
      <div className={`${GLASS} p-6 space-y-3`}>
        {[1,2,3,4].map(i => (
          <div key={i} className="h-10 rounded bg-gray-700/50 animate-pulse" />
        ))}
      </div>
      {/* Weekly plan skeleton */}
      <div className={`${GLASS} p-6 space-y-3`}>
        {[1,2,3,4,5,6].map(i => (
          <div key={i} className="h-10 rounded bg-gray-700/50 animate-pulse" />
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 1: AUDIENCE PROFILE
// ═══════════════════════════════════════════════════════════════════════════════

function AudienceSection({
  profile,
  onRegenerate,
  regenerating,
}: {
  profile: AudienceProfile;
  onRegenerate: () => void;
  regenerating: boolean;
}) {
  return (
    <div className={`${GLASS} p-6 relative overflow-hidden`}>
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-l from-cyan-400 via-blue-500 to-purple-500" />

      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center">
            <User className="w-5 h-5 text-cyan-400" />
          </div>
          <h2 className="text-lg font-bold text-white">הלקוח האידיאלי שלך</h2>
        </div>
        <button
          onClick={onRegenerate}
          disabled={regenerating}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-800/60 border border-gray-700/40 text-gray-300 hover:text-white hover:border-gray-600 transition-colors disabled:opacity-50"
        >
          {regenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          יצר פרופיל מחדש
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-5">
        <div className="flex items-center gap-3 bg-gray-800/40 rounded-xl p-3">
          <Users className="w-5 h-5 text-purple-400 flex-shrink-0" />
          <div>
            <span className="text-xs text-gray-500 block">גיל</span>
            <span className="text-sm text-white font-medium">{profile.age_range}</span>
          </div>
        </div>
        <div className="flex items-center gap-3 bg-gray-800/40 rounded-xl p-3">
          <User className="w-5 h-5 text-pink-400 flex-shrink-0" />
          <div>
            <span className="text-xs text-gray-500 block">מגדר</span>
            <span className="text-sm text-white font-medium">{profile.gender}</span>
          </div>
        </div>
        <div className="flex items-center gap-3 bg-gray-800/40 rounded-xl p-3">
          <MapPin className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          <div>
            <span className="text-xs text-gray-500 block">אזור</span>
            <span className="text-sm text-white font-medium">{profile.area}</span>
          </div>
        </div>
        <div className="flex items-center gap-3 bg-gray-800/40 rounded-xl p-3">
          <Wifi className="w-5 h-5 text-blue-400 flex-shrink-0" />
          <div>
            <span className="text-xs text-gray-500 block">רשתות</span>
            <span className="text-sm text-white font-medium">{profile.networks}</span>
          </div>
        </div>
        <div className="flex items-center gap-3 bg-gray-800/40 rounded-xl p-3">
          <Clock className="w-5 h-5 text-amber-400 flex-shrink-0" />
          <div>
            <span className="text-xs text-gray-500 block">שעות פעילות</span>
            <span className="text-sm text-white font-medium">{profile.active_hours}</span>
          </div>
        </div>
        <div className="flex items-center gap-3 bg-gray-800/40 rounded-xl p-3">
          <Search className="w-5 h-5 text-cyan-400 flex-shrink-0" />
          <div>
            <span className="text-xs text-gray-500 block">מחפש</span>
            <span className="text-sm text-white font-medium truncate">
              {profile.search_terms?.slice(0, 3).join(', ')}
            </span>
          </div>
        </div>
      </div>

      {/* Search terms tags */}
      {profile.search_terms && profile.search_terms.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {profile.search_terms.map((term, i) => (
            <span
              key={i}
              className="px-2.5 py-1 rounded-full bg-cyan-500/10 text-cyan-400 text-xs border border-cyan-500/20"
            >
              {term}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 2: CHANNEL RECOMMENDATIONS
// ═══════════════════════════════════════════════════════════════════════════════

function ChannelsSection({ channels }: { channels: ChannelRecommendation[] }) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 flex items-center justify-center">
          <Megaphone className="w-5 h-5 text-blue-400" />
        </div>
        <h2 className="text-lg font-bold text-white">ערוצי שיווק מומלצים</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {channels.map((ch) => {
          const chConfig = CHANNEL_ICONS[ch.icon] || CHANNEL_ICONS.facebook;
          const IconComp = chConfig.icon;
          return (
            <div key={ch.id} className={`${GLASS} p-5 flex flex-col`}>
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-gray-800/60 border border-gray-700/40 flex items-center justify-center">
                    <IconComp className={`w-5 h-5 ${chConfig.color}`} />
                  </div>
                  <span className="text-base font-semibold text-white">{ch.name}</span>
                </div>
                <div className="flex flex-col items-end gap-0.5">
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider">עדיפות</span>
                  <StarRating count={ch.stars} />
                </div>
              </div>

              {/* Description */}
              <p className="text-sm text-gray-400 leading-relaxed mb-4 flex-1">
                {ch.description}
              </p>

              {/* Budget + ROI */}
              <div className="space-y-2 pt-3 border-t border-gray-700/30">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">תקציב מומלץ:</span>
                  <span className="text-white font-medium">{ch.budget}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">ROI צפוי:</span>
                  <span className="text-emerald-400 font-medium">{ch.roi}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 3: WINNING MESSAGES
// ═══════════════════════════════════════════════════════════════════════════════

function MessagesSection({ messages }: { messages: WinningMessage[] }) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 flex items-center justify-center">
          <MessageSquare className="w-5 h-5 text-emerald-400" />
        </div>
        <h2 className="text-lg font-bold text-white">מסרים שעובדים</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {messages.map((msg) => (
          <div key={msg.id} className={`${GLASS} p-5 flex flex-col`}>
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-medium text-amber-400">מסר שמושך לידים</span>
            </div>

            {/* Message text */}
            <p className="text-white text-sm font-medium leading-relaxed mb-4 flex-1 bg-gray-800/40 p-3 rounded-xl border-r-2 border-cyan-500/40">
              &ldquo;{msg.text}&rdquo;
            </p>

            {/* Usage tips */}
            {msg.usage_tips && msg.usage_tips.length > 0 && (
              <div className="space-y-1.5 mb-4">
                {msg.usage_tips.map((tip, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-gray-400">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                    <span>{tip}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Copy button */}
            <CopyButton text={msg.text} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 4: COMPETITOR TABLE
// ═══════════════════════════════════════════════════════════════════════════════

function CompetitorSection({
  competitors,
  insight,
}: {
  competitors: CompetitorRow[];
  insight: string;
}) {
  if (competitors.length === 0 && !insight) return null;

  return (
    <div className={`${GLASS} p-6`}>
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500/20 to-orange-500/20 flex items-center justify-center">
          <Eye className="w-5 h-5 text-red-400" />
        </div>
        <h2 className="text-lg font-bold text-white">מה עושים המתחרים</h2>
      </div>

      {competitors.length > 0 && (
        <div className="overflow-x-auto mb-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700/50">
                <th className="text-right py-3 px-3 text-gray-400 font-medium">שם מתחרה</th>
                <th className="text-right py-3 px-3 text-gray-400 font-medium">ערוצים פעילים</th>
                <th className="text-right py-3 px-3 text-gray-400 font-medium">תדירות פרסום</th>
                <th className="text-right py-3 px-3 text-gray-400 font-medium">הצלחה משוערת</th>
              </tr>
            </thead>
            <tbody>
              {competitors.map((comp) => (
                <tr key={comp.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                  <td className="py-3 px-3 text-white font-medium">{comp.name}</td>
                  <td className="py-3 px-3 text-gray-300">{comp.active_channels}</td>
                  <td className="py-3 px-3 text-gray-300">{comp.posting_frequency}</td>
                  <td className="py-3 px-3">
                    <SuccessStars count={comp.estimated_success} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {insight && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-start gap-3">
          <Lightbulb className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-200 leading-relaxed">{insight}</p>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 5: WEEKLY PLAN
// ═══════════════════════════════════════════════════════════════════════════════

function WeeklyPlanSection({
  plan,
  onRegenerate,
  regenerating,
  onExportPdf,
  exportingPdf,
}: {
  plan: WeeklyPlan;
  onRegenerate: () => void;
  regenerating: boolean;
  onExportPdf: () => void;
  exportingPdf: boolean;
}) {
  return (
    <div className={`${GLASS} p-6`}>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
            <Calendar className="w-5 h-5 text-purple-400" />
          </div>
          <h2 className="text-lg font-bold text-white">תוכנית תוכן לשבוע הבא</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onRegenerate}
            disabled={regenerating}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-800/60 border border-gray-700/40 text-gray-300 hover:text-white hover:border-gray-600 transition-colors disabled:opacity-50"
          >
            {regenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            יצר תוכנית חדשה
          </button>
          <button
            onClick={onExportPdf}
            disabled={exportingPdf}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/20 transition-colors disabled:opacity-50"
          >
            {exportingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
            ייצא ל-PDF
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {DAY_ORDER.map((dayKey) => {
          const day = plan[dayKey];
          if (!day) return null;
          const emoji = getDayEmoji(day.icon);
          return (
            <div
              key={dayKey}
              className="flex items-center gap-4 bg-gray-800/30 rounded-xl p-3 hover:bg-gray-800/50 transition-colors"
            >
              <div className="w-16 flex-shrink-0">
                <span className="text-sm font-bold text-white">{DAY_LABELS[dayKey]}</span>
              </div>
              <span className="text-lg flex-shrink-0">{emoji}</span>
              <div className="flex-1 min-w-0">
                <span className="text-sm text-cyan-400 font-medium">{day.action}</span>
                <span className="text-sm text-gray-400"> — </span>
                <span className="text-sm text-gray-300">&ldquo;{day.topic}&rdquo;</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function MarketingIntel() {
  const { currentProfile } = useSimulation();
  const { user } = useAuth();

  const [report, setReport] = useState<MarketingReport | null>(null);
  const [cached, setCached] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [regeneratingPlan, setRegeneratingPlan] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const businessId = currentProfile?.id;
  const businessName = currentProfile?.nameHebrew || currentProfile?.name || '';

  // Safety timeout
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (loading) setLoading(false);
    }, 20000);
    return () => clearTimeout(timeout);
  }, [loading]);

  const fetchReport = useCallback(async () => {
    if (!businessId || !user?.id) {
      setLoading(false);
      return;
    }
    try {
      setError(null);
      const res = await apiFetch(`/marketing-intel/report/${businessId}`);
      if (!res.ok) throw new Error('שגיאה בטעינת דוח מודיעין שיווקי');
      const data = await res.json();
      if (data.success && data.report) {
        setReport(data.report);
        setCached(data.cached);
      } else {
        throw new Error('הדוח לא נמצא');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'שגיאה בטעינת דוח';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [businessId, user?.id]);

  const handleRefresh = useCallback(async () => {
    if (!businessId || refreshing) return;
    setRefreshing(true);
    try {
      const res = await apiFetch(`/marketing-intel/report/${businessId}/refresh`, { method: 'POST' });
      if (!res.ok) throw new Error('שגיאה ברענון הדוח');
      const data = await res.json();
      if (data.success && data.report) {
        setReport(data.report);
        setCached(data.cached);
        toast.success('הדוח עודכן בהצלחה!');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'שגיאה ברענון');
    } finally {
      setRefreshing(false);
    }
  }, [businessId, refreshing]);

  const handleRegeneratePlan = useCallback(async () => {
    if (!businessId || regeneratingPlan) return;
    setRegeneratingPlan(true);
    try {
      const res = await apiFetch(`/marketing-intel/weekly-plan/${businessId}`, { method: 'POST' });
      if (!res.ok) throw new Error('שגיאה ביצירת תוכנית');
      const data = await res.json();
      if (data.success && data.weekly_plan && report) {
        setReport({ ...report, weekly_plan: data.weekly_plan });
        toast.success('תוכנית חדשה נוצרה!');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'שגיאה ביצירת תוכנית');
    } finally {
      setRegeneratingPlan(false);
    }
  }, [businessId, regeneratingPlan, report]);

  const handleExportPdf = useCallback(() => {
    toast.success('ייצוא PDF יהיה זמין בקרוב');
  }, []);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER — Loading
  // ═══════════════════════════════════════════════════════════════════════════

  if (loading) {
    return <LoadingSkeleton />;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER — Error
  // ═══════════════════════════════════════════════════════════════════════════

  if (error && !report) {
    return (
      <div dir="rtl" className="min-h-screen bg-gray-900 flex items-center justify-center p-6 font-[Heebo]">
        <EmptyState
          icon={AlertCircle}
          iconColor="text-red-400"
          title="📢 הקול מכין תוכן..."
          description={error}
          actionLabel="נסה שוב"
          onAction={fetchReport}
          actionIcon={RefreshCw}
        />
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER — Empty
  // ═══════════════════════════════════════════════════════════════════════════

  if (!report) {
    return (
      <div dir="rtl" className="min-h-screen bg-gray-900 flex items-center justify-center p-6 font-[Heebo]">
        <EmptyState
          icon={Megaphone}
          iconColor="text-cyan-400"
          title="הקול עדיין לא הכין תוכן."
          description={"ברגע שיהיה מספיק מידע על העסק — הוא יתחיל לכתוב בשבילך ✍️"}
          actionLabel="צור דוח שיווקי"
          onAction={handleRefresh}
          actionIcon={Megaphone}
        />
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER — Main Content
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div dir="rtl" className="min-h-screen bg-gray-900 text-white font-[Heebo] fade-in">
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-8">

        {/* ══════════════════════════════════════════════════════════════════
            HEADER
           ══════════════════════════════════════════════════════════════════ */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Megaphone className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-white">הקול שלי 📢</h1>
              <p className="text-sm text-gray-400">
                הקול מדבר ללקוחות שלך כשאין לך זמן
              </p>
            </div>
            {cached && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 text-xs border border-amber-500/30 self-start">
                <Clock className="w-3 h-3" />
                מהמטמון
              </span>
            )}
          </div>

          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
              refreshing
                ? 'bg-gray-700/50 text-gray-400 cursor-wait'
                : 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white hover:shadow-lg hover:shadow-cyan-500/25'
            }`}
          >
            {refreshing ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> 📢 הקול מכין תוכן...</>
            ) : (
              <><RefreshCw className="w-4 h-4" /> רענן דוח</>
            )}
          </button>
        </header>

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 1: AUDIENCE PROFILE
           ══════════════════════════════════════════════════════════════════ */}
        {report.audience_profile && (
          <AudienceSection
            profile={report.audience_profile}
            onRegenerate={handleRefresh}
            regenerating={refreshing}
          />
        )}

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 2: CHANNEL RECOMMENDATIONS
           ══════════════════════════════════════════════════════════════════ */}
        {report.channel_recommendations.length > 0 && (
          <ChannelsSection channels={report.channel_recommendations} />
        )}

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 3: WINNING MESSAGES
           ══════════════════════════════════════════════════════════════════ */}
        {report.winning_messages.length > 0 && (
          <MessagesSection messages={report.winning_messages} />
        )}

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 4: COMPETITOR TABLE
           ══════════════════════════════════════════════════════════════════ */}
        <CompetitorSection
          competitors={report.competitor_table}
          insight={report.competitor_insight}
        />

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 5: WEEKLY CONTENT PLAN
           ══════════════════════════════════════════════════════════════════ */}
        {report.weekly_plan && (
          <WeeklyPlanSection
            plan={report.weekly_plan}
            onRegenerate={handleRegeneratePlan}
            regenerating={regeneratingPlan}
            onExportPdf={handleExportPdf}
            exportingPdf={false}
          />
        )}
      </div>
    </div>
  );
}
