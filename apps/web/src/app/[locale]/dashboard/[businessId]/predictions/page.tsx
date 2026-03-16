"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { useRouter } from "@/i18n/navigation";
import Topbar from "@/components/Topbar";

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

const ENTITY_COLORS: Record<string, string> = {
  LEAD: "border-blue-700 bg-blue-950 text-blue-300",
  AUDIENCE: "border-purple-700 bg-purple-950 text-purple-300",
  CAMPAIGN: "border-orange-700 bg-orange-950 text-orange-300",
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

  const tabs: { key: Tab; label: string }[] = [
    { key: "LEAD", label: t("predLeads") },
    { key: "AUDIENCE", label: t("predAudiences") },
    { key: "CAMPAIGN", label: t("predCampaigns") },
  ];

  return (
    <div className="flex h-screen flex-col">
      <Topbar />
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-4xl">
          {/* Header */}
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push(`/dashboard/${businessId}`)}
                className="rounded border border-gray-700 px-2 py-1 text-xs text-gray-400 hover:bg-gray-800"
              >
                {tc("back")}
              </button>
              <div>
                <h1 className="text-lg font-semibold">{t("predictionsPage")}</h1>
                <p className="text-xs text-gray-500">{t("predictionsSubtitle")}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {runMsg && <span className="text-xs text-green-400">{runMsg}</span>}
              <button
                onClick={runPredictions}
                disabled={running}
                className="rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-500 disabled:opacity-50"
              >
                {running ? t("runningPredictions") : t("runPredictions")}
              </button>
            </div>
          </div>

          {/* Tab bar */}
          <div className="mb-4 flex gap-1 rounded-lg border border-gray-800 bg-gray-900 p-1">
            {tabs.map((tb) => (
              <button
                key={tb.key}
                onClick={() => { setTab(tb.key); setPreview(null); }}
                className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  tab === tb.key
                    ? "bg-cyan-600 text-white"
                    : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
                }`}
              >
                {tb.label}
              </button>
            ))}
          </div>

          {/* List + Preview */}
          <div className="flex gap-4">
            <div className={`space-y-2 ${preview ? "w-1/2" : "w-full"}`}>
              {items.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-800 px-4 py-8 text-center text-xs text-gray-600">
                  {t("noPredictions")}
                </div>
              ) : (
                items.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => setPreview(item)}
                    className={`cursor-pointer rounded-lg border bg-gray-900 p-3 transition-colors hover:bg-gray-800 ${
                      preview?.id === item.id ? "border-cyan-600" : "border-gray-800"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${ENTITY_COLORS[item.entity_type]}`}>
                          {item.entity_type}
                        </span>
                        <span className={`text-sm font-bold ${scoreColor(item.predicted_conversion_score)}`}>
                          {item.predicted_conversion_score}%
                        </span>
                        {item.predicted_roi !== null && (
                          <span className="text-xs text-gray-400">
                            ROI: {item.predicted_roi}x
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-gray-600">
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
                  </div>
                ))
              )}
            </div>

            {/* Preview panel */}
            {preview && (
              <div className="w-1/2 rounded-lg border border-gray-700 bg-gray-900 p-4">
                <h3 className="mb-3 text-sm font-semibold">{t("predictionDetail")}</h3>

                {/* Entity type badge */}
                <div className="mb-3">
                  <span className={`rounded border px-2 py-0.5 text-[10px] font-medium ${ENTITY_COLORS[preview.entity_type]}`}>
                    {preview.entity_type}
                  </span>
                  <span className="ml-2 text-xs text-gray-500">
                    {t("modelVersion")}: {preview.model_version}
                  </span>
                </div>

                {/* Score */}
                <div className="mb-3 rounded border border-gray-800 bg-gray-950 p-3 text-center">
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
                </div>

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
                          <div key={signal} className="flex items-center justify-between rounded border border-gray-800 bg-gray-950 px-2 py-1">
                            <span className="text-[10px] text-gray-300">{signal.replace(/_/g, " ")}</span>
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-800">
                                <div
                                  className="h-full rounded-full bg-cyan-500"
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
                <div className="text-[10px] text-gray-600">
                  Entity: {preview.entity_id}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
