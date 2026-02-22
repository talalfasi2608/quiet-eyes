import { useState, useEffect } from 'react';
import { Target, TrendingUp, CheckCircle, Loader2, Award } from 'lucide-react';

const API_BASE = 'http://localhost:8015';

interface WeightClassData {
  business_id: string;
  business_name: string;
  industry: string;
  archetype: string;
  weight_class: 'micro' | 'small' | 'medium' | 'large';
  description: string;
  growth_potential: number;
  metrics: {
    competitors_count: number;
    leads_count: number;
    reviews_avg: number;
    pulse_score: number;
  };
}

interface GrowthStep {
  step: string;
  description: string;
  timeline: string;
  effort: string;
  impact: string;
  category: string;
}

interface GrowthPlanData {
  business_id: string;
  business_name: string;
  weight_class: string;
  industry: string;
  archetype: string;
  growth_steps: GrowthStep[];
  strategy_summary: string;
  priority_focus: string;
}

const WEIGHT_BADGE: Record<string, { label: string; bg: string; text: string; border: string }> = {
  micro:  { label: 'מיקרו',  bg: 'bg-gray-500/20',   text: 'text-gray-300',   border: 'border-gray-500/30' },
  small:  { label: 'קטן',    bg: 'bg-blue-500/20',    text: 'text-blue-400',   border: 'border-blue-500/30' },
  medium: { label: 'בינוני', bg: 'bg-indigo-500/20',  text: 'text-indigo-400', border: 'border-indigo-500/30' },
  large:  { label: 'גדול',   bg: 'bg-amber-500/20',   text: 'text-amber-400',  border: 'border-amber-500/30' },
};

const POTENTIAL_COLOR = (val: number) => {
  if (val >= 8) return 'bg-emerald-500';
  if (val >= 5) return 'bg-indigo-500';
  if (val >= 3) return 'bg-amber-500';
  return 'bg-red-500';
};

export default function GrowthAdvisor({ businessId }: { businessId: string }) {
  const [weightClass, setWeightClass] = useState<WeightClassData | null>(null);
  const [growthPlan, setGrowthPlan] = useState<GrowthPlanData | null>(null);
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!businessId) return;

    setLoading(true);
    setError(null);

    const fetchWeightClass = fetch(`${API_BASE}/expert/weight-class/${businessId}`)
      .then(r => {
        if (!r.ok) throw new Error('Failed to fetch weight class');
        return r.json();
      });

    const fetchGrowthPlan = fetch(`${API_BASE}/expert/growth-plan/${businessId}`)
      .then(r => {
        if (!r.ok) throw new Error('Failed to fetch growth plan');
        return r.json();
      });

    Promise.all([fetchWeightClass, fetchGrowthPlan])
      .then(([wc, gp]) => {
        setWeightClass(wc);
        setGrowthPlan(gp);
      })
      .catch(err => {
        setError(err.message || 'Failed to load growth data');
      })
      .finally(() => setLoading(false));
  }, [businessId]);

  const toggleCheck = (index: number) => {
    setChecked(prev => ({ ...prev, [index]: !prev[index] }));
  };

  // --- Loading ---
  if (loading) {
    return (
      <div className="glass-card p-6" dir="rtl">
        <div className="flex items-center justify-center gap-3 text-gray-400 py-8">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>טוען ניתוח צמיחה...</span>
        </div>
      </div>
    );
  }

  // --- Error ---
  if (error) {
    return (
      <div className="glass-card p-6" dir="rtl">
        <div className="text-center py-6">
          <Target className="w-8 h-8 text-red-400 mx-auto mb-2" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  if (!weightClass) return null;

  const badge = WEIGHT_BADGE[weightClass.weight_class] || WEIGHT_BADGE.small;
  const potentialPct = (weightClass.growth_potential / 10) * 100;
  const steps = growthPlan?.growth_steps || [];

  return (
    <div className="glass-card overflow-hidden" dir="rtl">
      {/* Header */}
      <div className="p-5 bg-gradient-to-l from-indigo-500/10 to-purple-500/10 border-b border-gray-700/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gray-900/50 flex items-center justify-center">
              <Award className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-base">יועץ צמיחה</h3>
              <p className="text-xs text-gray-400 mt-0.5">ניתוח משקל עסקי ותוכנית צמיחה</p>
            </div>
          </div>
          <div className={`px-3 py-1.5 rounded-lg border text-sm font-medium ${badge.bg} ${badge.text} ${badge.border}`}>
            {badge.label}
          </div>
        </div>
      </div>

      {/* Weight class info + growth potential */}
      <div className="p-5 space-y-4">
        {/* Description */}
        <p className="text-sm text-gray-300 leading-relaxed">
          {weightClass.description}
        </p>

        {/* Metrics row */}
        <div className="grid grid-cols-4 gap-2">
          <div className="p-2.5 rounded-lg bg-gray-800/50 text-center">
            <span className="text-lg font-bold text-white">{weightClass.metrics.competitors_count}</span>
            <span className="text-xs text-gray-400 block mt-0.5">מתחרים</span>
          </div>
          <div className="p-2.5 rounded-lg bg-gray-800/50 text-center">
            <span className="text-lg font-bold text-white">{weightClass.metrics.leads_count}</span>
            <span className="text-xs text-gray-400 block mt-0.5">לידים</span>
          </div>
          <div className="p-2.5 rounded-lg bg-gray-800/50 text-center">
            <span className="text-lg font-bold text-white">{weightClass.metrics.reviews_avg}</span>
            <span className="text-xs text-gray-400 block mt-0.5">ממוצע ביקורות</span>
          </div>
          <div className="p-2.5 rounded-lg bg-gray-800/50 text-center">
            <span className="text-lg font-bold text-white">{weightClass.metrics.pulse_score || '–'}</span>
            <span className="text-xs text-gray-400 block mt-0.5">ציון פעימה</span>
          </div>
        </div>

        {/* Growth potential bar */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-400" />
              <span className="text-sm text-gray-300">פוטנציאל צמיחה</span>
            </div>
            <span className="text-sm font-bold text-white">{weightClass.growth_potential}/10</span>
          </div>
          <div className="w-full h-2.5 bg-gray-700/50 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ease-out ${POTENTIAL_COLOR(weightClass.growth_potential)}`}
              style={{ width: `${potentialPct}%` }}
            />
          </div>
        </div>

        {/* Strategy summary */}
        {growthPlan?.strategy_summary && (
          <div className="p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
            <p className="text-sm text-indigo-300 leading-relaxed">
              {growthPlan.strategy_summary}
            </p>
          </div>
        )}

        {/* Priority focus */}
        {growthPlan?.priority_focus && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
            <Target className="w-4 h-4 text-purple-400 mt-0.5 shrink-0" />
            <div>
              <span className="text-xs text-purple-400 font-medium block mb-1">עדיפות עליונה</span>
              <span className="text-sm text-purple-300">{growthPlan.priority_focus}</span>
            </div>
          </div>
        )}

        {/* Growth steps */}
        {steps.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-400 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              צעדי צמיחה ({steps.length})
            </h4>
            {steps.map((step, i) => (
              <button
                key={i}
                onClick={() => toggleCheck(i)}
                className={`w-full text-right flex items-start gap-3 p-3 rounded-lg border transition-all duration-200 ${
                  checked[i]
                    ? 'bg-emerald-500/10 border-emerald-500/20'
                    : 'bg-gray-800/50 border-gray-700/30 hover:border-indigo-500/30 hover:bg-gray-800/70'
                }`}
              >
                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                  checked[i]
                    ? 'border-emerald-500 bg-emerald-500'
                    : 'border-gray-600'
                }`}>
                  {checked[i] && <CheckCircle className="w-3 h-3 text-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-sm font-medium ${checked[i] ? 'text-emerald-300 line-through' : 'text-white'}`}>
                      {step.step}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {step.timeline && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-700/50 text-gray-400">
                          {step.timeline}
                        </span>
                      )}
                      {step.impact && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                          step.impact === 'גבוה' ? 'bg-emerald-500/20 text-emerald-400' :
                          step.impact === 'בינוני' ? 'bg-amber-500/20 text-amber-400' :
                          'bg-gray-700/50 text-gray-400'
                        }`}>
                          {step.impact}
                        </span>
                      )}
                    </div>
                  </div>
                  <p className={`text-xs mt-1 leading-relaxed ${checked[i] ? 'text-gray-500' : 'text-gray-400'}`}>
                    {step.description}
                  </p>
                  {step.category && (
                    <span className="text-[10px] text-indigo-400 mt-1 inline-block">
                      {step.category}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
