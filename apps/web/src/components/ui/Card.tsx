"use client";

import type { HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
}

function Card({
  hover = false,
  className = "",
  children,
  onClick,
  ...rest
}: CardProps) {
  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick(e as unknown as React.MouseEvent<HTMLDivElement>);
              }
            }
          : undefined
      }
      className={[
        "bg-gray-900/50 border border-gray-800/50 rounded-xl p-5",
        hover ? "transition-colors hover:bg-gray-900 hover:border-gray-700/50 cursor-pointer" : "",
        onClick ? "cursor-pointer" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {children}
    </div>
  );
}

export { Card };
export type { CardProps };
