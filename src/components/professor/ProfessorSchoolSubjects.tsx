import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { BookOpen, Users, GraduationCap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useProfessorClasses } from "@/hooks/useProfessorClasses";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const ProfessorSchoolSubjects = () => {
  const { data: rows = [], isLoading } = useProfessorClasses();
  const { profile } = useAuth();

  const classeIds = useMemo(() => [...new Set(rows.map((r) => r.classe_id))], [rows]);

  const { data: counts = {} } = useQuery({
    queryKey: ["prof-class-counts", classeIds.join(","), profile?.institution_id],
    enabled: classeIds.length > 0 && !!profile?.institution_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("classe_id")
        .eq("institution_id", profile!.institution_id!)
        .in("classe_id", classeIds);
      const map: Record<string, number> = {};
      (data || []).forEach((p: any) => { map[p.classe_id] = (map[p.classe_id] || 0) + 1; });
      return map;
    },
  });

  const byClass = useMemo(() => {
    const m: Record<string, { classe: any; items: any[] }> = {};
    rows.forEach((r) => {
      const key = r.classe_id;
      (m[key] ||= { classe: r.classe, items: [] }).items.push(r);
    });
    return Object.entries(m);
  }, [rows]);

  if (isLoading) return <p className="text-muted-foreground text-sm">Chargement…</p>;

  if (byClass.length === 0) {
    return (
      <Card className="glass-card border-border/50">
        <CardContent className="p-10 text-center text-muted-foreground text-sm">
          Aucune matière ne vous est affectée pour le moment. L'administration doit vous rattacher à une classe depuis <b>Matières</b>.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl sm:text-2xl font-heading font-bold flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-primary" /> Mes cours
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Classes et matières dont vous avez la charge.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {byClass.map(([classeId, group], i) => (
          <motion.div key={classeId} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className="glass-card-elevated border-border/50 h-full">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold text-base truncate flex items-center gap-1.5">
                      <GraduationCap className="w-4 h-4 text-primary shrink-0" />
                      {group.classe?.nom || "Classe"}
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      <Badge variant="outline" className="text-[10px]">{group.classe?.niveau}</Badge>
                      {group.classe?.serie && <Badge variant="secondary" className="text-[10px]">Série {group.classe.serie}</Badge>}
                    </div>
                  </div>
                  <Badge variant="secondary" className="gap-1 text-[10px] shrink-0">
                    <Users className="w-3 h-3" /> {counts[classeId] ?? 0}
                  </Badge>
                </div>
                <ul className="space-y-1">
                  {group.items.map((it: any) => (
                    <li key={it.id} className="flex items-center justify-between text-xs bg-secondary/40 rounded px-2 py-1.5">
                      <span className="truncate font-medium">{it.subject?.name || "—"}</span>
                      <Badge variant="outline" className="ml-2 shrink-0 text-[10px]">coef {it.coefficient ?? 1}</Badge>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default ProfessorSchoolSubjects;
