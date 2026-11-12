import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ClipboardCheck, Users, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useInstitution } from "@/hooks/useInstitution";
import { useAcademicYear } from "@/hooks/useAcademicYear";

const AdminSchoolAttendance = () => {
  const { institution } = useInstitution();
  const { selectedYear } = useAcademicYear();
  const [classeId, setClasseId] = useState("");
  const [from, setFrom] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 3);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));

  const { data: classes = [] } = useQuery({
    queryKey: ["school-att-classes", institution?.id, selectedYear],
    enabled: !!institution?.id,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("classes")
        .select("id, nom, niveau, serie")
        .eq("institution_id", institution!.id)
        .eq("academic_year", selectedYear)
        .order("niveau").order("nom");
      return data || [];
    },
  });

  const { data: students = [] } = useQuery({
    queryKey: ["school-att-students", classeId],
    enabled: !!classeId,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name, student_number")
        .eq("classe_id", classeId)
        .order("last_name");
      return data || [];
    },
  });

  const { data: rows = [] } = useQuery({
    queryKey: ["school-att-rows", classeId, from, to, students.length],
    enabled: !!classeId && students.length > 0,
    queryFn: async () => {
      const ids = students.map((s: any) => s.user_id);
      const { data } = await supabase
        .from("attendance")
        .select("id, user_id, date, status, subject_id, subjects(name)")
        .in("user_id", ids)
        .gte("date", from)
        .lte("date", to)
        .order("date", { ascending: false });
      return data || [];
    },
  });

  const totals = useMemo(() => {
    const m: Record<string, { absent: number; late: number }> = {};
    students.forEach((s: any) => { m[s.user_id] = { absent: 0, late: 0 }; });
    (rows as any[]).forEach((r) => {
      if (!m[r.user_id]) m[r.user_id] = { absent: 0, late: 0 };
      if (r.status === "absent") m[r.user_id].absent++;
      if (r.status === "late") m[r.user_id].late++;
    });
    return m;
  }, [rows, students]);

  const nameOf = (uid: string) => {
    const s: any = students.find((x: any) => x.user_id === uid);
    return s ? `${s.last_name} ${s.first_name}` : "—";
  };

  const totalAbs = (rows as any[]).filter((r) => r.status === "absent").length;
  const totalLate = (rows as any[]).filter((r) => r.status === "late").length;
  const alerts = students.filter((s: any) => (totals[s.user_id]?.absent || 0) >= 5);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <div>
        <h1 className="text-xl sm:text-2xl font-heading font-bold flex items-center gap-2">
          <ClipboardCheck className="w-6 h-6 text-primary" /> Suivi des présences
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Absences et retards des élèves par classe — {selectedYear}</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Select value={classeId} onValueChange={setClasseId}>
          <SelectTrigger className="sm:w-64"><SelectValue placeholder="Choisir une classe…" /></SelectTrigger>
          <SelectContent>
            {classes.map((c: any) => (
              <SelectItem key={c.id} value={c.id}>{c.nom} — {c.niveau}{c.serie ? ` (${c.serie})` : ""}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="sm:w-44" />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="sm:w-44" />
      </div>

      {!classeId ? (
        <Card><CardContent className="p-12 text-center text-muted-foreground text-sm">Sélectionnez une classe pour afficher le suivi des présences.</CardContent></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Élèves</p><p className="text-2xl font-bold">{students.length}</p></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Absences</p><p className="text-2xl font-bold text-destructive">{totalAbs}</p></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Retards</p><p className="text-2xl font-bold text-warning">{totalLate}</p></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Élèves à risque</p><p className="text-2xl font-bold">{alerts.length}</p></CardContent></Card>
          </div>

          <Tabs defaultValue="eleves">
            <TabsList>
              <TabsTrigger value="eleves">Par élève</TabsTrigger>
              <TabsTrigger value="journal">Journal</TabsTrigger>
            </TabsList>

            <TabsContent value="eleves" className="mt-3">
              <Card className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="flex items-center gap-2 px-4 py-3 border-b bg-secondary/30 text-sm font-semibold">
                    <Users className="w-4 h-4 text-primary" /> Récapitulatif
                  </div>
                  {students.length === 0 ? (
                    <p className="p-8 text-center text-sm text-muted-foreground">Aucun élève dans cette classe.</p>
                  ) : (
                    <ul className="divide-y divide-border/40">
                      {students.map((s: any) => {
                        const t = totals[s.user_id] || { absent: 0, late: 0 };
                        return (
                          <li key={s.user_id} className="flex items-center gap-3 p-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate">{s.last_name} {s.first_name}</p>
                              <p className="text-[11px] text-muted-foreground">{s.student_number || "—"}</p>
                            </div>
                            {t.absent >= 5 && <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />}
                            <Badge variant="outline" className="text-[10px] border-destructive/40 text-destructive">{t.absent} abs.</Badge>
                            <Badge variant="outline" className="text-[10px] border-warning/40 text-warning">{t.late} ret.</Badge>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="journal" className="mt-3">
              <Card className="overflow-hidden">
                <CardContent className="p-0">
                  {rows.length === 0 ? (
                    <p className="p-8 text-center text-sm text-muted-foreground">Aucun enregistrement sur la période.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm min-w-[560px]">
                        <thead className="bg-secondary/40 border-b">
                          <tr>
                            <th className="text-left p-3 font-semibold">Date</th>
                            <th className="text-left p-3 font-semibold">Élève</th>
                            <th className="text-left p-3 font-semibold">Matière</th>
                            <th className="text-center p-3 font-semibold">Statut</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(rows as any[]).map((r) => (
                            <tr key={r.id} className="border-b border-border/40">
                              <td className="p-3">{new Date(r.date).toLocaleDateString("fr-FR")}</td>
                              <td className="p-3 font-medium">{nameOf(r.user_id)}</td>
                              <td className="p-3">{r.subjects?.name || "—"}</td>
                              <td className="p-3 text-center">
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] ${
                                    r.status === "absent" ? "border-destructive/40 text-destructive"
                                      : r.status === "late" ? "border-warning/40 text-warning"
                                      : "border-success/40 text-success"
                                  }`}
                                >
                                  {r.status === "absent" ? "Absent" : r.status === "late" ? "Retard" : "Présent"}
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
            </TabsContent>
          </Tabs>
        </>
      )}
    </motion.div>
  );
};

export default AdminSchoolAttendance;
