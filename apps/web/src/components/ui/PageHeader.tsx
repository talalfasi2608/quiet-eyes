"use client";

import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

function PageHeader({
  title,
  description,
  actions,
  className = "",
}: PageHeaderProps) {
  return (
    <div
      className={[
        "flex items-start justify-between gap-4",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div>
        <h1 className="text-2xl font-semibold text-gray-100">{title}</h1>
        {description && (
          <p className="text-gray-400 text-sm mt-1">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0">{actions}</div>
      )}
    </div>
  );
}

export { PageHeader };
export type { PageHeaderProps };
