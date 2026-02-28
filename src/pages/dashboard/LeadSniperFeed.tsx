import { useState, useEffect, useCallback } from 'react';
import { useSimulation } from '../../context/SimulationContext';
import {
  Crosshair,
  Loader2,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Radio,
  Eye,
  X,
  CheckCircle2,
  Clock,
  Filter,
  Zap,
  Facebook,
  Globe,
  MessageCircle,
  Instagram,
  Search,
  Hash,
  ThumbsUp,
  ThumbsDown,
  Tag,
  BarChart3,
  Download,
  Send,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { apiFetch } from '../../services/api';
import { API_BASE } from '../../config/api';
import LeadDetailModal from '../../components/ui/LeadDetailModal';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

type IntentCategory = 'all' | 'looking_for_service' | 'comparing_prices' | 'complaint' | 'recommendation_request';

interface Lead {
  id: string;
  business_id: string;
  platform: string;
  summary: string;
  source_url: string | null;
  original_text: string | null;
  search_query: string | null;
  relevance_score: number;
  status: 'new' | 'sniped' | 'dismissed';
  created_at: string;
  published_date: string | null;
  sniped_at: string | null;
  intent_signals: {
    matched_keywords?: string[];
    query_used?: string;
    blueprint_matches?: string[];
    intent_category?: string;
    lead_type?: string;
  } | null;
}

type RejectionReason = 'wrong_industry' | 'too_far' | 'not_a_lead' | 'spam' | 'irrelevant' | 'other';

interface FeedbackStats {
  total_feedback: number;
  approval_rate: number;
  approvals: number;
  rejections: number;
  dismissals: number;
  top_rejection_reason: string | null;
}

const REJECTION_LABELS: Record<RejectionReason, string> = {
  wrong_industry: 'תעשייה לא נכונה',
  too_far: 'רחוק מדי',
  not_a_lead: 'לא ליד',
  spam: 'ספאם',
  irrelevant: 'לא רלוונטי',
  other: 'אחר',
};

interface LeadsResponse {
  success: boolean;
  leads: Lead[];
  total: number;
  counts: {
    new: number;
    sniped: number;
    dismissed: number;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function LiveBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/20 border border-red-500/40">
      <span className="relative flex h-2.5 w-2.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
      </span>
      <span className="text-red-400 text-xs font-bold tracking-wider uppercase">LIVE</span>
    </span>
  );
}

function SniperScope({ isScanning }: { isScanning: boolean }) {
  return (
    <div className="relative w-20 h-20">
      <div
        className={`absolute inset-0 rounded-full border-2 border-red-500/30 ${isScanning ? 'animate-ping' : ''}`}
        style={{ animationDuration: '2s' }}
      />
      <div
        className={`absolute inset-2 rounded-full border-2 border-red-500/50 ${isScanning ? 'animate-pulse' : ''}`}
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className={`w-11 h-11 rounded-xl bg-gradient-to-br from-red-600 to-orange-600 flex items-center justify-center shadow-lg shadow-red-500/30 ${
            isScanning ? 'animate-pulse' : ''
          }`}
        >
          <Crosshair className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  );
}

function PlatformIcon({ platform }: { platform: string }) {
  const p = platform.toLowerCase();
  if (p === 'facebook') return <Facebook className="w-5 h-5 text-blue-400" />;
  if (p === 'instagram') return <Instagram className="w-5 h-5 text-pink-400" />;
  if (p === 'google') return <Search className="w-5 h-5 text-emerald-400" />;
  if (p === 'reddit') return <Hash className="w-5 h-5 text-orange-400" />;
  if (p === 'whatsapp') return <MessageCircle className="w-5 h-5 text-green-400" />;
  if (p === 'forum') return <MessageCircle className="w-5 h-5 text-cyan-400" />;
  return <Globe className="w-5 h-5 text-gray-400" />;
}

function isValidUrl(url: string | null): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function PlatformBadge({ platform }: { platform: string }) {
  const p = platform.toLowerCase();
  const config: Record<string, { bg: string; text: string; border: string; label: string }> = {
    facebook: { bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/30', label: 'פייסבוק' },
    instagram: { bg: 'bg-pink-500/15', text: 'text-pink-400', border: 'border-pink-500/30', label: 'אינסטגרם' },
    google: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30', label: 'גוגל' },
    reddit: { bg: 'bg-orange-500/15', text: 'text-orange-400', border: 'border-orange-500/30', label: 'רדיט' },
    whatsapp: { bg: 'bg-green-500/15', text: 'text-green-400', border: 'border-green-500/30', label: 'וואטסאפ' },
    forum: { bg: 'bg-cyan-500/15', text: 'text-cyan-400', border: 'border-cyan-500/30', label: 'פורום' },
  };
  const c = config[p] || { bg: 'bg-gray-500/15', text: 'text-gray-400', border: 'border-gray-500/30', label: platform };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${c.bg} ${c.text} ${c.border}`}>
      <PlatformIcon platform={platform} />
      {c.label}
    </span>
  );
}

function RelevanceBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color = pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-500' : 'bg-red-500';
  const scoreLabel = pct >= 85
    ? 'חם מאוד 🔥'
    : pct >= 70
    ? 'שווה לפנות 👍'
    : pct >= 50
    ? 'אולי מתאים 🤷'
    : 'פחות רלוונטי';
  return (
    <div className="flex items-center gap-2" dir="ltr">
      <div className="flex-1 h-1 bg-gray-700/50 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-gray-500 w-7 text-left">{pct}%</span>
      <span className="text-[10px] text-gray-400">{scoreLabel}</span>
    </div>
  );
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const then = new Date(dateStr);
  const diffMs = now.getTime() - then.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'עכשיו';
  if (mins < 60) return `לפני ${mins} דק׳`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `לפני ${hours} שע׳`;
  const days = Math.floor(hours / 24);
  return `לפני ${days} ימים`;
}

const filterLabels: Record<string, string> = {
  all: 'כל הלידים',
  new: 'לידים חדשים',
  sniped: 'לידים שנתפסו',
  dismissed: 'לידים שנדחו',
};

const INTENT_CATEGORIES: { key: IntentCategory; label: string; icon: typeof Search; color: string }[] = [
  { key: 'all', label: 'הכל', icon: Filter, color: 'text-gray-400 bg-gray-500/15 border-gray-500/30' },
  { key: 'looking_for_service', label: 'מחפש שירות', icon: Search, color: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30' },
  { key: 'comparing_prices', label: 'משווה מחירים', icon: BarChart3, color: 'text-blue-400 bg-blue-500/15 border-blue-500/30' },
  { key: 'complaint', label: 'תלונה', icon: AlertCircle, color: 'text-red-400 bg-red-500/15 border-red-500/30' },
  { key: 'recommendation_request', label: 'בקשת המלצה', icon: MessageCircle, color: 'text-amber-400 bg-amber-500/15 border-amber-500/30' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// REJECTION REASON PICKER
// ═══════════════════════════════════════════════════════════════════════════════

function RejectionPicker({
  onSelect,
  onCancel,
}: {
  onSelect: (reason: RejectionReason) => void;
  onCancel: () => void;
}) {
  return (
    <div className="absolute inset-0 z-10 bg-gray-900/95 rounded-xl flex flex-col items-center justify-center p-4 animate-in fade-in">
      <p className="text-sm text-gray-300 mb-3 font-medium">למה דחית?</p>
      <div className="grid grid-cols-2 gap-2 w-full">
        {(Object.entries(REJECTION_LABELS) as [RejectionReason, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => onSelect(key)}
            className="px-3 py-2 text-xs rounded-lg border border-gray-600/50 text-gray-300 hover:bg-red-500/20 hover:border-red-500/50 hover:text-red-300 transition-all"
          >
            {label}
          </button>
        ))}
      </div>
      <button
        onClick={onCancel}
        className="mt-3 text-xs text-gray-500 hover:text-gray-300 transition-colors"
      >
        ביטול
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// KEYWORD BADGES
// ═══════════════════════════════════════════════════════════════════════════════

function IntentBadges({ signals }: { signals: Lead['intent_signals'] }) {
  if (!signals) return null;
  const keywords = signals.matched_keywords || [];
  const blueprintMatches = signals.blueprint_matches || [];
  const allTags = [...keywords, ...blueprintMatches].slice(0, 4);

  if (allTags.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 mb-2">
      {allTags.map((tag, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/15 text-amber-400 border border-amber-500/30"
        >
          <Tag className="w-2.5 h-2.5" />
          {tag}
        </span>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// FEEDBACK STATS BAR
// ═══════════════════════════════════════════════════════════════════════════════

function FeedbackStatsBar({ stats }: { stats: FeedbackStats | null }) {
  if (!stats || !stats.total_feedback) return null;

  const approvalPct = Math.round((stats.approval_rate || 0) * 100);

  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-3 mb-3">
        <BarChart3 className="w-5 h-5 text-indigo-400" />
        <h3 className="text-sm font-semibold text-white">דירוגי לידים</h3>
        <span className="text-xs text-gray-500">({stats.total_feedback} דירוגים)</span>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-400">אחוז אישור</span>
            <span className={`text-sm font-bold ${approvalPct >= 70 ? 'text-emerald-400' : approvalPct >= 40 ? 'text-amber-400' : 'text-red-400'}`}>
              {approvalPct}%
            </span>
          </div>
          <div className="h-2 bg-gray-700/50 rounded-full overflow-hidden flex" dir="ltr">
            <div className="h-full bg-emerald-500 transition-all" style={{ width: `${approvalPct}%` }} />
            <div className="h-full bg-red-500 transition-all" style={{ width: `${100 - approvalPct}%` }} />
          </div>
        </div>
        <div className="flex gap-3 text-xs">
          <span className="text-emerald-400">{stats.approvals} <ThumbsUp className="w-3 h-3 inline" /></span>
          <span className="text-red-400">{stats.rejections} <ThumbsDown className="w-3 h-3 inline" /></span>
        </div>
        {stats.top_rejection_reason && (
          <div className="text-xs text-gray-500">
            סיבה עיקרית: <span className="text-gray-400">{REJECTION_LABELS[stats.top_rejection_reason as RejectionReason] || stats.top_rejection_reason}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// FLASH CARD COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

function LeadFlashCard({
  lead,
  onApprove,
  onReject,
  onDismiss,
  onPushCRM,
  onView,
}: {
  lead: Lead;
  onApprove: (id: string) => void;
  onReject: (id: string, reason: RejectionReason) => void;
  onDismiss: (id: string) => void;
  onPushCRM?: (id: string) => void;
  onView: (lead: Lead) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showRejectPicker, setShowRejectPicker] = useState(false);

  const isSniped = lead.status === 'sniped';
  const isDismissed = lead.status === 'dismissed';

  const borderColor = isSniped
    ? 'border-emerald-500/50'
    : isDismissed
    ? 'border-gray-600/30'
    : 'border-red-500/40';

  return (
    <div
      dir="rtl"
      className={`glass-card p-0 overflow-hidden border-r-4 ${borderColor} transition-all duration-300 relative ${
        isDismissed ? 'opacity-50' : 'hover:shadow-lg hover:shadow-red-500/10'
      }`}
    >
      {/* Rejection Reason Overlay */}
      {showRejectPicker && (
        <RejectionPicker
          onSelect={(reason) => {
            onReject(lead.id, reason);
            setShowRejectPicker(false);
          }}
          onCancel={() => setShowRejectPicker(false)}
        />
      )}

      {/* Card Header */}
      <div className="px-3 py-2">
        <div className="flex items-center justify-between mb-1.5">
          <PlatformBadge platform={lead.platform} />
          <div className="flex items-center gap-1.5">
            {lead.status === 'new' && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 text-[10px] animate-pulse">
                <Zap className="w-2.5 h-2.5" />
                חדש
              </span>
            )}
            {isSniped && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px]">
                <CheckCircle2 className="w-2.5 h-2.5" />
                אושר
              </span>
            )}
            <span className="text-[10px] text-gray-500 flex items-center gap-0.5">
              <Clock className="w-2.5 h-2.5" />
              {lead.published_date ? timeAgo(lead.published_date) : timeAgo(lead.created_at)}
            </span>
          </div>
        </div>

        {/* Summary */}
        <p className="text-white text-xs font-medium leading-snug mb-1 line-clamp-2">
          {lead.summary}
        </p>

        {/* Intent Signal Badges */}
        <IntentBadges signals={lead.intent_signals} />

        {/* Relevance */}
        <div className="mb-1">
          <RelevanceBar score={lead.relevance_score} />
        </div>

        {/* Expandable original text */}
        {lead.original_text && !expanded && (
          <button
            onClick={() => setExpanded(true)}
            className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-1"
          >
            <Eye className="w-2.5 h-2.5" />
            הצג טקסט מקורי
          </button>
        )}
        {expanded && lead.original_text && (
          <>
            <div className="p-1.5 bg-gray-800/50 rounded-lg text-[10px] text-gray-400 leading-relaxed mb-1 max-h-20 overflow-y-auto">
              {lead.original_text}
            </div>
            <button
              onClick={() => setExpanded(false)}
              className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-1"
            >
              <Eye className="w-2.5 h-2.5" />
              הסתר
            </button>
          </>
        )}
      </div>

      {/* Card Actions — RLHF Feedback */}
      {!isDismissed && (
        <div className="px-3 py-1.5 border-t border-gray-700/30 flex items-center justify-between bg-gray-800/20">
          {!isSniped ? (
            <>
              <button
                onClick={() => setShowRejectPicker(true)}
                className="flex items-center gap-1 text-[11px] text-red-400/70 hover:text-red-400 transition-colors px-2 py-1 rounded-lg hover:bg-red-500/10"
              >
                <ThumbsDown className="w-3 h-3" />
                לא מתאים לי
              </button>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => onView(lead)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gray-700/40 text-cyan-400 text-xs font-medium border border-gray-600/50 hover:bg-gray-700/60 hover:border-cyan-500/30 transition-all"
                >
                  <Eye className="w-3 h-3" />
                  צפה
                </button>
                <button
                  onClick={() => onApprove(lead.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-semibold hover:shadow-lg hover:shadow-emerald-500/30 transition-all active:scale-95"
                >
                  <ThumbsUp className="w-3.5 h-3.5" />
                  פנה עכשיו
                </button>
              </div>
            </>
          ) : (
            <div className="w-full flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-emerald-400 text-xs">
                <ThumbsUp className="w-3.5 h-3.5" />
                שמור לטיפול
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => onView(lead)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-700/40 text-cyan-400 text-[11px] font-medium border border-gray-600/50 hover:bg-gray-700/60 hover:border-cyan-500/30 transition-all"
                >
                  <Eye className="w-3 h-3" />
                  צפה
                </button>
                {onPushCRM && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onPushCRM(lead.id);
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-500/20 text-blue-400 text-[11px] font-medium hover:bg-blue-500/30 border border-blue-500/30 transition-all"
                  >
                    <Send className="w-3 h-3" />
                    CRM
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SKELETON
// ═══════════════════════════════════════════════════════════════════════════════

function CardSkeleton() {
  return (
    <div className="glass-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="w-24 h-6 rounded-full bg-gray-700/50 animate-pulse" />
        <div className="w-16 h-4 rounded bg-gray-700/50 animate-pulse" />
      </div>
      <div className="w-full h-4 rounded bg-gray-700/50 animate-pulse" />
      <div className="w-3/4 h-4 rounded bg-gray-700/50 animate-pulse" />
      <div className="w-full h-1.5 rounded bg-gray-700/50 animate-pulse" />
      <div className="flex justify-between pt-2 border-t border-gray-700/30">
        <div className="w-16 h-6 rounded bg-gray-700/50 animate-pulse" />
        <div className="w-28 h-8 rounded-xl bg-gray-700/50 animate-pulse" />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function LeadSniperFeed() {
  const { currentProfile } = useSimulation();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [counts, setCounts] = useState({ new: 0, sniped: 0, dismissed: 0 });
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'new' | 'sniped' | 'dismissed'>('all');
  const [intentFilter, setIntentFilter] = useState<IntentCategory>('all');
  const [feedbackStats, setFeedbackStats] = useState<FeedbackStats | null>(null);
  const [crmConfigured, setCrmConfigured] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [prevLeadCount, setPrevLeadCount] = useState(0);
  const [highlightNew, setHighlightNew] = useState(false);
  const [modalLead, setModalLead] = useState<Lead | null>(null);

  // ── Fetch leads ────────────────────────────────────────────────────────
  const fetchLeads = useCallback(async () => {
    if (!currentProfile?.id) return;

    try {
      setLoading(true);
      const statusParam = activeFilter !== 'all' ? `&status=${activeFilter}` : '';
      const response = await apiFetch(
        `/leads/${currentProfile.id}?limit=50${statusParam}`
      );

      if (!response.ok) throw new Error('שגיאה בטעינת לידים');

      const data: LeadsResponse = await response.json();
      setLeads(data.leads);
      setCounts(data.counts);
      setTotal(data.total);
      setError(null);
    } catch (err) {
      setError('לא ניתן לטעון את הלידים');
    } finally {
      setLoading(false);
    }
  }, [currentProfile?.id, activeFilter]);

  // ── Trigger sniping mission ────────────────────────────────────────────
  const triggerMission = async () => {
    if (!currentProfile?.id || scanning) return;

    setScanning(true);
    try {
      const res = await apiFetch(`/leads/snipe/${currentProfile.id}`, {
        method: 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        if (data.leads_saved > 0) {
          toast.success(`נמצאו ${data.leads_saved} לידים חדשים!`, { icon: '🎯' });
        }
      }
      await fetchLeads();
    } catch (err) {
      toast.error('שגיאה בהפעלת המשימה');
    } finally {
      setScanning(false);
    }
  };

  // ── Fetch feedback stats ──────────────────────────────────────────────
  const fetchFeedbackStats = useCallback(async () => {
    if (!currentProfile?.id) return;
    try {
      const res = await apiFetch(`/leads/${currentProfile.id}/feedback-stats`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) setFeedbackStats(data);
      }
    } catch {
      // Non-critical, silently ignore
    }
  }, [currentProfile?.id]);

  // ── Submit RLHF Feedback ────────────────────────────────────────────
  const submitFeedback = async (
    leadId: string,
    action: 'approve' | 'reject' | 'dismiss',
    rejectionReason?: RejectionReason
  ) => {
    try {
      await apiFetch(`/leads/${leadId}/feedback`, {
        method: 'POST',
        body: JSON.stringify({
          user_id: currentProfile?.id || 'anonymous',
          action,
          rejection_reason: rejectionReason || null,
        }),
      });

      // Optimistically update local state
      const newStatus = action === 'approve' ? 'sniped' : 'dismissed';
      setLeads((prev) =>
        prev.map((l) =>
          l.id === leadId
            ? { ...l, status: newStatus as Lead['status'], sniped_at: action === 'approve' ? new Date().toISOString() : l.sniped_at }
            : l
        )
      );
      setCounts((prev) => ({
        ...prev,
        new: Math.max(0, prev.new - 1),
        [newStatus]: prev[newStatus as keyof typeof prev] + 1,
      }));

      // Refresh stats after feedback
      fetchFeedbackStats();
    } catch (err) {
      // silently ignore
    }
  };

  // ── "צפה" handler — ALWAYS opens modal ──────────────────────────────
  const handleViewLead = (lead: Lead) => {
    setModalLead(lead);
  };

  /** Returns a safe external URL for the modal's "פתח מקור" link, or null. */
  const getExternalUrl = (lead: Lead): string | null => {
    const url = lead.source_url;
    if (!url || !isValidUrl(url)) return null;
    // Google Maps and Instagram are technically valid but problematic
    if (url.includes('instagram.com')) return null;
    if (url.includes('google.com/maps') || url.includes('maps.google')) return null;
    return url;
  };

  const handlePushCRM = async (leadId: string) => {
    try {
      const res = await apiFetch(`/crm/push-lead`, {
        method: 'POST',
        body: JSON.stringify({ lead_id: leadId }),
      });
      if (res.ok) {
        toast.success('הליד נשלח ל-CRM בהצלחה!');
      } else {
        const err = await res.json().catch(() => null);
        toast.error(err?.detail || 'שגיאה בשליחה ל-CRM. ודאו שחיברתם CRM בהגדרות.');
      }
    } catch {
      toast.error('שגיאת רשת');
    }
  };

  // ── Check CRM status ─────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch(`/crm/status`);
        if (res.ok) {
          const data = await res.json();
          setCrmConfigured(!!data.configured);
        }
      } catch {
        // CRM status check failed — hide CRM buttons
      }
    })();
  }, []);

  useEffect(() => {
    fetchLeads();
    fetchFeedbackStats();
  }, [fetchLeads, fetchFeedbackStats]);

  // Auto-refresh when no leads yet (smart empty state)
  useEffect(() => {
    if (leads.length === 0 && !loading && !error && currentProfile?.id) {
      setIsSearching(true);
      const interval = setInterval(() => {
        fetchLeads();
      }, 15000);
      return () => clearInterval(interval);
    } else {
      setIsSearching(false);
    }
  }, [leads.length, loading, error, currentProfile?.id]);

  // Detect new lead arrival and trigger highlight
  useEffect(() => {
    if (leads.length > prevLeadCount && prevLeadCount === 0 && leads.length > 0) {
      setHighlightNew(true);
      toast.success('מצאנו את הליד הראשון שלך!', { icon: '🎯', duration: 5000 });
      setTimeout(() => setHighlightNew(false), 3000);
    }
    setPrevLeadCount(leads.length);
  }, [leads.length]);

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div dir="rtl" className="fade-in sniper-grid" style={{
      display: 'grid',
      gridTemplateRows: 'auto auto auto 1fr',
      gap: '8px',
      padding: '12px 12px',
    }}>
      {/* On desktop: fixed viewport height. On mobile: natural flow */}
      <style>{`
        @media (min-width: 768px) {
          .sniper-grid { height: calc(100vh - 60px); overflow: hidden; padding: 16px !important; }
        }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* ── Compact Header ─────────────────────────────────────────── */}
      <header className="flex flex-wrap items-center justify-between gap-2 md:gap-3">
        <div className="flex items-center gap-2 md:gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-red-600 to-orange-600 flex items-center justify-center shadow-lg shadow-red-500/30 flex-shrink-0">
            <Crosshair className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-base md:text-lg font-bold text-white" style={{ fontFamily: "var(--font-display)" }}>מי מחפש אותי עכשיו? 🎯</h1>
          <span className="hidden md:inline text-xs text-gray-400">עיני מצא את האנשים שמחפשים בדיוק מה שאתה מציע</span>
          <LiveBadge />
          {scanning && (
            <span className="text-xs font-normal text-orange-400 flex items-center gap-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              👁️ עיני סורק עכשיו...
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {total > 0 && (
            <button
              onClick={() => {
                if (!currentProfile?.id) return;
                const a = document.createElement('a');
                a.href = `${API_BASE}/leads/${currentProfile.id}/export`;
                a.download = '';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
              }}
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-800/50 text-gray-300 border border-gray-700/50 hover:bg-gray-700/50 hover:text-white transition-all"
            >
              <Download className="w-4 h-4" />
              <span>ייצוא CSV</span>
            </button>
          )}
          <button
            onClick={triggerMission}
            disabled={scanning}
            className={`flex items-center gap-1.5 px-3 md:px-4 py-2 md:py-1.5 rounded-lg text-sm font-medium transition-all min-h-[44px] ${
              scanning
                ? 'bg-orange-600/30 text-orange-300 cursor-wait'
                : 'bg-gradient-to-r from-red-600 to-orange-600 text-white hover:shadow-lg hover:shadow-red-500/30 active:scale-95'
            }`}
          >
            {scanning ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="hidden md:inline">👁️ עיני סורק עכשיו...</span>
                <span className="md:hidden">👁️ עיני סורק עכשיו...</span>
              </>
            ) : (
              <>
                <Crosshair className="w-4 h-4" />
                <span className="hidden md:inline">התחל משימה</span>
                <span className="md:hidden">משימה</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* ── Compact Stats Bar ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          { key: 'all' as const, label: 'סה״כ לידים', count: total, icon: Radio, activeColor: 'indigo' },
          { key: 'new' as const, label: 'לידים חדשים', count: counts.new, icon: Zap, activeColor: 'red' },
          { key: 'sniped' as const, label: 'נתפסו', count: counts.sniped, icon: CheckCircle2, activeColor: 'emerald' },
          { key: 'dismissed' as const, label: 'נדחו', count: counts.dismissed, icon: X, activeColor: 'gray' },
        ].map(({ key, label, count, icon: Icon, activeColor }) => (
          <button
            key={key}
            onClick={() => setActiveFilter(key)}
            className={`p-2 rounded-lg border transition-all ${
              activeFilter === key
                ? `bg-${activeColor}-500/20 border-${activeColor}-500/50`
                : 'bg-gray-800/30 border-gray-700/50 hover:border-gray-600'
            }`}
          >
            <div className="flex items-center justify-between">
              <Icon
                className={`w-4 h-4 ${
                  activeFilter === key ? `text-${activeColor}-400` : 'text-gray-500'
                }`}
              />
              <span
                className={`text-lg font-bold ${
                  activeFilter === key ? `text-${activeColor}-400` : 'text-white'
                }`}
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {count}
              </span>
            </div>
            <span className="text-xs text-gray-400">{label}</span>
          </button>
        ))}
      </div>

      {/* ── Compact Feedback Stats + Intent Filter Row ──────────── */}
      <div className="flex items-center gap-3 overflow-x-auto pb-1 md:pb-0 md:flex-wrap scrollbar-hide">
        {/* Inline Feedback Stats */}
        {feedbackStats && feedbackStats.total_feedback > 0 && (
          <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-gray-800/40 border border-gray-700/40 text-xs">
            <BarChart3 className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-gray-400">דירוג:</span>
            <span className={`font-bold ${Math.round((feedbackStats.approval_rate || 0) * 100) >= 70 ? 'text-emerald-400' : Math.round((feedbackStats.approval_rate || 0) * 100) >= 40 ? 'text-amber-400' : 'text-red-400'}`}>
              {Math.round((feedbackStats.approval_rate || 0) * 100)}%
            </span>
            <span className="text-emerald-400">{feedbackStats.approvals}<ThumbsUp className="w-2.5 h-2.5 inline mr-0.5" /></span>
            <span className="text-red-400">{feedbackStats.rejections}<ThumbsDown className="w-2.5 h-2.5 inline mr-0.5" /></span>
          </div>
        )}

        {/* Separator */}
        {feedbackStats && feedbackStats.total_feedback > 0 && !loading && leads.length > 0 && (
          <div className="w-px h-5 bg-gray-700/50" />
        )}

        {/* Intent Category Filter */}
        {!loading && leads.length > 0 && (
          INTENT_CATEGORIES.map(({ key, label, icon: Icon, color }) => (
            <button
              key={key}
              onClick={() => setIntentFilter(key)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all whitespace-nowrap flex-shrink-0 min-h-[36px] ${
                intentFilter === key
                  ? color + ' ring-1 ring-offset-1 ring-offset-gray-900'
                  : 'text-gray-500 bg-gray-800/30 border-gray-700/50 hover:text-gray-300 hover:border-gray-600'
              }`}
            >
              <Icon className="w-3 h-3" />
              {label}
              {key !== 'all' && (
                <span className="opacity-60">
                  ({leads.filter(l => l.intent_signals?.intent_category === key).length})
                </span>
              )}
            </button>
          ))
        )}
      </div>

      {/* ── Scrollable Content Area ──────────────────────────────── */}
      <div style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ flex: 1, overflowY: 'auto' }}>

          {/* ── Loading State ─────────────────────────────────────── */}
          {loading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          )}

          {/* ── Error State ───────────────────────────────────────── */}
          {error && !loading && (
            <div className="glass-card p-8 text-center">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">שגיאה בטעינת לידים</h3>
              <p className="text-gray-400 mb-4">{error}</p>
              <button
                onClick={fetchLeads}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors"
              >
                נסה שוב
              </button>
            </div>
          )}

          {/* ── Empty State / Smart Searching ─────────────────────── */}
          {!loading && !error && leads.length === 0 && (
            <div className="glass-card p-8 md:p-12 text-center" dir="rtl">
              {isSearching && activeFilter === 'all' ? (
                <>
                  <div className="relative w-24 h-24 mx-auto mb-6">
                    <div className="absolute inset-0 rounded-full border-2 border-red-500/30 animate-ping" style={{ animationDuration: '2s' }} />
                    <div className="absolute inset-3 rounded-full border-2 border-orange-500/40 animate-ping" style={{ animationDuration: '3s' }} />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-600 to-orange-600 flex items-center justify-center shadow-lg shadow-red-500/30 animate-pulse">
                        <Eye className="w-7 h-7 text-white" />
                      </div>
                    </div>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">
                    עיני עדיין לא מצא לידים חדשים
                  </h3>
                  <p className="text-gray-400 mb-4 max-w-md mx-auto whitespace-pre-line leading-relaxed">
                    {"עיני עדיין לא מצא לידים חדשים.\nזה בדרך כלל לוקח כמה שעות אחרי ההגדרה הראשונית.\nבינתיים, וודא שהגדרת את מילות המפתח בהגדרות 🔧"}
                  </p>
                  <div className="flex items-center justify-center gap-2 text-sm text-orange-400 mb-4">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    👁️ עיני סורק עכשיו...
                  </div>
                  <button
                    onClick={() => window.location.href = '/dashboard/settings'}
                    className="px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-500 text-white rounded-xl font-medium hover:from-blue-500 hover:to-cyan-400 transition-all inline-flex items-center gap-2 min-h-[48px]"
                  >
                    <Search className="w-5 h-5" />
                    ערוך מילות מפתח
                  </button>
                </>
              ) : (
                <>
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-red-500/20 to-orange-500/20 flex items-center justify-center mx-auto mb-6">
                    <span className="text-4xl">🎯</span>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">
                    {activeFilter === 'all' ? 'עיני עדיין לא מצא לידים חדשים' : `אין ${filterLabels[activeFilter]}`}
                  </h3>
                  <p className="text-gray-400 mb-6 max-w-md mx-auto whitespace-pre-line leading-relaxed">
                    {activeFilter === 'all'
                      ? 'עיני עדיין לא מצא לידים חדשים.\nזה בדרך כלל לוקח כמה שעות אחרי ההגדרה הראשונית.\nבינתיים, וודא שהגדרת את מילות המפתח בהגדרות 🔧'
                      : 'נסה לשנות את הסינון או להפעיל משימה חדשה.'}
                  </p>
                  {activeFilter === 'all' ? (
                    <button
                      onClick={() => window.location.href = '/dashboard/settings'}
                      className="px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-500 text-white rounded-xl font-medium hover:from-blue-500 hover:to-cyan-400 transition-all inline-flex items-center gap-2 min-h-[48px]"
                    >
                      שנה הגדרות חיפוש
                    </button>
                  ) : (
                    <button
                      onClick={triggerMission}
                      disabled={scanning}
                      className="px-6 py-3 bg-gradient-to-r from-red-600 to-orange-600 text-white rounded-xl font-medium hover:shadow-lg hover:shadow-red-500/30 transition-all min-h-[48px]"
                    >
                      <Crosshair className="w-5 h-5 inline ml-2" />
                      הפעל משימה חדשה
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── Leads Grid ────────────────────────────────────────── */}
          {!loading && !error && leads.length > 0 && (() => {
            const filteredLeads = intentFilter === 'all'
              ? leads
              : leads.filter(l => l.intent_signals?.intent_category === intentFilter);

            return (
              <>
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Filter className="w-4 h-4 text-gray-400" />
                    {filterLabels[activeFilter]}
                    <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-xs">
                      {filteredLeads.length}
                    </span>
                  </h2>
                  <button
                    onClick={fetchLeads}
                    className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    רענן
                  </button>
                </div>

                <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pb-2 ${highlightNew ? 'animate-pulse ring-2 ring-emerald-500/30 rounded-2xl p-1' : ''}`}>
                  {filteredLeads.map((lead) => (
                    <LeadFlashCard
                      key={lead.id}
                      lead={lead}
                      onApprove={(id) => submitFeedback(id, 'approve')}
                      onReject={(id, reason) => submitFeedback(id, 'reject', reason)}
                      onDismiss={(id) => submitFeedback(id, 'dismiss')}
                      onPushCRM={crmConfigured ? handlePushCRM : undefined}
                      onView={handleViewLead}
                    />
                  ))}
                </div>

                {filteredLeads.length === 0 && intentFilter !== 'all' && (
                  <div className="glass-card p-8 text-center">
                    <p className="text-gray-400">אין לידים בקטגוריה זו</p>
                    <button
                      onClick={() => setIntentFilter('all')}
                      className="mt-2 text-sm text-indigo-400 hover:text-indigo-300"
                    >
                      הצג את כל הלידים
                    </button>
                  </div>
                )}
              </>
            );
          })()}

        </div>
      </div>

      {/* ── Lead Detail Modal ──────────────────────────────────────── */}
      {modalLead && (
        <LeadDetailModal
          lead={modalLead}
          onClose={() => setModalLead(null)}
          onMarkHandled={(id) => submitFeedback(id, 'approve')}
          onDismiss={(id) => submitFeedback(id, 'dismiss')}
          externalUrl={getExternalUrl(modalLead)}
        />
      )}
    </div>
  );
}
