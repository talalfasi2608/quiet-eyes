"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { useRouter } from "@/i18n/navigation";
import Topbar from "@/components/Topbar";

/* ── Types ── */

interface CampaignItem {
  id: string;
  business_id: string;
  name: string;
  draft: {
    objective: string;
    platform: string;
    budget_suggestion: number;
    audience_summary: string;
    targeting_suggestions: string[];
    creatives: {
      variant: number;
      headline: string;
      primary_text: string;
      cta: string;
    }[];
    utm: Record<string, string>;
    schedule_suggestion: {
      start: string;
      duration_days: number;
      daily_budget: number;
    };
  } | null;
  status: "DRAFT" | "APPROVED" | "EXECUTED" | "READY_TO_PUBLISH" | "PUBLISH_PENDING" | "PUBLISHED" | "PUBLISH_FAILED";
  created_at: string;
}

interface PublishLogItem {
  id: string;
  campaign_id: string;
  platform: string;
  status: string;
  external_id: string | null;
  error_message: string | null;
  created_at: string;
}

interface AudienceItem {
  id: string;
  name: string;
}

interface ApprovalItem {
  id: string;
  status: string;
  risk: string;
  cost_impact: number;
  confidence: number;
  action: {
    id: string;
    type: string;
    payload: Record<string, unknown> | null;
  } | null;
}

const OBJECTIVES = ["LEADS", "SALES", "TRAFFIC"] as const;
const PLATFORMS = ["meta", "google", "tiktok"] as const;

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-yellow-900 text-yellow-300",
  APPROVED: "bg-blue-900 text-blue-300",
  EXECUTED: "bg-green-900 text-green-300",
  READY_TO_PUBLISH: "bg-purple-900 text-purple-300",
  PUBLISH_PENDING: "bg-orange-900 text-orange-300",
  PUBLISHED: "bg-emerald-900 text-emerald-300",
  PUBLISH_FAILED: "bg-red-900 text-red-300",
};

function statusLabel(status: string, t: (key: string) => string): string {
  const map: Record<string, string> = {
    DRAFT: t("statusDraft"),
    APPROVED: t("statusApproved"),
    EXECUTED: t("statusExecuted"),
    READY_TO_PUBLISH: t("statusReadyToPublish"),
    PUBLISH_PENDING: t("statusPublishPending"),
    PUBLISHED: t("statusPublished"),
    PUBLISH_FAILED: t("statusPublishFailed"),
  };
  return map[status] || status;
}

/* ── Main Page ── */

export default function CampaignsPage() {
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const router = useRouter();
  const { businessId } = useParams<{ businessId: string }>();
  const token = getToken();

  const [campaigns, setCampaigns] = useState<CampaignItem[]>([]);
  const [audiences, setAudiences] = useState<AudienceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<CampaignItem | null>(null);

  useEffect(() => {
    if (!token) router.push("/login");
  }, [token, router]);

  const loadCampaigns = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await apiFetch<CampaignItem[]>(
        `/businesses/${businessId}/campaigns`,
        { token },
      );
      setCampaigns(data);
    } catch { /* empty */ } finally {
      setLoading(false);
    }
  }, [businessId, token]);

  const loadAudiences = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiFetch<AudienceItem[]>(
        `/businesses/${businessId}/audiences`,
        { token },
      );
      setAudiences(data);
    } catch { /* empty */ }
  }, [businessId, token]);

  useEffect(() => {
    loadCampaigns();
    loadAudiences();
  }, [loadCampaigns, loadAudiences]);

  if (!token) return null;

  return (
    <div className="flex h-screen flex-col">
      <Topbar />
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push(`/dashboard/${businessId}`)}
              className="rounded border border-gray-700 px-2 py-1 text-xs text-gray-400 hover:bg-gray-800"
            >
              {tc("back")}
            </button>
            <h1 className="text-lg font-semibold">{t("campaignsPage")}</h1>
          </div>
          <button
            onClick={() => { setShowCreateForm(!showCreateForm); setSelectedCampaign(null); }}
            className="rounded-lg bg-indigo-700 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-600"
          >
            {t("createCampaignDraft")}
          </button>
        </div>

        {showCreateForm && (
          <CampaignCreateForm
            businessId={businessId}
            token={token!}
            audiences={audiences}
            onCreated={() => { loadCampaigns(); setShowCreateForm(false); }}
            onClose={() => setShowCreateForm(false)}
          />
        )}

        {selectedCampaign && (
          <CampaignReview
            campaign={selectedCampaign}
            businessId={businessId}
            token={token!}
            onUpdated={() => { loadCampaigns(); setSelectedCampaign(null); }}
            onClose={() => setSelectedCampaign(null)}
          />
        )}

        {loading ? (
          <p className="py-8 text-center text-sm text-gray-500">{tc("loading")}</p>
        ) : campaigns.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">{t("noCampaigns")}</p>
        ) : (
          <div className="space-y-3">
            {campaigns.map((c) => (
              <div
                key={c.id}
                onClick={() => { setSelectedCampaign(c); setShowCreateForm(false); }}
                className="cursor-pointer rounded-lg border border-gray-800 bg-gray-900 p-4 hover:border-gray-700"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="mb-1 flex items-center gap-2">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${STATUS_COLORS[c.status] || "bg-gray-800 text-gray-400"}`}>
                        {statusLabel(c.status, t)}
                      </span>
                      {c.draft && (
                        <span className="rounded bg-gray-800 px-1.5 py-0.5 text-[10px] text-gray-400">
                          {c.draft.platform}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium">{c.name}</p>
                    {c.draft && (
                      <div className="mt-1 flex gap-3 text-xs text-gray-500">
                        <span>{t("objective")}: {c.draft.objective}</span>
                        <span>{t("budgetSuggestion")}: ${c.draft.budget_suggestion}/day</span>
                        <span>{t("creatives")}: {c.draft.creatives.length}</span>
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-gray-600">
                    {new Date(c.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Campaign Create Form ── */

function CampaignCreateForm({
  businessId,
  token,
  audiences,
  onCreated,
  onClose,
}: {
  businessId: string;
  token: string;
  audiences: AudienceItem[];
  onCreated: () => void;
  onClose: () => void;
}) {
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const [sourceType, setSourceType] = useState<"audience" | "manual">("manual");
  const [audienceId, setAudienceId] = useState("");
  const [prompt, setPrompt] = useState("");
  const [platform, setPlatform] = useState<string>("meta");
  const [objective, setObjective] = useState<string>("LEADS");
  const [dailyBudget, setDailyBudget] = useState(50);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(false);

  async function handleCreate() {
    setCreating(true);
    try {
      await apiFetch(`/businesses/${businessId}/campaigns/draft`, {
        method: "POST",
        token,
        body: JSON.stringify({
          source_type: sourceType,
          audience_id: sourceType === "audience" ? audienceId || null : null,
          prompt: sourceType === "manual" ? prompt : null,
          platform,
          daily_budget: dailyBudget,
          objective,
        }),
      });
      setCreated(true);
      onCreated();
    } catch { /* ignore */ } finally {
      setCreating(false);
    }
  }

  return (
    <section className="mb-6 rounded-lg border border-indigo-800 bg-gray-900 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-indigo-300">{t("createCampaignDraft")}</h3>
        <button onClick={onClose} className="text-xs text-gray-500 hover:text-gray-300">
          {tc("cancel")}
        </button>
      </div>

      <div className="space-y-3">
        {/* Source type */}
        <div>
          <label className="mb-1 block text-xs text-gray-400">{t("campaignSource")}</label>
          <div className="flex gap-2">
            <button
              onClick={() => setSourceType("audience")}
              className={`rounded-lg px-3 py-1.5 text-xs ${sourceType === "audience" ? "bg-indigo-800 text-indigo-200" : "bg-gray-800 text-gray-500"}`}
            >
              {t("sourceAudience")}
            </button>
            <button
              onClick={() => setSourceType("manual")}
              className={`rounded-lg px-3 py-1.5 text-xs ${sourceType === "manual" ? "bg-indigo-800 text-indigo-200" : "bg-gray-800 text-gray-500"}`}
            >
              {t("sourceManual")}
            </button>
          </div>
        </div>

        {sourceType === "audience" && (
          <div>
            <label className="mb-1 block text-xs text-gray-400">{t("audienceSegments")}</label>
            <select
              value={audienceId}
              onChange={(e) => setAudienceId(e.target.value)}
              className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            >
              <option value="">Select audience...</option>
              {audiences.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
        )}

        {sourceType === "manual" && (
          <div>
            <label className="mb-1 block text-xs text-gray-400">{t("sourceManual")}</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={t("manualPromptPlaceholder")}
              rows={2}
              className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </div>
        )}

        {/* Platform */}
        <div>
          <label className="mb-1 block text-xs text-gray-400">{t("platform")}</label>
          <div className="flex gap-2">
            {PLATFORMS.map((p) => (
              <button
                key={p}
                onClick={() => setPlatform(p)}
                className={`rounded-lg px-3 py-1.5 text-xs capitalize ${platform === p ? "bg-indigo-800 text-indigo-200" : "bg-gray-800 text-gray-500"}`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Objective */}
        <div>
          <label className="mb-1 block text-xs text-gray-400">{t("objective")}</label>
          <div className="flex gap-2">
            {OBJECTIVES.map((o) => (
              <button
                key={o}
                onClick={() => setObjective(o)}
                className={`rounded-lg px-3 py-1.5 text-xs ${objective === o ? "bg-indigo-800 text-indigo-200" : "bg-gray-800 text-gray-500"}`}
              >
                {o === "LEADS" ? t("objectiveLeads") : o === "SALES" ? t("objectiveSales") : t("objectiveTraffic")}
              </button>
            ))}
          </div>
        </div>

        {/* Budget */}
        <div>
          <label className="mb-1 block text-xs text-gray-400">{t("dailyBudget")}: ${dailyBudget}</label>
          <input
            type="range"
            min={10}
            max={500}
            step={10}
            value={dailyBudget}
            onChange={(e) => setDailyBudget(Number(e.target.value))}
            className="w-full"
          />
        </div>

        {created ? (
          <span className="text-xs text-emerald-400">{t("campaignDraftCreated")}</span>
        ) : (
          <button
            onClick={handleCreate}
            disabled={creating}
            className="rounded-lg bg-indigo-700 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-600 disabled:opacity-50"
          >
            {creating ? t("creatingCampaign") : t("createCampaignDraft")}
          </button>
        )}
      </div>
    </section>
  );
}

/* ── Campaign Review ── */

function CampaignReview({
  campaign,
  businessId,
  token,
  onUpdated,
  onClose,
}: {
  campaign: CampaignItem;
  businessId: string;
  token: string;
  onUpdated: () => void;
  onClose: () => void;
}) {
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const draft = campaign.draft;
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(campaign.name);
  const [editDraft, setEditDraft] = useState(JSON.stringify(draft, null, 2));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [approving, setApproving] = useState(false);
  const [approved, setApproved] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishLogs, setPublishLogs] = useState<PublishLogItem[]>([]);

  async function handleSave() {
    setSaving(true);
    try {
      const parsed = JSON.parse(editDraft);
      await apiFetch(`/campaigns/${campaign.id}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ name: editName, draft: parsed }),
      });
      setSaved(true);
      setEditing(false);
      onUpdated();
    } catch { /* ignore */ } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    async function loadLogs() {
      try {
        const logs = await apiFetch<PublishLogItem[]>(
          `/campaigns/${campaign.id}/publish-logs`,
          { token },
        );
        setPublishLogs(logs);
      } catch { /* empty */ }
    }
    loadLogs();
  }, [campaign.id, token]);

  async function handlePreparePublish() {
    setPublishing(true);
    try {
      await apiFetch(`/campaigns/${campaign.id}/prepare-publish`, {
        method: "POST",
        token,
        body: JSON.stringify({}),
      });
      onUpdated();
    } catch { /* ignore */ } finally {
      setPublishing(false);
    }
  }

  async function handleRetryPublish(logId: string) {
    try {
      await apiFetch(`/publish-logs/${logId}/retry`, {
        method: "POST",
        token,
      });
      onUpdated();
    } catch { /* ignore */ }
  }

  async function handleApprove() {
    setApproving(true);
    try {
      // Find the pending approval for this campaign
      const approvals = await apiFetch<ApprovalItem[]>(
        `/businesses/${businessId}/approvals?status=PENDING`,
        { token },
      );
      const match = approvals.find(
        (a) =>
          a.action?.type === "CAMPAIGN_DRAFT" &&
          (a.action?.payload as Record<string, string> | null)?.campaign_id === campaign.id,
      );
      if (match) {
        await apiFetch(`/approvals/${match.id}/approve`, {
          method: "POST",
          token,
        });
        setApproved(true);
        onUpdated();
      }
    } catch { /* ignore */ } finally {
      setApproving(false);
    }
  }

  return (
    <section className="mb-6 rounded-lg border border-indigo-800 bg-gray-900 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-indigo-300">{t("campaignDetail")}</h3>
        <button onClick={onClose} className="text-xs text-gray-500 hover:text-gray-300">
          {tc("cancel")}
        </button>
      </div>

      {editing ? (
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-gray-400">{t("campaignName")}</label>
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-400">Draft JSON</label>
            <textarea
              value={editDraft}
              onChange={(e) => setEditDraft(e.target.value)}
              rows={12}
              className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 font-mono text-xs focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setEditing(false)}
              className="rounded-lg border border-gray-700 px-4 py-1.5 text-xs text-gray-400 hover:bg-gray-800"
            >
              {tc("cancel")}
            </button>
            {saved ? (
              <span className="py-1.5 text-xs text-emerald-400">{t("draftSaved")}</span>
            ) : (
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-lg bg-indigo-700 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-600 disabled:opacity-50"
              >
                {saving ? t("saving") : t("saveDraft")}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center gap-2">
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${STATUS_COLORS[campaign.status] || "bg-gray-800 text-gray-400"}`}>
              {statusLabel(campaign.status, t)}
            </span>
            <p className="text-sm font-medium">{campaign.name}</p>
          </div>

          {draft && (
            <>
              {/* Objective & Budget */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded border border-gray-800 bg-gray-950 px-3 py-2">
                  <p className="text-[10px] uppercase text-gray-500">{t("objective")}</p>
                  <p className="text-sm font-medium">{draft.objective}</p>
                </div>
                <div className="rounded border border-gray-800 bg-gray-950 px-3 py-2">
                  <p className="text-[10px] uppercase text-gray-500">{t("platform")}</p>
                  <p className="text-sm font-medium capitalize">{draft.platform}</p>
                </div>
                <div className="rounded border border-gray-800 bg-gray-950 px-3 py-2">
                  <p className="text-[10px] uppercase text-gray-500">{t("budgetSuggestion")}</p>
                  <p className="text-sm font-medium">${draft.budget_suggestion}/day</p>
                </div>
              </div>

              {/* Audience */}
              <div className="rounded border border-gray-800 bg-gray-950 px-3 py-2">
                <p className="text-[10px] uppercase text-gray-500">{t("audienceSummary")}</p>
                <p className="text-xs text-gray-400">{draft.audience_summary}</p>
              </div>

              {/* Targeting */}
              <div className="rounded border border-gray-800 bg-gray-950 px-3 py-2">
                <p className="mb-1 text-[10px] uppercase text-gray-500">{t("targeting")}</p>
                <div className="flex flex-wrap gap-1">
                  {draft.targeting_suggestions.map((s, i) => (
                    <span key={i} className="rounded bg-gray-800 px-2 py-0.5 text-[10px] text-gray-400">
                      {s}
                    </span>
                  ))}
                </div>
              </div>

              {/* Creatives */}
              <div>
                <p className="mb-2 text-[10px] uppercase text-gray-500">{t("creatives")}</p>
                <div className="space-y-2">
                  {draft.creatives.map((c) => (
                    <div key={c.variant} className="rounded border border-gray-800 bg-gray-950 px-3 py-2">
                      <div className="mb-1 flex items-center gap-2">
                        <span className="rounded bg-indigo-900 px-1.5 py-0.5 text-[10px] text-indigo-300">
                          {t("variant")} {c.variant}
                        </span>
                        <span className="rounded bg-gray-800 px-1.5 py-0.5 text-[10px] text-gray-400">
                          {t("cta")}: {c.cta}
                        </span>
                      </div>
                      <p className="text-sm font-medium">{c.headline}</p>
                      <p className="mt-0.5 text-xs text-gray-400">{c.primary_text}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* UTM */}
              <div className="rounded border border-gray-800 bg-gray-950 px-3 py-2">
                <p className="mb-1 text-[10px] uppercase text-gray-500">{t("utmPlan")}</p>
                <div className="flex flex-wrap gap-2 text-xs text-gray-400">
                  {Object.entries(draft.utm).map(([k, v]) => (
                    <span key={k} className="rounded bg-gray-800 px-2 py-0.5">
                      {k}={v}
                    </span>
                  ))}
                </div>
              </div>

              {/* Schedule */}
              <div className="rounded border border-gray-800 bg-gray-950 px-3 py-2">
                <p className="mb-1 text-[10px] uppercase text-gray-500">{t("schedule")}</p>
                <p className="text-xs text-gray-400">
                  Start: {draft.schedule_suggestion.start} | Duration: {draft.schedule_suggestion.duration_days} days | Budget: ${draft.schedule_suggestion.daily_budget}/day
                </p>
              </div>
            </>
          )}

          {/* Action buttons */}
          <div className="flex gap-2">
            {campaign.status === "DRAFT" && (
              <>
                <button
                  onClick={() => setEditing(true)}
                  className="rounded-lg border border-gray-700 px-4 py-1.5 text-xs text-gray-400 hover:bg-gray-800"
                >
                  {t("editDraft")}
                </button>
                {approved ? (
                  <span className="py-1.5 text-xs text-emerald-400">{t("statusExecuted")}</span>
                ) : (
                  <button
                    onClick={handleApprove}
                    disabled={approving}
                    className="rounded-lg bg-green-800 px-4 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    {approving ? tc("loading") : t("approve")}
                  </button>
                )}
              </>
            )}
            {(campaign.status === "EXECUTED" || campaign.status === "APPROVED" || campaign.status === "PUBLISH_FAILED") && (
              <button
                onClick={handlePreparePublish}
                disabled={publishing}
                className="rounded-lg bg-purple-800 px-4 py-1.5 text-xs font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
              >
                {publishing ? tc("loading") : t("prepareForMeta")}
              </button>
            )}
            {campaign.status === "READY_TO_PUBLISH" && (
              <span className="rounded bg-purple-900 px-3 py-1.5 text-xs text-purple-300">
                {t("statusReadyToPublish")}
              </span>
            )}
            {campaign.status === "PUBLISH_PENDING" && (
              <span className="rounded bg-orange-900 px-3 py-1.5 text-xs text-orange-300">
                {t("statusPublishPending")}
              </span>
            )}
            {campaign.status === "PUBLISHED" && (
              <span className="rounded bg-emerald-900 px-3 py-1.5 text-xs text-emerald-300">
                {t("statusPublished")}
              </span>
            )}
          </div>

          {/* Publish Logs */}
          {publishLogs.length > 0 && (
            <div>
              <p className="mb-2 text-[10px] uppercase text-gray-500">{t("publishLogs")}</p>
              <div className="space-y-2">
                {publishLogs.map((log) => (
                  <div key={log.id} className="flex items-center justify-between rounded border border-gray-800 bg-gray-950 px-3 py-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium capitalize">{log.platform}</span>
                        <span className={`text-[10px] ${log.status === "PUBLISHED" ? "text-emerald-400" : log.status === "FAILED" ? "text-red-400" : "text-yellow-400"}`}>
                          {log.status}
                        </span>
                      </div>
                      {log.external_id && (
                        <p className="mt-0.5 text-[10px] text-gray-500">ID: {log.external_id}</p>
                      )}
                      {log.error_message && (
                        <p className="mt-0.5 text-[10px] text-red-400">{log.error_message}</p>
                      )}
                      <p className="mt-0.5 text-[10px] text-gray-600">
                        {new Date(log.created_at).toLocaleString()}
                      </p>
                    </div>
                    {log.status === "FAILED" && (
                      <button
                        onClick={() => handleRetryPublish(log.id)}
                        className="rounded border border-gray-700 px-2 py-1 text-[10px] text-gray-400 hover:bg-gray-800"
                      >
                        {t("retryPublish")}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
