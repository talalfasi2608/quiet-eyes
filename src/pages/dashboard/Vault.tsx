import { useState, useEffect, useCallback } from 'react';
import { useSimulation } from '../../context/SimulationContext';
import {
  Archive,
  Search,
  Calendar,
  Filter,
  Bell,
  Target,
  AlertTriangle,
  DollarSign,
  CheckCircle,
  Loader2,
  Clock,
  ChevronDown,
} from 'lucide-react';

const API_BASE = 'http://localhost:8015';

// ═══════════════════════════════════════════════════════════════════════════════
// EVENT CONFIG
// ═══════════════════════════════════════════════════════════════════════════════

const EVENT_CONFIG: Record<string, { icon: typeof Bell; color: string; bg: string; label: string }> = {
  lead_found: { icon: Target, color: 'text-emerald-400', bg: 'bg-emerald-500/15', label: 'ליד נמצא' },
  competitor_change: { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/15', label: 'שינוי מתחרה' },
  price_alert: { icon: DollarSign, color: 'text-red-400', bg: 'bg-red-500/15', label: 'התראת מחיר' },
  scan_completed: { icon: CheckCircle, color: 'text-blue-400', bg: 'bg-blue-500/15', label: 'סריקה הושלמה' },
  system_alert: { icon: Bell, color: 'text-purple-400', bg: 'bg-purple-500/15', label: 'התראת מערכת' },
};

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface VaultEvent {
  id: number | string;
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

// ═══════════════════════════════════════════════════════════════════════════════
// SEVERITY BADGE
// ═══════════════════════════════════════════════════════════════════════════════

function SeverityBadge({ severity }: { severity: string }) {
  const config: Record<string, { bg: string; text: string; border: string; label: string }> = {
    high: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30', label: 'קריטי' },
    critical: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30', label: 'קריטי' },
    medium: { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30', label: 'בינוני' },
    low: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30', label: 'נמוך' },
    info: { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/30', label: 'מידע' },
  };
  const { bg, text, border, label } = config[severity] || config['info'];
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${bg} ${text} border ${border}`}>
      {label}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// VAULT PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export default function Vault() {
  const { currentProfile } = useSimulation();
  const businessId = currentProfile?.id;

  // Filter state
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [eventType, setEventType] = useState('');
  const [searchText, setSearchText] = useState('');

  // Data state
  const [events, setEvents] = useState<VaultEvent[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const LIMIT = 50;

  // ── Fetch events ──────────────────────────────────────────────────────────
  const fetchEvents = useCallback(
    async (newOffset = 0, append = false) => {
      if (!businessId) return;

      if (append) setLoadingMore(true);
      else setLoading(true);

      try {
        const params = new URLSearchParams();
        if (fromDate) params.set('from_date', fromDate);
        if (toDate) params.set('to_date', toDate);
        if (eventType) params.set('event_type', eventType);
        if (searchText) params.set('search', searchText);
        params.set('limit', String(LIMIT));
        params.set('offset', String(newOffset));

        const url = `${API_BASE}/vault/timeline/${businessId}?${params.toString()}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Failed to fetch vault timeline');

        const data = await res.json();
        const fetched: VaultEvent[] = data.events || [];

        if (append) {
          setEvents((prev) => [...prev, ...fetched]);
        } else {
          setEvents(fetched);
        }
        setTotalCount(data.total_count || 0);
        setOffset(newOffset + fetched.length);
      } catch (err) {
        console.error('Vault fetch error:', err);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [businessId, fromDate, toDate, eventType, searchText],
  );

  // Initial load + re-fetch when filters change
  useEffect(() => {
    setOffset(0);
    fetchEvents(0, false);
  }, [fetchEvents]);

  const handleLoadMore = () => {
    fetchEvents(offset, true);
  };

  const hasMore = events.length < totalCount;

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="space-y-6 fade-in" dir="rtl">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="glass-card p-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <Archive className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">הכספת</h1>
            <p className="text-gray-400 text-sm">ארכיון מודיעין היסטורי</p>
          </div>
        </div>
      </header>

      {/* ── Filters ─────────────────────────────────────────────────────────── */}
      <div className="glass-card p-5">
        <div className="flex items-center gap-2 mb-4 text-gray-400 text-sm">
          <Filter className="w-4 h-4" />
          <span>סינון וחיפוש</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Date from */}
          <div className="relative">
            <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg pr-10 pl-4 py-2.5 text-sm text-gray-300 focus:border-indigo-500/50 focus:outline-none transition-colors"
              placeholder="מתאריך"
            />
          </div>

          {/* Date to */}
          <div className="relative">
            <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg pr-10 pl-4 py-2.5 text-sm text-gray-300 focus:border-indigo-500/50 focus:outline-none transition-colors"
              placeholder="עד תאריך"
            />
          </div>

          {/* Event type */}
          <div className="relative">
            <Filter className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
            <select
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
              className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg pr-10 pl-4 py-2.5 text-sm text-gray-300 focus:border-indigo-500/50 focus:outline-none transition-colors appearance-none"
            >
              <option value="">כל הסוגים</option>
              <option value="lead_found">ליד נמצא</option>
              <option value="competitor_change">שינוי מתחרה</option>
              <option value="price_alert">התראת מחיר</option>
              <option value="scan_completed">סריקה הושלמה</option>
              <option value="system_alert">התראת מערכת</option>
            </select>
            <ChevronDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="חיפוש בכותרת ותיאור..."
              className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg pr-10 pl-4 py-2.5 text-sm text-gray-300 focus:border-indigo-500/50 focus:outline-none transition-colors placeholder-gray-600"
            />
          </div>
        </div>
      </div>

      {/* ── Results count ───────────────────────────────────────────────────── */}
      {!loading && (
        <div className="flex items-center justify-between text-sm text-gray-500 px-1">
          <span>{totalCount} אירועים נמצאו</span>
          {events.length > 0 && (
            <span>מציג {events.length} מתוך {totalCount}</span>
          )}
        </div>
      )}

      {/* ── Loading state ───────────────────────────────────────────────────── */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="text-center space-y-4">
            <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mx-auto" />
            <p className="text-gray-400 text-sm">טוען ארכיון מודיעין...</p>
          </div>
        </div>
      )}

      {/* ── Empty state ─────────────────────────────────────────────────────── */}
      {!loading && events.length === 0 && (
        <div className="glass-card p-12 text-center">
          <Archive className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">אין אירועים בכספת</h3>
          <p className="text-gray-400 text-sm max-w-md mx-auto">
            לא נמצאו אירועי מודיעין עבור הסינון שנבחר. נסה לשנות את טווח התאריכים או להסיר את הסינון.
          </p>
        </div>
      )}

      {/* ── Timeline ────────────────────────────────────────────────────────── */}
      {!loading && events.length > 0 && (
        <div className="space-y-3">
          {events.map((event) => {
            const cfg = EVENT_CONFIG[event.event_type] || {
              icon: Bell,
              color: 'text-gray-400',
              bg: 'bg-gray-500/15',
              label: event.event_type,
            };
            const Icon = cfg.icon;

            const timeStr = (() => {
              try {
                return new Date(event.created_at).toLocaleString('he-IL', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                });
              } catch {
                return event.created_at;
              }
            })();

            return (
              <div
                key={event.id}
                className="glass-card p-4 hover:bg-gray-800/30 transition-colors"
              >
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className={`w-10 h-10 rounded-xl ${cfg.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                    <Icon className={`w-5 h-5 ${cfg.color}`} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3 mb-1">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-white leading-relaxed">
                          {event.title}
                        </h4>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <SeverityBadge severity={event.severity} />
                        <span className={`px-2 py-0.5 rounded-full text-xs ${cfg.bg} ${cfg.color}`}>
                          {cfg.label}
                        </span>
                      </div>
                    </div>

                    {event.description && (
                      <p className="text-xs text-gray-400 leading-relaxed mt-1">
                        {event.description}
                      </p>
                    )}

                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {timeStr}
                      </span>
                      {event.source && (
                        <span className="px-2 py-0.5 rounded bg-gray-800/50 border border-gray-700/50">
                          {event.source}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Load more ───────────────────────────────────────────────────────── */}
      {!loading && hasMore && (
        <div className="flex justify-center pt-2 pb-6">
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-500/20 text-indigo-400 rounded-xl text-sm font-medium hover:bg-indigo-500/30 transition-colors border border-indigo-500/30 disabled:opacity-50"
          >
            {loadingMore ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                טוען עוד...
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4" />
                טען עוד אירועים
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
