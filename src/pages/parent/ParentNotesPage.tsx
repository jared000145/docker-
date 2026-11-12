import ValidatedBulletinDownload from "@/components/ValidatedBulletinDownload";
import { useCycle } from "@/hooks/useCycle";
import ParentSchoolNotes from "@/components/parent/ParentSchoolNotes";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useParentContext } from "@/components/ParentLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const ParentNotesUniversity = () => {
  const { selectedChildId } = useParentContext();
  const [year, setYear] = useState<string>("latest");
  const [semester, setSemester] = useState<string>("all");

  const { data: rows = [] } = useQuery({
    queryKey: ["parent-notes", selectedChildId],
    enabled: !!selectedChildId,
    queryFn: async () => {
      const { data: grades } = await supabase.from("grades").select("*").eq("user_id", selectedChildId!);
      const subjectIds = [...new Set((grades || []).map((g: any) => g.subject_id))];
      const { data: subs } = subjectIds.length
        ? await supabase.from("subjects").select("id, name, code, coefficient").in("id", subjectIds)
        : { data: [] as any[] };
      const ratIds = [...new Set((grades || []).map((g: any) => `${g.user_id}_${g.subject_id}`))];
      const { data: rats } = await supabase.from("rattrapages").select("user_id, subject_id, rattrapage_grade, status").eq("user_id", selectedChildId!);
      const map = new Map((subs || []).map((s: any) => [s.id, s]));
      const ratMap = new Map((rats || []).map((r: any) => [r.subject_id, r]));
      return (grades || []).map((g: any) => {
        const r = ratMap.get(g.subject_id);
        const finalAvg = r && r.status === "passed" && r.rattrapage_grade != null
          ? Math.max(Number(g.average ?? 0), Number(r.rattrapage_grade))
          : g.average;
        return { ...g, subject: map.get(g.subject_id), rattrapage: r, finalAvg };
      });
    },
  });

  const years = [...new Set(rows.map((r: any) => r.academic_year))].filter(Boolean).sort().reverse();
  const activeYear = year === "latest" || !years.includes(year) ? years[0] : year;
  const filtered = useMemo(() => rows.filter((r: any) => r.academic_year === activeYear && (semester === "all" || r.semester === semester)), [rows, semester, activeYear]);

  const assessed = filtered.filter((r: any) => r.finalAvg != null);
  const moy = assessed.length ? (assessed.reduce((s: number, r: any) => s + Number(r.finalAvg) * Number(r.subject?.coefficient || 1), 0) / assessed.reduce((s: number, r: any) => s + Number(r.subject?.coefficient || 1), 0)).toFixed(2) : "—";

  return (
    <div className="space-y-6">
      <ValidatedBulletinDownload studentId={selectedChildId} year={activeYear}/>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-heading font-bold">Notes</h1>
        <Select value={semester} onValueChange={setSemester}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les semestres</SelectItem>
            <SelectItem value="S1">Semestre 1</SelectItem>
            <SelectItem value="S2">Semestre 2</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Select value={activeYear || "latest"} onValueChange={setYear}><SelectTrigger aria-label="Année des notes"><SelectValue placeholder="Année scolaire" /></SelectTrigger><SelectContent>{years.length ? years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>) : <SelectItem value="latest">Aucune année disponible</SelectItem>}</SelectContent></Select>
      <Card>
        <CardHeader><CardTitle>Bulletin</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">Moyenne générale : <span className="font-bold text-foreground">{moy}/20</span></p>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Matière</TableHead>
                  <TableHead>Semestre</TableHead>
                  <TableHead>CC</TableHead>
                  <TableHead>Examen</TableHead>
                  <TableHead>Moyenne</TableHead>
                  <TableHead>Rattrapage</TableHead>
                  <TableHead>Final</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Aucune note disponible</TableCell></TableRow>
                )}
                {filtered.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.subject?.name || "—"}</TableCell>
                    <TableCell>{r.semester}</TableCell>
                    <TableCell>{r.cc_grade ?? "—"}</TableCell>
                    <TableCell>{r.exam_grade ?? "—"}</TableCell>
                    <TableCell>{r.average ?? "—"}</TableCell>
                    <TableCell>{r.rattrapage?.rattrapage_grade ?? "—"}</TableCell>
                    <TableCell className={`font-bold ${Number(r.finalAvg) >= 10 ? "text-emerald-600" : "text-red-600"}`}>
                      {r.finalAvg != null ? Number(r.finalAvg).toFixed(2) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const ParentNotesPage = () => {
  const { hasUniversite, isLoading } = useCycle();
  if (isLoading) return null;
  if (!hasUniversite) return <ParentSchoolNotes />;
  return <ParentNotesUniversity />;
};

export default ParentNotesPage;
