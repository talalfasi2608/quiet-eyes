import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE } from '../../config/api';
import { apiFetch } from '../../services/api';
import {
  Activity,
  TrendingUp,
  TrendingDown,
  Minus,
  Star,
  MessageSquare,
  Users,
  Clock,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  BarChart3,
  Calendar,
  Loader2,
  Building2,
  X
} from 'lucide-react';

interface HistorySnapshot {
  id: string;
  competitor_id: string;
  google_rating: number;
  google_reviews_count: number;
  instagram_followers: number;
  instagram_posts_count: number;
  area_avg_price: number;
  scan_type: string;
  created_at: string;
}

interface CompetitorTrends {
  rating_change?: number;
  reviews_change?: number;
  followers_change?: number;
}

interface CompetitorWithHistory {
  id: string;
  name: string;
  current_rating: number;
  current_reviews: number;
  threat_level: string;
  trends: CompetitorTrends;
  snapshots_count: number;
  history: HistorySnapshot[];
}

interface Alert {
  id: string;
  alert_type: string;
  severity: string;
  metric_name: string;
  old_value: number;
  new_value: number;
  change_amount: number;
  created_at: string;
}

interface HistoryResponse {
  success: boolean;
  business_name: string;
  business_id: string;
  period_days: number;
  competitors_count: number;
  total_snapshots: number;
  competitors: CompetitorWithHistory[];
  recent_alerts: Alert[];
}

// Threat level colors
const threatColors: Record<string, { bg: string; text: string; border: string }> = {
  High: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30' },
  Medium: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
  Low: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30' },
};

// Trend indicator component
function TrendIndicator({ value, suffix = '' }: { value: number | undefined; suffix?: string }) {
  if (value === undefined || value === 0) {
    return (
      <span className="flex items-center gap-1 text-gray-500 text-sm">
        <Minus className="w-3.5 h-3.5" />
        <span>No change</span>
      </span>
    );
  }

  const isPositive = value > 0;
  const Icon = isPositive ? TrendingUp : TrendingDown;
  const color = isPositive ? 'text-emerald-400' : 'text-red-400';

  return (
    <span className={`flex items-center gap-1 ${color} text-sm font-medium`}>
      <Icon className="w-3.5 h-3.5" />
      <span>{isPositive ? '+' : ''}{value}{suffix}</span>
    </span>
  );
}

// Mini sparkline chart component
function MiniChart({ data, metric }: { data: HistorySnapshot[]; metric: keyof HistorySnapshot }) {
  if (!data || data.length < 2) {
    return (
      <div className="h-12 flex items-center justify-center text-gray-600 text-xs">
        Not enough data
      </div>
    );
  }

  // Get values in chronological order (oldest first)
  const values = [...data].reverse().map(d => Number(d[metric]) || 0);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;

  // Calculate bar heights (normalize to 0-100%)
  const bars = values.map(v => ((v - min) / range) * 100);

  return (
    <div className="h-12 flex items-end gap-0.5">
      {bars.map((height, i) => (
        <div
          key={i}
          className="flex-1 bg-gradient-to-t from-cyan-500/50 to-blue-500/50 rounded-t transition-all hover:from-cyan-500/70 hover:to-blue-500/70"
          style={{ height: `${Math.max(height, 5)}%` }}
          title={`${values[i]}`}
        />
      ))}
    </div>
  );
}

// Competitor card with history
function CompetitorHistoryCard({
  competitor,
  isExpanded,
  onToggle
}: {
  competitor: CompetitorWithHistory;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const threat = threatColors[competitor.threat_level] || threatColors.Medium;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={`
      bg-gradient-to-br from-gray-800/60 to-gray-900/60
      backdrop-blur-sm
      border border-gray-700/50
      rounded-xl
      overflow-hidden
      transition-all duration-300
      ${isExpanded ? 'ring-1 ring-cyan-500/30' : ''}
    `}>
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full p-4 flex items-center justify-between hover:bg-gray-700/20 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`
            w-10 h-10 rounded-lg ${threat.bg} ${threat.border} border
            flex items-center justify-center
          `}>
            <Building2 className={`w-5 h-5 ${threat.text}`} />
          </div>

          <div className="text-left">
            <h3 className="font-semibold text-white" dir="rtl">{competitor.name}</h3>
            <div className="flex items-center gap-3 text-sm">
              <span className="flex items-center gap-1 text-yellow-400">
                <Star className="w-3.5 h-3.5 fill-current" />
                {competitor.current_rating || 'N/A'}
              </span>
              <span className="flex items-center gap-1 text-gray-400">
                <MessageSquare className="w-3.5 h-3.5" />
                {competitor.current_reviews || 0}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-xs ${threat.bg} ${threat.text}`}>
                {competitor.threat_level}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Quick trends */}
          <div className="hidden md:flex items-center gap-4 text-sm">
            <div className="text-center">
              <div className="text-gray-500 text-xs mb-1">Rating</div>
              <TrendIndicator value={competitor.trends?.rating_change ?? 0} />
            </div>
            <div className="text-center">
              <div className="text-gray-500 text-xs mb-1">Reviews</div>
              <TrendIndicator value={competitor.trends?.reviews_change ?? 0} />
            </div>
          </div>

          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && competitor.history.length > 0 && (
        <div className="px-4 pb-4 border-t border-gray-700/50 animate-in slide-in-from-top-2">
          {/* Trend cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 mb-4">
            <div className="bg-gray-800/50 rounded-lg p-3">
              <div className="flex items-center gap-2 text-gray-400 text-xs mb-2">
                <Star className="w-3.5 h-3.5" />
                Rating Trend
              </div>
              <MiniChart data={competitor.history} metric="google_rating" />
            </div>

            <div className="bg-gray-800/50 rounded-lg p-3">
              <div className="flex items-center gap-2 text-gray-400 text-xs mb-2">
                <MessageSquare className="w-3.5 h-3.5" />
                Reviews Trend
              </div>
              <MiniChart data={competitor.history} metric="google_reviews_count" />
            </div>

            <div className="bg-gray-800/50 rounded-lg p-3">
              <div className="flex items-center gap-2 text-gray-400 text-xs mb-2">
                <Users className="w-3.5 h-3.5" />
                Followers Trend
              </div>
              <MiniChart data={competitor.history} metric="instagram_followers" />
            </div>
          </div>

          {/* History table */}
          <div className="overflow-x-auto">
          <div className="bg-gray-800/30 rounded-lg overflow-hidden">
            <div className="grid grid-cols-5 gap-2 p-2 text-xs text-gray-500 border-b border-gray-700/50">
              <div>Date</div>
              <div>Rating</div>
              <div>Reviews</div>
              <div>Followers</div>
              <div>Scan Type</div>
            </div>
            <div className="max-h-48 overflow-y-auto">
              {competitor.history.map((snapshot, index) => (
                <div
                  key={snapshot.id}
                  className={`
                    grid grid-cols-5 gap-2 p-2 text-sm
                    ${index % 2 === 0 ? 'bg-gray-800/20' : ''}
                  `}
                >
                  <div className="text-gray-400 text-xs">
                    {formatDate(snapshot.created_at)}
                  </div>
                  <div className="text-white">
                    {snapshot.google_rating || '-'}
                  </div>
                  <div className="text-white">
                    {snapshot.google_reviews_count || '-'}
                  </div>
                  <div className="text-white">
                    {snapshot.instagram_followers || '-'}
                  </div>
                  <div className="text-xs">
                    <span className={`
                      px-1.5 py-0.5 rounded
                      ${snapshot.scan_type === 'scheduled' ? 'bg-blue-500/20 text-blue-400' : ''}
                      ${snapshot.scan_type === 'manual' ? 'bg-green-500/20 text-green-400' : ''}
                      ${snapshot.scan_type === 'anomaly_check' ? 'bg-amber-500/20 text-amber-400' : ''}
                    `}>
                      {snapshot.scan_type}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          </div>
          <div className="mt-3 text-xs text-gray-500 text-center">
            {competitor.snapshots_count} total snapshots recorded
          </div>
        </div>
      )}
    </div>
  );
}

// Alert item component
function AlertItem({ alert }: { alert: Alert }) {
  const severityColors: Record<string, string> = {
    High: 'border-red-500/50 bg-red-500/10',
    Medium: 'border-amber-500/50 bg-amber-500/10',
    Low: 'border-blue-500/50 bg-blue-500/10',
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className={`
      flex items-center gap-3 p-3 rounded-lg border
      ${severityColors[alert.severity] || severityColors.Medium}
    `}>
      <AlertTriangle className={`
        w-4 h-4 flex-shrink-0
        ${alert.severity === 'High' ? 'text-red-400' : ''}
        ${alert.severity === 'Medium' ? 'text-amber-400' : ''}
        ${alert.severity === 'Low' ? 'text-blue-400' : ''}
      `} />
      <div className="flex-1 min-w-0">
        <div className="text-sm text-white truncate">
          {alert.alert_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
        </div>
        <div className="text-xs text-gray-400">
          {alert.metric_name}: {alert.old_value} → {alert.new_value}
        </div>
      </div>
      <div className="text-xs text-gray-500">
        {formatDate(alert.created_at)}
      </div>
    </div>
  );
}

// Main component
export default function IntelligenceHistory() {
  const { user } = useAuth();
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedCompetitor, setExpandedCompetitor] = useState<string | null>(null);
  const [periodDays, setPeriodDays] = useState(30);
  const [refreshing, setRefreshing] = useState(false);

  const fetchHistory = async () => {
    if (!user?.id) return;

    setLoading(true);
    setError(null);

    try {
      const response = await apiFetch(
        `/intelligence/history/business/${user.id}?days=${periodDays}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch intelligence history');
      }

      const result: HistoryResponse = await response.json();
      setData(result);

      // Auto-expand first competitor if only one
      if (result.competitors.length === 1) {
        setExpandedCompetitor(result.competitors[0].id);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load history');
    } finally {
      setLoading(false);
    }
  };

  const triggerTracking = async () => {
    if (!user?.id) return;

    setRefreshing(true);
    try {
      await apiFetch(`/intelligence/track/${user.id}`, {
        method: 'POST'
      });

      // Wait a bit for background task to complete
      setTimeout(() => {
        fetchHistory();
        setRefreshing(false);
      }, 5000);

    } catch (err) {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [user?.id, periodDays]);

  // Loading state
  if (loading) {
    return (
      <div className="bg-gray-900/50 backdrop-blur-sm rounded-2xl border border-gray-700/50 p-8">
        <div className="flex flex-col items-center justify-center py-12">
          <div className="relative">
            <div className="w-16 h-16 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 animate-pulse" />
            <Activity className="w-8 h-8 text-white absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
          </div>
          <p className="mt-4 text-gray-400 animate-pulse">Loading intelligence history...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-gray-900/50 backdrop-blur-sm rounded-2xl border border-red-500/30 p-8">
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
            <X className="w-6 h-6 text-red-400" />
          </div>
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={() => fetchHistory()}
            className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-lg text-red-300 text-sm"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30">
            <BarChart3 className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Intelligence History</h2>
            <p className="text-sm text-gray-400">
              {data.competitors_count} competitors · {data.total_snapshots} snapshots
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Period selector */}
          <div className="flex items-center gap-1 bg-gray-800/50 rounded-lg p-1">
            {[7, 14, 30].map((days) => (
              <button
                key={days}
                onClick={() => setPeriodDays(days)}
                className={`
                  px-3 py-1.5 rounded-md text-xs font-medium transition-colors
                  ${periodDays === days
                    ? 'bg-cyan-500/20 text-cyan-400'
                    : 'text-gray-400 hover:text-white'}
                `}
              >
                {days}d
              </button>
            ))}
          </div>

          {/* Refresh/Track button */}
          <button
            onClick={triggerTracking}
            disabled={refreshing}
            className="
              flex items-center gap-2
              px-4 py-2
              bg-gradient-to-r from-cyan-500/20 to-blue-500/20
              hover:from-cyan-500/30 hover:to-blue-500/30
              border border-cyan-500/30
              rounded-lg
              text-cyan-300 text-sm font-medium
              transition-all
              disabled:opacity-50
            "
          >
            {refreshing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            {refreshing ? 'Scanning...' : 'Run Scan'}
          </button>
        </div>
      </div>

      {/* Recent Alerts */}
      {data.recent_alerts && data.recent_alerts.length > 0 && (
        <div className="bg-gray-900/50 backdrop-blur-sm rounded-xl border border-gray-700/50 p-4">
          <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Recent Alerts
          </h3>
          <div className="space-y-2">
            {data.recent_alerts.slice(0, 5).map((alert) => (
              <AlertItem key={alert.id} alert={alert} />
            ))}
          </div>
        </div>
      )}

      {/* Competitors list */}
      {(data.competitors || []).length > 0 ? (
        <div className="space-y-3">
          {(data.competitors || []).map((competitor) => (
            <CompetitorHistoryCard
              key={competitor.id}
              competitor={competitor}
              isExpanded={expandedCompetitor === competitor.id}
              onToggle={() => setExpandedCompetitor(
                expandedCompetitor === competitor.id ? null : competitor.id
              )}
            />
          ))}
        </div>
      ) : (
        <div className="bg-gray-800/30 rounded-2xl border border-gray-700/30 p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-gray-700/50 flex items-center justify-center mx-auto mb-4">
            <Activity className="w-8 h-8 text-gray-500" />
          </div>
          <p className="text-gray-400 mb-2">No history data yet</p>
          <p className="text-sm text-gray-500 mb-4">
            Run an intelligence scan to start tracking competitor changes
          </p>
          <button
            onClick={triggerTracking}
            disabled={refreshing}
            className="px-4 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 rounded-lg text-cyan-300 text-sm"
          >
            Start Tracking
          </button>
        </div>
      )}
    </div>
  );
}
