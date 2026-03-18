"use client";

interface SkeletonProps {
  className?: string;
}

function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={[
        "animate-pulse bg-gray-800/50 rounded-lg",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    />
  );
}

interface SkeletonCardProps {
  className?: string;
}

function SkeletonCard({ className = "" }: SkeletonCardProps) {
  return (
    <div
      aria-hidden="true"
      className={[
        "bg-gray-900/50 border border-gray-800/50 rounded-xl p-5 space-y-3",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-2/3" />
    </div>
  );
}

interface SkeletonListProps {
  lines?: number;
  className?: string;
}

function SkeletonList({ lines = 3, className = "" }: SkeletonListProps) {
  return (
    <div
      aria-hidden="true"
      className={["flex flex-col gap-2.5", className].filter(Boolean).join(" ")}
    >
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton
          key={i}
          className={[
            "h-3",
            i === lines - 1 ? "w-2/3" : "w-full",
          ].join(" ")}
        />
      ))}
    </div>
  );
}

export { Skeleton, SkeletonCard, SkeletonList };
export type { SkeletonProps, SkeletonCardProps, SkeletonListProps };
