"use client";

import type { ReactNode } from "react";

interface SectionHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

function SectionHeader({
  title,
  description,
  action,
  className = "",
}: SectionHeaderProps) {
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
        <h2 className="text-lg font-medium text-gray-100">{title}</h2>
        {description && (
          <p className="text-gray-400 text-sm mt-0.5">{description}</p>
        )}
      </div>
      {action && (
        <div className="shrink-0">{action}</div>
      )}
    </div>
  );
}

export { SectionHeader };
export type { SectionHeaderProps };
