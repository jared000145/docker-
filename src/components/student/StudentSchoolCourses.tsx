import {useAcademicYear} from '@/hooks/useAcademicYear';
import {AcademicYearSelector} from '@/components/AcademicYearSelector';
import {useStudentPlacement} from '@/hooks/useStudentPlacement';
import { motion } from "framer-motion";
import { BookOpen, User, GraduationCap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

const StudentSchoolCourses = () => {
  const {selectedYear}=useAcademicYear();
  const {placement}=useStudentPlacement(undefined,selectedYear);
  const classe=placement?.classes,classeId=placement?.classe_id;

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["student-class-subjects", classeId],
    enabled: !!classeId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("subject_classes")
        .select("id, coefficient, professor_name, subject:subjects(id, name, code, duree_cours_minutes)")
        .eq("classe_id", classeId!);
      if (error) throw error;
      return (data || []).sort((a: any, b: any) => (a.subject?.name || "").localeCompare(b.subject?.name || ""));
    },
  });

  if (!classeId) {
    return (
      <Card className="border-border/50">
        <CardContent className="p-8 text-center text-muted-foreground text-sm">
          Vous n'êtes pas encore rattaché(e) à une classe. Contactez l'administration.
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={item} className="flex flex-wrap items-center justify-between gap-3"><div>
        <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground">Mes cours</h1>
        <p className="text-muted-foreground mt-1">
          {classe?.nom || "—"} · {classe?.niveau || "—"}{classe?.serie ? ` · Série ${classe.serie}` : ""}
        </p>
        </div><AcademicYearSelector/>
      </motion.div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : rows.length === 0 ? (
        <Card className="glass-card border-border/50">
          <CardContent className="p-10 text-center text-muted-foreground text-sm">
            Aucune matière n'est encore rattachée à votre classe.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r: any) => (
            <motion.div key={r.id} variants={item}>
              <Card className="glass-card-elevated border-border/50 h-full hover:border-primary/40 transition-colors">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <BookOpen className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold truncate">{r.subject?.name || "—"}</p>
                      <p className="text-[11px] text-muted-foreground">{r.subject?.code || ""}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <User className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{r.professor_name || "Professeur non affecté"}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="text-[10px]">Coefficient {r.coefficient ?? 1}</Badge>
                    {r.subject?.duree_cours_minutes ? (
                      <Badge variant="secondary" className="text-[10px] gap-1">
                        <GraduationCap className="w-3 h-3" /> {r.subject.duree_cours_minutes} min
                      </Badge>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
};

export default StudentSchoolCourses;
