"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { useRouter } from "@/i18n/navigation";
import Topbar from "@/components/Topbar";

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

const EVENT_TYPE_STYLES: Record<string, { badge: string }> = {
  OFFER_CHANGE: { badge: "bg-rose-900 text-rose-300" },
  MESSAGE_CHANGE: { badge: "bg-violet-900 text-violet-300" },
  CONTENT_CHANGE: { badge: "bg-slate-800 text-slate-300" },
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
    <div className="flex h-screen flex-col">
      <Topbar />
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-3xl">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold">{t("competitorsPage")}</h1>
              <p className="text-xs text-gray-500">{t("competitorAlert")} timeline</p>
            </div>
            <button
              onClick={() => router.push(`/dashboard/${businessId}`)}
              className="rounded-lg border border-gray-700 px-3 py-1.5 text-xs text-gray-400 hover:bg-gray-800"
            >
              {tc("back")}
            </button>
          </div>

          {events.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-800 px-4 py-12 text-center text-xs text-gray-600">
              {t("noCompetitorEvents")}
            </div>
          ) : (
            <div className="space-y-3">
              {events.map((evt) => {
                const style = EVENT_TYPE_STYLES[evt.event_type] || EVENT_TYPE_STYLES.CONTENT_CHANGE;
                return (
                  <div
                    key={evt.id}
                    className="rounded-lg border border-rose-800 bg-gray-900 p-4"
                  >
                    <div className="mb-1 flex items-center gap-2">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${style.badge}`}>
                        {eventTypeLabel(evt.event_type)}
                      </span>
                      <span className="text-[10px] text-gray-600">
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
