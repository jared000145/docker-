import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Marquee banner shown at the top of the student dashboard when the
 * end-of-year closure has produced a record in student_year_history.
 * Displays the validation status (validé / reprise) for the most
 * recently archived year.
 */
export const ClosureBanner = () => {
  const { user } = useAuth();

  const { data: lastClosure } = useQuery({
    queryKey: ["student-last-closure", user?.id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("student_year_history")
        .select("academic_year, status, credits_acquired, credits_total")
        .eq("user_id", user!.id)
        .order("academic_year", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  if (!lastClosure) return null;

  const isValidated =
    lastClosure.status === "validated" ||
    lastClosure.status === "valide" ||
    lastClosure.status === "passed";

  const tone = isValidated
    ? "from-emerald-600 via-teal-600 to-emerald-700"
    : "from-orange-600 via-amber-600 to-orange-700";

  const Icon = isValidated ? CheckCircle2 : RefreshCw;

  const label = isValidated
    ? `Année ${lastClosure.academic_year} clôturée — Validé (${lastClosure.credits_acquired || 0}/${lastClosure.credits_total || 60} crédits)`
    : `Année ${lastClosure.academic_year} clôturée — Reprise nécessaire (${lastClosure.credits_acquired || 0}/${lastClosure.credits_total || 60} crédits)`;

  // Repeat the message so the marquee loop feels seamless.
  const text = `${label}   •   ${label}   •   ${label}   •   `;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative overflow-hidden rounded-xl bg-gradient-to-r ${tone} text-white shadow-lg mb-4`}
    >
      <div className="flex items-center gap-3 px-4 py-2.5">
        <Icon className="h-5 w-5 shrink-0" />
        <div className="relative flex-1 overflow-hidden">
          <div className="whitespace-nowrap animate-[marquee_22s_linear_infinite] text-sm font-medium tracking-wide">
            {text}
            {text}
          </div>
        </div>
      </div>
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </motion.div>
  );
};
