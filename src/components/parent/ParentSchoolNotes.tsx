import ValidatedBulletinDownload from "@/components/ValidatedBulletinDownload";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useParentContext } from "@/components/ParentLayout";
import { useCycle } from "@/hooks/useCycle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TRIMESTRES, TRIMESTRE_LABEL, matiereAverage, trimestreAverage, mentionForAverage } from "@/lib/collegeLycee";

const fmt = (v: number | null | undefined) => (v == null ? "—" : Number(v).toFixed(2));

const ParentSchoolNotes = () => {
  const { selectedChildId, children } = useParentContext();
  const { thirdNoteEnabled } = useCycle();
  const child: any = children.find((c: any) => c.user_id === selectedChildId);
  const [trimestre, setTrimestre] = useState("T1");

  const { data: childProfile } = useQuery({
    queryKey: ["parent-child-profile", selectedChildId],
    enabled: !!selectedChildId,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("classe_id, academic_year")
        .eq("user_id", selectedChildId!)
        .maybeSingle();
      return data;
    },
  });

  const classeId = childProfile?.classe_id || child?.classe_id;

  const { data: classe } = useQuery({
    queryKey: ["parent-child-classe", classeId],
    enabled: !!classeId,
    queryFn: async () => {
      const { data } = await (supabase as any).from("classes").select("*").eq("id", classeId).maybeSingle();
      return data;
    },
  });

  const { data: grades = [] } = useQuery({
    queryKey: ["parent-trim-grades", selectedChildId, trimestre, childProfile?.academic_year],
    enabled: !!selectedChildId && !!classeId,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("grades_trimestre")
        .select("*")
        .eq("user_id", selectedChildId!)
        .eq("classe_id", classeId)
        .eq("trimestre", trimestre).eq("academic_year", childProfile?.academic_year || child?.academic_year || "");
      return data || [];
    },
  });

  const { data: releve } = useQuery({
    queryKey: ["parent-trim-releve", selectedChildId, trimestre, childProfile?.academic_year],
    enabled: !!selectedChildId && !!classeId,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("releves_trimestre")
        .select("*")
        .eq("user_id", selectedChildId!)
        .eq("classe_id", classeId)
        .eq("trimestre", trimestre)
        .maybeSingle();
      return data;
    },
  });

  const rows = useMemo(
    () =>
      (grades as any[]).map((g) => ({
        ...g,
        moyenne: matiereAverage(g.note1, g.bareme1, g.note2, g.bareme2, thirdNoteEnabled ? g.note3 : null, g.bareme3),
      })),
    [grades, thirdNoteEnabled],
  );

  const moyenne = trimestreAverage(rows.map((r) => ({ moyenne: r.moyenne, coefficient: r.coefficient })));
  const displayed = releve?.moyenne_trimestre ?? moyenne;

  if (!classeId) {
    return (
      <Card><CardContent className="p-8 text-center text-muted-foreground text-sm">
        Votre enfant n'est pas encore rattaché à une classe.
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-6">
      <ValidatedBulletinDownload studentId={selectedChildId} year={childProfile?.academic_year || child?.academic_year} period={trimestre}/>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold">Notes</h1>
          <p className="text-sm text-muted-foreground">{classe?.nom || "—"}{classe?.serie ? ` · Série ${classe.serie}` : ""}</p>
        </div>
        <Select value={trimestre} onValueChange={setTrimestre}>
          <SelectTrigger className="sm:w-52"><SelectValue /></SelectTrigger>
          <SelectContent>
            {TRIMESTRES.map((t) => <SelectItem key={t} value={t}>{TRIMESTRE_LABEL[t]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card><CardContent className="p-4 text-center">
          <p className="text-xs text-muted-foreground">Moyenne trimestre</p>
          <p className={`text-2xl font-bold ${(displayed ?? 0) >= 10 ? "text-success" : "text-destructive"}`}>{fmt(displayed)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-xs text-muted-foreground">Rang</p>
          <p className="text-2xl font-bold">{releve?.rang ?? "—"}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-xs text-muted-foreground">Mention</p>
          <p className="text-lg font-bold leading-tight">{mentionForAverage(displayed)}</p>
        </CardContent></Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="pb-3"><CardTitle className="text-base">{TRIMESTRE_LABEL[trimestre]} — Notes par matière</CardTitle></CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">Aucune note publiée pour ce trimestre.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[560px]">
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
                    <tr key={r.id} className="border-b border-border/40">
                      <td className="p-3 font-medium">{r.matiere}</td>
                      <td className="p-3 text-center">{r.coefficient}</td>
                      <td className="p-3 text-center">{fmt(r.note1)}</td>
                      <td className="p-3 text-center">{fmt(r.note2)}</td>
                      {thirdNoteEnabled && <td className="p-3 text-center">{fmt(r.note3)}</td>}
                      <td className={`p-3 text-center font-bold ${(r.moyenne ?? 0) >= 10 ? "text-success" : "text-destructive"}`}>{fmt(r.moyenne)}</td>
                      <td className="p-3 text-center">
                        <Badge variant="outline" className="text-[10px]">{mentionForAverage(r.moyenne)}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {releve?.appreciation && (
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Appréciation du conseil de classe</p>
          <p className="text-sm font-medium mt-1">{releve.appreciation}</p>
        </CardContent></Card>
      )}
    </div>
  );
};

export default ParentSchoolNotes;
