"use client";

import { type SelectHTMLAttributes, forwardRef, useId } from "react";

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  options: SelectOption[];
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, hint, options, className = "", id: externalId, ...rest }, ref) => {
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
        <select
          ref={ref}
          id={id}
          className={[
            "bg-gray-900 border border-gray-700/50 rounded-lg px-3 py-2.5 text-sm text-gray-100",
            "focus:border-gray-500 focus:ring-1 focus:ring-gray-500/30 focus:outline-none",
            "transition-colors appearance-none",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            className,
          ]
            .filter(Boolean)
            .join(" ")}
          {...rest}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {hint && (
          <p className="text-xs text-gray-500">{hint}</p>
        )}
      </div>
    );
  },
);

Select.displayName = "Select";

export { Select };
export type { SelectProps, SelectOption };
