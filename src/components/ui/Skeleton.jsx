import { motion } from "framer-motion";

export function Skeleton({ className = "", rounded = "rounded-lg" }) {
  return (
    <motion.div
      aria-hidden="true"
      className={`${rounded} bg-slate-200/70 dark:bg-slate-800 ${className}`}
      initial={{ opacity: 0.45 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.9, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }}
    />
  );
}

export function SkeletonText({ lines = 3, className = "" }) {
  const widths = ["w-full", "w-11/12", "w-9/12", "w-10/12", "w-8/12"];
  return (
    <div className={`space-y-2 ${className}`} aria-hidden="true">
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          className={`h-3 ${widths[index % widths.length]}`}
          rounded="rounded-full"
        />
      ))}
    </div>
  );
}

export function SkeletonStatCards({ count = 4 }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="rounded-xl border border-slate-200 p-5 dark:border-slate-800"
        >
          <Skeleton className="h-3 w-20" rounded="rounded-full" />
          <Skeleton className="mt-3 h-8 w-16" />
          <Skeleton className="mt-3 h-3 w-24" rounded="rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonPanel({ className = "", children }) {
  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 ${className}`}
      aria-hidden="true"
    >
      {children ?? (
        <div className="space-y-3">
          <Skeleton className="h-4 w-1/3" />
          <SkeletonText lines={3} />
        </div>
      )}
    </div>
  );
}
