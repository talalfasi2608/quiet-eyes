import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { useSimulation } from '../../context/SimulationContext';
import PageLoader from '../../components/ui/PageLoader';
import { Building, MapPin, Phone, Globe, Clock, Bell, Shield, Save, Check, Loader2, AlertCircle, RefreshCw, Compass, CreditCard } from 'lucide-react';
import { apiFetch } from '../../services/api';

type ArchetypeId = 'Visual' | 'Expert' | 'Field' | 'Merchant';

const archetypeOptions: { id: ArchetypeId; name: string; icon: string }[] = [
  { id: 'Visual', name: 'ויזואלי', icon: '🎨' },
  { id: 'Expert', name: 'מומחה', icon: '🎓' },
  { id: 'Field', name: 'שטח', icon: '🚚' },
  { id: 'Merchant', name: 'סוחר', icon: '🛒' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// SCHEDULED JOBS TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface ScheduledJob {
  id: number;
  business_id: string;
  job_type: string;
  cron_expression: string;
  status: 'active' | 'paused';
  last_run_at: string | null;
  next_run_at: string | null;
  created_at: string;
}

const JOB_LABELS: Record<string, { name: string; description: string }> = {
  competitor_scan: { name: 'סריקת מתחרים', description: 'סריקה אוטומטית של מתחרים חדשים באזור' },
  lead_snipe: { name: 'ציד לידים', description: 'חיפוש אוטומטי של לידים חדשים' },
  market_discovery: { name: 'גילוי שוק', description: 'סריקת שוק כללית ומציאת מתחרים' },
  price_check: { name: 'בדיקת מחירים', description: 'מעקב אחר שינויי מחירים של מתחרים' },
};

function cronToHebrew(cron: string): string {
  const match4h = cron.match(/^0\s+\*\/(\d+)\s+\*\s+\*\s+\*$/);
  if (match4h) return `כל ${match4h[1]} שעות`;
  if (cron === '0 0 * * *') return 'פעם ביום (חצות)';
  const matchTime = cron.match(/^(\d+)\s+(\d+)\s+\*\s+\*\s+\*$/);
  if (matchTime) return `כל יום ב-${matchTime[2]}:${matchTime[1].padStart(2, '0')}`;
  return cron;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return 'טרם הורץ';
  return new Date(iso).toLocaleString('he-IL', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function Settings() {
  const { user } = useAuth();
  const { currentProfile, refreshProfile } = useSimulation();
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Load ALL form data from the real business profile
  const [formData, setFormData] = useState<{
    businessName: string;
    address: string;
    phone: string;
    website: string;
    hours: string;
    archetype: ArchetypeId;
    scope: string;
  }>({
    businessName: currentProfile?.nameHebrew || currentProfile?.business_name || '',
    address: currentProfile?.address || '',
    phone: '',
    website: '',
    hours: '',
    archetype: currentProfile?.archetype || 'Merchant',
    scope: currentProfile?.scope || 'local',
  });

  // Sync form when profile data loads asynchronously
  useEffect(() => {
    if (currentProfile) {
      setFormData((prev) => ({
        ...prev,
        businessName: currentProfile.nameHebrew || currentProfile.business_name || prev.businessName,
        address: currentProfile.address || prev.address,
        archetype: currentProfile.archetype || prev.archetype,
        scope: currentProfile.scope || prev.scope,
      }));
    }
  }, [currentProfile]);

  const [notifications, setNotifications] = useState({
    newReviews: true,
    competitorAlerts: true,
    trendUpdates: false,
    weeklyReport: true,
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SCHEDULED JOBS STATE
  // ═══════════════════════════════════════════════════════════════════════════

  const [jobs, setJobs] = useState<ScheduledJob[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [togglingJob, setTogglingJob] = useState<number | null>(null);
  const [resettingJobs, setResettingJobs] = useState(false);

  const fetchJobs = useCallback(async () => {
    if (!currentProfile?.id) return;
    setJobsLoading(true);
    try {
      const res = await apiFetch(`/jobs/${currentProfile.id}`);
      if (res.ok) {
        const data = await res.json();
        setJobs(data.jobs || []);
      }
    } catch {
      toast.error('שגיאה בטעינת הגדרות');
    } finally {
      setJobsLoading(false);
    }
  }, [currentProfile?.id]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const toggleJob = async (jobId: number, active: boolean) => {
    if (!currentProfile?.id) return;
    setTogglingJob(jobId);
    try {
      await apiFetch(`/jobs/${currentProfile.id}/toggle/${jobId}`, {
        method: 'POST',
        body: JSON.stringify({ active }),
      });
      setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: active ? 'active' : 'paused' } : j));
    } catch {
      // Revert on error
    } finally {
      setTogglingJob(null);
    }
  };

  const resetDefaults = async () => {
    if (!currentProfile?.id) return;
    setResettingJobs(true);
    try {
      await apiFetch(`/jobs/${currentProfile.id}/ensure-defaults`, {
        method: 'POST',
      });
      await fetchJobs();
    } catch {
      // Non-critical
    } finally {
      setResettingJobs(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // SAVE HANDLER
  // ═══════════════════════════════════════════════════════════════════════════

  const handleSave = async () => {
    if (!currentProfile?.id) return;
    setIsSaving(true);
    setSaveError(null);

    try {
      const res = await apiFetch(`/business/profile/${currentProfile.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          business_name: formData.businessName || undefined,
          address: formData.address || undefined,
          phone: formData.phone || undefined,
          website: formData.website || undefined,
          hours: formData.hours || undefined,
          archetype: formData.archetype || undefined,
          scope: formData.scope || undefined,
          notifications,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to save');
      }

      setSaved(true);
      toast.success('ההגדרות נשמרו בהצלחה');
      setTimeout(() => setSaved(false), 2000);
      await refreshProfile();
    } catch (err: unknown) {
      toast.error('שגיאה בשמירה');
      setSaveError(err instanceof Error ? err.message : 'שגיאה בשמירה');
    } finally {
      setIsSaving(false);
    }
  };

  if (!currentProfile) return <PageLoader message="טוען הגדרות..." />;

  return (
    <div className="space-y-6 fade-in">
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: "var(--font-display)" }}>הגדרות</h1>
          <p className="text-[var(--text-secondary)]">פרופיל העסק והעדפות</p>
        </div>
        <div className="flex items-center gap-3">
          {saveError && (
            <span className="flex items-center gap-1 text-sm text-red-400">
              <AlertCircle className="w-4 h-4" />
              {saveError}
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={isSaving}
            className={"btn-primary flex items-center gap-2 " + (saved ? "bg-emerald-500" : "") + (isSaving ? " opacity-70 cursor-wait" : "")}
          >
            {isSaving ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>שומר...</span>
              </>
            ) : saved ? (
              <>
                <Check className="w-5 h-5" />
                <span>נשמר!</span>
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                <span>שמור שינויים</span>
              </>
            )}
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Business Profile */}
        <div className="glass-card">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
              <Building className="w-5 h-5 text-indigo-400" />
            </div>
            <h2 className="text-lg font-semibold text-white">פרטי העסק</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-gray-400 text-sm mb-2">שם העסק</label>
              <div className="relative">
                <Building className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="text"
                  value={formData.businessName}
                  onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                  className="input-glass pr-12"
                  dir="rtl"
                />
              </div>
            </div>

            <div>
              <label className="block text-gray-400 text-sm mb-2">כתובת</label>
              <div className="relative">
                <MapPin className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="input-glass pr-12"
                  dir="rtl"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-400 text-sm mb-2">טלפון</label>
                <div className="relative">
                  <Phone className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="input-glass pr-12"
                    dir="ltr"
                  />
                </div>
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-2">אתר</label>
                <div className="relative">
                  <Globe className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="url"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    className="input-glass pr-12"
                    dir="ltr"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-gray-400 text-sm mb-2">שעות פעילות</label>
              <div className="relative">
                <Clock className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="text"
                  value={formData.hours}
                  onChange={(e) => setFormData({ ...formData, hours: e.target.value })}
                  className="input-glass pr-12"
                  dir="ltr"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Archetype Selection */}
        <div className="glass-card">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
              <Shield className="w-5 h-5 text-cyan-400" />
            </div>
            <h2 className="text-lg font-semibold text-white">ארכיטיפ העסק</h2>
          </div>

          <p className="text-gray-400 text-sm mb-4">
            הארכיטיפ משפיע על סוג התובנות והניתוחים שתקבל
          </p>

          <div className="grid grid-cols-2 gap-3">
            {archetypeOptions.map((option) => (
              <button
                key={option.id}
                onClick={() => setFormData({ ...formData, archetype: option.id })}
                className={"p-4 rounded-xl transition-all " + (formData.archetype === option.id ? "bg-indigo-500/20 border border-indigo-500/50" : "bg-gray-800/50 border border-gray-700/50 hover:border-gray-600")}
              >
                <span className="text-2xl block mb-2">{option.icon}</span>
                <span className="text-white font-medium">{option.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Scope Selection */}
        <div className="glass-card lg:col-span-2">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-teal-500/20 flex items-center justify-center">
              <Compass className="w-5 h-5 text-teal-400" />
            </div>
            <h2 className="text-lg font-semibold text-white">היקף פעילות</h2>
          </div>

          <p className="text-gray-400 text-sm mb-4">
            היקף הפעילות משפיע על סוג המודיעין והמלצות ה-AI
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {([
              { id: 'local', name: 'מקומי', icon: '\uD83D\uDCCD', desc: 'שכונה / עיר אחת' },
              { id: 'regional', name: 'אזורי', icon: '\uD83D\uDDFA\uFE0F', desc: 'מספר ערים / מחוז' },
              { id: 'national', name: 'ארצי', icon: '\uD83C\uDDEE\uD83C\uDDF1', desc: 'פריסה כלל-ארצית' },
              { id: 'global', name: 'בינלאומי', icon: '\uD83C\uDF0D', desc: 'יצוא / פעילות גלובלית' },
            ] as const).map((option) => (
              <button
                key={option.id}
                onClick={() => setFormData({ ...formData, scope: option.id })}
                className={"p-4 rounded-xl transition-all text-center " + (formData.scope === option.id ? "bg-teal-500/20 border border-teal-500/50" : "bg-gray-800/50 border border-gray-700/50 hover:border-gray-600")}
              >
                <span className="text-2xl block mb-2">{option.icon}</span>
                <span className="text-white font-medium block">{option.name}</span>
                <span className="text-gray-500 text-xs block mt-1">{option.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Notifications */}
        <div className="glass-card lg:col-span-2">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <Bell className="w-5 h-5 text-amber-400" />
            </div>
            <h2 className="text-lg font-semibold text-white">התראות</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(notifications).map(([key, value]) => {
              const labels: Record<string, { title: string; desc: string }> = {
                newReviews: { title: 'ביקורות חדשות', desc: 'קבל התראה כשמגיעה ביקורת חדשה' },
                competitorAlerts: { title: 'התראות מתחרים', desc: 'עדכונים על פעילות מתחרים' },
                trendUpdates: { title: 'עדכוני מגמות', desc: 'מגמות חדשות בתעשייה שלך' },
                weeklyReport: { title: 'דוח שבועי', desc: 'סיכום שבועי במייל' },
              };

              return (
                <div
                  key={key}
                  className="flex items-center justify-between p-4 rounded-xl bg-gray-800/50"
                >
                  <div>
                    <p className="text-white font-medium">{labels[key].title}</p>
                    <p className="text-gray-500 text-sm">{labels[key].desc}</p>
                  </div>
                  <button
                    onClick={() => setNotifications({ ...notifications, [key]: !value })}
                    className={"relative w-12 h-6 rounded-full transition-colors " + (value ? "bg-indigo-500" : "bg-gray-700")}
                  >
                    <span
                      className={"absolute top-1 w-4 h-4 rounded-full bg-white transition-transform " + (value ? "right-1" : "left-1")}
                    />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          SCHEDULED JOBS (Task 5)
          ═══════════════════════════════════════════════════════════════════════ */}
      <div className="glass-card">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
              <Clock className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">משימות מתוזמנות</h2>
              <p className="text-gray-500 text-sm">ניהול סריקות אוטומטיות</p>
            </div>
          </div>
          <button
            onClick={resetDefaults}
            disabled={resettingJobs}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400 hover:text-white bg-gray-800/50 hover:bg-gray-700/50 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${resettingJobs ? 'animate-spin' : ''}`} />
            איפוס ברירות מחדל
          </button>
        </div>

        {jobsLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
          </div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-8">
            <Clock className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">אין משימות מתוזמנות</p>
            <button
              onClick={resetDefaults}
              className="mt-3 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors text-sm"
            >
              צור משימות ברירת מחדל
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => {
              const label = JOB_LABELS[job.job_type] || { name: job.job_type, description: '' };
              const isActive = job.status === 'active';
              const isToggling = togglingJob === job.id;

              return (
                <div
                  key={job.id}
                  className={`flex items-center justify-between p-4 rounded-xl transition-all ${
                    isActive ? 'bg-gray-800/50 border border-gray-700/50' : 'bg-gray-800/30 border border-gray-700/30 opacity-60'
                  }`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-white font-medium">{label.name}</p>
                      <span className="px-2 py-0.5 rounded-full text-xs bg-gray-700/50 text-gray-400">
                        {cronToHebrew(job.cron_expression)}
                      </span>
                    </div>
                    <p className="text-gray-500 text-sm">{label.description}</p>
                    <div className="flex items-center gap-4 mt-1.5 text-xs text-gray-500">
                      <span>הרצה אחרונה: {formatDateTime(job.last_run_at)}</span>
                      <span>הרצה הבאה: {formatDateTime(job.next_run_at)}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleJob(job.id, !isActive)}
                    disabled={isToggling}
                    className={"relative w-12 h-6 rounded-full transition-colors flex-shrink-0 " + (isActive ? "bg-indigo-500" : "bg-gray-700") + (isToggling ? " opacity-50" : "")}
                  >
                    {isToggling ? (
                      <Loader2 className="w-4 h-4 animate-spin absolute top-1 left-1/2 -translate-x-1/2 text-white" />
                    ) : (
                      <span
                        className={"absolute top-1 w-4 h-4 rounded-full bg-white transition-transform " + (isActive ? "right-1" : "left-1")}
                      />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Plan & Billing */}
      <div className="glass-card p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-indigo-400" />
          תוכנית ותשלום
        </h2>
        <p className="text-gray-400 text-sm mb-4">נהלו את המנוי, שדרגו תוכנית וצפו בשימוש קרדיטים</p>
        <a
          href="/dashboard/billing"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-medium hover:from-blue-500 hover:to-cyan-500 transition-all"
        >
          <CreditCard className="w-4 h-4" />
          ניהול מנוי
        </a>
      </div>

      {/* Danger Zone */}
      <div className="glass-card border border-red-500/20">
        <h3 className="text-red-400 font-semibold mb-4">אזור מסוכן</h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white">מחק את החשבון</p>
            <p className="text-gray-500 text-sm">פעולה זו לא ניתנת לביטול</p>
          </div>
          <button
            onClick={async () => {
              if (!window.confirm('האם אתה בטוח שברצונך למחוק את החשבון? פעולה זו לא ניתנת לביטול.')) return;
              try {
                const res = await apiFetch(`/business/profile/${currentProfile?.id}`, { method: 'DELETE' });
                if (res.ok) {
                  toast.success('החשבון נמחק בהצלחה');
                  window.location.href = '/';
                } else {
                  toast.error('שגיאה במחיקת החשבון');
                }
              } catch {
                toast.error('שגיאה במחיקת החשבון');
              }
            }}
            className="px-4 py-2 rounded-xl bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 transition-colors"
          >
            מחק חשבון
          </button>
        </div>
      </div>
    </div>
  );
}
