"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { useRouter } from "@/i18n/navigation";
import Topbar from "@/components/Topbar";

/* ── Types ── */

interface ChatMsg {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  created_at: string;
}

interface MentionItem {
  id: string;
  business_id: string;
  title: string | null;
  snippet: string | null;
  url: string | null;
  published_at: string | null;
  fetched_at: string;
  source: { id: string; name: string; type: string } | null;
}

interface FeedItem {
  id: string;
  title?: string | null;
  snippet?: string | null;
  url?: string | null;
  published_at?: string | null;
  fetched_at?: string;
  source?: { id: string; name: string; type: string } | null;
  business_id?: string;
  mention_id?: string | null;
  intent?: string;
  score?: number;
  confidence?: number;
  status?: string;
  suggested_reply?: string | null;
  mention?: MentionItem | null;
}

interface UnifiedFeedItem {
  type: "lead" | "trend" | "competitor_event" | "review";
  id: string;
  title: string;
  why_it_matters: string;
  evidence_urls: string[];
  confidence: number;
  primary_action: string | null;
  created_at: string;
  data: Record<string, unknown> | null;
}

interface IntelligenceResult {
  trends_created: number;
  competitor_events_created: number;
  reviews_created: number;
}

interface ApprovalItem {
  id: string;
  status: string;
  risk: string;
  cost_impact: number;
  confidence: number;
  priority_score: number;
  requires_human: boolean;
  created_at: string;
  decided_at: string | null;
  action: {
    id: string;
    type: string;
    payload: Record<string, unknown> | null;
  } | null;
}

interface IngestionResult {
  business_id: string;
  search_new: number;
  rss_new: number;
  total_mentions: number;
}

interface LeadGenResult {
  leads_created: number;
  total_leads: number;
}

interface AudienceItem {
  id: string;
  business_id: string;
  name: string;
  definition: Record<string, unknown> | null;
  created_at: string;
}

interface ExportItem {
  id: string;
  business_id: string;
  audience_id: string | null;
  type: "CSV" | "HASHED_CSV";
  status: "PENDING" | "READY" | "FAILED";
  file_path: string | null;
  created_at: string;
}

type FeedTab = "recommended" | "needs_approval" | "mentions";

const ACTION_TYPE_GROUPS = [
  { key: "REPLY_DRAFT", label: "replyDrafts" },
  { key: "AUDIENCE_DRAFT", label: "audienceSegments" },
  { key: "CAMPAIGN_DRAFT", label: "campaigns" },
  { key: "EXPORT", label: "exports" },
  { key: "CRM_SYNC", label: "crmSync" },
] as const;

const INTENT_COLORS: Record<string, string> = {
  PURCHASE: "bg-emerald-900 text-emerald-300",
  COMPARISON: "bg-blue-900 text-blue-300",
  COMPLAINT: "bg-red-900 text-red-300",
  RECOMMENDATION: "bg-purple-900 text-purple-300",
  QUESTION: "bg-amber-900 text-amber-300",
  OTHER: "bg-gray-800 text-gray-400",
};

/* ── Main Dashboard ── */

export default function DashboardPage() {
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const router = useRouter();
  const { businessId } = useParams<{ businessId: string }>();
  const token = getToken();

  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<FeedTab>("recommended");
  const [feedItems, setFeedItems] = useState<(UnifiedFeedItem | FeedItem)[]>([]);
  const [mentionItems, setMentionItems] = useState<MentionItem[]>([]);
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [ingesting, setIngesting] = useState(false);
  const [ingestionMsg, setIngestionMsg] = useState("");
  const [generatingLeads, setGeneratingLeads] = useState(false);
  const [leadGenMsg, setLeadGenMsg] = useState("");
  const [runningIntel, setRunningIntel] = useState(false);
  const [intelMsg, setIntelMsg] = useState("");
  const [showAudienceBuilder, setShowAudienceBuilder] = useState(false);
  const [showExportPanel, setShowExportPanel] = useState(false);
  const [audiences, setAudiences] = useState<AudienceItem[]>([]);
  const [exports, setExports] = useState<ExportItem[]>([]);
  const [quotaError, setQuotaError] = useState<{ resource: string; current: number; limit: number } | null>(null);
  const [topRecs, setTopRecs] = useState<Array<{ id: string; type: string; title: string; summary: string | null; confidence: number; impact_score: number }>>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  function handleApiError(e: unknown): boolean {
    const err = e as Error & { code?: string; resource?: string; current?: number; limit?: number };
    if (err.code === "QUOTA_EXCEEDED") {
      setQuotaError({ resource: err.resource || "resource", current: err.current || 0, limit: err.limit || 0 });
      return true;
    }
    return false;
  }

  useEffect(() => {
    if (!token) router.push("/login");
  }, [token, router]);

  const loadFeed = useCallback(async () => {
    if (!token) return;
    setFeedLoading(true);
    try {
      if (activeTab === "recommended") {
        const data = await apiFetch<(UnifiedFeedItem | FeedItem)[]>(
          `/businesses/${businessId}/feed?tab=recommended`,
          { token },
        );
        setFeedItems(data);
      } else if (activeTab === "mentions") {
        const data = await apiFetch<MentionItem[]>(
          `/businesses/${businessId}/mentions?limit=50`,
          { token },
        );
        setMentionItems(data);
      } else {
        const data = await apiFetch<ApprovalItem[]>(
          `/businesses/${businessId}/approvals?status=PENDING`,
          { token },
        );
        setApprovals(data);
      }
    } catch {
      /* feed may be empty */
    } finally {
      setFeedLoading(false);
    }
  }, [activeTab, businessId, token]);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  const loadAudiences = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiFetch<AudienceItem[]>(
        `/businesses/${businessId}/audiences`,
        { token },
      );
      setAudiences(data);
    } catch { /* empty */ }
  }, [businessId, token]);

  const loadExports = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiFetch<ExportItem[]>(
        `/businesses/${businessId}/exports`,
        { token },
      );
      setExports(data);
    } catch { /* empty */ }
  }, [businessId, token]);

  const loadTopRecs = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiFetch<Array<{ id: string; type: string; title: string; summary: string | null; confidence: number; impact_score: number }>>(
        `/businesses/${businessId}/optimizations?status=PENDING&limit=3`,
        { token },
      );
      setTopRecs(data);
    } catch { /* empty */ }
  }, [businessId, token]);

  useEffect(() => {
    loadAudiences();
    loadExports();
    loadTopRecs();
  }, [loadAudiences, loadExports, loadTopRecs]);

  async function runIngestion() {
    if (!token || ingesting) return;
    setIngesting(true);
    setIngestionMsg("");
    try {
      const res = await apiFetch<IngestionResult>(
        `/businesses/${businessId}/ingest`,
        { method: "POST", token },
      );
      const count = res.search_new + res.rss_new;
      setIngestionMsg(t("ingestionDone", { count }));
      loadFeed();
    } catch (e) {
      if (!handleApiError(e)) setIngestionMsg("Ingestion failed");
    } finally {
      setIngesting(false);
    }
  }

  async function runLeadGeneration() {
    if (!token || generatingLeads) return;
    setGeneratingLeads(true);
    setLeadGenMsg("");
    try {
      const res = await apiFetch<LeadGenResult>(
        `/businesses/${businessId}/leads/generate`,
        { method: "POST", token },
      );
      setLeadGenMsg(t("leadsGenerated", { count: res.leads_created }));
      if (activeTab === "recommended") loadFeed();
    } catch {
      setLeadGenMsg("Lead generation failed");
    } finally {
      setGeneratingLeads(false);
    }
  }

  async function runIntelligence() {
    if (!token || runningIntel) return;
    setRunningIntel(true);
    setIntelMsg("");
    try {
      const res = await apiFetch<IntelligenceResult>(
        `/businesses/${businessId}/intelligence/run`,
        { method: "POST", token },
      );
      setIntelMsg(t("intelligenceDone", {
        trends: res.trends_created,
        competitors: res.competitor_events_created,
        reviews: res.reviews_created,
      }));
      if (activeTab === "recommended") loadFeed();
    } catch {
      setIntelMsg("Intelligence analysis failed");
    } finally {
      setRunningIntel(false);
    }
  }

  async function createActionFromFeed(actionType: string, payload: Record<string, unknown>) {
    if (!token) return;
    try {
      await apiFetch(`/businesses/${businessId}/actions`, {
        method: "POST",
        token,
        body: JSON.stringify({ type: actionType, payload }),
      });
      loadFeed();
    } catch { /* ignore */ }
  }

  async function sendToCrm(leadId: string) {
    if (!token) return;
    try {
      await apiFetch(`/businesses/${businessId}/actions`, {
        method: "POST",
        token,
        body: JSON.stringify({
          type: "CRM_SYNC",
          payload: { lead_id: leadId },
        }),
      });
      loadFeed();
    } catch {
      /* ignore */
    }
  }

  async function createReplyDraft(leadId: string, replyText: string, confidence: number) {
    if (!token) return;
    try {
      await apiFetch<ApprovalItem>(`/businesses/${businessId}/actions`, {
        method: "POST",
        token,
        body: JSON.stringify({
          type: "REPLY_DRAFT",
          payload: {
            lead_id: leadId,
            reply_text: replyText,
            confidence,
          },
        }),
      });
      // Reload both recommended (to show feedback) and approvals
      loadFeed();
    } catch {
      /* ignore */
    }
  }

  async function sendChat(content?: string) {
    const msg = content || chatInput.trim();
    if (!msg || !token) return;
    setChatInput("");
    setChatLoading(true);
    try {
      const history = await apiFetch<ChatMsg[]>(
        `/businesses/${businessId}/chat`,
        { method: "POST", token, body: JSON.stringify({ content: msg }) },
      );
      setChatMessages(history);
    } catch (e) {
      handleApiError(e);
    } finally {
      setChatLoading(false);
      setTimeout(
        () => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }),
        50,
      );
    }
  }

  async function handleApproval(id: string, action: "approve" | "reject") {
    if (!token) return;
    try {
      await apiFetch<ApprovalItem>(`/approvals/${id}/${action}`, {
        method: "POST",
        token,
      });
      loadFeed();
    } catch (e) {
      handleApiError(e);
    }
  }

  const chips = [
    { key: "findLeads", label: t("chips.findLeads") },
    { key: "draftReply", label: t("chips.draftReply") },
    { key: "showMentions", label: t("chips.showMentions") },
    { key: "analyzeTrends", label: t("chips.analyzeTrends") },
  ];

  if (!token) return null;

  return (
    <div className="flex h-screen flex-col">
      <Topbar />
      <div className="flex flex-1 overflow-hidden">
        {/* Main content */}
        <div className="flex flex-1 flex-col overflow-y-auto p-4">
          {/* Chat command center */}
          <section className="mb-6">
            <h2 className="mb-3 text-lg font-semibold">{t("chatTitle")}</h2>
            <div className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendChat()}
                placeholder={t("chatPlaceholder")}
                className="flex-1 rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-sm focus:border-white focus:outline-none"
              />
              <button
                onClick={() => sendChat()}
                disabled={chatLoading || !chatInput.trim()}
                className="rounded-lg bg-white px-5 py-3 text-sm font-semibold text-gray-950 hover:bg-gray-200 disabled:opacity-50"
              >
                {tc("submit")}
              </button>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {chips.map((chip) => (
                <button
                  key={chip.key}
                  onClick={() => sendChat(chip.label)}
                  className="rounded-full border border-gray-700 px-3 py-1 text-xs hover:bg-gray-800"
                >
                  {chip.label}
                </button>
              ))}
              <div className="ms-auto flex items-center gap-2">
                <button
                  onClick={runIngestion}
                  disabled={ingesting}
                  className="rounded-lg border border-blue-700 bg-blue-950 px-3 py-1 text-xs text-blue-300 hover:bg-blue-900 disabled:opacity-50"
                >
                  {ingesting ? t("ingesting") : t("runIngestion")}
                </button>
                <button
                  onClick={runLeadGeneration}
                  disabled={generatingLeads}
                  className="rounded-lg border border-emerald-700 bg-emerald-950 px-3 py-1 text-xs text-emerald-300 hover:bg-emerald-900 disabled:opacity-50"
                >
                  {generatingLeads ? t("generatingLeads") : t("generateLeads")}
                </button>
                <button
                  onClick={runIntelligence}
                  disabled={runningIntel}
                  className="rounded-lg border border-amber-700 bg-amber-950 px-3 py-1 text-xs text-amber-300 hover:bg-amber-900 disabled:opacity-50"
                >
                  {runningIntel ? t("runningIntelligence") : t("runIntelligence")}
                </button>
                <button
                  onClick={() => setShowAudienceBuilder(!showAudienceBuilder)}
                  className="rounded-lg border border-purple-700 bg-purple-950 px-3 py-1 text-xs text-purple-300 hover:bg-purple-900"
                >
                  {t("audienceBuilder")}
                </button>
                <button
                  onClick={() => { setShowExportPanel(!showExportPanel); loadExports(); }}
                  className="rounded-lg border border-orange-700 bg-orange-950 px-3 py-1 text-xs text-orange-300 hover:bg-orange-900"
                >
                  {t("exportLeads")}
                </button>
                <button
                  onClick={() => router.push(`/dashboard/${businessId}/campaigns`)}
                  className="rounded-lg border border-indigo-700 bg-indigo-950 px-3 py-1 text-xs text-indigo-300 hover:bg-indigo-900"
                >
                  {t("campaignsPage")}
                </button>
                <button
                  onClick={() => router.push(`/dashboard/${businessId}/settings`)}
                  className="rounded-lg border border-cyan-700 bg-cyan-950 px-3 py-1 text-xs text-cyan-300 hover:bg-cyan-900"
                >
                  {t("integrations")}
                </button>
                <button
                  onClick={() => router.push(`/dashboard/${businessId}/trends`)}
                  className="rounded-lg border border-amber-700 bg-amber-950 px-3 py-1 text-xs text-amber-300 hover:bg-amber-900"
                >
                  {t("trendsPage")}
                </button>
                <button
                  onClick={() => router.push(`/dashboard/${businessId}/competitors`)}
                  className="rounded-lg border border-rose-700 bg-rose-950 px-3 py-1 text-xs text-rose-300 hover:bg-rose-900"
                >
                  {t("competitorsPage")}
                </button>
                <button
                  onClick={() => router.push(`/dashboard/${businessId}/reputation`)}
                  className="rounded-lg border border-yellow-700 bg-yellow-950 px-3 py-1 text-xs text-yellow-300 hover:bg-yellow-900"
                >
                  {t("reputationPage")}
                </button>
                <button
                  onClick={() => router.push(`/dashboard/${businessId}/autopilot`)}
                  className="rounded-lg border border-sky-700 bg-sky-950 px-3 py-1 text-xs text-sky-300 hover:bg-sky-900"
                >
                  {t("autopilotPage")}
                </button>
                <button
                  onClick={() => router.push(`/dashboard/${businessId}/playbooks`)}
                  className="rounded-lg border border-fuchsia-700 bg-fuchsia-950 px-3 py-1 text-xs text-fuchsia-300 hover:bg-fuchsia-900"
                >
                  {t("playbooksPage")}
                </button>
                <button
                  onClick={() => router.push(`/dashboard/${businessId}/optimizations`)}
                  className="rounded-lg border border-teal-700 bg-teal-950 px-3 py-1 text-xs text-teal-300 hover:bg-teal-900"
                >
                  {t("optimizationsPage")}
                </button>
                <button
                  onClick={() => router.push(`/dashboard/${businessId}/library`)}
                  className="rounded-lg border border-sky-700 bg-sky-950 px-3 py-1 text-xs text-sky-300 hover:bg-sky-900"
                >
                  {t("libraryPage")}
                </button>
                <button
                  onClick={() => router.push(`/dashboard/${businessId}/billing`)}
                  className="rounded-lg border border-lime-700 bg-lime-950 px-3 py-1 text-xs text-lime-300 hover:bg-lime-900"
                >
                  {t("billingPage")}
                </button>
                <button
                  onClick={() => router.push(`/dashboard/${businessId}/outbound`)}
                  className="rounded-lg border border-emerald-700 bg-emerald-950 px-3 py-1 text-xs text-emerald-300 hover:bg-emerald-900"
                >
                  {t("outboundPage")}
                </button>
                <button
                  onClick={() => router.push(`/dashboard/${businessId}/predictions`)}
                  className="rounded-lg border border-cyan-700 bg-cyan-950 px-3 py-1 text-xs text-cyan-300 hover:bg-cyan-900"
                >
                  {t("predictionsPage")}
                </button>
                <button
                  onClick={() => router.push(`/dashboard/${businessId}/partners`)}
                  className="rounded-lg border border-teal-700 bg-teal-950 px-3 py-1 text-xs text-teal-300 hover:bg-teal-900"
                >
                  {t("partnerDashboard")}
                </button>
                <button
                  onClick={() => router.push(`/dashboard/${businessId}/governance`)}
                  className="rounded-lg border border-violet-700 bg-violet-950 px-3 py-1 text-xs text-violet-300 hover:bg-violet-900"
                >
                  {t("governancePage")}
                </button>
                <button
                  onClick={() => router.push(`/dashboard/${businessId}/security`)}
                  className="rounded-lg border border-red-700 bg-red-950 px-3 py-1 text-xs text-red-300 hover:bg-red-900"
                >
                  {t("securityPage")}
                </button>
                <button
                  onClick={() => router.push(`/dashboard/${businessId}/ops`)}
                  className="rounded-lg border border-blue-700 bg-blue-950 px-3 py-1 text-xs text-blue-300 hover:bg-blue-900"
                >
                  {t("opsPage")}
                </button>
              </div>
            </div>
            {(ingestionMsg || leadGenMsg || intelMsg) && (
              <div className="mt-1 flex gap-3">
                {ingestionMsg && (
                  <span className="text-xs text-green-400">{ingestionMsg}</span>
                )}
                {leadGenMsg && (
                  <span className="text-xs text-emerald-400">{leadGenMsg}</span>
                )}
                {intelMsg && (
                  <span className="text-xs text-amber-400">{intelMsg}</span>
                )}
              </div>
            )}
          </section>

          {/* Optimization Widget — top 3 recommendations */}
          {topRecs.length > 0 && (
            <section className="mb-4 rounded-lg border border-teal-800 bg-gray-900 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-teal-300">{t("optWidgetTitle")}</h3>
                <button
                  onClick={() => router.push(`/dashboard/${businessId}/optimizations`)}
                  className="text-[10px] text-teal-400 hover:underline"
                >
                  {t("optViewAll")}
                </button>
              </div>
              <div className="space-y-2">
                {topRecs.map((rec) => (
                  <div key={rec.id} className="flex items-center gap-3 rounded-lg border border-gray-800 bg-gray-950 p-3">
                    <div className="flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                          ({
                            BUDGET_CHANGE: "bg-green-900 text-green-300",
                            CREATIVE_CHANGE: "bg-purple-900 text-purple-300",
                            AUDIENCE_REFINEMENT: "bg-blue-900 text-blue-300",
                            APPROVAL_THRESHOLD: "bg-yellow-900 text-yellow-300",
                            AUTOPILOT_TUNING: "bg-red-900 text-red-300",
                            PLAYBOOK_SUGGESTION: "bg-indigo-900 text-indigo-300",
                          } as Record<string, string>)[rec.type] || "bg-gray-800 text-gray-400"
                        }`}>
                          {rec.type.replace(/_/g, " ")}
                        </span>
                        <span className="text-[10px] text-gray-500">{rec.confidence}%</span>
                        {rec.impact_score > 0 && (
                          <span className="text-[10px] text-emerald-400">{t("optImpact")}: {rec.impact_score}</span>
                        )}
                      </div>
                      <p className="text-xs font-medium">{rec.title}</p>
                      {rec.summary && <p className="mt-0.5 text-[10px] text-gray-400">{rec.summary}</p>}
                    </div>
                    <button
                      onClick={() => router.push(`/dashboard/${businessId}/optimizations`)}
                      className="shrink-0 rounded bg-teal-800 px-2 py-1 text-[10px] font-medium text-white hover:bg-teal-700"
                    >
                      {t("optReview")}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Audience Builder */}
          {showAudienceBuilder && (
            <AudienceBuilderWizard
              businessId={businessId}
              token={token!}
              onCreated={() => { loadFeed(); loadAudiences(); setShowAudienceBuilder(false); }}
              onClose={() => setShowAudienceBuilder(false)}
            />
          )}

          {/* Export Panel */}
          {showExportPanel && (
            <ExportPanel
              businessId={businessId}
              token={token!}
              audiences={audiences}
              exports={exports}
              onExportRequested={() => { loadFeed(); loadExports(); }}
              onClose={() => setShowExportPanel(false)}
            />
          )}

          {/* Feed */}
          <section className="flex-1">
            <h2 className="mb-3 text-lg font-semibold">{t("feedTitle")}</h2>
            <div className="mb-4 flex gap-1 border-b border-gray-800">
              {(
                [
                  ["recommended", t("recommended")],
                  ["mentions", t("mentions")],
                  ["needs_approval", t("needsApproval")],
                ] as const
              ).map(([tab, label]) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab as FeedTab)}
                  className={`px-4 py-2 text-sm font-medium ${activeTab === tab ? "border-b-2 border-white text-white" : "text-gray-500 hover:text-gray-300"}`}
                >
                  {label}
                </button>
              ))}
            </div>

            {feedLoading ? (
              <p className="py-8 text-center text-sm text-gray-500">
                {tc("loading")}
              </p>
            ) : activeTab === "recommended" ? (
              <RecommendedFeed
                items={feedItems}
                noItemsText={t("noItems")}
                onCreateDraft={createReplyDraft}
                onSendToCrm={sendToCrm}
                onCreateAction={createActionFromFeed}
              />
            ) : activeTab === "mentions" ? (
              <MentionsFeed items={mentionItems} noItemsText={t("noItems")} />
            ) : (
              <NeedsApprovalFeed
                approvals={approvals}
                onApprove={(id) => handleApproval(id, "approve")}
                onReject={(id) => handleApproval(id, "reject")}
              />
            )}
          </section>
        </div>

        {/* Chat thread panel */}
        <aside className="hidden w-80 flex-col border-s border-gray-800 lg:flex">
          <div className="border-b border-gray-800 px-4 py-3">
            <h3 className="text-sm font-semibold">{t("chatThread")}</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {chatMessages.length === 0 ? (
              <p className="text-center text-xs text-gray-600">
                {t("noItems")}
              </p>
            ) : (
              <div className="space-y-3">
                {chatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`rounded-lg px-3 py-2 text-sm ${msg.role === "USER" ? "bg-gray-800 text-gray-100" : "bg-gray-900 text-gray-300"}`}
                  >
                    <span className="mb-1 block text-[10px] font-medium uppercase text-gray-500">
                      {msg.role === "USER" ? "You" : "QuietEyes"}
                    </span>
                    {msg.content}
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex gap-1 px-3 py-2">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-gray-500" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-gray-500 [animation-delay:0.15s]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-gray-500 [animation-delay:0.3s]" />
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Quota Exceeded Modal */}
      {quotaError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="mx-4 w-full max-w-md rounded-lg border border-red-800 bg-gray-900 p-6">
            <h3 className="mb-2 text-lg font-semibold text-red-400">{t("quotaExceeded")}</h3>
            <p className="mb-4 text-sm text-gray-300">
              {t("quotaExceededMsg", { resource: quotaError.resource })}
            </p>
            <div className="mb-4 rounded border border-gray-800 bg-gray-950 px-3 py-2 text-xs text-gray-400">
              {quotaError.resource}: {quotaError.current} / {quotaError.limit}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setQuotaError(null); router.push(`/dashboard/${businessId}/billing`); }}
                className="rounded-lg bg-white px-4 py-1.5 text-xs font-semibold text-gray-950 hover:bg-gray-200"
              >
                {t("upgradeNow")}
              </button>
              <button
                onClick={() => setQuotaError(null)}
                className="rounded-lg border border-gray-700 px-4 py-1.5 text-xs text-gray-400 hover:bg-gray-800"
              >
                {t("quotaDismiss")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Lead Card ── */

function LeadCard({
  item,
  onCreateDraft,
  onSendToCrm,
}: {
  item: FeedItem;
  onCreateDraft: (leadId: string, reply: string, confidence: number) => void;
  onSendToCrm: (leadId: string) => Promise<void>;
}) {
  const t = useTranslations("dashboard");
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(false);
  const [sendingCrm, setSendingCrm] = useState(false);
  const [sentCrm, setSentCrm] = useState(false);

  const intentColor = INTENT_COLORS[item.intent || "OTHER"] || INTENT_COLORS.OTHER;
  const mention = item.mention;
  const evidenceUrl = mention?.url || item.url;

  async function handleCreateDraft() {
    if (!item.suggested_reply) return;
    setCreating(true);
    await onCreateDraft(item.id, item.suggested_reply, item.confidence || 70);
    setCreating(false);
    setCreated(true);
  }

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${intentColor}`}>
              {item.intent}
            </span>
            <span className="text-xs text-gray-500">
              {t("scoreLabel")}: {item.score}%
            </span>
            <span className="text-xs text-gray-600">
              {t("confidenceLabel")}: {item.confidence}%
            </span>
          </div>
          <p className="text-sm font-medium">
            {mention?.title || item.title || item.intent}
          </p>
          {(mention?.snippet || item.snippet) && (
            <p className="mt-1 line-clamp-2 text-xs text-gray-400">
              {mention?.snippet || item.snippet}
            </p>
          )}
        </div>
        <div className="shrink-0 text-end">
          <div className="text-2xl font-bold text-white">{item.score}</div>
          <div className="text-[10px] text-gray-500">{t("scoreLabel")}</div>
        </div>
      </div>

      {/* Evidence link */}
      {evidenceUrl && (
        <a
          href={evidenceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 block text-xs text-blue-400 hover:underline"
        >
          {t("evidence")}
        </a>
      )}

      {/* Suggested reply preview */}
      {item.suggested_reply && (
        <div className="mt-3 rounded border border-gray-800 bg-gray-950 px-3 py-2">
          <p className="mb-1 text-[10px] font-medium uppercase text-gray-500">
            {t("suggestedReply")}
          </p>
          <p className="line-clamp-2 text-xs text-gray-400">
            {item.suggested_reply}
          </p>
        </div>
      )}

      {/* Action buttons */}
      <div className="mt-3 flex items-center gap-2">
        {item.suggested_reply && (
          <>
            {created ? (
              <span className="text-xs text-emerald-400">
                {t("draftCreated")}
              </span>
            ) : (
              <button
                onClick={handleCreateDraft}
                disabled={creating}
                className="rounded-lg bg-white px-4 py-1.5 text-xs font-semibold text-gray-950 hover:bg-gray-200 disabled:opacity-50"
              >
                {creating ? t("creatingDraft") : t("createReplyDraft")}
              </button>
            )}
          </>
        )}
        {sentCrm ? (
          <span className="text-xs text-cyan-400">{t("sentToCrm")}</span>
        ) : (
          <button
            onClick={async () => {
              setSendingCrm(true);
              await onSendToCrm(item.id);
              setSendingCrm(false);
              setSentCrm(true);
            }}
            disabled={sendingCrm}
            className="rounded-lg border border-cyan-700 bg-cyan-950 px-4 py-1.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-900 disabled:opacity-50"
          >
            {sendingCrm ? t("sendingToCrm") : t("sendToCrm")}
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Mention Card ── */

function MentionCard({
  item,
}: {
  item: {
    title?: string | null;
    snippet?: string | null;
    url?: string | null;
    published_at?: string | null;
    fetched_at?: string;
    source?: { name: string; type: string } | null;
  };
}) {
  const t = useTranslations("dashboard");
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">
            {item.title || "Untitled mention"}
          </p>
          {item.snippet && (
            <p className="mt-1 line-clamp-2 text-xs text-gray-400">
              {item.snippet}
            </p>
          )}
        </div>
        {item.source && (
          <span className="shrink-0 rounded bg-gray-800 px-2 py-0.5 text-[10px] text-gray-400">
            {item.source.name}
          </span>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-500">
        {item.url && (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:underline"
          >
            {t("evidence")}
          </a>
        )}
        {item.published_at && (
          <span>{new Date(item.published_at).toLocaleDateString()}</span>
        )}
        {item.fetched_at && (
          <span className="text-gray-600">
            {t("fetched")} {new Date(item.fetched_at).toLocaleString()}
          </span>
        )}
      </div>
    </div>
  );
}

/* ── Intelligence Card ── */

const INTEL_CARD_STYLES: Record<string, { border: string; badge: string; label: string }> = {
  trend: { border: "border-amber-800", badge: "bg-amber-900 text-amber-300", label: "trendSpike" },
  competitor_event: { border: "border-rose-800", badge: "bg-rose-900 text-rose-300", label: "competitorAlert" },
  review: { border: "border-yellow-800", badge: "bg-yellow-900 text-yellow-300", label: "reputationAlert" },
};

function IntelligenceCard({
  item,
  onCreateAction,
}: {
  item: UnifiedFeedItem;
  onCreateAction: (actionType: string, payload: Record<string, unknown>) => Promise<void>;
}) {
  const t = useTranslations("dashboard");
  const [acting, setActing] = useState(false);
  const [acted, setActed] = useState(false);

  const style = INTEL_CARD_STYLES[item.type] || INTEL_CARD_STYLES.trend;

  async function handleAction() {
    setActing(true);
    if (item.type === "trend") {
      await onCreateAction("AUDIENCE_DRAFT", {
        audience_name: `Trend: ${item.data?.topic as string}`,
        source: "trend_engine",
        trend_id: item.id,
        confidence: item.confidence,
      });
    } else if (item.type === "competitor_event") {
      await onCreateAction("CAMPAIGN_DRAFT", {
        source_type: "manual",
        prompt: `Counter-offer campaign: ${item.data?.summary as string}`,
        competitor_event_id: item.id,
        confidence: item.confidence,
      });
    } else if (item.type === "review" && item.data?.sentiment === "NEG") {
      await onCreateAction("REPLY_DRAFT", {
        review_id: item.id,
        reply_text: `Professional response to negative review`,
        confidence: item.confidence,
        source: "reputation_engine",
      });
    }
    setActing(false);
    setActed(true);
  }

  const actionLabel = (() => {
    if (item.type === "trend") return t("buildAudienceCampaign");
    if (item.type === "competitor_event") return t("generateCounterOffer");
    if (item.type === "review" && item.data?.sentiment === "NEG") return t("reviewReplyDraft");
    return null;
  })();

  return (
    <div className={`rounded-lg border ${style.border} bg-gray-900 p-4`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${style.badge}`}>
              {t(style.label)}
            </span>
            <span className="text-xs text-gray-500">
              {t("confidenceLabel")}: {item.confidence}%
            </span>
          </div>
          <p className="text-sm font-medium">{item.title}</p>
          <p className="mt-1 line-clamp-2 text-xs text-gray-400">{item.why_it_matters}</p>
        </div>
        <div className="shrink-0 text-end">
          <div className="text-2xl font-bold text-white">{item.confidence}</div>
          <div className="text-[10px] text-gray-500">{t("confidenceLabel")}</div>
        </div>
      </div>

      {/* Evidence links */}
      {item.evidence_urls.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {item.evidence_urls.slice(0, 3).map((url, i) => (
            <a
              key={i}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-400 hover:underline"
            >
              {t("evidence")} {i + 1}
            </a>
          ))}
        </div>
      )}

      {/* Primary action */}
      {actionLabel && (
        <div className="mt-3">
          {acted ? (
            <span className="text-xs text-emerald-400">{t("actionCreated")}</span>
          ) : (
            <button
              onClick={handleAction}
              disabled={acting}
              className={`rounded-lg px-4 py-1.5 text-xs font-semibold disabled:opacity-50 ${style.badge}`}
            >
              {acting ? t("creatingAction") : actionLabel}
            </button>
          )}
        </div>
      )}

      {/* Timestamp */}
      <div className="mt-2 text-[10px] text-gray-600">
        {new Date(item.created_at).toLocaleString()}
      </div>
    </div>
  );
}

/* ── Recommended Feed ── */

function RecommendedFeed({
  items,
  noItemsText,
  onCreateDraft,
  onSendToCrm,
  onCreateAction,
}: {
  items: (UnifiedFeedItem | FeedItem)[];
  noItemsText: string;
  onCreateDraft: (leadId: string, reply: string, confidence: number) => void;
  onSendToCrm: (leadId: string) => Promise<void>;
  onCreateAction: (actionType: string, payload: Record<string, unknown>) => Promise<void>;
}) {
  if (items.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-gray-500">{noItemsText}</p>
    );
  }

  const isUnified = (item: UnifiedFeedItem | FeedItem): item is UnifiedFeedItem =>
    "type" in item && typeof (item as UnifiedFeedItem).why_it_matters === "string";

  const isLegacyLead = (item: FeedItem) => "intent" in item && item.intent;

  return (
    <div className="space-y-3">
      {items.map((item) => {
        if (isUnified(item)) {
          if (item.type === "lead") {
            // Render unified lead as legacy LeadCard for compatibility
            const legacyItem: FeedItem = {
              id: item.id,
              intent: item.data?.intent as string,
              score: item.data?.score as number,
              confidence: item.confidence,
              suggested_reply: item.data?.suggested_reply as string | null,
              title: item.title,
              snippet: item.data?.snippet as string | null,
              url: item.evidence_urls[0] || null,
              mention_id: item.data?.mention_id as string | null,
            };
            return (
              <LeadCard
                key={item.id}
                item={legacyItem}
                onCreateDraft={onCreateDraft}
                onSendToCrm={onSendToCrm}
              />
            );
          }
          return (
            <IntelligenceCard
              key={item.id}
              item={item}
              onCreateAction={onCreateAction}
            />
          );
        }
        // Legacy format fallback
        return isLegacyLead(item) ? (
          <LeadCard
            key={item.id}
            item={item}
            onCreateDraft={onCreateDraft}
            onSendToCrm={onSendToCrm}
          />
        ) : (
          <MentionCard key={item.id} item={item} />
        );
      })}
    </div>
  );
}

/* ── Mentions Tab ── */

function MentionsFeed({
  items,
  noItemsText,
}: {
  items: MentionItem[];
  noItemsText: string;
}) {
  if (items.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-gray-500">{noItemsText}</p>
    );
  }
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <MentionCard key={item.id} item={item} />
      ))}
    </div>
  );
}

/* ── Needs Approval Feed ── */

function NeedsApprovalFeed({
  approvals,
  onApprove,
  onReject,
}: {
  approvals: ApprovalItem[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const t = useTranslations("dashboard");
  const [bulkMsg, setBulkMsg] = useState("");

  const grouped = ACTION_TYPE_GROUPS.map((group) => ({
    ...group,
    items: approvals.filter((a) => a.action?.type === group.key),
  }));

  function handleBulkApproveCampaigns() {
    const campaignApprovals = approvals.filter((a) => a.action?.type === "CAMPAIGN_DRAFT");
    if (campaignApprovals.length === 0) return;
    const totalBudget = campaignApprovals.reduce((sum, a) => {
      const budget = (a.action?.payload as Record<string, number> | null)?.budget_suggestion || 0;
      return sum + budget;
    }, 0);
    const msg = t("bulkApproveConfirm", { count: campaignApprovals.length, budget: totalBudget });
    if (window.confirm(msg)) {
      campaignApprovals.forEach((a) => onApprove(a.id));
    }
  }

  function handleBulkApproveHighConfidence() {
    const threshold = 85;
    const highConf = approvals.filter((a) => a.confidence >= threshold && a.risk === "LOW");
    if (highConf.length === 0) return;
    const msg = t("bulkApproveConfirmMsg", { count: highConf.length, threshold });
    if (window.confirm(msg)) {
      highConf.forEach((a) => onApprove(a.id));
      setBulkMsg(t("bulkApproved", { count: highConf.length }));
    }
  }

  return (
    <div className="space-y-6">
      {/* Bulk approve high-confidence */}
      {approvals.filter((a) => a.confidence >= 85 && a.risk === "LOW").length > 0 && (
        <div className="flex items-center gap-3">
          <button
            onClick={handleBulkApproveHighConfidence}
            className="rounded-lg bg-green-900 px-4 py-1.5 text-xs font-semibold text-green-300 hover:bg-green-800"
          >
            {t("bulkApproveHighConfidence")}
          </button>
          {bulkMsg && <span className="text-xs text-green-400">{bulkMsg}</span>}
        </div>
      )}

      {grouped.map((group) => (
        <div key={group.key}>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-400">
              {t(group.label)} ({group.items.length})
            </h3>
            {group.key === "CAMPAIGN_DRAFT" && group.items.length > 1 && (
              <button
                onClick={handleBulkApproveCampaigns}
                className="rounded bg-green-900 px-2 py-0.5 text-[10px] text-green-300 hover:bg-green-800"
              >
                {t("bulkApprove")}
              </button>
            )}
          </div>
          {group.items.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-800 px-4 py-6 text-center text-xs text-gray-600">
              {t("noItems")}
            </div>
          ) : (
            <div className="space-y-2">
              {group.items.map((approval) => (
                <div
                  key={approval.id}
                  className="rounded-lg border border-gray-800 bg-gray-900 px-4 py-3"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">
                        {approval.action?.type.replace(/_/g, " ")}
                      </p>
                      <div className="mt-1 flex gap-2 text-xs text-gray-500">
                        <span>Risk: {approval.risk}</span>
                        <span>
                          {t("confidenceLabel")}: {approval.confidence}%
                        </span>
                        {approval.priority_score > 0 && (
                          <span className="text-amber-400">
                            {t("priorityScore")}: {approval.priority_score}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => onApprove(approval.id)}
                        className="rounded bg-green-900 px-3 py-1 text-xs text-green-300 hover:bg-green-800"
                      >
                        {t("approve")}
                      </button>
                      <button
                        onClick={() => onReject(approval.id)}
                        className="rounded bg-red-900 px-3 py-1 text-xs text-red-300 hover:bg-red-800"
                      >
                        {t("reject")}
                      </button>
                    </div>
                  </div>
                  {/* Show payload details by action type */}
                  {(() => {
                    const payload = approval.action?.payload as Record<string, string> | null;
                    const aType = approval.action?.type;
                    if (aType === "REPLY_DRAFT" && payload?.reply_text) {
                      return (
                        <div className="mt-2 rounded border border-gray-800 bg-gray-950 px-3 py-2">
                          <p className="line-clamp-2 text-xs text-gray-400">
                            {payload.reply_text}
                          </p>
                        </div>
                      );
                    }
                    if (aType === "AUDIENCE_DRAFT" && payload?.audience_name) {
                      return (
                        <div className="mt-2 rounded border border-gray-800 bg-gray-950 px-3 py-2">
                          <p className="text-xs text-gray-400">
                            {t("audienceName")}: {payload.audience_name}
                          </p>
                        </div>
                      );
                    }
                    if (aType === "EXPORT" && payload?.export_type) {
                      return (
                        <div className="mt-2 rounded border border-gray-800 bg-gray-950 px-3 py-2">
                          <p className="text-xs text-gray-400">
                            {t("exportType")}: {payload.export_type === "HASHED_CSV" ? t("csvHashed") : t("csvPlain")}
                          </p>
                        </div>
                      );
                    }
                    if (aType === "CAMPAIGN_DRAFT" && payload) {
                      return (
                        <div className="mt-2 rounded border border-gray-800 bg-gray-950 px-3 py-2">
                          <p className="text-xs text-gray-400">
                            {payload.campaign_name as string}
                          </p>
                          <div className="mt-1 flex gap-3 text-[10px] text-gray-500">
                            <span>{t("objective")}: {payload.objective as string}</span>
                            <span>{t("platform")}: {payload.platform as string}</span>
                            <span>{t("budgetSuggestion")}: ${payload.budget_suggestion as string}/day</span>
                          </div>
                        </div>
                      );
                    }
                    if (aType === "CRM_SYNC" && payload?.lead_id) {
                      return (
                        <div className="mt-2 rounded border border-gray-800 bg-gray-950 px-3 py-2">
                          <p className="text-xs text-gray-400">
                            {t("sendToCrm")} &mdash; Lead {(payload.lead_id as string).slice(0, 8)}...
                          </p>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      <div className="rounded-lg border border-gray-800 bg-gray-900/50 px-4 py-3 text-center text-xs text-gray-500">
        {approvals.length} {t("pendingApprovals")}
      </div>
    </div>
  );
}

/* ── Audience Builder Wizard ── */

const ALL_INTENTS = ["PURCHASE", "COMPARISON", "COMPLAINT", "RECOMMENDATION", "QUESTION", "OTHER"];

function AudienceBuilderWizard({
  businessId,
  token,
  onCreated,
  onClose,
}: {
  businessId: string;
  token: string;
  onCreated: () => void;
  onClose: () => void;
}) {
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const [step, setStep] = useState(0); // 0=Seed, 1=Refine, 2=Preview
  const [name, setName] = useState("");
  const [selectedIntents, setSelectedIntents] = useState<string[]>(["PURCHASE", "COMPARISON"]);
  const [minScore, setMinScore] = useState(30);
  const [minConfidence, setMinConfidence] = useState(30);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(false);

  function toggleIntent(intent: string) {
    setSelectedIntents((prev) =>
      prev.includes(intent) ? prev.filter((i) => i !== intent) : [...prev, intent],
    );
  }

  async function loadPreview() {
    try {
      const leads = await apiFetch<FeedItem[]>(
        `/businesses/${businessId}/leads?limit=100`,
        { token },
      );
      const matching = leads.filter(
        (l) =>
          selectedIntents.includes(l.intent || "") &&
          (l.score || 0) >= minScore &&
          (l.confidence || 0) >= minConfidence,
      );
      setPreviewCount(matching.length);
    } catch {
      setPreviewCount(0);
    }
  }

  async function handleCreate() {
    if (!name.trim()) return;
    setCreating(true);
    try {
      await apiFetch(`/businesses/${businessId}/audiences/draft`, {
        method: "POST",
        token,
        body: JSON.stringify({
          name: name.trim(),
          definition: {
            intents: selectedIntents,
            min_score: minScore,
            min_confidence: minConfidence,
          },
        }),
      });
      setCreated(true);
      onCreated();
    } catch { /* ignore */ } finally {
      setCreating(false);
    }
  }

  const steps = [t("seedStep"), t("refineStep"), t("previewStep")];

  return (
    <section className="mb-6 rounded-lg border border-purple-800 bg-gray-900 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-purple-300">{t("audienceBuilder")}</h3>
        <button onClick={onClose} className="text-xs text-gray-500 hover:text-gray-300">
          {tc("cancel")}
        </button>
      </div>

      {/* Step indicator */}
      <div className="mb-4 flex gap-2">
        {steps.map((label, i) => (
          <button
            key={i}
            onClick={() => { if (i === 2) loadPreview(); setStep(i); }}
            className={`rounded-full px-3 py-1 text-xs ${step === i ? "bg-purple-800 text-purple-200" : "bg-gray-800 text-gray-500"}`}
          >
            {i + 1}. {label}
          </button>
        ))}
      </div>

      {step === 0 && (
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-gray-400">{t("audienceName")}</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none"
              placeholder="e.g. High-intent buyers"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-400">{t("selectIntents")}</label>
            <div className="flex flex-wrap gap-2">
              {ALL_INTENTS.map((intent) => (
                <button
                  key={intent}
                  onClick={() => toggleIntent(intent)}
                  className={`rounded-full px-3 py-1 text-xs ${
                    selectedIntents.includes(intent)
                      ? (INTENT_COLORS[intent] || "bg-gray-700 text-gray-300")
                      : "bg-gray-800 text-gray-600"
                  }`}
                >
                  {intent}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={() => setStep(1)}
            disabled={!name.trim() || selectedIntents.length === 0}
            className="rounded-lg bg-purple-800 px-4 py-1.5 text-xs font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
          >
            {tc("next")}
          </button>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-gray-400">{t("minScore")}: {minScore}</label>
            <input
              type="range"
              min={0}
              max={100}
              value={minScore}
              onChange={(e) => setMinScore(Number(e.target.value))}
              className="w-full"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-400">{t("minConfidence")}: {minConfidence}</label>
            <input
              type="range"
              min={0}
              max={100}
              value={minConfidence}
              onChange={(e) => setMinConfidence(Number(e.target.value))}
              className="w-full"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setStep(0)}
              className="rounded-lg border border-gray-700 px-4 py-1.5 text-xs text-gray-400 hover:bg-gray-800"
            >
              {tc("back")}
            </button>
            <button
              onClick={() => { loadPreview(); setStep(2); }}
              className="rounded-lg bg-purple-800 px-4 py-1.5 text-xs font-semibold text-white hover:bg-purple-700"
            >
              {tc("next")}
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          <div className="rounded border border-gray-800 bg-gray-950 px-3 py-2">
            <p className="text-xs text-gray-400">{t("audiencePreview")}</p>
            <p className="mt-1 text-sm font-medium">{name}</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {selectedIntents.map((i) => (
                <span key={i} className={`rounded px-1.5 py-0.5 text-[10px] ${INTENT_COLORS[i] || "bg-gray-800 text-gray-400"}`}>
                  {i}
                </span>
              ))}
            </div>
            <p className="mt-1 text-xs text-gray-500">
              {t("minScore")}: {minScore} | {t("minConfidence")}: {minConfidence}
            </p>
            {previewCount !== null && (
              <p className="mt-1 text-xs text-purple-400">
                {t("matchingLeads", { count: previewCount })}
              </p>
            )}
          </div>
          {created ? (
            <span className="text-xs text-emerald-400">{t("audienceDraftCreated")}</span>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => setStep(1)}
                className="rounded-lg border border-gray-700 px-4 py-1.5 text-xs text-gray-400 hover:bg-gray-800"
              >
                {tc("back")}
              </button>
              <button
                onClick={handleCreate}
                disabled={creating}
                className="rounded-lg bg-purple-700 px-4 py-1.5 text-xs font-semibold text-white hover:bg-purple-600 disabled:opacity-50"
              >
                {creating ? t("creatingAudience") : t("createAudienceDraft")}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/* ── Export Panel ── */

function ExportPanel({
  businessId,
  token,
  audiences,
  exports: exportList,
  onExportRequested,
  onClose,
}: {
  businessId: string;
  token: string;
  audiences: AudienceItem[];
  exports: ExportItem[];
  onExportRequested: () => void;
  onClose: () => void;
}) {
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const [audienceId, setAudienceId] = useState<string>("");
  const [exportType, setExportType] = useState<"CSV" | "HASHED_CSV">("CSV");
  const [requesting, setRequesting] = useState(false);
  const [requested, setRequested] = useState(false);

  async function handleRequest() {
    setRequesting(true);
    try {
      await apiFetch(`/businesses/${businessId}/exports`, {
        method: "POST",
        token,
        body: JSON.stringify({
          audience_id: audienceId || null,
          type: exportType,
        }),
      });
      setRequested(true);
      onExportRequested();
    } catch { /* ignore */ } finally {
      setRequesting(false);
    }
  }

  const STATUS_COLORS: Record<string, string> = {
    PENDING: "text-yellow-400",
    READY: "text-green-400",
    FAILED: "text-red-400",
  };

  return (
    <section className="mb-6 rounded-lg border border-orange-800 bg-gray-900 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-orange-300">{t("exportLeads")}</h3>
        <button onClick={onClose} className="text-xs text-gray-500 hover:text-gray-300">
          {tc("cancel")}
        </button>
      </div>

      <div className="mb-4 space-y-3">
        <div>
          <label className="mb-1 block text-xs text-gray-400">{t("audienceSegments")}</label>
          <select
            value={audienceId}
            onChange={(e) => setAudienceId(e.target.value)}
            className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
          >
            <option value="">All leads</option>
            {audiences.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs text-gray-400">{t("exportType")}</label>
          <div className="flex gap-2">
            <button
              onClick={() => setExportType("CSV")}
              className={`rounded-lg px-3 py-1.5 text-xs ${exportType === "CSV" ? "bg-orange-800 text-orange-200" : "bg-gray-800 text-gray-500"}`}
            >
              {t("csvPlain")}
            </button>
            <button
              onClick={() => setExportType("HASHED_CSV")}
              className={`rounded-lg px-3 py-1.5 text-xs ${exportType === "HASHED_CSV" ? "bg-orange-800 text-orange-200" : "bg-gray-800 text-gray-500"}`}
            >
              {t("csvHashed")}
            </button>
          </div>
        </div>

        {requested ? (
          <span className="text-xs text-emerald-400">{t("exportRequested")}</span>
        ) : (
          <button
            onClick={handleRequest}
            disabled={requesting}
            className="rounded-lg bg-orange-800 px-4 py-1.5 text-xs font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
          >
            {requesting ? t("requestingExport") : t("requestExport")}
          </button>
        )}
      </div>

      {/* Export history */}
      <div>
        <h4 className="mb-2 text-xs font-semibold text-gray-400">{t("exportHistory")}</h4>
        {exportList.length === 0 ? (
          <p className="text-xs text-gray-600">{t("noExports")}</p>
        ) : (
          <div className="space-y-1">
            {exportList.map((exp) => (
              <div
                key={exp.id}
                className="flex items-center justify-between rounded border border-gray-800 bg-gray-950 px-3 py-2"
              >
                <div className="text-xs">
                  <span className="text-gray-400">
                    {exp.type === "HASHED_CSV" ? t("csvHashed") : t("csvPlain")}
                  </span>
                  <span className={`ms-2 ${STATUS_COLORS[exp.status] || "text-gray-500"}`}>
                    {exp.status === "READY" ? t("exportReady") : exp.status === "FAILED" ? t("exportFailed") : t("exportPending")}
                  </span>
                  <span className="ms-2 text-gray-600">
                    {new Date(exp.created_at).toLocaleString()}
                  </span>
                </div>
                {exp.status === "READY" && (
                  <a
                    href={`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/exports/${exp.id}/download`}
                    className="rounded bg-green-900 px-2 py-0.5 text-xs text-green-300 hover:bg-green-800"
                  >
                    {t("download")}
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
