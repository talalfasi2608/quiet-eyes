import { useState, useEffect } from 'react';
import { 
  Sun, Moon, CloudSun, AlertTriangle, TrendingUp, 
  Users, Target, Loader2, RefreshCw, ChevronDown, ChevronUp,
  Zap, Shield, ArrowUpRight
} from 'lucide-react';

const API_BASE = 'http://localhost:8015';

interface BriefingData {
  business_name: string;
  greeting: string;
  mood: 'positive' | 'neutral' | 'alert';
  summary: string;
  metrics: {
    new_competitors: number;
    new_leads: number;
    total_events: number;
    total_competitors: number;
    total_leads: number;
    high_severity_events: number;
  };
  action_items: {
    text: string;
    priority: 'high' | 'medium' | 'low';
    type: string;
  }[];
  new_competitors: {
    name: string;
    rating: number;
    threat: string;
  }[];
  recent_events: {
    type: string;
    title: string;
    severity: string;
  }[];
  generated_at: string;
}

const MOOD_CONFIG = {
  positive: { icon: Sun, color: 'text-emerald-400', bg: 'from-emerald-500/20 to-teal-500/20', border: 'border-emerald-500/30' },
  neutral: { icon: CloudSun, color: 'text-blue-400', bg: 'from-blue-500/20 to-indigo-500/20', border: 'border-blue-500/30' },
  alert: { icon: AlertTriangle, color: 'text-amber-400', bg: 'from-amber-500/20 to-red-500/20', border: 'border-amber-500/30' },
};

const PRIORITY_COLORS = {
  high: 'text-red-400 bg-red-500/10 border-red-500/30',
  medium: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  low: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
};

export default function DailyBriefing({ businessId }: { businessId: string }) {
  const [briefing, setBriefing] = useState<BriefingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState(false);

  const fetchBriefing = async () => {
    if (!businessId) return;
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`${API_BASE}/cockpit/briefing/${businessId}`);
      if (res.ok) {
        const data = await res.json();
        setBriefing(data);
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBriefing();
  }, [businessId]);

  if (loading) {
    return (
      <div className="glass-card p-6 animate-pulse">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gray-700/50" />
          <div className="space-y-2 flex-1">
            <div className="w-48 h-5 bg-gray-700/50 rounded" />
            <div className="w-full h-4 bg-gray-700/50 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !briefing) {
    return null; // Silently hide if briefing fails
  }

  const moodCfg = MOOD_CONFIG[briefing.mood] || MOOD_CONFIG.neutral;
  const MoodIcon = moodCfg.icon;
  const { metrics } = briefing;

  return (
    <div className={`glass-card overflow-hidden border ${moodCfg.border}`}>
      {/* Header */}
      <div className={`p-5 bg-gradient-to-l ${moodCfg.bg}`}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl bg-gray-900/50 flex items-center justify-center`}>
              <MoodIcon className={`w-6 h-6 ${moodCfg.color}`} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">{briefing.greeting}</h2>
              <p className="text-sm text-gray-300 mt-1 leading-relaxed max-w-2xl">
                {briefing.summary || 'אין עדכונים חדשים מהלילה.'}
              </p>
            </div>
          </div>
          <button
            onClick={fetchBriefing}
            className="p-2 text-gray-400 hover:text-white transition rounded-lg hover:bg-white/5"
            title="רענן תדריך"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Metrics */}
        <div className="flex items-center gap-6 mt-4 pt-4 border-t border-white/10">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-emerald-400" />
            <span className="text-sm text-gray-300">
              <span className="font-bold text-white">{metrics.new_leads}</span> לידים חדשים
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-amber-400" />
            <span className="text-sm text-gray-300">
              <span className="font-bold text-white">{metrics.new_competitors}</span> מתחרים חדשים
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-indigo-400" />
            <span className="text-sm text-gray-300">
              <span className="font-bold text-white">{metrics.total_events}</span> אירועים
            </span>
          </div>
          {metrics.high_severity_events > 0 && (
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <span className="text-sm text-red-300">
                <span className="font-bold">{metrics.high_severity_events}</span> קריטיים
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Expandable Action Items */}
      {briefing.action_items.length > 0 && (
        <>
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full px-5 py-3 flex items-center justify-between text-sm text-gray-400 hover:text-white hover:bg-white/5 transition border-t border-gray-700/30"
          >
            <span className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              {briefing.action_items.length} פעולות מומלצות
            </span>
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {expanded && (
            <div className="px-5 pb-4 space-y-2">
              {briefing.action_items.map((item, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-3 p-3 rounded-lg border ${PRIORITY_COLORS[item.priority] || PRIORITY_COLORS.medium}`}
                >
                  <ArrowUpRight className="w-4 h-4 mt-0.5 shrink-0" />
                  <span className="text-sm">{item.text}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
