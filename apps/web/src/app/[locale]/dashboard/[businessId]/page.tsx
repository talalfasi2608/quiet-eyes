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

interface LeadItem {
  id: string;
  intent: string;
  score: number;
  confidence: number;
  status: string;
  suggested_reply: string | null;
  mention: { title: string | null; snippet: string | null; url: string | null } | null;
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

type FeedTab = "recommended" | "needs_approval";

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
  const [leads, setLeads] = useState<LeadItem[]>([]);
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);
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
        const data = await apiFetch<LeadItem[]>(
          `/businesses/${businessId}/feed?tab=recommended`,
          { token },
        );
        setLeads(data);
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
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
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
            <div className="mt-2 flex flex-wrap gap-2">
              {chips.map((chip) => (
                <button
                  key={chip.key}
                  onClick={() => sendChat(chip.label)}
                  className="rounded-full border border-gray-700 px-3 py-1 text-xs hover:bg-gray-800"
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </section>

          {/* Feed */}
          <section className="flex-1">
            <h2 className="mb-3 text-lg font-semibold">{t("feedTitle")}</h2>
            <div className="mb-4 flex gap-1 border-b border-gray-800">
              <button
                onClick={() => setActiveTab("recommended")}
                className={`px-4 py-2 text-sm font-medium ${activeTab === "recommended" ? "border-b-2 border-white text-white" : "text-gray-500 hover:text-gray-300"}`}
              >
                {t("recommended")}
              </button>
              <button
                onClick={() => setActiveTab("needs_approval")}
                className={`px-4 py-2 text-sm font-medium ${activeTab === "needs_approval" ? "border-b-2 border-white text-white" : "text-gray-500 hover:text-gray-300"}`}
              >
                {t("needsApproval")}
              </button>
            </div>

            {feedLoading ? (
              <p className="py-8 text-center text-sm text-gray-500">
                {tc("loading")}
              </p>
            ) : activeTab === "recommended" ? (
              <RecommendedFeed leads={leads} noItemsText={t("noItems")} />
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

function RecommendedFeed({
  leads,
  noItemsText,
}: {
  leads: LeadItem[];
  noItemsText: string;
}) {
  if (leads.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-gray-500">{noItemsText}</p>
    );
  }
  return (
    <div className="space-y-3">
      {leads.map((lead) => (
        <div
          key={lead.id}
          className="rounded-lg border border-gray-800 bg-gray-900 p-4"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium">
                {lead.mention?.title || lead.intent}
              </p>
              {lead.mention?.snippet && (
                <p className="mt-1 text-xs text-gray-400">
                  {lead.mention.snippet}
                </p>
              )}
            </div>
            <span className="rounded bg-gray-800 px-2 py-0.5 text-xs text-gray-400">
              {lead.score}%
            </span>
          </div>
          {lead.mention?.url && (
            <a
              href={lead.mention.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 block text-xs text-blue-400 hover:underline"
            >
              {lead.mention.url}
            </a>
          )}
        </div>
      ))}
    </div>
  );
}

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
