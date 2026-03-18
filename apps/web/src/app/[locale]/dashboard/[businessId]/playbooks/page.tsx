"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { useRouter } from "@/i18n/navigation";
import { PageHeader, Card, Button, SectionHeader, Badge, EmptyState, Input, Textarea } from "@/components/ui";

interface PlaybookItem {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  trigger_conditions: Record<string, unknown> | null;
  suggested_actions: string[] | null;
  approval_policy: string | null;
  campaign_template: Record<string, unknown> | null;
  audience_template: Record<string, unknown> | null;
  is_active: boolean;
  created_at: string;
}

interface VerticalTemplate {
  slug: string;
  name: string;
  description: string;
  source_rules: string[];
  keywords: string[];
  trend_keywords: string[];
  audience_hints: Record<string, unknown>;
  campaign_tone: string;
}

interface Recommendation {
  id: string;
  business_id: string;
  type: string;
  title: string;
  description: string | null;
  current_value: string | null;
  suggested_value: string | null;
  confidence: number;
  impact_estimate: string | null;
  reasoning: string | null;
  status: string;
  created_at: string;
}

interface BusinessInfo {
  vertical_template: string | null;
}

const REC_TYPE_BADGE: Record<string, "default" | "success" | "warning" | "error" | "info"> = {
  BUDGET_CHANGE: "success",
  CREATIVE_CHANGE: "default",
  AUDIENCE_REFINEMENT: "info",
  APPROVAL_THRESHOLD: "warning",
  AUTOPILOT_TUNING: "error",
  PLAYBOOK_SUGGESTION: "info",
};

export default function PlaybooksPage() {
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const router = useRouter();
  const { businessId } = useParams<{ businessId: string }>();
  const token = getToken();

  const [playbooks, setPlaybooks] = useState<PlaybookItem[]>([]);
  const [templates, setTemplates] = useState<VerticalTemplate[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [currentTemplate, setCurrentTemplate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [optimizing, setOptimizing] = useState(false);

  // Create form state
  const [pbName, setPbName] = useState("");
  const [pbDesc, setPbDesc] = useState("");
  const [pbPolicy, setPbPolicy] = useState("REVIEW");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!token) router.push("/login");
  }, [token, router]);

  const loadData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [pbs, tpls, recs, biz] = await Promise.all([
        apiFetch<PlaybookItem[]>(`/businesses/${businessId}/playbooks`, { token }),
        apiFetch<VerticalTemplate[]>("/vertical-templates", { token }),
        apiFetch<Recommendation[]>(`/businesses/${businessId}/recommendations?status=PENDING`, { token }),
        apiFetch<BusinessInfo>(`/businesses/${businessId}`, { token }),
      ]);
      setPlaybooks(pbs);
      setTemplates(tpls);
      setRecommendations(recs);
      setCurrentTemplate(biz.vertical_template);
    } catch { /* empty */ } finally {
      setLoading(false);
    }
  }, [businessId, token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleAssignTemplate(slug: string) {
    if (!token) return;
    try {
      await apiFetch(`/businesses/${businessId}/vertical-template?slug=${slug}`, {
        method: "POST",
        token,
      });
      setCurrentTemplate(slug);
    } catch { /* ignore */ }
  }

  async function handleCreatePlaybook() {
    if (!token || !pbName.trim()) return;
    setCreating(true);
    try {
      await apiFetch(`/businesses/${businessId}/playbooks`, {
        method: "POST",
        token,
        body: JSON.stringify({
          name: pbName.trim(),
          description: pbDesc.trim() || null,
          approval_policy: pbPolicy,
        }),
      });
      setPbName("");
      setPbDesc("");
      setShowCreateForm(false);
      loadData();
    } catch { /* ignore */ } finally {
      setCreating(false);
    }
  }

  async function handleRunOptimization() {
    if (!token) return;
    setOptimizing(true);
    try {
      await apiFetch(`/businesses/${businessId}/optimize`, {
        method: "POST",
        token,
      });
      loadData();
    } catch { /* ignore */ } finally {
      setOptimizing(false);
    }
  }

  async function handleRecommendationAction(recId: string, action: string) {
    if (!token) return;
    try {
      await apiFetch(`/recommendations/${recId}/action`, {
        method: "POST",
        token,
        body: JSON.stringify({ action }),
      });
      loadData();
    } catch { /* ignore */ }
  }

  async function handleTogglePlaybook(pb: PlaybookItem) {
    if (!token) return;
    try {
      await apiFetch(`/playbooks/${pb.id}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ is_active: !pb.is_active }),
      });
      loadData();
    } catch { /* ignore */ }
  }

  if (!token) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("playbooksPage")}
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={handleRunOptimization} loading={optimizing}>
              {optimizing ? tc("loading") : t("runOptimization")}
            </Button>
            <Button size="sm" onClick={() => setShowCreateForm(!showCreateForm)}>
              {t("createPlaybook")}
            </Button>
          </div>
        }
      />

      {loading ? (
        <p className="py-8 text-center text-sm text-gray-500">{tc("loading")}</p>
      ) : (
        <>
          {/* Vertical Template Selection */}
          <SectionHeader title={t("verticalTemplate")} />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {templates.map((tpl) => (
              <Card
                key={tpl.slug}
                hover
                onClick={() => handleAssignTemplate(tpl.slug)}
                className={currentTemplate === tpl.slug ? "!border-gray-600 ring-1 ring-white/10" : ""}
              >
                <p className="text-sm font-medium text-gray-100">{tpl.name}</p>
                <p className="mt-1 text-[10px] text-gray-500">{tpl.description.slice(0, 80)}</p>
                {currentTemplate === tpl.slug && (
                  <Badge variant="info" className="mt-2">{t("activeTemplate")}</Badge>
                )}
              </Card>
            ))}
          </div>

          {/* Optimization Recommendations */}
          {recommendations.length > 0 && (
            <>
              <SectionHeader title={t("optimizationRecommendations")} />
              <div className="space-y-2">
                {recommendations.map((rec) => (
                  <Card key={rec.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="mb-1 flex items-center gap-2">
                          <Badge variant={REC_TYPE_BADGE[rec.type] || "default"}>
                            {rec.type.replace(/_/g, " ")}
                          </Badge>
                          <span className="text-[10px] text-gray-500">{rec.confidence}% {t("confidenceLabel")}</span>
                        </div>
                        <p className="text-sm font-medium text-gray-100">{rec.title}</p>
                        {rec.description && (
                          <p className="mt-1 text-xs text-gray-400">{rec.description}</p>
                        )}
                        <div className="mt-2 flex gap-4 text-xs">
                          {rec.current_value && (
                            <span className="text-gray-500">{t("currentValue")}: {rec.current_value}</span>
                          )}
                          {rec.suggested_value && (
                            <span className="text-emerald-400">{t("suggestedValue")}: {rec.suggested_value}</span>
                          )}
                        </div>
                        {rec.impact_estimate && (
                          <p className="mt-1 text-[10px] text-gray-500">{t("impact")}: {rec.impact_estimate}</p>
                        )}
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button size="sm" onClick={() => handleRecommendationAction(rec.id, "apply")}>
                          {t("applyRec")}
                        </Button>
                        <Button variant="secondary" size="sm" onClick={() => handleRecommendationAction(rec.id, "save")}>
                          {t("saveForLater")}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleRecommendationAction(rec.id, "dismiss")}>
                          {t("dismissRec")}
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </>
          )}

          {/* Create Playbook Form */}
          {showCreateForm && (
            <Card>
              <h3 className="mb-3 text-sm font-semibold text-gray-100">{t("createPlaybook")}</h3>
              <div className="space-y-3">
                <Input
                  label={t("playbookName")}
                  value={pbName}
                  onChange={(e) => setPbName(e.target.value)}
                  placeholder={t("playbookNamePlaceholder")}
                />
                <Textarea
                  label={t("playbookDescription")}
                  value={pbDesc}
                  onChange={(e) => setPbDesc(e.target.value)}
                  rows={2}
                  placeholder={t("playbookDescPlaceholder")}
                />
                <div>
                  <label className="mb-1 block text-xs text-gray-400">{t("approvalPolicy")}</label>
                  <div className="flex gap-2">
                    {["AUTO", "REVIEW", "MANUAL"].map((p) => (
                      <Button
                        key={p}
                        variant={pbPolicy === p ? "primary" : "secondary"}
                        size="sm"
                        onClick={() => setPbPolicy(p)}
                      >
                        {p === "AUTO" ? t("policyAuto") : p === "REVIEW" ? t("policyReview") : t("policyManual")}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setShowCreateForm(false)}>
                    {tc("cancel")}
                  </Button>
                  <Button size="sm" onClick={handleCreatePlaybook} loading={creating} disabled={!pbName.trim()}>
                    {creating ? tc("loading") : tc("save")}
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* Playbook List */}
          <SectionHeader title={t("activePlaybooks")} />
          {playbooks.length === 0 ? (
            <EmptyState title={t("noPlaybooks")} />
          ) : (
            <div className="space-y-2">
              {playbooks.map((pb) => (
                <Card key={pb.id}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-100">{pb.name}</p>
                        {pb.approval_policy && (
                          <Badge variant="default">{pb.approval_policy}</Badge>
                        )}
                      </div>
                      {pb.description && (
                        <p className="mt-0.5 text-xs text-gray-500">{pb.description}</p>
                      )}
                      {pb.suggested_actions && pb.suggested_actions.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {pb.suggested_actions.map((a, i) => (
                            <Badge key={i} variant="default">{a}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <Badge
                      variant={pb.is_active ? "success" : "error"}
                      className="cursor-pointer"
                      onClick={() => handleTogglePlaybook(pb)}
                    >
                      {pb.is_active ? t("enabled") : t("disabled")}
                    </Badge>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
