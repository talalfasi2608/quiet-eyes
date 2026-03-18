"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { useRouter } from "@/i18n/navigation";
import { PageHeader, Card, Button, Badge } from "@/components/ui";

interface SubscriptionData {
  id: string;
  org_id: string;
  plan: "STARTER" | "PRO" | "PREMIUM";
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  status: "ACTIVE" | "PAST_DUE" | "CANCELED";
  current_period_end: string | null;
  created_at: string;
}

interface UsageData {
  scans_count: number;
  chat_tokens: number;
  exports_count: number;
  approvals_count: number;
  ai_calls_count: number;
  ingestion_count: number;
  estimated_cost_usd: number;
  scans_limit: number;
  chat_limit: number;
  exports_limit: number;
  approvals_limit: number;
  ai_calls_limit: number;
  plan: "STARTER" | "PRO" | "PREMIUM";
}

interface QuotaResource {
  resource: string;
  current: number;
  limit: number;
  period: string;
  pct_used: number;
  status: string;
}

interface QuotaStatus {
  plan: string;
  resources: QuotaResource[];
  warnings: QuotaResource[];
}

const PLANS = [
  { key: "STARTER" as const },
  { key: "PRO" as const },
  { key: "PREMIUM" as const },
] as const;

export default function BillingPage() {
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const router = useRouter();
  const { businessId } = useParams<{ businessId: string }>();
  const token = getToken();

  const [sub, setSub] = useState<SubscriptionData | null>(null);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [quota, setQuota] = useState<QuotaStatus | null>(null);

  useEffect(() => {
    if (!token) router.push("/login");
  }, [token, router]);

  const loadData = useCallback(async () => {
    if (!token) return;
    try {
      const [s, u] = await Promise.all([
        apiFetch<SubscriptionData>("/billing/subscription", { token }),
        apiFetch<UsageData>("/billing/usage", { token }),
      ]);
      setSub(s);
      setUsage(u);

      try {
        const q = await apiFetch<QuotaStatus>("/ops/quota/status", { token });
        setQuota(q);
      } catch {
        /* not admin — that's ok */
      }
    } catch {
      /* empty */
    }
  }, [token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleUpgrade(plan: "STARTER" | "PRO" | "PREMIUM") {
    if (!token) return;
    try {
      const res = await apiFetch<{ checkout_url: string }>("/billing/checkout", {
        method: "POST",
        token,
        body: JSON.stringify({
          plan,
          success_url: `${window.location.origin}/en/dashboard/${businessId}/billing?success=true`,
          cancel_url: `${window.location.origin}/en/dashboard/${businessId}/billing?canceled=true`,
        }),
      });
      if (res.checkout_url.startsWith("http")) {
        window.location.href = res.checkout_url;
      } else {
        loadData();
      }
    } catch {
      /* empty */
    }
  }

  function UsageBar({
    label,
    current,
    limit,
  }: {
    label: string;
    current: number;
    limit: number;
    warning?: boolean;
  }) {
    const pct = limit > 0 ? Math.min(100, (current / limit) * 100) : 0;
    const isOver = current >= limit;
    const isWarning = !isOver && pct >= 80;
    return (
      <div className="mb-3">
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="text-gray-400">{label}</span>
          <span
            className={
              isOver
                ? "font-semibold text-red-400"
                : isWarning
                  ? "font-semibold text-yellow-400"
                  : "text-gray-500"
            }
          >
            {current} / {limit}
            {isWarning && (
              <span className="ml-2 text-yellow-500">{t("warningThreshold")}</span>
            )}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-800">
          <div
            className={`h-2 rounded-full transition-all ${
              isOver ? "bg-red-500" : isWarning ? "bg-yellow-500" : pct > 60 ? "bg-white/40" : "bg-white/60"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    );
  }

  if (!token) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("billingPage")}
        description={t("billingSubtitle")}
      />

      {/* Quota warnings */}
      {quota && quota.warnings.length > 0 && (
        <Card className="!border-yellow-700/50">
          <h3 className="mb-2 text-sm font-semibold text-yellow-300">{t("quotaStatus")}</h3>
          <div className="space-y-1">
            {quota.warnings.map((w) => (
              <div key={w.resource} className="flex items-center justify-between text-xs">
                <span className={w.status === "exceeded" ? "text-red-300" : "text-yellow-300"}>
                  {w.resource}: {w.current}/{w.limit} ({w.pct_used}%)
                </span>
                <Badge variant={w.status === "exceeded" ? "error" : "warning"}>
                  {w.status === "exceeded" ? t("quotaExceeded_label") : t("quotaWarning")}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Plans */}
      <div className="grid grid-cols-3 gap-3">
        {PLANS.map(({ key }) => {
          const isCurrent = sub?.plan === key;
          const planLabel = t(`plan${key.charAt(0) + key.slice(1).toLowerCase()}`);
          const priceLabel = t(`plan${key.charAt(0) + key.slice(1).toLowerCase()}Price`);
          const descLabel = t(`plan${key.charAt(0) + key.slice(1).toLowerCase()}Desc`);
          return (
            <Card
              key={key}
              className={isCurrent ? "!border-gray-600 ring-2 ring-white/10" : ""}
            >
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-100">{planLabel}</h3>
                {isCurrent && (
                  <Badge variant="success">{t("currentPlanBadge")}</Badge>
                )}
              </div>
              <p className="mb-1 text-lg font-bold text-gray-100">{priceLabel}</p>
              <p className="mb-3 text-xs text-gray-500">{descLabel}</p>
              {!isCurrent && (
                <Button size="sm" className="w-full" onClick={() => handleUpgrade(key)}>
                  {t("upgrade")}
                </Button>
              )}
            </Card>
          );
        })}
      </div>

      {/* Usage */}
      {usage && (
        <Card>
          <h2 className="mb-4 text-sm font-semibold text-gray-100">{t("usageTitle")}</h2>
          <UsageBar label={t("scansUsage")} current={usage.scans_count} limit={usage.scans_limit} />
          <UsageBar label={t("chatUsage")} current={usage.chat_tokens} limit={usage.chat_limit} />
          <UsageBar label={t("exportsUsage")} current={usage.exports_count} limit={usage.exports_limit} />
          <UsageBar label={t("approvalsUsage")} current={usage.approvals_count} limit={usage.approvals_limit} />
          <UsageBar label={t("aiCallsUsage")} current={usage.ai_calls_count} limit={usage.ai_calls_limit} />
        </Card>
      )}

      {/* Cost insight panel */}
      {usage && (
        <Card>
          <h2 className="mb-4 text-sm font-semibold text-gray-100">{t("costBreakdown")}</h2>
          <div className="grid grid-cols-3 gap-3">
            <Card className="!p-3 text-center">
              <p className="text-lg font-bold text-blue-400">${usage.estimated_cost_usd.toFixed(4)}</p>
              <p className="text-[10px] text-gray-500">{t("estimatedCost")}</p>
            </Card>
            <Card className="!p-3 text-center">
              <p className="text-lg font-bold text-purple-400">{usage.ai_calls_count}</p>
              <p className="text-[10px] text-gray-500">{t("aiCalls")}</p>
            </Card>
            <Card className="!p-3 text-center">
              <p className="text-lg font-bold text-green-400">{usage.ingestion_count}</p>
              <p className="text-[10px] text-gray-500">{t("ingestion")}</p>
            </Card>
          </div>
        </Card>
      )}
    </div>
  );
}
