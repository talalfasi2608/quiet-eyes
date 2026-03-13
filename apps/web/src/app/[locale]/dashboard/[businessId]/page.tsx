"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { useRouter } from "@/i18n/navigation";
import Topbar from "@/components/Topbar";

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
  // Mention fields
  title?: string | null;
  snippet?: string | null;
  url?: string | null;
  published_at?: string | null;
  fetched_at?: string;
  source?: { id: string; name: string; type: string } | null;
  // Lead fields
  intent?: string;
  score?: number;
  confidence?: number;
  status?: string;
  suggested_reply?: string | null;
  mention?: { title: string | null; snippet: string | null; url: string | null } | null;
}

interface ApprovalItem {
  id: string;
  status: string;
  risk: string;
  cost_impact: number;
  confidence: number;
  requires_human: boolean;
  created_at: string;
  decided_at: string | null;
  action: { id: string; type: string; payload: Record<string, unknown> | null } | null;
}

interface IngestionResult {
  business_id: string;
  search_new: number;
  rss_new: number;
  total_mentions: number;
}

type FeedTab = "recommended" | "needs_approval" | "mentions";

const ACTION_TYPE_GROUPS = [
  { key: "REPLY_DRAFT", label: "replyDrafts" },
  { key: "AUDIENCE_DRAFT", label: "audienceSegments" },
  { key: "CAMPAIGN_DRAFT", label: "campaigns" },
  { key: "EXPORT", label: "exports" },
] as const;

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
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [mentionItems, setMentionItems] = useState<MentionItem[]>([]);
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [ingesting, setIngesting] = useState(false);
  const [ingestionMsg, setIngestionMsg] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!token) {
      router.push("/login");
    }
  }, [token, router]);

  const loadFeed = useCallback(async () => {
    if (!token) return;
    setFeedLoading(true);
    try {
      if (activeTab === "recommended") {
        const data = await apiFetch<FeedItem[]>(
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
    } catch {
      setIngestionMsg("Ingestion failed");
    } finally {
      setIngesting(false);
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
    } catch {
      /* ignore */
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
    } catch {
      /* ignore */
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
        {/* Main content: Chat + Feed */}
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
              <button
                onClick={runIngestion}
                disabled={ingesting}
                className="ms-auto rounded-lg border border-blue-700 bg-blue-950 px-3 py-1 text-xs text-blue-300 hover:bg-blue-900 disabled:opacity-50"
              >
                {ingesting ? t("ingesting") : t("runIngestion")}
              </button>
              {ingestionMsg && (
                <span className="text-xs text-green-400">{ingestionMsg}</span>
              )}
            </div>
          </section>

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
              <RecommendedFeed items={feedItems} noItemsText={t("noItems")} />
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
    </div>
  );
}

/* ── Mention Card (shared between Recommended and Mentions tabs) ── */

function MentionCard({ item }: { item: { title?: string | null; snippet?: string | null; url?: string | null; published_at?: string | null; fetched_at?: string; source?: { name: string; type: string } | null } }) {
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

/* ── Recommended Feed (now shows mentions when no leads) ── */

function RecommendedFeed({
  items,
  noItemsText,
}: {
  items: FeedItem[];
  noItemsText: string;
}) {
  if (items.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-gray-500">{noItemsText}</p>
    );
  }

  // Items could be leads or mentions from the API
  const isLead = (item: FeedItem) => "intent" in item && item.intent;

  return (
    <div className="space-y-3">
      {items.map((item) =>
        isLead(item) ? (
          <div
            key={item.id}
            className="rounded-lg border border-gray-800 bg-gray-900 p-4"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium">
                  {item.mention?.title || item.intent}
                </p>
                {item.mention?.snippet && (
                  <p className="mt-1 text-xs text-gray-400">
                    {item.mention.snippet}
                  </p>
                )}
              </div>
              <span className="rounded bg-gray-800 px-2 py-0.5 text-xs text-gray-400">
                {item.score}%
              </span>
            </div>
            {item.mention?.url && (
              <a
                href={item.mention.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 block text-xs text-blue-400 hover:underline"
              >
                {item.mention.url}
              </a>
            )}
          </div>
        ) : (
          <MentionCard key={item.id} item={item} />
        ),
      )}
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

  const grouped = ACTION_TYPE_GROUPS.map((group) => ({
    ...group,
    items: approvals.filter((a) => a.action?.type === group.key),
  }));

  return (
    <div className="space-y-6">
      {grouped.map((group) => (
        <div key={group.key}>
          <h3 className="mb-2 text-sm font-semibold text-gray-400">
            {t(group.label)}
          </h3>
          {group.items.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-800 px-4 py-6 text-center text-xs text-gray-600">
              {t("noItems")}
            </div>
          ) : (
            <div className="space-y-2">
              {group.items.map((approval) => (
                <div
                  key={approval.id}
                  className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {approval.action?.type.replace("_", " ")}
                    </p>
                    <div className="mt-1 flex gap-2 text-xs text-gray-500">
                      <span>Risk: {approval.risk}</span>
                      <span>Confidence: {approval.confidence}%</span>
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
