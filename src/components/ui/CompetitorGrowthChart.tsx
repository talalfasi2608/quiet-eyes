import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp,
  BarChart3,
  Star,
  MessageSquare,
  RefreshCw,
  Loader2,
  AlertCircle,
} from 'lucide-react';

// Types
interface HistorySnapshot {
  snapshot_id: string;
  competitor_id: string;
  competitor_name: string;
  rating: number;
  reviews_count: number;
  followers_count: number;
  created_at: string;
}

interface Competitor {
  id: string;
  name: string;
  current_rating: number;
  current_reviews: number;
  threat_level: string;
}

interface HistoryResponse {
  success: boolean;
  business_name: string;
  business_id: string;
  period_days: number;
  competitors_count: number;
  total_snapshots: number;
  unique_dates: number;
  competitors: Competitor[];
  history_by_date: Record<string, HistorySnapshot[]>;
}

// Color palette for competitor lines
const COLORS = [
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#f59e0b', // amber
  '#10b981', // emerald
  '#06b6d4', // cyan
  '#f97316', // orange
  '#84cc16', // lime
];

type MetricType = 'reviews_count' | 'rating';

// Custom tooltip component
function CustomTooltip({
  active,
  payload,
  label,
  metric
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
  metric: MetricType;
}) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="bg-gray-900/95 backdrop-blur-sm border border-gray-700 rounded-lg p-3 shadow-xl">
      <p className="text-gray-400 text-xs mb-2 border-b border-gray-700 pb-2">{label}</p>
      <div className="space-y-1.5">
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-gray-300 text-sm truncate max-w-[120px]" dir="rtl">
                {entry.name}
              </span>
            </div>
            <span className="text-white font-medium text-sm">
              {metric === 'rating' ? entry.value.toFixed(1) : entry.value}
              {metric === 'rating' && <Star className="w-3 h-3 inline ml-1 text-yellow-400" />}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Custom legend component
function CustomLegend({
  payload
}: {
  payload?: Array<{ value: string; color: string }>
}) {
  if (!payload) return null;

  return (
    <div className="flex flex-wrap justify-center gap-3 mt-4">
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-1.5">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-gray-400 text-xs" dir="rtl">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function CompetitorChart() {
  const { user } = useAuth();
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metric, setMetric] = useState<MetricType>('reviews_count');
  const [periodDays, setPeriodDays] = useState(30);

  // Fetch history data
  const fetchHistory = async () => {
    if (!user?.id) return;

    setLoading(true);
    setError(null);

    try {
      // First get the business ID for this user
      const businessResponse = await fetch(
        `http://localhost:8015/business/user/${user.id}`
      );

      if (!businessResponse.ok) {
        throw new Error('Failed to fetch business');
      }

      const businessData = await businessResponse.json();
      const businessId = businessData.business?.id;

      if (!businessId) {
        throw new Error('No business found');
      }

      // Now fetch history
      const response = await fetch(
        `http://localhost:8015/business/history/${businessId}?days=${periodDays}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch history data');
      }

      const result: HistoryResponse = await response.json();
      setData(result);

    } catch (err) {
      console.error('Chart data error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load chart data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [user?.id, periodDays]);

  // Transform data for Recharts
  const chartData = useMemo(() => {
    if (!data || !data.history_by_date) return [];

    const dates = Object.keys(data.history_by_date).sort();

    return dates.map(date => {
      const snapshots = data.history_by_date[date];
      const point: Record<string, string | number> = {
        date: new Date(date).toLocaleDateString('he-IL', {
          month: 'short',
          day: 'numeric'
        }),
        fullDate: date,
      };

      // Add each competitor's metric value
      snapshots.forEach(snapshot => {
        const key = snapshot.competitor_name;
        point[key] = metric === 'rating'
          ? snapshot.rating
          : snapshot.reviews_count;
      });

      return point;
    });
  }, [data, metric]);

  // Get unique competitor names for lines
  const competitorNames = useMemo(() => {
    if (!data?.competitors) return [];
    // Get unique names
    const names = [...new Set(data.competitors.map(c => c.name))];
    return names;
  }, [data]);

  // Loading state
  if (loading) {
    return (
      <div className="bg-gray-900/50 backdrop-blur-sm rounded-2xl border border-gray-700/50 p-8">
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-4" />
          <p className="text-gray-400">Loading market momentum data...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-gray-900/50 backdrop-blur-sm rounded-2xl border border-red-500/30 p-8">
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <AlertCircle className="w-10 h-10 text-red-400 mb-4" />
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={fetchHistory}
            className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-lg text-red-300 text-sm flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  // No data state
  if (!data || chartData.length === 0) {
    return (
      <div className="bg-gray-900/50 backdrop-blur-sm rounded-2xl border border-gray-700/50 p-8">
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <BarChart3 className="w-12 h-12 text-gray-600 mb-4" />
          <p className="text-gray-400 mb-2">No historical data available yet</p>
          <p className="text-gray-500 text-sm">
            Run a few scans to start tracking competitor trends
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900/50 backdrop-blur-sm rounded-2xl border border-gray-700/50 overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-gray-700/50">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30">
              <TrendingUp className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Market Momentum</h2>
              <p className="text-sm text-gray-400">
                {data.competitors_count} competitors · {data.total_snapshots} data points
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Metric Toggle */}
            <div className="flex items-center gap-1 bg-gray-800/50 rounded-lg p-1">
              <button
                onClick={() => setMetric('reviews_count')}
                className={`
                  flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors
                  ${metric === 'reviews_count'
                    ? 'bg-indigo-500/20 text-indigo-400'
                    : 'text-gray-400 hover:text-white'}
                `}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Reviews
              </button>
              <button
                onClick={() => setMetric('rating')}
                className={`
                  flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors
                  ${metric === 'rating'
                    ? 'bg-indigo-500/20 text-indigo-400'
                    : 'text-gray-400 hover:text-white'}
                `}
              >
                <Star className="w-3.5 h-3.5" />
                Ratings
              </button>
            </div>

            {/* Period selector */}
            <div className="flex items-center gap-1 bg-gray-800/50 rounded-lg p-1">
              {[7, 14, 30].map((days) => (
                <button
                  key={days}
                  onClick={() => setPeriodDays(days)}
                  className={`
                    px-3 py-1.5 rounded-md text-xs font-medium transition-colors
                    ${periodDays === days
                      ? 'bg-purple-500/20 text-purple-400'
                      : 'text-gray-400 hover:text-white'}
                  `}
                >
                  {days}d
                </button>
              ))}
            </div>

            {/* Refresh */}
            <button
              onClick={fetchHistory}
              className="p-2 rounded-lg bg-gray-800/50 hover:bg-gray-700/50 text-gray-400 hover:text-white transition-colors"
              title="Refresh data"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="p-6">
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 10, right: 30, left: 0, bottom: 10 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#374151"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                stroke="#6b7280"
                tick={{ fill: '#9ca3af', fontSize: 12 }}
                tickLine={{ stroke: '#4b5563' }}
                axisLine={{ stroke: '#4b5563' }}
              />
              <YAxis
                stroke="#6b7280"
                tick={{ fill: '#9ca3af', fontSize: 12 }}
                tickLine={{ stroke: '#4b5563' }}
                axisLine={{ stroke: '#4b5563' }}
                domain={metric === 'rating' ? [0, 5] : ['auto', 'auto']}
                tickFormatter={(value) =>
                  metric === 'rating' ? value.toFixed(1) : value.toString()
                }
              />
              <Tooltip
                content={<CustomTooltip metric={metric} />}
                cursor={{ stroke: '#6366f1', strokeWidth: 1, strokeDasharray: '5 5' }}
              />
              <Legend content={<CustomLegend />} />

              {competitorNames.map((name, index) => (
                <Line
                  key={name}
                  type="monotone"
                  dataKey={name}
                  name={name}
                  stroke={COLORS[index % COLORS.length]}
                  strokeWidth={2.5}
                  dot={{
                    r: 4,
                    fill: COLORS[index % COLORS.length],
                    strokeWidth: 2,
                    stroke: '#1f2937'
                  }}
                  activeDot={{
                    r: 6,
                    fill: COLORS[index % COLORS.length],
                    stroke: '#fff',
                    strokeWidth: 2
                  }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-700/50">
          <div className="text-center">
            <div className="text-2xl font-bold text-white">
              {data.competitors_count}
            </div>
            <div className="text-xs text-gray-500">Competitors Tracked</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-indigo-400">
              {data.total_snapshots}
            </div>
            <div className="text-xs text-gray-500">Total Snapshots</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-400">
              {data.unique_dates}
            </div>
            <div className="text-xs text-gray-500">Days of Data</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-emerald-400">
              {periodDays}d
            </div>
            <div className="text-xs text-gray-500">Time Period</div>
          </div>
        </div>
      </div>
    </div>
  );
}
