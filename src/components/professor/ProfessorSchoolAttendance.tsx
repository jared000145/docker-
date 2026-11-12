import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CalendarCheck, Check, X, Clock, Save } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useInstitution } from "@/hooks/useInstitution";
import { useProfessorClasses, useClassStudents } from "@/hooks/useProfessorClasses";
import { toast } from "sonner";

type Status = "present" | "absent" | "late";

const STATUS_UI: Record<Status, { label: string; icon: any; cls: string }> = {
  present: { label: "Présent", icon: Check, cls: "bg-success/15 text-success border-success/40" },
  absent: { label: "Absent", icon: X, cls: "bg-destructive/15 text-destructive border-destructive/40" },
  late: { label: "Retard", icon: Clock, cls: "bg-warning/15 text-warning border-warning/40" },
};

const ProfessorSchoolAttendance = () => {
  const { user } = useAuth();
  const { institution } = useInstitution();
  const qc = useQueryClient();
  const activeYear = institution?.academic_year || "2025-2026";

  const { data: assignments = [], isLoading } = useProfessorClasses();
  const [assignId, setAssignId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [marks, setMarks] = useState<Record<string, Status>>({});

  const assign: any = assignments.find((a) => a.id === assignId);
  const { data: students = [] } = useClassStudents(assign?.classe_id);

  const { data: existing = [] } = useQuery({
    queryKey: ["prof-attendance", assign?.subject_id, assign?.classe_id, date],
    enabled: !!assign,
    queryFn: async () => {
      const ids = students.map((s: any) => s.user_id);
      if (ids.length === 0) return [];
      const { data, error } = await supabase
        .from("attendance")
        .select("id, user_id, status")
        .eq("subject_id", assign.subject_id)
        .eq("date", date)
        .in("user_id", ids);
      if (error) throw error;
      return data || [];
    },
  });

  useEffect(() => {
    const m: Record<string, Status> = {};
    students.forEach((s: any) => { m[s.user_id] = "present"; });
    (existing as any[]).forEach((a) => { m[a.user_id] = a.status as Status; });
    setMarks(m);
  }, [assignId, date, students.length, existing]);

  const counts = useMemo(() => {
    const c = { present: 0, absent: 0, late: 0 };
    Object.values(marks).forEach((s) => { c[s] = (c[s] || 0) + 1; });
    return c;
  }, [marks]);

  const save = useMutation({
    mutationFn: async () => {
      if (!assign) throw new Error("Sélectionnez un cours.");
      const existingIds = new Set((existing as any[]).map((a) => a.user_id));
      const rows = students.map((s: any) => ({
        user_id: s.user_id,
        subject_id: assign.subject_id,
        date,
        status: marks[s.user_id] || "present",
        academic_year: activeYear,
        institution_id: institution!.id,
        marked_by: user!.id,
        duration_hours: 1,
      }));
      const updates = rows.filter((r) => existingIds.has(r.user_id));
      const inserts = rows.filter((r) => !existingIds.has(r.user_id));
      if (inserts.length) {
        const { error } = await supabase.from("attendance").insert(inserts);
        if (error) throw error;
      }
      for (const u of updates) {
        const { error } = await supabase
          .from("attendance")
          .update({ status: u.status, marked_by: u.marked_by })
          .eq("user_id", u.user_id)
          .eq("subject_id", u.subject_id!)
          .eq("date", u.date);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Appel enregistré");
      qc.invalidateQueries({ queryKey: ["prof-attendance"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Chargement…</p>;

  if (assignments.length === 0) {
    return (
      <Card className="glass-card border-border/50">
        <CardContent className="p-10 text-center text-muted-foreground text-sm">
          Aucun cours ne vous est affecté. Contactez l'administration.
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <div>
        <h1 className="text-xl sm:text-2xl font-heading font-bold flex items-center gap-2">
          <CalendarCheck className="w-6 h-6 text-primary" /> Faire l'appel
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Présence des élèves par cours et par date.</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Select value={assignId} onValueChange={setAssignId}>
          <SelectTrigger className="sm:w-80"><SelectValue placeholder="Classe · Matière…" /></SelectTrigger>
          <SelectContent>
            {assignments.map((a: any) => (
              <SelectItem key={a.id} value={a.id}>{a.classe?.nom} — {a.subject?.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="sm:w-48" />
        {assign && (
          <Button onClick={() => save.mutate()} disabled={save.isPending} className="sm:ml-auto gap-2">
            <Save className="w-4 h-4" /> Enregistrer l'appel
          </Button>
        )}
      </div>

      {!assign ? (
        <Card className="glass-card border-border/50">
          <CardContent className="p-12 text-center text-muted-foreground text-sm">
            Sélectionnez un cours pour faire l'appel.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            {(Object.keys(STATUS_UI) as Status[]).map((s) => (
              <Card key={s} className="glass-card border-border/60">
                <CardContent className="p-3 text-center">
                  <p className="text-xs text-muted-foreground">{STATUS_UI[s].label}s</p>
                  <p className="text-2xl font-bold">{counts[s] || 0}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="glass-card-elevated border-border/50 overflow-hidden">
            <CardContent className="p-0">
              <div className="flex items-center gap-2 px-4 py-3 border-b bg-secondary/30">
                <span className="text-sm font-semibold">{assign.classe?.nom} · {assign.subject?.name}</span>
                <Badge variant="outline" className="ml-auto text-[10px]">{students.length} élève(s)</Badge>
              </div>
              {students.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">Aucun élève dans cette classe.</div>
              ) : (
                <ul className="divide-y divide-border/40">
                  {students.map((s: any) => (
                    <li key={s.user_id} className="flex items-center gap-3 p-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{s.last_name} {s.first_name}</p>
                        <p className="text-[11px] text-muted-foreground">{s.student_number || "—"}</p>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        {(Object.keys(STATUS_UI) as Status[]).map((st) => {
                          const Icon = STATUS_UI[st].icon;
                          const active = (marks[s.user_id] || "present") === st;
                          return (
                            <button
                              key={st}
                              type="button"
                              onClick={() => setMarks((p) => ({ ...p, [s.user_id]: st }))}
                              className={`h-9 px-2.5 rounded-md border text-xs font-medium flex items-center gap-1 transition-all active:scale-95 ${
                                active ? STATUS_UI[st].cls : "border-border/60 text-muted-foreground hover:bg-secondary/50"
                              }`}
                            >
                              <Icon className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">{STATUS_UI[st].label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </motion.div>
  );
};

export default ProfessorSchoolAttendance;
