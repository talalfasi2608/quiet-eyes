"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { useRouter } from "@/i18n/navigation";
import Topbar from "@/components/Topbar";

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

const SENTIMENT_STYLES: Record<string, { badge: string }> = {
  POS: { badge: "bg-green-900 text-green-300" },
  NEU: { badge: "bg-gray-800 text-gray-400" },
  NEG: { badge: "bg-red-900 text-red-300" },
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

  return (
    <div className="flex h-screen flex-col">
      <Topbar />
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-3xl">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold">{t("reputationPage")}</h1>
              <p className="text-xs text-gray-500">{t("reputationAlert")} — reviews &amp; sentiment</p>
            </div>
            <button
              onClick={() => router.push(`/dashboard/${businessId}`)}
              className="rounded-lg border border-gray-700 px-3 py-1.5 text-xs text-gray-400 hover:bg-gray-800"
            >
              {tc("back")}
            </button>
          </div>

          {/* Filter */}
          <div className="mb-4 flex gap-2">
            {["all", "NEG", "NEU", "POS"].map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`rounded-full px-3 py-1 text-xs ${
                  filter === s
                    ? "bg-white text-gray-950"
                    : "bg-gray-800 text-gray-500 hover:bg-gray-700"
                }`}
              >
                {s === "all" ? "All" : sentimentLabel(s)}
              </button>
            ))}
          </div>

          {reviews.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-800 px-4 py-12 text-center text-xs text-gray-600">
              {t("noReviews")}
            </div>
          ) : (
            <div className="space-y-3">
              {reviews.map((review) => {
                const style = SENTIMENT_STYLES[review.sentiment] || SENTIMENT_STYLES.NEU;
                return (
                  <div
                    key={review.id}
                    className={`rounded-lg border bg-gray-900 p-4 ${
                      review.sentiment === "NEG"
                        ? "border-red-800"
                        : review.sentiment === "POS"
                          ? "border-green-800"
                          : "border-gray-800"
                    }`}
                  >
                    <div className="mb-1 flex items-center gap-2">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${style.badge}`}>
                        {sentimentLabel(review.sentiment)}
                      </span>
                      {review.rating !== null && (
                        <span className="text-xs text-gray-500">
                          {t("rating")}: {review.rating}/5
                        </span>
                      )}
                      {review.author && (
                        <span className="text-xs text-gray-600">{review.author}</span>
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
                      <span className="text-[10px] text-gray-600">
                        {new Date(review.created_at).toLocaleString()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
