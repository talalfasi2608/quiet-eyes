"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { useRouter } from "@/i18n/navigation";
import { PageHeader, Card, SectionHeader, Button, Badge, Input, Modal } from "@/components/ui";

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
    <div className="space-y-6">
      <PageHeader
        title={t("agencyOverview")}
        description={org?.name}
        actions={
          <Button variant="secondary" size="sm" onClick={() => setShowBranding(!showBranding)}>
            {t("whiteLabelSettings")}
          </Button>
        }
      />

      {/* White-label branding modal */}
      <Modal open={showBranding} onClose={() => setShowBranding(false)} title={t("whiteLabelSettings")}>
        <div className="space-y-3">
          <Input
            label={t("brandDisplayName")}
            value={brandDisplayName}
            onChange={(e) => setBrandDisplayName(e.target.value)}
            placeholder={t("brandDisplayNamePlaceholder")}
          />
          <Input
            label={t("brandLogoUrl")}
            value={brandLogoUrl}
            onChange={(e) => setBrandLogoUrl(e.target.value)}
            placeholder="https://..."
          />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-300">{t("brandPrimaryColor")}</label>
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
                className="w-32 rounded-lg border border-gray-700/50 bg-gray-900 px-3 py-2.5 text-sm text-gray-100 focus:border-gray-500 focus:ring-1 focus:ring-gray-500/30 focus:outline-none"
                placeholder="#6366f1"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setShowBranding(false)}>
              {tc("cancel")}
            </Button>
            <Button size="sm" onClick={handleSaveBranding} loading={savingBrand}>
              {savingBrand ? tc("loading") : tc("save")}
            </Button>
          </div>
        </div>
      </Modal>

      {loading ? (
        <p className="py-8 text-center text-sm text-gray-500">{tc("loading")}</p>
      ) : overview ? (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-4 gap-3">
            <Card className="text-center">
              <p className="text-2xl font-bold text-gray-100">{overview.total_clients}</p>
              <p className="text-[10px] uppercase text-gray-500">{t("totalClients")}</p>
            </Card>
            <Card className="text-center">
              <p className="text-2xl font-bold text-yellow-400">{overview.total_pending_approvals}</p>
              <p className="text-[10px] uppercase text-gray-500">{t("pendingApprovals")}</p>
            </Card>
            <Card className="text-center">
              <p className="text-2xl font-bold text-green-400">{overview.total_new_leads}</p>
              <p className="text-[10px] uppercase text-gray-500">{t("newLeadsCount")}</p>
            </Card>
            <Card className="text-center">
              <p className="text-2xl font-bold text-blue-400">{overview.total_active_campaigns}</p>
              <p className="text-[10px] uppercase text-gray-500">{t("activeCampaigns")}</p>
            </Card>
          </div>

          {/* Per-client breakdown */}
          <SectionHeader title={t("clientBreakdown")} />
          <div className="space-y-2">
            {overview.businesses.map((biz) => (
              <Card
                key={biz.business_id}
                hover
                onClick={() => router.push(`/dashboard/${biz.business_id}`)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-100">{biz.business_name}</p>
                    {biz.category && (
                      <span className="text-[10px] text-gray-500">{biz.category}</span>
                    )}
                  </div>
                  <div className="flex gap-3 text-xs">
                    {biz.pending_approvals > 0 && (
                      <Badge variant="warning">
                        {biz.pending_approvals} {t("pendingApprovals")}
                      </Badge>
                    )}
                    <span className="text-gray-500">
                      {biz.new_leads} {t("newLeadsCount")}
                    </span>
                    <span className="text-gray-500">
                      {biz.active_campaigns} {t("activeCampaigns")}
                    </span>
                    {biz.published_campaigns > 0 && (
                      <Badge variant="success">
                        {biz.published_campaigns} {t("statusPublished")}
                      </Badge>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Bulk digests */}
          {digests.length > 0 && (
            <>
              <SectionHeader title={t("agencyDigests")} />
              <div className="space-y-2">
                {digests.map((d) => (
                  <Card key={d.id}>
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-gray-100">
                        {new Date(d.date).toLocaleDateString()}
                      </p>
                      <span className="text-[10px] text-gray-500">{d.business_id.slice(0, 8)}</span>
                    </div>
                    {d.summary && (
                      <p className="mt-1 text-xs text-gray-400">{d.summary}</p>
                    )}
                  </Card>
                ))}
              </div>
            </>
          )}
        </>
      ) : (
        <p className="py-8 text-center text-sm text-gray-500">{t("noItems")}</p>
      )}
    </div>
  );
}
