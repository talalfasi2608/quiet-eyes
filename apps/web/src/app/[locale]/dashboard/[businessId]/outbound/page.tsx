"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { useRouter } from "@/i18n/navigation";
import { PageHeader, Card, Badge, Button, Tabs, Input, Textarea, EmptyState } from "@/components/ui";

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

const STATUS_BADGE_VARIANT: Record<string, "default" | "success" | "warning" | "error" | "info"> = {
  DRAFT: "default",
  APPROVAL_PENDING: "warning",
  APPROVED: "info",
  EXECUTED: "success",
  FAILED: "error",
};

const CHANNEL_BADGE_VARIANT: Record<string, "default" | "success" | "warning" | "error" | "info"> = {
  EMAIL: "info",
  WHATSAPP: "success",
  LINKEDIN: "info",
  CONTENT: "default",
  CRM: "warning",
};

type TabKey = "drafts" | "pending" | "sent";

export default function OutboundPage() {
  const t = useTranslations("dashboard");
  const router = useRouter();
  const params = useParams<{ businessId: string }>();
  const businessId = params.businessId;
  const token = getToken();

  const [tab, setTab] = useState<TabKey>("drafts");
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

  const tabList = [
    { key: "drafts", label: t("outboundDrafts") },
    { key: "pending", label: t("outboundPending") },
    { key: "sent", label: t("outboundSent") },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("outboundPage")}
        description={t("outboundSubtitle")}
        actions={
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            {t("createOutboundDraft")}
          </Button>
        }
      />

      {/* Create form */}
      {showForm && (
        <Card>
          <div className="space-y-3">
            {/* Channel selector */}
            <div className="flex flex-wrap gap-2">
              {CHANNELS.map((ch) => (
                <Button
                  key={ch}
                  variant={channel === ch ? "primary" : "secondary"}
                  size="sm"
                  onClick={() => setChannel(ch)}
                >
                  {t(CHANNEL_LABELS[ch])}
                </Button>
              ))}
            </div>
            {channel !== "CONTENT" && (
              <>
                <Input
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder={t("recipientName")}
                />
                <Input
                  value={recipientHandle}
                  onChange={(e) => setRecipientHandle(e.target.value)}
                  placeholder={t("recipientHandle")}
                />
              </>
            )}
            {channel === "EMAIL" && (
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder={t("outboundSubject")}
              />
            )}
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={t("outboundPrompt")}
              rows={2}
            />
            <div className="flex items-center gap-3">
              <Button onClick={createDraft} loading={creating}>
                {creating ? t("creatingOutbound") : t("createOutboundDraft")}
              </Button>
              {createMsg && <span className="text-xs text-green-400">{createMsg}</span>}
            </div>
          </div>
        </Card>
      )}

      {/* Tab bar */}
      <Tabs
        tabs={tabList}
        active={tab}
        onChange={(k) => { setTab(k as TabKey); setPreview(null); }}
      />

      {/* List + Preview layout */}
      <div className="flex gap-4">
        {/* List */}
        <div className={`space-y-2 ${preview ? "w-1/2" : "w-full"}`}>
          {items.length === 0 ? (
            <EmptyState title={t("noOutbound")} />
          ) : (
            items.map((item) => (
              <Card
                key={item.id}
                hover
                onClick={() => setPreview(item)}
                className={preview?.id === item.id ? "!border-gray-600" : ""}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant={CHANNEL_BADGE_VARIANT[item.channel] || "default"}>
                      {t(CHANNEL_LABELS[item.channel] || item.channel)}
                    </Badge>
                    <Badge variant={STATUS_BADGE_VARIANT[item.status] || "default"}>
                      {t(STATUS_LABELS[item.status] || item.status)}
                    </Badge>
                  </div>
                  <span className="text-[10px] text-gray-500">
                    {new Date(item.created_at).toLocaleDateString()}
                  </span>
                </div>
                {item.subject && <div className="mt-1 text-xs font-medium text-gray-100">{item.subject}</div>}
                <div className="mt-1 line-clamp-2 text-[10px] text-gray-400">{item.body}</div>
                {item.recipient_name && (
                  <div className="mt-1 text-[10px] text-gray-500">
                    {t("outboundRecipient")}: {item.recipient_name}
                    {item.recipient_handle && ` (${item.recipient_handle})`}
                  </div>
                )}
              </Card>
            ))
          )}
        </div>

        {/* Preview panel */}
        {preview && (
          <Card className="w-1/2">
            <h3 className="mb-3 text-sm font-semibold text-gray-100">{t("messagePreview")}</h3>

            {/* Channel + Status badges */}
            <div className="mb-3 flex gap-2">
              <Badge variant={CHANNEL_BADGE_VARIANT[preview.channel] || "default"}>
                {t(CHANNEL_LABELS[preview.channel] || preview.channel)}
              </Badge>
              <Badge variant={STATUS_BADGE_VARIANT[preview.status] || "default"}>
                {t(STATUS_LABELS[preview.status] || preview.status)}
              </Badge>
            </div>

            {/* Recipient info */}
            {(preview.recipient_name || preview.recipient_handle) && (
              <div className="mb-3 rounded-lg border border-gray-800/50 bg-gray-900 p-2">
                <div className="text-[10px] font-medium text-gray-400">{t("outboundRecipient")}</div>
                <div className="text-xs text-gray-100">
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
                <div className="text-xs text-gray-100">{preview.subject}</div>
              </div>
            )}

            {/* Message body */}
            <div className="mb-3">
              <div className="text-[10px] font-medium text-gray-400">{t("outboundBody")}</div>
              <pre className="mt-1 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-lg border border-gray-800/50 bg-gray-900 p-2 text-xs text-gray-300">
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
                  className="text-[10px] text-blue-400 hover:underline"
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
              <Button
                variant="danger"
                size="sm"
                onClick={() => { deleteItem(preview.id); setPreview(null); }}
              >
                {t("deleteOutbound")}
              </Button>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
