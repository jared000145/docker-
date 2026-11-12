import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { GraduationCap } from "lucide-react";

export const ExamBlancCard = () => {
  const { user } = useAuth();
  const { data: rows = [] } = useQuery({
    queryKey: ["my-exam-blanc", user?.id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("exam_blanc_candidats")
        .select("type, numero_candidat, academic_year")
        .eq("user_id", user!.id)
        .order("academic_year", { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  if (!rows.length) return null;

  return (
    <Card className="border-accent/40 bg-gradient-to-br from-accent/5 to-transparent">
      <CardContent className="p-4 flex flex-wrap items-center gap-4">
        <div className="w-10 h-10 rounded-lg bg-accent/15 flex items-center justify-center">
          <GraduationCap className="w-5 h-5 text-accent" />
        </div>
        <div className="flex-1">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Examen blanc</p>
          <div className="flex flex-wrap gap-3 mt-1">
            {rows.map((r: any, i: number) => (
              <div key={i} className="text-sm">
                <span className="font-semibold">{r.type}</span> —
                N° <span className="font-mono text-base text-accent">{r.numero_candidat}</span>
                <span className="text-muted-foreground ml-1">({r.academic_year})</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
