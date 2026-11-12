import { Skeleton } from "@/components/ui/skeleton";
import RectorLogoLoader from "@/components/loading/RectorLogoLoader";

interface Props {
  /** show the animated RectorPlus logo above the skeleton */
  withLogo?: boolean;
  className?: string;
}

/**
 * Generic page skeleton used as Suspense fallback / route transition placeholder.
 * Replaces blank screens with a pulsing, shimmering layout preview.
 */
const PageSkeleton = ({ withLogo = true, className = "" }: Props) => (
  <div className={`relative min-h-[60vh] w-full p-1 sm:p-2 ${className}`} aria-busy="true" aria-live="polite">
    <div className="space-y-6 opacity-70">
      {/* header */}
      <div className="space-y-3">
        <Skeleton className="h-8 w-56 max-w-[70%] rounded-lg" />
        <Skeleton className="h-4 w-80 max-w-[85%] rounded-md" />
      </div>

      {/* stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="glass-card rounded-xl border border-border/50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <Skeleton className="h-4 w-12 rounded-md" />
            </div>
            <Skeleton className="h-6 w-24 rounded-md" />
            <Skeleton className="h-3 w-20 rounded-md" />
          </div>
        ))}
      </div>

      {/* content block */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="glass-card rounded-xl border border-border/50 p-4 space-y-3 lg:col-span-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-full" />
              <Skeleton className="h-4 flex-1 rounded-md" />
              <Skeleton className="h-4 w-16 rounded-md" />
            </div>
          ))}
        </div>
        <div className="glass-card rounded-xl border border-border/50 p-4 space-y-3">
          <Skeleton className="h-4 w-28 rounded-md" />
          <Skeleton className="h-32 w-full rounded-lg" />
          <Skeleton className="h-4 w-3/4 rounded-md" />
          <Skeleton className="h-4 w-1/2 rounded-md" />
        </div>
      </div>
    </div>

    {/* shimmer sweep */}
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl"
    >
      <div className="absolute inset-y-0 -left-1/3 w-1/3 animate-[skeleton-sweep_1.8s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-foreground/[0.06] to-transparent" />
    </div>

    {withLogo && (
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <RectorLogoLoader size={64} />
      </div>
    )}
  </div>
);

export default PageSkeleton;
