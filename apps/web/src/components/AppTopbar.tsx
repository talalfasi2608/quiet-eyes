"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { useParams } from "next/navigation";
import { clearTokens, getToken, parseJwt } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import type { Locale } from "@/i18n/config";

interface BusinessItem {
  id: string;
  name: string;
  category: string | null;
}

interface OrgInfo {
  id: string;
  name: string;
  display_name: string | null;
  logo_url: string | null;
  primary_color: string | null;
}

export default function AppTopbar() {
  const t = useTranslations("topbar");
  const tc = useTranslations("common");
  const td = useTranslations("dashboard");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams<{ businessId?: string }>();
  const token = getToken();

  const [businesses, setBusinesses] = useState<BusinessItem[]>([]);
  const [org, setOrg] = useState<OrgInfo | null>(null);
  const [showSwitcher, setShowSwitcher] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const switcherRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const loadBusinesses = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiFetch<BusinessItem[]>("/businesses/", { token });
      setBusinesses(data);
    } catch {
      /* empty */
    }
  }, [token]);

  const loadOrg = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiFetch<OrgInfo>("/org", { token });
      setOrg(data);
    } catch {
      /* empty */
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      loadBusinesses();
      loadOrg();
    }
  }, [token, loadBusinesses, loadOrg]);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (switcherRef.current && !switcherRef.current.contains(e.target as Node)) {
        setShowSwitcher(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function switchLocale() {
    const next = locale === "en" ? "he" : "en";
    router.replace(pathname, { locale: next as Locale });
  }

  function handleLogout() {
    clearTokens();
    router.push("/login");
  }

  function handleSwitchBusiness(bizId: string) {
    setShowSwitcher(false);
    router.push(`/dashboard/${bizId}`);
  }

  // Extract user email initial from JWT
  const userEmail = (() => {
    if (!token) return "";
    const payload = parseJwt(token);
    if (!payload) return "";
    return (payload.email as string) || (payload.sub as string) || "";
  })();
  const userInitial = userEmail ? userEmail[0].toUpperCase() : "?";

  const currentBiz = businesses.find((b) => b.id === params.businessId);

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-gray-800/50 bg-gray-950/80 px-4 backdrop-blur-sm">
      {/* Left section */}
      <div className="flex items-center gap-3">
        {/* AI search trigger */}
        <button
          className="flex items-center gap-2 rounded-lg border border-gray-800 bg-gray-900/50 px-3 py-1.5 text-xs text-gray-500 transition-colors hover:border-gray-700 hover:text-gray-400"
          onClick={() => {
            // Focus the main command center on the dashboard page
            const commandInput = document.querySelector<HTMLInputElement>(
              "[data-command-center]"
            );
            if (commandInput) {
              commandInput.focus();
            }
          }}
        >
          <svg
            className="h-3.5 w-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
            />
          </svg>
          <span className="hidden sm:inline">{t("askAi")}</span>
        </button>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-2">
        {/* Language toggle */}
        <button
          onClick={switchLocale}
          className="rounded px-2 py-1 text-xs text-gray-400 transition-colors hover:bg-gray-800 hover:text-gray-200"
        >
          {locale === "en" ? "\u05E2\u05D1\u05E8\u05D9\u05EA" : "EN"}
        </button>

        {/* Workspace switcher */}
        {businesses.length > 1 && (
          <div className="relative" ref={switcherRef}>
            <button
              onClick={() => setShowSwitcher(!showSwitcher)}
              className="flex items-center gap-1.5 rounded-lg border border-gray-800 bg-gray-900/50 px-2.5 py-1 text-xs text-gray-300 transition-colors hover:bg-gray-800"
            >
              <span className="max-w-[120px] truncate">
                {currentBiz ? currentBiz.name : td("selectClient")}
              </span>
              <svg
                className="h-3 w-3 text-gray-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {showSwitcher && (
              <div className="absolute end-0 top-full z-50 mt-1 w-56 rounded-lg border border-gray-700 bg-gray-900 py-1 shadow-lg">
                {businesses.length > 1 && (
                  <>
                    <button
                      onClick={() => {
                        setShowSwitcher(false);
                        router.push("/dashboard/agency");
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-start text-xs text-indigo-300 hover:bg-gray-800"
                    >
                      {td("agencyOverview")}
                    </button>
                    <div className="mx-2 my-1 border-t border-gray-800" />
                  </>
                )}
                {businesses.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => handleSwitchBusiness(b.id)}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-start text-xs hover:bg-gray-800 ${
                      b.id === params.businessId
                        ? "text-indigo-300"
                        : "text-gray-300"
                    }`}
                  >
                    <span className="truncate">{b.name}</span>
                    {b.category && (
                      <span className="shrink-0 rounded bg-gray-800 px-1.5 py-0.5 text-[10px] text-gray-500">
                        {b.category}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* User menu */}
        {token && (
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-xs font-medium text-white transition-colors hover:bg-indigo-500"
              title={userEmail}
            >
              {userInitial}
            </button>

            {showUserMenu && (
              <div className="absolute end-0 top-full z-50 mt-1 w-48 rounded-lg border border-gray-700 bg-gray-900 py-1 shadow-lg">
                {userEmail && (
                  <div className="border-b border-gray-800 px-3 py-2 text-xs text-gray-500">
                    {userEmail}
                  </div>
                )}
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 px-3 py-2 text-start text-xs text-gray-300 hover:bg-gray-800"
                >
                  <svg
                    className="h-3.5 w-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9"
                    />
                  </svg>
                  {tc("logout")}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
