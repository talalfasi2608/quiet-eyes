"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { clearTokens, getToken } from "@/lib/auth";
import type { Locale } from "@/i18n/config";

export default function Topbar() {
  const t = useTranslations("common");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const isLoggedIn = typeof window !== "undefined" && !!getToken();

  function switchLocale() {
    const next = locale === "en" ? "he" : "en";
    router.replace(pathname, { locale: next as Locale });
  }

  function handleLogout() {
    clearTokens();
    router.push("/login");
  }

  return (
    <header className="flex h-14 items-center justify-between border-b border-gray-800 bg-gray-950 px-4">
      <span className="text-lg font-bold tracking-tight">{t("appName")}</span>
      <div className="flex items-center gap-3">
        <button
          onClick={switchLocale}
          className="rounded border border-gray-700 px-2 py-1 text-xs hover:bg-gray-800"
        >
          {locale === "en" ? "עברית" : "EN"}
        </button>
        {isLoggedIn && (
          <button
            onClick={handleLogout}
            className="rounded border border-gray-700 px-2 py-1 text-xs hover:bg-gray-800"
          >
            {t("logout")}
          </button>
        )}
      </div>
    </header>
  );
}
