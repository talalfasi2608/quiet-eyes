import { useState, useEffect } from 'react';
import {
  TrendingUp, TrendingDown, Minus,
  AlertTriangle, CheckCircle, Target,
  BarChart3, Shield, Zap
} from 'lucide-react';
import { apiFetch } from '../../services/api';

interface RecommendedAction {
  action: string;
  reason: string;
  urgency: 'high' | 'medium' | 'low';
  expected_impact: string;
}

interface PredictionData {
  available: boolean;
  predicted_leads?: number;
  leads_confidence?: number;
  rating_prediction?: string;        // improving / declining / stable
  competitor_moves?: string[];
  top_opportunity?: string;
  top_risk?: string;
  recommended_actions?: (RecommendedAction | string)[];
  summary?: string;
  confidence?: number;
  valid_from?: string;
  valid_until?: string;
}

const URGENCY_COLORS: Record<string, string> = {
  high:   'text-red-400 bg-red-500/10 border-red-500/20',
  medium: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  low:    'text-blue-400 bg-blue-500/10 border-blue-500/20',
};

const TREND_ICON: Record<string, typeof TrendingUp> = {
  improving: TrendingUp,
  declining: TrendingDown,
  stable: Minus,
};

export default function PredictionCard({ businessId }: { businessId: string }) {
  const [prediction, setPrediction] = useState<PredictionData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!businessId) return;
    setLoading(true);
    apiFetch(`/cockpit/prediction/${businessId}`)
      .then(r => {
        if (!r.ok) throw new Error('API error');
        return r.json();
      })
      .then(data => setPrediction(data))
      .catch(() => setPrediction(null))
      .finally(() => setLoading(false));
  }, [businessId]);

  if (loading) {
    return (
      <div className="bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-6 animate-pulse">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gray-700/50" />
          <div className="space-y-2 flex-1">
            <div className="w-40 h-5 bg-gray-700/50 rounded" />
            <div className="w-full h-4 bg-gray-700/50 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (!prediction || !prediction.available) {
    return (
      <div className="bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-6">
        <div className="flex items-center gap-3 text-gray-500">
          <TrendingUp className="w-5 h-5" />
          <span className="text-sm">אין תחזית זמינה — התחזית הראשונה תיווצר בתחילת השבוע הבא</span>
        </div>
      </div>
    );
  }

  const confidencePercent = Math.round((prediction.confidence || 0) * 100);
  const leadsConfPct = Math.round((prediction.leads_confidence || 0) * 100);
  const TrendIcon = TREND_ICON[prediction.rating_prediction || 'stable'] || Minus;

  return (
    <div className="bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 overflow-hidden">
      {/* Header */}
      <div className="p-5 bg-gradient-to-l from-indigo-500/20 to-purple-500/20 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gray-900/50 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">תחזית שבוע הבא</h3>
              {prediction.valid_from && prediction.valid_until && (
                <p className="text-xs text-gray-400 mt-0.5">
                  {prediction.valid_from} — {prediction.valid_until}
                </p>
              )}
            </div>
          </div>
          {/* Confidence bar */}
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-gray-400" />
            <div className="w-20 h-2 bg-gray-700/50 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-400 rounded-full transition-all"
                style={{ width: `${confidencePercent}%` }}
              />
            </div>
            <span className="text-xs text-gray-400">{confidencePercent}%</span>
          </div>
        </div>

        {/* Summary */}
        {prediction.summary && (
          <p className="text-sm text-gray-300 mt-3 leading-relaxed">{prediction.summary}</p>
        )}

        {/* Metric badges */}
        <div className="flex items-center gap-5 mt-4 pt-3 border-t border-white/10">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-emerald-400" />
            <span className="text-sm text-gray-300">
              לידים צפויים: <span className="font-bold text-white">~{prediction.predicted_leads ?? 0}</span>
              <span className="text-gray-500 text-xs mr-1">(ביטחון {leadsConfPct}%)</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <TrendIcon className="w-4 h-4 text-blue-400" />
            <span className="text-sm text-gray-300">
              מגמה: <span className="font-bold text-white">
                {prediction.rating_prediction === 'improving' ? 'עולה' :
                 prediction.rating_prediction === 'declining' ? 'יורדת' : 'יציבה'}
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-5 space-y-4">
        {/* Top Opportunity */}
        {prediction.top_opportunity && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
            <div>
              <span className="text-xs font-semibold text-emerald-400">הזדמנות</span>
              <p className="text-sm text-gray-300 mt-0.5">{prediction.top_opportunity}</p>
            </div>
          </div>
        )}

        {/* Top Risk */}
        {prediction.top_risk && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
            <div>
              <span className="text-xs font-semibold text-amber-400">סיכון</span>
              <p className="text-sm text-gray-300 mt-0.5">{prediction.top_risk}</p>
            </div>
          </div>
        )}

        {/* Competitor Moves */}
        {prediction.competitor_moves && prediction.competitor_moves.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" /> צפי מתחרים
            </h4>
            <div className="space-y-1.5">
              {prediction.competitor_moves.map((move, i) => (
                <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <Zap className="w-3.5 h-3.5 text-blue-400 mt-0.5 shrink-0" />
                  <span className="text-sm text-gray-300">{move}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recommended Actions */}
        {prediction.recommended_actions && prediction.recommended_actions.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-2">
              תכנית פעולה
            </h4>
            <div className="space-y-1.5">
              {prediction.recommended_actions.map((item, i) => {
                const isObj = typeof item === 'object' && item !== null;
                const action = isObj ? (item as RecommendedAction).action : (item as string);
                const urgency = isObj ? (item as RecommendedAction).urgency : 'medium';
                const reason = isObj ? (item as RecommendedAction).reason : '';
                const impact = isObj ? (item as RecommendedAction).expected_impact : '';

                return (
                  <div
                    key={i}
                    className={`p-3 rounded-lg border ${URGENCY_COLORS[urgency] || URGENCY_COLORS.medium}`}
                  >
                    <div className="flex items-start gap-2">
                      <div className="w-5 h-5 rounded border border-current/50 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-[10px] font-bold">{i + 1}</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{action}</p>
                        {reason && <p className="text-xs text-gray-400 mt-0.5">{reason}</p>}
                        {impact && <p className="text-xs text-gray-500 mt-0.5">תוצאה צפויה: {impact}</p>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
