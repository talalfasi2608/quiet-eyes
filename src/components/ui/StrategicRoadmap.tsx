import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE } from '../../config/api';
import { apiFetch } from '../../services/api';
import {
  Megaphone,
  Tag,
  Settings,
  Sparkles,
  Globe,
  ChevronDown,
  ChevronUp,
  Check,
  Circle,
  Target,
  Clock,
  TrendingUp,
  Loader2,
  RefreshCw,
  Rocket,
  AlertTriangle,
  Zap
} from 'lucide-react';

interface ExecutionPlan {
  summary: string;
  steps: string[];
  expected_result: string;
  timeframe: string;
}

interface StrategicAction {
  id: string;
  title: string;
  category: string;
  priority: string;
  target_competitor: string;
  competitor_weakness: string;
  execution_plan: ExecutionPlan;
  estimated_impact: string;
}

interface ActionsResponse {
  success: boolean;
  business_name: string;
  industry: string;
  competitors_count: number;
  competitors_analyzed: Array<{
    name: string;
    rating: number;
    threat_level: string;
    weakness: string;
  }>;
  actions: StrategicAction[];
}

// Category icons and colors
const categoryConfig: Record<string, { icon: typeof Megaphone; color: string; bgColor: string }> = {
  Marketing: { icon: Megaphone, color: 'text-pink-400', bgColor: 'from-pink-500/20 to-rose-500/20' },
  Pricing: { icon: Tag, color: 'text-emerald-400', bgColor: 'from-emerald-500/20 to-teal-500/20' },
  Operations: { icon: Settings, color: 'text-blue-400', bgColor: 'from-blue-500/20 to-cyan-500/20' },
  Service: { icon: Sparkles, color: 'text-amber-400', bgColor: 'from-amber-500/20 to-yellow-500/20' },
  Digital: { icon: Globe, color: 'text-cyan-400', bgColor: 'from-cyan-500/20 to-blue-500/20' },
};

// Priority colors
const priorityConfig: Record<string, { color: string; bgColor: string; label: string }> = {
  High: { color: 'text-red-400', bgColor: 'bg-red-500/20', label: 'דחוף' },
  Medium: { color: 'text-amber-400', bgColor: 'bg-amber-500/20', label: 'חשוב' },
  Low: { color: 'text-blue-400', bgColor: 'bg-blue-500/20', label: 'לטווח ארוך' },
};

// Impact colors
const impactConfig: Record<string, { color: string; label: string }> = {
  High: { color: 'text-emerald-400', label: 'השפעה גבוהה' },
  Medium: { color: 'text-amber-400', label: 'השפעה בינונית' },
  Low: { color: 'text-gray-400', label: 'השפעה נמוכה' },
};

function ActionCard({
  action,
  isCompleted,
  onToggleComplete,
  index
}: {
  action: StrategicAction;
  isCompleted: boolean;
  onToggleComplete: () => void;
  index: number;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const category = categoryConfig[action.category] || categoryConfig.Marketing;
  const priority = priorityConfig[action.priority] || priorityConfig.Medium;
  const impact = impactConfig[action.estimated_impact] || impactConfig.Medium;
  const CategoryIcon = category.icon;

  return (
    <div
      className={`glass-card overflow-hidden transition-all duration-300 ${
        isCompleted ? 'opacity-60' : ''
      }`}
      style={{ animationDelay: `${index * 100}ms` }}
    >
      {/* Header */}
      <div className="flex items-start gap-4">
        {/* Completion Toggle */}
        <button
          onClick={onToggleComplete}
          className={`mt-1 w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0 ${
            isCompleted
              ? 'bg-emerald-500 border-emerald-500 text-white'
              : 'border-gray-600 hover:border-indigo-500 text-transparent hover:text-indigo-400'
          }`}
        >
          <Check className="w-4 h-4" />
        </button>

        {/* Category Icon */}
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${category.bgColor} flex items-center justify-center flex-shrink-0`}>
          <CategoryIcon className={`w-6 h-6 ${category.color}`} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${priority.bgColor} ${priority.color}`}>
              {priority.label}
            </span>
            <span className={`text-xs ${impact.color} flex items-center gap-1`}>
              <TrendingUp className="w-3 h-3" />
              {impact.label}
            </span>
          </div>

          <h3 className={`text-lg font-semibold text-white mb-2 ${isCompleted ? 'line-through' : ''}`}>
            {action.title}
          </h3>

          {/* Target Info */}
          <div className="flex items-center gap-4 text-sm mb-3">
            <div className="flex items-center gap-1.5 text-red-400">
              <Target className="w-4 h-4" />
              <span>{action.target_competitor}</span>
            </div>
            <div className="flex items-center gap-1.5 text-gray-400">
              <AlertTriangle className="w-4 h-4" />
              <span className="truncate max-w-[200px]">{action.competitor_weakness}</span>
            </div>
          </div>

          {/* Expand Button */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2 text-indigo-400 hover:text-indigo-300 transition-colors text-sm"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="w-4 h-4" />
                <span>הסתר תוכנית ביצוע</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4" />
                <span>הצג תוכנית ביצוע</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Expanded Execution Plan */}
      {isExpanded && (
        <div className="mt-6 pt-6 border-t border-gray-700/50 space-y-4 fade-in">
          {/* Summary */}
          <div className="bg-indigo-500/10 rounded-xl p-4 border border-indigo-500/20">
            <p className="text-indigo-300 font-medium">{action.execution_plan.summary}</p>
          </div>

          {/* Steps */}
          <div>
            <h4 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
              <Rocket className="w-4 h-4" />
              צעדים לביצוע
            </h4>
            <div className="space-y-2">
              {action.execution_plan.steps.map((step, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 bg-gray-800/50 rounded-lg p-3"
                >
                  <div className="w-6 h-6 rounded-full bg-indigo-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-indigo-400 text-sm font-medium">{i + 1}</span>
                  </div>
                  <p className="text-gray-300 text-sm">{step}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Expected Result & Timeframe */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-emerald-500/10 rounded-xl p-4 border border-emerald-500/20">
              <div className="flex items-center gap-2 text-emerald-400 mb-2">
                <TrendingUp className="w-4 h-4" />
                <span className="text-sm font-medium">תוצאה צפויה</span>
              </div>
              <p className="text-gray-300 text-sm">{action.execution_plan.expected_result}</p>
            </div>
            <div className="bg-amber-500/10 rounded-xl p-4 border border-amber-500/20">
              <div className="flex items-center gap-2 text-amber-400 mb-2">
                <Clock className="w-4 h-4" />
                <span className="text-sm font-medium">זמן ביצוע</span>
              </div>
              <p className="text-gray-300 text-sm">{action.execution_plan.timeframe}</p>
            </div>
          </div>

          {/* Mark Complete Button */}
          {!isCompleted && (
            <button
              onClick={onToggleComplete}
              className="w-full mt-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-3 px-4 rounded-xl font-medium hover:from-emerald-500 hover:to-teal-500 transition-all flex items-center justify-center gap-2"
            >
              <Check className="w-5 h-5" />
              <span>סמן כהושלם</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function StrategicRoadmap() {
  const { user } = useAuth();
  const [actions, setActions] = useState<StrategicAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completedActions, setCompletedActions] = useState<Set<string>>(new Set());
  const [businessName, setBusinessName] = useState('');
  const [competitorsCount, setCompetitorsCount] = useState(0);

  // Load completed actions from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('completedActions');
    if (saved) {
      setCompletedActions(new Set(JSON.parse(saved)));
    }
  }, []);

  // Fetch actions from API
  useEffect(() => {
    if (user?.id) {
      fetchActions();
    }
  }, [user?.id]);

  const fetchActions = async () => {
    if (!user?.id) return;

    setLoading(true);
    setError(null);

    try {
      const response = await apiFetch(`/business/actions/${user.id}`);

      if (!response.ok) {
        throw new Error('Failed to fetch actions');
      }

      const data: ActionsResponse = await response.json();

      setActions(data.actions || []);
      setBusinessName(data.business_name || '');
      setCompetitorsCount(data.competitors_count || 0);
    } catch (err) {
      setError('לא הצלחנו לטעון את תוכנית הפעולה');
    } finally {
      setLoading(false);
    }
  };

  const toggleComplete = (actionId: string) => {
    setCompletedActions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(actionId)) {
        newSet.delete(actionId);
      } else {
        newSet.add(actionId);
      }
      // Save to localStorage
      localStorage.setItem('completedActions', JSON.stringify([...newSet]));
      return newSet;
    });
  };

  const completedCount = actions.filter(a => completedActions.has(a.id)).length;
  const progressPercent = actions.length > 0 ? (completedCount / actions.length) * 100 : 0;

  // Loading State
  if (loading) {
    return (
      <div className="glass-card">
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
            </div>
          </div>
          <p className="text-gray-400">מייצר תוכנית אסטרטגית מבוססת מתחרים...</p>
        </div>
      </div>
    );
  }

  // Error State
  if (error) {
    return (
      <div className="glass-card">
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <AlertTriangle className="w-12 h-12 text-amber-400" />
          <p className="text-gray-400">{error}</p>
          <button
            onClick={fetchActions}
            className="btn-primary flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            נסה שוב
          </button>
        </div>
      </div>
    );
  }

  // Empty State
  if (actions.length === 0) {
    return (
      <div className="glass-card">
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center">
            <Target className="w-10 h-10 text-indigo-400" />
          </div>
          <h3 className="text-xl font-semibold text-white">אין תוכנית פעולה עדיין</h3>
          <p className="text-gray-500 text-center max-w-md">
            סרוק מתחרים קודם כדי שנוכל לייצר תוכנית אסטרטגית מותאמת אישית
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center">
                <Zap className="w-5 h-5 text-white" />
              </div>
              מפת הדרכים האסטרטגית
            </h2>
            <p className="text-gray-400 mt-1">
              {actions.length} פעולות מבוססות על ניתוח {competitorsCount} מתחרים
            </p>
          </div>
          <button
            onClick={fetchActions}
            className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors text-gray-400 hover:text-white"
            title="רענן תוכנית"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">התקדמות</span>
            <span className="text-indigo-400 font-medium">{completedCount}/{actions.length} הושלמו</span>
          </div>
          <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          {completedCount === actions.length && actions.length > 0 && (
            <div className="flex items-center justify-center gap-2 text-emerald-400 mt-4 py-3 bg-emerald-500/10 rounded-xl">
              <Sparkles className="w-5 h-5" />
              <span className="font-medium">מעולה! השלמת את כל הפעולות!</span>
            </div>
          )}
        </div>
      </div>

      {/* Action Cards */}
      <div className="space-y-4">
        {actions.map((action, index) => (
          <ActionCard
            key={action.id}
            action={action}
            isCompleted={completedActions.has(action.id)}
            onToggleComplete={() => toggleComplete(action.id)}
            index={index}
          />
        ))}
      </div>
    </div>
  );
}
