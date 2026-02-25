import { useState, useEffect } from 'react';
import { useSimulation } from '../../context/SimulationContext';
import { apiFetch } from '../../services/api';
import { FileDown, Loader2, BarChart3, Users, Zap, Target } from 'lucide-react';
import toast from 'react-hot-toast';
import PageLoader from '../../components/ui/PageLoader';
import EmptyState from '../../components/ui/EmptyState';

interface ReportPreview {
  business_name: string;
  industry: string;
  date_range: string;
  health_score: number;
  competitors_count: number;
  top_competitors: Array<{ name: string; rating: number; threat: string }>;
  lead_stats: { new: number; approved: number; rejected: number; dismissed: number };
  total_leads: number;
  events_count: number;
  recent_events: Array<{ title: string; type: string; severity: string }>;
  action_items_count: number;
  action_items: Array<{ title: string; priority: number }>;
}

export default function Reports() {
  const { currentProfile } = useSimulation();
  const [preview, setPreview] = useState<ReportPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (currentProfile?.id) {
      loadPreview();
    }
  }, [currentProfile?.id]);

  const loadPreview = async () => {
    if (!currentProfile?.id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/reports/weekly-brief/${currentProfile.id}/preview`);
      if (!res.ok) throw new Error('Failed to load preview');
      const data = await res.json();
      setPreview(data.preview);
    } catch (err) {
      toast.error('שגיאה בטעינת דו"ח');
      setError('שגיאה בטעינת דו"ח');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!currentProfile?.id || downloading) return;
    setDownloading(true);
    try {
      const response = await apiFetch(`/reports/weekly-brief/${currentProfile.id}`);
      if (response.status === 404) {
        toast.error('הדו"ח עדיין לא מוכן. המערכת תייצר אותו בקרוב.');
        return;
      }
      if (!response.ok) throw new Error('PDF generation failed');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `strategic-brief-${currentProfile.id.slice(0, 8)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error('שגיאה בהורדת PDF');
    } finally {
      setDownloading(false);
    }
  };

  const healthColor = (score: number) => {
    if (score >= 70) return 'text-green-400';
    if (score >= 40) return 'text-amber-400';
    return 'text-red-400';
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">דו"חות</h1>
          <p className="text-gray-400 text-sm mt-1">דו"חות אסטרטגיים שבועיים</p>
        </div>
        <button
          onClick={handleDownload}
          disabled={downloading || !currentProfile?.id}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-500 text-white font-medium transition-all duration-300 disabled:opacity-50"
        >
          {downloading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>מייצר...</span>
            </>
          ) : (
            <>
              <FileDown className="w-5 h-5" />
              <span>הורד דו"ח השבוע</span>
            </>
          )}
        </button>
      </div>

      {/* Loading State */}
      {loading && <PageLoader message='טוען דו"חות...' />}

      {/* Error */}
      {error && (
        <div className="glass-card p-4 border border-red-500/30 text-red-400 text-center">
          {error}
        </div>
      )}

      {!preview && !loading && !error && (
        <EmptyState
          icon={FileDown}
          title='אין דו"חות זמינים'
          description='הדו"ח השבועי ייוצר אוטומטית לאחר שהמערכת תאסוף מספיק מודיעין'
        />
      )}

      {/* Preview Cards */}
      {preview && !loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Health Score */}
          <div className="glass-card p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <p className="text-xs text-gray-400">ציון בריאות</p>
                <p className={`text-2xl font-bold ${healthColor(preview.health_score)}`}>
                  {preview.health_score}
                </p>
              </div>
            </div>
          </div>

          {/* Competitors */}
          <div className="glass-card p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                <Target className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="text-xs text-gray-400">מתחרים במעקב</p>
                <p className="text-2xl font-bold text-white">{preview.competitors_count}</p>
              </div>
            </div>
          </div>

          {/* Leads */}
          <div className="glass-card p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                <Users className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-xs text-gray-400">סה"כ לידים</p>
                <p className="text-2xl font-bold text-white">{preview.total_leads}</p>
              </div>
            </div>
            <div className="flex gap-2 text-xs">
              <span className="text-blue-400">חדשים: {preview.lead_stats.new}</span>
              <span className="text-green-400">אושרו: {preview.lead_stats.approved}</span>
            </div>
          </div>

          {/* Events */}
          <div className="glass-card p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                <Zap className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <p className="text-xs text-gray-400">אירועי מודיעין</p>
                <p className="text-2xl font-bold text-white">{preview.events_count}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Details */}
      {preview && !loading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Competitors */}
          <div className="glass-card p-5">
            <h3 className="text-lg font-semibold text-white mb-4">מתחרים מובילים</h3>
            {preview.top_competitors.length > 0 ? (
              <div className="space-y-3">
                {preview.top_competitors.map((c, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-gray-300">{c.name}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-amber-400 text-sm">{c.rating || '-'}</span>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        c.threat === 'high' ? 'bg-red-500/20 text-red-400' :
                        c.threat === 'medium' ? 'bg-amber-500/20 text-amber-400' :
                        'bg-green-500/20 text-green-400'
                      }`}>
                        {c.threat || 'N/A'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">אין מתחרים במעקב</p>
            )}
          </div>

          {/* Action Items */}
          <div className="glass-card p-5">
            <h3 className="text-lg font-semibold text-white mb-4">פעולות מומלצות ({preview.action_items_count})</h3>
            {preview.action_items.length > 0 ? (
              <div className="space-y-3">
                {preview.action_items.map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="text-indigo-400 font-bold text-sm mt-0.5">{i + 1}.</span>
                    <div>
                      <p className="text-gray-300 text-sm">{item.title}</p>
                      <p className="text-gray-500 text-xs">עדיפות: {item.priority}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">אין המלצות פעילות</p>
            )}
          </div>
        </div>
      )}

      {/* Report Info */}
      {preview && !loading && (
        <div className="glass-card p-4 text-center text-sm text-gray-500">
          {preview.business_name} | {preview.industry} | {preview.date_range}
        </div>
      )}
    </div>
  );
}
