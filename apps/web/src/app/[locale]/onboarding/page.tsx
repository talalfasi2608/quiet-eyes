"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { apiFetch } from "@/lib/api";
import { getToken } from "@/lib/auth";
import Topbar from "@/components/Topbar";

interface CompetitorRow {
  name: string;
  website_url: string;
}

export default function OnboardingPage() {
  const t = useTranslations();
  const router = useRouter();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("");
  const [website, setWebsite] = useState("");
  const [langPref, setLangPref] = useState<"EN" | "HE">("EN");
  const [competitors, setCompetitors] = useState<CompetitorRow[]>([
    { name: "", website_url: "" },
    { name: "", website_url: "" },
    { name: "", website_url: "" },
  ]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function updateCompetitor(
    idx: number,
    field: keyof CompetitorRow,
    value: string,
  ) {
    setCompetitors((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, [field]: value } : c)),
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const token = getToken();
    if (!token) {
      router.push("/login");
      return;
    }
    try {
      const biz = await apiFetch<{ id: string }>("/businesses/", {
        method: "POST",
        token,
        body: JSON.stringify({
          name,
          category: category || null,
          location_text: location || null,
          website_url: website || null,
          language_pref: langPref,
        }),
      });

      const validComps = competitors.filter((c) => c.name.trim());
      if (validComps.length > 0) {
        await apiFetch(`/businesses/${biz.id}/competitors`, {
          method: "POST",
          token,
          body: JSON.stringify({ competitors: validComps }),
        });
      }

      router.push(`/dashboard/${biz.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create business");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Topbar />
      <main className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4 py-8">
        <div className="w-full max-w-lg space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold">{t("onboarding.title")}</h1>
            <p className="mt-1 text-sm text-gray-400">
              {t("onboarding.subtitle")}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm text-gray-400">
                {t("onboarding.businessName")}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm focus:border-white focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm text-gray-400">
                  {t("onboarding.category")}
                </label>
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm focus:border-white focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-400">
                  {t("onboarding.location")}
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm focus:border-white focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm text-gray-400">
                {t("onboarding.website")}
              </label>
              <input
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://"
                className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm focus:border-white focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-gray-400">
                {t("onboarding.language")}
              </label>
              <select
                value={langPref}
                onChange={(e) => setLangPref(e.target.value as "EN" | "HE")}
                className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm focus:border-white focus:outline-none"
              >
                <option value="EN">English</option>
                <option value="HE">עברית</option>
              </select>
            </div>

            <div className="space-y-3">
              <label className="block text-sm text-gray-400">
                {t("onboarding.competitors")}
              </label>
              <p className="text-xs text-gray-500">
                {t("onboarding.competitorHint")}
              </p>
              {competitors.map((comp, idx) => (
                <div key={idx} className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={comp.name}
                    onChange={(e) =>
                      updateCompetitor(idx, "name", e.target.value)
                    }
                    placeholder={`${t("onboarding.competitorName")} ${idx + 1}`}
                    className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm focus:border-white focus:outline-none"
                  />
                  <input
                    type="url"
                    value={comp.website_url}
                    onChange={(e) =>
                      updateCompetitor(idx, "website_url", e.target.value)
                    }
                    placeholder="https://"
                    className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm focus:border-white focus:outline-none"
                  />
                </div>
              ))}
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-white py-2.5 text-sm font-semibold text-gray-950 hover:bg-gray-200 disabled:opacity-50"
            >
              {loading ? t("common.loading") : t("onboarding.finish")}
            </button>
          </form>
        </div>
      </main>
    </>
  );
}
