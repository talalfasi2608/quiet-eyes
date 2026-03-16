"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { useRouter } from "@/i18n/navigation";

interface LatencyStats {
  p50: number;
  p95: number;
  p99: number;
  avg: number;
  count: number;
}

interface SystemHealth {
  api_latency: LatencyStats;
  job_queue: { failed_jobs: number; dead_jobs: number };
  integrations: { failures_24h: number };
  sources: {
    degraded_count: number;
    total_sources: number;
    avg_interval_minutes: number;
    sources_at_max_interval: number;
    sources_at_min_interval: number;
  };
}

interface CostSummary {
  total_cost_usd: number;
  by_category: Record<string, number>;
  daily_trend: Array<{ date: string; cost: number }>;
  top_operations: Array<{ operation: string; count: number; total_cost: number }>;
  period_days: number;
}

interface UsageTrend {
  date: string;
  scans: number;
  chat_tokens: number;
  exports: number;
  approvals: number;
  ai_calls: number;
  ingestions: number;
  estimated_cost_usd: number;
}

interface AiBudget {
  plan: string;
  ai_calls_today: number;
  ai_calls_limit: number;
  remaining: number;
  pct_used: number;
}

export default function OpsMonitorPage() {
  const t = useTranslations("dashboard");
  const { businessId } = useParams() as { businessId: string };
  const router = useRouter();
  const token = getToken();

  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [costs, setCosts] = useState<CostSummary | null>(null);
  const [trends, setTrends] = useState<UsageTrend[]>([]);
  const [aiBudget, setAiBudget] = useState<AiBudget | null>(null);
  const [activeTab, setActiveTab] = useState<"health" | "costs" | "usage">("health");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadData = useCallback(async () => {
    if (!token) return;
    try {
      const [h, c, tr, ai] = await Promise.all([
        apiFetch<SystemHealth>("/ops/system/health", { token }),
        apiFetch<CostSummary>("/ops/costs/summary?days=30", { token }),
        apiFetch<{ daily: UsageTrend[] }>("/ops/usage/trends?days=14", { token }),
        apiFetch<AiBudget>("/ops/costs/ai-budget", { token }),
      ]);
      setHealth(h);
      setCosts(c);
      setTrends(tr.daily || []);
      setAiBudget(ai);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (error) {
    return (
      <div className="min-h-screen bg-black p-6 text-white">
        <div className="mx-auto max-w-4xl rounded-lg border border-red-700 bg-red-950 p-8 text-center">
          <h2 className="mb-2 text-xl font-bold text-red-300">Admin access required</h2>
          <p className="text-sm text-red-400">This page is only available to admins.</p>
        </div>
      </div>
    );
  }

  const tabs = [
    { key: "health" as const, label: "System Health" },
    { key: "costs" as const, label: t("costBreakdown") },
    { key: "usage" as const, label: t("usageTrends") },
  ];

  function StatusDot({ status }: { status: string }) {
    const color =
      status === "ok" || status === "0"
        ? "bg-green-500"
        : status === "warning"
          ? "bg-yellow-500"
          : "bg-red-500";
    return <span className={`inline-block h-2 w-2 rounded-full ${color}`} />;
  }

  return (
    <div className="min-h-screen bg-black p-6 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{t("opsPage")}</h1>
            <p className="text-sm text-zinc-400">System health, costs, and usage analytics</p>
          </div>
          <button
            onClick={() => router.push(`/dashboard/${businessId}`)}
            className="rounded-lg border border-gray-700 px-3 py-1.5 text-xs text-gray-400 hover:bg-gray-800"
          >
            Back
          </button>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                activeTab === tab.key
                  ? "bg-blue-600 text-white"
                  : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-zinc-500">Loading...</p>
        ) : (
          <>
            {/* Health Tab */}
            {activeTab === "health" && health && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {/* API Latency */}
                <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-5">
                  <h3 className="mb-3 text-sm font-semibold text-blue-400">API Latency</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between text-zinc-300">
                      <span>p50</span>
                      <span className="font-mono">{health.api_latency.p50}ms</span>
                    </div>
                    <div className="flex justify-between text-zinc-300">
                      <span>p95</span>
                      <span className="font-mono">{health.api_latency.p95}ms</span>
                    </div>
                    <div className="flex justify-between text-zinc-300">
                      <span>p99</span>
                      <span className="font-mono">{health.api_latency.p99}ms</span>
                    </div>
                    <div className="flex justify-between text-zinc-400">
                      <span>Samples</span>
                      <span className="font-mono">{health.api_latency.count}</span>
                    </div>
                  </div>
                </div>

                {/* Job Queue */}
                <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-5">
                  <h3 className="mb-3 text-sm font-semibold text-orange-400">Job Queue</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between text-zinc-300">
                      <span>Failed Jobs</span>
                      <div className="flex items-center gap-2">
                        <StatusDot status={health.job_queue.failed_jobs > 0 ? "error" : "ok"} />
                        <span className="font-mono">{health.job_queue.failed_jobs}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-zinc-300">
                      <span>Dead Jobs</span>
                      <div className="flex items-center gap-2">
                        <StatusDot status={health.job_queue.dead_jobs > 0 ? "error" : "ok"} />
                        <span className="font-mono">{health.job_queue.dead_jobs}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Integrations */}
                <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-5">
                  <h3 className="mb-3 text-sm font-semibold text-red-400">Integrations</h3>
                  <div className="flex items-center justify-between text-sm text-zinc-300">
                    <span>Failures (24h)</span>
                    <div className="flex items-center gap-2">
                      <StatusDot status={health.integrations.failures_24h > 0 ? "warning" : "ok"} />
                      <span className="font-mono">{health.integrations.failures_24h}</span>
                    </div>
                  </div>
                </div>

                {/* Source Health */}
                <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-5">
                  <h3 className="mb-3 text-sm font-semibold text-green-400">Sources</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between text-zinc-300">
                      <span>Total</span>
                      <span className="font-mono">{health.sources.total_sources}</span>
                    </div>
                    <div className="flex items-center justify-between text-zinc-300">
                      <span>Degraded</span>
                      <div className="flex items-center gap-2">
                        <StatusDot status={health.sources.degraded_count > 0 ? "warning" : "ok"} />
                        <span className="font-mono">{health.sources.degraded_count}</span>
                      </div>
                    </div>
                    <div className="flex justify-between text-zinc-400">
                      <span>Avg interval</span>
                      <span className="font-mono">{health.sources.avg_interval_minutes}min</span>
                    </div>
                  </div>
                </div>

                {/* AI Budget */}
                {aiBudget && (
                  <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-5">
                    <h3 className="mb-3 text-sm font-semibold text-purple-400">{t("aiCalls")}</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between text-zinc-300">
                        <span>Today</span>
                        <span className="font-mono">
                          {aiBudget.ai_calls_today} / {aiBudget.ai_calls_limit}
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
                        <div
                          className={`h-2 rounded-full ${
                            aiBudget.pct_used >= 100
                              ? "bg-red-500"
                              : aiBudget.pct_used >= 80
                                ? "bg-yellow-500"
                                : "bg-purple-500"
                          }`}
                          style={{ width: `${Math.min(100, aiBudget.pct_used)}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-zinc-500">
                        <span>{aiBudget.remaining} {t("remaining")}</span>
                        <span>{aiBudget.plan}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Costs Tab */}
            {activeTab === "costs" && costs && (
              <div className="space-y-4">
                {/* Summary cards */}
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                  <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-center">
                    <p className="text-2xl font-bold text-blue-400">${costs.total_cost_usd.toFixed(2)}</p>
                    <p className="text-xs text-zinc-500">{t("totalCost")} ({costs.period_days}d)</p>
                  </div>
                  {Object.entries(costs.by_category).map(([cat, amount]) => (
                    <div key={cat} className="rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-center">
                      <p className="text-2xl font-bold text-zinc-200">${amount.toFixed(2)}</p>
                      <p className="text-xs text-zinc-500">{cat}</p>
                    </div>
                  ))}
                </div>

                {/* Top operations */}
                {costs.top_operations.length > 0 && (
                  <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-5">
                    <h3 className="mb-3 text-sm font-semibold text-zinc-300">Top Operations by Cost</h3>
                    <div className="space-y-2">
                      {costs.top_operations.map((op) => (
                        <div key={op.operation} className="flex items-center justify-between text-xs">
                          <span className="font-mono text-zinc-400">{op.operation}</span>
                          <div className="flex gap-4">
                            <span className="text-zinc-500">{op.count}x</span>
                            <span className="font-mono text-zinc-200">${op.total_cost.toFixed(4)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Daily trend (text-based since no charting lib) */}
                {costs.daily_trend.length > 0 && (
                  <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-5">
                    <h3 className="mb-3 text-sm font-semibold text-zinc-300">{t("dailyTrend")}</h3>
                    <div className="space-y-1">
                      {costs.daily_trend.map((d) => {
                        const maxCost = Math.max(...costs.daily_trend.map((x) => x.cost), 0.01);
                        const pct = (d.cost / maxCost) * 100;
                        return (
                          <div key={d.date} className="flex items-center gap-3 text-xs">
                            <span className="w-20 text-zinc-500">
                              {d.date ? new Date(d.date).toLocaleDateString() : ""}
                            </span>
                            <div className="flex-1">
                              <div className="h-3 overflow-hidden rounded bg-zinc-800">
                                <div
                                  className="h-3 rounded bg-blue-600"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                            <span className="w-16 text-right font-mono text-zinc-300">
                              ${d.cost.toFixed(4)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Usage Tab */}
            {activeTab === "usage" && (
              <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-5">
                <h3 className="mb-3 text-sm font-semibold text-zinc-300">{t("usageTrends")}</h3>
                {trends.length === 0 ? (
                  <p className="text-xs text-zinc-500">No usage data yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-zinc-800 text-zinc-500">
                          <th className="pb-2 pr-3">Date</th>
                          <th className="pb-2 pr-3">Scans</th>
                          <th className="pb-2 pr-3">Chat</th>
                          <th className="pb-2 pr-3">AI</th>
                          <th className="pb-2 pr-3">Ingestions</th>
                          <th className="pb-2 pr-3">Exports</th>
                          <th className="pb-2">Cost</th>
                        </tr>
                      </thead>
                      <tbody>
                        {trends.map((d) => (
                          <tr key={d.date} className="border-b border-zinc-900">
                            <td className="py-1.5 pr-3 text-zinc-400">
                              {new Date(d.date).toLocaleDateString()}
                            </td>
                            <td className="py-1.5 pr-3 font-mono">{d.scans}</td>
                            <td className="py-1.5 pr-3 font-mono">{d.chat_tokens}</td>
                            <td className="py-1.5 pr-3 font-mono">{d.ai_calls}</td>
                            <td className="py-1.5 pr-3 font-mono">{d.ingestions}</td>
                            <td className="py-1.5 pr-3 font-mono">{d.exports}</td>
                            <td className="py-1.5 font-mono text-blue-400">
                              ${d.estimated_cost_usd.toFixed(4)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
