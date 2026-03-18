"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { useRouter } from "@/i18n/navigation";
import { PageHeader, Card, Button, Tabs, Badge, EmptyState, SectionHeader } from "@/components/ui";

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

const REC_TYPE_BADGE: Record<string, "default" | "success" | "warning" | "error" | "info"> = {
  BUDGET_CHANGE: "success",
  CREATIVE_CHANGE: "default",
  AUDIENCE_REFINEMENT: "info",
  APPROVAL_THRESHOLD: "warning",
  AUTOPILOT_TUNING: "error",
  PLAYBOOK_SUGGESTION: "info",
};

const STATUS_BADGE: Record<string, "default" | "success" | "warning" | "error" | "info"> = {
  PENDING: "warning",
  NEW: "info",
  APPLIED: "success",
  DISMISSED: "default",
  SAVED: "info",
  EXPIRED: "default",
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

  const tabList = [
    { key: "recommendations", label: t("optRecommendations") },
    { key: "attribution", label: t("optAttribution") },
    { key: "insights", label: t("optInsights") },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("optimizationsPage")}
        actions={
          <Button size="sm" onClick={handleRunOptimize} loading={optimizing}>
            {optimizing ? tc("loading") : t("runOptimizeV2")}
          </Button>
        }
      />

      {/* Tabs */}
      <Tabs tabs={tabList} active={activeTab} onChange={(k) => setActiveTab(k as TabId)} />

      {/* Recommendations Tab */}
      {activeTab === "recommendations" && (
        <>
          {/* Status filter */}
          <div className="flex gap-1">
            {["PENDING", "NEW", "APPLIED", "DISMISSED", "SAVED", ""].map((s) => (
              <Button
                key={s}
                variant={statusFilter === s ? "primary" : "ghost"}
                size="sm"
                onClick={() => setStatusFilter(s)}
              >
                {s || t("optAll")}
              </Button>
            ))}
          </div>

          {loading ? (
            <p className="py-8 text-center text-sm text-gray-500">{tc("loading")}</p>
          ) : recommendations.length === 0 ? (
            <EmptyState title={t("noOptimizations")} />
          ) : (
            <div className="space-y-3">
              {recommendations.map((rec) => (
                <Card key={rec.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      {/* Badges */}
                      <div className="mb-2 flex items-center gap-2">
                        <Badge variant={REC_TYPE_BADGE[rec.type] || "default"}>
                          {rec.type.replace(/_/g, " ")}
                        </Badge>
                        <Badge variant={STATUS_BADGE[rec.status] || "default"}>
                          {rec.status}
                        </Badge>
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
                      <p className="text-sm font-medium text-gray-100">{rec.title}</p>
                      {rec.summary && (
                        <p className="mt-1 text-xs text-blue-300">{rec.summary}</p>
                      )}
                      {rec.description && (
                        <p className="mt-1 text-xs text-gray-400">{rec.description}</p>
                      )}

                      {/* Current -> Suggested */}
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
                        <Button size="sm" onClick={() => handleAction(rec.id, "apply")}>
                          {t("applyRec")}
                        </Button>
                        {rec.status !== "SAVED" && (
                          <Button variant="secondary" size="sm" onClick={() => handleAction(rec.id, "save")}>
                            {t("saveForLater")}
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => handleAction(rec.id, "dismiss")}>
                          {t("dismissRec")}
                        </Button>
                      </div>
                    )}
                  </div>
                </Card>
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
            <EmptyState title={t("noAttributionRecords")} />
          ) : (
            <div className="space-y-2">
              {attributionRecords.map((ar) => (
                <Card key={ar.id} className="!p-3">
                  <div className="flex items-center gap-2 text-xs">
                    <Badge variant="info">{ar.signal_type}</Badge>
                    <span className="text-gray-500">-&gt;</span>
                    {ar.execution_type && (
                      <>
                        <Badge variant="default">{ar.execution_type}</Badge>
                        <span className="text-gray-500">-&gt;</span>
                      </>
                    )}
                    {ar.outcome_type ? (
                      <Badge variant="success">{ar.outcome_type}</Badge>
                    ) : (
                      <span className="text-[10px] text-gray-500">{t("optPendingOutcome")}</span>
                    )}
                    <span className="ml-auto text-[10px] text-gray-500">
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
                </Card>
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
            <EmptyState title={t("noLearningInsights")} />
          ) : (
            <div className="space-y-4">
              {Object.entries(learningInsights).map(([type, items]) => (
                <section key={type}>
                  <SectionHeader
                    title={type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                  />
                  <div className="mt-2 space-y-1">
                    {items.map((item, i) => (
                      <Card key={i} className="!p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-gray-100">{item.key}</span>
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
                      </Card>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
