"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { useRouter } from "@/i18n/navigation";
import Topbar from "@/components/Topbar";

interface AgencyBusinessSummary {
  business_id: string;
  business_name: string;
  category: string | null;
  pending_approvals: number;
  total_leads: number;
  new_leads: number;
  active_campaigns: number;
  published_campaigns: number;
}

interface AgencyOverview {
  total_clients: number;
  total_pending_approvals: number;
  total_new_leads: number;
  total_active_campaigns: number;
  businesses: AgencyBusinessSummary[];
}

interface OrgInfo {
  id: string;
  name: string;
  display_name: string | null;
  logo_url: string | null;
  primary_color: string | null;
}

interface DigestItem {
  id: string;
  business_id: string;
  date: string;
  summary: string | null;
  items: Record<string, unknown> | null;
  created_at: string;
}

export default function AgencyPage() {
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const router = useRouter();
  const token = getToken();

  const [overview, setOverview] = useState<AgencyOverview | null>(null);
  const [org, setOrg] = useState<OrgInfo | null>(null);
  const [digests, setDigests] = useState<DigestItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Branding state
  const [showBranding, setShowBranding] = useState(false);
  const [brandDisplayName, setBrandDisplayName] = useState("");
  const [brandLogoUrl, setBrandLogoUrl] = useState("");
  const [brandColor, setBrandColor] = useState("");
  const [savingBrand, setSavingBrand] = useState(false);

  useEffect(() => {
    if (!token) router.push("/login");
  }, [token, router]);

  const loadOverview = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [ov, o, d] = await Promise.all([
        apiFetch<AgencyOverview>("/agency/overview", { token }),
        apiFetch<OrgInfo>("/org", { token }),
        apiFetch<DigestItem[]>("/agency/digests", { token }),
      ]);
      setOverview(ov);
      setOrg(o);
      setDigests(d);
      setBrandDisplayName(o.display_name || "");
      setBrandLogoUrl(o.logo_url || "");
      setBrandColor(o.primary_color || "");
    } catch { /* empty */ } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  async function handleSaveBranding() {
    if (!token) return;
    setSavingBrand(true);
    try {
      await apiFetch("/org/branding", {
        method: "PATCH",
        token,
        body: JSON.stringify({
          display_name: brandDisplayName.trim() || null,
          logo_url: brandLogoUrl.trim() || null,
          primary_color: brandColor.trim() || null,
        }),
      });
      loadOverview();
      setShowBranding(false);
    } catch { /* ignore */ } finally {
      setSavingBrand(false);
    }
  }

  if (!token) return null;

  return (
    <div className="flex h-screen flex-col">
      <Topbar />
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-5xl">
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold">{t("agencyOverview")}</h1>
              <p className="text-xs text-gray-500">{org?.name}</p>
            </div>
            <button
              onClick={() => setShowBranding(!showBranding)}
              className="rounded-lg border border-gray-700 px-3 py-1.5 text-xs text-gray-400 hover:bg-gray-800"
            >
              {t("whiteLabelSettings")}
            </button>
          </div>

          {/* White-label branding form */}
          {showBranding && (
            <section className="mb-6 rounded-lg border border-indigo-800 bg-gray-900 p-4">
              <h3 className="mb-3 text-sm font-semibold text-indigo-300">{t("whiteLabelSettings")}</h3>
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs text-gray-400">{t("brandDisplayName")}</label>
                  <input
                    value={brandDisplayName}
                    onChange={(e) => setBrandDisplayName(e.target.value)}
                    className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                    placeholder={t("brandDisplayNamePlaceholder")}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-400">{t("brandLogoUrl")}</label>
                  <input
                    value={brandLogoUrl}
                    onChange={(e) => setBrandLogoUrl(e.target.value)}
                    className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                    placeholder="https://..."
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-400">{t("brandPrimaryColor")}</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={brandColor || "#6366f1"}
                      onChange={(e) => setBrandColor(e.target.value)}
                      className="h-8 w-8 cursor-pointer rounded border border-gray-700"
                    />
                    <input
                      value={brandColor}
                      onChange={(e) => setBrandColor(e.target.value)}
                      className="w-32 rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                      placeholder="#6366f1"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowBranding(false)}
                    className="rounded-lg border border-gray-700 px-4 py-1.5 text-xs text-gray-400 hover:bg-gray-800"
                  >
                    {tc("cancel")}
                  </button>
                  <button
                    onClick={handleSaveBranding}
                    disabled={savingBrand}
                    className="rounded-lg bg-indigo-700 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-600 disabled:opacity-50"
                  >
                    {savingBrand ? tc("loading") : tc("save")}
                  </button>
                </div>
              </div>
            </section>
          )}

          {loading ? (
            <p className="py-8 text-center text-sm text-gray-500">{tc("loading")}</p>
          ) : overview ? (
            <>
              {/* Summary cards */}
              <div className="mb-6 grid grid-cols-4 gap-3">
                <div className="rounded-lg border border-gray-800 bg-gray-900 p-4 text-center">
                  <p className="text-2xl font-bold">{overview.total_clients}</p>
                  <p className="text-[10px] uppercase text-gray-500">{t("totalClients")}</p>
                </div>
                <div className="rounded-lg border border-gray-800 bg-gray-900 p-4 text-center">
                  <p className="text-2xl font-bold text-yellow-400">{overview.total_pending_approvals}</p>
                  <p className="text-[10px] uppercase text-gray-500">{t("pendingApprovals")}</p>
                </div>
                <div className="rounded-lg border border-gray-800 bg-gray-900 p-4 text-center">
                  <p className="text-2xl font-bold text-green-400">{overview.total_new_leads}</p>
                  <p className="text-[10px] uppercase text-gray-500">{t("newLeadsCount")}</p>
                </div>
                <div className="rounded-lg border border-gray-800 bg-gray-900 p-4 text-center">
                  <p className="text-2xl font-bold text-indigo-400">{overview.total_active_campaigns}</p>
                  <p className="text-[10px] uppercase text-gray-500">{t("activeCampaigns")}</p>
                </div>
              </div>

              {/* Per-client breakdown */}
              <h2 className="mb-3 text-sm font-semibold text-gray-400">{t("clientBreakdown")}</h2>
              <div className="space-y-2">
                {overview.businesses.map((biz) => (
                  <div
                    key={biz.business_id}
                    onClick={() => router.push(`/dashboard/${biz.business_id}`)}
                    className="flex cursor-pointer items-center justify-between rounded-lg border border-gray-800 bg-gray-900 p-4 hover:border-gray-700"
                  >
                    <div>
                      <p className="text-sm font-medium">{biz.business_name}</p>
                      {biz.category && (
                        <span className="text-[10px] text-gray-500">{biz.category}</span>
                      )}
                    </div>
                    <div className="flex gap-4 text-xs">
                      {biz.pending_approvals > 0 && (
                        <span className="rounded bg-yellow-900 px-2 py-0.5 text-yellow-300">
                          {biz.pending_approvals} {t("pendingApprovals")}
                        </span>
                      )}
                      <span className="text-gray-500">
                        {biz.new_leads} {t("newLeadsCount")}
                      </span>
                      <span className="text-gray-500">
                        {biz.active_campaigns} {t("activeCampaigns")}
                      </span>
                      {biz.published_campaigns > 0 && (
                        <span className="text-emerald-400">
                          {biz.published_campaigns} {t("statusPublished")}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Bulk digests */}
              {digests.length > 0 && (
                <section className="mt-8">
                  <h2 className="mb-3 text-sm font-semibold text-gray-400">{t("agencyDigests")}</h2>
                  <div className="space-y-2">
                    {digests.map((d) => (
                      <div key={d.id} className="rounded-lg border border-gray-800 bg-gray-900 p-4">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-medium">
                            {new Date(d.date).toLocaleDateString()}
                          </p>
                          <span className="text-[10px] text-gray-500">{d.business_id.slice(0, 8)}</span>
                        </div>
                        {d.summary && (
                          <p className="mt-1 text-xs text-gray-400">{d.summary}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          ) : (
            <p className="py-8 text-center text-sm text-gray-500">{t("noItems")}</p>
          )}
        </div>
      </div>
    </div>
  );
}
