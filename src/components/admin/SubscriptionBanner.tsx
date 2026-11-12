import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Clock } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";

export const SubscriptionBanner = () => {
  const { daysLeft, isWarning, isCritical, isExpired } = useSubscription();

  if (isExpired || (!isWarning && !isCritical)) return null;

  const tone = isCritical
    ? "from-red-600 to-rose-700 text-white"
    : "from-amber-500 to-orange-600 text-white";

  const Icon = isCritical ? AlertTriangle : Clock;

  const label =
    daysLeft === 0
      ? "Votre abonnement expire aujourd'hui"
      : daysLeft === 1
      ? "Votre abonnement expire demain"
      : `Votre abonnement expire dans ${daysLeft} jours`;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -30, opacity: 0 }}
        className={`bg-gradient-to-r ${tone} px-4 py-2.5 shadow-md`}
      >
        <div className="flex items-center justify-center gap-2 text-sm font-medium">
          <Icon className="h-4 w-4 shrink-0 animate-pulse" />
          <span>{label}. Veuillez régulariser votre paiement pour éviter toute interruption.</span>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
