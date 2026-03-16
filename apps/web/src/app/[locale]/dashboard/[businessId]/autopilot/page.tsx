"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { useRouter } from "@/i18n/navigation";
import Topbar from "@/components/Topbar";

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
    <div className="flex h-screen flex-col">
      <Topbar />
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-3xl">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold">{t("autopilotPage")}</h1>
              <p className="text-xs text-gray-500">{t("autopilotSubtitle")}</p>
            </div>
            <button
              onClick={() => router.push(`/dashboard/${businessId}`)}
              className="rounded-lg border border-gray-700 px-3 py-1.5 text-xs text-gray-400 hover:bg-gray-800"
            >
              {tc("back")}
            </button>
          </div>

          {settings && (
            <div className="mb-6 space-y-4 rounded-lg border border-gray-800 bg-gray-900 p-4">
              {/* Enable toggle */}
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">{t("autopilotEnabled")}</label>
                <button
                  onClick={() => setSettings({ ...settings, is_enabled: !settings.is_enabled })}
                  className={`rounded-full px-4 py-1 text-xs font-medium ${
                    settings.is_enabled
                      ? "bg-green-900 text-green-300"
                      : "bg-gray-800 text-gray-500"
                  }`}
                >
                  {settings.is_enabled ? t("enabled") : t("disabled")}
                </button>
              </div>

              {/* Mode selector */}
              <div>
                <label className="mb-1 block text-xs text-gray-400">{t("autopilotMode")}</label>
                <div className="flex gap-2">
                  {MODE_OPTIONS.map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setSettings({ ...settings, mode })}
                      className={`flex-1 rounded-lg px-3 py-2 text-xs ${
                        settings.mode === mode
                          ? "bg-blue-900 text-blue-300"
                          : "bg-gray-800 text-gray-500 hover:bg-gray-700"
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
              <div>
                <label className="mb-1 block text-xs text-gray-400">{t("dailyBudgetCap")}</label>
                <input
                  type="number"
                  min={0}
                  value={settings.daily_budget_cap}
                  onChange={(e) => setSettings({ ...settings, daily_budget_cap: Number(e.target.value) })}
                  className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              {/* Risk tolerance */}
              <div>
                <label className="mb-1 block text-xs text-gray-400">{t("riskTolerance")}</label>
                <div className="flex gap-2">
                  {RISK_OPTIONS.map((risk) => (
                    <button
                      key={risk}
                      onClick={() => setSettings({ ...settings, risk_tolerance: risk })}
                      className={`rounded-lg px-3 py-1.5 text-xs ${
                        settings.risk_tolerance === risk
                          ? risk === "LOW"
                            ? "bg-green-900 text-green-300"
                            : risk === "MEDIUM"
                              ? "bg-yellow-900 text-yellow-300"
                              : "bg-red-900 text-red-300"
                          : "bg-gray-800 text-gray-500 hover:bg-gray-700"
                      }`}
                    >
                      {risk}
                    </button>
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
                      <button
                        key={action}
                        onClick={() => toggleAction(action)}
                        className={`rounded-full px-3 py-1 text-xs ${
                          active
                            ? "bg-blue-900 text-blue-300"
                            : "bg-gray-800 text-gray-600"
                        }`}
                      >
                        {action.replace(/_/g, " ")}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Save + Run */}
              <div className="flex items-center gap-2 border-t border-gray-800 pt-4">
                <button
                  onClick={saveSettings}
                  disabled={saving}
                  className="rounded-lg bg-white px-4 py-1.5 text-xs font-semibold text-gray-950 hover:bg-gray-200 disabled:opacity-50"
                >
                  {saving ? tc("loading") : tc("save")}
                </button>
                <button
                  onClick={runAutopilot}
                  disabled={running}
                  className="rounded-lg border border-blue-700 bg-blue-950 px-4 py-1.5 text-xs text-blue-300 hover:bg-blue-900 disabled:opacity-50"
                >
                  {running ? t("runningAutopilot") : t("runAutopilot")}
                </button>
                {runMsg && <span className="text-xs text-green-400">{runMsg}</span>}
              </div>
            </div>
          )}

          {/* Digests */}
          <div>
            <h2 className="mb-3 text-sm font-semibold">{t("dailyDigest")}</h2>
            {digests.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-800 px-4 py-12 text-center text-xs text-gray-600">
                {t("noDigests")}
              </div>
            ) : (
              <div className="space-y-3">
                {digests.map((digest) => (
                  <div
                    key={digest.id}
                    className="rounded-lg border border-gray-800 bg-gray-900 p-4"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-medium">{t("digestSummary")}</span>
                      <span className="text-[10px] text-gray-600">
                        {new Date(digest.date).toLocaleString()}
                      </span>
                    </div>
                    {digest.summary && (
                      <p className="mb-2 text-sm text-gray-300">{digest.summary}</p>
                    )}
                    {digest.items && (
                      <div className="flex flex-wrap gap-3 text-xs">
                        {digest.items.pending_approvals != null && digest.items.pending_approvals > 0 && (
                          <span className="rounded bg-yellow-900 px-2 py-0.5 text-yellow-300">
                            {t("pendingApprovalsCount")}: {digest.items.pending_approvals}
                          </span>
                        )}
                        {digest.items.executed_today != null && digest.items.executed_today > 0 && (
                          <span className="rounded bg-green-900 px-2 py-0.5 text-green-300">
                            {t("executedToday")}: {digest.items.executed_today}
                          </span>
                        )}
                        {digest.items.new_leads != null && digest.items.new_leads > 0 && (
                          <span className="rounded bg-emerald-900 px-2 py-0.5 text-emerald-300">
                            {t("newLeadsCount")}: {digest.items.new_leads}
                          </span>
                        )}
                        {digest.items.new_trends != null && digest.items.new_trends > 0 && (
                          <span className="rounded bg-amber-900 px-2 py-0.5 text-amber-300">
                            {t("newTrendsCount")}: {digest.items.new_trends}
                          </span>
                        )}
                        {digest.items.new_reviews != null && digest.items.new_reviews > 0 && (
                          <span className="rounded bg-yellow-900 px-2 py-0.5 text-yellow-300">
                            {t("newReviewsCount")}: {digest.items.new_reviews}
                          </span>
                        )}
                        {digest.items.competitor_events != null && digest.items.competitor_events > 0 && (
                          <span className="rounded bg-rose-900 px-2 py-0.5 text-rose-300">
                            {t("competitorEventsCount")}: {digest.items.competitor_events}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
