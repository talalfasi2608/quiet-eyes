"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { useRouter } from "@/i18n/navigation";
import { PageHeader, Card, Badge, Button, Tabs, Modal, Input, Textarea } from "@/components/ui";

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

const STATUS_BADGE_VARIANT: Record<string, "default" | "success" | "warning" | "error" | "info"> = {
  DRAFT: "warning",
  APPROVED: "info",
  EXECUTED: "success",
  READY_TO_PUBLISH: "info",
  PUBLISH_PENDING: "warning",
  PUBLISHED: "success",
  PUBLISH_FAILED: "error",
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
    <div className="space-y-6">
      <PageHeader
        title={t("campaignsPage")}
        actions={
          <Button
            variant="primary"
            size="sm"
            onClick={() => { setShowCreateForm(!showCreateForm); setSelectedCampaign(null); }}
          >
            {t("createCampaignDraft")}
          </Button>
        }
      />

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
            <Card
              key={c.id}
              hover
              onClick={() => { setSelectedCampaign(c); setShowCreateForm(false); }}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="mb-1 flex items-center gap-2">
                    <Badge variant={STATUS_BADGE_VARIANT[c.status] || "default"}>
                      {statusLabel(c.status, t)}
                    </Badge>
                    {c.draft && (
                      <Badge variant="default">{c.draft.platform}</Badge>
                    )}
                  </div>
                  <p className="text-sm font-medium text-gray-100">{c.name}</p>
                  {c.draft && (
                    <div className="mt-1 flex gap-3 text-xs text-gray-500">
                      <span>{t("objective")}: {c.draft.objective}</span>
                      <span>{t("budgetSuggestion")}: ${c.draft.budget_suggestion}/day</span>
                      <span>{t("creatives")}: {c.draft.creatives.length}</span>
                    </div>
                  )}
                </div>
                <span className="text-xs text-gray-500">
                  {new Date(c.created_at).toLocaleDateString()}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}
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

  const sourceTabs = [
    { key: "audience", label: t("sourceAudience") },
    { key: "manual", label: t("sourceManual") },
  ];

  return (
    <Modal open title={t("createCampaignDraft")} onClose={onClose}>
      <div className="space-y-4">
        {/* Source type */}
        <Tabs tabs={sourceTabs} active={sourceType} onChange={(k) => setSourceType(k as "audience" | "manual")} />

        {sourceType === "audience" && (
          <div>
            <label className="mb-1 block text-xs text-gray-400">{t("audienceSegments")}</label>
            <select
              value={audienceId}
              onChange={(e) => setAudienceId(e.target.value)}
              className="w-full rounded-lg border border-gray-700/50 bg-gray-900 px-3 py-2.5 text-sm text-gray-100 focus:border-gray-500 focus:ring-1 focus:ring-gray-500/30 focus:outline-none"
            >
              <option value="">Select audience...</option>
              {audiences.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
        )}

        {sourceType === "manual" && (
          <Textarea
            label={t("sourceManual")}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={t("manualPromptPlaceholder")}
            rows={2}
          />
        )}

        {/* Platform */}
        <div>
          <label className="mb-1 block text-xs text-gray-400">{t("platform")}</label>
          <div className="flex gap-2">
            {PLATFORMS.map((p) => (
              <Button
                key={p}
                variant={platform === p ? "primary" : "secondary"}
                size="sm"
                onClick={() => setPlatform(p)}
                className="capitalize"
              >
                {p}
              </Button>
            ))}
          </div>
        </div>

        {/* Objective */}
        <div>
          <label className="mb-1 block text-xs text-gray-400">{t("objective")}</label>
          <div className="flex gap-2">
            {OBJECTIVES.map((o) => (
              <Button
                key={o}
                variant={objective === o ? "primary" : "secondary"}
                size="sm"
                onClick={() => setObjective(o)}
              >
                {o === "LEADS" ? t("objectiveLeads") : o === "SALES" ? t("objectiveSales") : t("objectiveTraffic")}
              </Button>
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
          <Button onClick={handleCreate} loading={creating}>
            {creating ? t("creatingCampaign") : t("createCampaignDraft")}
          </Button>
        )}
      </div>
    </Modal>
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
    <Modal open title={t("campaignDetail")} onClose={onClose}>
      {editing ? (
        <div className="space-y-3">
          <Input
            label={t("campaignName")}
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
          />
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-300">Draft JSON</label>
            <textarea
              value={editDraft}
              onChange={(e) => setEditDraft(e.target.value)}
              rows={12}
              className="w-full rounded-lg border border-gray-700/50 bg-gray-900 px-3 py-2.5 font-mono text-xs text-gray-100 focus:border-gray-500 focus:ring-1 focus:ring-gray-500/30 focus:outline-none"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setEditing(false)}>
              {tc("cancel")}
            </Button>
            {saved ? (
              <span className="py-1.5 text-xs text-emerald-400">{t("draftSaved")}</span>
            ) : (
              <Button size="sm" onClick={handleSave} loading={saving}>
                {saving ? t("saving") : t("saveDraft")}
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center gap-2">
            <Badge variant={STATUS_BADGE_VARIANT[campaign.status] || "default"}>
              {statusLabel(campaign.status, t)}
            </Badge>
            <p className="text-sm font-medium text-gray-100">{campaign.name}</p>
          </div>

          {draft && (
            <>
              {/* Objective & Budget */}
              <div className="grid grid-cols-3 gap-3">
                <Card className="!p-3">
                  <p className="text-[10px] uppercase text-gray-500">{t("objective")}</p>
                  <p className="text-sm font-medium text-gray-100">{draft.objective}</p>
                </Card>
                <Card className="!p-3">
                  <p className="text-[10px] uppercase text-gray-500">{t("platform")}</p>
                  <p className="text-sm font-medium capitalize text-gray-100">{draft.platform}</p>
                </Card>
                <Card className="!p-3">
                  <p className="text-[10px] uppercase text-gray-500">{t("budgetSuggestion")}</p>
                  <p className="text-sm font-medium text-gray-100">${draft.budget_suggestion}/day</p>
                </Card>
              </div>

              {/* Audience */}
              <Card className="!p-3">
                <p className="text-[10px] uppercase text-gray-500">{t("audienceSummary")}</p>
                <p className="text-xs text-gray-400">{draft.audience_summary}</p>
              </Card>

              {/* Targeting */}
              <Card className="!p-3">
                <p className="mb-1 text-[10px] uppercase text-gray-500">{t("targeting")}</p>
                <div className="flex flex-wrap gap-1">
                  {draft.targeting_suggestions.map((s, i) => (
                    <Badge key={i} variant="default">{s}</Badge>
                  ))}
                </div>
              </Card>

              {/* Creatives */}
              <div>
                <p className="mb-2 text-[10px] uppercase text-gray-500">{t("creatives")}</p>
                <div className="space-y-2">
                  {draft.creatives.map((c) => (
                    <Card key={c.variant} className="!p-3">
                      <div className="mb-1 flex items-center gap-2">
                        <Badge variant="info">{t("variant")} {c.variant}</Badge>
                        <Badge variant="default">{t("cta")}: {c.cta}</Badge>
                      </div>
                      <p className="text-sm font-medium text-gray-100">{c.headline}</p>
                      <p className="mt-0.5 text-xs text-gray-400">{c.primary_text}</p>
                    </Card>
                  ))}
                </div>
              </div>

              {/* UTM */}
              <Card className="!p-3">
                <p className="mb-1 text-[10px] uppercase text-gray-500">{t("utmPlan")}</p>
                <div className="flex flex-wrap gap-2 text-xs text-gray-400">
                  {Object.entries(draft.utm).map(([k, v]) => (
                    <Badge key={k} variant="default">{k}={v}</Badge>
                  ))}
                </div>
              </Card>

              {/* Schedule */}
              <Card className="!p-3">
                <p className="mb-1 text-[10px] uppercase text-gray-500">{t("schedule")}</p>
                <p className="text-xs text-gray-400">
                  Start: {draft.schedule_suggestion.start} | Duration: {draft.schedule_suggestion.duration_days} days | Budget: ${draft.schedule_suggestion.daily_budget}/day
                </p>
              </Card>
            </>
          )}

          {/* Action buttons */}
          <div className="flex gap-2">
            {campaign.status === "DRAFT" && (
              <>
                <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
                  {t("editDraft")}
                </Button>
                {approved ? (
                  <span className="py-1.5 text-xs text-emerald-400">{t("statusExecuted")}</span>
                ) : (
                  <Button size="sm" onClick={handleApprove} loading={approving} className="bg-green-800 text-white hover:bg-green-700">
                    {approving ? tc("loading") : t("approve")}
                  </Button>
                )}
              </>
            )}
            {(campaign.status === "EXECUTED" || campaign.status === "APPROVED" || campaign.status === "PUBLISH_FAILED") && (
              <Button size="sm" onClick={handlePreparePublish} loading={publishing} className="bg-purple-800 text-white hover:bg-purple-700">
                {publishing ? tc("loading") : t("prepareForMeta")}
              </Button>
            )}
            {campaign.status === "READY_TO_PUBLISH" && (
              <Badge variant="info">{t("statusReadyToPublish")}</Badge>
            )}
            {campaign.status === "PUBLISH_PENDING" && (
              <Badge variant="warning">{t("statusPublishPending")}</Badge>
            )}
            {campaign.status === "PUBLISHED" && (
              <Badge variant="success">{t("statusPublished")}</Badge>
            )}
          </div>

          {/* Publish Logs */}
          {publishLogs.length > 0 && (
            <div>
              <p className="mb-2 text-[10px] uppercase text-gray-500">{t("publishLogs")}</p>
              <div className="space-y-2">
                {publishLogs.map((log) => (
                  <Card key={log.id} className="!p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium capitalize text-gray-100">{log.platform}</span>
                          <Badge variant={log.status === "PUBLISHED" ? "success" : log.status === "FAILED" ? "error" : "warning"}>
                            {log.status}
                          </Badge>
                        </div>
                        {log.external_id && (
                          <p className="mt-0.5 text-[10px] text-gray-500">ID: {log.external_id}</p>
                        )}
                        {log.error_message && (
                          <p className="mt-0.5 text-[10px] text-red-400">{log.error_message}</p>
                        )}
                        <p className="mt-0.5 text-[10px] text-gray-500">
                          {new Date(log.created_at).toLocaleString()}
                        </p>
                      </div>
                      {log.status === "FAILED" && (
                        <Button variant="secondary" size="sm" onClick={() => handleRetryPublish(log.id)}>
                          {t("retryPublish")}
                        </Button>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
