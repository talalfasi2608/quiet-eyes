"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { useRouter } from "@/i18n/navigation";
import Topbar from "@/components/Topbar";

/* ── Types ── */

interface OutboundItem {
  id: string;
  business_id: string;
  channel: string;
  recipient_name: string | null;
  recipient_handle: string | null;
  subject: string | null;
  body: string;
  payload: Record<string, unknown> | null;
  reason: string | null;
  evidence_url: string | null;
  lead_id: string | null;
  action_id: string | null;
  status: string;
  created_at: string;
  executed_at: string | null;
}

const CHANNELS = ["EMAIL", "WHATSAPP", "LINKEDIN", "CONTENT", "CRM"] as const;

const CHANNEL_LABELS: Record<string, string> = {
  EMAIL: "channelEmail",
  WHATSAPP: "channelWhatsapp",
  LINKEDIN: "channelLinkedin",
  CONTENT: "channelContent",
  CRM: "channelCrm",
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "outboundStatusDraft",
  APPROVAL_PENDING: "outboundStatusPending",
  APPROVED: "outboundStatusApproved",
  EXECUTED: "outboundStatusExecuted",
  FAILED: "outboundStatusFailed",
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-800 text-gray-300",
  APPROVAL_PENDING: "bg-yellow-900 text-yellow-300",
  APPROVED: "bg-blue-900 text-blue-300",
  EXECUTED: "bg-green-900 text-green-300",
  FAILED: "bg-red-900 text-red-300",
};

const CHANNEL_COLORS: Record<string, string> = {
  EMAIL: "border-blue-700 bg-blue-950 text-blue-300",
  WHATSAPP: "border-green-700 bg-green-950 text-green-300",
  LINKEDIN: "border-sky-700 bg-sky-950 text-sky-300",
  CONTENT: "border-purple-700 bg-purple-950 text-purple-300",
  CRM: "border-orange-700 bg-orange-950 text-orange-300",
};

type Tab = "drafts" | "pending" | "sent";

export default function OutboundPage() {
  const t = useTranslations("dashboard");
  const router = useRouter();
  const params = useParams<{ businessId: string }>();
  const businessId = params.businessId;
  const token = getToken();

  const [tab, setTab] = useState<Tab>("drafts");
  const [items, setItems] = useState<OutboundItem[]>([]);
  const [preview, setPreview] = useState<OutboundItem | null>(null);

  /* ── Form state ── */
  const [showForm, setShowForm] = useState(false);
  const [channel, setChannel] = useState<string>("EMAIL");
  const [recipientName, setRecipientName] = useState("");
  const [recipientHandle, setRecipientHandle] = useState("");
  const [subject, setSubject] = useState("");
  const [prompt, setPrompt] = useState("");
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState("");

  useEffect(() => {
    if (!token) router.push("/login");
  }, [token, router]);

  const statusFilter = tab === "drafts" ? "DRAFT,APPROVAL_PENDING" : tab === "pending" ? "APPROVAL_PENDING" : "EXECUTED,FAILED,APPROVED";

  const loadItems = useCallback(async () => {
    if (!token || !businessId) return;
    try {
      // Load all and filter client-side for multi-status
      const data = await apiFetch<OutboundItem[]>(
        `/businesses/${businessId}/outbound?limit=100`,
        { token },
      );
      const statuses = statusFilter.split(",");
      setItems(data.filter((i) => statuses.includes(i.status)));
    } catch { /* empty */ }
  }, [token, businessId, statusFilter]);

  useEffect(() => { loadItems(); }, [loadItems]);

  async function createDraft() {
    if (!token || !businessId) return;
    setCreating(true);
    setCreateMsg("");
    try {
      await apiFetch(`/businesses/${businessId}/outbound/draft`, {
        token,
        method: "POST",
        body: JSON.stringify({
          channel,
          recipient_name: recipientName || null,
          recipient_handle: recipientHandle || null,
          subject: subject || null,
          prompt: prompt || null,
        }),
      });
      setCreateMsg(t("outboundDraftCreated"));
      setShowForm(false);
      setRecipientName("");
      setRecipientHandle("");
      setSubject("");
      setPrompt("");
      loadItems();
    } catch { setCreateMsg("Error"); }
    setCreating(false);
  }

  async function deleteItem(id: string) {
    if (!token) return;
    try {
      await apiFetch(`/outbound/${id}`, { token, method: "DELETE" });
      loadItems();
    } catch { /* empty */ }
  }

  if (!token) return null;

  const tabs: { key: Tab; label: string }[] = [
    { key: "drafts", label: t("outboundDrafts") },
    { key: "pending", label: t("outboundPending") },
    { key: "sent", label: t("outboundSent") },
  ];

  return (
    <div className="flex h-screen flex-col">
      <Topbar />
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-4xl">
          {/* Header */}
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold">{t("outboundPage")}</h1>
              <p className="text-xs text-gray-500">{t("outboundSubtitle")}</p>
            </div>
            <button
              onClick={() => setShowForm(!showForm)}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500"
            >
              {t("createOutboundDraft")}
            </button>
          </div>

          {/* Create form */}
          {showForm && (
            <div className="mb-4 rounded-lg border border-gray-700 bg-gray-900 p-4 space-y-3">
              {/* Channel selector */}
              <div className="flex flex-wrap gap-2">
                {CHANNELS.map((ch) => (
                  <button
                    key={ch}
                    onClick={() => setChannel(ch)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                      channel === ch
                        ? CHANNEL_COLORS[ch]
                        : "border-gray-700 text-gray-400 hover:bg-gray-800"
                    }`}
                  >
                    {t(CHANNEL_LABELS[ch])}
                  </button>
                ))}
              </div>
              {channel !== "CONTENT" && (
                <>
                  <input
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    placeholder={t("recipientName")}
                    className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-1.5 text-xs"
                  />
                  <input
                    value={recipientHandle}
                    onChange={(e) => setRecipientHandle(e.target.value)}
                    placeholder={t("recipientHandle")}
                    className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-1.5 text-xs"
                  />
                </>
              )}
              {channel === "EMAIL" && (
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder={t("outboundSubject")}
                  className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-1.5 text-xs"
                />
              )}
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={t("outboundPrompt")}
                rows={2}
                className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-1.5 text-xs"
              />
              <div className="flex items-center gap-3">
                <button
                  onClick={createDraft}
                  disabled={creating}
                  className="rounded-lg bg-green-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-green-500 disabled:opacity-50"
                >
                  {creating ? t("creatingOutbound") : t("createOutboundDraft")}
                </button>
                {createMsg && <span className="text-xs text-green-400">{createMsg}</span>}
              </div>
            </div>
          )}

          {/* Tab bar */}
          <div className="mb-4 flex gap-1 rounded-lg border border-gray-800 bg-gray-900 p-1">
            {tabs.map((tb) => (
              <button
                key={tb.key}
                onClick={() => { setTab(tb.key); setPreview(null); }}
                className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  tab === tb.key
                    ? "bg-indigo-600 text-white"
                    : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
                }`}
              >
                {tb.label}
              </button>
            ))}
          </div>

          {/* List + Preview layout */}
          <div className="flex gap-4">
            {/* List */}
            <div className={`space-y-2 ${preview ? "w-1/2" : "w-full"}`}>
              {items.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-800 px-4 py-8 text-center text-xs text-gray-600">
                  {t("noOutbound")}
                </div>
              ) : (
                items.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => setPreview(item)}
                    className={`cursor-pointer rounded-lg border bg-gray-900 p-3 transition-colors hover:bg-gray-800 ${
                      preview?.id === item.id ? "border-indigo-600" : "border-gray-800"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${CHANNEL_COLORS[item.channel] || ""}`}>
                          {t(CHANNEL_LABELS[item.channel] || item.channel)}
                        </span>
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${STATUS_COLORS[item.status] || ""}`}>
                          {t(STATUS_LABELS[item.status] || item.status)}
                        </span>
                      </div>
                      <span className="text-[10px] text-gray-600">
                        {new Date(item.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    {item.subject && <div className="mt-1 text-xs font-medium">{item.subject}</div>}
                    <div className="mt-1 line-clamp-2 text-[10px] text-gray-400">{item.body}</div>
                    {item.recipient_name && (
                      <div className="mt-1 text-[10px] text-gray-500">
                        {t("outboundRecipient")}: {item.recipient_name}
                        {item.recipient_handle && ` (${item.recipient_handle})`}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Preview panel */}
            {preview && (
              <div className="w-1/2 rounded-lg border border-gray-700 bg-gray-900 p-4">
                <h3 className="mb-3 text-sm font-semibold">{t("messagePreview")}</h3>

                {/* Channel + Status badges */}
                <div className="mb-3 flex gap-2">
                  <span className={`rounded border px-2 py-0.5 text-[10px] font-medium ${CHANNEL_COLORS[preview.channel] || ""}`}>
                    {t(CHANNEL_LABELS[preview.channel] || preview.channel)}
                  </span>
                  <span className={`rounded px-2 py-0.5 text-[10px] font-medium ${STATUS_COLORS[preview.status] || ""}`}>
                    {t(STATUS_LABELS[preview.status] || preview.status)}
                  </span>
                </div>

                {/* Recipient info */}
                {(preview.recipient_name || preview.recipient_handle) && (
                  <div className="mb-3 rounded border border-gray-800 bg-gray-950 p-2">
                    <div className="text-[10px] font-medium text-gray-400">{t("outboundRecipient")}</div>
                    <div className="text-xs">
                      {preview.recipient_name || "—"}
                      {preview.recipient_handle && (
                        <span className="ml-1 text-gray-500">({preview.recipient_handle})</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Subject */}
                {preview.subject && (
                  <div className="mb-3">
                    <div className="text-[10px] font-medium text-gray-400">{t("outboundSubject")}</div>
                    <div className="text-xs">{preview.subject}</div>
                  </div>
                )}

                {/* Message body */}
                <div className="mb-3">
                  <div className="text-[10px] font-medium text-gray-400">{t("outboundBody")}</div>
                  <pre className="mt-1 max-h-48 overflow-y-auto whitespace-pre-wrap rounded border border-gray-800 bg-gray-950 p-2 text-xs">
                    {preview.body}
                  </pre>
                </div>

                {/* Reason */}
                {preview.reason && (
                  <div className="mb-3">
                    <div className="text-[10px] font-medium text-gray-400">{t("outboundReason")}</div>
                    <div className="text-[10px] text-gray-300">{preview.reason}</div>
                  </div>
                )}

                {/* Evidence */}
                {preview.evidence_url && (
                  <div className="mb-3">
                    <div className="text-[10px] font-medium text-gray-400">{t("outboundEvidence")}</div>
                    <a
                      href={preview.evidence_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-indigo-400 hover:underline"
                    >
                      {preview.evidence_url}
                    </a>
                  </div>
                )}

                {/* Lead reference */}
                {preview.lead_id && (
                  <div className="mb-3 text-[10px] text-gray-500">
                    {t("fromLead")}: {preview.lead_id}
                  </div>
                )}

                {/* Actions */}
                {(preview.status === "DRAFT" || preview.status === "APPROVAL_PENDING") && (
                  <button
                    onClick={() => { deleteItem(preview.id); setPreview(null); }}
                    className="rounded border border-red-800 px-3 py-1 text-[10px] text-red-400 hover:bg-red-950"
                  >
                    {t("deleteOutbound")}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
