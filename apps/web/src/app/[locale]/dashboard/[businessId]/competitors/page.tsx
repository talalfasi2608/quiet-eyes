"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { useRouter } from "@/i18n/navigation";
import { PageHeader, Card, Badge, EmptyState } from "@/components/ui";

interface CompetitorEventItem {
  id: string;
  business_id: string;
  competitor_id: string;
  event_type: "OFFER_CHANGE" | "MESSAGE_CHANGE" | "CONTENT_CHANGE";
  summary: string | null;
  evidence_urls: string[] | null;
  detected_at: string;
  created_at: string;
}

const EVENT_BADGE_VARIANT: Record<string, "default" | "success" | "warning" | "error" | "info"> = {
  OFFER_CHANGE: "error",
  MESSAGE_CHANGE: "info",
  CONTENT_CHANGE: "default",
};

export default function CompetitorsPage() {
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const router = useRouter();
  const { businessId } = useParams<{ businessId: string }>();
  const token = getToken();

  const [events, setEvents] = useState<CompetitorEventItem[]>([]);

  useEffect(() => {
    if (!token) router.push("/login");
  }, [token, router]);

  const loadEvents = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiFetch<CompetitorEventItem[]>(
        `/businesses/${businessId}/competitor-events?days=30`,
        { token },
      );
      setEvents(data);
    } catch { /* empty */ }
  }, [businessId, token]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  function eventTypeLabel(type: string) {
    if (type === "OFFER_CHANGE") return t("offerChange");
    if (type === "MESSAGE_CHANGE") return t("messageChange");
    return t("contentChange");
  }

  if (!token) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("competitorsPage")}
        description={`${t("competitorAlert")} timeline`}
      />

      {events.length === 0 ? (
        <EmptyState title={t("noCompetitorEvents")} />
      ) : (
        <div className="space-y-3">
          {events.map((evt) => (
            <Card key={evt.id}>
              <div className="mb-1 flex items-center gap-2">
                <Badge variant={EVENT_BADGE_VARIANT[evt.event_type] || "default"}>
                  {eventTypeLabel(evt.event_type)}
                </Badge>
                <span className="text-[10px] text-gray-500">
                  {t("detectedAt")}: {new Date(evt.detected_at).toLocaleString()}
                </span>
              </div>
              {evt.summary && (
                <p className="mt-1 text-sm text-gray-300">{evt.summary}</p>
              )}
              {(evt.evidence_urls || []).length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {(evt.evidence_urls || []).slice(0, 3).map((url, i) => (
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
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
