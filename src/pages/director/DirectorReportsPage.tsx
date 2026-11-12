import {useAcademicYear} from '@/hooks/useAcademicYear';
import {useCampus} from "@/hooks/useCampus";
import { useMemo } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BarChart3 } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } };

export default function DirectorReportsPage() {
  const { profile } = useAuth();
  const instId = profile?.institution_id;
  const {selectedYear}=useAcademicYear();
  const {campusId} = useCampus();

  const { data: students = [] } = useQuery({
    queryKey: ["dir-rep-students", instId, campusId, selectedYear],
    queryFn: async () => {
      const annual=await (supabase as any).from("student_years").select("user_id,campus_id,niveau,filiere_id").eq("institution_id",instId!).eq("academic_year",selectedYear).eq("enrollment_status","active");
      if(annual.error)throw annual.error;
      const placements=(annual.data as any[]).filter(row=>!campusId||row.campus_id===campusId);
      if(!placements.length)return [];
      const { data,error } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name, filiere_id, level, campus_id")
        .eq("institution_id", instId!).in("user_id",placements.map(p=>p.user_id));
      if(error)throw error;
      return (data||[]).map(p=>{const y=placements.find(y=>y.user_id===p.user_id)!;return {...p,campus_id:y.campus_id,level:y.niveau,filiere_id:y.filiere_id};});
    },
    enabled: !!instId,
  });

  const { data: filieres = [] } = useQuery({
    queryKey: ["dir-rep-filieres", instId, campusId, selectedYear],
    queryFn: async () => {
      const { data } = await supabase
        .from("filieres")
        .select("id, name, campus_id")
        .eq("institution_id", instId!);
      return (data||[]).filter((row:any)=>!campusId||row.campus_id===campusId);
    },
    enabled: !!instId,
  });

  const { data: grades = [] } = useQuery({
    queryKey: ["dir-rep-grades", instId, campusId, selectedYear],
    queryFn: async () => {
      const { data } = await supabase
        .from("grades")
        .select("user_id, average, campus_id")
        .eq("institution_id", instId!).eq("academic_year",selectedYear);
      return (data||[]).filter(row=>!campusId||row.campus_id===campusId);
    },
    enabled: !!instId,
  });

  const filMap = useMemo(() => new Map(filieres.map((f: any) => [f.id, f.name])), [filieres]);

  const classes = useMemo(() => {
    const map = new Map<string, { filiere: string; level: string; count: number; sum: number; n: number; pass: number }>();
    const studentAvg = new Map<string, { sum: number; n: number }>();
    grades.forEach((g: any) => {
      if (g.average === null) return;
      const cur = studentAvg.get(g.user_id) || { sum: 0, n: 0 };
      studentAvg.set(g.user_id, { sum: cur.sum + Number(g.average), n: cur.n + 1 });
    });
    students.forEach((s: any) => {
      const key = `${s.filiere_id}::${s.level}`;
      const cur = map.get(key) || { filiere: filMap.get(s.filiere_id) || "—", level: s.level || "—", count: 0, sum: 0, n: 0, pass: 0 };
      cur.count += 1;
      const a = studentAvg.get(s.user_id);
      if (a && a.n > 0) {
        const avg = a.sum / a.n;
        cur.sum += avg;
        cur.n += 1;
        if (avg >= 10) cur.pass += 1;
      }
      map.set(key, cur);
    });
    return Array.from(map.values()).map((c) => ({
      ...c,
      avg: c.n ? c.sum / c.n : 0,
      successRate: c.n ? Math.round((c.pass / c.n) * 100) : 0,
    }));
  }, [students, grades, filMap]);

  const ranking = useMemo(() => {
    const studentAvg = new Map<string, { sum: number; n: number }>();
    grades.forEach((g: any) => {
      if (g.average === null) return;
      const cur = studentAvg.get(g.user_id) || { sum: 0, n: 0 };
      studentAvg.set(g.user_id, { sum: cur.sum + Number(g.average), n: cur.n + 1 });
    });
    return students
      .map((s: any) => {
        const a = studentAvg.get(s.user_id);
        return { ...s, avg: a && a.n ? a.sum / a.n : null };
      })
      .filter((s: any) => s.avg !== null)
      .sort((a: any, b: any) => b.avg - a.avg)
      .slice(0, 10);
  }, [students, grades]);

  const chartData = classes.map((c) => ({ label: `${c.filiere.slice(0, 8)} ${c.level}`, moyenne: Number(c.avg.toFixed(2)) }));

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={item}>
        <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground flex items-center gap-2">
          <BarChart3 className="w-7 h-7 text-accent" /> Rapports académiques
        </h1>
        <p className="text-muted-foreground mt-1">Vue lecture seule des indicateurs de l'établissement.</p>
      </motion.div>

      <motion.div variants={item}>
        <Card className="border-border/60">
          <CardHeader><CardTitle className="text-lg">Moyenne par classe</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} domain={[0, 20]} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                <Bar dataKey="moyenne" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={item}>
        <Card className="border-border/60">
          <CardHeader><CardTitle className="text-lg">Statistiques par classe</CardTitle></CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Filière</TableHead>
                  <TableHead>Niveau</TableHead>
                  <TableHead className="text-right">Étudiants</TableHead>
                  <TableHead className="text-right">Moyenne</TableHead>
                  <TableHead className="text-right">Taux réussite</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {classes.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Aucune donnée.</TableCell></TableRow>}
                {classes.map((c, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{c.filiere}</TableCell>
                    <TableCell>{c.level}</TableCell>
                    <TableCell className="text-right">{c.count}</TableCell>
                    <TableCell className="text-right font-mono">{c.avg.toFixed(2)}/20</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={c.successRate >= 50 ? "default" : "secondary"}>{c.successRate}%</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={item}>
        <Card className="border-border/60">
          <CardHeader><CardTitle className="text-lg">Classement général (top 10)</CardTitle></CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Rang</TableHead>
                  <TableHead>Étudiant</TableHead>
                  <TableHead>Niveau</TableHead>
                  <TableHead className="text-right">Moyenne</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ranking.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">Aucune note disponible.</TableCell></TableRow>}
                {ranking.map((s: any, i) => (
                  <TableRow key={s.user_id}>
                    <TableCell className="font-bold text-accent">#{i + 1}</TableCell>
                    <TableCell>{s.first_name} {s.last_name}</TableCell>
                    <TableCell>{s.level || "—"}</TableCell>
                    <TableCell className="text-right font-mono">{s.avg.toFixed(2)}/20</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
