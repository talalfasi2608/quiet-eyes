import { useState, useEffect } from 'react';
import {
  X,
  Copy,
  CheckCircle2,
  ThumbsDown,
  ExternalLink,
  Clock,
  Tag,
  MapPin,
  Facebook,
  Instagram,
  Search,
  Hash,
  Globe,
  MessageCircle,
  BarChart3,
  Loader2,
  Sparkles,
  Check,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { apiFetch } from '../../services/api';

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
  sniped_at: string | null;
  intent_signals: {
    matched_keywords?: string[];
    query_used?: string;
    blueprint_matches?: string[];
    intent_category?: string;
  } | null;
}

interface LeadDetailModalProps {
  lead: Lead;
  onClose: () => void;
  onMarkHandled: (id: string) => void;
  onDismiss: (id: string) => void;
  externalUrl: string | null;
}

function PlatformIcon({ platform, size = 5 }: { platform: string; size?: number }) {
  const cls = `w-${size} h-${size}`;
  const p = platform.toLowerCase();
  if (p === 'facebook') return <Facebook className={`${cls} text-blue-400`} />;
  if (p === 'instagram') return <Instagram className={`${cls} text-pink-400`} />;
  if (p === 'google') return <Search className={`${cls} text-emerald-400`} />;
  if (p === 'reddit') return <Hash className={`${cls} text-orange-400`} />;
  if (p === 'whatsapp') return <MessageCircle className={`${cls} text-green-400`} />;
  if (p === 'forum') return <MessageCircle className={`${cls} text-cyan-400`} />;
  return <Globe className={`${cls} text-gray-400`} />;
}

const PLATFORM_LABELS: Record<string, string> = {
  facebook: 'פייסבוק',
  instagram: 'אינסטגרם',
  google: 'גוגל',
  reddit: 'רדיט',
  whatsapp: 'וואטסאפ',
  forum: 'פורום',
};

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('he-IL', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

export default function LeadDetailModal({
  lead,
  onClose,
  onMarkHandled,
  onDismiss,
  externalUrl,
}: LeadDetailModalProps) {
  const relevancePct = Math.round(lead.relevance_score * 100);
  const relevanceColor =
    relevancePct >= 80 ? 'text-emerald-400' : relevancePct >= 60 ? 'text-amber-400' : 'text-red-400';
  const relevanceBarColor =
    relevancePct >= 80 ? 'bg-emerald-500' : relevancePct >= 60 ? 'bg-amber-500' : 'bg-red-500';

  const [aiReply, setAiReply] = useState<string | null>(null);
  const [loadingReply, setLoadingReply] = useState(false);
  const [copied, setCopied] = useState(false);
  const [markedDone, setMarkedDone] = useState(false);

  // Auto-generate AI reply when modal opens
  useEffect(() => {
    if (lead.status !== 'dismissed') {
      generateReply();
    }
  }, [lead.id]);

  const generateReply = async () => {
    setLoadingReply(true);
    try {
      const res = await apiFetch(`/leads/${lead.id}/generate-reply`, {
        method: 'POST',
        body: JSON.stringify({ business_id: lead.business_id }),
      });
      if (res.ok) {
        const data = await res.json();
        setAiReply(data.reply || null);
      }
    } catch {
      // Fallback — don't block the modal
    } finally {
      setLoadingReply(false);
    }
  };

  const handleCopyReply = async () => {
    if (!aiReply) return;
    try {
      await navigator.clipboard.writeText(aiReply);
      setCopied(true);
      toast.success('התגובה הועתקה!');
      // Mark as handled after copy
      onMarkHandled(lead.id);
      setMarkedDone(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      toast.error('לא ניתן להעתיק');
    }
  };

  const keywords = [
    ...(lead.intent_signals?.matched_keywords || []),
    ...(lead.intent_signals?.blueprint_matches || []),
  ].slice(0, 6);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Modal */}
      <div
        dir="rtl"
        className="relative w-full max-w-lg bg-gray-900 border border-gray-700/50 rounded-2xl shadow-2xl shadow-black/50 max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 pb-4 border-b border-gray-700/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500/20 to-orange-500/20 flex items-center justify-center">
              <PlatformIcon platform={lead.platform} size={5} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">פנה עכשיו</h2>
              <span className="text-xs text-gray-500">
                {PLATFORM_LABELS[lead.platform.toLowerCase()] || lead.platform}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700/50 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Full post text */}
          <div className="p-4 bg-gray-800/60 rounded-xl border border-gray-700/30">
            <p className="text-xs text-gray-500 mb-2 font-medium">הפוסט המקורי</p>
            <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">
              {lead.original_text || lead.summary}
            </p>
          </div>

          {/* Source info */}
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDate(lead.created_at)}
            </span>
            <span className="flex items-center gap-1">
              <BarChart3 className="w-3 h-3" />
              רלוונטיות: <span className={`font-bold ${relevanceColor}`}>{relevancePct}%</span>
            </span>
          </div>

          {/* Keywords */}
          {keywords.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {keywords.map((tag, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/15 text-amber-400 border border-amber-500/30"
                >
                  <Tag className="w-2.5 h-2.5" />
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* AI-Generated Reply */}
          <div className="p-4 bg-cyan-500/5 rounded-xl border border-cyan-500/20">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <span className="text-sm font-bold text-cyan-400">תגובה מוכנה להעתקה</span>
            </div>
            {loadingReply ? (
              <div className="flex items-center gap-2 py-4 justify-center">
                <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
                <span className="text-sm text-gray-400">המוח כותב תגובה...</span>
              </div>
            ) : aiReply ? (
              <div className="bg-gray-800/60 rounded-lg p-3 text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">
                {aiReply}
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-2">לא ניתן ליצור תגובה כרגע</p>
            )}
          </div>

          {/* Marked done confirmation */}
          {markedDone && (
            <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/30 flex items-center gap-2 animate-in fade-in">
              <Check className="w-5 h-5 text-emerald-400" />
              <span className="text-sm text-emerald-400 font-medium">סימנו שפנית 💪</span>
            </div>
          )}
        </div>

        {/* Footer — action buttons */}
        <div className="p-5 pt-4 border-t border-gray-700/50 space-y-3">
          {/* Primary: Copy AI Reply */}
          <button
            onClick={handleCopyReply}
            disabled={!aiReply || loadingReply}
            className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all active:scale-95 ${
              copied
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white hover:shadow-lg hover:shadow-cyan-500/30'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {copied ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                הועתק!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                העתק תגובה
              </>
            )}
          </button>

          {/* Secondary row */}
          <div className="grid grid-cols-2 gap-2">
            {externalUrl ? (
              <a
                href={externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gray-800/60 text-gray-300 text-sm font-medium border border-gray-700/50 hover:bg-gray-700/50 hover:text-white transition-all"
              >
                <ExternalLink className="w-4 h-4" />
                פתח פוסט מקורי
              </a>
            ) : (
              <div />
            )}
            {lead.status === 'new' && !markedDone && (
              <button
                onClick={() => {
                  onDismiss(lead.id);
                  onClose();
                }}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-gray-400 text-sm font-medium border border-gray-700/50 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 transition-all"
              >
                <ThumbsDown className="w-4 h-4" />
                לא רלוונטי
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
