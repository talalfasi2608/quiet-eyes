"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";

interface AuditEntry {
  id: string;
  event_type: string;
  user_id: string | null;
  entity_type: string | null;
  entity_id: string | null;
  meta: Record<string, unknown> | null;
  created_at: string;
}

export default function SecurityPage() {
  const t = useTranslations("security");
  const { businessId } = useParams() as { businessId: string };
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "audit" | "compliance">("overview");
  const [permissionError, setPermissionError] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    fetch(`http://localhost:8000/governance/audit-logs?limit=50`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (r.status === 403) {
          setPermissionError(true);
          return [];
        }
        return r.json();
      })
      .then((data) => {
        if (Array.isArray(data)) setAuditLogs(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [businessId]);

  if (permissionError) {
    return (
      <div className="min-h-screen bg-black p-6 text-white">
        <div className="mx-auto max-w-4xl">
          <div className="rounded-lg border border-red-700 bg-red-950 p-8 text-center">
            <h2 className="mb-2 text-xl font-bold text-red-300">{t("permissionDenied")}</h2>
            <p className="text-sm text-red-400">{t("permissionDeniedMsg")}</p>
          </div>
        </div>
      </div>
    );
  }

  const tabs = [
    { key: "overview" as const, label: t("authSection") },
    { key: "audit" as const, label: t("auditSection") },
    { key: "compliance" as const, label: t("complianceSection") },
  ];

  return (
    <div className="min-h-screen bg-black p-6 text-white">
      <div className="mx-auto max-w-6xl">
        <h1 className="mb-1 text-2xl font-bold">{t("title")}</h1>
        <p className="mb-6 text-sm text-zinc-400">{t("subtitle")}</p>

        {/* Tabs */}
        <div className="mb-6 flex gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                activeTab === tab.key
                  ? "bg-red-600 text-white"
                  : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Password Policy Card */}
            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-5">
              <h3 className="mb-3 text-sm font-semibold text-red-400">{t("passwordPolicy")}</h3>
              <div className="space-y-2 text-sm text-zinc-300">
                <div className="flex justify-between">
                  <span>{t("minPasswordLength")}</span>
                  <span className="font-mono text-zinc-100">8</span>
                </div>
                <div className="flex justify-between">
                  <span>{t("requireUppercase")}</span>
                  <span className="text-green-400">ON</span>
                </div>
                <div className="flex justify-between">
                  <span>{t("requireDigit")}</span>
                  <span className="text-green-400">ON</span>
                </div>
              </div>
            </div>

            {/* Session Management Card */}
            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-5">
              <h3 className="mb-3 text-sm font-semibold text-red-400">{t("sessionSection")}</h3>
              <div className="space-y-2 text-sm text-zinc-300">
                <div className="flex justify-between">
                  <span>{t("accessTokenExpiry")}</span>
                  <span className="font-mono text-zinc-100">30</span>
                </div>
                <div className="flex justify-between">
                  <span>{t("refreshTokenExpiry")}</span>
                  <span className="font-mono text-zinc-100">7</span>
                </div>
              </div>
            </div>

            {/* Rate Limiting Card */}
            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-5">
              <h3 className="mb-3 text-sm font-semibold text-red-400">{t("rateLimiting")}</h3>
              <div className="space-y-2 text-sm text-zinc-300">
                <div className="flex justify-between">
                  <span>{t("authRateLimit")}</span>
                  <span className="font-mono text-zinc-100">10/minute</span>
                </div>
                <div className="flex justify-between">
                  <span>{t("defaultRateLimit")}</span>
                  <span className="font-mono text-zinc-100">60/minute</span>
                </div>
              </div>
            </div>

            {/* Security Headers Card */}
            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-5">
              <h3 className="mb-3 text-sm font-semibold text-red-400">{t("securityHeaders")}</h3>
              <p className="text-sm text-zinc-400">{t("headersEnabled")}</p>
              <div className="mt-3 space-y-1 text-xs text-zinc-500">
                <div>X-Content-Type-Options: nosniff</div>
                <div>X-Frame-Options: DENY</div>
                <div>X-XSS-Protection: 1; mode=block</div>
                <div>Referrer-Policy: strict-origin-when-cross-origin</div>
              </div>
            </div>

            {/* Token Revocation Card */}
            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-5">
              <h3 className="mb-3 text-sm font-semibold text-red-400">{t("tokenRevocation")}</h3>
              <p className="text-sm text-zinc-400">{t("tokenRevocationDesc")}</p>
              <div className="mt-3 space-y-1 text-xs text-zinc-500">
                <div>Refresh token rotation on /auth/refresh</div>
                <div>Token invalidation on /auth/logout</div>
                <div>JTI-based revocation tracking</div>
              </div>
            </div>
          </div>
        )}

        {/* Audit Tab */}
        {activeTab === "audit" && (
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-5">
            <h3 className="mb-1 text-sm font-semibold text-red-400">{t("auditSection")}</h3>
            <p className="mb-4 text-xs text-zinc-500">{t("auditDescription")}</p>
            {loading ? (
              <p className="text-sm text-zinc-500">Loading...</p>
            ) : auditLogs.length === 0 ? (
              <p className="text-sm text-zinc-500">{t("noAuditLogs")}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-zinc-800 text-zinc-500">
                      <th className="pb-2 pr-4">{t("eventType")}</th>
                      <th className="pb-2 pr-4">{t("user")}</th>
                      <th className="pb-2 pr-4">{t("timestamp")}</th>
                      <th className="pb-2">{t("details")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="border-b border-zinc-900">
                        <td className="py-2 pr-4">
                          <span className="rounded bg-zinc-800 px-2 py-0.5 font-mono text-red-300">
                            {log.event_type}
                          </span>
                        </td>
                        <td className="py-2 pr-4 text-zinc-400">
                          {log.user_id ? log.user_id.slice(0, 8) + "..." : "system"}
                        </td>
                        <td className="py-2 pr-4 text-zinc-500">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td className="py-2 text-zinc-500">
                          {log.entity_type && `${log.entity_type}`}
                          {log.meta && Object.keys(log.meta).length > 0 && (
                            <span className="ml-2 text-zinc-600">
                              {JSON.stringify(log.meta).slice(0, 80)}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Compliance Tab */}
        {activeTab === "compliance" && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-5">
              <h3 className="mb-3 text-sm font-semibold text-red-400">{t("dataRetention")}</h3>
              <p className="text-sm text-zinc-400">{t("retentionPolicy")}</p>
              <div className="mt-3 space-y-2 text-xs text-zinc-500">
                <div className="flex justify-between">
                  <span>Audit logs</span>
                  <span className="text-zinc-300">90 days (default)</span>
                </div>
                <div className="flex justify-between">
                  <span>User sessions</span>
                  <span className="text-zinc-300">7 days</span>
                </div>
                <div className="flex justify-between">
                  <span>Revoked tokens</span>
                  <span className="text-zinc-300">Auto-cleaned on expiry</span>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-5">
              <h3 className="mb-3 text-sm font-semibold text-red-400">RBAC</h3>
              <div className="space-y-2 text-xs text-zinc-500">
                <div>8 role types with granular permissions</div>
                <div>Org-level permission overrides</div>
                <div>Business-scoped access control</div>
                <div>Partner-separated access model</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
