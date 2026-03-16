"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api";
import { getToken } from "@/lib/auth";
import Topbar from "@/components/Topbar";

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

  const badgeColor = (type: string) => {
    if (type === "system") return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
    if (type === "partner") return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
    return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
  };

  /* ── Render ── */

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-zinc-50 to-white dark:from-zinc-950 dark:to-zinc-900">
      <Topbar />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t("libraryPage")}</h1>
            <p className="text-sm text-zinc-500">{t("librarySubtitle")}</p>
          </div>
          <button
            onClick={handleSeed}
            disabled={loading}
            className="rounded-lg bg-zinc-200 px-4 py-2 text-sm font-medium hover:bg-zinc-300 dark:bg-zinc-700 dark:hover:bg-zinc-600"
          >
            {loading ? t("seeding") : t("seedLibrary")}
          </button>
        </div>

        {seedMsg && (
          <div className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-800 dark:bg-green-900/20 dark:text-green-200">
            {seedMsg}
          </div>
        )}

        {/* Tabs */}
        <div className="mb-6 flex gap-2 border-b border-zinc-200 dark:border-zinc-700">
          {(["browse", "installs", "assets"] as const).map((t2) => (
            <button
              key={t2}
              onClick={() => setTab(t2)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                tab === t2
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              }`}
            >
              {t2 === "browse" ? t("browseLibrary") : t2 === "installs" ? t("myInstalls") : t("templateAssets")}
            </button>
          ))}
        </div>

        {/* Browse Tab */}
        {tab === "browse" && (
          <>
            {/* Filters */}
            <div className="mb-4 flex flex-wrap gap-3">
              <input
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800"
                placeholder={t("searchPlaybooks")}
                value={search}
                onChange={(e) => { setSearch(e.target.value); searchRef.current = e.target.value; }}
                onKeyDown={(e) => e.key === "Enter" && loadLibrary()}
              />
              <select
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800"
                value={verticalFilter}
                onChange={(e) => { setVerticalFilter(e.target.value); }}
              >
                <option value="">{t("allVerticals")}</option>
                {VERTICALS.map((v) => (
                  <option key={v} value={v}>{v.replace(/_/g, " ")}</option>
                ))}
              </select>
              <select
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800"
                value={categoryFilter}
                onChange={(e) => { setCategoryFilter(e.target.value); }}
              >
                <option value="">{t("allCategories")}</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c.replace(/_/g, " ")}</option>
                ))}
              </select>
              <button
                onClick={loadLibrary}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                {t("searchPlaybooks").replace("...", "")}
              </button>
            </div>

            {playbooks.length === 0 ? (
              <p className="py-8 text-center text-zinc-500">{t("noLibraryPlaybooks")}</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {playbooks.map((pb) => (
                  <div
                    key={pb.id}
                    className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-800"
                  >
                    <div className="mb-2 flex items-start justify-between">
                      <h3 className="font-semibold">{pb.name}</h3>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badgeColor(pb.creator_type)}`}>
                        {creatorBadge(pb.creator_type)}
                      </span>
                    </div>
                    <p className="mb-3 text-sm text-zinc-500 line-clamp-2">{pb.description}</p>
                    <div className="mb-3 flex flex-wrap gap-1">
                      {pb.vertical && (
                        <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs dark:bg-zinc-700">
                          {pb.vertical.replace(/_/g, " ")}
                        </span>
                      )}
                      {pb.category && (
                        <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs dark:bg-zinc-700">
                          {pb.category.replace(/_/g, " ")}
                        </span>
                      )}
                      {pb.tags?.slice(0, 3).map((tag) => (
                        <span key={tag} className="rounded bg-zinc-100 px-2 py-0.5 text-xs dark:bg-zinc-700">
                          {tag}
                        </span>
                      ))}
                    </div>
                    <div className="mb-3 flex items-center gap-3 text-xs text-zinc-400">
                      <span>{t("version", { version: pb.version })}</span>
                      <span>{pb.install_count} {t("installs")}</span>
                    </div>
                    <div className="flex gap-2">
                      {installIds.has(pb.id) ? (
                        <span className="rounded-lg bg-green-100 px-3 py-1.5 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-200">
                          {t("installedBadge")}
                        </span>
                      ) : (
                        <button
                          onClick={() => handleInstall(pb.id)}
                          disabled={loading}
                          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                        >
                          {t("installPlaybook")}
                        </button>
                      )}
                      <button
                        onClick={() => handleClone(pb.id)}
                        disabled={loading}
                        className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-50 dark:border-zinc-600 dark:hover:bg-zinc-700"
                      >
                        {t("clonePlaybook")}
                      </button>
                      <button
                        onClick={() => setDetail(pb)}
                        className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-50 dark:border-zinc-600 dark:hover:bg-zinc-700"
                      >
                        {t("playbookDetail")}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Detail Modal */}
            {detail && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setDetail(null)}>
                <div
                  className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl dark:bg-zinc-800"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="mb-4 flex items-start justify-between">
                    <h2 className="text-lg font-bold">{detail.name}</h2>
                    <button onClick={() => setDetail(null)} className="text-zinc-400 hover:text-zinc-600">✕</button>
                  </div>
                  <p className="mb-4 text-sm text-zinc-500">{detail.description}</p>
                  <div className="space-y-3 text-sm">
                    <div>
                      <span className="font-medium">{t("filterCategory")}:</span>{" "}
                      {detail.category?.replace(/_/g, " ") || "—"}
                    </div>
                    <div>
                      <span className="font-medium">{t("filterVertical")}:</span>{" "}
                      {detail.vertical?.replace(/_/g, " ") || "—"}
                    </div>
                    <div>
                      <span className="font-medium">{t("approvalPolicy")}:</span> {detail.approval_policy || "—"}
                    </div>
                    <div>
                      <span className="font-medium">{t("version", { version: detail.version })}</span>
                      {" · "}
                      {detail.install_count} {t("installs")}
                    </div>
                    {detail.tags && detail.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {detail.tags.map((tag) => (
                          <span key={tag} className="rounded bg-zinc-100 px-2 py-0.5 text-xs dark:bg-zinc-700">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Installs Tab */}
        {tab === "installs" && (
          <>
            {installs.length === 0 ? (
              <p className="py-8 text-center text-zinc-500">{t("noInstalls")}</p>
            ) : (
              <div className="space-y-3">
                {installs.map((inst) => {
                  const pb = playbooks.find((p) => p.id === inst.playbook_id);
                  return (
                    <div
                      key={inst.id}
                      className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-800"
                    >
                      <div>
                        <h3 className="font-semibold">{pb?.name || inst.playbook_id}</h3>
                        <p className="text-xs text-zinc-400">
                          {t("version", { version: inst.installed_version })} · Installed{" "}
                          {new Date(inst.installed_at).toLocaleDateString()}
                        </p>
                      </div>
                      <button
                        onClick={() => handleUninstall(inst.id)}
                        disabled={loading}
                        className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20"
                      >
                        {t("uninstallPlaybook")}
                      </button>
                    </div>
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
              <p className="py-8 text-center text-zinc-500">{t("noTemplateAssets")}</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {assets.map((asset) => (
                  <div
                    key={asset.id}
                    className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-800"
                  >
                    <div className="mb-2 flex items-start justify-between">
                      <h3 className="font-semibold">{asset.name}</h3>
                      <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs dark:bg-zinc-700">
                        {t(ASSET_TYPE_LABELS[asset.type] || asset.type)}
                      </span>
                    </div>
                    <p className="mb-2 text-sm text-zinc-500 line-clamp-2">{asset.description}</p>
                    {asset.vertical && (
                      <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs dark:bg-zinc-700">
                        {asset.vertical.replace(/_/g, " ")}
                      </span>
                    )}
                    <div className="mt-2 flex flex-wrap gap-1">
                      {asset.tags?.map((tag) => (
                        <span key={tag} className="rounded bg-zinc-100 px-2 py-0.5 text-xs dark:bg-zinc-700">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
