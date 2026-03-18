"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { useRouter } from "@/i18n/navigation";
import { PageHeader, Card, Button, Input, SectionHeader, Badge, Textarea, EmptyState } from "@/components/ui";

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

  if (!token) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("integrations")}
        description={t("integrationsSubtitle")}
        actions={
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            {t("addIntegration")}
          </Button>
        }
      />

      {/* Client Notes */}
      <Card>
        <SectionHeader title={t("clientNotes")} />
        <Textarea
          value={clientNotes}
          onChange={(e) => setClientNotes(e.target.value)}
          placeholder={t("clientNotesPlaceholder")}
          rows={3}
          className="mt-3"
        />
        <Button size="sm" className="mt-2" variant="secondary" onClick={handleSaveNotes} loading={savingNotes}>
          {savingNotes ? tc("loading") : tc("save")}
        </Button>
      </Card>

      {/* Meta Integration Section */}
      <SectionHeader
        title={t("metaIntegration")}
        description={t("metaIntegrationDesc")}
        action={
          <Button size="sm" variant="secondary" onClick={() => setShowMetaForm(!showMetaForm)}>
            {t("addMetaIntegration")}
          </Button>
        }
      />

      {showMetaForm && (
        <Card>
          <div className="space-y-3">
            <Input
              label={t("integrationName")}
              value={metaName}
              onChange={(e) => setMetaName(e.target.value)}
            />
            <Input
              label={t("metaAccessToken")}
              value={metaAccessToken}
              onChange={(e) => setMetaAccessToken(e.target.value)}
              type="password"
              placeholder={t("metaAccessTokenPlaceholder")}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label={t("metaAdAccountId")}
                value={metaAdAccountId}
                onChange={(e) => setMetaAdAccountId(e.target.value)}
                placeholder="act_123456789"
              />
              <Input
                label={t("metaPageId")}
                value={metaPageId}
                onChange={(e) => setMetaPageId(e.target.value)}
                placeholder="123456789"
              />
            </div>
            <p className="text-[10px] text-gray-500">{t("metaMockNote")}</p>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => setShowMetaForm(false)}>
                {tc("cancel")}
              </Button>
              <Button size="sm" onClick={handleCreateMeta} loading={savingMeta} disabled={!metaName.trim()}>
                {savingMeta ? tc("loading") : tc("save")}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Show existing Meta integrations */}
      {integrations.filter((i) => i.type === "META").map((integ) => (
        <Card key={integ.id}>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-gray-100">{integ.name}</p>
                <Badge variant="info">Meta</Badge>
              </div>
              <p className="mt-0.5 text-xs text-gray-500">
                {integ.config?.ad_account_id ? `Ad Account: ${integ.config.ad_account_id}` : t("metaMockMode")}
              </p>
            </div>
            <Badge
              variant={integ.is_enabled ? "success" : "error"}
              className="cursor-pointer"
              onClick={() => handleToggle(integ)}
            >
              {integ.is_enabled ? t("enabled") : t("disabled")}
            </Badge>
          </div>
        </Card>
      ))}

      {/* Webhook Create form */}
      {showForm && (
        <Card>
          <div className="space-y-3">
            <Input
              label={t("integrationName")}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Zapier CRM"
            />
            <Input
              label={t("webhookUrl")}
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://hooks.zapier.com/..."
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label={t("secretHeader")}
                value={secretHeader}
                onChange={(e) => setSecretHeader(e.target.value)}
                placeholder="X-Webhook-Secret"
              />
              <Input
                label={t("secretToken")}
                value={secretToken}
                onChange={(e) => setSecretToken(e.target.value)}
                type="password"
                placeholder="your-secret-token"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => setShowForm(false)}>
                {tc("cancel")}
              </Button>
              <Button size="sm" onClick={handleCreate} loading={saving} disabled={!name.trim() || !webhookUrl.trim()}>
                {saving ? tc("loading") : tc("save")}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Integration list */}
      {integrations.length === 0 ? (
        <EmptyState title={t("noIntegrations")} />
      ) : (
        <div className="space-y-3">
          {integrations.map((integ) => (
            <Card key={integ.id}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-100">{integ.name}</p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {integ.config?.webhook_url}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleTest(integ.id)}
                    loading={testingId === integ.id}
                  >
                    {testingId === integ.id ? t("testing") : t("testWebhook")}
                  </Button>
                  <Badge
                    variant={integ.is_enabled ? "success" : "error"}
                    className="cursor-pointer"
                    onClick={() => handleToggle(integ)}
                  >
                    {integ.is_enabled ? t("enabled") : t("disabled")}
                  </Badge>
                </div>
              </div>
              {testResult[integ.id] && (
                <div className={`mt-2 text-xs ${testResult[integ.id].success ? "text-green-400" : "text-red-400"}`}>
                  {testResult[integ.id].success
                    ? t("testSuccess")
                    : `${t("testFailed")}: ${testResult[integ.id].error || `HTTP ${testResult[integ.id].status_code}`}`}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Event log */}
      <SectionHeader title={t("eventLog")} />
      {events.length === 0 ? (
        <EmptyState title={t("noEvents")} />
      ) : (
        <div className="space-y-2">
          {events.map((evt) => (
            <Card key={evt.id} className="!p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-100">{evt.event_type}</span>
                    <Badge variant={evt.status === "SENT" ? "success" : evt.status === "FAILED" ? "error" : "warning"}>
                      {evt.status === "SENT" ? t("eventSent") : evt.status === "FAILED" ? t("eventFailed") : t("eventPending")}
                    </Badge>
                  </div>
                  {evt.error_message && (
                    <p className="mt-0.5 text-[10px] text-red-400">{evt.error_message}</p>
                  )}
                  <p className="mt-0.5 text-[10px] text-gray-500">
                    {new Date(evt.created_at).toLocaleString()}
                  </p>
                </div>
                {evt.status === "FAILED" && (
                  <Button variant="ghost" size="sm" onClick={() => handleRetry(evt.id)}>
                    {t("retryEvent")}
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
