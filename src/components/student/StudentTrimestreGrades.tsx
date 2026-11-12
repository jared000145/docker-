import {useAcademicYear} from '@/hooks/useAcademicYear';
import {AcademicYearSelector} from '@/components/AcademicYearSelector';
import ValidatedBulletinDownload from "@/components/ValidatedBulletinDownload";
import { motion } from "framer-motion";
import { BookOpen, Award, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useInstitution } from "@/hooks/useInstitution";
import { useCycle } from "@/hooks/useCycle";
import { useState } from "react";
import { TRIMESTRES, TRIMESTRE_LABEL, matiereAverage, trimestreAverage, mentionForAverage } from "@/lib/collegeLycee";

const fmt = (v: number | null | undefined) => (v == null ? "—" : Number(v).toFixed(2));

const mentionColor = (avg: number | null) => {
  if (avg == null) return "bg-muted text-muted-foreground";
  if (avg >= 16) return "bg-success/15 text-success border-success/40";
  if (avg >= 14) return "bg-info/15 text-info border-info/40";
  if (avg >= 12) return "bg-warning/15 text-warning border-warning/40";
  if (avg >= 10) return "bg-primary/15 text-primary border-primary/40";
  return "bg-destructive/15 text-destructive border-destructive/40";
};

const StudentTrimestreGrades = () => {
  const { user, profile } = useAuth();
  const { institution } = useInstitution();
  const { thirdNoteEnabled } = useCycle();
  const {selectedYear:activeYear}=useAcademicYear();
  const registration=useQuery({queryKey:['school-annual-class',user?.id,activeYear],enabled:!!user,queryFn:async()=>{const{data,error}=await(supabase as any).from('student_years').select('classe_id').eq('user_id',user!.id).eq('academic_year',activeYear).order('created_at',{ascending:false}).limit(1).maybeSingle();if(error)throw error;return data;}});
  const annualClassId=registration.data?.classe_id||(activeYear===institution?.academic_year?profile?.classe_id:null);
  const [trimestre, setTrimestre] = useState<string>("T1");

  const { data: classe } = useQuery({
    queryKey: ["student-classe", annualClassId],
    enabled: !!annualClassId,
    queryFn: async () => {
      const { data } = await supabase.from("classes").select("*").eq("id", annualClassId!).maybeSingle();
      return data;
    },
  });

  const { data: grades = [] } = useQuery({
    queryKey: ["student-grades-trimestre", user?.id, trimestre, activeYear],
    enabled: !!user && !!annualClassId,
    queryFn: async () => {
      const { data } = await supabase
        .from("grades_trimestre")
        .select("*")
        .eq("user_id", user!.id)
        .eq("classe_id", annualClassId!)
        .eq("academic_year", activeYear)
        .eq("trimestre", trimestre);
      return data || [];
    },
  });

  const { data: releve } = useQuery({
    queryKey: ["student-releve-trimestre", user?.id, trimestre, activeYear],
    enabled: !!user && !!annualClassId,
    queryFn: async () => {
      const { data } = await supabase
        .from("releves_trimestre")
        .select("*")
        .eq("user_id", user!.id)
        .eq("classe_id", annualClassId!)
        .eq("academic_year", activeYear)
        .eq("trimestre", trimestre)
        .maybeSingle();
      return data;
    },
  });

  const { data: classStats } = useQuery({
    queryKey: ["student-trimestre-class-stats", user?.id, annualClassId, trimestre, activeYear],
    enabled: !!user && !!annualClassId,
    queryFn: async () => {
      if (!user?.id || !annualClassId) return null;
      const { data } = await (supabase as any)
        .rpc("get_trimestre_class_stats", {
          _user_id: user.id,
          _classe_id: profile.classe_id,
          _trimestre: trimestre,
          _academic_year: activeYear,
        })
        .maybeSingle();
      return data;
    },
  });

  const rows = grades.map((g: any) => ({
    ...g,
    moyenne: matiereAverage(g.note1, g.bareme1, g.note2, g.bareme2, thirdNoteEnabled ? g.note3 : null, g.bareme3),
  }));

  const moyenne = trimestreAverage(rows.map((r) => ({ moyenne: r.moyenne, coefficient: r.coefficient })));
  const displayedMoyenne = classStats?.moyenne_eleve ?? releve?.moyenne_trimestre ?? moyenne;
  const displayedRang = classStats?.rang ?? releve?.rang ?? null;

  if (!annualClassId) {
    return (
      <Card className="border-border/50">
        <CardContent className="p-8 text-center text-muted-foreground">
          Vous n'êtes pas encore rattaché(e) à une classe. Contactez l'administration.
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <AcademicYearSelector/><ValidatedBulletinDownload studentId={user?.id} year={activeYear} period={trimestre}/>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-heading font-bold text-foreground">Mes Notes</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {classe?.nom || ""} · Année {activeYear}
          </p>
        </div>
        <Select value={trimestre} onValueChange={setTrimestre}>
          <SelectTrigger className="w-full sm:w-52 bg-secondary/50">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TRIMESTRES.map((t) => (
              <SelectItem key={t} value={t}>{TRIMESTRE_LABEL[t]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="glass-card border-border/60">
          <CardContent className="p-4 text-center">
            <p className="text-xs font-semibold text-foreground/70">Moyenne trimestre</p>
            <p className={`text-2xl font-bold ${(displayedMoyenne ?? 0) >= 10 ? "text-success" : "text-destructive"}`}>
              {fmt(displayedMoyenne)}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">/ 20</p>
          </CardContent>
        </Card>
        <Card className="glass-card border-border/60">
          <CardContent className="p-4 text-center">
            <p className="text-xs font-semibold text-foreground/70">Moyenne classe</p>
            <p className="text-2xl font-bold">{fmt(classStats?.moyenne_classe)}</p>
            {classStats?.effectif ? <p className="text-[10px] text-muted-foreground mt-1">{classStats.effectif} classé(s)</p> : null}
          </CardContent>
        </Card>
        <Card className="glass-card border-accent/35 bg-accent/10">
          <CardContent className="p-4 text-center">
            <p className="text-xs font-semibold text-accent-foreground/80">Rang</p>
            <p className="text-2xl font-bold text-accent">{displayedRang ?? "—"}</p>
          </CardContent>
        </Card>
        <Card className="glass-card border-border/60">
          <CardContent className="p-4 text-center">
            <p className="text-xs font-semibold text-foreground/70">Mention</p>
            <p className="text-xl font-bold leading-tight break-words">{mentionForAverage(displayedMoyenne)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Grades table */}
      <Card className="glass-card-elevated border-border/50 overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-primary" />
            {TRIMESTRE_LABEL[trimestre]} — Notes par matière
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              Aucune note publiée pour ce trimestre.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead className="bg-secondary/40 border-b">
                  <tr>
                    <th className="text-left p-3 font-semibold">Matière</th>
                    <th className="text-center p-3 font-semibold">Coef</th>
                    <th className="text-center p-3 font-semibold">Devoir 1</th>
                    <th className="text-center p-3 font-semibold">Devoir 2</th>
                    {thirdNoteEnabled && <th className="text-center p-3 font-semibold">Comp.</th>}
                    <th className="text-center p-3 font-semibold">Moyenne</th>
                    <th className="text-center p-3 font-semibold">Mention</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r: any) => (
                    <tr key={r.id} className="border-b border-border/40 hover:bg-secondary/20">
                      <td className="p-3 font-medium">{r.matiere}</td>
                      <td className="p-3 text-center">{r.coefficient}</td>
                      <td className="p-3 text-center">{fmt(r.note1)}<span className="text-xs text-muted-foreground">/{r.bareme1}</span></td>
                      <td className="p-3 text-center">{fmt(r.note2)}<span className="text-xs text-muted-foreground">/{r.bareme2}</span></td>
                      {thirdNoteEnabled && (
                        <td className="p-3 text-center">{fmt(r.note3)}<span className="text-xs text-muted-foreground">/{r.bareme3}</span></td>
                      )}
                      <td className={`p-3 text-center font-bold ${(r.moyenne ?? 0) >= 10 ? "text-success" : "text-destructive"}`}>
                        {fmt(r.moyenne)}
                      </td>
                      <td className="p-3 text-center">
                        <Badge variant="outline" className={`text-[10px] ${mentionColor(r.moyenne)}`}>
                          {mentionForAverage(r.moyenne)}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Releve summary */}
      {releve && (
        <Card className="glass-card-elevated border-accent/30 bg-accent/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Award className="w-4 h-4 text-accent" /> Relevé trimestriel
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div><p className="text-xs text-muted-foreground">Moyenne trimestre</p><p className="font-bold text-lg">{fmt(releve.moyenne_trimestre)}</p></div>
            <div><p className="text-xs text-muted-foreground">Moyenne annuelle</p><p className="font-bold text-lg">{fmt(releve.moyenne_annuelle)}</p></div>
            <div><p className="text-xs text-muted-foreground">Rang</p><p className="font-bold text-lg">{displayedRang ?? "—"}</p></div>
            <div><p className="text-xs text-muted-foreground">Appréciation</p><p className="font-medium">{releve.appreciation || "—"}</p></div>
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
};

export default StudentTrimestreGrades;
