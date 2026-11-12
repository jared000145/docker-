import { Suspense } from "react";
import { Outlet, useLocation } from "react-router-dom";
import PageSkeleton from "@/components/loading/PageSkeleton";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useIsMobile } from "@/hooks/use-mobile";

/**
 * Smooth fade + slide page transitions between routes.
 * - Desktop: fade + slight slide from right (~280ms)
 * - Mobile: lighter vertical slide (~220ms) — native-like, low GPU
 * - Respects prefers-reduced-motion
 */
const PageTransition = () => {
  const location = useLocation();
  const isMobile = useIsMobile();
  const reduce = useReducedMotion();

  const duration = reduce ? 0 : isMobile ? 0.22 : 0.28;
  const offset = reduce ? 0 : isMobile ? 12 : 16;

  const variants = isMobile
    ? {
        initial: { opacity: 0, y: offset },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -offset / 2 },
      }
    : {
        initial: { opacity: 0, x: offset, y: 4 },
        animate: { opacity: 1, x: 0, y: 0 },
        exit: { opacity: 0, x: -offset / 2 },
      };

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        initial="initial"
        animate="animate"
        exit="exit"
        variants={variants}
        transition={{ duration, ease: [0.22, 1, 0.36, 1] }}
        style={{ willChange: "transform, opacity" }}
        className="min-h-full page-reveal"

      >
        <Suspense fallback={<PageSkeleton />}>
          <Outlet />
        </Suspense>
      </motion.div>
    </AnimatePresence>
  );
};

export default PageTransition;
