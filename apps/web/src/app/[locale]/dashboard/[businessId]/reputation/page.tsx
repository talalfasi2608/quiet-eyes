"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { useRouter } from "@/i18n/navigation";
import { PageHeader, Card, Badge, EmptyState, Tabs } from "@/components/ui";

interface ReviewItem {
  id: string;
  business_id: string;
  source_id: string | null;
  rating: number | null;
  author: string | null;
  text: string;
  url: string | null;
  published_at: string | null;
  sentiment: "POS" | "NEU" | "NEG";
  created_at: string;
}

const SENTIMENT_BADGE_VARIANT: Record<string, "default" | "success" | "warning" | "error" | "info"> = {
  POS: "success",
  NEU: "default",
  NEG: "error",
};

export default function ReputationPage() {
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const router = useRouter();
  const { businessId } = useParams<{ businessId: string }>();
  const token = getToken();

  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    if (!token) router.push("/login");
  }, [token, router]);

  const loadReviews = useCallback(async () => {
    if (!token) return;
    try {
      const q = filter !== "all" ? `&sentiment=${filter}` : "";
      const data = await apiFetch<ReviewItem[]>(
        `/businesses/${businessId}/reviews?days=30${q}`,
        { token },
      );
      setReviews(data);
    } catch { /* empty */ }
  }, [businessId, token, filter]);

  useEffect(() => {
    loadReviews();
  }, [loadReviews]);

  function sentimentLabel(s: string) {
    if (s === "POS") return t("sentimentPos");
    if (s === "NEG") return t("sentimentNeg");
    return t("sentimentNeu");
  }

  if (!token) return null;

  const filterTabs = [
    { key: "all", label: "All" },
    { key: "NEG", label: sentimentLabel("NEG") },
    { key: "NEU", label: sentimentLabel("NEU") },
    { key: "POS", label: sentimentLabel("POS") },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("reputationPage")}
        description={`${t("reputationAlert")} — reviews & sentiment`}
      />

      {/* Filter */}
      <Tabs tabs={filterTabs} active={filter} onChange={setFilter} />

      {reviews.length === 0 ? (
        <EmptyState title={t("noReviews")} />
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <Card key={review.id}>
              <div className="mb-1 flex items-center gap-2">
                <Badge variant={SENTIMENT_BADGE_VARIANT[review.sentiment] || "default"}>
                  {sentimentLabel(review.sentiment)}
                </Badge>
                {review.rating !== null && (
                  <span className="text-xs text-gray-500">
                    {t("rating")}: {review.rating}/5
                  </span>
                )}
                {review.author && (
                  <span className="text-xs text-gray-500">{review.author}</span>
                )}
              </div>
              <p className="mt-1 text-sm text-gray-300">{review.text}</p>
              <div className="mt-2 flex items-center gap-3">
                {review.url && (
                  <a
                    href={review.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:underline"
                  >
                    {t("evidence")}
                  </a>
                )}
                <span className="text-[10px] text-gray-500">
                  {new Date(review.created_at).toLocaleString()}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
