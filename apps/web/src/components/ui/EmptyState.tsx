"use client";

import type { ReactNode } from "react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

function EmptyState({
  icon,
  title,
  description,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={[
        "flex flex-col items-center justify-center text-center py-12 px-4",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {icon && (
        <div className="text-gray-500 mb-4">{icon}</div>
      )}
      <h3 className="text-gray-300 text-base font-medium">{title}</h3>
      {description && (
        <p className="text-gray-500 text-sm mt-1.5 max-w-sm">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export { EmptyState };
export type { EmptyStateProps };
