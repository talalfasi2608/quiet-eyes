"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { PageHeader, Card, Button, Tabs, Badge, Input, EmptyState, Modal } from "@/components/ui";

type ApiList<T> = T[];

/* ── Types ── */

interface LibraryPlaybook {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  vertical: string | null;
  tags: string[] | null;
  creator_type: string;
  visibility: string;
  version: number;
  install_count: number;
  approval_policy: string | null;
  created_at: string;
}

interface PlaybookInstall {
  id: string;
  playbook_id: string;
  business_id: string;
  installed_version: number;
  config_overrides: Record<string, unknown> | null;
  is_active: boolean;
  installed_at: string;
}

interface TemplateAsset {
  id: string;
  type: string;
  name: string;
  description: string | null;
  vertical: string | null;
  content: Record<string, unknown>;
  tags: string[] | null;
  creator_type: string;
  visibility: string;
  created_at: string;
}

/* ── Helpers ── */

const VERTICALS = ["local_services", "beauty_clinics", "real_estate", "restaurants"];
const CATEGORIES = [
  "lead_management",
  "reputation",
  "competitive_response",
  "trend_marketing",
  "scheduled_campaign",
];

const ASSET_TYPE_LABELS: Record<string, string> = {
  campaign_copy: "assetCampaignCopy",
  audience_def: "assetAudienceDef",
  trend_reaction: "assetTrendReaction",
  reputation_response: "assetReputationResponse",
  crm_followup: "assetCrmFollowup",
};

export default function PlaybookLibraryPage() {
  const t = useTranslations("dashboard");
  const { businessId } = useParams<{ businessId: string }>();

  const [tab, setTab] = useState<"browse" | "installs" | "assets">("browse");
  const [playbooks, setPlaybooks] = useState<LibraryPlaybook[]>([]);
  const [installs, setInstalls] = useState<PlaybookInstall[]>([]);
  const [assets, setAssets] = useState<TemplateAsset[]>([]);
  const [search, setSearch] = useState("");
  const searchRef = useRef("");
  const [verticalFilter, setVerticalFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [seedMsg, setSeedMsg] = useState("");
  const [detail, setDetail] = useState<LibraryPlaybook | null>(null);
  const [installIds, setInstallIds] = useState<Set<string>>(new Set());

  const token = getToken() || "";

  /* ── Loaders ── */

  const loadLibrary = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (searchRef.current) params.set("q", searchRef.current);
      if (verticalFilter) params.set("vertical", verticalFilter);
      if (categoryFilter) params.set("category", categoryFilter);
      const qs = params.toString();
      const data = await apiFetch<ApiList<LibraryPlaybook>>(`/playbook-library${qs ? `?${qs}` : ""}`, { token });
      setPlaybooks(data);
    } catch { /* ignore */ }
  }, [token, verticalFilter, categoryFilter]);

  const loadInstalls = useCallback(async () => {
    try {
      const data = await apiFetch<ApiList<PlaybookInstall>>(`/businesses/${businessId}/playbook-installs`, { token });
      setInstalls(data);
      setInstallIds(new Set(data.map((i) => i.playbook_id)));
    } catch { /* ignore */ }
  }, [token, businessId]);

  const loadAssets = useCallback(async () => {
    try {
      const data = await apiFetch<ApiList<TemplateAsset>>(`/template-assets`, { token });
      setAssets(data);
    } catch { /* ignore */ }
  }, [token]);

  useEffect(() => {
    loadLibrary();
    loadInstalls();
  }, [loadLibrary, loadInstalls]);

  useEffect(() => {
    if (tab === "assets") loadAssets();
  }, [tab, loadAssets]);

  /* ── Actions ── */

  const handleInstall = async (pbId: string) => {
    setLoading(true);
    try {
      await apiFetch(`/playbook-library/${pbId}/install?business_id=${businessId}`, {
        method: "POST",
        token,
        body: JSON.stringify({}),
      });
      await loadInstalls();
      await loadLibrary();
    } catch { /* ignore */ }
    setLoading(false);
  };

  const handleClone = async (pbId: string) => {
    setLoading(true);
    try {
      await apiFetch(`/playbook-library/${pbId}/clone?business_id=${businessId}`, {
        method: "POST",
        token,
      });
      await loadLibrary();
    } catch { /* ignore */ }
    setLoading(false);
  };

  const handleUninstall = async (installId: string) => {
    setLoading(true);
    try {
      await apiFetch(`/playbook-installs/${installId}`, { method: "DELETE", token });
    } catch { /* ignore */ }
    await loadInstalls();
    await loadLibrary();
    setLoading(false);
  };

  const handleSeed = async () => {
    setLoading(true);
    setSeedMsg("");
    try {
      const data = await apiFetch<{ playbooks_created: number; assets_created: number }>(`/playbook-library/seed`, {
        method: "POST",
        token,
      });
      setSeedMsg(
        t("seedDone", {
          playbooks: data.playbooks_created,
          assets: data.assets_created,
        })
      );
      await loadLibrary();
      await loadAssets();
    } catch { /* ignore */ }
    setLoading(false);
  };

  /* ── Badge helpers ── */

  const creatorBadge = (type: string) => {
    if (type === "system") return t("systemBadge");
    if (type === "partner") return t("partnerBadge");
    return t("communityBadge");
  };

  const creatorBadgeVariant = (type: string): "info" | "default" | "success" => {
    if (type === "system") return "info";
    if (type === "partner") return "default";
    return "success";
  };

  /* ── Render ── */

  const tabList = [
    { key: "browse", label: t("browseLibrary") },
    { key: "installs", label: t("myInstalls") },
    { key: "assets", label: t("templateAssets") },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("libraryPage")}
        description={t("librarySubtitle")}
        actions={
          <Button variant="secondary" size="sm" onClick={handleSeed} loading={loading}>
            {loading ? t("seeding") : t("seedLibrary")}
          </Button>
        }
      />

      {seedMsg && (
        <Card className="!border-green-500/20">
          <p className="text-sm text-green-400">{seedMsg}</p>
        </Card>
      )}

      {/* Tabs */}
      <Tabs
        tabs={tabList}
        active={tab}
        onChange={(k) => setTab(k as "browse" | "installs" | "assets")}
      />

      {/* Browse Tab */}
      {tab === "browse" && (
        <>
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <Input
              placeholder={t("searchPlaybooks")}
              value={search}
              onChange={(e) => { setSearch(e.target.value); searchRef.current = e.target.value; }}
              onKeyDown={(e) => e.key === "Enter" && loadLibrary()}
              className="!w-auto"
            />
            <select
              className="rounded-lg border border-gray-700/50 bg-gray-900 px-3 py-2.5 text-sm text-gray-100 focus:border-gray-500 focus:ring-1 focus:ring-gray-500/30 focus:outline-none"
              value={verticalFilter}
              onChange={(e) => { setVerticalFilter(e.target.value); }}
            >
              <option value="">{t("allVerticals")}</option>
              {VERTICALS.map((v) => (
                <option key={v} value={v}>{v.replace(/_/g, " ")}</option>
              ))}
            </select>
            <select
              className="rounded-lg border border-gray-700/50 bg-gray-900 px-3 py-2.5 text-sm text-gray-100 focus:border-gray-500 focus:ring-1 focus:ring-gray-500/30 focus:outline-none"
              value={categoryFilter}
              onChange={(e) => { setCategoryFilter(e.target.value); }}
            >
              <option value="">{t("allCategories")}</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c.replace(/_/g, " ")}</option>
              ))}
            </select>
            <Button size="sm" onClick={loadLibrary}>
              {t("searchPlaybooks").replace("...", "")}
            </Button>
          </div>

          {playbooks.length === 0 ? (
            <EmptyState title={t("noLibraryPlaybooks")} />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {playbooks.map((pb) => (
                <Card key={pb.id}>
                  <div className="mb-2 flex items-start justify-between">
                    <h3 className="font-semibold text-gray-100">{pb.name}</h3>
                    <Badge variant={creatorBadgeVariant(pb.creator_type)}>
                      {creatorBadge(pb.creator_type)}
                    </Badge>
                  </div>
                  <p className="mb-3 text-sm text-gray-500 line-clamp-2">{pb.description}</p>
                  <div className="mb-3 flex flex-wrap gap-1">
                    {pb.vertical && (
                      <Badge variant="default">{pb.vertical.replace(/_/g, " ")}</Badge>
                    )}
                    {pb.category && (
                      <Badge variant="default">{pb.category.replace(/_/g, " ")}</Badge>
                    )}
                    {pb.tags?.slice(0, 3).map((tag) => (
                      <Badge key={tag} variant="default">{tag}</Badge>
                    ))}
                  </div>
                  <div className="mb-3 flex items-center gap-3 text-xs text-gray-500">
                    <span>{t("version", { version: pb.version })}</span>
                    <span>{pb.install_count} {t("installs")}</span>
                  </div>
                  <div className="flex gap-2">
                    {installIds.has(pb.id) ? (
                      <Badge variant="success">{t("installedBadge")}</Badge>
                    ) : (
                      <Button size="sm" onClick={() => handleInstall(pb.id)} loading={loading}>
                        {t("installPlaybook")}
                      </Button>
                    )}
                    <Button variant="secondary" size="sm" onClick={() => handleClone(pb.id)} loading={loading}>
                      {t("clonePlaybook")}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setDetail(pb)}>
                      {t("playbookDetail")}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Detail Modal */}
          {detail && (
            <Modal open onClose={() => setDetail(null)} title={detail.name}>
              <p className="mb-4 text-sm text-gray-500">{detail.description}</p>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="font-medium text-gray-300">{t("filterCategory")}:</span>{" "}
                  <span className="text-gray-400">{detail.category?.replace(/_/g, " ") || "—"}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-300">{t("filterVertical")}:</span>{" "}
                  <span className="text-gray-400">{detail.vertical?.replace(/_/g, " ") || "—"}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-300">{t("approvalPolicy")}:</span>{" "}
                  <span className="text-gray-400">{detail.approval_policy || "—"}</span>
                </div>
                <div className="text-gray-400">
                  <span className="font-medium text-gray-300">{t("version", { version: detail.version })}</span>
                  {" · "}
                  {detail.install_count} {t("installs")}
                </div>
                {detail.tags && detail.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {detail.tags.map((tag) => (
                      <Badge key={tag} variant="default">{tag}</Badge>
                    ))}
                  </div>
                )}
              </div>
            </Modal>
          )}
        </>
      )}

      {/* Installs Tab */}
      {tab === "installs" && (
        <>
          {installs.length === 0 ? (
            <EmptyState title={t("noInstalls")} />
          ) : (
            <div className="space-y-3">
              {installs.map((inst) => {
                const pb = playbooks.find((p) => p.id === inst.playbook_id);
                return (
                  <Card key={inst.id}>
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-gray-100">{pb?.name || inst.playbook_id}</h3>
                        <p className="text-xs text-gray-500">
                          {t("version", { version: inst.installed_version })} · Installed{" "}
                          {new Date(inst.installed_at).toLocaleDateString()}
                        </p>
                      </div>
                      <Button variant="danger" size="sm" onClick={() => handleUninstall(inst.id)} loading={loading}>
                        {t("uninstallPlaybook")}
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Template Assets Tab */}
      {tab === "assets" && (
        <>
          {assets.length === 0 ? (
            <EmptyState title={t("noTemplateAssets")} />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {assets.map((asset) => (
                <Card key={asset.id}>
                  <div className="mb-2 flex items-start justify-between">
                    <h3 className="font-semibold text-gray-100">{asset.name}</h3>
                    <Badge variant="default">
                      {t(ASSET_TYPE_LABELS[asset.type] || asset.type)}
                    </Badge>
                  </div>
                  <p className="mb-2 text-sm text-gray-500 line-clamp-2">{asset.description}</p>
                  {asset.vertical && (
                    <Badge variant="default">{asset.vertical.replace(/_/g, " ")}</Badge>
                  )}
                  <div className="mt-2 flex flex-wrap gap-1">
                    {asset.tags?.map((tag) => (
                      <Badge key={tag} variant="default">{tag}</Badge>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
