import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useSimulation } from '../../context/SimulationContext';
import { apiFetch } from '../../services/api';
import {
  Star,
  Search,
  Loader2,
  Shield,
  ChevronDown,
  ChevronUp,
  Plus,
  X,
  Sparkles,
  Globe,
  Phone,
  MapPin,
  ExternalLink,
} from 'lucide-react';

interface Competitor {
  id: string;
  name: string;
  place_id?: string;
  description?: string;
  perceived_threat_level: string;
  google_rating?: number;
  google_reviews_count?: number;
  identified_weakness?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  website?: string;
  phone?: string;
}

function ThreatBadge({ level }: { level: string }) {
  if (level === 'High')
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500/20 text-red-400 border border-red-500/30">
        <Shield className="w-3 h-3" />
        איום גבוה
      </span>
    );
  if (level === 'Medium')
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30">
        <Shield className="w-3 h-3" />
        איום בינוני
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
      <Shield className="w-3 h-3" />
      איום נמוך
    </span>
  );
}

function RatingBar({ label, rating, color }: { label: string; rating: number; color: string }) {
  const pct = Math.min((rating / 5) * 100, 100);
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-400 w-16 text-left flex-shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-gray-700/50 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-white font-bold w-8 text-center">{rating || '—'}</span>
    </div>
  );
}

export default function Landscape() {
  const { currentProfile } = useSimulation();
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [scanning, setScanning] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [aiInsights, setAiInsights] = useState<Record<string, string>>({});
  const [loadingInsight, setLoadingInsight] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addName, setAddName] = useState('');
  const [addWebsite, setAddWebsite] = useState('');
  const [adding, setAdding] = useState(false);
  const [filter, setFilter] = useState<'all' | 'High' | 'Medium' | 'Low'>('all');

  useEffect(() => {
    if (currentProfile?.id) fetchCompetitors(currentProfile.id);
  }, [currentProfile?.id]);

  const fetchCompetitors = async (businessId: string) => {
    try {
      const response = await apiFetch(`/competitors/${businessId}`);
      if (response.ok) {
        const data = await response.json();
        const seen = new Map<string, Competitor>();
        for (const c of (data.competitors || []) as Competitor[]) {
          const key = (c.place_id || c.name).trim().toLowerCase();
          if (!seen.has(key)) seen.set(key, c);
        }
        setCompetitors(Array.from(seen.values()));
      }
    } catch {
      toast.error('שגיאה בטעינת מתחרים');
    }
  };

  const getDistanceKm = (comp: Competitor): number | null => {
    const bizLat = currentProfile?.latitude;
    const bizLng = currentProfile?.longitude;
    if (!bizLat || !bizLng || !comp.latitude || !comp.longitude) return null;
    const R = 6371;
    const dLat = ((comp.latitude - bizLat) * Math.PI) / 180;
    const dLon = ((comp.longitude - bizLng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((bizLat * Math.PI) / 180) *
        Math.cos((comp.latitude * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const handleScan = async () => {
    if (!currentProfile?.id) return;
    setScanning(true);
    try {
      const res = await apiFetch(`/radar/sync/${currentProfile.id}`, { method: 'POST' });
      if (res.ok) {
        toast.success('סריקה הושלמה!');
        await fetchCompetitors(currentProfile.id);
      }
    } catch {
      toast.error('שגיאה בסריקה');
    } finally {
      setScanning(false);
    }
  };

  const handleExpand = async (compId: string) => {
    if (expandedId === compId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(compId);
    // Fetch AI insight if not cached
    if (!aiInsights[compId]) {
      setLoadingInsight(compId);
      try {
        const res = await apiFetch(`/competitor/${compId}/ai-insight`, { method: 'POST' });
        if (res.ok) {
          const data = await res.json();
          if (data.insight) {
            setAiInsights((prev) => ({ ...prev, [compId]: data.insight }));
          }
        }
      } catch {
        // Non-blocking
      } finally {
        setLoadingInsight(null);
      }
    }
  };

  const handleAddCompetitor = async () => {
    if (!currentProfile?.id || !addName.trim()) return;
    setAdding(true);
    try {
      const res = await apiFetch(`/competitors/${currentProfile.id}/add`, {
        method: 'POST',
        body: JSON.stringify({
          name: addName.trim(),
          website: addWebsite.trim() || undefined,
        }),
      });
      if (res.ok) {
        toast.success('מתחרה נוסף!');
        setShowAddModal(false);
        setAddName('');
        setAddWebsite('');
        await fetchCompetitors(currentProfile.id);
      } else {
        toast.error('שגיאה בהוספת מתחרה');
      }
    } catch {
      toast.error('שגיאה בהוספת מתחרה');
    } finally {
      setAdding(false);
    }
  };

  // Sort: High first, then Medium, then Low
  const sorted = [...competitors].sort((a, b) => {
    const order: Record<string, number> = { High: 0, Medium: 1, Low: 2 };
    return (order[a.perceived_threat_level] ?? 2) - (order[b.perceived_threat_level] ?? 2);
  });

  const filtered = filter === 'all' ? sorted : sorted.filter((c) => c.perceived_threat_level === filter);

  const highCount = competitors.filter((c) => c.perceived_threat_level === 'High').length;
  const medCount = competitors.filter((c) => c.perceived_threat_level === 'Medium').length;
  const lowCount = competitors.filter((c) => c.perceived_threat_level === 'Low').length;

  const bizRating = (currentProfile as Record<string, unknown>)?.google_rating as number | undefined;
  const bizReviews = (currentProfile as Record<string, unknown>)?.google_reviews_count as number | undefined;

  if (!currentProfile) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-60px)]">
        <Loader2 className="w-12 h-12 text-cyan-500 animate-spin" />
        <p className="text-gray-400 mr-3">טוען...</p>
      </div>
    );
  }

  return (
    <div dir="rtl" className="fade-in p-4 md:p-6 max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white">
            מה עושים המתחרים שלך? 👀
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            {competitors.length > 0
              ? `עיני עוקב אחרי ${competitors.length} עסקים`
              : 'סרוק כדי לגלות את המתחרים שלך'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-gray-800/60 text-gray-300 text-sm font-medium border border-gray-700/50 hover:bg-gray-700/50 hover:text-white transition-all"
          >
            <Plus className="w-4 h-4" />
            הוסף מתחרה
          </button>
          <button
            onClick={handleScan}
            disabled={scanning}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 text-white text-sm font-semibold hover:shadow-lg hover:shadow-cyan-500/30 transition-all disabled:opacity-50"
          >
            {scanning ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            {scanning ? 'סורק...' : 'סרוק מתחרים'}
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      {competitors.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {(
            [
              { key: 'all', label: `הכל (${competitors.length})` },
              { key: 'High', label: `חזקים (${highCount})` },
              { key: 'Medium', label: `בינוניים (${medCount})` },
              { key: 'Low', label: `חלשים (${lowCount})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium border whitespace-nowrap transition-all ${
                filter === tab.key
                  ? 'bg-cyan-500/15 text-cyan-400 border-cyan-500/40'
                  : 'bg-gray-800/40 text-gray-400 border-gray-700/50 hover:bg-gray-700/40'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Stats Summary */}
      {competitors.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="glass-card p-3 text-center">
            <div className="text-2xl font-bold text-red-400">{highCount}</div>
            <div className="text-[10px] text-gray-500 mt-0.5">איומים גבוהים</div>
          </div>
          <div className="glass-card p-3 text-center">
            <div className="text-2xl font-bold text-amber-400">{medCount}</div>
            <div className="text-[10px] text-gray-500 mt-0.5">איומים בינוניים</div>
          </div>
          <div className="glass-card p-3 text-center">
            <div className="text-2xl font-bold text-emerald-400">{lowCount}</div>
            <div className="text-[10px] text-gray-500 mt-0.5">איומים נמוכים</div>
          </div>
        </div>
      )}

      {/* Competitor Cards */}
      <div className="space-y-3">
        {filtered.map((comp) => {
          const isExpanded = expandedId === comp.id;
          const dist = getDistanceKm(comp);
          const insight = aiInsights[comp.id];
          const isLoadingThis = loadingInsight === comp.id;

          return (
            <div
              key={comp.id}
              className={`glass-card overflow-hidden transition-all ${
                isExpanded ? 'border-cyan-500/30' : ''
              }`}
            >
              {/* Card Header */}
              <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Threat color indicator */}
                    <div
                      className={`w-3 h-3 rounded-full flex-shrink-0 ${
                        comp.perceived_threat_level === 'High'
                          ? 'bg-red-500'
                          : comp.perceived_threat_level === 'Medium'
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      }`}
                    />
                    <h3 className="text-white font-semibold text-sm truncate">{comp.name}</h3>
                    {dist !== null && (
                      <span className="text-[11px] text-gray-500 flex items-center gap-0.5 flex-shrink-0">
                        <MapPin className="w-3 h-3" />
                        {dist < 1 ? `${Math.round(dist * 1000)} מטר` : `${dist.toFixed(1)} ק"מ`}
                      </span>
                    )}
                  </div>
                  <ThreatBadge level={comp.perceived_threat_level} />
                </div>

                {/* Quick stats row */}
                <div className="flex items-center gap-4 text-xs text-gray-400 mb-3">
                  {comp.google_rating && (
                    <span className="flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                      <span className="text-white font-medium">{comp.google_rating}</span>
                      <span>({comp.google_reviews_count || 0})</span>
                    </span>
                  )}
                  {dist !== null && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {dist < 1 ? `${Math.round(dist * 1000)}מ'` : `${dist.toFixed(1)} ק"מ`}
                    </span>
                  )}
                  {comp.website && (
                    <a
                      href={comp.website.startsWith('http') ? comp.website : `https://${comp.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Globe className="w-3 h-3" />
                      אתר
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  )}
                  {comp.phone && (
                    <a href={`tel:${comp.phone}`} className="flex items-center gap-1 text-emerald-400">
                      <Phone className="w-3 h-3" />
                      {comp.phone}
                    </a>
                  )}
                </div>

                {/* Weakness teaser */}
                {comp.identified_weakness && !isExpanded && (
                  <p className="text-[11px] text-gray-500 line-clamp-1 mb-2">
                    חולשה: {comp.identified_weakness}
                  </p>
                )}

                {/* Expand button */}
                <button
                  onClick={() => handleExpand(comp.id)}
                  className="flex items-center gap-1.5 text-xs text-cyan-400 font-medium hover:text-cyan-300 transition-colors"
                >
                  {isExpanded ? (
                    <>
                      <ChevronUp className="w-3.5 h-3.5" />
                      סגור פרטים
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-3.5 h-3.5" />
                      ראה פרטים
                    </>
                  )}
                </button>
              </div>

              {/* Expanded Section */}
              {isExpanded && (
                <div className="border-t border-gray-700/50 p-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                  {/* Rating Comparison */}
                  <div>
                    <h4 className="text-xs font-semibold text-gray-400 mb-2.5">השוואת דירוג</h4>
                    <div className="space-y-2">
                      <RatingBar
                        label="אתה"
                        rating={bizRating || 0}
                        color="bg-cyan-500"
                      />
                      <RatingBar
                        label={comp.name.length > 8 ? comp.name.slice(0, 8) + '...' : comp.name}
                        rating={comp.google_rating || 0}
                        color={
                          comp.perceived_threat_level === 'High'
                            ? 'bg-red-500'
                            : comp.perceived_threat_level === 'Medium'
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }
                      />
                    </div>
                    {/* Reviews comparison */}
                    <div className="flex items-center gap-4 mt-2 text-[11px] text-gray-500">
                      <span>
                        הביקורות שלך:{' '}
                        <span className="text-white font-medium">{bizReviews || '—'}</span>
                      </span>
                      <span>
                        שלהם:{' '}
                        <span className="text-white font-medium">
                          {comp.google_reviews_count || '—'}
                        </span>
                      </span>
                    </div>
                  </div>

                  {/* Identified Weakness */}
                  {comp.identified_weakness && (
                    <div className="p-3 bg-red-500/10 rounded-xl border border-red-500/20">
                      <p className="text-red-400 text-xs font-medium mb-1">חולשה שזוהתה</p>
                      <p className="text-gray-300 text-sm leading-relaxed">
                        {comp.identified_weakness}
                      </p>
                    </div>
                  )}

                  {/* Address */}
                  {comp.address && (
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {comp.address}
                    </p>
                  )}

                  {/* AI Insight */}
                  <div className="p-3 bg-cyan-500/5 rounded-xl border border-cyan-500/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="w-4 h-4 text-cyan-400" />
                      <span className="text-xs font-bold text-cyan-400">תובנת AI</span>
                    </div>
                    {isLoadingThis ? (
                      <div className="flex items-center gap-2 py-3 justify-center">
                        <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
                        <span className="text-xs text-gray-400">מנתח את המתחרה...</span>
                      </div>
                    ) : insight ? (
                      <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">
                        {insight}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-500 text-center py-2">
                        לא ניתן ליצור תובנה כרגע
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {competitors.length === 0 && (
        <div className="text-center py-16">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center mx-auto mb-4">
            <span className="text-4xl">👁️</span>
          </div>
          <h3 className="text-lg font-bold text-white mb-2">עיני עוד מציר את המפה באזורך</h3>
          <p className="text-gray-400 text-sm max-w-sm mx-auto mb-6 whitespace-pre-line">
            {"מחר בבוקר תראה כאן את כל התמונה 🗺️"}
          </p>
          <button
            onClick={handleScan}
            disabled={scanning}
            className="px-6 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-xl font-semibold text-sm hover:shadow-lg hover:shadow-cyan-500/30 transition-all"
          >
            {scanning ? 'סורק...' : 'סרוק מתחרים עכשיו'}
          </button>
        </div>
      )}

      {/* Add Competitor Modal */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setShowAddModal(false)}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div
            dir="rtl"
            className="relative w-full max-w-sm bg-gray-900 border border-gray-700/50 rounded-2xl shadow-2xl p-5 animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-white">הוסף מתחרה</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700/50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">שם העסק *</label>
                <input
                  type="text"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  placeholder="לדוגמה: מסעדת השף"
                  className="w-full px-3 py-2.5 rounded-xl bg-gray-800/60 border border-gray-700/50 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-cyan-500/50"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">אתר (אופציונלי)</label>
                <input
                  type="text"
                  value={addWebsite}
                  onChange={(e) => setAddWebsite(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2.5 rounded-xl bg-gray-800/60 border border-gray-700/50 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-cyan-500/50"
                />
              </div>
              <button
                onClick={handleAddCompetitor}
                disabled={!addName.trim() || adding}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 text-white text-sm font-semibold hover:shadow-lg hover:shadow-cyan-500/30 transition-all disabled:opacity-50"
              >
                {adding ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                {adding ? 'מוסיף...' : 'הוסף מתחרה'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
