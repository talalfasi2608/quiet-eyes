"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { apiFetch } from "@/lib/api";
import { setTokens } from "@/lib/auth";
import Topbar from "@/components/Topbar";

export default function RegisterPage() {
  const t = useTranslations();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orgName, setOrgName] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("");
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
      }>("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
          org_name: orgName,
        }),
      });
      setTokens(res.access_token, res.refresh_token);

      // Store name and role for onboarding
      if (fullName) localStorage.setItem("qe_onboarding_name", fullName);
      if (role) localStorage.setItem("qe_onboarding_role", role);

      router.push("/onboarding");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-sm text-gray-100 placeholder-gray-500 focus:border-white focus:outline-none focus:ring-1 focus:ring-white/20";
  const labelClass = "mb-1 block text-sm text-gray-400";

  return (
    <>
      <Topbar />
      <main className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold">{t("auth.registerTitle")}</h1>
            <p className="mt-1 text-sm text-gray-400">
              {t("auth.registerSubtitle")}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className={labelClass}>
                {t("auth.orgName")}
              </label>
              <input
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                required
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>
                {t("auth.fullName")}
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>
                {t("auth.role")}
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                required
                className={inputClass}
              >
                <option value="">{t("auth.selectRole")}</option>
                <option value="business_owner">{t("auth.roleBizOwner")}</option>
                <option value="marketer">{t("auth.roleMarketer")}</option>
                <option value="agency">{t("auth.roleAgency")}</option>
                <option value="other">{t("auth.roleOther")}</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>
                {t("common.email")}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>
                {t("common.password")}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className={inputClass}
              />
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-white py-2.5 text-sm font-semibold text-gray-950 hover:bg-gray-200 disabled:opacity-50"
            >
              {loading ? t("common.loading") : t("common.register")}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500">
            {t("auth.hasAccount")}{" "}
            <Link href="/login" className="text-white hover:underline">
              {t("common.login")}
            </Link>
          </p>
        </div>
      </main>
    </>
  );
}
