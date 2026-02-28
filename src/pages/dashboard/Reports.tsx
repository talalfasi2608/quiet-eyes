import { useState, useEffect } from 'react';
import { useSimulation } from '../../context/SimulationContext';
import { apiFetch } from '../../services/api';
import {
  FileDown, Loader2, BarChart3, Users, Zap, Target,
  Star, Shield, TrendingUp, Crosshair, MessageSquare,
  ChevronDown, ChevronUp,
} from 'lucide-react';
import toast from 'react-hot-toast';
import PageLoader from '../../components/ui/PageLoader';
import EmptyState from '../../components/ui/EmptyState';

interface HotLead {
  name: string;
  platform: string;
  score: number;
  status: string;
}

interface ActionItem {
  title: string;
  priority: number;
  reason?: string;
  expected_result?: string;
  time_required?: string;
}

interface ReportPreview {
  business_name: string;
  industry: string;
  date_range: string;
  health_score: number;
  competitors_count: number;
  top_competitors: Array<{ name: string; rating: number; threat: string }>;
  lead_stats: { new: number; approved: number; rejected: number; dismissed?: number };
  total_leads: number;
  events_count: number;
  recent_events: Array<{ title: string; type?: string; event_type?: string; severity: string }>;
  action_items_count: number;
  action_items: ActionItem[];
  executive_summary?: string;
  leads_narrative?: string;
  reputation_narrative?: string;
  competitor_narrative?: string;
  opportunity_of_week?: string;
  hot_leads?: HotLead[];
  market_position?: number;
  current_rating?: number;
}

export default function Reports() {
  const { currentProfile } = useSimulation();
  const [preview, setPreview] = useState<ReportPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>('summary');

  useEffect(() => {
    if (currentProfile?.id) {
      loadPreview();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    } catch {
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
      a.download = `war-room-report-${currentProfile.id.slice(0, 8)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('הדו"ח הורד בהצלחה!');
    } catch {
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

  const healthBg = (score: number) => {
    if (score >= 70) return 'from-green-500/20 to-green-500/5';
    if (score >= 40) return 'from-amber-500/20 to-amber-500/5';
    return 'from-red-500/20 to-red-500/5';
  };

  const toggleSection = (section: string) => {
    setExpandedSection(prev => prev === section ? null : section);
  };

  return (
    <div className="space-y-6 animate-fade-in" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <FileDown className="w-7 h-7 text-cyan-400" />
            דוח מודיעין שבועי
          </h1>
          <p className="text-gray-400 text-sm mt-1">War Room Report — ניתוח שוק ותוכנית פעולה</p>
        </div>
        <button
          onClick={handleDownload}
          disabled={downloading || !currentProfile?.id}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-medium transition-all duration-300 disabled:opacity-50 shadow-lg shadow-cyan-500/20"
        >
          {downloading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>מייצר PDF...</span>
            </>
          ) : (
            <>
              <FileDown className="w-5 h-5" />
              <span>הורד דוח PDF</span>
            </>
          )}
        </button>
      </div>

      {loading && <PageLoader message='טוען דו"ח מודיעין...' />}

      {error && (
        <div className="glass-card p-4 border border-red-500/30 text-red-400 text-center">
          {error}
        </div>
      )}

      {!preview && !loading && !error && (
        <EmptyState
          emoji="📊"
          title="הדוח הראשון שלך בדרך"
          description={"הדוח השבועי הראשון יהיה מוכן\nביום ראשון הקרוב."}
          actionLabel="צור דוח ידני עכשיו"
          onAction={async () => {
            if (!currentProfile?.id) return;
            toast.loading('מייצר דוח...', { id: 'gen-report' });
            try {
              const res = await apiFetch(`/reports/generate/${currentProfile.id}`, { method: 'POST' });
              if (res.ok) {
                toast.success('הדוח נוצר בהצלחה!', { id: 'gen-report' });
                await loadPreview();
              } else {
                toast.error('שגיאה ביצירת הדוח', { id: 'gen-report' });
              }
            } catch {
              toast.error('שגיאה ביצירת הדוח', { id: 'gen-report' });
            }
          }}
          actionIcon={FileDown}
        />
      )}

      {preview && !loading && (
        <>
          {/* KPI Cards Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            {/* Health Score */}
            <div className={`glass-card p-5 bg-gradient-to-b ${healthBg(preview.health_score)}`}>
              <div className="flex items-center gap-3 mb-1">
                <div className="w-10 h-10 rounded-lg bg-gray-800/60 flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-400">ציון בריאות</p>
                  <p className={`text-3xl font-bold ${healthColor(preview.health_score)}`}>
                    {preview.health_score}
                  </p>
                </div>
              </div>
            </div>

            {/* Rating */}
            <div className="glass-card p-5">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                  <Star className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-400">דירוג גוגל</p>
                  <p className="text-3xl font-bold text-white">
                    {preview.current_rating || '-'}
                  </p>
                </div>
              </div>
              {preview.market_position ? (
                <p className="text-xs text-cyan-400 mt-1">מיקום #{preview.market_position} בשוק</p>
              ) : null}
            </div>

            {/* Leads */}
            <div className="glass-card p-5">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                  <Users className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-400">לידים השבוע</p>
                  <p className="text-3xl font-bold text-white">{preview.total_leads}</p>
                </div>
              </div>
              <div className="flex gap-3 text-xs mt-1">
                <span className="text-blue-400">חדשים: {preview.lead_stats.new}</span>
                <span className="text-green-400">אושרו: {preview.lead_stats.approved}</span>
              </div>
            </div>

            {/* Events */}
            <div className="glass-card p-5">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-400">אירועי מודיעין</p>
                  <p className="text-3xl font-bold text-white">{preview.events_count}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Executive Summary */}
          {preview.executive_summary && (
            <CollapsibleSection
              title="תקציר מנהלים"
              icon={<BarChart3 className="w-5 h-5 text-cyan-400" />}
              tag="01"
              isOpen={expandedSection === 'summary'}
              onToggle={() => toggleSection('summary')}
            >
              <div className="bg-gradient-to-r from-cyan-500/5 to-blue-500/5 border border-cyan-500/20 rounded-xl p-5">
                <p className="text-gray-200 leading-relaxed whitespace-pre-wrap">{preview.executive_summary}</p>
              </div>
              {preview.opportunity_of_week && (
                <div className="mt-4 bg-gradient-to-r from-green-500/5 to-cyan-500/5 border border-green-500/20 rounded-xl p-5">
                  <p className="text-green-400 font-semibold text-sm mb-2">הזדמנות השבוע</p>
                  <p className="text-gray-200">{preview.opportunity_of_week}</p>
                </div>
              )}
            </CollapsibleSection>
          )}

          {/* Leads Section */}
          <CollapsibleSection
            title="דוח לידים"
            icon={<Crosshair className="w-5 h-5 text-emerald-400" />}
            tag="02"
            isOpen={expandedSection === 'leads'}
            onToggle={() => toggleSection('leads')}
          >
            {preview.leads_narrative && (
              <div className="glass-card p-4 mb-4">
                <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">{preview.leads_narrative}</p>
              </div>
            )}
            {preview.hot_leads && preview.hot_leads.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-white mb-3">לידים חמים מובילים</p>
                <div className="space-y-2">
                  {preview.hot_leads.map((lead, i) => (
                    <div key={i} className="glass-card p-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Target className="w-4 h-4 text-emerald-400" />
                        <span className="text-gray-200 text-sm">{lead.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-400">{lead.platform}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">
                          {lead.score}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CollapsibleSection>

          {/* Reputation Section */}
          {preview.reputation_narrative && (
            <CollapsibleSection
              title="דוח מוניטין"
              icon={<MessageSquare className="w-5 h-5 text-amber-400" />}
              tag="03"
              isOpen={expandedSection === 'reputation'}
              onToggle={() => toggleSection('reputation')}
            >
              <div className="glass-card p-4">
                <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">{preview.reputation_narrative}</p>
              </div>
            </CollapsibleSection>
          )}

          {/* Competitors Section */}
          <CollapsibleSection
            title="ניתוח מתחרים"
            icon={<Shield className="w-5 h-5 text-red-400" />}
            tag="04"
            isOpen={expandedSection === 'competitors'}
            onToggle={() => toggleSection('competitors')}
          >
            {preview.top_competitors.length > 0 ? (
              <div className="space-y-2 mb-4">
                {preview.top_competitors.map((c, i) => (
                  <div key={i} className="glass-card p-3 flex items-center justify-between">
                    <span className="text-gray-200 text-sm">{c.name}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-amber-400 text-sm">{c.rating || '-'}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        c.threat === 'גבוה' ? 'bg-red-500/15 text-red-400' :
                        c.threat === 'בינוני' ? 'bg-amber-500/15 text-amber-400' :
                        'bg-green-500/15 text-green-400'
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
            {preview.competitor_narrative && (
              <div className="glass-card p-4">
                <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">{preview.competitor_narrative}</p>
              </div>
            )}
          </CollapsibleSection>

          {/* Action Plan */}
          {preview.action_items.length > 0 && (
            <CollapsibleSection
              title="תוכנית פעולה לשבוע הבא"
              icon={<TrendingUp className="w-5 h-5 text-purple-400" />}
              tag="05"
              isOpen={expandedSection === 'actions'}
              onToggle={() => toggleSection('actions')}
            >
              <div className="space-y-3">
                {preview.action_items.map((item, i) => (
                  <div key={i} className="glass-card p-4 flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-cyan-500 flex items-center justify-center text-gray-900 font-bold text-sm shrink-0">
                      {item.priority || i + 1}
                    </div>
                    <div className="flex-1">
                      <p className="text-white font-medium text-sm">{item.title}</p>
                      {item.reason && (
                        <p className="text-gray-400 text-xs mt-1">{item.reason}</p>
                      )}
                      <div className="flex gap-4 mt-2">
                        {item.time_required && (
                          <span className="text-xs text-cyan-400">⏱ {item.time_required}</span>
                        )}
                        {item.expected_result && (
                          <span className="text-xs text-cyan-400">🎯 {item.expected_result}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          )}

          {/* Report Footer */}
          <div className="glass-card p-4 text-center text-sm text-gray-500">
            {preview.business_name} | {preview.industry} | {preview.date_range}
          </div>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COLLAPSIBLE SECTION COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

function CollapsibleSection({
  title, icon, tag, isOpen, onToggle, children,
}: {
  title: string;
  icon: React.ReactNode;
  tag: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="glass-card overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full p-5 flex items-center gap-3 text-right hover:bg-gray-800/30 transition-colors"
      >
        <span className="text-xs text-cyan-400 font-mono font-bold">{tag}</span>
        {icon}
        <span className="flex-1 text-lg font-semibold text-white">{title}</span>
        {isOpen ? (
          <ChevronUp className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        )}
      </button>
      {isOpen && (
        <div className="p-5 pt-0 border-t border-gray-700/30">
          {children}
        </div>
      )}
    </section>
  );
}
