import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle } from "lucide-react";

export function NewYearAccessBadge({ userId }: { userId: string }) {
  const { data } = useQuery({
    queryKey: ["new-year-access", userId],
    queryFn: async () => {
      const { data } = await supabase.rpc("has_new_year_access", { _user_id: userId });
      return Boolean(data);
    },
    enabled: !!userId,
    staleTime: 60_000,
  });
  if (data === undefined) return null;
  return data ? (
    <Badge className="bg-success/15 text-success border-success/40 gap-1">
      <CheckCircle2 className="w-3 h-3" /> Accès nouvelle année : OUI
    </Badge>
  ) : (
    <Badge className="bg-destructive/15 text-destructive border-destructive/40 gap-1">
      <XCircle className="w-3 h-3" /> Accès nouvelle année : NON
    </Badge>
  );
}
