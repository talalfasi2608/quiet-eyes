"use client";

import { useEffect, useState } from "react";
import Sidebar, { getSidebarWidth } from "@/components/Sidebar";
import AppTopbar from "@/components/AppTopbar";

interface DashboardShellProps {
  businessId: string;
  children: React.ReactNode;
}

export function DashboardShell({ businessId, children }: DashboardShellProps) {
  const [sidebarWidth, setSidebarWidth] = useState(240);

  useEffect(() => {
    // Set initial width
    setSidebarWidth(getSidebarWidth());

    // Listen for sidebar toggle events
    function handleToggle() {
      setSidebarWidth(getSidebarWidth());
    }

    window.addEventListener("sidebar-toggle", handleToggle);
    // Also listen for storage events (from other tabs)
    window.addEventListener("storage", (e) => {
      if (e.key === "qe_sidebar_collapsed") {
        setSidebarWidth(getSidebarWidth());
      }
    });

    return () => {
      window.removeEventListener("sidebar-toggle", handleToggle);
    };
  }, []);

  return (
    <div className="flex min-h-screen">
      <Sidebar businessId={businessId} />
      <div
        className="flex flex-1 flex-col transition-all duration-200"
        style={{ marginInlineStart: sidebarWidth }}
      >
        <AppTopbar />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
