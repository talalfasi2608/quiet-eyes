"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { useRouter } from "@/i18n/navigation";
import Topbar from "@/components/Topbar";

interface TrendItem {
  id: string;
  business_id: string;
  topic: string;
  spike_score: number;
  window_days: number;
  evidence_urls: string[] | null;
  first_seen_at: string | null;
  last_seen_at: string | null;
  created_at: string;
}

export default function TrendsPage() {
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const router = useRouter();
  const { businessId } = useParams<{ businessId: string }>();
  const token = getToken();

  const [trends, setTrends] = useState<TrendItem[]>([]);

  useEffect(() => {
    if (!token) router.push("/login");
  }, [token, router]);

  const loadTrends = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiFetch<TrendItem[]>(
        `/businesses/${businessId}/trends?days=30`,
        { token },
      );
      setTrends(data);
    } catch { /* empty */ }
  }, [businessId, token]);

  useEffect(() => {
    loadTrends();
  }, [loadTrends]);

  if (!token) return null;

  return (
    <div className="flex h-screen flex-col">
      <Topbar />
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-3xl">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold">{t("trendsPage")}</h1>
              <p className="text-xs text-gray-500">{t("trendSpike")} — {t("windowDays")} 30 days</p>
            </div>
            <button
              onClick={() => router.push(`/dashboard/${businessId}`)}
              className="rounded-lg border border-gray-700 px-3 py-1.5 text-xs text-gray-400 hover:bg-gray-800"
            >
              {tc("back")}
            </button>
          </div>

          {trends.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-800 px-4 py-12 text-center text-xs text-gray-600">
              {t("noTrends")}
            </div>
          ) : (
            <div className="space-y-3">
              {trends.map((trend) => (
                <div
                  key={trend.id}
                  className="rounded-lg border border-amber-800 bg-gray-900 p-4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="mb-1 flex items-center gap-2">
                        <span className="rounded bg-amber-900 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">
                          {t("trendSpike")}
                        </span>
                        <span className="text-xs text-gray-500">
                          {t("spikeScore")}: {trend.spike_score}
                        </span>
                      </div>
                      <p className="text-sm font-medium">{trend.topic}</p>
                    </div>
                    <div className="text-end">
                      <div className="text-2xl font-bold text-amber-400">{trend.spike_score}</div>
                      <div className="text-[10px] text-gray-500">{t("spikeScore")}</div>
                    </div>
                  </div>
                  {(trend.evidence_urls || []).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(trend.evidence_urls || []).slice(0, 3).map((url, i) => (
                        <a
                          key={i}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-400 hover:underline"
                        >
                          {t("evidence")} {i + 1}
                        </a>
                      ))}
                    </div>
                  )}
                  <div className="mt-2 flex gap-3 text-[10px] text-gray-600">
                    {trend.first_seen_at && (
                      <span>First: {new Date(trend.first_seen_at).toLocaleDateString()}</span>
                    )}
                    {trend.last_seen_at && (
                      <span>Last: {new Date(trend.last_seen_at).toLocaleDateString()}</span>
                    )}
                    <span>{t("windowDays")}: {trend.window_days}d</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
