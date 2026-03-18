"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { useRouter } from "@/i18n/navigation";
import { PageHeader, Card, Button, Tabs, Badge, Input, EmptyState } from "@/components/ui";

/* ── Types ── */

interface PartnerInfo {
  id: string;
  name: string;
  contact_email: string;
  contact_name: string | null;
  status: string;
  region: string | null;
  tier: string | null;
  commission_pct: number | null;
  created_at: string;
}

interface PartnerAnalytics {
  total_orgs: number;
  total_businesses: number;
  total_referrals: number;
  accepted_referrals: number;
  active_subscriptions: number;
  estimated_revenue: number;
}

interface PortfolioOrg {
  org_id: string;
  org_name: string;
  display_name: string | null;
  business_count: number;
  businesses: { id: string; name: string; category: string | null; region: string | null }[];
  subscription_status: string | null;
  plan: string | null;
}

interface ReferralItem {
  id: string;
  referral_code: string;
  invitee_email: string | null;
  org_id: string | null;
  status: string;
  created_at: string;
  accepted_at: string | null;
}

type Tab = "portfolio" | "referrals" | "analytics";

const STATUS_BADGE_VARIANT: Record<string, "default" | "success" | "warning" | "error" | "info"> = {
  ACTIVE: "success",
  SUSPENDED: "error",
  PENDING: "warning",
};

const REF_STATUS_BADGE: Record<string, "default" | "success" | "warning" | "error" | "info"> = {
  PENDING: "warning",
  ACCEPTED: "success",
  EXPIRED: "default",
  REVOKED: "error",
};

export default function PartnersPage() {
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const router = useRouter();
  const params = useParams<{ businessId: string }>();
  const businessId = params.businessId;
  const token = getToken();

  const [tab, setTab] = useState<Tab>("portfolio");
  const [partner, setPartner] = useState<PartnerInfo | null>(null);
  const [analytics, setAnalytics] = useState<PartnerAnalytics | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioOrg[]>([]);
  const [referrals, setReferrals] = useState<ReferralItem[]>([]);
  const [noPartner, setNoPartner] = useState(false);

  // Create partner form
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [creating, setCreating] = useState(false);

  // Create referral
  const [refEmail, setRefEmail] = useState("");
  const [creatingRef, setCreatingRef] = useState(false);
  const [refMsg, setRefMsg] = useState("");

  useEffect(() => {
    if (!token) router.push("/login");
  }, [token, router]);

  const loadPartner = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiFetch<PartnerInfo>("/partners/me", { token });
      setPartner(data);
      setNoPartner(false);
    } catch {
      setNoPartner(true);
    }
  }, [token]);

  const loadAnalytics = useCallback(async () => {
    if (!token || !partner) return;
    try {
      const data = await apiFetch<PartnerAnalytics>(
        `/partners/${partner.id}/analytics`,
        { token },
      );
      setAnalytics(data);
    } catch { /* empty */ }
  }, [token, partner]);

  const loadPortfolio = useCallback(async () => {
    if (!token || !partner) return;
    try {
      const data = await apiFetch<PortfolioOrg[]>(
        `/partners/${partner.id}/portfolio`,
        { token },
      );
      setPortfolio(data);
    } catch { /* empty */ }
  }, [token, partner]);

  const loadReferrals = useCallback(async () => {
    if (!token || !partner) return;
    try {
      const data = await apiFetch<ReferralItem[]>(
        `/partners/${partner.id}/referrals`,
        { token },
      );
      setReferrals(data);
    } catch { /* empty */ }
  }, [token, partner]);

  useEffect(() => { loadPartner(); }, [loadPartner]);

  useEffect(() => {
    if (!partner) return;
    if (tab === "portfolio") loadPortfolio();
    else if (tab === "referrals") loadReferrals();
    else if (tab === "analytics") loadAnalytics();
  }, [tab, partner, loadPortfolio, loadReferrals, loadAnalytics]);

  async function createPartner() {
    if (!token || !createName || !createEmail) return;
    setCreating(true);
    try {
      await apiFetch("/partners", {
        token,
        method: "POST",
        body: JSON.stringify({ name: createName, contact_email: createEmail }),
      });
      setShowCreate(false);
      loadPartner();
    } catch { /* empty */ }
    setCreating(false);
  }

  async function createReferral() {
    if (!token || !partner) return;
    setCreatingRef(true);
    setRefMsg("");
    try {
      const ref = await apiFetch<ReferralItem>(
        `/partners/${partner.id}/referrals`,
        {
          token,
          method: "POST",
          body: JSON.stringify({ invitee_email: refEmail || null }),
        },
      );
      setRefMsg(`${t("referralCreated")}: ${ref.referral_code}`);
      setRefEmail("");
      loadReferrals();
    } catch {
      setRefMsg("Error");
    }
    setCreatingRef(false);
  }

  if (!token) return null;

  const tabList = [
    { key: "portfolio", label: t("partnerPortfolio") },
    { key: "referrals", label: t("partnerReferrals") },
    { key: "analytics", label: t("partnerAnalytics") },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("partnerDashboard")}
        description={t("partnerSubtitle")}
      />

      {/* No partner -- show create */}
      {noPartner && !showCreate && (
        <EmptyState
          title={t("noPartnerAccount")}
          action={
            <Button size="sm" onClick={() => setShowCreate(true)}>
              {t("becomePartner")}
            </Button>
          }
        />
      )}

      {showCreate && (
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-gray-100">{t("becomePartner")}</h3>
          <div className="space-y-3">
            <Input
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder={t("partnerName")}
            />
            <Input
              value={createEmail}
              onChange={(e) => setCreateEmail(e.target.value)}
              placeholder={t("partnerEmail")}
            />
            <Button onClick={createPartner} loading={creating}>
              {creating ? tc("loading") : t("createPartner")}
            </Button>
          </div>
        </Card>
      )}

      {/* Partner info card */}
      {partner && (
        <>
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-gray-100">{partner.name}</h2>
                  <Badge variant={STATUS_BADGE_VARIANT[partner.status] || "default"}>
                    {partner.status}
                  </Badge>
                  {partner.tier && (
                    <Badge variant="default">{partner.tier}</Badge>
                  )}
                </div>
                <p className="mt-0.5 text-[10px] text-gray-500">{partner.contact_email}</p>
              </div>
              {partner.commission_pct !== null && (
                <div className="text-right">
                  <div className="text-[10px] text-gray-500">{t("commission")}</div>
                  <div className="text-sm font-bold text-teal-400">{partner.commission_pct}%</div>
                </div>
              )}
            </div>
          </Card>

          {/* Tab bar */}
          <Tabs tabs={tabList} active={tab} onChange={(k) => setTab(k as Tab)} />

          {/* Portfolio tab */}
          {tab === "portfolio" && (
            <div className="space-y-3">
              {portfolio.length === 0 ? (
                <EmptyState title={t("noPortfolioClients")} />
              ) : (
                portfolio.map((org) => (
                  <Card key={org.org_id} className="!p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-100">{org.display_name || org.org_name}</span>
                        {org.plan && (
                          <Badge variant="default">{org.plan}</Badge>
                        )}
                        {org.subscription_status && (
                          <Badge variant={org.subscription_status === "ACTIVE" ? "success" : "default"}>
                            {org.subscription_status}
                          </Badge>
                        )}
                      </div>
                      <span className="text-[10px] text-gray-500">
                        {org.business_count} {t("businessesCount")}
                      </span>
                    </div>
                    {org.businesses.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {org.businesses.map((b) => (
                          <div key={b.id} className="flex items-center gap-2 rounded-lg border border-gray-800/50 bg-gray-900/50 px-2 py-1">
                            <span className="text-[10px] font-medium text-gray-300">{b.name}</span>
                            {b.category && <span className="text-[10px] text-gray-500">{b.category}</span>}
                            {b.region && <Badge variant="default">{b.region}</Badge>}
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                ))
              )}
            </div>
          )}

          {/* Referrals tab */}
          {tab === "referrals" && (
            <div className="space-y-3">
              {/* Create referral */}
              <Card className="!p-3">
                <div className="flex items-center gap-2">
                  <Input
                    value={refEmail}
                    onChange={(e) => setRefEmail(e.target.value)}
                    placeholder={t("referralEmailPlaceholder")}
                    className="flex-1"
                  />
                  <Button size="sm" onClick={createReferral} loading={creatingRef}>
                    {creatingRef ? tc("loading") : t("createReferral")}
                  </Button>
                </div>
                {refMsg && <p className="mt-1 text-xs text-green-400">{refMsg}</p>}
              </Card>

              {referrals.length === 0 ? (
                <EmptyState title={t("noReferrals")} />
              ) : (
                referrals.map((ref) => (
                  <Card key={ref.id} className="!p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <code className="rounded-md bg-gray-800/50 px-2 py-0.5 text-[10px] text-teal-300">
                          {ref.referral_code}
                        </code>
                        <Badge variant={REF_STATUS_BADGE[ref.status] || "default"}>
                          {ref.status}
                        </Badge>
                      </div>
                      <span className="text-[10px] text-gray-500">
                        {new Date(ref.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    {ref.invitee_email && (
                      <p className="mt-1 text-[10px] text-gray-500">{ref.invitee_email}</p>
                    )}
                    {ref.accepted_at && (
                      <p className="mt-0.5 text-[10px] text-green-500">
                        {t("acceptedAt")}: {new Date(ref.accepted_at).toLocaleDateString()}
                      </p>
                    )}
                  </Card>
                ))
              )}
            </div>
          )}

          {/* Analytics tab */}
          {tab === "analytics" && analytics && (
            <div className="grid grid-cols-3 gap-3">
              <Card className="text-center">
                <div className="text-2xl font-bold text-teal-400">{analytics.total_orgs}</div>
                <div className="text-[10px] text-gray-500">{t("partnerTotalOrgs")}</div>
              </Card>
              <Card className="text-center">
                <div className="text-2xl font-bold text-blue-400">{analytics.total_businesses}</div>
                <div className="text-[10px] text-gray-500">{t("partnerTotalBusinesses")}</div>
              </Card>
              <Card className="text-center">
                <div className="text-2xl font-bold text-green-400">{analytics.active_subscriptions}</div>
                <div className="text-[10px] text-gray-500">{t("partnerActiveSubs")}</div>
              </Card>
              <Card className="text-center">
                <div className="text-2xl font-bold text-yellow-400">{analytics.total_referrals}</div>
                <div className="text-[10px] text-gray-500">{t("partnerTotalReferrals")}</div>
              </Card>
              <Card className="text-center">
                <div className="text-2xl font-bold text-emerald-400">{analytics.accepted_referrals}</div>
                <div className="text-[10px] text-gray-500">{t("partnerAcceptedReferrals")}</div>
              </Card>
              <Card className="text-center">
                <div className="text-2xl font-bold text-orange-400">${analytics.estimated_revenue}</div>
                <div className="text-[10px] text-gray-500">{t("partnerEstRevenue")}</div>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}
