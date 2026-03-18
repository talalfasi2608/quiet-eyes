"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";
import { Modal } from "@/components/ui/Modal";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { CommandInput } from "@/components/ui/CommandInput";

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
  const [chatOpen, setChatOpen] = useState(false);
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
    setChatOpen(true);
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
    t("chips.findLeads"),
    t("chips.draftReply"),
    t("chips.showMentions"),
    t("chips.analyzeTrends"),
  ];

  // Load both recommended and approvals for the two-column layout
  const loadAllFeeds = useCallback(async () => {
    if (!token) return;
    setFeedLoading(true);
    try {
      const [recData, appData] = await Promise.all([
        apiFetch<(UnifiedFeedItem | FeedItem)[]>(
          `/businesses/${businessId}/feed?tab=recommended`,
          { token },
        ).catch(() => [] as (UnifiedFeedItem | FeedItem)[]),
        apiFetch<ApprovalItem[]>(
          `/businesses/${businessId}/approvals?status=PENDING`,
          { token },
        ).catch(() => [] as ApprovalItem[]),
      ]);
      setFeedItems(recData);
      setApprovals(appData);
    } catch {
      /* empty */
    } finally {
      setFeedLoading(false);
    }
  }, [businessId, token]);

  // Initial load for both columns
  useEffect(() => {
    loadAllFeeds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!token) return null;

  return (
    <div className="flex flex-col gap-8 pb-12">
      {/* ── Zone 1: AI Command Center ── */}
      <section className="pt-2">
        <h2 className="mb-4 text-xl font-semibold text-gray-100">
          {t("chatTitle")}
        </h2>
        <CommandInput
          placeholder={t("chatPlaceholder")}
          onSubmit={(val) => sendChat(val)}
          loading={chatLoading}
          suggestions={chips}
        />
      </section>

      {/* ── Zone 4: Quick Actions Bar ── */}
      <section className="flex flex-wrap items-center gap-3">
        <Button
          variant="secondary"
          size="sm"
          onClick={runIngestion}
          loading={ingesting}
        >
          {ingesting ? t("ingesting") : t("runIngestion")}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={runLeadGeneration}
          loading={generatingLeads}
        >
          {generatingLeads ? t("generatingLeads") : t("generateLeads")}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={runIntelligence}
          loading={runningIntel}
        >
          {runningIntel ? t("runningIntelligence") : t("runIntelligence")}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setShowAudienceBuilder(true)}
        >
          {t("audienceBuilder")}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => { setShowExportPanel(true); loadExports(); }}
        >
          {t("exportLeads")}
        </Button>

        {/* Status messages */}
        {ingestionMsg && (
          <span className="text-xs text-gray-400">{ingestionMsg}</span>
        )}
        {leadGenMsg && (
          <span className="text-xs text-gray-400">{leadGenMsg}</span>
        )}
        {intelMsg && (
          <span className="text-xs text-gray-400">{intelMsg}</span>
        )}
      </section>

      {/* ── Optimization Widget ── */}
      {topRecs.length > 0 && (
        <section>
          <SectionHeader
            title={t("optWidgetTitle")}
            action={
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push(`/dashboard/${businessId}/optimizations`)}
              >
                {t("optViewAll")}
              </Button>
            }
          />
          <div className="mt-3 space-y-2">
            {topRecs.map((rec) => (
              <Card key={rec.id} hover className="flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-gray-500">
                      {rec.type.replace(/_/g, " ")}
                    </span>
                    <span className="text-xs text-gray-600">{rec.confidence}%</span>
                    {rec.impact_score > 0 && (
                      <span className="text-xs text-gray-400">
                        {t("optImpact")}: {rec.impact_score}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-gray-200">{rec.title}</p>
                  {rec.summary && (
                    <p className="mt-0.5 text-xs text-gray-500">{rec.summary}</p>
                  )}
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => router.push(`/dashboard/${businessId}/optimizations`)}
                >
                  {t("optReview")}
                </Button>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* ── Zone 2 + 3: Two-column layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_0.54fr] gap-6">
        {/* ── Zone 2: Recommended Actions (left, ~65%) ── */}
        <section>
          <SectionHeader
            title={t("recommended")}
            action={
              feedItems.length > 0 ? (
                <Badge>{feedItems.length}</Badge>
              ) : null
            }
          />
          <div className="mt-4">
            {feedLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }, (_, i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            ) : (
              <RecommendedFeed
                items={feedItems.slice(0, 7)}
                noItemsText={t("noItems")}
                onCreateDraft={createReplyDraft}
                onSendToCrm={sendToCrm}
                onCreateAction={createActionFromFeed}
              />
            )}
          </div>
        </section>

        {/* ── Zone 3: Needs Approval (right, ~35%) ── */}
        <section>
          <SectionHeader
            title={t("needsApproval")}
            action={
              approvals.length > 0 ? (
                <Badge>{approvals.length}</Badge>
              ) : null
            }
          />
          <div className="mt-4">
            {feedLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 2 }, (_, i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            ) : (
              <NeedsApprovalFeed
                approvals={approvals}
                onApprove={(id) => handleApproval(id, "approve")}
                onReject={(id) => handleApproval(id, "reject")}
              />
            )}
          </div>
        </section>
      </div>

      {/* ── Mentions section (secondary) ── */}
      <section>
        <SectionHeader
          title={t("mentions")}
          action={
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setActiveTab("mentions");
                loadFeed();
              }}
            >
              {tc("loading")}
            </Button>
          }
        />
        <div className="mt-4">
          <MentionsFeed items={mentionItems} noItemsText={t("noItems")} />
        </div>
      </section>

      {/* ── Chat Panel (collapsible) ── */}
      {(chatMessages.length > 0 || chatOpen) && (
        <section>
          <SectionHeader
            title={t("chatThread")}
            action={
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setChatOpen(!chatOpen)}
              >
                {chatOpen ? tc("cancel") : t("chatThread")}
              </Button>
            }
          />
          {chatOpen && (
            <Card className="mt-3 max-h-80 overflow-y-auto">
              {chatMessages.length === 0 ? (
                <p className="text-center text-sm text-gray-600 py-6">
                  {t("noItems")}
                </p>
              ) : (
                <div className="space-y-3">
                  {chatMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={[
                        "max-w-[80%] rounded-lg px-3 py-2 text-sm",
                        msg.role === "USER"
                          ? "ms-auto bg-gray-800 text-gray-100"
                          : "me-auto bg-gray-900/80 text-gray-300",
                      ].join(" ")}
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
            </Card>
          )}
        </section>
      )}

      {/* ── Audience Builder Modal ── */}
      <Modal
        open={showAudienceBuilder}
        onClose={() => setShowAudienceBuilder(false)}
        title={t("audienceBuilder")}
        className="max-w-lg"
      >
        <AudienceBuilderWizard
          businessId={businessId}
          token={token!}
          onCreated={() => { loadFeed(); loadAudiences(); setShowAudienceBuilder(false); }}
          onClose={() => setShowAudienceBuilder(false)}
        />
      </Modal>

      {/* ── Export Panel Modal ── */}
      <Modal
        open={showExportPanel}
        onClose={() => setShowExportPanel(false)}
        title={t("exportLeads")}
        className="max-w-lg"
      >
        <ExportPanel
          businessId={businessId}
          token={token!}
          audiences={audiences}
          exports={exports}
          onExportRequested={() => { loadFeed(); loadExports(); }}
          onClose={() => setShowExportPanel(false)}
        />
      </Modal>

      {/* ── Quota Exceeded Modal ── */}
      <Modal
        open={!!quotaError}
        onClose={() => setQuotaError(null)}
        title={t("quotaExceeded")}
      >
        {quotaError && (
          <div>
            <p className="mb-4 text-sm text-gray-300">
              {t("quotaExceededMsg", { resource: quotaError.resource })}
            </p>
            <div className="mb-4 rounded-lg border border-gray-800 bg-gray-950 px-3 py-2 text-xs text-gray-400">
              {quotaError.resource}: {quotaError.current} / {quotaError.limit}
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => { setQuotaError(null); router.push(`/dashboard/${businessId}/billing`); }}
              >
                {t("upgradeNow")}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setQuotaError(null)}
              >
                {t("quotaDismiss")}
              </Button>
            </div>
          </div>
        )}
      </Modal>
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
    <Card hover>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex items-center gap-2">
            <span className="text-xs text-gray-500">{item.intent}</span>
            {item.confidence != null && (
              <span className="inline-flex items-center gap-1 text-xs text-gray-600">
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{ opacity: Math.max(0.3, (item.confidence || 0) / 100) }}
                  aria-hidden="true"
                />
                {item.confidence}%
              </span>
            )}
          </div>
          <p className="text-sm font-medium text-gray-200">
            {mention?.title || item.title || item.intent}
          </p>
          {(mention?.snippet || item.snippet) && (
            <p className="mt-1 line-clamp-2 text-xs text-gray-500">
              {mention?.snippet || item.snippet}
            </p>
          )}
        </div>
        {item.score != null && (
          <div className="shrink-0 text-end">
            <div className="text-xl font-semibold text-gray-200">{item.score}</div>
            <div className="text-[10px] text-gray-600">{t("scoreLabel")}</div>
          </div>
        )}
      </div>

      {evidenceUrl && (
        <a
          href={evidenceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block text-xs text-gray-400 hover:text-gray-300 transition-colors"
        >
          {t("evidence")}
        </a>
      )}

      {item.suggested_reply && (
        <div className="mt-3 rounded-lg border border-gray-800/50 bg-gray-950/50 px-3 py-2">
          <p className="mb-1 text-[10px] font-medium uppercase text-gray-600">
            {t("suggestedReply")}
          </p>
          <p className="line-clamp-2 text-xs text-gray-400">
            {item.suggested_reply}
          </p>
        </div>
      )}

      <div className="mt-3 flex items-center gap-2">
        {item.suggested_reply && (
          <>
            {created ? (
              <span className="text-xs text-gray-400">{t("draftCreated")}</span>
            ) : (
              <Button
                size="sm"
                onClick={handleCreateDraft}
                loading={creating}
              >
                {creating ? t("creatingDraft") : t("createReplyDraft")}
              </Button>
            )}
          </>
        )}
        {sentCrm ? (
          <span className="text-xs text-gray-400">{t("sentToCrm")}</span>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            onClick={async () => {
              setSendingCrm(true);
              await onSendToCrm(item.id);
              setSendingCrm(false);
              setSentCrm(true);
            }}
            loading={sendingCrm}
          >
            {sendingCrm ? t("sendingToCrm") : t("sendToCrm")}
          </Button>
        )}
      </div>
    </Card>
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
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-200">
            {item.title || "Untitled mention"}
          </p>
          {item.snippet && (
            <p className="mt-1 line-clamp-2 text-xs text-gray-500">
              {item.snippet}
            </p>
          )}
        </div>
        {item.source && (
          <span className="shrink-0 text-xs text-gray-600">
            {item.source.name}
          </span>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-600">
        {item.url && (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-400 hover:text-gray-300 transition-colors"
          >
            {t("evidence")}
          </a>
        )}
        {item.published_at && (
          <span>{new Date(item.published_at).toLocaleDateString()}</span>
        )}
        {item.fetched_at && (
          <span>
            {t("fetched")} {new Date(item.fetched_at).toLocaleString()}
          </span>
        )}
      </div>
    </Card>
  );
}

/* ── Intelligence Card ── */

const INTEL_CARD_STYLES: Record<string, { label: string }> = {
  trend: { label: "trendSpike" },
  competitor_event: { label: "competitorAlert" },
  review: { label: "reputationAlert" },
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
    <Card hover>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex items-center gap-2">
            <span className="text-xs text-gray-500">{t(style.label)}</span>
            <span className="inline-flex items-center gap-1 text-xs text-gray-600">
              <span
                className="inline-block h-1.5 w-1.5 rounded-full bg-gray-400"
                style={{ opacity: Math.max(0.3, item.confidence / 100) }}
                aria-hidden="true"
              />
              {item.confidence}%
            </span>
          </div>
          <p className="text-sm font-medium text-gray-200">{item.title}</p>
          <p className="mt-1 line-clamp-2 text-xs text-gray-500">{item.why_it_matters}</p>
        </div>
      </div>

      {item.evidence_urls.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {item.evidence_urls.slice(0, 3).map((url, i) => (
            <a
              key={i}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-gray-400 hover:text-gray-300 transition-colors"
            >
              {t("evidence")} {i + 1}
            </a>
          ))}
        </div>
      )}

      {actionLabel && (
        <div className="mt-3">
          {acted ? (
            <span className="text-xs text-gray-400">{t("actionCreated")}</span>
          ) : (
            <Button
              size="sm"
              onClick={handleAction}
              loading={acting}
            >
              {acting ? t("creatingAction") : actionLabel}
            </Button>
          )}
        </div>
      )}

      <div className="mt-2 text-[10px] text-gray-600">
        {new Date(item.created_at).toLocaleString()}
      </div>
    </Card>
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
      <EmptyState
        title={noItemsText}
        icon={
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        }
      />
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
      <EmptyState
        title={noItemsText}
        icon={
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        }
      />
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

  if (approvals.length === 0) {
    return (
      <EmptyState
        title={t("noItems")}
        icon={
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
        }
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* Bulk approve high-confidence */}
      {approvals.filter((a) => a.confidence >= 85 && a.risk === "LOW").length > 0 && (
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleBulkApproveHighConfidence}
          >
            {t("bulkApproveHighConfidence")}
          </Button>
          {bulkMsg && <span className="text-xs text-gray-400">{bulkMsg}</span>}
        </div>
      )}

      {grouped.map((group) => {
        if (group.items.length === 0) return null;
        return (
          <div key={group.key}>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-400">
                {t(group.label)}
                <span className="ms-1.5 text-xs text-gray-600">({group.items.length})</span>
              </h3>
              {group.key === "CAMPAIGN_DRAFT" && group.items.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBulkApproveCampaigns}
                >
                  {t("bulkApprove")}
                </Button>
              )}
            </div>
            <div className="space-y-2">
              {group.items.map((approval) => (
                <Card key={approval.id} className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-300">
                        {approval.action?.type.replace(/_/g, " ")}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-600">
                        <span>Risk: {approval.risk}</span>
                        <span>
                          {t("confidenceLabel")}: {approval.confidence}%
                        </span>
                        {approval.priority_score > 0 && (
                          <span>
                            {t("priorityScore")}: {approval.priority_score}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => onApprove(approval.id)}
                      >
                        {t("approve")}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onReject(approval.id)}
                      >
                        {t("reject")}
                      </Button>
                    </div>
                  </div>

                  {/* Show payload details by action type */}
                  {(() => {
                    const payload = approval.action?.payload as Record<string, string> | null;
                    const aType = approval.action?.type;
                    if (aType === "REPLY_DRAFT" && payload?.reply_text) {
                      return (
                        <div className="mt-2 rounded-lg border border-gray-800/50 bg-gray-950/50 px-3 py-2">
                          <p className="line-clamp-2 text-xs text-gray-500">
                            {payload.reply_text}
                          </p>
                        </div>
                      );
                    }
                    if (aType === "AUDIENCE_DRAFT" && payload?.audience_name) {
                      return (
                        <div className="mt-2 rounded-lg border border-gray-800/50 bg-gray-950/50 px-3 py-2">
                          <p className="text-xs text-gray-500">
                            {t("audienceName")}: {payload.audience_name}
                          </p>
                        </div>
                      );
                    }
                    if (aType === "EXPORT" && payload?.export_type) {
                      return (
                        <div className="mt-2 rounded-lg border border-gray-800/50 bg-gray-950/50 px-3 py-2">
                          <p className="text-xs text-gray-500">
                            {t("exportType")}: {payload.export_type === "HASHED_CSV" ? t("csvHashed") : t("csvPlain")}
                          </p>
                        </div>
                      );
                    }
                    if (aType === "CAMPAIGN_DRAFT" && payload) {
                      return (
                        <div className="mt-2 rounded-lg border border-gray-800/50 bg-gray-950/50 px-3 py-2">
                          <p className="text-xs text-gray-500">
                            {payload.campaign_name as string}
                          </p>
                          <div className="mt-1 flex flex-wrap gap-3 text-[10px] text-gray-600">
                            <span>{t("objective")}: {payload.objective as string}</span>
                            <span>{t("platform")}: {payload.platform as string}</span>
                            <span>{t("budgetSuggestion")}: ${payload.budget_suggestion as string}/day</span>
                          </div>
                        </div>
                      );
                    }
                    if (aType === "CRM_SYNC" && payload?.lead_id) {
                      return (
                        <div className="mt-2 rounded-lg border border-gray-800/50 bg-gray-950/50 px-3 py-2">
                          <p className="text-xs text-gray-500">
                            {t("sendToCrm")} &mdash; Lead {(payload.lead_id as string).slice(0, 8)}...
                          </p>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </Card>
              ))}
            </div>
          </div>
        );
      })}

      <div className="text-center text-xs text-gray-600 py-2">
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
  const [step, setStep] = useState(0);
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
    <div className="space-y-4">
      {/* Step indicator */}
      <div className="flex gap-2">
        {steps.map((label, i) => (
          <button
            key={i}
            onClick={() => { if (i === 2) loadPreview(); setStep(i); }}
            className={[
              "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
              step === i
                ? "bg-gray-800 text-gray-100"
                : "text-gray-500 hover:text-gray-300",
            ].join(" ")}
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
              className="w-full rounded-lg border border-gray-700/50 bg-gray-950/50 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-600 focus:border-gray-600 focus:outline-none"
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
                  className={[
                    "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                    selectedIntents.includes(intent)
                      ? "bg-gray-700 text-gray-200"
                      : "bg-gray-800/50 text-gray-600 hover:text-gray-400",
                  ].join(" ")}
                >
                  {intent}
                </button>
              ))}
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => setStep(1)}
            disabled={!name.trim() || selectedIntents.length === 0}
          >
            {tc("next")}
          </Button>
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
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setStep(0)}
            >
              {tc("back")}
            </Button>
            <Button
              size="sm"
              onClick={() => { loadPreview(); setStep(2); }}
            >
              {tc("next")}
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          <div className="rounded-lg border border-gray-800/50 bg-gray-950/50 px-3 py-3">
            <p className="text-xs text-gray-500">{t("audiencePreview")}</p>
            <p className="mt-1 text-sm font-medium text-gray-200">{name}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {selectedIntents.map((i) => (
                <span key={i} className="text-xs text-gray-500 bg-gray-800/50 rounded px-2 py-0.5">
                  {i}
                </span>
              ))}
            </div>
            <p className="mt-2 text-xs text-gray-600">
              {t("minScore")}: {minScore} | {t("minConfidence")}: {minConfidence}
            </p>
            {previewCount !== null && (
              <p className="mt-1 text-xs text-gray-400">
                {t("matchingLeads", { count: previewCount })}
              </p>
            )}
          </div>
          {created ? (
            <span className="text-xs text-gray-400">{t("audienceDraftCreated")}</span>
          ) : (
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setStep(1)}
              >
                {tc("back")}
              </Button>
              <Button
                size="sm"
                onClick={handleCreate}
                loading={creating}
              >
                {creating ? t("creatingAudience") : t("createAudienceDraft")}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
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

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-xs text-gray-400">{t("audienceSegments")}</label>
        <select
          value={audienceId}
          onChange={(e) => setAudienceId(e.target.value)}
          className="w-full rounded-lg border border-gray-700/50 bg-gray-950/50 px-3 py-2 text-sm text-gray-100 focus:border-gray-600 focus:outline-none"
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
            className={[
              "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
              exportType === "CSV"
                ? "bg-gray-700 text-gray-200"
                : "bg-gray-800/50 text-gray-500 hover:text-gray-300",
            ].join(" ")}
          >
            {t("csvPlain")}
          </button>
          <button
            onClick={() => setExportType("HASHED_CSV")}
            className={[
              "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
              exportType === "HASHED_CSV"
                ? "bg-gray-700 text-gray-200"
                : "bg-gray-800/50 text-gray-500 hover:text-gray-300",
            ].join(" ")}
          >
            {t("csvHashed")}
          </button>
        </div>
      </div>

      {requested ? (
        <span className="text-xs text-gray-400">{t("exportRequested")}</span>
      ) : (
        <Button
          size="sm"
          onClick={handleRequest}
          loading={requesting}
        >
          {requesting ? t("requestingExport") : t("requestExport")}
        </Button>
      )}

      {/* Export history */}
      <div className="border-t border-gray-800/50 pt-4">
        <h4 className="mb-2 text-xs font-medium text-gray-400">{t("exportHistory")}</h4>
        {exportList.length === 0 ? (
          <p className="text-xs text-gray-600">{t("noExports")}</p>
        ) : (
          <div className="space-y-1.5">
            {exportList.map((exp) => (
              <div
                key={exp.id}
                className="flex items-center justify-between rounded-lg border border-gray-800/50 bg-gray-950/50 px-3 py-2"
              >
                <div className="text-xs text-gray-500">
                  <span>
                    {exp.type === "HASHED_CSV" ? t("csvHashed") : t("csvPlain")}
                  </span>
                  <span className="ms-2">
                    {exp.status === "READY" ? t("exportReady") : exp.status === "FAILED" ? t("exportFailed") : t("exportPending")}
                  </span>
                  <span className="ms-2 text-gray-600">
                    {new Date(exp.created_at).toLocaleString()}
                  </span>
                </div>
                {exp.status === "READY" && (
                  <a
                    href={`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/exports/${exp.id}/download`}
                    className="text-xs text-gray-400 hover:text-gray-300 transition-colors"
                  >
                    {t("download")}
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
