"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { useRouter } from "@/i18n/navigation";
import Topbar from "@/components/Topbar";

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

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-900 text-green-300",
  SUSPENDED: "bg-red-900 text-red-300",
  PENDING: "bg-yellow-900 text-yellow-300",
};

const REF_STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-900 text-yellow-300",
  ACCEPTED: "bg-green-900 text-green-300",
  EXPIRED: "bg-gray-800 text-gray-400",
  REVOKED: "bg-red-900 text-red-300",
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

  const tabs: { key: Tab; label: string }[] = [
    { key: "portfolio", label: t("partnerPortfolio") },
    { key: "referrals", label: t("partnerReferrals") },
    { key: "analytics", label: t("partnerAnalytics") },
  ];

  return (
    <div className="flex h-screen flex-col">
      <Topbar />
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-4xl">
          {/* Header */}
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push(`/dashboard/${businessId}`)}
                className="rounded border border-gray-700 px-2 py-1 text-xs text-gray-400 hover:bg-gray-800"
              >
                {tc("back")}
              </button>
              <div>
                <h1 className="text-lg font-semibold">{t("partnerDashboard")}</h1>
                <p className="text-xs text-gray-500">{t("partnerSubtitle")}</p>
              </div>
            </div>
          </div>

          {/* No partner — show create */}
          {noPartner && !showCreate && (
            <div className="mb-4 rounded-lg border border-dashed border-gray-700 px-4 py-8 text-center">
              <p className="mb-3 text-sm text-gray-400">{t("noPartnerAccount")}</p>
              <button
                onClick={() => setShowCreate(true)}
                className="rounded-lg bg-teal-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-teal-500"
              >
                {t("becomePartner")}
              </button>
            </div>
          )}

          {showCreate && (
            <div className="mb-4 rounded-lg border border-gray-700 bg-gray-900 p-4 space-y-3">
              <h3 className="text-sm font-semibold">{t("becomePartner")}</h3>
              <input
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder={t("partnerName")}
                className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-1.5 text-xs"
              />
              <input
                value={createEmail}
                onChange={(e) => setCreateEmail(e.target.value)}
                placeholder={t("partnerEmail")}
                className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-1.5 text-xs"
              />
              <button
                onClick={createPartner}
                disabled={creating}
                className="rounded-lg bg-teal-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-teal-500 disabled:opacity-50"
              >
                {creating ? tc("loading") : t("createPartner")}
              </button>
            </div>
          )}

          {/* Partner info card */}
          {partner && (
            <>
              <div className="mb-4 rounded-lg border border-gray-700 bg-gray-900 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-semibold">{partner.name}</h2>
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${STATUS_COLORS[partner.status] || ""}`}>
                        {partner.status}
                      </span>
                      {partner.tier && (
                        <span className="rounded bg-gray-800 px-1.5 py-0.5 text-[10px] text-gray-400">
                          {partner.tier}
                        </span>
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
              </div>

              {/* Tab bar */}
              <div className="mb-4 flex gap-1 rounded-lg border border-gray-800 bg-gray-900 p-1">
                {tabs.map((tb) => (
                  <button
                    key={tb.key}
                    onClick={() => setTab(tb.key)}
                    className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                      tab === tb.key
                        ? "bg-teal-600 text-white"
                        : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
                    }`}
                  >
                    {tb.label}
                  </button>
                ))}
              </div>

              {/* Portfolio tab */}
              {tab === "portfolio" && (
                <div className="space-y-3">
                  {portfolio.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-gray-800 px-4 py-8 text-center text-xs text-gray-600">
                      {t("noPortfolioClients")}
                    </div>
                  ) : (
                    portfolio.map((org) => (
                      <div key={org.org_id} className="rounded-lg border border-gray-800 bg-gray-900 p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-sm font-medium">{org.display_name || org.org_name}</span>
                            {org.plan && (
                              <span className="ml-2 rounded bg-gray-800 px-1.5 py-0.5 text-[10px] text-gray-400">
                                {org.plan}
                              </span>
                            )}
                            {org.subscription_status && (
                              <span className={`ml-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                                org.subscription_status === "ACTIVE" ? "bg-green-900 text-green-300" : "bg-gray-800 text-gray-400"
                              }`}>
                                {org.subscription_status}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-gray-500">
                            {org.business_count} {t("businessesCount")}
                          </span>
                        </div>
                        {org.businesses.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {org.businesses.map((b) => (
                              <div key={b.id} className="flex items-center gap-2 rounded border border-gray-800 bg-gray-950 px-2 py-1">
                                <span className="text-[10px] font-medium text-gray-300">{b.name}</span>
                                {b.category && <span className="text-[10px] text-gray-500">{b.category}</span>}
                                {b.region && <span className="rounded bg-gray-800 px-1 py-0.5 text-[10px] text-gray-500">{b.region}</span>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Referrals tab */}
              {tab === "referrals" && (
                <div className="space-y-3">
                  {/* Create referral */}
                  <div className="rounded-lg border border-gray-700 bg-gray-900 p-3">
                    <div className="flex items-center gap-2">
                      <input
                        value={refEmail}
                        onChange={(e) => setRefEmail(e.target.value)}
                        placeholder={t("referralEmailPlaceholder")}
                        className="flex-1 rounded-lg border border-gray-700 bg-gray-950 px-3 py-1.5 text-xs"
                      />
                      <button
                        onClick={createReferral}
                        disabled={creatingRef}
                        className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-500 disabled:opacity-50"
                      >
                        {creatingRef ? tc("loading") : t("createReferral")}
                      </button>
                    </div>
                    {refMsg && <p className="mt-1 text-xs text-green-400">{refMsg}</p>}
                  </div>

                  {referrals.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-gray-800 px-4 py-8 text-center text-xs text-gray-600">
                      {t("noReferrals")}
                    </div>
                  ) : (
                    referrals.map((ref) => (
                      <div key={ref.id} className="rounded-lg border border-gray-800 bg-gray-900 p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <code className="rounded bg-gray-800 px-2 py-0.5 text-[10px] text-teal-300">
                              {ref.referral_code}
                            </code>
                            <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${REF_STATUS_COLORS[ref.status] || ""}`}>
                              {ref.status}
                            </span>
                          </div>
                          <span className="text-[10px] text-gray-600">
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
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Analytics tab */}
              {tab === "analytics" && analytics && (
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg border border-gray-800 bg-gray-900 p-4 text-center">
                    <div className="text-2xl font-bold text-teal-400">{analytics.total_orgs}</div>
                    <div className="text-[10px] text-gray-500">{t("partnerTotalOrgs")}</div>
                  </div>
                  <div className="rounded-lg border border-gray-800 bg-gray-900 p-4 text-center">
                    <div className="text-2xl font-bold text-blue-400">{analytics.total_businesses}</div>
                    <div className="text-[10px] text-gray-500">{t("partnerTotalBusinesses")}</div>
                  </div>
                  <div className="rounded-lg border border-gray-800 bg-gray-900 p-4 text-center">
                    <div className="text-2xl font-bold text-green-400">{analytics.active_subscriptions}</div>
                    <div className="text-[10px] text-gray-500">{t("partnerActiveSubs")}</div>
                  </div>
                  <div className="rounded-lg border border-gray-800 bg-gray-900 p-4 text-center">
                    <div className="text-2xl font-bold text-yellow-400">{analytics.total_referrals}</div>
                    <div className="text-[10px] text-gray-500">{t("partnerTotalReferrals")}</div>
                  </div>
                  <div className="rounded-lg border border-gray-800 bg-gray-900 p-4 text-center">
                    <div className="text-2xl font-bold text-emerald-400">{analytics.accepted_referrals}</div>
                    <div className="text-[10px] text-gray-500">{t("partnerAcceptedReferrals")}</div>
                  </div>
                  <div className="rounded-lg border border-gray-800 bg-gray-900 p-4 text-center">
                    <div className="text-2xl font-bold text-orange-400">${analytics.estimated_revenue}</div>
                    <div className="text-[10px] text-gray-500">{t("partnerEstRevenue")}</div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
