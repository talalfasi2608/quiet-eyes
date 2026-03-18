"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { useRouter } from "@/i18n/navigation";
import { PageHeader, Card, Button, Tabs, Badge, Input, EmptyState } from "@/components/ui";

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

type TabKey = "permissions" | "policies" | "ops" | "audit";

export default function GovernancePage() {
  const t = useTranslations("dashboard");
  const router = useRouter();
  const token = getToken();

  const [tab, setTab] = useState<TabKey>("permissions");

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

  const tabList = [
    { key: "permissions", label: t("permissionsTab") },
    { key: "policies", label: t("policiesTab") },
    { key: "ops", label: t("opsTab") },
    { key: "audit", label: t("auditTab") },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("governancePage")}
        description={t("governanceSubtitle")}
      />

      {/* Tab bar */}
      <Tabs tabs={tabList} active={tab} onChange={(k) => setTab(k as TabKey)} />

      {/* Permissions Tab */}
      {tab === "permissions" && (
        <Card>
          <h2 className="mb-1 text-sm font-semibold text-gray-100">{t("rolePermissions")}</h2>
          <p className="mb-4 text-xs text-gray-500">{t("rolePermissionsDesc")}</p>

          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className="mb-4 rounded-lg border border-gray-700/50 bg-gray-900 px-3 py-2.5 text-sm text-gray-100 focus:border-gray-500 focus:ring-1 focus:ring-gray-500/30 focus:outline-none"
          >
            {ALL_ROLES.map((r) => (
              <option key={r} value={r}>
                {t(ROLE_LABEL_KEYS[r] || r)}
              </option>
            ))}
          </select>

          <div className="space-y-2">
            {ALL_PERMISSIONS.map((p) => (
              <label key={p} className="flex items-center gap-2 text-xs text-gray-300">
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
            <Button size="sm" onClick={savePermissions} loading={savingPerms}>
              {savingPerms ? t("savingPermissions") : t("savePermissions")}
            </Button>
            {permMsg && <span className="text-xs text-green-400">{permMsg}</span>}
          </div>
        </Card>
      )}

      {/* Policies Tab */}
      {tab === "policies" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-100">{t("approvalPolicies")}</h2>
              <p className="text-xs text-gray-500">{t("approvalPoliciesDesc")}</p>
            </div>
            <Button size="sm" onClick={() => setShowPolicyForm(!showPolicyForm)}>
              {t("createPolicy")}
            </Button>
          </div>

          {showPolicyForm && (
            <Card>
              <div className="space-y-3">
                <Input
                  value={policyName}
                  onChange={(e) => setPolicyName(e.target.value)}
                  placeholder={t("policyName")}
                />
                <Input
                  value={policyDesc}
                  onChange={(e) => setPolicyDesc(e.target.value)}
                  placeholder={t("policyDescription")}
                />
                <Input
                  value={policyActionType}
                  onChange={(e) => setPolicyActionType(e.target.value)}
                  placeholder={t("actionType")}
                />
                <label className="flex items-center gap-2 text-xs text-gray-300">
                  <input
                    type="checkbox"
                    checked={policyAutoApprove}
                    onChange={(e) => setPolicyAutoApprove(e.target.checked)}
                    className="rounded border-gray-600"
                  />
                  {t("autoApprove")}
                </label>
                <Button size="sm" onClick={createPolicy}>
                  {t("createPolicy")}
                </Button>
              </div>
            </Card>
          )}

          {policies.length === 0 ? (
            <EmptyState title={t("noPolicies")} />
          ) : (
            <div className="space-y-2">
              {policies.map((p) => (
                <Card key={p.id} className="!p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-medium text-gray-100">{p.name}</div>
                      {p.description && <div className="text-[10px] text-gray-500">{p.description}</div>}
                      <div className="mt-1 flex gap-2">
                        {p.action_type && <Badge variant="default">{t("actionType")}: {p.action_type}</Badge>}
                        {p.auto_approve && <Badge variant="success">{t("autoApprove")}</Badge>}
                        {!p.is_active && <Badge variant="error">{t("disabled")}</Badge>}
                      </div>
                    </div>
                    <Button variant="danger" size="sm" onClick={() => deletePolicy(p.id)}>
                      {t("deletePolicy")}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Ops Tab */}
      {tab === "ops" && (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-gray-100">{t("opsOverview")}</h2>

          {opsOverview && (
            <div className="grid grid-cols-3 gap-3">
              <Card className="!p-3 text-center">
                <div className="text-2xl font-bold text-gray-100">{opsOverview.total_failed_jobs}</div>
                <div className="text-[10px] text-gray-500">{t("totalFailedJobs")}</div>
              </Card>
              {Object.entries(opsOverview.failed_by_status).map(([status, count]) => (
                <Card key={status} className="!p-3 text-center">
                  <div className="text-xl font-bold text-gray-100">{count}</div>
                  <div className="text-[10px] text-gray-500">{status}</div>
                </Card>
              ))}
            </div>
          )}

          <div>
            <h3 className="mb-2 text-xs font-semibold text-gray-100">{t("failedJobs")}</h3>
            <p className="mb-3 text-[10px] text-gray-500">{t("failedJobsDesc")}</p>
          </div>

          {failedJobs.length === 0 ? (
            <EmptyState title={t("noFailedJobs")} />
          ) : (
            <div className="space-y-2">
              {failedJobs.map((j) => (
                <Card key={j.id} className="!p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-gray-100">{j.job_type}</span>
                      <Badge variant={j.status === "FAILED" ? "error" : j.status === "RESOLVED" ? "success" : "warning"}>
                        {j.status}
                      </Badge>
                    </div>
                    <div className="flex gap-1">
                      {j.status === "FAILED" && (
                        <>
                          <Button variant="secondary" size="sm" onClick={() => retryJob(j.id)}>{t("retryJob")}</Button>
                          <Button variant="ghost" size="sm" onClick={() => resolveJob(j.id)}>{t("resolveJob")}</Button>
                        </>
                      )}
                    </div>
                  </div>
                  {j.error_message && <div className="mt-1 truncate text-[10px] text-red-400">{j.error_message}</div>}
                  <div className="mt-1 text-[10px] text-gray-500">
                    {t("jobRetries")}: {j.retry_count}/{j.max_retries} &middot; {new Date(j.created_at).toLocaleString()}
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Recent audit events */}
          {opsOverview && opsOverview.recent_audit_events.length > 0 && (
            <div className="mt-6">
              <h3 className="mb-2 text-xs font-semibold text-gray-100">{t("recentAuditEvents")}</h3>
              <div className="space-y-1">
                {opsOverview.recent_audit_events.map((e) => (
                  <div key={e.id} className="flex items-center justify-between rounded-lg border border-gray-800/50 bg-gray-900/50 px-3 py-1.5 text-[10px]">
                    <span className="font-medium text-gray-100">{e.event_type}</span>
                    <span className="text-gray-500">{e.entity_type} &middot; {new Date(e.created_at).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Audit Tab */}
      {tab === "audit" && (
        <div className="space-y-4">
          <div>
            <h2 className="mb-1 text-sm font-semibold text-gray-100">{t("auditReports")}</h2>
            <p className="mb-4 text-xs text-gray-500">{t("auditReportsDesc")}</p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {([
              { key: "audit", label: t("exportAudit") },
              { key: "approvals", label: t("exportApprovals") },
              { key: "integrations", label: t("exportIntegrations") },
            ] as const).map((item) => (
              <Card
                key={item.key}
                hover
                onClick={() => exportReport(item.key)}
                className={`text-center ${exportingType !== null ? "opacity-50 pointer-events-none" : ""}`}
              >
                <div className="text-xs font-medium text-gray-100">{item.label}</div>
                {exportingType === item.key && (
                  <div className="mt-1 text-[10px] text-gray-400">{t("exporting")}</div>
                )}
              </Card>
            ))}
          </div>

          {exportMsg && <p className="mt-3 text-xs text-green-400">{exportMsg}</p>}
        </div>
      )}
    </div>
  );
}
