"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { apiFetch } from "@/lib/api";
import { getToken } from "@/lib/auth";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface CompetitorRow {
  name: string;
  website_url: string;
}

interface Step1Data {
  businessName: string;
  websiteUrl: string;
  category: string;
  description: string;
  location: string;
  serviceArea: string;
  languagePref: "EN" | "HE";
}

interface Step2Data {
  idealCustomer: string;
  painPoints: string;
  services: string;
  differentiation: string;
  targetLocations: string;
  avoidCustomers: string;
}

interface Step3Data {
  acquisitionChannels: string[];
  paidAds: string;
  crm: string;
  contactChannels: string[];
  leadTarget: string;
  adBudget: string;
}

interface Step4Data {
  competitors: CompetitorRow[];
  keywords: string;
  opportunityTypes: string[];
  tone: string;
  reportFrequency: string;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const CATEGORIES = [
  "restaurant",
  "retail",
  "saas",
  "real_estate",
  "health_wellness",
  "beauty_spa",
  "professional_services",
  "ecommerce",
  "education",
  "automotive",
  "travel_tourism",
  "construction",
  "legal",
  "financial_services",
  "marketing_agency",
  "other",
];

const SERVICE_AREAS = ["local", "national", "international", "online"];

const ACQUISITION_CHANNELS = [
  "word_of_mouth",
  "social_media",
  "google_ads",
  "seo",
  "referrals",
  "cold_outreach",
  "content_marketing",
  "events",
  "partnerships",
  "other",
];

const PAID_ADS_OPTIONS = ["no", "yes_small", "yes_medium", "yes_large"];

const CRM_OPTIONS = ["no", "hubspot", "salesforce", "pipedrive", "monday", "other"];

const CONTACT_CHANNELS = ["whatsapp", "email", "phone", "linkedin", "sms"];

const OPPORTUNITY_TYPES = [
  "new_leads",
  "market_trends",
  "competitor_moves",
  "customer_reviews",
  "campaign_ideas",
];

const TONE_OPTIONS = ["professional", "friendly", "short_direct", "aggressive", "premium"];

const REPORT_FREQ_OPTIONS = ["daily", "weekly", "monthly"];

const SETUP_MESSAGES: { key: string; pct: number }[] = [
  { key: "analyzingBusiness", pct: 20 },
  { key: "scanningWeb", pct: 40 },
  { key: "identifyingCompetitors", pct: 60 },
  { key: "buildingProfile", pct: 80 },
  { key: "preparingOpportunities", pct: 100 },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function emptyCompetitors(count: number): CompetitorRow[] {
  return Array.from({ length: count }, () => ({ name: "", website_url: "" }));
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function OnboardingPage() {
  const t = useTranslations();
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [animDir, setAnimDir] = useState<"forward" | "back">("forward");

  // Step 1
  const [s1, setS1] = useState<Step1Data>({
    businessName: "",
    websiteUrl: "",
    category: "",
    description: "",
    location: "",
    serviceArea: "",
    languagePref: "EN",
  });

  // Step 2
  const [s2, setS2] = useState<Step2Data>({
    idealCustomer: "",
    painPoints: "",
    services: "",
    differentiation: "",
    targetLocations: "",
    avoidCustomers: "",
  });

  // Step 3
  const [s3, setS3] = useState<Step3Data>({
    acquisitionChannels: [],
    paidAds: "",
    crm: "",
    contactChannels: [],
    leadTarget: "",
    adBudget: "",
  });

  // Step 4
  const [s4, setS4] = useState<Step4Data>({
    competitors: emptyCompetitors(3),
    keywords: "",
    opportunityTypes: [],
    tone: "",
    reportFrequency: "",
  });

  // Step 5 (AI setup)
  const [setupProgress, setSetupProgress] = useState(0);
  const [setupMsgIndex, setSetupMsgIndex] = useState(0);
  const [setupDone, setSetupDone] = useState(false);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [error, setError] = useState("");

  // Auth guard
  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.push("/login");
    }
  }, [router]);

  /* ---------------------------------------------------------------- */
  /*  Navigation                                                       */
  /* ---------------------------------------------------------------- */

  function goNext() {
    setAnimDir("forward");
    setStep((s) => s + 1);
  }

  function goBack() {
    setAnimDir("back");
    setStep((s) => s - 1);
  }

  const canContinue = step === 1 ? s1.businessName.trim().length > 0 : true;

  /* ---------------------------------------------------------------- */
  /*  Step 5 — submit & animate                                        */
  /* ---------------------------------------------------------------- */

  const runSetup = useCallback(async () => {
    const token = getToken();
    if (!token) {
      router.push("/login");
      return;
    }

    // Animate progress
    const interval = setInterval(() => {
      setSetupProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 1;
      });
    }, 80); // ~8s total

    // Update message index based on progress
    const msgInterval = setInterval(() => {
      setSetupProgress((prev) => {
        const idx = SETUP_MESSAGES.findIndex((m) => prev < m.pct);
        setSetupMsgIndex(idx === -1 ? SETUP_MESSAGES.length - 1 : Math.max(0, idx));
        return prev;
      });
    }, 200);

    try {
      const ownerName =
        typeof window !== "undefined"
          ? localStorage.getItem("qe_onboarding_name") || ""
          : "";
      const ownerRole =
        typeof window !== "undefined"
          ? localStorage.getItem("qe_onboarding_role") || ""
          : "";

      // 1. Create business
      const biz = await apiFetch<{ id: string }>("/businesses/", {
        method: "POST",
        token,
        body: JSON.stringify({
          name: s1.businessName,
          category: s1.category || null,
          location_text: s1.location || null,
          website_url: s1.websiteUrl || null,
          language_pref: s1.languagePref,
          client_metadata: {
            onboarding_version: 2,
            owner_name: ownerName,
            owner_role: ownerRole,
            description: s1.description || "",
            service_area: s1.serviceArea || "",
            ideal_customer: s2.idealCustomer || "",
            pain_points: s2.painPoints || "",
            services: s2.services || "",
            differentiation: s2.differentiation || "",
            target_locations: s2.targetLocations || "",
            avoid_customers: s2.avoidCustomers || "",
            acquisition_channels: s3.acquisitionChannels,
            paid_ads: s3.paidAds || "",
            crm: s3.crm || "",
            contact_channels: s3.contactChannels,
            lead_target: s3.leadTarget ? parseInt(s3.leadTarget, 10) : null,
            ad_budget: s3.adBudget ? parseInt(s3.adBudget, 10) : null,
            keywords: s4.keywords || "",
            opportunity_types: s4.opportunityTypes,
            tone: s4.tone || "",
            report_frequency: s4.reportFrequency || "",
            onboarded_at: new Date().toISOString(),
          },
        }),
      });

      setBusinessId(biz.id);

      // 2. Add competitors
      const validComps = s4.competitors.filter((c) => c.name.trim());
      if (validComps.length > 0) {
        await apiFetch(`/businesses/${biz.id}/competitors`, {
          method: "POST",
          token,
          body: JSON.stringify({ competitors: validComps }),
        });
      }

      // 3. Trigger scan (don't fail if it errors)
      try {
        await apiFetch(`/businesses/${biz.id}/scan`, {
          method: "POST",
          token,
        });
      } catch {
        // Silently ignore scan errors
      }

      // Clean up localStorage
      localStorage.removeItem("qe_onboarding_name");
      localStorage.removeItem("qe_onboarding_role");
    } catch (err: unknown) {
      clearInterval(interval);
      clearInterval(msgInterval);
      setError(err instanceof Error ? err.message : "Setup failed");
      return;
    }

    // Wait for animation to finish
    const waitForAnim = setInterval(() => {
      setSetupProgress((prev) => {
        if (prev >= 100) {
          clearInterval(waitForAnim);
          clearInterval(interval);
          clearInterval(msgInterval);
          setSetupDone(true);
        }
        return prev;
      });
    }, 200);
  }, [s1, s2, s3, s4, router]);

  // Trigger setup when entering step 5
  useEffect(() => {
    if (step === 5) {
      runSetup();
    }
  }, [step, runSetup]);

  /* ---------------------------------------------------------------- */
  /*  Reusable UI pieces                                               */
  /* ---------------------------------------------------------------- */

  const inputClass =
    "w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-sm text-gray-100 placeholder-gray-500 focus:border-white focus:outline-none focus:ring-1 focus:ring-white/20";
  const labelClass = "block mb-2 text-sm font-medium text-gray-300";
  const hintClass = "mt-1 text-xs text-gray-500";
  const sectionTitleClass = "text-lg font-semibold text-gray-100 mb-1";
  const sectionSubClass = "text-sm text-gray-400 mb-6";

  function ChipMulti({
    options,
    selected,
    onToggle,
    tPrefix,
  }: {
    options: string[];
    selected: string[];
    onToggle: (val: string) => void;
    tPrefix: string;
  }) {
    return (
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const active = selected.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onToggle(opt)}
              className={`rounded-full px-4 py-2 text-sm transition-colors ${
                active
                  ? "bg-white text-gray-950"
                  : "border border-gray-600 text-gray-400 hover:border-gray-400"
              }`}
            >
              {t(`${tPrefix}.${opt}`)}
            </button>
          );
        })}
      </div>
    );
  }

  function ChipSingle({
    options,
    selected,
    onSelect,
    tPrefix,
  }: {
    options: string[];
    selected: string;
    onSelect: (val: string) => void;
    tPrefix: string;
  }) {
    return (
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const active = selected === opt;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onSelect(opt)}
              className={`rounded-full px-4 py-2 text-sm transition-colors ${
                active
                  ? "bg-white text-gray-950"
                  : "border border-gray-600 text-gray-400 hover:border-gray-400"
              }`}
            >
              {t(`${tPrefix}.${opt}`)}
            </button>
          );
        })}
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Progress bar                                                     */
  /* ---------------------------------------------------------------- */

  const STEP_LABELS = [
    t("onboarding.step1Label"),
    t("onboarding.step2Label"),
    t("onboarding.step3Label"),
    t("onboarding.step4Label"),
    t("onboarding.step5Label"),
  ];

  function ProgressBar() {
    return (
      <div className="mb-10">
        {/* Thin bar */}
        <div className="mb-4 h-1 w-full overflow-hidden rounded-full bg-gray-800">
          <div
            className="h-full rounded-full bg-white transition-all duration-500"
            style={{ width: `${(step / 5) * 100}%` }}
          />
        </div>
        {/* Dots + labels */}
        <div className="flex items-center justify-between">
          {STEP_LABELS.map((label, i) => {
            const stepNum = i + 1;
            const done = step > stepNum;
            const current = step === stepNum;
            return (
              <div key={i} className="flex flex-col items-center gap-1">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                    done
                      ? "bg-white text-gray-950"
                      : current
                        ? "border-2 border-white text-white"
                        : "border border-gray-600 text-gray-500"
                  }`}
                >
                  {done ? (
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2.5}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M4.5 12.75l6 6 9-13.5"
                      />
                    </svg>
                  ) : (
                    stepNum
                  )}
                </div>
                <span
                  className={`hidden text-xs sm:block ${
                    current ? "text-white" : "text-gray-500"
                  }`}
                >
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Step renderers                                                   */
  /* ---------------------------------------------------------------- */

  function renderStep1() {
    return (
      <div className="space-y-6">
        <div>
          <h2 className={sectionTitleClass}>{t("onboarding.step1Title")}</h2>
          <p className={sectionSubClass}>{t("onboarding.step1Subtitle")}</p>
        </div>

        <div>
          <label className={labelClass}>{t("onboarding.businessName")} *</label>
          <input
            type="text"
            value={s1.businessName}
            onChange={(e) => setS1({ ...s1, businessName: e.target.value })}
            className={inputClass}
            placeholder={t("onboarding.businessNamePlaceholder")}
          />
        </div>

        <div>
          <label className={labelClass}>{t("onboarding.website")}</label>
          <input
            type="url"
            value={s1.websiteUrl}
            onChange={(e) => setS1({ ...s1, websiteUrl: e.target.value })}
            placeholder="https://"
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>{t("onboarding.category")}</label>
          <select
            value={s1.category}
            onChange={(e) => setS1({ ...s1, category: e.target.value })}
            className={inputClass}
          >
            <option value="">{t("onboarding.selectCategory")}</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t(`onboarding.categories.${c}`)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>{t("onboarding.descriptionLabel")}</label>
          <textarea
            rows={2}
            value={s1.description}
            onChange={(e) => setS1({ ...s1, description: e.target.value })}
            className={inputClass}
            placeholder={t("onboarding.descriptionPlaceholder")}
          />
        </div>

        <div>
          <label className={labelClass}>{t("onboarding.location")}</label>
          <input
            type="text"
            value={s1.location}
            onChange={(e) => setS1({ ...s1, location: e.target.value })}
            className={inputClass}
            placeholder={t("onboarding.locationPlaceholder")}
          />
        </div>

        <div>
          <label className={labelClass}>{t("onboarding.serviceArea")}</label>
          <select
            value={s1.serviceArea}
            onChange={(e) => setS1({ ...s1, serviceArea: e.target.value })}
            className={inputClass}
          >
            <option value="">{t("onboarding.selectServiceArea")}</option>
            {SERVICE_AREAS.map((a) => (
              <option key={a} value={a}>
                {t(`onboarding.serviceAreas.${a}`)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>{t("onboarding.language")}</label>
          <select
            value={s1.languagePref}
            onChange={(e) =>
              setS1({ ...s1, languagePref: e.target.value as "EN" | "HE" })
            }
            className={inputClass}
          >
            <option value="EN">English</option>
            <option value="HE">עברית</option>
          </select>
        </div>
      </div>
    );
  }

  function renderStep2() {
    return (
      <div className="space-y-6">
        <div>
          <h2 className={sectionTitleClass}>{t("onboarding.step2Title")}</h2>
          <p className={sectionSubClass}>{t("onboarding.step2Subtitle")}</p>
        </div>

        <div>
          <label className={labelClass}>{t("onboarding.idealCustomer")}</label>
          <textarea
            rows={2}
            value={s2.idealCustomer}
            onChange={(e) => setS2({ ...s2, idealCustomer: e.target.value })}
            className={inputClass}
            placeholder={t("onboarding.idealCustomerPlaceholder")}
          />
        </div>

        <div>
          <label className={labelClass}>{t("onboarding.painPoints")}</label>
          <textarea
            rows={2}
            value={s2.painPoints}
            onChange={(e) => setS2({ ...s2, painPoints: e.target.value })}
            className={inputClass}
            placeholder={t("onboarding.painPointsPlaceholder")}
          />
        </div>

        <div>
          <label className={labelClass}>{t("onboarding.mainServices")}</label>
          <input
            type="text"
            value={s2.services}
            onChange={(e) => setS2({ ...s2, services: e.target.value })}
            className={inputClass}
            placeholder={t("onboarding.mainServicesPlaceholder")}
          />
        </div>

        <div>
          <label className={labelClass}>{t("onboarding.differentiation")}</label>
          <textarea
            rows={2}
            value={s2.differentiation}
            onChange={(e) => setS2({ ...s2, differentiation: e.target.value })}
            className={inputClass}
            placeholder={t("onboarding.differentiationPlaceholder")}
          />
        </div>

        <div>
          <label className={labelClass}>{t("onboarding.targetLocations")}</label>
          <input
            type="text"
            value={s2.targetLocations}
            onChange={(e) => setS2({ ...s2, targetLocations: e.target.value })}
            className={inputClass}
            placeholder={t("onboarding.targetLocationsPlaceholder")}
          />
        </div>

        <div>
          <label className={labelClass}>{t("onboarding.avoidCustomers")}</label>
          <input
            type="text"
            value={s2.avoidCustomers}
            onChange={(e) => setS2({ ...s2, avoidCustomers: e.target.value })}
            className={inputClass}
            placeholder={t("onboarding.avoidCustomersPlaceholder")}
          />
          <p className={hintClass}>{t("onboarding.avoidCustomersHint")}</p>
        </div>
      </div>
    );
  }

  function renderStep3() {
    function toggleChannel(ch: string) {
      setS3((prev) => ({
        ...prev,
        acquisitionChannels: prev.acquisitionChannels.includes(ch)
          ? prev.acquisitionChannels.filter((c) => c !== ch)
          : [...prev.acquisitionChannels, ch],
      }));
    }

    function toggleContactChannel(ch: string) {
      setS3((prev) => ({
        ...prev,
        contactChannels: prev.contactChannels.includes(ch)
          ? prev.contactChannels.filter((c) => c !== ch)
          : [...prev.contactChannels, ch],
      }));
    }

    return (
      <div className="space-y-6">
        <div>
          <h2 className={sectionTitleClass}>{t("onboarding.step3Title")}</h2>
          <p className={sectionSubClass}>{t("onboarding.step3Subtitle")}</p>
        </div>

        <div>
          <label className={labelClass}>{t("onboarding.acquisitionChannels")}</label>
          <ChipMulti
            options={ACQUISITION_CHANNELS}
            selected={s3.acquisitionChannels}
            onToggle={toggleChannel}
            tPrefix="onboarding.channels"
          />
        </div>

        <div>
          <label className={labelClass}>{t("onboarding.paidAds")}</label>
          <select
            value={s3.paidAds}
            onChange={(e) => setS3({ ...s3, paidAds: e.target.value })}
            className={inputClass}
          >
            <option value="">{t("onboarding.selectOption")}</option>
            {PAID_ADS_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {t(`onboarding.paidAdsOptions.${o}`)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>{t("onboarding.crmLabel")}</label>
          <select
            value={s3.crm}
            onChange={(e) => setS3({ ...s3, crm: e.target.value })}
            className={inputClass}
          >
            <option value="">{t("onboarding.selectOption")}</option>
            {CRM_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {t(`onboarding.crmOptions.${o}`)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>{t("onboarding.contactChannels")}</label>
          <ChipMulti
            options={CONTACT_CHANNELS}
            selected={s3.contactChannels}
            onToggle={toggleContactChannel}
            tPrefix="onboarding.contactOptions"
          />
        </div>

        <div>
          <label className={labelClass}>{t("onboarding.leadTarget")}</label>
          <input
            type="number"
            value={s3.leadTarget}
            onChange={(e) => setS3({ ...s3, leadTarget: e.target.value })}
            className={inputClass}
            placeholder={t("onboarding.leadTargetPlaceholder")}
          />
        </div>

        <div>
          <label className={labelClass}>{t("onboarding.adBudget")}</label>
          <input
            type="number"
            value={s3.adBudget}
            onChange={(e) => setS3({ ...s3, adBudget: e.target.value })}
            className={inputClass}
            placeholder="$"
          />
          <p className={hintClass}>{t("onboarding.adBudgetHint")}</p>
        </div>
      </div>
    );
  }

  function renderStep4() {
    function updateCompetitor(idx: number, field: keyof CompetitorRow, value: string) {
      setS4((prev) => ({
        ...prev,
        competitors: prev.competitors.map((c, i) =>
          i === idx ? { ...c, [field]: value } : c,
        ),
      }));
    }

    function addCompetitorRow() {
      if (s4.competitors.length < 10) {
        setS4((prev) => ({
          ...prev,
          competitors: [...prev.competitors, { name: "", website_url: "" }],
        }));
      }
    }

    function toggleOpportunity(val: string) {
      setS4((prev) => ({
        ...prev,
        opportunityTypes: prev.opportunityTypes.includes(val)
          ? prev.opportunityTypes.filter((v) => v !== val)
          : [...prev.opportunityTypes, val],
      }));
    }

    return (
      <div className="space-y-6">
        <div>
          <h2 className={sectionTitleClass}>{t("onboarding.step4Title")}</h2>
          <p className={sectionSubClass}>{t("onboarding.step4Subtitle")}</p>
        </div>

        {/* Competitors */}
        <div className="space-y-3">
          <label className={labelClass}>{t("onboarding.competitors")}</label>
          <p className={hintClass + " !mt-0 mb-2"}>{t("onboarding.competitorHintV2")}</p>
          {s4.competitors.map((comp, idx) => (
            <div key={idx} className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={comp.name}
                onChange={(e) => updateCompetitor(idx, "name", e.target.value)}
                placeholder={`${t("onboarding.competitorName")} ${idx + 1}`}
                className={inputClass}
              />
              <input
                type="url"
                value={comp.website_url}
                onChange={(e) => updateCompetitor(idx, "website_url", e.target.value)}
                placeholder="https://"
                className={inputClass}
              />
            </div>
          ))}
          {s4.competitors.length < 10 && (
            <button
              type="button"
              onClick={addCompetitorRow}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              + {t("onboarding.addCompetitor")}
            </button>
          )}
        </div>

        <div>
          <label className={labelClass}>{t("onboarding.keywords")}</label>
          <input
            type="text"
            value={s4.keywords}
            onChange={(e) => setS4({ ...s4, keywords: e.target.value })}
            className={inputClass}
            placeholder={t("onboarding.keywordsPlaceholder")}
          />
        </div>

        <div>
          <label className={labelClass}>{t("onboarding.opportunityTypes")}</label>
          <ChipMulti
            options={OPPORTUNITY_TYPES}
            selected={s4.opportunityTypes}
            onToggle={toggleOpportunity}
            tPrefix="onboarding.opportunities"
          />
        </div>

        <div>
          <label className={labelClass}>{t("onboarding.communicationTone")}</label>
          <ChipSingle
            options={TONE_OPTIONS}
            selected={s4.tone}
            onSelect={(v) => setS4({ ...s4, tone: v })}
            tPrefix="onboarding.tones"
          />
        </div>

        <div>
          <label className={labelClass}>{t("onboarding.reportFrequency")}</label>
          <select
            value={s4.reportFrequency}
            onChange={(e) => setS4({ ...s4, reportFrequency: e.target.value })}
            className={inputClass}
          >
            <option value="">{t("onboarding.selectOption")}</option>
            {REPORT_FREQ_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {t(`onboarding.frequencies.${o}`)}
              </option>
            ))}
          </select>
        </div>
      </div>
    );
  }

  function renderStep5() {
    const activeMsg = SETUP_MESSAGES[setupMsgIndex];

    if (setupDone && businessId) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-white">
            <svg
              className="h-10 w-10 text-gray-950"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4.5 12.75l6 6 9-13.5"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-100 mb-2">
            {t("onboarding.setupComplete")}
          </h2>
          <p className="text-gray-400 mb-8">{t("onboarding.setupCompleteSubtitle")}</p>
          <button
            onClick={() => router.push(`/dashboard/${businessId}`)}
            className="rounded-lg bg-white px-8 py-3 text-sm font-semibold text-gray-950 hover:bg-gray-200 transition-colors"
          >
            {t("onboarding.goToDashboard")}
          </button>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={() => {
              setError("");
              setSetupProgress(0);
              setSetupMsgIndex(0);
              setStep(4);
            }}
            className="rounded-lg border border-gray-600 px-6 py-2 text-sm text-gray-300 hover:border-gray-400 transition-colors"
          >
            {t("common.back")}
          </button>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center py-20">
        {/* Pulsing icon */}
        <div className="mb-8 animate-pulse">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-white/30">
            <div className="h-8 w-8 rounded-full bg-white/80" />
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-6 h-2 w-full max-w-sm overflow-hidden rounded-full bg-gray-800">
          <div
            className="h-full rounded-full bg-white transition-all duration-300"
            style={{ width: `${setupProgress}%` }}
          />
        </div>

        {/* Messages */}
        <div className="h-8 text-center">
          {SETUP_MESSAGES.map((msg, idx) => (
            <p
              key={msg.key}
              className={`text-sm transition-opacity duration-500 ${
                idx === setupMsgIndex ? "opacity-100" : "hidden opacity-0"
              } ${idx === setupMsgIndex ? "text-gray-200" : "text-gray-500"}`}
            >
              {t(`onboarding.setup.${msg.key}`)}
            </p>
          ))}
        </div>

        <p className="mt-3 text-xs text-gray-600">
          {t("onboarding.stepOf", { current: String(activeMsg?.pct ?? 0), total: "100" })}
        </p>
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <main className="min-h-screen bg-gray-950 px-4 py-8">
      <div className="mx-auto w-full max-w-2xl">
        {step < 5 && <ProgressBar />}

        {/* Step content with simple transition */}
        <div
          key={step}
          className={`transition-all duration-300 ${
            animDir === "forward"
              ? "animate-[fadeSlideIn_0.3s_ease-out]"
              : "animate-[fadeSlideBack_0.3s_ease-out]"
          }`}
        >
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          {step === 4 && renderStep4()}
          {step === 5 && renderStep5()}
        </div>

        {/* Navigation buttons */}
        {step < 5 && (
          <div className="mt-8 flex items-center justify-between">
            {step > 1 ? (
              <button
                type="button"
                onClick={goBack}
                className="rounded-lg border border-gray-600 px-6 py-2.5 text-sm text-gray-300 hover:border-gray-400 transition-colors"
              >
                {t("common.back")}
              </button>
            ) : (
              <div />
            )}
            <button
              type="button"
              onClick={goNext}
              disabled={!canContinue}
              className="rounded-lg bg-white px-8 py-2.5 text-sm font-semibold text-gray-950 hover:bg-gray-200 disabled:opacity-40 transition-colors"
            >
              {step === 4 ? t("onboarding.finish") : t("common.next")}
            </button>
          </div>
        )}

        {error && step < 5 && (
          <p className="mt-4 text-center text-sm text-red-400">{error}</p>
        )}
      </div>

      {/* Keyframe animations */}
      <style jsx global>{`
        @keyframes fadeSlideIn {
          from {
            opacity: 0;
            transform: translateX(24px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        @keyframes fadeSlideBack {
          from {
            opacity: 0;
            transform: translateX(-24px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </main>
  );
}
