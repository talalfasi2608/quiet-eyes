"use client";

import { useState, useCallback, type KeyboardEvent } from "react";

interface CommandInputProps {
  placeholder?: string;
  onSubmit: (value: string) => void;
  loading?: boolean;
  suggestions?: string[];
  className?: string;
}

function CommandInput({
  placeholder = "Type a command...",
  onSubmit,
  loading = false,
  suggestions,
  className = "",
}: CommandInputProps) {
  const [value, setValue] = useState("");

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || loading) return;
    onSubmit(trimmed);
    setValue("");
  }, [value, loading, onSubmit]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  const handleSuggestionClick = useCallback(
    (suggestion: string) => {
      if (loading) return;
      onSubmit(suggestion);
    },
    [loading, onSubmit],
  );

  return (
    <div className={["flex flex-col gap-3", className].filter(Boolean).join(" ")}>
      <div className="relative flex items-center bg-gray-900/50 border border-gray-700/50 rounded-xl p-4">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={loading}
          className={[
            "flex-1 bg-transparent text-base text-gray-100 placeholder:text-gray-500",
            "focus:outline-none",
            "disabled:opacity-50",
          ].join(" ")}
        />
        <button
          onClick={handleSubmit}
          disabled={!value.trim() || loading}
          className={[
            "shrink-0 ms-3 p-2 rounded-lg transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-500/50",
            "disabled:opacity-30 disabled:cursor-not-allowed",
            value.trim() && !loading
              ? "text-white bg-gray-800 hover:bg-gray-700"
              : "text-gray-500",
          ].join(" ")}
          aria-label="Submit"
        >
          {loading ? (
            <svg
              className="animate-spin h-5 w-5"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          )}
        </button>
      </div>

      {suggestions && suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => handleSuggestionClick(suggestion)}
              disabled={loading}
              className={[
                "px-3 py-1.5 text-xs font-medium rounded-lg",
                "bg-gray-800/50 text-gray-400 border border-gray-700/50",
                "hover:bg-gray-800 hover:text-gray-300 transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-500/50",
                "disabled:opacity-50 disabled:cursor-not-allowed",
              ].join(" ")}
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export { CommandInput };
export type { CommandInputProps };
