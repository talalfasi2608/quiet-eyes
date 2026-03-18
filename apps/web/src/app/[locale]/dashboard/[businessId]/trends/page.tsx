"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { useRouter } from "@/i18n/navigation";
import { PageHeader, Card, Badge, EmptyState } from "@/components/ui";

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
    <div className="space-y-6">
      <PageHeader
        title={t("trendsPage")}
        description={`${t("trendSpike")} — ${t("windowDays")} 30 days`}
      />

      {trends.length === 0 ? (
        <EmptyState title={t("noTrends")} />
      ) : (
        <div className="space-y-3">
          {trends.map((trend) => (
            <Card key={trend.id}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="mb-1 flex items-center gap-2">
                    <Badge variant="warning">{t("trendSpike")}</Badge>
                    <span className="text-xs text-gray-500">
                      {t("spikeScore")}: {trend.spike_score}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-gray-100">{trend.topic}</p>
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
              <div className="mt-2 flex gap-3 text-[10px] text-gray-500">
                {trend.first_seen_at && (
                  <span>First: {new Date(trend.first_seen_at).toLocaleDateString()}</span>
                )}
                {trend.last_seen_at && (
                  <span>Last: {new Date(trend.last_seen_at).toLocaleDateString()}</span>
                )}
                <span>{t("windowDays")}: {trend.window_days}d</span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
