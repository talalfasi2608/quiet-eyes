import {
  X,
  Copy,
  MessageCircle,
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
  BarChart3,
} from 'lucide-react';
import toast from 'react-hot-toast';

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
  externalUrl: string | null; // pre-validated external URL, or null
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

  const textToCopy = lead.original_text || lead.summary;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(textToCopy);
      toast.success('הטקסט הועתק!');
    } catch {
      toast.error('לא ניתן להעתיק');
    }
  };

  const handleWhatsApp = () => {
    const text = encodeURIComponent(
      `ליד חדש מ-${PLATFORM_LABELS[lead.platform.toLowerCase()] || lead.platform}:\n${lead.summary}`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer');
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
              <h2 className="text-base font-bold text-white">פרטי הליד</h2>
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
          {/* Summary */}
          <div>
            <p className="text-white text-sm font-medium leading-relaxed">{lead.summary}</p>
          </div>

          {/* Original text */}
          {lead.original_text && (
            <div className="p-4 bg-gray-800/60 rounded-xl border border-gray-700/30">
              <p className="text-xs text-gray-500 mb-2 font-medium">טקסט מקורי</p>
              <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
                {lead.original_text}
              </p>
            </div>
          )}

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

          {/* Meta info grid */}
          <div className="grid grid-cols-2 gap-3">
            {/* Relevance */}
            <div className="p-3 bg-gray-800/40 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="w-4 h-4 text-gray-500" />
                <span className="text-xs text-gray-500">רלוונטיות</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-lg font-bold ${relevanceColor}`}>{relevancePct}%</span>
                <div className="flex-1 h-1.5 bg-gray-700/50 rounded-full overflow-hidden" dir="ltr">
                  <div
                    className={`h-full rounded-full ${relevanceBarColor}`}
                    style={{ width: `${relevancePct}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Date */}
            <div className="p-3 bg-gray-800/40 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-gray-500" />
                <span className="text-xs text-gray-500">נמצא בתאריך</span>
              </div>
              <span className="text-sm text-gray-300">{formatDate(lead.created_at)}</span>
            </div>
          </div>

          {/* Search query */}
          {lead.search_query && (
            <div className="p-3 bg-gray-800/40 rounded-xl">
              <div className="flex items-center gap-2 mb-1">
                <Search className="w-4 h-4 text-gray-500" />
                <span className="text-xs text-gray-500">שאילתת חיפוש</span>
              </div>
              <p className="text-sm text-gray-300">{lead.search_query}</p>
            </div>
          )}

          {/* Location hint from Google Maps URL */}
          {lead.source_url?.includes('google.com/maps') && (
            <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-blue-400" />
                <span className="text-xs text-blue-400">מיקום מגוגל מפות</span>
              </div>
            </div>
          )}

          {/* External URL link */}
          {externalUrl && (
            <a
              href={externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 p-3 bg-gray-800/40 rounded-xl text-sm text-cyan-400 hover:bg-gray-700/50 transition-colors group"
            >
              <ExternalLink className="w-4 h-4 group-hover:translate-x-[-2px] transition-transform" />
              <span>פתח מקור מקורי</span>
              <span className="text-xs text-gray-600 truncate flex-1 text-left" dir="ltr">
                {externalUrl}
              </span>
            </a>
          )}
        </div>

        {/* Footer — action buttons */}
        <div className="p-5 pt-4 border-t border-gray-700/50 space-y-3">
          {/* Primary actions row */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gray-800/60 text-gray-300 text-sm font-medium border border-gray-700/50 hover:bg-gray-700/50 hover:text-white transition-all"
            >
              <Copy className="w-4 h-4" />
              העתק טקסט
            </button>
            <button
              onClick={handleWhatsApp}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-green-500/15 text-green-400 text-sm font-medium border border-green-500/30 hover:bg-green-500/25 transition-all"
            >
              <MessageCircle className="w-4 h-4" />
              שלח לוואטסאפ
            </button>
          </div>

          {/* Status actions row */}
          {lead.status === 'new' && (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  onDismiss(lead.id);
                  onClose();
                }}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-red-400/70 text-sm font-medium border border-gray-700/50 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 transition-all"
              >
                <ThumbsDown className="w-4 h-4" />
                לא רלוונטי
              </button>
              <button
                onClick={() => {
                  onMarkHandled(lead.id);
                  onClose();
                }}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm font-semibold hover:shadow-lg hover:shadow-emerald-500/30 transition-all active:scale-95"
              >
                <CheckCircle2 className="w-4 h-4" />
                סמן כטופל
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
