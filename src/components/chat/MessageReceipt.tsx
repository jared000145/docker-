import { motion } from "framer-motion";
import { Check, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export default function MessageReceipt({ message, className }: { message: any; className?: string }) {
  const read = Boolean(message.read_at || message.is_read);
  const delivered = Boolean(message.delivered_at || read);
  const Icon = delivered ? CheckCheck : Check;
  const label = read ? "Lu" : delivered ? "Livré" : "Envoyé";

  return (
    <motion.span
      key={label}
      initial={{ opacity: 0.45, scale: 0.78 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 520, damping: 28 }}
      className={cn("inline-flex h-5 min-w-5 items-center justify-center", className)}
      title={label}
      aria-label={label}
    >
      <Icon className={cn("h-4 w-4 stroke-[2.6] sm:h-[18px] sm:w-[18px]", read ? "text-info" : "text-current opacity-80")} />
    </motion.span>
  );
}