"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { useRouter } from "@/i18n/navigation";
import { PageHeader, Card, Badge, Button, Tabs, EmptyState } from "@/components/ui";

/* ── Types ── */

interface PredictiveScoreItem {
  id: string;
  business_id: string;
  entity_type: "LEAD" | "AUDIENCE" | "CAMPAIGN";
  entity_id: string;
  predicted_conversion_score: number;
  predicted_roi: number | null;
  model_version: string;
  contributing_signals: Record<string, number> | null;
  explanation: string | null;
  created_at: string;
}

type Tab = "LEAD" | "AUDIENCE" | "CAMPAIGN";

const ENTITY_BADGE_VARIANT: Record<string, "default" | "success" | "warning" | "error" | "info"> = {
  LEAD: "info",
  AUDIENCE: "default",
  CAMPAIGN: "warning",
};

function scoreColor(score: number): string {
  if (score >= 75) return "text-green-400";
  if (score >= 50) return "text-yellow-400";
  if (score >= 25) return "text-orange-400";
  return "text-red-400";
}

export default function PredictionsPage() {
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const router = useRouter();
  const params = useParams<{ businessId: string }>();
  const businessId = params.businessId;
  const token = getToken();

  const [tab, setTab] = useState<Tab>("LEAD");
  const [items, setItems] = useState<PredictiveScoreItem[]>([]);
  const [preview, setPreview] = useState<PredictiveScoreItem | null>(null);
  const [running, setRunning] = useState(false);
  const [runMsg, setRunMsg] = useState("");

  useEffect(() => {
    if (!token) router.push("/login");
  }, [token, router]);

  const loadItems = useCallback(async () => {
    if (!token || !businessId) return;
    try {
      const data = await apiFetch<PredictiveScoreItem[]>(
        `/businesses/${businessId}/predictions?entity_type=${tab}&limit=50`,
        { token },
      );
      setItems(data);
    } catch { /* empty */ }
  }, [token, businessId, tab]);

  useEffect(() => { loadItems(); }, [loadItems]);

  async function runPredictions() {
    if (!token || !businessId) return;
    setRunning(true);
    setRunMsg("");
    try {
      const result = await apiFetch<{ predictions_created: number; entity_type: string }>(
        `/businesses/${businessId}/predictions/run`,
        {
          token,
          method: "POST",
          body: JSON.stringify({ entity_type: tab }),
        },
      );
      setRunMsg(t("predictionsGenerated", { count: result.predictions_created }));
      loadItems();
    } catch {
      setRunMsg("Error");
    }
    setRunning(false);
  }

  if (!token) return null;

  const tabs = [
    { key: "LEAD", label: t("predLeads") },
    { key: "AUDIENCE", label: t("predAudiences") },
    { key: "CAMPAIGN", label: t("predCampaigns") },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("predictionsPage")}
        description={t("predictionsSubtitle")}
        actions={
          <div className="flex items-center gap-3">
            {runMsg && <span className="text-xs text-green-400">{runMsg}</span>}
            <Button size="sm" onClick={runPredictions} loading={running}>
              {running ? t("runningPredictions") : t("runPredictions")}
            </Button>
          </div>
        }
      />

      {/* Tab bar */}
      <Tabs
        tabs={tabs}
        active={tab}
        onChange={(k) => { setTab(k as Tab); setPreview(null); }}
      />

      {/* List + Preview */}
      <div className="flex gap-4">
        <div className={`space-y-2 ${preview ? "w-1/2" : "w-full"}`}>
          {items.length === 0 ? (
            <EmptyState title={t("noPredictions")} />
          ) : (
            items.map((item) => (
              <Card
                key={item.id}
                hover
                onClick={() => setPreview(item)}
                className={preview?.id === item.id ? "!border-gray-600" : ""}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant={ENTITY_BADGE_VARIANT[item.entity_type] || "default"}>
                      {item.entity_type}
                    </Badge>
                    <span className={`text-sm font-bold ${scoreColor(item.predicted_conversion_score)}`}>
                      {item.predicted_conversion_score}%
                    </span>
                    {item.predicted_roi !== null && (
                      <span className="text-xs text-gray-400">
                        ROI: {item.predicted_roi}x
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-gray-500">
                    {new Date(item.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="mt-1 text-[10px] text-gray-500">
                  {item.entity_id.slice(0, 8)}...
                </div>
                {item.explanation && (
                  <div className="mt-1 line-clamp-2 text-[10px] text-gray-400">
                    {item.explanation}
                  </div>
                )}
              </Card>
            ))
          )}
        </div>

        {/* Preview panel */}
        {preview && (
          <Card className="w-1/2">
            <h3 className="mb-3 text-sm font-semibold text-gray-100">{t("predictionDetail")}</h3>

            {/* Entity type badge */}
            <div className="mb-3">
              <Badge variant={ENTITY_BADGE_VARIANT[preview.entity_type] || "default"}>
                {preview.entity_type}
              </Badge>
              <span className="ml-2 text-xs text-gray-500">
                {t("modelVersion")}: {preview.model_version}
              </span>
            </div>

            {/* Score */}
            <Card className="!p-3 mb-3 text-center">
              <div className="text-[10px] font-medium text-gray-400">{t("predConversionScore")}</div>
              <div className={`text-3xl font-bold ${scoreColor(preview.predicted_conversion_score)}`}>
                {preview.predicted_conversion_score}%
              </div>
              {preview.predicted_roi !== null && (
                <div className="mt-1">
                  <span className="text-[10px] text-gray-400">{t("predROI")}: </span>
                  <span className="text-sm font-semibold text-yellow-300">{preview.predicted_roi}x</span>
                </div>
              )}
            </Card>

            {/* Explanation */}
            {preview.explanation && (
              <div className="mb-3">
                <div className="text-[10px] font-medium text-gray-400">{t("predExplanation")}</div>
                <div className="mt-1 text-xs text-gray-300">{preview.explanation}</div>
              </div>
            )}

            {/* Contributing signals */}
            {preview.contributing_signals && Object.keys(preview.contributing_signals).length > 0 && (
              <div className="mb-3">
                <div className="text-[10px] font-medium text-gray-400">{t("predSignals")}</div>
                <div className="mt-1 space-y-1">
                  {Object.entries(preview.contributing_signals)
                    .sort(([, a], [, b]) => b - a)
                    .map(([signal, value]) => (
                      <div key={signal} className="flex items-center justify-between rounded-lg border border-gray-800/50 bg-gray-900/50 px-2 py-1">
                        <span className="text-[10px] text-gray-300">{signal.replace(/_/g, " ")}</span>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-800">
                            <div
                              className="h-full rounded-full bg-white/60"
                              style={{ width: `${Math.min(100, (value / 35) * 100)}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-medium text-gray-400">{value}</span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Entity ID */}
            <div className="text-[10px] text-gray-500">
              Entity: {preview.entity_id}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
