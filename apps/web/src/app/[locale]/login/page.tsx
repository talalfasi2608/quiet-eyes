"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { apiFetch } from "@/lib/api";
import { setTokens } from "@/lib/auth";
import Topbar from "@/components/Topbar";

export default function LoginPage() {
  const t = useTranslations();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await apiFetch<{
        access_token: string;
        refresh_token: string;
      }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setTokens(res.access_token, res.refresh_token);

      const businesses = await apiFetch<{ id: string }[]>("/businesses/", {
        token: res.access_token,
      });
      if (businesses.length > 0) {
        router.push(`/dashboard/${businesses[0].id}`);
      } else {
        router.push("/onboarding");
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : t("auth.invalidCredentials"),
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Topbar />
      <main className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold">{t("auth.loginTitle")}</h1>
            <p className="mt-1 text-sm text-gray-400">
              {t("auth.loginSubtitle")}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm text-gray-400">
                {t("common.email")}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm focus:border-white focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-gray-400">
                {t("common.password")}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm focus:border-white focus:outline-none"
              />
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-white py-2.5 text-sm font-semibold text-gray-950 hover:bg-gray-200 disabled:opacity-50"
            >
              {loading ? t("common.loading") : t("common.login")}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500">
            {t("auth.noAccount")}{" "}
            <Link href="/register" className="text-white hover:underline">
              {t("common.register")}
            </Link>
          </p>
        </div>
      </main>
    </>
  );
}
