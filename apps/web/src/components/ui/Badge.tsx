"use client";

import type { HTMLAttributes } from "react";

const badgeVariants = {
  default: "bg-gray-500/10 text-gray-400 border border-gray-500/20",
  success: "bg-green-500/10 text-green-400 border border-green-500/20",
  warning: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
  error: "bg-red-500/10 text-red-400 border border-red-500/20",
  info: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
} as const;

type BadgeVariant = keyof typeof badgeVariants;

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

function Badge({
  variant = "default",
  className = "",
  children,
  ...rest
}: BadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
        badgeVariants[variant],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {children}
    </span>
  );
}

export { Badge };
export type { BadgeProps, BadgeVariant };
