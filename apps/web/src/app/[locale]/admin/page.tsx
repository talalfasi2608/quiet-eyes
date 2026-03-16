"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { useRouter } from "@/i18n/navigation";
import Topbar from "@/components/Topbar";

interface SourceHealthItem {
  id: string;
  source_id: string;
  source_name: string | null;
  source_type: string | null;
  last_run_at: string | null;
  status: "OK" | "DEGRADED" | "DOWN";
  last_error: string | null;
  created_at: string;
}

interface JobStatus {
  celery_active: number;
  celery_scheduled: number;
  celery_reserved: number;
  pending_approvals: number;
  pending_exports: number;
}

interface UsageSummary {
  total_orgs: number;
  total_users: number;
  total_businesses: number;
  total_mentions: number;
  total_leads: number;
  total_actions: number;
  total_approvals: number;
  active_subscriptions: number;
}

const STATUS_COLORS: Record<string, string> = {
  OK: "bg-green-900 text-green-300",
  DEGRADED: "bg-yellow-900 text-yellow-300",
  DOWN: "bg-red-900 text-red-300",
};

export default function AdminPage() {
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const router = useRouter();
  const token = getToken();

  const [sources, setSources] = useState<SourceHealthItem[]>([]);
  const [jobs, setJobs] = useState<JobStatus | null>(null);
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) router.push("/login");
  }, [token, router]);

  const loadData = useCallback(async () => {
    if (!token) return;
    try {
      const [s, j, u] = await Promise.all([
        apiFetch<SourceHealthItem[]>("/admin/sources/health", { token }),
        apiFetch<JobStatus>("/admin/jobs/status", { token }),
        apiFetch<UsageSummary>("/admin/usage/summary", { token }),
      ]);
      setSources(s);
      setJobs(j);
      setSummary(u);
    } catch (e) {
      setError((e as Error).message || "Access denied");
    }
  }, [token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (!token) return null;

  if (error) {
    return (
      <div className="flex h-screen flex-col">
        <Topbar />
        <div className="flex flex-1 items-center justify-center">
          <div className="rounded-lg border border-red-800 bg-gray-900 px-8 py-6 text-center">
            <p className="text-sm text-red-400">{error}</p>
            <button
              onClick={() => router.push("/login")}
              className="mt-3 rounded-lg bg-white px-4 py-1.5 text-xs font-semibold text-gray-950 hover:bg-gray-200"
            >
              {tc("back")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <Topbar />
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-4xl">
          <div className="mb-6">
            <h1 className="text-lg font-semibold">{t("adminPage")}</h1>
            <p className="text-xs text-gray-500">{t("adminSubtitle")}</p>
          </div>

          {/* Source Health */}
          <section className="mb-6">
            <h2 className="mb-3 text-sm font-semibold">{t("sourceHealth")}</h2>
            {sources.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-800 px-4 py-8 text-center text-xs text-gray-600">
                {t("noSourceHealth")}
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border border-gray-800">
                <table className="w-full text-xs">
                  <thead className="bg-gray-900">
                    <tr>
                      <th className="px-3 py-2 text-start font-medium text-gray-400">{t("sourceHealthName")}</th>
                      <th className="px-3 py-2 text-start font-medium text-gray-400">{t("sourceHealthType")}</th>
                      <th className="px-3 py-2 text-start font-medium text-gray-400">{t("sourceHealthStatus")}</th>
                      <th className="px-3 py-2 text-start font-medium text-gray-400">{t("sourceHealthLastRun")}</th>
                      <th className="px-3 py-2 text-start font-medium text-gray-400">{t("sourceHealthError")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {sources.map((s) => (
                      <tr key={s.id} className="bg-gray-950">
                        <td className="px-3 py-2">{s.source_name || "—"}</td>
                        <td className="px-3 py-2 text-gray-500">{s.source_type || "—"}</td>
                        <td className="px-3 py-2">
                          <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${STATUS_COLORS[s.status] || STATUS_COLORS.OK}`}>
                            {s.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-gray-500">
                          {s.last_run_at ? new Date(s.last_run_at).toLocaleString() : "—"}
                        </td>
                        <td className="max-w-xs truncate px-3 py-2 text-red-400">{s.last_error || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Job Status */}
          {jobs && (
            <section className="mb-6">
              <h2 className="mb-3 text-sm font-semibold">{t("jobStatus")}</h2>
              <div className="grid grid-cols-5 gap-3">
                {[
                  { label: t("celeryActive"), value: jobs.celery_active, color: "border-green-800" },
                  { label: t("celeryScheduled"), value: jobs.celery_scheduled, color: "border-blue-800" },
                  { label: t("celeryReserved"), value: jobs.celery_reserved, color: "border-yellow-800" },
                  { label: t("pendingApprovalsAdmin"), value: jobs.pending_approvals, color: "border-orange-800" },
                  { label: t("pendingExports"), value: jobs.pending_exports, color: "border-purple-800" },
                ].map((card) => (
                  <div key={card.label} className={`rounded-lg border ${card.color} bg-gray-900 p-3 text-center`}>
                    <div className="text-2xl font-bold">{card.value}</div>
                    <div className="text-[10px] text-gray-500">{card.label}</div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Usage Summary */}
          {summary && (
            <section>
              <h2 className="mb-3 text-sm font-semibold">{t("usageSummary")}</h2>
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: t("totalOrgs"), value: summary.total_orgs },
                  { label: t("totalUsers"), value: summary.total_users },
                  { label: t("totalBusinesses"), value: summary.total_businesses },
                  { label: t("totalMentions"), value: summary.total_mentions },
                  { label: t("totalLeads"), value: summary.total_leads },
                  { label: t("totalActions"), value: summary.total_actions },
                  { label: t("totalApprovals"), value: summary.total_approvals },
                  { label: t("activeSubscriptions"), value: summary.active_subscriptions },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-lg border border-gray-800 bg-gray-900 p-3 text-center">
                    <div className="text-xl font-bold">{stat.value}</div>
                    <div className="text-[10px] text-gray-500">{stat.label}</div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
