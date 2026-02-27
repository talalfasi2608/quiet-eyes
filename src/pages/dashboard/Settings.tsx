import { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { useSimulation } from '../../context/SimulationContext';
import PageLoader from '../../components/ui/PageLoader';
import {
  User,
  Building,
  Bell,
  CreditCard,
  Clock,
  Save,
  Check,
  Loader2,
  RefreshCw,
  Mail,
  KeyRound,
  MapPin,
  Globe,
  Search,
  X,
  Plus,
  Trash2,
  AlertTriangle,
  Instagram,
  Facebook,
  ChevronDown,
  Smartphone,
} from 'lucide-react';
import { apiFetch } from '../../services/api';
import { supabase } from '../../lib/supabaseClient';
import { loadGoogleMaps } from '../../lib/googleMaps';

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const TABS = [
  { id: 'profile', label: 'פרופיל עסקי', icon: Building },
  { id: 'alerts', label: 'התראות', icon: Bell },
  { id: 'account', label: 'חשבון', icon: User },
  { id: 'subscription', label: 'מנוי', icon: CreditCard },
] as const;

const BUSINESS_TYPES = [
  { value: 'restaurant', label: '🍜 מסעדה / בית קפה' },
  { value: 'beauty', label: '💇 יופי / קוסמטיקה / שיער' },
  { value: 'fitness', label: '🏋️ כושר / בריאות / ספא' },
  { value: 'realestate', label: '🏠 נדל"ן / תיווך' },
  { value: 'ecommerce', label: '🛒 חנות / e-Commerce' },
  { value: 'agency', label: '📢 סוכנות שיווק / פרסום' },
  { value: 'health', label: '🏥 בריאות / רפואה / קליניקה' },
  { value: 'legal', label: '⚖️ משפטים / ייעוץ' },
  { value: 'delivery', label: '🍕 משלוחים / קייטרינג' },
  { value: 'services', label: '🔧 שירותים' },
  { value: 'education', label: '📚 חינוך / הדרכה' },
  { value: 'tourism', label: '🏨 תיירות / מלונאות' },
  { value: 'tech', label: '💻 טכנולוגיה / הייטק' },
  { value: 'other', label: '🔵 אחר' },
];

const RADIUS_OPTIONS = [
  { value: 0.5, label: '0.5 ק"מ' },
  { value: 1, label: '1 ק"מ' },
  { value: 2, label: '2 ק"מ' },
  { value: 5, label: '5 ק"מ' },
  { value: 10, label: '10 ק"מ' },
  { value: 999, label: 'ארצי' },
];

const MORNING_ALERT_OPTIONS = [
  { value: '07:00', label: '07:00' },
  { value: '08:00', label: '08:00' },
  { value: '09:00', label: '09:00' },
  { value: '10:00', label: '10:00' },
];

const ALERT_SENSITIVITY_OPTIONS = [
  { value: 'high', label: 'גבוהה', desc: 'כל שינוי' },
  { value: 'medium', label: 'בינונית', desc: 'שינויים חשובים' },
  { value: 'low', label: 'נמוכה', desc: 'רק קריטי' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// SCHEDULED JOBS TYPES & HELPERS
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
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// INLINE SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function SectionSaveButton({
  isSaving,
  saved,
  onClick,
}: {
  isSaving: boolean;
  saved: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={isSaving}
      className={`w-full md:w-auto flex items-center justify-center gap-2 px-6 py-3 md:py-2.5 rounded-xl font-medium transition-all min-h-[48px] ${
        saved
          ? 'bg-emerald-500 text-white'
          : 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white hover:from-blue-500 hover:to-cyan-400'
      } ${isSaving ? 'opacity-70 cursor-wait' : ''}`}
    >
      {isSaving ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>שומר...</span>
        </>
      ) : saved ? (
        <>
          <Check className="w-4 h-4" />
          <span>נשמר!</span>
        </>
      ) : (
        <>
          <Save className="w-4 h-4" />
          <span>שמור שינויים</span>
        </>
      )}
    </button>
  );
}

function ToggleSwitch({
  enabled,
  onChange,
  color = 'bg-indigo-500',
}: {
  enabled: boolean;
  onChange: (v: boolean) => void;
  color?: string;
}) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${
        enabled ? color : 'bg-gray-700'
      }`}
    >
      <span
        className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${
          enabled ? 'right-1' : 'left-1'
        }`}
      />
    </button>
  );
}

function TagsInput({
  tags,
  onTagsChange,
  placeholder,
  helperText,
}: {
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  placeholder: string;
  helperText?: string;
}) {
  const [input, setInput] = useState('');

  const addTag = () => {
    const trimmed = input.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onTagsChange([...tags, trimmed]);
      setInput('');
    }
  };

  const removeTag = (index: number) => {
    onTagsChange(tags.filter((_, i) => i !== index));
  };

  return (
    <div>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addTag();
            }
          }}
          placeholder={placeholder}
          className="input-glass flex-1"
          dir="rtl"
        />
        <button
          onClick={addTag}
          className="px-3 py-2 rounded-xl bg-gray-800/50 border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
      {helperText && <p className="text-gray-500 text-xs mt-1">{helperText}</p>}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {tags.map((tag, i) => (
            <span
              key={i}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-sm"
            >
              {tag}
              <button onClick={() => removeTag(i)} className="hover:text-white">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN SETTINGS COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function Settings() {
  const { user } = useAuth();
  const { currentProfile, refreshProfile } = useSimulation();

  // ─── General state ─────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('profile');
  const [businessId, setBusinessId] = useState<string | null>(null);

  // ─── Tab 1: Business Profile ───────────────────────────────────────────────
  const [profileData, setProfileData] = useState({
    business_name: '',
    business_type: '',
    business_description: '',
    address: '',
    latitude: null as number | null,
    longitude: null as number | null,
    activity_radius_km: 5 as number,
    website: '',
    facebook_page: '',
    instagram_page: '',
    ideal_customer: '',
  });
  const [searchKeywords, setSearchKeywords] = useState<string[]>([]);
  const [excludeKeywords, setExcludeKeywords] = useState<string[]>([]);
  const [manualCompetitors, setManualCompetitors] = useState<string[]>([]);
  const [competitorInput, setCompetitorInput] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const addressInputRef = useRef<HTMLInputElement>(null);

  // ─── Tab 2: Alerts ─────────────────────────────────────────────────────────
  const [notifData, setNotifData] = useState({
    notification_whatsapp: true,
    notification_email: true,
    notification_weekly_report: true,
    morning_alert_time: '08:00',
    alert_sensitivity: 'medium',
  });
  const [notifSaving, setNotifSaving] = useState(false);
  const [notifSaved, setNotifSaved] = useState(false);
  const [testWhatsappLoading, setTestWhatsappLoading] = useState(false);
  const [testWhatsappResult, setTestWhatsappResult] = useState<string | null>(null);

  // ─── Scheduled Jobs ────────────────────────────────────────────────────────
  const [jobs, setJobs] = useState<ScheduledJob[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [togglingJob, setTogglingJob] = useState<number | null>(null);
  const [resettingJobs, setResettingJobs] = useState(false);

  // ─── Tab 3: Account ────────────────────────────────────────────────────────
  const [personalData, setPersonalData] = useState({
    first_name: '',
    last_name: '',
    phone: '',
  });
  const [personalSaving, setPersonalSaving] = useState(false);
  const [personalSaved, setPersonalSaved] = useState(false);
  const [resetPasswordLoading, setResetPasswordLoading] = useState(false);

  // ═══════════════════════════════════════════════════════════════════════════
  // DATA LOADING — FETCH DIRECTLY FROM API
  // ═══════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    if (!user?.id) return;

    const loadSettings = async () => {
      setLoading(true);
      try {
        const res = await apiFetch(`/business/user/${user.id}`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        const biz = data.business;

        setBusinessId(biz.id);

        setProfileData({
          business_name: biz.business_name || biz.name_hebrew || '',
          business_type: biz.business_type || '',
          business_description: biz.business_description || '',
          address: biz.address || biz.location || '',
          latitude: biz.latitude ?? null,
          longitude: biz.longitude ?? null,
          activity_radius_km: biz.activity_radius_km ?? 5,
          website: biz.website || '',
          facebook_page: biz.facebook_page || '',
          instagram_page: biz.instagram_page || '',
          ideal_customer: biz.ideal_customer || '',
        });

        setSearchKeywords(
          (biz.search_keywords || '').split(',').filter(Boolean)
        );
        setExcludeKeywords(
          (biz.exclude_keywords || '').split(',').filter(Boolean)
        );
        setManualCompetitors(
          (biz.manual_competitors || '').split(',').filter(Boolean)
        );

        setNotifData({
          notification_whatsapp: biz.notification_whatsapp ?? true,
          notification_email: biz.notification_email ?? true,
          notification_weekly_report: biz.notification_weekly_report ?? true,
          morning_alert_time: biz.morning_alert_time || '08:00',
          alert_sensitivity: biz.alert_sensitivity || 'medium',
        });

        setPersonalData({
          first_name: biz.first_name || '',
          last_name: biz.last_name || '',
          phone: biz.phone || '',
        });
      } catch {
        toast.error('שגיאה בטעינת ההגדרות');
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [user?.id]);

  // ═══════════════════════════════════════════════════════════════════════════
  // GOOGLE PLACES AUTOCOMPLETE
  // ═══════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    if (!addressInputRef.current) return;

    let autocomplete: google.maps.places.Autocomplete | null = null;

    const initAutocomplete = () => {
      if (!window.google?.maps?.places || !addressInputRef.current) return;

      autocomplete = new window.google.maps.places.Autocomplete(
        addressInputRef.current,
        { componentRestrictions: { country: 'il' } }
      );

      autocomplete.addListener('place_changed', () => {
        const place = autocomplete!.getPlace();
        const addr = place.formatted_address || place.name || '';
        const lat = place.geometry?.location?.lat() ?? null;
        const lng = place.geometry?.location?.lng() ?? null;
        setProfileData((prev) => ({
          ...prev,
          address: addr,
          latitude: lat,
          longitude: lng,
        }));
      });
    };

    loadGoogleMaps().then(initAutocomplete).catch(() => {});
  }, [activeTab]);

  // ═══════════════════════════════════════════════════════════════════════════
  // SCHEDULED JOBS
  // ═══════════════════════════════════════════════════════════════════════════

  const resolvedBusinessId = businessId || currentProfile?.id;

  const fetchJobs = useCallback(async () => {
    if (!resolvedBusinessId) return;
    setJobsLoading(true);
    try {
      const res = await apiFetch(`/jobs/${resolvedBusinessId}`);
      if (res.ok) {
        const data = await res.json();
        setJobs(data.jobs || []);
      }
    } catch {
      toast.error('שגיאה בטעינת הגדרות');
    } finally {
      setJobsLoading(false);
    }
  }, [resolvedBusinessId]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const toggleJob = async (jobId: number, active: boolean) => {
    if (!resolvedBusinessId) return;
    setTogglingJob(jobId);
    try {
      await apiFetch(`/jobs/${resolvedBusinessId}/toggle/${jobId}`, {
        method: 'POST',
        body: JSON.stringify({ active }),
      });
      setJobs((prev) =>
        prev.map((j) =>
          j.id === jobId ? { ...j, status: active ? 'active' : 'paused' } : j
        )
      );
    } catch {
      // Revert on error
    } finally {
      setTogglingJob(null);
    }
  };

  const resetDefaults = async () => {
    if (!resolvedBusinessId) return;
    setResettingJobs(true);
    try {
      await apiFetch(`/jobs/${resolvedBusinessId}/ensure-defaults`, {
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
  // SAVE HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════

  const saveSection = async (
    fields: Record<string, any>,
    setSaving: (v: boolean) => void,
    setSaved: (v: boolean) => void
  ) => {
    const id = resolvedBusinessId;
    if (!id) return;
    setSaving(true);
    try {
      const res = await apiFetch(`/business/profile/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(fields),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to save');
      }
      setSaved(true);
      toast.success('הנתונים נשמרו בהצלחה');
      setTimeout(() => setSaved(false), 2000);
      await refreshProfile();
    } catch {
      toast.error('שגיאה בשמירה');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveProfile = () => {
    saveSection(
      {
        business_name: profileData.business_name || undefined,
        business_type: profileData.business_type || undefined,
        business_description: profileData.business_description || undefined,
        address: profileData.address || undefined,
        latitude: profileData.latitude,
        longitude: profileData.longitude,
        activity_radius_km: profileData.activity_radius_km,
        website: profileData.website || undefined,
        facebook_page: profileData.facebook_page || undefined,
        instagram_page: profileData.instagram_page || undefined,
        ideal_customer: profileData.ideal_customer || undefined,
        search_keywords: searchKeywords.join(','),
        exclude_keywords: excludeKeywords.join(','),
        manual_competitors: manualCompetitors.join(','),
      },
      setProfileSaving,
      setProfileSaved
    );
  };

  const handleSaveNotifications = () => {
    saveSection(
      {
        notification_whatsapp: notifData.notification_whatsapp,
        notification_email: notifData.notification_email,
        notification_weekly_report: notifData.notification_weekly_report,
        morning_alert_time: notifData.morning_alert_time,
        alert_sensitivity: notifData.alert_sensitivity,
      },
      setNotifSaving,
      setNotifSaved
    );
  };

  const handleTestWhatsapp = async () => {
    if (!resolvedBusinessId) return;
    setTestWhatsappLoading(true);
    setTestWhatsappResult(null);
    try {
      const res = await apiFetch('/notifications/test-whatsapp', {
        method: 'POST',
        body: JSON.stringify({ business_id: resolvedBusinessId, message_type: 'test' }),
      });
      const data = await res.json();
      if (data.success) {
        setTestWhatsappResult(`✓ הודעת בדיקה נשלחה ל-${data.phone || personalData.phone}`);
        toast.success('הודעת בדיקה נשלחה בהצלחה!');
      } else {
        setTestWhatsappResult(null);
        toast.error(data.error || data.detail || 'שגיאה בשליחת הודעת בדיקה');
      }
    } catch {
      setTestWhatsappResult(null);
      toast.error('שגיאה בשליחת הודעת בדיקה');
    } finally {
      setTestWhatsappLoading(false);
    }
  };

  const handleSavePersonal = () => {
    saveSection(
      {
        first_name: personalData.first_name || undefined,
        last_name: personalData.last_name || undefined,
        phone: personalData.phone || undefined,
      },
      setPersonalSaving,
      setPersonalSaved
    );
  };

  const handleResetPassword = async () => {
    if (!user?.email) return;
    setResetPasswordLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/auth`,
      });
      if (error) throw error;
      toast.success('מייל לאיפוס סיסמה נשלח בהצלחה');
    } catch {
      toast.error('שגיאה בשליחת המייל');
    } finally {
      setResetPasswordLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (
      !window.confirm(
        'האם אתה בטוח שברצונך למחוק את החשבון? פעולה זו לא ניתנת לביטול.'
      )
    )
      return;
    try {
      const res = await apiFetch(`/business/profile/${resolvedBusinessId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        toast.success('החשבון נמחק בהצלחה');
        window.location.href = '/';
      } else {
        toast.error('שגיאה במחיקת החשבון');
      }
    } catch {
      toast.error('שגיאה במחיקת החשבון');
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPETITOR HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  const addCompetitor = () => {
    const trimmed = competitorInput.trim();
    if (trimmed && !manualCompetitors.includes(trimmed)) {
      setManualCompetitors([...manualCompetitors, trimmed]);
      setCompetitorInput('');
    }
  };

  const removeCompetitor = (index: number) => {
    setManualCompetitors(manualCompetitors.filter((_, i) => i !== index));
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // TAB RENDERERS
  // ═══════════════════════════════════════════════════════════════════════════

  const renderProfileTab = () => (
    <div className="space-y-6">
      {/* Section A — פרטי העסק */}
      <div className="glass-card">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
            <Building className="w-5 h-5 text-indigo-400" />
          </div>
          <h2 className="text-lg font-semibold text-white">פרטי העסק</h2>
        </div>

        <div className="space-y-4">
          {/* שם העסק */}
          <div>
            <label className="block text-gray-400 text-sm mb-2">שם העסק</label>
            <input
              type="text"
              value={profileData.business_name}
              onChange={(e) =>
                setProfileData({ ...profileData, business_name: e.target.value })
              }
              className="input-glass"
              dir="rtl"
            />
          </div>

          {/* סוג עסק */}
          <div>
            <label className="block text-gray-400 text-sm mb-2">סוג עסק</label>
            <select
              value={profileData.business_type}
              onChange={(e) =>
                setProfileData({ ...profileData, business_type: e.target.value })
              }
              className="input-glass w-full appearance-none cursor-pointer"
              dir="rtl"
            >
              <option value="">בחר סוג עסק...</option>
              {BUSINESS_TYPES.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* תיאור קצר */}
          <div>
            <label className="block text-gray-400 text-sm mb-2">
              תיאור קצר של העסק
            </label>
            <textarea
              value={profileData.business_description}
              onChange={(e) => {
                if (e.target.value.length <= 200) {
                  setProfileData({
                    ...profileData,
                    business_description: e.target.value,
                  });
                }
              }}
              rows={3}
              maxLength={200}
              className="input-glass resize-none"
              dir="rtl"
            />
            <div className="flex justify-between mt-1">
              <p className="text-gray-500 text-xs">
                משמש ל-AI להבין את העסק שלך טוב יותר
              </p>
              <p className="text-gray-500 text-xs">
                {profileData.business_description.length}/200
              </p>
            </div>
          </div>

          {/* כתובת */}
          <div>
            <label className="block text-gray-400 text-sm mb-2">
              <MapPin className="w-4 h-4 inline ml-1" />
              כתובת
            </label>
            <input
              ref={addressInputRef}
              type="text"
              value={profileData.address}
              onChange={(e) =>
                setProfileData({ ...profileData, address: e.target.value })
              }
              placeholder="התחל להקליד כתובת..."
              className="input-glass"
              dir="rtl"
            />
          </div>

          {/* אזור פעילות */}
          <div>
            <label className="block text-gray-400 text-sm mb-2">
              אזור פעילות
            </label>
            <div className="flex flex-wrap gap-2">
              {RADIUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() =>
                    setProfileData({
                      ...profileData,
                      activity_radius_km: opt.value,
                    })
                  }
                  className={`px-4 py-2 rounded-xl border text-sm font-medium transition-all ${
                    profileData.activity_radius_km === opt.value
                      ? 'border-indigo-500 bg-indigo-500/20 text-indigo-300'
                      : 'border-gray-700 bg-gray-800/30 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* אתר אינטרנט */}
          <div>
            <label className="block text-gray-400 text-sm mb-2">
              <Globe className="w-4 h-4 inline ml-1" />
              אתר אינטרנט
            </label>
            <input
              type="url"
              value={profileData.website}
              onChange={(e) =>
                setProfileData({ ...profileData, website: e.target.value })
              }
              placeholder="https://www.example.com"
              className="input-glass"
              dir="ltr"
            />
          </div>

          {/* פייסבוק + אינסטגרם */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-400 text-sm mb-2">
                <Facebook className="w-4 h-4 inline ml-1" />
                עמוד פייסבוק
              </label>
              <input
                type="url"
                value={profileData.facebook_page}
                onChange={(e) =>
                  setProfileData({
                    ...profileData,
                    facebook_page: e.target.value,
                  })
                }
                placeholder="https://facebook.com/..."
                className="input-glass"
                dir="ltr"
              />
            </div>
            <div>
              <label className="block text-gray-400 text-sm mb-2">
                <Instagram className="w-4 h-4 inline ml-1" />
                עמוד אינסטגרם
              </label>
              <input
                type="url"
                value={profileData.instagram_page}
                onChange={(e) =>
                  setProfileData({
                    ...profileData,
                    instagram_page: e.target.value,
                  })
                }
                placeholder="https://instagram.com/..."
                className="input-glass"
                dir="ltr"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Section B — קהל יעד */}
      <div className="glass-card">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
            <Search className="w-5 h-5 text-cyan-400" />
          </div>
          <h2 className="text-lg font-semibold text-white">קהל יעד</h2>
        </div>

        <div className="space-y-5">
          {/* לקוח אידיאלי */}
          <div>
            <label className="block text-gray-400 text-sm mb-2">
              מי הלקוח האידיאלי שלך?
            </label>
            <textarea
              value={profileData.ideal_customer}
              onChange={(e) =>
                setProfileData({
                  ...profileData,
                  ideal_customer: e.target.value,
                })
              }
              rows={3}
              placeholder="לדוגמה: נשים 25-45, תושבי האזור, מחפשות טיפולי יופי במחיר סביר"
              className="input-glass resize-none"
              dir="rtl"
            />
          </div>

          {/* מילות מפתח לחיפוש */}
          <div>
            <label className="block text-gray-400 text-sm mb-2">
              מילות מפתח לחיפוש לידים
            </label>
            <TagsInput
              tags={searchKeywords}
              onTagsChange={setSearchKeywords}
              placeholder="הוסף מילת מפתח ולחץ Enter"
              helperText="Quieteyes יחפש פוסטים עם מילים אלה"
            />
          </div>

          {/* מילות מפתח לאי-כלול */}
          <div>
            <label className="block text-gray-400 text-sm mb-2">
              מילות מפתח לאי-כלול
            </label>
            <TagsInput
              tags={excludeKeywords}
              onTagsChange={setExcludeKeywords}
              placeholder="מילים שלא רלוונטיות לעסק שלך"
            />
          </div>
        </div>
      </div>

      {/* Section C — מתחרים ידניים */}
      <div className="glass-card">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
          </div>
          <h2 className="text-lg font-semibold text-white">מתחרים ידניים</h2>
        </div>

        <div className="space-y-4">
          <p className="text-gray-400 text-sm">
            מתחרים שברצונך לעקוב אחריהם
          </p>

          <div className="flex gap-2">
            <input
              value={competitorInput}
              onChange={(e) => setCompetitorInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addCompetitor();
                }
              }}
              placeholder="הוסף שם מתחרה..."
              className="input-glass flex-1"
              dir="rtl"
            />
            <button
              onClick={addCompetitor}
              className="px-3 py-2 rounded-xl bg-gray-800/50 border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {manualCompetitors.length === 0 ? (
            <p className="text-gray-600 text-sm py-3 text-center">
              טרם נוספו מתחרים
            </p>
          ) : (
            <div className="space-y-2">
              {manualCompetitors.map((name, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between px-4 py-3 rounded-xl bg-gray-800/50 border border-gray-700/50"
                >
                  <span className="text-white text-sm">{name}</span>
                  <button
                    onClick={() => removeCompetitor(i)}
                    className="text-gray-500 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Save button */}
      <div className="flex justify-end">
        <SectionSaveButton
          isSaving={profileSaving}
          saved={profileSaved}
          onClick={handleSaveProfile}
        />
      </div>
    </div>
  );

  const renderAlertsTab = () => (
    <div className="space-y-6">
      {/* Notification Preferences */}
      <div className="glass-card">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
            <Bell className="w-5 h-5 text-amber-400" />
          </div>
          <h2 className="text-lg font-semibold text-white">העדפות התראות</h2>
        </div>

        <div className="space-y-4">
          {/* Toggle Cards */}
          <div className="space-y-3">
            {/* WhatsApp Toggle */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-gray-800/50">
              <div>
                <p className="text-white font-medium">WhatsApp</p>
                <p className="text-gray-500 text-sm">
                  {personalData.phone
                    ? `נשלח ל-${personalData.phone}`
                    : 'הוסף מספר טלפון בפרטים אישיים'}
                </p>
              </div>
              <ToggleSwitch
                enabled={notifData.notification_whatsapp}
                onChange={(v) =>
                  setNotifData({ ...notifData, notification_whatsapp: v })
                }
              />
            </div>

            {/* Test WhatsApp Button */}
            {notifData.notification_whatsapp && personalData.phone && (
              <div className="flex items-center gap-3 px-4">
                <button
                  onClick={handleTestWhatsapp}
                  disabled={testWhatsappLoading}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl border border-green-600/40 bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-all text-sm font-medium disabled:opacity-50 disabled:cursor-wait"
                >
                  {testWhatsappLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Smartphone className="w-4 h-4" />
                  )}
                  שלח הודעת בדיקה לוואטסאפ
                </button>
                {testWhatsappResult && (
                  <span className="text-green-400 text-sm">{testWhatsappResult}</span>
                )}
              </div>
            )}

            {/* Email Toggle */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-gray-800/50">
              <div>
                <p className="text-white font-medium">אימייל</p>
                <p className="text-gray-500 text-sm">
                  קבל התראות באימייל
                </p>
              </div>
              <ToggleSwitch
                enabled={notifData.notification_email}
                onChange={(v) =>
                  setNotifData({ ...notifData, notification_email: v })
                }
              />
            </div>

            {/* Weekly Report Toggle */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-gray-800/50">
              <div>
                <p className="text-white font-medium">דוח שבועי PDF</p>
                <p className="text-gray-500 text-sm">
                  סיכום שבועי של המודיעין העסקי
                </p>
              </div>
              <ToggleSwitch
                enabled={notifData.notification_weekly_report}
                onChange={(v) =>
                  setNotifData({ ...notifData, notification_weekly_report: v })
                }
              />
            </div>
          </div>

          {/* Morning Alert Time */}
          <div>
            <label className="block text-gray-400 text-sm mb-2">
              <Clock className="w-4 h-4 inline ml-1" />
              שעת הודעת בוקר
            </label>
            <div className="flex flex-wrap gap-2">
              {MORNING_ALERT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() =>
                    setNotifData({ ...notifData, morning_alert_time: opt.value })
                  }
                  className={`px-4 py-2 rounded-xl border text-sm font-medium transition-all ${
                    notifData.morning_alert_time === opt.value
                      ? 'border-amber-500 bg-amber-500/20 text-amber-300'
                      : 'border-gray-700 bg-gray-800/30 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Alert Sensitivity */}
          <div>
            <label className="block text-gray-400 text-sm mb-2">
              רמת רגישות התראות
            </label>
            <div className="flex flex-wrap gap-2">
              {ALERT_SENSITIVITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() =>
                    setNotifData({ ...notifData, alert_sensitivity: opt.value })
                  }
                  className={`px-4 py-2.5 rounded-xl border text-sm transition-all ${
                    notifData.alert_sensitivity === opt.value
                      ? 'border-amber-500 bg-amber-500/20 text-amber-300'
                      : 'border-gray-700 bg-gray-800/30 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  <span className="font-medium">{opt.label}</span>
                  <span className="text-xs text-gray-500 mr-1">
                    ({opt.desc})
                  </span>
                </button>
              ))}
            </div>
          </div>

          <SectionSaveButton
            isSaving={notifSaving}
            saved={notifSaved}
            onClick={handleSaveNotifications}
          />
        </div>
      </div>

      {/* Scheduled Jobs */}
      <div className="glass-card">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
              <Clock className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">
                משימות מתוזמנות
              </h2>
              <p className="text-gray-500 text-sm">
                ניהול סריקות אוטומטיות
              </p>
            </div>
          </div>
          <button
            onClick={resetDefaults}
            disabled={resettingJobs}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400 hover:text-white bg-gray-800/50 hover:bg-gray-700/50 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw
              className={`w-4 h-4 ${resettingJobs ? 'animate-spin' : ''}`}
            />
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
              const label = JOB_LABELS[job.job_type] || {
                name: job.job_type,
                description: '',
              };
              const isActive = job.status === 'active';
              const isToggling = togglingJob === job.id;

              return (
                <div
                  key={job.id}
                  className={`flex items-center justify-between p-4 rounded-xl transition-all ${
                    isActive
                      ? 'bg-gray-800/50 border border-gray-700/50'
                      : 'bg-gray-800/30 border border-gray-700/30 opacity-60'
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
                      <span>
                        הרצה אחרונה: {formatDateTime(job.last_run_at)}
                      </span>
                      <span>
                        הרצה הבאה: {formatDateTime(job.next_run_at)}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleJob(job.id, !isActive)}
                    disabled={isToggling}
                    className={
                      'relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ' +
                      (isActive ? 'bg-indigo-500' : 'bg-gray-700') +
                      (isToggling ? ' opacity-50' : '')
                    }
                  >
                    {isToggling ? (
                      <Loader2 className="w-4 h-4 animate-spin absolute top-1 left-1/2 -translate-x-1/2 text-white" />
                    ) : (
                      <span
                        className={
                          'absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ' +
                          (isActive ? 'right-1' : 'left-1')
                        }
                      />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  const renderAccountTab = () => (
    <div className="space-y-6">
      {/* Personal Details */}
      <div className="glass-card">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
            <User className="w-5 h-5 text-cyan-400" />
          </div>
          <h2 className="text-lg font-semibold text-white">פרטים אישיים</h2>
        </div>

        <div className="space-y-4">
          {/* First Name + Last Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-400 text-sm mb-2">
                שם פרטי
              </label>
              <input
                type="text"
                value={personalData.first_name}
                onChange={(e) =>
                  setPersonalData({
                    ...personalData,
                    first_name: e.target.value,
                  })
                }
                className="input-glass"
                dir="rtl"
              />
            </div>
            <div>
              <label className="block text-gray-400 text-sm mb-2">
                שם משפחה
              </label>
              <input
                type="text"
                value={personalData.last_name}
                onChange={(e) =>
                  setPersonalData({
                    ...personalData,
                    last_name: e.target.value,
                  })
                }
                className="input-glass"
                dir="rtl"
              />
            </div>
          </div>

          {/* Email (read-only) */}
          <div>
            <label className="block text-gray-400 text-sm mb-2">אימייל</label>
            <div className="relative">
              <Mail className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
              <input
                type="email"
                value={user?.email || ''}
                disabled
                className="input-glass pr-12 opacity-60 cursor-not-allowed"
                dir="ltr"
              />
            </div>
          </div>

          {/* Phone */}
          <div>
            <label className="block text-gray-400 text-sm mb-2">
              טלפון נייד
            </label>
            <input
              type="tel"
              value={personalData.phone}
              onChange={(e) =>
                setPersonalData({ ...personalData, phone: e.target.value })
              }
              placeholder="050-1234567"
              className="input-glass"
              dir="ltr"
            />
            <p className="text-gray-500 text-xs mt-1">
              משמש להתראות וואטסאפ
            </p>
          </div>

          {/* Change Password */}
          <div className="pt-2 border-t border-gray-700/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-gray-400" />
                <span className="text-gray-400 text-sm">שינוי סיסמה</span>
              </div>
              <button
                onClick={handleResetPassword}
                disabled={resetPasswordLoading}
                className="flex items-center gap-2 px-4 py-2 text-sm text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 rounded-xl transition-colors disabled:opacity-50"
              >
                {resetPasswordLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Mail className="w-4 h-4" />
                )}
                שלח מייל לאיפוס סיסמה
              </button>
            </div>
          </div>

          <SectionSaveButton
            isSaving={personalSaving}
            saved={personalSaved}
            onClick={handleSavePersonal}
          />
        </div>
      </div>

      {/* Danger Zone */}
      <div className="glass-card border border-red-500/20">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-red-400" />
          </div>
          <h2 className="text-lg font-semibold text-red-400">אזור מסוכן</h2>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white">מחק את החשבון</p>
            <p className="text-gray-500 text-sm">
              פעולה זו לא ניתנת לביטול
            </p>
          </div>
          <button
            onClick={handleDeleteAccount}
            className="px-4 py-2 rounded-xl bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 transition-colors"
          >
            מחק חשבון
          </button>
        </div>
      </div>
    </div>
  );

  const renderSubscriptionTab = () => (
    <div className="space-y-6">
      <div className="glass-card">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
            <CreditCard className="w-5 h-5 text-indigo-400" />
          </div>
          <h2 className="text-lg font-semibold text-white">מנוי</h2>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-sm">תוכנית נוכחית:</span>
            <span className="text-white font-medium">
              {(currentProfile as any)?.plan_name || 'חינמי'}
            </span>
          </div>

          <p className="text-gray-400 text-sm">
            נהלו את המנוי, שדרגו תוכנית וצפו בשימוש קרדיטים
          </p>

          <a
            href="/dashboard/billing"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-medium hover:from-blue-500 hover:to-cyan-400 transition-all"
          >
            <CreditCard className="w-4 h-4" />
            ניהול מנוי
          </a>
        </div>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // LOADING STATE
  // ═══════════════════════════════════════════════════════════════════════════

  if (loading) return <PageLoader message="טוען הגדרות..." />;

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="space-y-4 md:space-y-6 fade-in" dir="rtl">
      <header>
        <h1
          className="text-2xl md:text-3xl font-bold text-white mb-1 md:mb-2"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          הגדרות
        </h1>
        <p className="text-sm md:text-base text-[var(--text-secondary)]">
          נהל את פרופיל העסק, פרטים אישיים והעדפות
        </p>
      </header>

      {/* Tab bar - scrollable on mobile */}
      <div className="flex gap-1 border-b border-gray-700/50 overflow-x-auto pb-px" style={{ WebkitOverflowScrolling: 'touch' }}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-3 md:px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 min-h-[44px] flex-shrink-0 ${
              activeTab === tab.id
                ? 'text-[#00d4ff] border-[#00d4ff]'
                : 'text-gray-400 hover:text-gray-200 border-transparent'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            <span className="hidden sm:inline">{tab.label}</span>
            <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'profile' && renderProfileTab()}
      {activeTab === 'alerts' && renderAlertsTab()}
      {activeTab === 'account' && renderAccountTab()}
      {activeTab === 'subscription' && renderSubscriptionTab()}
    </div>
  );
}
