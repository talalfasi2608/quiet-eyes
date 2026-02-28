import { useState, useEffect, useCallback } from 'react';
import { useSimulation } from '../../context/SimulationContext';
import {
  Zap,
  MessageSquare,
  Target,
  Shield,
  Sun,
  Megaphone,
  Loader2,
  Clock,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Activity,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { apiFetch } from '../../services/api';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface AutomationSettings {
  review_responder: boolean;
  lead_alerts: boolean;
  competitor_alerts: boolean;
  morning_briefing: boolean;
  campaign_generator: boolean;
}

interface LogEntry {
  id: string;
  automation_type: string;
  trigger_event: string;
  action_taken: string;
  result: string;
  details: Record<string, unknown>;
  created_at: string;
}

interface Campaign {
  id: string;
  campaign_name: string;
  trigger: string;
  facebook_post: string;
  instagram_caption: string;
  whatsapp_message: string;
  offer: string;
  status: string;
  created_at: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUTOMATION CONFIG
// ═══════════════════════════════════════════════════════════════════════════════

const AUTOMATION_CONFIG: Record<string, {
  icon: typeof Zap;
  label: string;
  description: string;
  color: string;
  bg: string;
}> = {
  review_responder: {
    icon: MessageSquare,
    label: 'מגיב לביקורות',
    description: 'יצירת תגובה אוטומטית לביקורות חדשות',
    color: 'text-blue-400',
    bg: 'bg-blue-500/15',
  },
  lead_alerts: {
    icon: Target,
    label: 'התראות לידים',
    description: 'התראה על לידים חמים עם הודעת פנייה',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/15',
  },
  competitor_alerts: {
    icon: Shield,
    label: 'מעקב מתחרים',
    description: 'ניטור מתחרים והתראות שינויים',
    color: 'text-amber-400',
    bg: 'bg-amber-500/15',
  },
  morning_briefing: {
    icon: Sun,
    label: 'תדריך בוקר',
    description: 'סיכום יומי ב-WhatsApp',
    color: 'text-orange-400',
    bg: 'bg-orange-500/15',
  },
  campaign_generator: {
    icon: Megaphone,
    label: 'מחולל קמפיינים',
    description: 'יצירת קמפיינים אוטומטית',
    color: 'text-purple-400',
    bg: 'bg-purple-500/15',
  },
};

const LOG_ICONS: Record<string, { icon: typeof Zap; color: string }> = {
  review_responder: { icon: MessageSquare, color: 'text-blue-400' },
  lead_outreach: { icon: Target, color: 'text-emerald-400' },
  competitor_alerts: { icon: Shield, color: 'text-amber-400' },
  morning_briefing: { icon: Sun, color: 'text-orange-400' },
  campaign_generator: { icon: Megaphone, color: 'text-purple-400' },
};

// ═══════════════════════════════════════════════════════════════════════════════
// TOGGLE SWITCH
// ═══════════════════════════════════════════════════════════════════════════════

function Toggle({ enabled, onChange, loading }: { enabled: boolean; onChange: () => void; loading: boolean }) {
  return (
    <button
      onClick={onChange}
      disabled={loading}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 ${
        enabled ? 'bg-cyan-500' : 'bg-gray-600'
      } ${loading ? 'opacity-50' : ''}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-300 ${
          enabled ? '-translate-x-6' : '-translate-x-1'
        }`}
      />
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COPY BUTTON
// ═══════════════════════════════════════════════════════════════════════════════

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success(`${label} הועתק!`);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('שגיאה בהעתקה');
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1 px-2 py-1 text-xs rounded-lg bg-gray-700/50 hover:bg-gray-600/50 text-gray-300 transition-colors"
    >
      {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
      {label}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TIME AGO
// ═══════════════════════════════════════════════════════════════════════════════

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diff < 60) return 'לפני רגע';
  if (diff < 3600) return `לפני ${Math.floor(diff / 60)} דקות`;
  if (diff < 86400) return `לפני ${Math.floor(diff / 3600)} שעות`;
  if (diff < 604800) return `לפני ${Math.floor(diff / 86400)} ימים`;
  return date.toLocaleDateString('he-IL');
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function Automations() {
  const { currentProfile } = useSimulation();
  const businessId = currentProfile?.id;

  const [settings, setSettings] = useState<AutomationSettings | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggleLoading, setToggleLoading] = useState<string | null>(null);
  const [expandedCampaign, setExpandedCampaign] = useState<string | null>(null);

  // ─── FETCH DATA ──────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);

    try {
      const [settingsRes, logRes, campaignsRes] = await Promise.all([
        apiFetch(`/automations/settings/${businessId}`),
        apiFetch(`/automations/log/${businessId}?limit=30`),
        apiFetch(`/automations/campaigns/${businessId}`),
      ]);

      if (settingsRes.ok) {
        const data = await settingsRes.json();
        setSettings(data.settings);
      }
      if (logRes.ok) {
        const data = await logRes.json();
        setLog(data.log || []);
      }
      if (campaignsRes.ok) {
        const data = await campaignsRes.json();
        setCampaigns(data.campaigns || []);
      }
    } catch (err) {
      console.error('Automations fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ─── TOGGLE HANDLER ──────────────────────────────────────────────────

  const handleToggle = async (key: string) => {
    if (!businessId || !settings) return;
    setToggleLoading(key);

    const newValue = !settings[key as keyof AutomationSettings];

    try {
      const res = await apiFetch(`/automations/settings/${businessId}`, {
        method: 'PATCH',
        body: JSON.stringify({ [key]: newValue }),
      });

      if (res.ok) {
        setSettings(prev => prev ? { ...prev, [key]: newValue } : prev);
        toast.success(newValue ? 'העוזר הופעל' : 'העוזר הושבת');
      } else {
        toast.error('שגיאה בעדכון');
      }
    } catch {
      toast.error('שגיאה בעדכון');
    } finally {
      setToggleLoading(null);
    }
  };

  // ─── LOADING STATE ───────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
      </div>
    );
  }

  // ─── RENDER ──────────────────────────────────────────────────────────

  return (
    <div className="space-y-8 animate-fade-in" dir="rtl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <Zap className="w-7 h-7 text-cyan-400" />
          העוזרים שלי 🤖
        </h1>
        <p className="text-gray-400 mt-1">6 עוזרים חכמים שעובדים בשבילך מאחורי הקלעים</p>
      </div>

      {/* ── Section 1: Toggles ─────────────────────────────────────────── */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5 text-cyan-400" />
          עוזרים פעילים
        </h2>
        <div className="space-y-3">
          {Object.entries(AUTOMATION_CONFIG).map(([key, config]) => {
            const Icon = config.icon;
            const enabled = settings?.[key as keyof AutomationSettings] ?? true;

            return (
              <div
                key={key}
                className="glass-card p-4 flex items-center gap-4 transition-all duration-300 hover:border-gray-600/50"
              >
                <div className={`w-10 h-10 rounded-xl ${config.bg} flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${config.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">{config.label}</p>
                  <p className="text-xs text-gray-400">{config.description}</p>
                </div>
                <Toggle
                  enabled={enabled}
                  onChange={() => handleToggle(key)}
                  loading={toggleLoading === key}
                />
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Section 2: Activity Log ────────────────────────────────────── */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-cyan-400" />
          יומן פעילות
        </h2>
        {log.length === 0 ? (
          <div className="glass-card p-8 text-center">
            <Clock className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">אין פעילות עדיין</p>
            <p className="text-gray-500 text-sm mt-1">כשהעוזרים שלך יפעלו, הפעילות תופיע כאן</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
            {log.map((entry) => {
              const logConfig = LOG_ICONS[entry.automation_type] || { icon: Zap, color: 'text-gray-400' };
              const LogIcon = logConfig.icon;

              return (
                <div
                  key={entry.id}
                  className="glass-card p-3 flex items-start gap-3"
                >
                  <LogIcon className={`w-4 h-4 mt-0.5 ${logConfig.color}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white">
                      {entry.action_taken}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {entry.trigger_event}
                    </p>
                  </div>
                  <div className="text-left shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      entry.result === 'success' ? 'bg-emerald-500/15 text-emerald-400' :
                      entry.result === 'error' ? 'bg-red-500/15 text-red-400' :
                      'bg-amber-500/15 text-amber-400'
                    }`}>
                      {entry.result === 'success' ? 'הצלחה' :
                       entry.result === 'error' ? 'שגיאה' :
                       entry.result === 'pending_approval' ? 'ממתין' : entry.result}
                    </span>
                    <p className="text-xs text-gray-500 mt-1">{timeAgo(entry.created_at)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Section 3: Campaigns ───────────────────────────────────────── */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Megaphone className="w-5 h-5 text-cyan-400" />
          קמפיינים
        </h2>
        {campaigns.length === 0 ? (
          <div className="glass-card p-8 text-center">
            <Megaphone className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">אין קמפיינים עדיין</p>
            <p className="text-gray-500 text-sm mt-1">העוזרים שלך ייצרו קמפיינים כשיזוהו הזדמנויות</p>
          </div>
        ) : (
          <div className="space-y-3">
            {campaigns.map((campaign) => {
              const isExpanded = expandedCampaign === campaign.id;

              return (
                <div key={campaign.id} className="glass-card overflow-hidden">
                  {/* Campaign Header */}
                  <button
                    onClick={() => setExpandedCampaign(isExpanded ? null : campaign.id)}
                    className="w-full p-4 flex items-center gap-3 text-right"
                  >
                    <Megaphone className="w-5 h-5 text-purple-400" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white">{campaign.campaign_name}</p>
                      <p className="text-xs text-gray-400">{timeAgo(campaign.created_at)}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      campaign.status === 'active' ? 'bg-emerald-500/15 text-emerald-400' :
                      campaign.status === 'draft' ? 'bg-amber-500/15 text-amber-400' :
                      'bg-gray-500/15 text-gray-400'
                    }`}>
                      {campaign.status === 'active' ? 'פעיל' :
                       campaign.status === 'draft' ? 'טיוטה' :
                       campaign.status === 'completed' ? 'הושלם' : campaign.status}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    )}
                  </button>

                  {/* Campaign Details */}
                  {isExpanded && (
                    <div className="p-4 pt-0 space-y-4 border-t border-gray-700/30">
                      {/* Offer */}
                      {campaign.offer && (
                        <div className="bg-gradient-to-r from-purple-500/10 to-cyan-500/10 rounded-xl p-3 border border-purple-500/20">
                          <p className="text-xs text-purple-300 mb-1">הצעה</p>
                          <p className="text-sm text-white">{campaign.offer}</p>
                        </div>
                      )}

                      {/* Facebook Post */}
                      {campaign.facebook_post && (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-xs text-gray-400">פוסט פייסבוק</p>
                            <CopyButton text={campaign.facebook_post} label="העתק" />
                          </div>
                          <div className="bg-gray-800/50 rounded-lg p-3 text-sm text-gray-300 whitespace-pre-wrap">
                            {campaign.facebook_post}
                          </div>
                        </div>
                      )}

                      {/* Instagram Caption */}
                      {campaign.instagram_caption && (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-xs text-gray-400">כיתוב אינסטגרם</p>
                            <CopyButton text={campaign.instagram_caption} label="העתק" />
                          </div>
                          <div className="bg-gray-800/50 rounded-lg p-3 text-sm text-gray-300 whitespace-pre-wrap">
                            {campaign.instagram_caption}
                          </div>
                        </div>
                      )}

                      {/* WhatsApp Message */}
                      {campaign.whatsapp_message && (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-xs text-gray-400">הודעת WhatsApp</p>
                            <CopyButton text={campaign.whatsapp_message} label="העתק" />
                          </div>
                          <div className="bg-gray-800/50 rounded-lg p-3 text-sm text-gray-300 whitespace-pre-wrap">
                            {campaign.whatsapp_message}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
