"use client";

interface Tab {
  key: string;
  label: string;
}

interface TabsProps {
  tabs: Tab[];
  active: string;
  onChange: (key: string) => void;
  className?: string;
}

function Tabs({ tabs, active, onChange, className = "" }: TabsProps) {
  return (
    <div
      className={[
        "flex gap-0 border-b border-gray-800/50",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      role="tablist"
    >
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        return (
          <button
            key={tab.key}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.key)}
            className={[
              "px-4 py-2.5 text-sm font-medium transition-colors relative",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-500/50",
              isActive
                ? "text-white"
                : "text-gray-400 hover:text-gray-200",
            ].join(" ")}
          >
            {tab.label}
            {isActive && (
              <span className="absolute inset-x-0 bottom-0 h-0.5 bg-white" />
            )}
          </button>
        );
      })}
    </div>
  );
}

export { Tabs };
export type { TabsProps, Tab };
