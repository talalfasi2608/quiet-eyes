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
} from 'lucide-react';
import { apiFetch } from '../../services/api';
import { supabase } from '../../lib/supabaseClient';
import { loadGoogleMaps } from '../../lib/googleMaps';

// ═══════════════════════════════════════════════════════════════════════════════
// BUSINESS TYPE OPTIONS
// ═══════════════════════════════════════════════════════════════════════════════

const businessTypeOptions = [
  { value: 'restaurant', label: '\uD83C\uDF5C \u05DE\u05E1\u05E2\u05D3\u05D4 / \u05D1\u05D9\u05EA \u05E7\u05E4\u05D4' },
  { value: 'beauty', label: '\uD83D\uDC87 \u05D9\u05D5\u05E4\u05D9 / \u05E7\u05D5\u05E1\u05DE\u05D8\u05D9\u05E7\u05D4 / \u05E9\u05D9\u05E2\u05E8' },
  { value: 'fitness', label: '\uD83C\uDFCB\uFE0F \u05DB\u05D5\u05E9\u05E8 / \u05D1\u05E8\u05D9\u05D0\u05D5\u05EA / \u05E1\u05E4\u05D0' },
  { value: 'realestate', label: '\uD83C\uDFE0 \u05E0\u05D3\u05DC"\u05DF / \u05EA\u05D9\u05D5\u05D5\u05DA' },
  { value: 'ecommerce', label: '\uD83D\uDED2 \u05D7\u05E0\u05D5\u05EA / e-Commerce' },
  { value: 'agency', label: '\uD83D\uDCE2 \u05E1\u05D5\u05DB\u05E0\u05D5\u05EA \u05E9\u05D9\u05D5\u05D5\u05E7 / \u05E4\u05E8\u05E1\u05D5\u05DD' },
  { value: 'health', label: '\uD83C\uDFE5 \u05D1\u05E8\u05D9\u05D0\u05D5\u05EA / \u05E8\u05E4\u05D5\u05D0\u05D4 / \u05E7\u05DC\u05D9\u05E0\u05D9\u05E7\u05D4' },
  { value: 'legal', label: '\u2696\uFE0F \u05DE\u05E9\u05E4\u05D8\u05D9\u05DD / \u05D9\u05D9\u05E2\u05D5\u05E5' },
  { value: 'delivery', label: '\uD83C\uDF55 \u05DE\u05E9\u05DC\u05D5\u05D7\u05D9\u05DD / \u05E7\u05D9\u05D9\u05D8\u05E8\u05D9\u05E0\u05D2' },
  { value: 'services', label: '\uD83D\uDD27 \u05E9\u05D9\u05E8\u05D5\u05EA\u05D9\u05DD' },
  { value: 'education', label: '\uD83D\uDCDA \u05D7\u05D9\u05E0\u05D5\u05DA / \u05D4\u05D3\u05E8\u05DB\u05D4' },
  { value: 'tourism', label: '\uD83C\uDFE8 \u05EA\u05D9\u05D9\u05E8\u05D5\u05EA / \u05DE\u05DC\u05D5\u05E0\u05D0\u05D5\u05EA' },
  { value: 'tech', label: '\uD83D\uDCBB \u05D8\u05DB\u05E0\u05D5\u05DC\u05D5\u05D2\u05D9\u05D4 / \u05D4\u05D9\u05D9\u05D8\u05E7' },
  { value: 'other', label: '\uD83D\uDD35 \u05D0\u05D7\u05E8' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// ACTIVITY RADIUS OPTIONS
// ═══════════════════════════════════════════════════════════════════════════════

const radiusOptions = [
  { value: 1, label: '1 \u05E7"\u05DE' },
  { value: 3, label: '3 \u05E7"\u05DE' },
  { value: 5, label: '5 \u05E7"\u05DE' },
  { value: 10, label: '10 \u05E7"\u05DE' },
  { value: 0, label: '\u05D0\u05E8\u05E6\u05D9' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// MORNING ALERT TIME OPTIONS
// ═══════════════════════════════════════════════════════════════════════════════

const morningAlertTimeOptions = [
  { value: '07:00', label: '07:00' },
  { value: '08:00', label: '08:00' },
  { value: '09:00', label: '09:00' },
  { value: '10:00', label: '10:00' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// ALERT SENSITIVITY OPTIONS
// ═══════════════════════════════════════════════════════════════════════════════

const alertSensitivityOptions = [
  { value: 'high', label: '\u05D2\u05D1\u05D5\u05D4\u05D4', desc: '\u05DB\u05DC \u05E9\u05D9\u05E0\u05D5\u05D9' },
  { value: 'medium', label: '\u05D1\u05D9\u05E0\u05D5\u05E0\u05D9\u05EA', desc: '\u05E9\u05D9\u05E0\u05D5\u05D9\u05D9\u05DD \u05D7\u05E9\u05D5\u05D1\u05D9\u05DD' },
  { value: 'low', label: '\u05E0\u05DE\u05D5\u05DB\u05D4', desc: '\u05E8\u05E7 \u05E7\u05E8\u05D9\u05D8\u05D9' },
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
  competitor_scan: { name: '\u05E1\u05E8\u05D9\u05E7\u05EA \u05DE\u05EA\u05D7\u05E8\u05D9\u05DD', description: '\u05E1\u05E8\u05D9\u05E7\u05D4 \u05D0\u05D5\u05D8\u05D5\u05DE\u05D8\u05D9\u05EA \u05E9\u05DC \u05DE\u05EA\u05D7\u05E8\u05D9\u05DD \u05D7\u05D3\u05E9\u05D9\u05DD \u05D1\u05D0\u05D6\u05D5\u05E8' },
  lead_snipe: { name: '\u05E6\u05D9\u05D3 \u05DC\u05D9\u05D3\u05D9\u05DD', description: '\u05D7\u05D9\u05E4\u05D5\u05E9 \u05D0\u05D5\u05D8\u05D5\u05DE\u05D8\u05D9 \u05E9\u05DC \u05DC\u05D9\u05D3\u05D9\u05DD \u05D7\u05D3\u05E9\u05D9\u05DD' },
  market_discovery: { name: '\u05D2\u05D9\u05DC\u05D5\u05D9 \u05E9\u05D5\u05E7', description: '\u05E1\u05E8\u05D9\u05E7\u05EA \u05E9\u05D5\u05E7 \u05DB\u05DC\u05DC\u05D9\u05EA \u05D5\u05DE\u05E6\u05D9\u05D0\u05EA \u05DE\u05EA\u05D7\u05E8\u05D9\u05DD' },
  price_check: { name: '\u05D1\u05D3\u05D9\u05E7\u05EA \u05DE\u05D7\u05D9\u05E8\u05D9\u05DD', description: '\u05DE\u05E2\u05E7\u05D1 \u05D0\u05D7\u05E8 \u05E9\u05D9\u05E0\u05D5\u05D9\u05D9 \u05DE\u05D7\u05D9\u05E8\u05D9\u05DD \u05E9\u05DC \u05DE\u05EA\u05D7\u05E8\u05D9\u05DD' },
};

function cronToHebrew(cron: string): string {
  const match4h = cron.match(/^0\s+\*\/(\d+)\s+\*\s+\*\s+\*$/);
  if (match4h) return `\u05DB\u05DC ${match4h[1]} \u05E9\u05E2\u05D5\u05EA`;
  if (cron === '0 0 * * *') return '\u05E4\u05E2\u05DD \u05D1\u05D9\u05D5\u05DD (\u05D7\u05E6\u05D5\u05EA)';
  const matchTime = cron.match(/^(\d+)\s+(\d+)\s+\*\s+\*\s+\*$/);
  if (matchTime) return `\u05DB\u05DC \u05D9\u05D5\u05DD \u05D1-${matchTime[2]}:${matchTime[1].padStart(2, '0')}`;
  return cron;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '\u05D8\u05E8\u05DD \u05D4\u05D5\u05E8\u05E5';
  return new Date(iso).toLocaleString('he-IL', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION SAVE BUTTON COMPONENT
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
      className={
        'btn-primary flex items-center gap-2 mt-6 ' +
        (saved ? 'bg-emerald-500 ' : '') +
        (isSaving ? 'opacity-70 cursor-wait' : '')
      }
    >
      {isSaving ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>\u05E9\u05D5\u05DE\u05E8...</span>
        </>
      ) : saved ? (
        <>
          <Check className="w-4 h-4" />
          <span>\u05E0\u05E9\u05DE\u05E8!</span>
        </>
      ) : (
        <>
          <Save className="w-4 h-4" />
          <span>\u05E9\u05DE\u05D5\u05E8 \u05E9\u05D9\u05E0\u05D5\u05D9\u05D9\u05DD</span>
        </>
      )}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN SETTINGS COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function Settings() {
  const { user } = useAuth();
  const { currentProfile, refreshProfile } = useSimulation();

  // ─── Section 1: Personal Details ─────────────────────────────────────────
  const [personalData, setPersonalData] = useState({
    first_name: '',
    last_name: '',
    phone: '',
  });
  const [personalSaving, setPersonalSaving] = useState(false);
  const [personalSaved, setPersonalSaved] = useState(false);
  const [resetPasswordLoading, setResetPasswordLoading] = useState(false);

  // ─── Section 2: Business Details ─────────────────────────────────────────
  const [businessData, setBusinessData] = useState({
    business_name: '',
    business_type: '',
    address: '',
    latitude: null as number | null,
    longitude: null as number | null,
    activity_radius_km: 5,
    business_description: '',
    website: '',
    facebook_page: '',
  });
  const [businessSaving, setBusinessSaving] = useState(false);
  const [businessSaved, setBusinessSaved] = useState(false);
  const addressInputRef = useRef<HTMLInputElement>(null);

  // ─── Section 3: Notification Preferences ─────────────────────────────────
  const [notifData, setNotifData] = useState({
    notification_whatsapp: true,
    notification_email: true,
    notification_weekly_report: true,
    morning_alert_time: '08:00',
    alert_sensitivity: 'medium',
  });
  const [notifSaving, setNotifSaving] = useState(false);
  const [notifSaved, setNotifSaved] = useState(false);

  // ─── Scheduled Jobs ──────────────────────────────────────────────────────
  const [jobs, setJobs] = useState<ScheduledJob[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [togglingJob, setTogglingJob] = useState<number | null>(null);
  const [resettingJobs, setResettingJobs] = useState(false);

  // ═══════════════════════════════════════════════════════════════════════════
  // SYNC FORM STATE FROM PROFILE
  // ═══════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    if (!currentProfile) return;
    const p = currentProfile as any;

    setPersonalData((prev) => ({
      first_name: p.first_name || prev.first_name,
      last_name: p.last_name || prev.last_name,
      phone: p.phone || prev.phone,
    }));

    setBusinessData((prev) => ({
      business_name: p.nameHebrew || p.business_name || p.name_hebrew || prev.business_name,
      business_type: p.business_type || prev.business_type,
      address: p.address || prev.address,
      latitude: p.latitude ?? prev.latitude,
      longitude: p.longitude ?? prev.longitude,
      activity_radius_km: p.activity_radius_km ?? prev.activity_radius_km,
      business_description: p.business_description || prev.business_description,
      website: p.website || prev.website,
      facebook_page: p.facebook_page || prev.facebook_page,
    }));

    setNotifData((prev) => ({
      notification_whatsapp: p.notification_whatsapp ?? prev.notification_whatsapp,
      notification_email: p.notification_email ?? prev.notification_email,
      notification_weekly_report: p.notification_weekly_report ?? prev.notification_weekly_report,
      morning_alert_time: p.morning_alert_time || prev.morning_alert_time,
      alert_sensitivity: p.alert_sensitivity || prev.alert_sensitivity,
    }));
  }, [currentProfile]);

  // ═══════════════════════════════════════════════════════════════════════════
  // GOOGLE PLACES AUTOCOMPLETE FOR ADDRESS
  // ═══════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    if (!addressInputRef.current) return;

    let autocomplete: google.maps.places.Autocomplete | null = null;

    const initAutocomplete = () => {
      if (!window.google?.maps?.places || !addressInputRef.current) return;

      autocomplete = new window.google.maps.places.Autocomplete(
        addressInputRef.current,
        {
          componentRestrictions: { country: 'il' },
        }
      );

      autocomplete.addListener('place_changed', () => {
        const place = autocomplete!.getPlace();
        const addr = place.formatted_address || place.name || '';
        const lat = place.geometry?.location?.lat() ?? null;
        const lng = place.geometry?.location?.lng() ?? null;
        setBusinessData((prev) => ({
          ...prev,
          address: addr,
          latitude: lat,
          longitude: lng,
        }));
      });
    };

    loadGoogleMaps().then(initAutocomplete).catch(() => {});
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // SCHEDULED JOBS
  // ═══════════════════════════════════════════════════════════════════════════

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
      toast.error('\u05E9\u05D2\u05D9\u05D0\u05D4 \u05D1\u05D8\u05E2\u05D9\u05E0\u05EA \u05D4\u05D2\u05D3\u05E8\u05D5\u05EA');
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
  // SECTION SAVE HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════

  const saveSection = async (
    fields: Record<string, any>,
    setSaving: (v: boolean) => void,
    setSaved: (v: boolean) => void
  ) => {
    if (!currentProfile?.id) return;
    setSaving(true);
    try {
      const res = await apiFetch(`/business/profile/${currentProfile.id}`, {
        method: 'PATCH',
        body: JSON.stringify(fields),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to save');
      }
      setSaved(true);
      toast.success('\u05D4\u05E0\u05EA\u05D5\u05E0\u05D9\u05DD \u05E0\u05E9\u05DE\u05E8\u05D5 \u05D1\u05D4\u05E6\u05DC\u05D7\u05D4');
      setTimeout(() => setSaved(false), 2000);
      await refreshProfile();
    } catch (err: unknown) {
      toast.error('\u05E9\u05D2\u05D9\u05D0\u05D4 \u05D1\u05E9\u05DE\u05D9\u05E8\u05D4');
    } finally {
      setSaving(false);
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

  const handleSaveBusiness = () => {
    saveSection(
      {
        business_name: businessData.business_name || undefined,
        business_type: businessData.business_type || undefined,
        address: businessData.address || undefined,
        latitude: businessData.latitude,
        longitude: businessData.longitude,
        activity_radius_km: businessData.activity_radius_km,
        business_description: businessData.business_description || undefined,
        website: businessData.website || undefined,
        facebook_page: businessData.facebook_page || undefined,
      },
      setBusinessSaving,
      setBusinessSaved
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

  const handleResetPassword = async () => {
    if (!user?.email) return;
    setResetPasswordLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/auth`,
      });
      if (error) throw error;
      toast.success('\u05DE\u05D9\u05D9\u05DC \u05DC\u05D0\u05D9\u05E4\u05D5\u05E1 \u05E1\u05D9\u05E1\u05DE\u05D4 \u05E0\u05E9\u05DC\u05D7 \u05D1\u05D4\u05E6\u05DC\u05D7\u05D4');
    } catch {
      toast.error('\u05E9\u05D2\u05D9\u05D0\u05D4 \u05D1\u05E9\u05DC\u05D9\u05D7\u05EA \u05D4\u05DE\u05D9\u05D9\u05DC');
    } finally {
      setResetPasswordLoading(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // LOADING STATE
  // ═══════════════════════════════════════════════════════════════════════════

  if (!currentProfile) return <PageLoader message="\u05D8\u05D5\u05E2\u05DF \u05D4\u05D2\u05D3\u05E8\u05D5\u05EA..." />;

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="space-y-6 fade-in">
      {/* Page Header */}
      <header>
        <h1
          className="text-3xl font-bold text-white mb-2"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          \u05D4\u05D2\u05D3\u05E8\u05D5\u05EA
        </h1>
        <p className="text-[var(--text-secondary)]">
          \u05E0\u05D4\u05DC \u05D0\u05EA \u05E4\u05E8\u05D5\u05E4\u05D9\u05DC \u05D4\u05E2\u05E1\u05E7, \u05E4\u05E8\u05D8\u05D9\u05DD \u05D0\u05D9\u05E9\u05D9\u05D9\u05DD \u05D5\u05D4\u05E2\u05D3\u05E4\u05D5\u05EA
        </p>
      </header>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 1: PERSONAL DETAILS
          ═══════════════════════════════════════════════════════════════════════ */}
      <div className="glass-card">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
            <User className="w-5 h-5 text-cyan-400" />
          </div>
          <h2 className="text-lg font-semibold text-white">
            \u05E4\u05E8\u05D8\u05D9\u05DD \u05D0\u05D9\u05E9\u05D9\u05D9\u05DD
          </h2>
        </div>

        <div className="space-y-4">
          {/* First Name + Last Name side by side */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-400 text-sm mb-2">
                \u05E9\u05DD \u05E4\u05E8\u05D8\u05D9
              </label>
              <input
                type="text"
                value={personalData.first_name}
                onChange={(e) =>
                  setPersonalData({ ...personalData, first_name: e.target.value })
                }
                className="input-glass"
                dir="rtl"
              />
            </div>
            <div>
              <label className="block text-gray-400 text-sm mb-2">
                \u05E9\u05DD \u05DE\u05E9\u05E4\u05D7\u05D4
              </label>
              <input
                type="text"
                value={personalData.last_name}
                onChange={(e) =>
                  setPersonalData({ ...personalData, last_name: e.target.value })
                }
                className="input-glass"
                dir="rtl"
              />
            </div>
          </div>

          {/* Email (read-only) */}
          <div>
            <label className="block text-gray-400 text-sm mb-2">
              \u05D0\u05D9\u05DE\u05D9\u05D9\u05DC
            </label>
            <div className="relative">
              <Mail className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
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
              \u05D8\u05DC\u05E4\u05D5\u05DF \u05E0\u05D9\u05D9\u05D3
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
              \u05DE\u05E9\u05DE\u05E9 \u05DC\u05D4\u05EA\u05E8\u05D0\u05D5\u05EA \u05D5\u05D5\u05D0\u05D8\u05E1\u05D0\u05E4
            </p>
          </div>

          {/* Change Password */}
          <div className="pt-2 border-t border-gray-700/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-gray-400" />
                <span className="text-gray-400 text-sm">
                  \u05E9\u05D9\u05E0\u05D5\u05D9 \u05E1\u05D9\u05E1\u05DE\u05D4
                </span>
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
                \u05E9\u05DC\u05D7 \u05DE\u05D9\u05D9\u05DC \u05DC\u05D0\u05D9\u05E4\u05D5\u05E1 \u05E1\u05D9\u05E1\u05DE\u05D4
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

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 2: BUSINESS DETAILS
          ═══════════════════════════════════════════════════════════════════════ */}
      <div className="glass-card">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
            <Building className="w-5 h-5 text-indigo-400" />
          </div>
          <h2 className="text-lg font-semibold text-white">
            \u05E4\u05E8\u05D8\u05D9 \u05D4\u05E2\u05E1\u05E7
          </h2>
        </div>

        <div className="space-y-4">
          {/* Business Name */}
          <div>
            <label className="block text-gray-400 text-sm mb-2">
              \u05E9\u05DD \u05D4\u05E2\u05E1\u05E7
            </label>
            <input
              type="text"
              value={businessData.business_name}
              onChange={(e) =>
                setBusinessData({ ...businessData, business_name: e.target.value })
              }
              className="input-glass"
              dir="rtl"
            />
          </div>

          {/* Business Type */}
          <div>
            <label className="block text-gray-400 text-sm mb-2">
              \u05E1\u05D5\u05D2 \u05D4\u05E2\u05E1\u05E7
            </label>
            <select
              value={businessData.business_type}
              onChange={(e) =>
                setBusinessData({ ...businessData, business_type: e.target.value })
              }
              className="input-glass w-full appearance-none cursor-pointer"
              dir="rtl"
            >
              <option value="">\u05D1\u05D7\u05E8 \u05E1\u05D5\u05D2 \u05E2\u05E1\u05E7...</option>
              {businessTypeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Address with Google Places */}
          <div>
            <label className="block text-gray-400 text-sm mb-2">
              \u05DB\u05EA\u05D5\u05D1\u05EA
            </label>
            <input
              ref={addressInputRef}
              type="text"
              value={businessData.address}
              onChange={(e) =>
                setBusinessData({ ...businessData, address: e.target.value })
              }
              placeholder="\u05D4\u05EA\u05D7\u05DC \u05DC\u05D4\u05E7\u05DC\u05D9\u05D3 \u05DB\u05EA\u05D5\u05D1\u05EA..."
              className="input-glass"
              dir="rtl"
            />
          </div>

          {/* Activity Radius */}
          <div>
            <label className="block text-gray-400 text-sm mb-2">
              \u05E8\u05D3\u05D9\u05D5\u05E1 \u05E4\u05E2\u05D9\u05DC\u05D5\u05EA
            </label>
            <div className="flex flex-wrap gap-2">
              {radiusOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() =>
                    setBusinessData({
                      ...businessData,
                      activity_radius_km: opt.value,
                    })
                  }
                  className={`px-4 py-2 rounded-xl border text-sm font-medium transition-all ${
                    businessData.activity_radius_km === opt.value
                      ? 'border-indigo-500 bg-indigo-500/20 text-indigo-300'
                      : 'border-gray-700 bg-gray-800/30 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Business Description */}
          <div>
            <label className="block text-gray-400 text-sm mb-2">
              \u05EA\u05D9\u05D0\u05D5\u05E8 \u05D4\u05E2\u05E1\u05E7
            </label>
            <textarea
              value={businessData.business_description}
              onChange={(e) =>
                setBusinessData({
                  ...businessData,
                  business_description: e.target.value,
                })
              }
              rows={3}
              className="input-glass resize-none"
              dir="rtl"
            />
            <p className="text-gray-500 text-xs mt-1">
              \u05DE\u05E9\u05DE\u05E9 \u05D0\u05EA \u05D4-AI \u05DC\u05D9\u05E6\u05D9\u05E8\u05EA \u05EA\u05D5\u05D1\u05E0\u05D5\u05EA \u05DE\u05D5\u05EA\u05D0\u05DE\u05D5\u05EA
            </p>
          </div>

          {/* Website + Facebook side by side */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-400 text-sm mb-2">
                \u05D0\u05EA\u05E8 \u05D0\u05D9\u05E0\u05D8\u05E8\u05E0\u05D8
              </label>
              <input
                type="url"
                value={businessData.website}
                onChange={(e) =>
                  setBusinessData({ ...businessData, website: e.target.value })
                }
                placeholder="https://www.example.com"
                className="input-glass"
                dir="ltr"
              />
            </div>
            <div>
              <label className="block text-gray-400 text-sm mb-2">
                \u05E2\u05DE\u05D5\u05D3 \u05E4\u05D9\u05D9\u05E1\u05D1\u05D5\u05E7
              </label>
              <input
                type="url"
                value={businessData.facebook_page}
                onChange={(e) =>
                  setBusinessData({ ...businessData, facebook_page: e.target.value })
                }
                placeholder="https://facebook.com/..."
                className="input-glass"
                dir="ltr"
              />
            </div>
          </div>

          <SectionSaveButton
            isSaving={businessSaving}
            saved={businessSaved}
            onClick={handleSaveBusiness}
          />
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 3: NOTIFICATION PREFERENCES
          ═══════════════════════════════════════════════════════════════════════ */}
      <div className="glass-card">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
            <Bell className="w-5 h-5 text-amber-400" />
          </div>
          <h2 className="text-lg font-semibold text-white">
            \u05D4\u05E2\u05D3\u05E4\u05D5\u05EA \u05D4\u05EA\u05E8\u05D0\u05D5\u05EA
          </h2>
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
                    ? `\u05E0\u05E9\u05DC\u05D7 \u05DC-${personalData.phone}`
                    : '\u05D4\u05D5\u05E1\u05E3 \u05DE\u05E1\u05E4\u05E8 \u05D8\u05DC\u05E4\u05D5\u05DF \u05D1\u05E4\u05E8\u05D8\u05D9\u05DD \u05D0\u05D9\u05E9\u05D9\u05D9\u05DD'}
                </p>
              </div>
              <button
                onClick={() =>
                  setNotifData({
                    ...notifData,
                    notification_whatsapp: !notifData.notification_whatsapp,
                  })
                }
                className={
                  'relative w-12 h-6 rounded-full transition-colors ' +
                  (notifData.notification_whatsapp ? 'bg-indigo-500' : 'bg-gray-700')
                }
              >
                <span
                  className={
                    'absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ' +
                    (notifData.notification_whatsapp ? 'right-1' : 'left-1')
                  }
                />
              </button>
            </div>

            {/* Email Toggle */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-gray-800/50">
              <div>
                <p className="text-white font-medium">\u05D0\u05D9\u05DE\u05D9\u05D9\u05DC</p>
                <p className="text-gray-500 text-sm">
                  \u05E7\u05D1\u05DC \u05D4\u05EA\u05E8\u05D0\u05D5\u05EA \u05D1\u05D0\u05D9\u05DE\u05D9\u05D9\u05DC
                </p>
              </div>
              <button
                onClick={() =>
                  setNotifData({
                    ...notifData,
                    notification_email: !notifData.notification_email,
                  })
                }
                className={
                  'relative w-12 h-6 rounded-full transition-colors ' +
                  (notifData.notification_email ? 'bg-indigo-500' : 'bg-gray-700')
                }
              >
                <span
                  className={
                    'absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ' +
                    (notifData.notification_email ? 'right-1' : 'left-1')
                  }
                />
              </button>
            </div>

            {/* Weekly Report Toggle */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-gray-800/50">
              <div>
                <p className="text-white font-medium">
                  \u05D3\u05D5\u05D7 \u05E9\u05D1\u05D5\u05E2\u05D9 PDF
                </p>
                <p className="text-gray-500 text-sm">
                  \u05E1\u05D9\u05DB\u05D5\u05DD \u05E9\u05D1\u05D5\u05E2\u05D9 \u05E9\u05DC \u05D4\u05DE\u05D5\u05D3\u05D9\u05E2\u05D9\u05DF \u05D4\u05E2\u05E1\u05E7\u05D9
                </p>
              </div>
              <button
                onClick={() =>
                  setNotifData({
                    ...notifData,
                    notification_weekly_report: !notifData.notification_weekly_report,
                  })
                }
                className={
                  'relative w-12 h-6 rounded-full transition-colors ' +
                  (notifData.notification_weekly_report ? 'bg-indigo-500' : 'bg-gray-700')
                }
              >
                <span
                  className={
                    'absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ' +
                    (notifData.notification_weekly_report ? 'right-1' : 'left-1')
                  }
                />
              </button>
            </div>
          </div>

          {/* Morning Alert Time */}
          <div>
            <label className="block text-gray-400 text-sm mb-2">
              <Clock className="w-4 h-4 inline ml-1" />
              \u05E9\u05E2\u05EA \u05D4\u05D5\u05D3\u05E2\u05EA \u05D1\u05D5\u05E7\u05E8
            </label>
            <div className="flex flex-wrap gap-2">
              {morningAlertTimeOptions.map((opt) => (
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
              \u05E8\u05DE\u05EA \u05E8\u05D2\u05D9\u05E9\u05D5\u05EA \u05D4\u05EA\u05E8\u05D0\u05D5\u05EA
            </label>
            <div className="flex flex-wrap gap-2">
              {alertSensitivityOptions.map((opt) => (
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
                  <span className="text-xs text-gray-500 mr-1">({opt.desc})</span>
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

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 4: SUBSCRIPTION
          ═══════════════════════════════════════════════════════════════════════ */}
      <div className="glass-card">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
            <CreditCard className="w-5 h-5 text-indigo-400" />
          </div>
          <h2 className="text-lg font-semibold text-white">\u05DE\u05E0\u05D5\u05D9</h2>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-sm">
              \u05EA\u05D5\u05DB\u05E0\u05D9\u05EA \u05E0\u05D5\u05DB\u05D7\u05D9\u05EA:
            </span>
            <span className="text-white font-medium">
              {(currentProfile as any)?.plan_name || '\u05D7\u05D9\u05E0\u05DE\u05D9'}
            </span>
          </div>

          <p className="text-gray-400 text-sm">
            \u05E0\u05D4\u05DC\u05D5 \u05D0\u05EA \u05D4\u05DE\u05E0\u05D5\u05D9, \u05E9\u05D3\u05E8\u05D2\u05D5 \u05EA\u05D5\u05DB\u05E0\u05D9\u05EA \u05D5\u05E6\u05E4\u05D5 \u05D1\u05E9\u05D9\u05DE\u05D5\u05E9 \u05E7\u05E8\u05D3\u05D9\u05D8\u05D9\u05DD
          </p>

          <a
            href="/dashboard/billing"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-medium hover:from-blue-500 hover:to-cyan-500 transition-all"
          >
            <CreditCard className="w-4 h-4" />
            \u05E0\u05D9\u05D4\u05D5\u05DC \u05DE\u05E0\u05D5\u05D9
          </a>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          SCHEDULED JOBS
          ═══════════════════════════════════════════════════════════════════════ */}
      <div className="glass-card">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
              <Clock className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">
                \u05DE\u05E9\u05D9\u05DE\u05D5\u05EA \u05DE\u05EA\u05D5\u05D6\u05DE\u05E0\u05D5\u05EA
              </h2>
              <p className="text-gray-500 text-sm">
                \u05E0\u05D9\u05D4\u05D5\u05DC \u05E1\u05E8\u05D9\u05E7\u05D5\u05EA \u05D0\u05D5\u05D8\u05D5\u05DE\u05D8\u05D9\u05D5\u05EA
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
            \u05D0\u05D9\u05E4\u05D5\u05E1 \u05D1\u05E8\u05D9\u05E8\u05D5\u05EA \u05DE\u05D7\u05D3\u05DC
          </button>
        </div>

        {jobsLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
          </div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-8">
            <Clock className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">
              \u05D0\u05D9\u05DF \u05DE\u05E9\u05D9\u05DE\u05D5\u05EA \u05DE\u05EA\u05D5\u05D6\u05DE\u05E0\u05D5\u05EA
            </p>
            <button
              onClick={resetDefaults}
              className="mt-3 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors text-sm"
            >
              \u05E6\u05D5\u05E8 \u05DE\u05E9\u05D9\u05DE\u05D5\u05EA \u05D1\u05E8\u05D9\u05E8\u05EA \u05DE\u05D7\u05D3\u05DC
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
                        \u05D4\u05E8\u05E6\u05D4 \u05D0\u05D7\u05E8\u05D5\u05E0\u05D4: {formatDateTime(job.last_run_at)}
                      </span>
                      <span>
                        \u05D4\u05E8\u05E6\u05D4 \u05D4\u05D1\u05D0\u05D4: {formatDateTime(job.next_run_at)}
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

      {/* ═══════════════════════════════════════════════════════════════════════
          DANGER ZONE
          ═══════════════════════════════════════════════════════════════════════ */}
      <div className="glass-card border border-red-500/20">
        <h3 className="text-red-400 font-semibold mb-4">
          \u05D0\u05D6\u05D5\u05E8 \u05DE\u05E1\u05D5\u05DB\u05DF
        </h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white">
              \u05DE\u05D7\u05E7 \u05D0\u05EA \u05D4\u05D7\u05E9\u05D1\u05D5\u05DF
            </p>
            <p className="text-gray-500 text-sm">
              \u05E4\u05E2\u05D5\u05DC\u05D4 \u05D6\u05D5 \u05DC\u05D0 \u05E0\u05D9\u05EA\u05E0\u05EA \u05DC\u05D1\u05D9\u05D8\u05D5\u05DC
            </p>
          </div>
          <button
            onClick={async () => {
              if (
                !window.confirm(
                  '\u05D4\u05D0\u05DD \u05D0\u05EA\u05D4 \u05D1\u05D8\u05D5\u05D7 \u05E9\u05D1\u05E8\u05E6\u05D5\u05E0\u05DA \u05DC\u05DE\u05D7\u05D5\u05E7 \u05D0\u05EA \u05D4\u05D7\u05E9\u05D1\u05D5\u05DF? \u05E4\u05E2\u05D5\u05DC\u05D4 \u05D6\u05D5 \u05DC\u05D0 \u05E0\u05D9\u05EA\u05E0\u05EA \u05DC\u05D1\u05D9\u05D8\u05D5\u05DC.'
                )
              )
                return;
              try {
                const res = await apiFetch(
                  `/business/profile/${currentProfile?.id}`,
                  { method: 'DELETE' }
                );
                if (res.ok) {
                  toast.success(
                    '\u05D4\u05D7\u05E9\u05D1\u05D5\u05DF \u05E0\u05DE\u05D7\u05E7 \u05D1\u05D4\u05E6\u05DC\u05D7\u05D4'
                  );
                  window.location.href = '/';
                } else {
                  toast.error(
                    '\u05E9\u05D2\u05D9\u05D0\u05D4 \u05D1\u05DE\u05D7\u05D9\u05E7\u05EA \u05D4\u05D7\u05E9\u05D1\u05D5\u05DF'
                  );
                }
              } catch {
                toast.error(
                  '\u05E9\u05D2\u05D9\u05D0\u05D4 \u05D1\u05DE\u05D7\u05D9\u05E7\u05EA \u05D4\u05D7\u05E9\u05D1\u05D5\u05DF'
                );
              }
            }}
            className="px-4 py-2 rounded-xl bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 transition-colors"
          >
            \u05DE\u05D7\u05E7 \u05D7\u05E9\u05D1\u05D5\u05DF
          </button>
        </div>
      </div>
    </div>
  );
}
