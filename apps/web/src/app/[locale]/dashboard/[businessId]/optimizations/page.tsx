"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { useRouter } from "@/i18n/navigation";
import Topbar from "@/components/Topbar";

interface Recommendation {
  id: string;
  business_id: string;
  type: string;
  title: string;
  description: string | null;
  summary: string | null;
  current_value: string | null;
  suggested_value: string | null;
  confidence: number;
  impact_estimate: string | null;
  impact_score: number;
  reasoning: string | null;
  payload: Record<string, unknown> | null;
  status: string;
  created_at: string;
  decided_at: string | null;
}

interface AttributionRecord {
  id: string;
  signal_type: string;
  signal_id: string | null;
  action_id: string | null;
  approval_id: string | null;
  execution_type: string | null;
  execution_id: string | null;
  outcome_type: string | null;
  outcome_data: Record<string, unknown> | null;
  created_at: string;
}

interface LearningInsights {
  [key: string]: Array<{
    key: string;
    value: Record<string, unknown>;
    sample_size: number;
    computed_at: string | null;
  }>;
}

const REC_TYPE_COLORS: Record<string, string> = {
  BUDGET_CHANGE: "bg-green-900 text-green-300",
  CREATIVE_CHANGE: "bg-purple-900 text-purple-300",
  AUDIENCE_REFINEMENT: "bg-blue-900 text-blue-300",
  APPROVAL_THRESHOLD: "bg-yellow-900 text-yellow-300",
  AUTOPILOT_TUNING: "bg-red-900 text-red-300",
  PLAYBOOK_SUGGESTION: "bg-indigo-900 text-indigo-300",
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-amber-900 text-amber-300",
  NEW: "bg-cyan-900 text-cyan-300",
  APPLIED: "bg-green-900 text-green-300",
  DISMISSED: "bg-gray-800 text-gray-500",
  SAVED: "bg-blue-900 text-blue-300",
  EXPIRED: "bg-gray-800 text-gray-600",
};

type TabId = "recommendations" | "attribution" | "insights";

export default function OptimizationsPage() {
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const router = useRouter();
  const { businessId } = useParams<{ businessId: string }>();
  const token = getToken();

  const [activeTab, setActiveTab] = useState<TabId>("recommendations");
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [attributionRecords, setAttributionRecords] = useState<AttributionRecord[]>([]);
  const [learningInsights, setLearningInsights] = useState<LearningInsights>({});
  const [loading, setLoading] = useState(true);
  const [optimizing, setOptimizing] = useState(false);
  const [statusFilter, setStatusFilter] = useState("PENDING");

  useEffect(() => {
    if (!token) router.push("/login");
  }, [token, router]);

  const loadData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      if (activeTab === "recommendations") {
        const url = statusFilter
          ? `/businesses/${businessId}/optimizations?status=${statusFilter}`
          : `/businesses/${businessId}/optimizations`;
        const data = await apiFetch<Recommendation[]>(url, { token });
        setRecommendations(data);
      } else if (activeTab === "attribution") {
        const data = await apiFetch<AttributionRecord[]>(
          `/businesses/${businessId}/attribution?limit=50`,
          { token },
        );
        setAttributionRecords(data);
      } else {
        const data = await apiFetch<LearningInsights>(
          `/businesses/${businessId}/learning-insights`,
          { token },
        );
        setLearningInsights(data);
      }
    } catch { /* empty */ } finally {
      setLoading(false);
    }
  }, [businessId, token, activeTab, statusFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleRunOptimize() {
    if (!token) return;
    setOptimizing(true);
    try {
      await apiFetch(`/businesses/${businessId}/optimize-v2`, {
        method: "POST",
        token,
      });
      loadData();
    } catch { /* empty */ } finally {
      setOptimizing(false);
    }
  }

  async function handleAction(recId: string, action: "apply" | "dismiss" | "save") {
    if (!token) return;
    try {
      await apiFetch(`/optimizations/${recId}/${action}`, {
        method: "POST",
        token,
      });
      loadData();
    } catch { /* empty */ }
  }

  if (!token) return null;

  return (
    <div className="flex h-screen flex-col">
      <Topbar />
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-5xl">
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push(`/dashboard/${businessId}`)}
                className="rounded border border-gray-700 px-2 py-1 text-xs text-gray-400 hover:bg-gray-800"
              >
                {tc("back")}
              </button>
              <h1 className="text-lg font-semibold">{t("optimizationsPage")}</h1>
            </div>
            <button
              onClick={handleRunOptimize}
              disabled={optimizing}
              className="rounded-lg bg-emerald-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {optimizing ? tc("loading") : t("runOptimizeV2")}
            </button>
          </div>

          {/* Tabs */}
          <div className="mb-4 flex gap-1 border-b border-gray-800">
            {(
              [
                ["recommendations", t("optRecommendations")],
                ["attribution", t("optAttribution")],
                ["insights", t("optInsights")],
              ] as const
            ).map(([tab, label]) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as TabId)}
                className={`px-4 py-2 text-sm font-medium ${activeTab === tab ? "border-b-2 border-white text-white" : "text-gray-500 hover:text-gray-300"}`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Recommendations Tab */}
          {activeTab === "recommendations" && (
            <>
              {/* Status filter */}
              <div className="mb-4 flex gap-1">
                {["PENDING", "NEW", "APPLIED", "DISMISSED", "SAVED", ""].map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`rounded px-2 py-1 text-[10px] ${
                      statusFilter === s
                        ? "bg-white text-black"
                        : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                    }`}
                  >
                    {s || t("optAll")}
                  </button>
                ))}
              </div>

              {loading ? (
                <p className="py-8 text-center text-sm text-gray-500">{tc("loading")}</p>
              ) : recommendations.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-800 px-4 py-12 text-center text-xs text-gray-600">
                  {t("noOptimizations")}
                </div>
              ) : (
                <div className="space-y-3">
                  {recommendations.map((rec) => (
                    <div key={rec.id} className="rounded-lg border border-gray-800 bg-gray-900 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          {/* Badges */}
                          <div className="mb-2 flex items-center gap-2">
                            <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${REC_TYPE_COLORS[rec.type] || "bg-gray-800 text-gray-400"}`}>
                              {rec.type.replace(/_/g, " ")}
                            </span>
                            <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${STATUS_COLORS[rec.status] || "bg-gray-800 text-gray-400"}`}>
                              {rec.status}
                            </span>
                            <span className="text-[10px] text-gray-500">
                              {rec.confidence}% {t("confidenceLabel")}
                            </span>
                            {rec.impact_score > 0 && (
                              <span className="text-[10px] text-emerald-400">
                                {t("optImpact")}: {rec.impact_score}
                              </span>
                            )}
                          </div>

                          {/* Title & Summary */}
                          <p className="text-sm font-medium">{rec.title}</p>
                          {rec.summary && (
                            <p className="mt-1 text-xs text-indigo-300">{rec.summary}</p>
                          )}
                          {rec.description && (
                            <p className="mt-1 text-xs text-gray-400">{rec.description}</p>
                          )}

                          {/* Current → Suggested */}
                          <div className="mt-2 flex gap-4 text-xs">
                            {rec.current_value && (
                              <span className="text-gray-500">{t("currentValue")}: {rec.current_value}</span>
                            )}
                            {rec.suggested_value && (
                              <span className="text-emerald-400">{t("suggestedValue")}: {rec.suggested_value}</span>
                            )}
                          </div>

                          {/* Reasoning */}
                          {rec.reasoning && (
                            <p className="mt-2 text-[10px] text-gray-500">
                              {t("optWhyGenerated")}: {rec.reasoning}
                            </p>
                          )}

                          {rec.impact_estimate && (
                            <p className="mt-1 text-[10px] text-gray-500">{t("impact")}: {rec.impact_estimate}</p>
                          )}
                        </div>

                        {/* Actions */}
                        {(rec.status === "PENDING" || rec.status === "NEW" || rec.status === "SAVED") && (
                          <div className="flex shrink-0 flex-col gap-1">
                            <button
                              onClick={() => handleAction(rec.id, "apply")}
                              className="rounded bg-emerald-800 px-2 py-1 text-[10px] font-medium text-white hover:bg-emerald-700"
                            >
                              {t("applyRec")}
                            </button>
                            {rec.status !== "SAVED" && (
                              <button
                                onClick={() => handleAction(rec.id, "save")}
                                className="rounded border border-gray-700 px-2 py-1 text-[10px] text-gray-400 hover:bg-gray-800"
                              >
                                {t("saveForLater")}
                              </button>
                            )}
                            <button
                              onClick={() => handleAction(rec.id, "dismiss")}
                              className="rounded border border-gray-700 px-2 py-1 text-[10px] text-gray-500 hover:bg-gray-800"
                            >
                              {t("dismissRec")}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Attribution Tab */}
          {activeTab === "attribution" && (
            <>
              {loading ? (
                <p className="py-8 text-center text-sm text-gray-500">{tc("loading")}</p>
              ) : attributionRecords.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-800 px-4 py-12 text-center text-xs text-gray-600">
                  {t("noAttributionRecords")}
                </div>
              ) : (
                <div className="space-y-2">
                  {attributionRecords.map((ar) => (
                    <div key={ar.id} className="rounded-lg border border-gray-800 bg-gray-900 p-3">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="rounded bg-cyan-900 px-1.5 py-0.5 text-[10px] text-cyan-300">
                          {ar.signal_type}
                        </span>
                        <span className="text-gray-600">→</span>
                        {ar.execution_type && (
                          <>
                            <span className="rounded bg-indigo-900 px-1.5 py-0.5 text-[10px] text-indigo-300">
                              {ar.execution_type}
                            </span>
                            <span className="text-gray-600">→</span>
                          </>
                        )}
                        {ar.outcome_type ? (
                          <span className="rounded bg-emerald-900 px-1.5 py-0.5 text-[10px] text-emerald-300">
                            {ar.outcome_type}
                          </span>
                        ) : (
                          <span className="text-[10px] text-gray-600">{t("optPendingOutcome")}</span>
                        )}
                        <span className="ml-auto text-[10px] text-gray-600">
                          {new Date(ar.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      {ar.outcome_data && Object.keys(ar.outcome_data).length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-gray-500">
                          {Object.entries(ar.outcome_data).slice(0, 4).map(([k, v]) => (
                            <span key={k}>{k}: {String(v)}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Learning Insights Tab */}
          {activeTab === "insights" && (
            <>
              {loading ? (
                <p className="py-8 text-center text-sm text-gray-500">{tc("loading")}</p>
              ) : Object.keys(learningInsights).length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-800 px-4 py-12 text-center text-xs text-gray-600">
                  {t("noLearningInsights")}
                </div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(learningInsights).map(([type, items]) => (
                    <section key={type}>
                      <h3 className="mb-2 text-sm font-semibold text-gray-400">
                        {type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                      </h3>
                      <div className="space-y-1">
                        {items.map((item, i) => (
                          <div key={i} className="rounded-lg border border-gray-800 bg-gray-900 p-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium">{item.key}</span>
                              <span className="text-[10px] text-gray-500">
                                n={item.sample_size}
                              </span>
                            </div>
                            <div className="mt-1 flex flex-wrap gap-3 text-[10px] text-gray-400">
                              {Object.entries(item.value).slice(0, 6).map(([k, v]) => (
                                <span key={k}>
                                  {k}: <span className="text-gray-300">{typeof v === "number" ? (Number.isInteger(v) ? v : (v as number).toFixed(1)) : String(v)}</span>
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
