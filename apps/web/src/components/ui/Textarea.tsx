"use client";

import { type TextareaHTMLAttributes, forwardRef, useId } from "react";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, hint, rows = 4, className = "", id: externalId, ...rest }, ref) => {
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
        <textarea
          ref={ref}
          id={id}
          rows={rows}
          className={[
            "bg-gray-900 border border-gray-700/50 rounded-lg px-3 py-2.5 text-sm text-gray-100",
            "placeholder:text-gray-500",
            "focus:border-gray-500 focus:ring-1 focus:ring-gray-500/30 focus:outline-none",
            "transition-colors resize-y",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            className,
          ]
            .filter(Boolean)
            .join(" ")}
          {...rest}
        />
        {hint && (
          <p className="text-xs text-gray-500">{hint}</p>
        )}
      </div>
    );
  },
);

Textarea.displayName = "Textarea";

export { Textarea };
export type { TextareaProps };
