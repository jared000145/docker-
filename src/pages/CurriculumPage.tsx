import { motion } from "framer-motion";
import { GraduationCap, CheckCircle2, Circle, Award, BookOpen, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.08 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

const LEVELS_ORDER = ["L1", "L2", "L3", "M1", "M2"];
const CREDITS_PER_YEAR = 60;

const CurriculumPage = () => {
  const { user, profile } = useAuth();

  const { data: grades = [] } = useQuery({
    queryKey: ["curriculum-grades", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("grades")
        .select("*, subjects(name, credits, semester, level)")
        .eq("user_id", user!.id);
      return data || [];
    },
    enabled: !!user,
  });

  const { data: rattrapages = [] } = useQuery({
    queryKey: ["curriculum-rattrapages", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("rattrapages")
        .select("subject_id, rattrapage_grade, status")
        .eq("user_id", user!.id);
      return data || [];
    },
    enabled: !!user,
  });

  // Helper: get final grade for a subject (max of original average and rattrapage)
  const getFinalGrade = (subjectId: string) => {
    const grade = grades.find((g: any) => g.subject_id === subjectId);
    const ratt = rattrapages.find((r: any) => r.subject_id === subjectId && r.status === "passed" && r.rattrapage_grade != null);
    const original = grade?.average ?? 0;
    const rattGrade = ratt?.rattrapage_grade ?? 0;
    return { grade, finalAvg: Math.max(original, rattGrade), hasRatt: !!ratt };
  };

  const { data: subjects = [] } = useQuery({
    queryKey: ["curriculum-subjects", profile?.filiere_id, profile?.institution_id],
    queryFn: async () => {
      let q = supabase.from("subjects").select("id, name, credits, semester, level");
      if (profile?.institution_id) q = q.eq("institution_id", profile.institution_id);
      if (profile?.filiere_id) q = q.eq("filiere_id", profile.filiere_id);
      const { data } = await q;
      return data || [];
    },
    enabled: !!profile?.institution_id,
  });

  // Group by level then semester
  const levelData = new Map<string, { semesters: Map<string, { subjects: any[]; totalCredits: number; validatedCredits: number }>; totalCredits: number; validatedCredits: number }>();

  subjects.forEach((s: any) => {
    const level = s.level || "L1";
    if (!levelData.has(level)) levelData.set(level, { semesters: new Map(), totalCredits: 0, validatedCredits: 0 });
    const ld = levelData.get(level)!;

    const semKey = s.semester || "S1";
    if (!ld.semesters.has(semKey)) ld.semesters.set(semKey, { subjects: [], totalCredits: 0, validatedCredits: 0 });
    const sem = ld.semesters.get(semKey)!;
    sem.subjects.push(s);
    sem.totalCredits += s.credits || 0;
    ld.totalCredits += s.credits || 0;
  });

  // Validate credits (using best of original grade and rattrapage)
  grades.forEach((g: any) => {
    if (g.subjects) {
      const { finalAvg } = getFinalGrade(g.subject_id);
      if (finalAvg >= 10) {
        const level = g.subjects.level || "L1";
        const semKey = g.subjects.semester || "S1";
        const ld = levelData.get(level);
        if (ld) {
          const sem = ld.semesters.get(semKey);
          if (sem) {
            sem.validatedCredits += g.subjects.credits || 0;
            ld.validatedCredits += g.subjects.credits || 0;
          }
        }
      }
    }
  });

  const sortedLevels = LEVELS_ORDER.filter(l => levelData.has(l));
  
  // Calculate cumulative credits
  let cumulativeValidated = 0;
  let cumulativeTotal = 0;
  const levelEntries = sortedLevels.map(level => {
    const ld = levelData.get(level)!;
    const yearTotal = Math.max(ld.totalCredits, CREDITS_PER_YEAR);
    cumulativeValidated += ld.validatedCredits;
    cumulativeTotal += yearTotal;
    return { level, ...ld, yearTotal, cumulativeValidated, cumulativeTotal };
  });

  const currentLevel = profile?.level || "L1";
  const currentLevelIdx = LEVELS_ORDER.indexOf(currentLevel);
  const totalExpectedCredits = (currentLevelIdx + 1) * CREDITS_PER_YEAR;
  const totalValidated = cumulativeValidated;
  const progressPercent = totalExpectedCredits > 0 ? Math.min(100, Math.round((totalValidated / totalExpectedCredits) * 100)) : 0;

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={item}>
        <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground">Mon Cursus</h1>
        <p className="text-muted-foreground mt-1">Suivez votre progression dans le programme</p>
      </motion.div>

      <motion.div variants={item} className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="glass-card-elevated border-border/50">
          <CardContent className="p-5 text-center">
            <GraduationCap className="w-10 h-10 text-accent mx-auto mb-3" />
            <p className="text-3xl font-heading font-bold text-foreground">{currentLevel}</p>
            <p className="text-sm text-muted-foreground">{profile?.department || "—"}</p>
          </CardContent>
        </Card>
        <Card className="glass-card-elevated border-border/50">
          <CardContent className="p-5 text-center">
            <Award className="w-10 h-10 text-success mx-auto mb-3" />
            <p className="text-3xl font-heading font-bold text-foreground">{totalValidated}</p>
            <p className="text-sm text-muted-foreground">Crédits validés</p>
          </CardContent>
        </Card>
        <Card className="glass-card-elevated border-border/50">
          <CardContent className="p-5 text-center">
            <TrendingUp className="w-10 h-10 text-info mx-auto mb-3" />
            <p className="text-3xl font-heading font-bold text-foreground">{totalExpectedCredits}</p>
            <p className="text-sm text-muted-foreground">Crédits requis ({currentLevel})</p>
          </CardContent>
        </Card>
        <Card className="glass-card-elevated border-border/50">
          <CardContent className="p-5 text-center">
            <BookOpen className="w-10 h-10 text-warning mx-auto mb-3" />
            <p className="text-3xl font-heading font-bold text-foreground">{progressPercent}%</p>
            <p className="text-sm text-muted-foreground">Progression</p>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={item}>
        <Card className="glass-card-elevated border-border/50">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-foreground">Progression globale — {totalValidated}/{totalExpectedCredits} crédits ECTS</span>
              <span className="text-sm font-bold text-accent">{progressPercent}%</span>
            </div>
            <Progress value={progressPercent} className="h-4" />
            <div className="flex justify-between mt-2">
              {LEVELS_ORDER.slice(0, currentLevelIdx + 1).map((l, i) => (
                <span key={l} className="text-xs text-muted-foreground">{l} — {(i + 1) * 60} cr.</span>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {levelEntries.length > 0 ? (
        levelEntries.map(({ level, semesters, validatedCredits: lv, yearTotal, cumulativeValidated: cv }) => {
          const pct = yearTotal > 0 ? Math.round((lv / yearTotal) * 100) : 0;
          const isDone = pct >= 100;
          const semEntries = Array.from(semesters.entries()).sort(([a], [b]) => a.localeCompare(b));

          return (
            <motion.div key={level} variants={item}>
              <Card className={`glass-card-elevated border-border/50 ${isDone ? "ring-1 ring-success/30" : ""}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-heading flex items-center gap-2">
                      {isDone ? <CheckCircle2 className="w-5 h-5 text-success" /> : <Circle className="w-5 h-5 text-muted-foreground" />}
                      {level} — {lv}/{yearTotal} crédits
                      {isDone && <span className="text-xs px-2 py-0.5 rounded-full bg-success/15 text-success ml-2">Validé ✓</span>}
                    </CardTitle>
                    <span className="text-sm text-muted-foreground">Cumul : {cv} crédits</span>
                  </div>
                  <Progress value={pct} className="h-2 mt-2" />
                </CardHeader>
                <CardContent className="space-y-3 pt-2">
                  {semEntries.map(([semName, sem]) => {
                    const sPct = sem.totalCredits > 0 ? Math.round((sem.validatedCredits / sem.totalCredits) * 100) : 0;
                    return (
                      <div key={semName} className={`p-3 rounded-lg border transition-colors ${sPct >= 100 ? "border-success/30 bg-success/5" : "border-border/30 bg-secondary/10"}`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-foreground flex items-center gap-2">
                            {sPct >= 100 ? <CheckCircle2 className="w-4 h-4 text-success" /> : <Circle className="w-4 h-4 text-muted-foreground" />}
                            {semName}
                          </span>
                          <span className="text-xs text-muted-foreground">{sem.validatedCredits}/{sem.totalCredits} cr.</span>
                        </div>
                        <Progress value={sPct} className="h-1.5 mb-2" />
                        <div className="space-y-1">
                          {sem.subjects.map((s: any) => {
                            const { grade, finalAvg, hasRatt } = getFinalGrade(s.id);
                            const validated = grade && finalAvg >= 10;
                            return (
                              <div key={s.id} className="flex items-center justify-between text-xs px-2 py-1 rounded bg-secondary/20">
                                <span className={validated ? "text-success font-medium" : "text-foreground"}>
                                  {validated ? "✅" : "⬜"} {s.name}
                                  {hasRatt && validated && <span className="ml-1 text-[10px] text-accent">(ratt.)</span>}
                                </span>
                                <span className="text-muted-foreground">
                                  {grade?.average != null ? `${finalAvg}/20` : "—"} · {s.credits} cr.
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </motion.div>
          );
        })
      ) : (
        <motion.div variants={item}>
          <Card className="glass-card-elevated border-border/50">
            <CardContent className="p-8 text-center">
              <GraduationCap className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="font-heading font-semibold text-foreground mb-2">Aucune donnée de cursus</h3>
              <p className="text-muted-foreground text-sm">Votre progression sera affichée ici une fois les matières et notes disponibles.</p>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </motion.div>
  );
};

export default CurriculumPage;
