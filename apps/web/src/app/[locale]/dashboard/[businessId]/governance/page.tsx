"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { useRouter } from "@/i18n/navigation";
import Topbar from "@/components/Topbar";

/* ── Types ── */

interface RolePermissionMapping {
  role: string;
  permissions: string[];
}

interface ApprovalPolicy {
  id: string;
  name: string;
  description: string | null;
  action_type: string | null;
  conditions: Record<string, unknown> | null;
  required_role: string | null;
  auto_approve: boolean;
  is_active: boolean;
  priority: number;
  created_at: string;
}

interface FailedJob {
  id: string;
  job_type: string;
  job_id: string | null;
  business_id: string | null;
  error_message: string | null;
  retry_count: number;
  max_retries: number;
  status: string;
  created_at: string;
}

interface OpsOverview {
  total_failed_jobs: number;
  failed_by_status: Record<string, number>;
  recent_audit_events: { id: string; event_type: string; entity_type: string; created_at: string; user_id: string | null }[];
}

const ALL_ROLES = ["OWNER", "ADMIN", "MEMBER", "ANALYST", "MARKETING_MANAGER", "APPROVER", "BILLING_ADMIN", "CLIENT_VIEWER"];
const ALL_PERMISSIONS = [
  "VIEW_FEED", "MANAGE_CAMPAIGNS", "APPROVE_ACTIONS",
  "MANAGE_INTEGRATIONS", "MANAGE_BILLING", "MANAGE_AUTOPILOT", "MANAGE_PLAYBOOKS",
];

const PERM_LABEL_KEYS: Record<string, string> = {
  VIEW_FEED: "permViewFeed",
  MANAGE_CAMPAIGNS: "permManageCampaigns",
  APPROVE_ACTIONS: "permApproveActions",
  MANAGE_INTEGRATIONS: "permManageIntegrations",
  MANAGE_BILLING: "permManageBilling",
  MANAGE_AUTOPILOT: "permManageAutopilot",
  MANAGE_PLAYBOOKS: "permManagePlaybooks",
};

const ROLE_LABEL_KEYS: Record<string, string> = {
  OWNER: "roleOwner",
  ADMIN: "roleAdmin",
  MEMBER: "roleMember",
  ANALYST: "roleAnalyst",
  MARKETING_MANAGER: "roleMarketingManager",
  APPROVER: "roleApprover",
  BILLING_ADMIN: "roleBillingAdmin",
  CLIENT_VIEWER: "roleClientViewer",
};

type Tab = "permissions" | "policies" | "ops" | "audit";

export default function GovernancePage() {
  const t = useTranslations("dashboard");
  const router = useRouter();
  const token = getToken();

  const [tab, setTab] = useState<Tab>("permissions");

  /* ── Permissions state ── */
  const [selectedRole, setSelectedRole] = useState("MEMBER");
  const [perms, setPerms] = useState<string[]>([]);
  const [permMsg, setPermMsg] = useState("");
  const [savingPerms, setSavingPerms] = useState(false);

  /* ── Policies state ── */
  const [policies, setPolicies] = useState<ApprovalPolicy[]>([]);
  const [showPolicyForm, setShowPolicyForm] = useState(false);
  const [policyName, setPolicyName] = useState("");
  const [policyDesc, setPolicyDesc] = useState("");
  const [policyActionType, setPolicyActionType] = useState("");
  const [policyAutoApprove, setPolicyAutoApprove] = useState(false);

  /* ── Ops state ── */
  const [failedJobs, setFailedJobs] = useState<FailedJob[]>([]);
  const [opsOverview, setOpsOverview] = useState<OpsOverview | null>(null);

  /* ── Audit state ── */
  const [exportingType, setExportingType] = useState<string | null>(null);
  const [exportMsg, setExportMsg] = useState("");

  useEffect(() => {
    if (!token) router.push("/login");
  }, [token, router]);

  /* ── Load role permissions ── */
  const loadPermissions = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiFetch<{ role: string; permissions: string[] }>(
        `/org/permissions/${selectedRole}`,
        { token },
      );
      setPerms(data.permissions);
    } catch { setPerms([]); }
  }, [token, selectedRole]);

  useEffect(() => { loadPermissions(); }, [loadPermissions]);

  async function savePermissions() {
    if (!token) return;
    setSavingPerms(true);
    setPermMsg("");
    try {
      await apiFetch("/org/permissions", {
        token,
        method: "PUT",
        body: JSON.stringify({ role: selectedRole, permissions: perms }),
      });
      setPermMsg(t("permissionsSaved"));
    } catch { setPermMsg("Error"); }
    setSavingPerms(false);
  }

  function togglePerm(p: string) {
    setPerms((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]);
  }

  /* ── Load policies ── */
  const loadPolicies = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiFetch<ApprovalPolicy[]>("/org/approval-policies", { token });
      setPolicies(data);
    } catch { /* empty */ }
  }, [token]);

  useEffect(() => { if (tab === "policies") loadPolicies(); }, [tab, loadPolicies]);

  async function createPolicy() {
    if (!token || !policyName) return;
    try {
      await apiFetch("/org/approval-policies", {
        token,
        method: "POST",
        body: JSON.stringify({
          name: policyName,
          description: policyDesc || null,
          action_type: policyActionType || null,
          auto_approve: policyAutoApprove,
        }),
      });
      setPolicyName("");
      setPolicyDesc("");
      setPolicyActionType("");
      setPolicyAutoApprove(false);
      setShowPolicyForm(false);
      loadPolicies();
    } catch { /* empty */ }
  }

  async function deletePolicy(id: string) {
    if (!token) return;
    try {
      await apiFetch(`/org/approval-policies/${id}`, { token, method: "DELETE" });
      loadPolicies();
    } catch { /* empty */ }
  }

  /* ── Load ops ── */
  const loadOps = useCallback(async () => {
    if (!token) return;
    try {
      const [jobs, overview] = await Promise.all([
        apiFetch<FailedJob[]>("/admin/failed-jobs", { token }),
        apiFetch<OpsOverview>("/admin/ops/overview", { token }),
      ]);
      setFailedJobs(jobs);
      setOpsOverview(overview);
    } catch { /* empty */ }
  }, [token]);

  useEffect(() => { if (tab === "ops") loadOps(); }, [tab, loadOps]);

  async function retryJob(id: string) {
    if (!token) return;
    try {
      await apiFetch(`/admin/failed-jobs/${id}/retry`, { token, method: "POST" });
      loadOps();
    } catch { /* empty */ }
  }

  async function resolveJob(id: string) {
    if (!token) return;
    try {
      await apiFetch(`/admin/failed-jobs/${id}/resolve`, { token, method: "POST" });
      loadOps();
    } catch { /* empty */ }
  }

  /* ── Audit export ── */
  async function exportReport(type: "audit" | "approvals" | "integrations") {
    if (!token) return;
    setExportingType(type);
    setExportMsg("");
    try {
      const data = await apiFetch<{ count: number; records: unknown[] }>(`/admin/${type}/export`, { token });
      const blob = new Blob([JSON.stringify(data.records, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${type}-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setExportMsg(t("exportComplete"));
    } catch { setExportMsg("Error"); }
    setExportingType(null);
  }

  if (!token) return null;

  const tabs: { key: Tab; label: string }[] = [
    { key: "permissions", label: t("permissionsTab") },
    { key: "policies", label: t("policiesTab") },
    { key: "ops", label: t("opsTab") },
    { key: "audit", label: t("auditTab") },
  ];

  return (
    <div className="flex h-screen flex-col">
      <Topbar />
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-4xl">
          <div className="mb-4">
            <h1 className="text-lg font-semibold">{t("governancePage")}</h1>
            <p className="text-xs text-gray-500">{t("governanceSubtitle")}</p>
          </div>

          {/* Tab bar */}
          <div className="mb-6 flex gap-1 rounded-lg border border-gray-800 bg-gray-900 p-1">
            {tabs.map((tb) => (
              <button
                key={tb.key}
                onClick={() => setTab(tb.key)}
                className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  tab === tb.key
                    ? "bg-indigo-600 text-white"
                    : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
                }`}
              >
                {tb.label}
              </button>
            ))}
          </div>

          {/* ═══ Permissions Tab ═══ */}
          {tab === "permissions" && (
            <section>
              <h2 className="mb-1 text-sm font-semibold">{t("rolePermissions")}</h2>
              <p className="mb-4 text-xs text-gray-500">{t("rolePermissionsDesc")}</p>

              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="mb-4 rounded-lg border border-gray-700 bg-gray-900 px-3 py-1.5 text-xs"
              >
                {ALL_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {t(ROLE_LABEL_KEYS[r] || r)}
                  </option>
                ))}
              </select>

              <div className="space-y-2">
                {ALL_PERMISSIONS.map((p) => (
                  <label key={p} className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={perms.includes(p)}
                      onChange={() => togglePerm(p)}
                      className="rounded border-gray-600"
                    />
                    {t(PERM_LABEL_KEYS[p] || p)}
                  </label>
                ))}
              </div>

              <div className="mt-4 flex items-center gap-3">
                <button
                  onClick={savePermissions}
                  disabled={savingPerms}
                  className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  {savingPerms ? t("savingPermissions") : t("savePermissions")}
                </button>
                {permMsg && <span className="text-xs text-green-400">{permMsg}</span>}
              </div>
            </section>
          )}

          {/* ═══ Policies Tab ═══ */}
          {tab === "policies" && (
            <section>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold">{t("approvalPolicies")}</h2>
                  <p className="text-xs text-gray-500">{t("approvalPoliciesDesc")}</p>
                </div>
                <button
                  onClick={() => setShowPolicyForm(!showPolicyForm)}
                  className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500"
                >
                  {t("createPolicy")}
                </button>
              </div>

              {showPolicyForm && (
                <div className="mb-4 rounded-lg border border-gray-700 bg-gray-900 p-4 space-y-3">
                  <input
                    value={policyName}
                    onChange={(e) => setPolicyName(e.target.value)}
                    placeholder={t("policyName")}
                    className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-1.5 text-xs"
                  />
                  <input
                    value={policyDesc}
                    onChange={(e) => setPolicyDesc(e.target.value)}
                    placeholder={t("policyDescription")}
                    className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-1.5 text-xs"
                  />
                  <input
                    value={policyActionType}
                    onChange={(e) => setPolicyActionType(e.target.value)}
                    placeholder={t("actionType")}
                    className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-1.5 text-xs"
                  />
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={policyAutoApprove}
                      onChange={(e) => setPolicyAutoApprove(e.target.checked)}
                      className="rounded border-gray-600"
                    />
                    {t("autoApprove")}
                  </label>
                  <button
                    onClick={createPolicy}
                    className="rounded-lg bg-green-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-green-500"
                  >
                    {t("createPolicy")}
                  </button>
                </div>
              )}

              {policies.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-800 px-4 py-8 text-center text-xs text-gray-600">
                  {t("noPolicies")}
                </div>
              ) : (
                <div className="space-y-2">
                  {policies.map((p) => (
                    <div key={p.id} className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900 p-3">
                      <div>
                        <div className="text-xs font-medium">{p.name}</div>
                        {p.description && <div className="text-[10px] text-gray-500">{p.description}</div>}
                        <div className="mt-1 flex gap-2 text-[10px] text-gray-500">
                          {p.action_type && <span>{t("actionType")}: {p.action_type}</span>}
                          {p.auto_approve && <span className="text-green-400">{t("autoApprove")}</span>}
                          {!p.is_active && <span className="text-red-400">{t("disabled")}</span>}
                        </div>
                      </div>
                      <button
                        onClick={() => deletePolicy(p.id)}
                        className="rounded border border-red-800 px-2 py-1 text-[10px] text-red-400 hover:bg-red-950"
                      >
                        {t("deletePolicy")}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* ═══ Ops Tab ═══ */}
          {tab === "ops" && (
            <section>
              <h2 className="mb-1 text-sm font-semibold">{t("opsOverview")}</h2>

              {opsOverview && (
                <div className="mb-4 grid grid-cols-3 gap-3">
                  <div className="rounded-lg border border-red-800 bg-gray-900 p-3 text-center">
                    <div className="text-2xl font-bold">{opsOverview.total_failed_jobs}</div>
                    <div className="text-[10px] text-gray-500">{t("totalFailedJobs")}</div>
                  </div>
                  {Object.entries(opsOverview.failed_by_status).map(([status, count]) => (
                    <div key={status} className="rounded-lg border border-gray-800 bg-gray-900 p-3 text-center">
                      <div className="text-xl font-bold">{count}</div>
                      <div className="text-[10px] text-gray-500">{status}</div>
                    </div>
                  ))}
                </div>
              )}

              <h3 className="mb-2 text-xs font-semibold">{t("failedJobs")}</h3>
              <p className="mb-3 text-[10px] text-gray-500">{t("failedJobsDesc")}</p>

              {failedJobs.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-800 px-4 py-8 text-center text-xs text-gray-600">
                  {t("noFailedJobs")}
                </div>
              ) : (
                <div className="space-y-2">
                  {failedJobs.map((j) => (
                    <div key={j.id} className="rounded-lg border border-gray-800 bg-gray-900 p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs font-medium">{j.job_type}</span>
                          <span className={`ml-2 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                            j.status === "FAILED" ? "bg-red-900 text-red-300" :
                            j.status === "RESOLVED" ? "bg-green-900 text-green-300" :
                            "bg-yellow-900 text-yellow-300"
                          }`}>{j.status}</span>
                        </div>
                        <div className="flex gap-1">
                          {j.status === "FAILED" && (
                            <>
                              <button onClick={() => retryJob(j.id)} className="rounded border border-blue-800 px-2 py-0.5 text-[10px] text-blue-400 hover:bg-blue-950">{t("retryJob")}</button>
                              <button onClick={() => resolveJob(j.id)} className="rounded border border-green-800 px-2 py-0.5 text-[10px] text-green-400 hover:bg-green-950">{t("resolveJob")}</button>
                            </>
                          )}
                        </div>
                      </div>
                      {j.error_message && <div className="mt-1 truncate text-[10px] text-red-400">{j.error_message}</div>}
                      <div className="mt-1 text-[10px] text-gray-600">
                        {t("jobRetries")}: {j.retry_count}/{j.max_retries} &middot; {new Date(j.created_at).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Recent audit events */}
              {opsOverview && opsOverview.recent_audit_events.length > 0 && (
                <div className="mt-6">
                  <h3 className="mb-2 text-xs font-semibold">{t("recentAuditEvents")}</h3>
                  <div className="space-y-1">
                    {opsOverview.recent_audit_events.map((e) => (
                      <div key={e.id} className="flex items-center justify-between rounded border border-gray-800 bg-gray-950 px-3 py-1.5 text-[10px]">
                        <span className="font-medium">{e.event_type}</span>
                        <span className="text-gray-500">{e.entity_type} &middot; {new Date(e.created_at).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* ═══ Audit Tab ═══ */}
          {tab === "audit" && (
            <section>
              <h2 className="mb-1 text-sm font-semibold">{t("auditReports")}</h2>
              <p className="mb-4 text-xs text-gray-500">{t("auditReportsDesc")}</p>

              <div className="grid grid-cols-3 gap-3">
                {([
                  { key: "audit", label: t("exportAudit"), color: "border-indigo-800" },
                  { key: "approvals", label: t("exportApprovals"), color: "border-green-800" },
                  { key: "integrations", label: t("exportIntegrations"), color: "border-cyan-800" },
                ] as const).map((item) => (
                  <button
                    key={item.key}
                    onClick={() => exportReport(item.key)}
                    disabled={exportingType !== null}
                    className={`rounded-lg border ${item.color} bg-gray-900 p-4 text-center hover:bg-gray-800 disabled:opacity-50`}
                  >
                    <div className="text-xs font-medium">{item.label}</div>
                    {exportingType === item.key && (
                      <div className="mt-1 text-[10px] text-gray-400">{t("exporting")}</div>
                    )}
                  </button>
                ))}
              </div>

              {exportMsg && <p className="mt-3 text-xs text-green-400">{exportMsg}</p>}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
