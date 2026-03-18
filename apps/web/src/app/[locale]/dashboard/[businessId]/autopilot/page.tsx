"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { useRouter } from "@/i18n/navigation";
import { PageHeader, Card, Button, SectionHeader, Badge, EmptyState, Input } from "@/components/ui";

interface AutopilotSettings {
  id: string;
  business_id: string;
  is_enabled: boolean;
  mode: "ASSIST" | "OPERATOR" | "AUTOPILOT";
  confidence_threshold: number;
  daily_budget_cap: number;
  risk_tolerance: "LOW" | "MEDIUM" | "HIGH";
  allowed_actions: string[] | null;
  quiet_hours: { start?: string; end?: string } | null;
  created_at: string;
}

interface DigestItem {
  id: string;
  business_id: string;
  date: string;
  summary: string | null;
  items: {
    pending_approvals?: number;
    executed_today?: number;
    new_leads?: number;
    new_trends?: number;
    new_reviews?: number;
    competitor_events?: number;
  } | null;
  created_at: string;
}

interface AutopilotRunResult {
  actions_created: number;
  approvals_auto_executed: number;
  digest_created: boolean;
}

const ALL_ACTIONS = [
  "REPLY_DRAFT",
  "AUDIENCE_DRAFT",
  "CAMPAIGN_DRAFT",
  "CRM_SYNC",
  "EXPORT",
];

const MODE_OPTIONS = ["ASSIST", "OPERATOR", "AUTOPILOT"] as const;
const RISK_OPTIONS = ["LOW", "MEDIUM", "HIGH"] as const;

export default function AutopilotPage() {
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const router = useRouter();
  const { businessId } = useParams<{ businessId: string }>();
  const token = getToken();

  const [settings, setSettings] = useState<AutopilotSettings | null>(null);
  const [digests, setDigests] = useState<DigestItem[]>([]);
  const [running, setRunning] = useState(false);
  const [runMsg, setRunMsg] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!token) router.push("/login");
  }, [token, router]);

  const loadSettings = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiFetch<AutopilotSettings>(
        `/businesses/${businessId}/autopilot/settings`,
        { token },
      );
      setSettings(data);
    } catch { /* empty */ }
  }, [businessId, token]);

  const loadDigests = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiFetch<DigestItem[]>(
        `/businesses/${businessId}/digests?limit=5`,
        { token },
      );
      setDigests(data);
    } catch { /* empty */ }
  }, [businessId, token]);

  useEffect(() => {
    loadSettings();
    loadDigests();
  }, [loadSettings, loadDigests]);

  async function saveSettings() {
    if (!token || !settings) return;
    setSaving(true);
    try {
      const data = await apiFetch<AutopilotSettings>(
        `/businesses/${businessId}/autopilot/settings`,
        {
          method: "PUT",
          token,
          body: JSON.stringify({
            is_enabled: settings.is_enabled,
            mode: settings.mode,
            confidence_threshold: settings.confidence_threshold,
            daily_budget_cap: settings.daily_budget_cap,
            risk_tolerance: settings.risk_tolerance,
            allowed_actions: settings.allowed_actions,
            quiet_hours: settings.quiet_hours,
          }),
        },
      );
      setSettings(data);
    } catch { /* empty */ } finally {
      setSaving(false);
    }
  }

  async function runAutopilot() {
    if (!token || running) return;
    setRunning(true);
    setRunMsg("");
    try {
      const res = await apiFetch<AutopilotRunResult>(
        `/businesses/${businessId}/autopilot/run_now`,
        { method: "POST", token },
      );
      setRunMsg(t("autopilotDone", { actions: res.actions_created, executed: res.approvals_auto_executed }));
      loadDigests();
    } catch {
      setRunMsg("Autopilot run failed");
    } finally {
      setRunning(false);
    }
  }

  function toggleAction(action: string) {
    if (!settings) return;
    const current = settings.allowed_actions || ALL_ACTIONS;
    const updated = current.includes(action)
      ? current.filter((a) => a !== action)
      : [...current, action];
    setSettings({ ...settings, allowed_actions: updated });
  }

  if (!token) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("autopilotPage")}
        description={t("autopilotSubtitle")}
      />

      {settings && (
        <Card>
          <div className="space-y-4">
            {/* Enable toggle */}
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-100">{t("autopilotEnabled")}</label>
              <Button
                variant={settings.is_enabled ? "primary" : "secondary"}
                size="sm"
                onClick={() => setSettings({ ...settings, is_enabled: !settings.is_enabled })}
              >
                {settings.is_enabled ? t("enabled") : t("disabled")}
              </Button>
            </div>

            {/* Mode selector */}
            <div>
              <label className="mb-1 block text-xs text-gray-400">{t("autopilotMode")}</label>
              <div className="flex gap-2">
                {MODE_OPTIONS.map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setSettings({ ...settings, mode })}
                    className={`flex-1 rounded-lg px-3 py-2 text-xs transition-colors ${
                      settings.mode === mode
                        ? "bg-white/10 border border-gray-600 text-gray-100"
                        : "bg-gray-900/50 border border-gray-800/50 text-gray-500 hover:bg-gray-800/50"
                    }`}
                  >
                    <div className="font-medium">{t(`mode${mode.charAt(0) + mode.slice(1).toLowerCase()}`)}</div>
                    <div className="mt-0.5 text-[10px] opacity-70">
                      {t(`mode${mode.charAt(0) + mode.slice(1).toLowerCase()}Desc`)}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Confidence threshold */}
            <div>
              <label className="mb-1 block text-xs text-gray-400">
                {t("confidenceThreshold")}: {settings.confidence_threshold}%
              </label>
              <input
                type="range"
                min={50}
                max={100}
                value={settings.confidence_threshold}
                onChange={(e) => setSettings({ ...settings, confidence_threshold: Number(e.target.value) })}
                className="w-full"
              />
            </div>

            {/* Daily budget cap */}
            <Input
              label={t("dailyBudgetCap")}
              type="number"
              min={0}
              value={settings.daily_budget_cap}
              onChange={(e) => setSettings({ ...settings, daily_budget_cap: Number(e.target.value) })}
            />

            {/* Risk tolerance */}
            <div>
              <label className="mb-1 block text-xs text-gray-400">{t("riskTolerance")}</label>
              <div className="flex gap-2">
                {RISK_OPTIONS.map((risk) => (
                  <Button
                    key={risk}
                    variant={settings.risk_tolerance === risk ? "primary" : "secondary"}
                    size="sm"
                    onClick={() => setSettings({ ...settings, risk_tolerance: risk })}
                  >
                    {risk}
                  </Button>
                ))}
              </div>
            </div>

            {/* Allowed actions */}
            <div>
              <label className="mb-1 block text-xs text-gray-400">{t("allowedActions")}</label>
              <div className="flex flex-wrap gap-2">
                {ALL_ACTIONS.map((action) => {
                  const active = (settings.allowed_actions || ALL_ACTIONS).includes(action);
                  return (
                    <Button
                      key={action}
                      variant={active ? "primary" : "ghost"}
                      size="sm"
                      onClick={() => toggleAction(action)}
                    >
                      {action.replace(/_/g, " ")}
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* Save + Run */}
            <div className="flex items-center gap-2 border-t border-gray-800/50 pt-4">
              <Button onClick={saveSettings} loading={saving}>
                {saving ? tc("loading") : tc("save")}
              </Button>
              <Button variant="secondary" onClick={runAutopilot} loading={running}>
                {running ? t("runningAutopilot") : t("runAutopilot")}
              </Button>
              {runMsg && <span className="text-xs text-green-400">{runMsg}</span>}
            </div>
          </div>
        </Card>
      )}

      {/* Digests */}
      <SectionHeader title={t("dailyDigest")} />
      {digests.length === 0 ? (
        <EmptyState title={t("noDigests")} />
      ) : (
        <div className="space-y-3">
          {digests.map((digest) => (
            <Card key={digest.id}>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-gray-100">{t("digestSummary")}</span>
                <span className="text-[10px] text-gray-500">
                  {new Date(digest.date).toLocaleString()}
                </span>
              </div>
              {digest.summary && (
                <p className="mb-2 text-sm text-gray-300">{digest.summary}</p>
              )}
              {digest.items && (
                <div className="flex flex-wrap gap-2">
                  {digest.items.pending_approvals != null && digest.items.pending_approvals > 0 && (
                    <Badge variant="warning">{t("pendingApprovalsCount")}: {digest.items.pending_approvals}</Badge>
                  )}
                  {digest.items.executed_today != null && digest.items.executed_today > 0 && (
                    <Badge variant="success">{t("executedToday")}: {digest.items.executed_today}</Badge>
                  )}
                  {digest.items.new_leads != null && digest.items.new_leads > 0 && (
                    <Badge variant="success">{t("newLeadsCount")}: {digest.items.new_leads}</Badge>
                  )}
                  {digest.items.new_trends != null && digest.items.new_trends > 0 && (
                    <Badge variant="warning">{t("newTrendsCount")}: {digest.items.new_trends}</Badge>
                  )}
                  {digest.items.new_reviews != null && digest.items.new_reviews > 0 && (
                    <Badge variant="warning">{t("newReviewsCount")}: {digest.items.new_reviews}</Badge>
                  )}
                  {digest.items.competitor_events != null && digest.items.competitor_events > 0 && (
                    <Badge variant="error">{t("competitorEventsCount")}: {digest.items.competitor_events}</Badge>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
