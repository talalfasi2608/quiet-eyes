import { useState, useEffect, useCallback } from 'react';
import {
  X,
  Star,
  Globe,
  Phone,
  AlertTriangle,
  ExternalLink,
  MessageSquare,
  Search,
  Loader2,
  Shield,
  Clock,
} from 'lucide-react';
import { API_BASE } from '../../config/api';
import { apiFetch } from '../../services/api';

interface CompetitorDetail {
  competitor: {
    id: string;
    name: string;
    google_rating: number | null;
    google_reviews_count: number | null;
    perceived_threat_level: string;
    identified_weakness: string | null;
    website: string | null;
    phone: string | null;
    address: string | null;
    description: string | null;
  };
  intelligence: Array<{
    id: string;
    competitor_name: string;
    public_sentiment: string;
    sentiment_details: string;
    created_at: string;
    [key: string]: unknown;
  }>;
  latest_snapshot: {
    rating: number;
    reviews_count: number;
    followers_count: number;
    created_at: string;
  } | null;
}

interface CompetitorDrawerProps {
  competitorId: string | null;
  onClose: () => void;
}

function ThreatBadge({ level }: { level: string }) {
  const config: Record<string, { bg: string; text: string; border: string; label: string }> = {
    High: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30', label: 'איום גבוה' },
    Medium: { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30', label: 'איום בינוני' },
    Low: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30', label: 'איום נמוך' },
  };
  const c = config[level] || config.Medium;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${c.bg} ${c.text} ${c.border}`}>
      <Shield className="w-3 h-3" />
      {c.label}
    </span>
  );
}

export default function CompetitorDrawer({ competitorId, onClose }: CompetitorDrawerProps) {
  const [data, setData] = useState<CompetitorDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [researching, setResearching] = useState(false);

  const fetchDetail = useCallback(async () => {
    if (!competitorId) return;
    setLoading(true);
    setData(null);
    try {
      const res = await apiFetch(`/competitor/${competitorId}/detail`);
      if (res.ok) {
        const result = await res.json();
        if (result.success) setData(result);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [competitorId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  // Close on Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleResearch = async () => {
    if (!competitorId || researching) return;
    setResearching(true);
    try {
      await apiFetch(`/research/competitor/${competitorId}`, { method: 'POST' });
      await fetchDetail();
    } catch {
      // ignore
    } finally {
      setResearching(false);
    }
  };

  const handleAskCOO = () => {
    if (!data?.competitor) return;
    const event = new CustomEvent('openAiChat', {
      detail: { message: `תן לי ניתוח מעמיק על ${data.competitor.name} ואיך להתחרות בהם` },
    });
    window.dispatchEvent(event);
    onClose();
  };

  if (!competitorId) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div className="fixed inset-y-0 left-0 z-50 w-full max-w-md bg-gray-900 border-r border-gray-700/50 shadow-2xl overflow-y-auto animate-in slide-in-from-left" dir="rtl">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur-sm border-b border-gray-700/50 p-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">פרטי מתחרה</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-5">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
            </div>
          ) : !data ? (
            <div className="text-center py-16 text-gray-400">לא נמצאו נתונים</div>
          ) : (
            <>
              {/* Name & Rating */}
              <div>
                <h3 className="text-xl font-bold text-white mb-2">{data.competitor.name}</h3>
                <div className="flex items-center gap-3 flex-wrap">
                  <ThreatBadge level={data.competitor.perceived_threat_level} />
                  {data.competitor.google_rating && (
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                      <span className="text-white font-medium">{data.competitor.google_rating}</span>
                      <span className="text-gray-500 text-sm">
                        ({data.competitor.google_reviews_count || 0} ביקורות)
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Contact Links */}
              <div className="flex items-center gap-3 flex-wrap">
                {data.competitor.website && (
                  <a
                    href={data.competitor.website.startsWith('http') ? data.competitor.website : `https://${data.competitor.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/15 text-indigo-400 text-sm border border-indigo-500/30 hover:bg-indigo-500/25 transition-colors"
                  >
                    <Globe className="w-3.5 h-3.5" />
                    אתר
                    <ExternalLink className="w-3 h-3 opacity-70" />
                  </a>
                )}
                {data.competitor.phone && (
                  <a
                    href={`tel:${data.competitor.phone}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 text-sm border border-emerald-500/30 hover:bg-emerald-500/25 transition-colors"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    {data.competitor.phone}
                  </a>
                )}
              </div>

              {/* Address */}
              {data.competitor.address && (
                <p className="text-gray-400 text-sm">{data.competitor.address}</p>
              )}

              {/* Identified Weakness */}
              {data.competitor.identified_weakness && (
                <div className="p-3 bg-red-500/10 rounded-lg border border-red-500/20">
                  <p className="text-red-400 text-xs font-medium mb-1 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    חולשה שזוהתה
                  </p>
                  <p className="text-gray-300 text-sm leading-relaxed">
                    {data.competitor.identified_weakness}
                  </p>
                </div>
              )}

              {/* Latest Snapshot */}
              {data.latest_snapshot && (
                <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700/50">
                  <p className="text-gray-400 text-xs mb-2 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    תמונת מצב אחרונה
                  </p>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <span className="text-white font-bold">{data.latest_snapshot.rating || '-'}</span>
                      <span className="text-gray-500 text-xs block">דירוג</span>
                    </div>
                    <div>
                      <span className="text-white font-bold">{data.latest_snapshot.reviews_count || '-'}</span>
                      <span className="text-gray-500 text-xs block">ביקורות</span>
                    </div>
                    <div>
                      <span className="text-white font-bold">{data.latest_snapshot.followers_count || '-'}</span>
                      <span className="text-gray-500 text-xs block">עוקבים</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Intelligence Feed */}
              {data.intelligence && data.intelligence.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-white mb-3">מודיעין אחרון</h4>
                  <div className="space-y-2">
                    {data.intelligence.map((intel) => (
                      <div key={intel.id} className="p-3 bg-gray-800/40 rounded-lg border border-gray-700/30">
                        {intel.public_sentiment && (
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            intel.public_sentiment === 'positive' ? 'bg-emerald-500/20 text-emerald-400' :
                            intel.public_sentiment === 'negative' ? 'bg-red-500/20 text-red-400' :
                            'bg-gray-500/20 text-gray-400'
                          }`}>
                            {intel.public_sentiment}
                          </span>
                        )}
                        {intel.sentiment_details && (
                          <p className="text-gray-300 text-sm mt-1.5 leading-relaxed">
                            {intel.sentiment_details}
                          </p>
                        )}
                        <p className="text-gray-500 text-xs mt-1">
                          {new Date(intel.created_at).toLocaleDateString('he-IL')}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleResearch}
                  disabled={researching}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-500 transition-colors disabled:opacity-50"
                >
                  {researching ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                  חקור
                </button>
                <button
                  onClick={handleAskCOO}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-cyan-600 text-white font-medium hover:bg-cyan-500 transition-colors"
                >
                  <MessageSquare className="w-4 h-4" />
                  שאל את ה-COO
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
