import { useState, useEffect } from 'react';
import { TrendingUp, DollarSign, CheckCircle2, Loader2 } from 'lucide-react';
import { apiFetch } from '../../services/api';

interface ROISummary {
  total_actions: number;
  total_estimated_value: number;
  total_confirmed_value: number;
  roi_ratio: number;
  by_type: Record<string, { count: number; estimated: number; confirmed: number }>;
}

const TYPE_LABELS: Record<string, string> = {
  lead_converted: 'לידים שהומרו',
  competitor_countered: 'תגובה למתחרה',
  review_responded: 'מענה לביקורת',
  recommendation_acted: 'המלצה שיושמה',
};

export default function ROITracker({ businessId }: { businessId: string }) {
  const [summary, setSummary] = useState<ROISummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!businessId) return;
    apiFetch(`/cockpit/roi-summary/${businessId}`)
      .then(r => {
        if (!r.ok) throw new Error('API error');
        return r.json();
      })
      .then(data => setSummary(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [businessId]);

  if (loading) return null;
  if (!summary || summary.total_actions === 0) return null;

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-white flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-emerald-400" />
          מעקב ROI
        </h3>
        <span className="text-xs text-gray-500">{summary.total_actions} פעולות</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-center">
          <DollarSign className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
          <span className="text-lg font-bold text-emerald-400">
            {summary.total_confirmed_value > 0 ? `₪${summary.total_confirmed_value.toLocaleString()}` : '–'}
          </span>
          <span className="text-xs text-gray-400 block">מאושר</span>
        </div>
        <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-center">
          <DollarSign className="w-5 h-5 text-blue-400 mx-auto mb-1" />
          <span className="text-lg font-bold text-blue-400">
            ₪{(summary.total_estimated_value || 0).toLocaleString()}
          </span>
          <span className="text-xs text-gray-400 block">משוער</span>
        </div>
        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-center">
          <CheckCircle2 className="w-5 h-5 text-amber-400 mx-auto mb-1" />
          <span className="text-lg font-bold text-amber-400">
            {Math.round((summary.roi_ratio || 0) * 100)}%
          </span>
          <span className="text-xs text-gray-400 block">מימוש</span>
        </div>
      </div>

      {/* Breakdown by type */}
      <div className="space-y-2">
        {Object.entries(summary.by_type || {}).map(([type, data]) => (
          <div key={type} className="flex items-center justify-between text-sm">
            <span className="text-gray-400">{TYPE_LABELS[type] || type}</span>
            <span className="text-white font-medium">{data.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
