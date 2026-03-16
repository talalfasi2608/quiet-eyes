"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { useRouter } from "@/i18n/navigation";
import Topbar from "@/components/Topbar";

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

const REC_TYPE_COLORS: Record<string, string> = {
  BUDGET_CHANGE: "bg-green-900 text-green-300",
  CREATIVE_CHANGE: "bg-purple-900 text-purple-300",
  AUDIENCE_REFINEMENT: "bg-blue-900 text-blue-300",
  APPROVAL_THRESHOLD: "bg-yellow-900 text-yellow-300",
  AUTOPILOT_TUNING: "bg-red-900 text-red-300",
  PLAYBOOK_SUGGESTION: "bg-indigo-900 text-indigo-300",
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
    <div className="flex h-screen flex-col">
      <Topbar />
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-4xl">
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push(`/dashboard/${businessId}`)}
                className="rounded border border-gray-700 px-2 py-1 text-xs text-gray-400 hover:bg-gray-800"
              >
                {tc("back")}
              </button>
              <h1 className="text-lg font-semibold">{t("playbooksPage")}</h1>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleRunOptimization}
                disabled={optimizing}
                className="rounded-lg bg-emerald-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {optimizing ? tc("loading") : t("runOptimization")}
              </button>
              <button
                onClick={() => setShowCreateForm(!showCreateForm)}
                className="rounded-lg bg-indigo-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-600"
              >
                {t("createPlaybook")}
              </button>
            </div>
          </div>

          {loading ? (
            <p className="py-8 text-center text-sm text-gray-500">{tc("loading")}</p>
          ) : (
            <>
              {/* Vertical Template Selection */}
              <section className="mb-6">
                <h2 className="mb-3 text-sm font-semibold text-gray-400">{t("verticalTemplate")}</h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {templates.map((tpl) => (
                    <button
                      key={tpl.slug}
                      onClick={() => handleAssignTemplate(tpl.slug)}
                      className={`rounded-lg border p-3 text-left transition ${
                        currentTemplate === tpl.slug
                          ? "border-indigo-500 bg-indigo-950"
                          : "border-gray-800 bg-gray-900 hover:border-gray-700"
                      }`}
                    >
                      <p className="text-sm font-medium">{tpl.name}</p>
                      <p className="mt-1 text-[10px] text-gray-500">{tpl.description.slice(0, 80)}</p>
                      {currentTemplate === tpl.slug && (
                        <span className="mt-2 inline-block rounded bg-indigo-800 px-1.5 py-0.5 text-[10px] text-indigo-300">
                          {t("activeTemplate")}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </section>

              {/* Optimization Recommendations */}
              {recommendations.length > 0 && (
                <section className="mb-6">
                  <h2 className="mb-3 text-sm font-semibold text-gray-400">{t("optimizationRecommendations")}</h2>
                  <div className="space-y-2">
                    {recommendations.map((rec) => (
                      <div key={rec.id} className="rounded-lg border border-gray-800 bg-gray-900 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <div className="mb-1 flex items-center gap-2">
                              <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${REC_TYPE_COLORS[rec.type] || "bg-gray-800 text-gray-400"}`}>
                                {rec.type.replace(/_/g, " ")}
                              </span>
                              <span className="text-[10px] text-gray-500">{rec.confidence}% {t("confidenceLabel")}</span>
                            </div>
                            <p className="text-sm font-medium">{rec.title}</p>
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
                            <button
                              onClick={() => handleRecommendationAction(rec.id, "apply")}
                              className="rounded bg-emerald-800 px-2 py-1 text-[10px] font-medium text-white hover:bg-emerald-700"
                            >
                              {t("applyRec")}
                            </button>
                            <button
                              onClick={() => handleRecommendationAction(rec.id, "save")}
                              className="rounded border border-gray-700 px-2 py-1 text-[10px] text-gray-400 hover:bg-gray-800"
                            >
                              {t("saveForLater")}
                            </button>
                            <button
                              onClick={() => handleRecommendationAction(rec.id, "dismiss")}
                              className="rounded border border-gray-700 px-2 py-1 text-[10px] text-gray-500 hover:bg-gray-800"
                            >
                              {t("dismissRec")}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Create Playbook Form */}
              {showCreateForm && (
                <section className="mb-6 rounded-lg border border-indigo-800 bg-gray-900 p-4">
                  <h3 className="mb-3 text-sm font-semibold text-indigo-300">{t("createPlaybook")}</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-xs text-gray-400">{t("playbookName")}</label>
                      <input
                        value={pbName}
                        onChange={(e) => setPbName(e.target.value)}
                        className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                        placeholder={t("playbookNamePlaceholder")}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-gray-400">{t("playbookDescription")}</label>
                      <textarea
                        value={pbDesc}
                        onChange={(e) => setPbDesc(e.target.value)}
                        rows={2}
                        className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                        placeholder={t("playbookDescPlaceholder")}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-gray-400">{t("approvalPolicy")}</label>
                      <div className="flex gap-2">
                        {["AUTO", "REVIEW", "MANUAL"].map((p) => (
                          <button
                            key={p}
                            onClick={() => setPbPolicy(p)}
                            className={`rounded-lg px-3 py-1.5 text-xs ${pbPolicy === p ? "bg-indigo-800 text-indigo-200" : "bg-gray-800 text-gray-500"}`}
                          >
                            {p === "AUTO" ? t("policyAuto") : p === "REVIEW" ? t("policyReview") : t("policyManual")}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowCreateForm(false)}
                        className="rounded-lg border border-gray-700 px-4 py-1.5 text-xs text-gray-400 hover:bg-gray-800"
                      >
                        {tc("cancel")}
                      </button>
                      <button
                        onClick={handleCreatePlaybook}
                        disabled={creating || !pbName.trim()}
                        className="rounded-lg bg-indigo-700 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-600 disabled:opacity-50"
                      >
                        {creating ? tc("loading") : tc("save")}
                      </button>
                    </div>
                  </div>
                </section>
              )}

              {/* Playbook List */}
              <section>
                <h2 className="mb-3 text-sm font-semibold text-gray-400">{t("activePlaybooks")}</h2>
                {playbooks.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-gray-800 px-4 py-12 text-center text-xs text-gray-600">
                    {t("noPlaybooks")}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {playbooks.map((pb) => (
                      <div key={pb.id} className="rounded-lg border border-gray-800 bg-gray-900 p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium">{pb.name}</p>
                              {pb.approval_policy && (
                                <span className="rounded bg-gray-800 px-1.5 py-0.5 text-[10px] text-gray-400">
                                  {pb.approval_policy}
                                </span>
                              )}
                            </div>
                            {pb.description && (
                              <p className="mt-0.5 text-xs text-gray-500">{pb.description}</p>
                            )}
                            {pb.suggested_actions && pb.suggested_actions.length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {pb.suggested_actions.map((a, i) => (
                                  <span key={i} className="rounded bg-gray-800 px-1.5 py-0.5 text-[10px] text-gray-400">
                                    {a}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => handleTogglePlaybook(pb)}
                            className={`rounded px-2 py-1 text-[10px] font-medium ${
                              pb.is_active ? "bg-green-900 text-green-300" : "bg-red-900 text-red-300"
                            }`}
                          >
                            {pb.is_active ? t("enabled") : t("disabled")}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
