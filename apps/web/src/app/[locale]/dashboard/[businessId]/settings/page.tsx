"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { useRouter } from "@/i18n/navigation";
import Topbar from "@/components/Topbar";

interface IntegrationItem {
  id: string;
  business_id: string;
  type: string;
  name: string;
  config: Record<string, string> | null;
  is_enabled: boolean;
  created_at: string;
}

interface IntegrationEvent {
  id: string;
  business_id: string;
  integration_id: string;
  event_type: string;
  payload: Record<string, unknown> | null;
  status: "PENDING" | "SENT" | "FAILED";
  error_message: string | null;
  created_at: string;
  sent_at: string | null;
}

interface TestResult {
  success: boolean;
  status_code: number | null;
  error: string | null;
}

export default function SettingsPage() {
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const router = useRouter();
  const { businessId } = useParams<{ businessId: string }>();
  const token = getToken();

  const [integrations, setIntegrations] = useState<IntegrationItem[]>([]);
  const [events, setEvents] = useState<IntegrationEvent[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [secretHeader, setSecretHeader] = useState("");
  const [secretToken, setSecretToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, TestResult>>({});

  // Meta integration state
  const [showMetaForm, setShowMetaForm] = useState(false);
  const [metaName, setMetaName] = useState("Meta Ads");
  const [metaAccessToken, setMetaAccessToken] = useState("");
  const [metaAdAccountId, setMetaAdAccountId] = useState("");
  const [metaPageId, setMetaPageId] = useState("");
  const [savingMeta, setSavingMeta] = useState(false);

  // Client notes state
  const [clientNotes, setClientNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  useEffect(() => {
    if (!token) router.push("/login");
  }, [token, router]);

  const loadIntegrations = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiFetch<IntegrationItem[]>(
        `/businesses/${businessId}/integrations`,
        { token },
      );
      setIntegrations(data);
    } catch { /* empty */ }
  }, [businessId, token]);

  const loadEvents = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiFetch<IntegrationEvent[]>(
        `/businesses/${businessId}/integration-events`,
        { token },
      );
      setEvents(data);
    } catch { /* empty */ }
  }, [businessId, token]);

  const loadBusiness = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiFetch<{ client_notes: string | null }>(
        `/businesses/${businessId}`,
        { token },
      );
      setClientNotes(data.client_notes || "");
    } catch { /* empty */ }
  }, [businessId, token]);

  useEffect(() => {
    loadIntegrations();
    loadEvents();
    loadBusiness();
  }, [loadIntegrations, loadEvents, loadBusiness]);

  async function handleCreate() {
    if (!token || !name.trim() || !webhookUrl.trim()) return;
    setSaving(true);
    try {
      await apiFetch(`/businesses/${businessId}/integrations`, {
        method: "POST",
        token,
        body: JSON.stringify({
          name: name.trim(),
          webhook_url: webhookUrl.trim(),
          secret_header: secretHeader.trim() || null,
          secret_token: secretToken.trim() || null,
        }),
      });
      setName("");
      setWebhookUrl("");
      setSecretHeader("");
      setSecretToken("");
      setShowForm(false);
      loadIntegrations();
    } catch { /* ignore */ } finally {
      setSaving(false);
    }
  }

  async function handleSaveNotes() {
    if (!token) return;
    setSavingNotes(true);
    try {
      await apiFetch(`/businesses/${businessId}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ client_notes: clientNotes }),
      });
    } catch { /* ignore */ } finally {
      setSavingNotes(false);
    }
  }

  async function handleCreateMeta() {
    if (!token || !metaName.trim()) return;
    setSavingMeta(true);
    try {
      await apiFetch(`/businesses/${businessId}/integrations/meta`, {
        method: "POST",
        token,
        body: JSON.stringify({
          name: metaName.trim(),
          access_token: metaAccessToken.trim() || null,
          ad_account_id: metaAdAccountId.trim() || null,
          page_id: metaPageId.trim() || null,
        }),
      });
      setMetaName("Meta Ads");
      setMetaAccessToken("");
      setMetaAdAccountId("");
      setMetaPageId("");
      setShowMetaForm(false);
      loadIntegrations();
    } catch { /* ignore */ } finally {
      setSavingMeta(false);
    }
  }

  async function handleToggle(integ: IntegrationItem) {
    if (!token) return;
    try {
      await apiFetch(`/integrations/${integ.id}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ is_enabled: !integ.is_enabled }),
      });
      loadIntegrations();
    } catch { /* ignore */ }
  }

  async function handleTest(integId: string) {
    if (!token) return;
    setTestingId(integId);
    try {
      const res = await apiFetch<TestResult>(`/integrations/${integId}/test`, {
        method: "POST",
        token,
      });
      setTestResult((prev) => ({ ...prev, [integId]: res }));
    } catch {
      setTestResult((prev) => ({
        ...prev,
        [integId]: { success: false, status_code: null, error: "Request failed" },
      }));
    } finally {
      setTestingId(null);
    }
  }

  async function handleRetry(eventId: string) {
    if (!token) return;
    try {
      await apiFetch(`/integration-events/${eventId}/retry`, {
        method: "POST",
        token,
      });
      loadEvents();
    } catch { /* ignore */ }
  }

  const EVENT_STATUS_COLORS: Record<string, string> = {
    SENT: "text-green-400",
    FAILED: "text-red-400",
    PENDING: "text-yellow-400",
  };

  if (!token) return null;

  return (
    <div className="flex h-screen flex-col">
      <Topbar />
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-3xl">
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold">{t("integrations")}</h1>
              <p className="text-xs text-gray-500">{t("integrationsSubtitle")}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => router.push(`/dashboard/${businessId}`)}
                className="rounded-lg border border-gray-700 px-3 py-1.5 text-xs text-gray-400 hover:bg-gray-800"
              >
                {tc("back")}
              </button>
              <button
                onClick={() => setShowForm(!showForm)}
                className="rounded-lg bg-cyan-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-700"
              >
                {t("addIntegration")}
              </button>
            </div>
          </div>

          {/* Client Notes */}
          <section className="mb-6 rounded-lg border border-gray-800 bg-gray-900 p-4">
            <h2 className="mb-2 text-sm font-semibold">{t("clientNotes")}</h2>
            <textarea
              value={clientNotes}
              onChange={(e) => setClientNotes(e.target.value)}
              placeholder={t("clientNotesPlaceholder")}
              rows={3}
              className="mb-2 w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
            <button
              onClick={handleSaveNotes}
              disabled={savingNotes}
              className="rounded-lg bg-gray-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-600 disabled:opacity-50"
            >
              {savingNotes ? tc("loading") : tc("save")}
            </button>
          </section>

          {/* Meta Integration Section */}
          <section className="mb-6">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold">{t("metaIntegration")}</h2>
                <p className="text-[10px] text-gray-500">{t("metaIntegrationDesc")}</p>
              </div>
              <button
                onClick={() => setShowMetaForm(!showMetaForm)}
                className="rounded-lg bg-blue-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
              >
                {t("addMetaIntegration")}
              </button>
            </div>

            {showMetaForm && (
              <div className="mb-4 rounded-lg border border-blue-800 bg-gray-900 p-4">
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs text-gray-400">{t("integrationName")}</label>
                    <input
                      value={metaName}
                      onChange={(e) => setMetaName(e.target.value)}
                      className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-gray-400">{t("metaAccessToken")}</label>
                    <input
                      value={metaAccessToken}
                      onChange={(e) => setMetaAccessToken(e.target.value)}
                      type="password"
                      className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                      placeholder={t("metaAccessTokenPlaceholder")}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs text-gray-400">{t("metaAdAccountId")}</label>
                      <input
                        value={metaAdAccountId}
                        onChange={(e) => setMetaAdAccountId(e.target.value)}
                        className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                        placeholder="act_123456789"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-gray-400">{t("metaPageId")}</label>
                      <input
                        value={metaPageId}
                        onChange={(e) => setMetaPageId(e.target.value)}
                        className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                        placeholder="123456789"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-500">{t("metaMockNote")}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowMetaForm(false)}
                      className="rounded-lg border border-gray-700 px-4 py-1.5 text-xs text-gray-400 hover:bg-gray-800"
                    >
                      {tc("cancel")}
                    </button>
                    <button
                      onClick={handleCreateMeta}
                      disabled={savingMeta || !metaName.trim()}
                      className="rounded-lg bg-blue-700 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-600 disabled:opacity-50"
                    >
                      {savingMeta ? tc("loading") : tc("save")}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Show existing Meta integrations */}
            {integrations.filter((i) => i.type === "META").map((integ) => (
              <div key={integ.id} className="mb-2 rounded-lg border border-blue-900 bg-gray-900 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{integ.name}</p>
                      <span className="rounded bg-blue-900 px-1.5 py-0.5 text-[10px] text-blue-300">Meta</span>
                    </div>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {integ.config?.ad_account_id ? `Ad Account: ${integ.config.ad_account_id}` : t("metaMockMode")}
                    </p>
                  </div>
                  <button
                    onClick={() => handleToggle(integ)}
                    className={`rounded px-2 py-1 text-[10px] font-medium ${
                      integ.is_enabled ? "bg-green-900 text-green-300" : "bg-red-900 text-red-300"
                    }`}
                  >
                    {integ.is_enabled ? t("enabled") : t("disabled")}
                  </button>
                </div>
              </div>
            ))}
          </section>

          <hr className="mb-6 border-gray-800" />

          {/* Webhook Create form */}
          {showForm && (
            <section className="mb-6 rounded-lg border border-cyan-800 bg-gray-900 p-4">
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs text-gray-400">{t("integrationName")}</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none"
                    placeholder="e.g. Zapier CRM"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-400">{t("webhookUrl")}</label>
                  <input
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none"
                    placeholder="https://hooks.zapier.com/..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs text-gray-400">{t("secretHeader")}</label>
                    <input
                      value={secretHeader}
                      onChange={(e) => setSecretHeader(e.target.value)}
                      className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none"
                      placeholder="X-Webhook-Secret"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-gray-400">{t("secretToken")}</label>
                    <input
                      value={secretToken}
                      onChange={(e) => setSecretToken(e.target.value)}
                      type="password"
                      className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none"
                      placeholder="your-secret-token"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowForm(false)}
                    className="rounded-lg border border-gray-700 px-4 py-1.5 text-xs text-gray-400 hover:bg-gray-800"
                  >
                    {tc("cancel")}
                  </button>
                  <button
                    onClick={handleCreate}
                    disabled={saving || !name.trim() || !webhookUrl.trim()}
                    className="rounded-lg bg-cyan-700 px-4 py-1.5 text-xs font-semibold text-white hover:bg-cyan-600 disabled:opacity-50"
                  >
                    {saving ? tc("loading") : tc("save")}
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* Integration list */}
          {integrations.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-800 px-4 py-12 text-center text-xs text-gray-600">
              {t("noIntegrations")}
            </div>
          ) : (
            <div className="space-y-3">
              {integrations.map((integ) => (
                <div
                  key={integ.id}
                  className="rounded-lg border border-gray-800 bg-gray-900 p-4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{integ.name}</p>
                      <p className="mt-0.5 text-xs text-gray-500">
                        {integ.config?.webhook_url}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleTest(integ.id)}
                        disabled={testingId === integ.id}
                        className="rounded border border-gray-700 px-2 py-1 text-[10px] text-gray-400 hover:bg-gray-800 disabled:opacity-50"
                      >
                        {testingId === integ.id ? t("testing") : t("testWebhook")}
                      </button>
                      <button
                        onClick={() => handleToggle(integ)}
                        className={`rounded px-2 py-1 text-[10px] font-medium ${
                          integ.is_enabled
                            ? "bg-green-900 text-green-300"
                            : "bg-red-900 text-red-300"
                        }`}
                      >
                        {integ.is_enabled ? t("enabled") : t("disabled")}
                      </button>
                    </div>
                  </div>
                  {testResult[integ.id] && (
                    <div className={`mt-2 text-xs ${testResult[integ.id].success ? "text-green-400" : "text-red-400"}`}>
                      {testResult[integ.id].success
                        ? t("testSuccess")
                        : `${t("testFailed")}: ${testResult[integ.id].error || `HTTP ${testResult[integ.id].status_code}`}`}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Event log */}
          <section className="mt-8">
            <h2 className="mb-3 text-sm font-semibold text-gray-400">{t("eventLog")}</h2>
            {events.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-800 px-4 py-6 text-center text-xs text-gray-600">
                {t("noEvents")}
              </div>
            ) : (
              <div className="space-y-2">
                {events.map((evt) => (
                  <div
                    key={evt.id}
                    className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900 px-4 py-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium">{evt.event_type}</span>
                        <span className={`text-[10px] ${EVENT_STATUS_COLORS[evt.status] || "text-gray-500"}`}>
                          {evt.status === "SENT" ? t("eventSent") : evt.status === "FAILED" ? t("eventFailed") : t("eventPending")}
                        </span>
                      </div>
                      {evt.error_message && (
                        <p className="mt-0.5 text-[10px] text-red-400">{evt.error_message}</p>
                      )}
                      <p className="mt-0.5 text-[10px] text-gray-600">
                        {new Date(evt.created_at).toLocaleString()}
                      </p>
                    </div>
                    {evt.status === "FAILED" && (
                      <button
                        onClick={() => handleRetry(evt.id)}
                        className="rounded border border-gray-700 px-2 py-1 text-[10px] text-gray-400 hover:bg-gray-800"
                      >
                        {t("retryEvent")}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
