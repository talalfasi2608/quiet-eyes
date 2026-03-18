"use client";

import { type InputHTMLAttributes, forwardRef, useId } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, hint, error, className = "", id: externalId, ...rest }, ref) => {
    const generatedId = useId();
    const id = externalId ?? generatedId;

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={id}
            className="text-sm font-medium text-gray-300"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={[
            "bg-gray-900 border border-gray-700/50 rounded-lg px-3 py-2.5 text-sm text-gray-100",
            "placeholder:text-gray-500",
            "focus:border-gray-500 focus:ring-1 focus:ring-gray-500/30 focus:outline-none",
            "transition-colors",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            error
              ? "border-red-500/50 focus:border-red-500 focus:ring-red-500/30"
              : "",
            className,
          ]
            .filter(Boolean)
            .join(" ")}
          {...rest}
        />
        {hint && !error && (
          <p className="text-xs text-gray-500">{hint}</p>
        )}
        {error && (
          <p className="text-xs text-red-400">{error}</p>
        )}
      </div>
    );
  },
);

Input.displayName = "Input";

export { Input };
export type { InputProps };
