import { useCycle } from "@/hooks/useCycle";
import ProfessorSchoolAttendance from "@/components/professor/ProfessorSchoolAttendance";
import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useInstitution } from "@/hooks/useInstitution";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ClipboardCheck, UserCheck, UserX, Save, Calendar, Clock, MapPin, Lock, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { startOfWeek, addDays, format, isSameDay, isToday, isFuture } from "date-fns";
import { fr } from "date-fns/locale";

const DAY_LABELS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

// 🔥 FIX TIMEZONE GABON (UTC+1)
const toLibrevilleTime = (dateString: string) => {
  const date = new Date(dateString);
  const utc = date.getTime() + date.getTimezoneOffset() * 60000;
  return new Date(utc + 1 * 60 * 60 * 1000);
};

function ProfessorAttendanceUniversity() {
  const { user, profile } = useAuth();
  const { institution } = useInstitution();
  const { selectedYear } = useAcademicYear();
  const qc = useQueryClient();

  const [subjectId, setSubjectId] = useState<string>("");
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  // Map clé "uid_yyyy-MM-dd" -> "present" | "absent"
  const [statusMap, setStatusMap] = useState<Record<string, "present" | "absent" | "late">>({});

  const weekDays = useMemo(() => Array.from({ length: 6 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const today = new Date();

  // Normaliser un nom : minuscules, sans accents, espaces réduits
  const normalize = (s: string) =>
    (s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();

  const isAssignedToCurrentProfessor = (professorName?: string | null) => {
    const prof = normalize(professorName || "");
    if (!prof) return false;

    const first = normalize(profile?.first_name || "");
    const last = normalize(profile?.last_name || "");
    const full = normalize(`${profile?.first_name || ""} ${profile?.last_name || ""}`);
    const reversed = normalize(`${profile?.last_name || ""} ${profile?.first_name || ""}`);
    const tokens = prof.split(" ").filter(Boolean);

    if (full && (prof === full || prof.includes(full))) return true;
    if (reversed && (prof === reversed || prof.includes(reversed))) return true;
    if (first && last && tokens.includes(first) && tokens.includes(last)) return true;
    if (first && prof === first) return true;
    if (last && prof === last) return true;
    return false;
  };

  // 1. Matières assignées au prof par l'admin (matching par nom, tolérant, toutes années)
  const { data: profSubjects = [] } = useQuery({
    queryKey: ["prof-assigned-subjects", user?.id, institution?.id, profile?.first_name, profile?.last_name],
    queryFn: async () => {
      if (!profile?.first_name && !profile?.last_name) return [];
      const map = new Map<string, any>();

      // A. Toutes les matières de l'institution (toutes années) puis filtrage côté client par nom
      const { data: allSubjects } = await supabase
        .from("subjects")
        .select("id, name, filiere_id, level, academic_year, professor, filieres(name)")
        .eq("institution_id", institution!.id)
        .not("professor", "is", null);

      (allSubjects || []).forEach((s: any) => {
        if (isAssignedToCurrentProfessor(s.professor)) map.set(s.id, s);
      });

      // B. Fallback : matières via le planning (si user_id du prof est défini sur l'événement)
      const { data: scheduled } = await supabase
        .from("schedule_events")
        .select("subject_id, subjects(id, name, level, academic_year, filieres(name))")
        .eq("user_id", user!.id)
        .eq("institution_id", institution!.id)
        .not("subject_id", "is", null);
      (scheduled || []).forEach((row: any) => {
        if (row.subjects && !map.has(row.subject_id)) map.set(row.subject_id, row.subjects);
      });

      return Array.from(map.values());
    },
    enabled: !!user?.id && !!institution?.id && (!!profile?.first_name || !!profile?.last_name),
  });

  // Auto-sélection si une seule matière
  useEffect(() => {
    if (!subjectId && profSubjects.length === 1) setSubjectId(profSubjects[0].id);
  }, [profSubjects, subjectId]);

  const selectedSubject = useMemo(
    () => profSubjects.find((subject: any) => subject.id === subjectId),
    [profSubjects, subjectId]
  );

  // 2. Séances de la semaine pour cette matière (par subject_id — fonctionne même sans user_id sur l'événement)
  const { data: weekSessions = [] } = useQuery({
    queryKey: ["week-sessions", subjectId, weekStart.toISOString()],
    queryFn: async () => {
      const weekEnd = addDays(weekStart, 7);
      const { data, error } = await supabase
        .from("schedule_events")
        .select("*")
        .eq("subject_id", subjectId)
        .gte("start_time", weekStart.toISOString())
        .lt("start_time", weekEnd.toISOString());
      if (error) throw error;
      return data || [];
    },
    enabled: !!subjectId,
  });

  // 3. Étudiants pour cette matière
  // Stratégie: RPC sécurisé + fallback profils filière/niveau pour afficher les étudiants réels existants.
  const { data: students = [], isLoading: loadingStudents } = useQuery({
    queryKey: ["attendance-students", subjectId, selectedYear, institution?.id, selectedSubject?.filiere_id, selectedSubject?.level],
    queryFn: async () => {
      // a) Récupérer la matière pour connaître filiere_id, level, academic_year
      const { data: subj } = await supabase
        .from("subjects")
        .select("id, filiere_id, level, academic_year, institution_id")
        .eq("id", subjectId)
        .maybeSingle();

      // b) Tentative RPC pour l'année sélectionnée
      const tryRpc = async (year: string) => {
        const { data, error } = await supabase.rpc("get_active_students_for_subject", {
          _subject_id: subjectId,
          _academic_year: year,
        });
        if (error) throw error;
        return data || [];
      };

      const merged = new Map<string, any>();

      // RPC année sélectionnée
      try {
        const r1 = await tryRpc(selectedYear);
        r1.forEach((s: any) => s?.user_id && merged.set(s.user_id, s));
      } catch (error) {
        console.warn("RPC étudiants indisponible pour l'année sélectionnée", error);
      }
      // RPC année de la matière (si différente)
      if (subj?.academic_year && subj.academic_year !== selectedYear) {
        try {
          const r2 = await tryRpc(subj.academic_year);
          r2.forEach((s: any) => s?.user_id && !merged.has(s.user_id) && merged.set(s.user_id, s));
        } catch (error) {
          console.warn("RPC étudiants indisponible pour l'année de la matière", error);
        }
      }

      const subjectFiliereId = subj?.filiere_id || selectedSubject?.filiere_id;
      const subjectLevel = subj?.level || selectedSubject?.level;
      const subjectInstitutionId = subj?.institution_id || institution?.id;

      // Toujours fusionner : tous les étudiants de la filière+niveau (même sans student_years)
      if (subjectFiliereId && subjectLevel && subjectInstitutionId) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, first_name, last_name, student_number")
          .eq("institution_id", subjectInstitutionId)
          .eq("filiere_id", subjectFiliereId)
          .eq("level", subjectLevel)
          .order("last_name", { ascending: true });
        const ids = (profs || []).map((p: any) => p.user_id);
        if (ids.length > 0) {
          const { data: roles } = await supabase
            .from("user_roles")
            .select("user_id, role")
            .in("user_id", ids);
          const studentIds = new Set((roles || []).filter((r: any) => r.role === "user").map((r: any) => r.user_id));
          const canReadStudentRoles = studentIds.size > 0;
          (profs || []).forEach((p: any) => {
            const isStudent = canReadStudentRoles ? studentIds.has(p.user_id) : p.user_id !== user?.id;
            if (isStudent && !merged.has(p.user_id)) merged.set(p.user_id, p);
          });
        }
      }

      return Array.from(merged.values()).sort((a, b) =>
        (a.last_name || "").localeCompare(b.last_name || "")
      );
    },
    enabled: !!subjectId,
  });

  // 4. Présences déjà enregistrées cette semaine pour cette matière
  const { data: existingAttendance = [] } = useQuery({
    queryKey: ["week-attendance", subjectId, weekStart.toISOString()],
    queryFn: async () => {
      const weekEnd = addDays(weekStart, 7);
      const { data, error } = await supabase
        .from("attendance")
        .select("user_id, status, date, session_id")
        .eq("subject_id", subjectId)
        .gte("date", format(weekStart, "yyyy-MM-dd"))
        .lt("date", format(weekEnd, "yyyy-MM-dd"));
      if (error) throw error;
      return data || [];
    },
    enabled: !!subjectId,
  });

  // Hydrater statusMap avec les présences existantes
  useEffect(() => {
    const map: Record<string, "present" | "absent" | "late"> = {};
    existingAttendance.forEach((a: any) => {
      map[`${a.user_id}_${a.date}`] = a.status as "present" | "absent" | "late";
    });
    setStatusMap(map);
  }, [existingAttendance]);

  // Pour chaque jour : trouver la séance (s'il y en a une)
  const sessionByDay = useMemo(() => {
    const map: Record<string, any> = {};
    weekSessions.forEach((s: any) => {
      const dayKey = format(toLibrevilleTime(s.start_time), "yyyy-MM-dd");
      // Garder la 1re séance du jour (ou cumuler si plusieurs)
      if (!map[dayKey]) map[dayKey] = s;
    });
    return map;
  }, [weekSessions]);

  const toggleStatus = (userId: string, day: Date) => {
    if (!isToday(day)) return; // ⚠️ Seul le jour courant est éditable
    const dayKey = format(day, "yyyy-MM-dd");
    const key = `${userId}_${dayKey}`;
    setStatusMap(prev => {
      const copy = { ...prev };
      // Coché = présent, décoché = absent (vide à l'écran)
      if (copy[key] === "present") delete copy[key];
      else copy[key] = "present";
      return copy;
    });
  };

  const markAllForToday = (status: "present" | "absent") => {
    const dayKey = format(today, "yyyy-MM-dd");
    setStatusMap(prev => {
      const copy = { ...prev };
      students.forEach((s: any) => {
        const key = `${s.user_id}_${dayKey}`;
        if (status === "present") copy[key] = "present";
        else delete copy[key]; // décocher tout
      });
      return copy;
    });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const dayKey = format(today, "yyyy-MM-dd");
      const session = sessionByDay[dayKey];

      // Durée : depuis l'emploi du temps si planning, sinon 2h par défaut
      let durationHours = 2;
      let scheduleEventId: string | null = null;
      if (session) {
        const start = toLibrevilleTime(session.start_time);
        const end = toLibrevilleTime(session.end_time);
        durationHours = Math.max(0.5, (end.getTime() - start.getTime()) / (1000 * 60 * 60));
        scheduleEventId = session.id;
      }

      if (students.length === 0) throw new Error("Aucun étudiant actif à enregistrer");

      const { data: attSession, error: sessErr } = await supabase
        .from("attendance_sessions")
        .insert({
          subject_id: subjectId,
          professor_id: user!.id,
          institution_id: institution!.id,
          academic_year: selectedYear,
          session_date: dayKey,
          duration_hours: durationHours,
        })
        .select()
        .single();
      if (sessErr) throw sessErr;

      await supabase.from("attendance")
        .delete()
        .eq("subject_id", subjectId)
        .eq("date", dayKey);

      const records = students.map((student: any) => {
        const uid = student.user_id;
        const status = statusMap[`${uid}_${dayKey}`] || "absent";
        return {
          user_id: uid,
          subject_id: subjectId,
          schedule_event_id: scheduleEventId,
          session_id: attSession.id,
          status,
          marked_by: user!.id,
          date: dayKey,
          academic_year: selectedYear,
          duration_hours: durationHours,
        };
      });
      const { error } = await supabase.from("attendance").insert(records);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Présences enregistrées pour aujourd'hui");
      qc.invalidateQueries({ queryKey: ["week-attendance"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const todayKey = format(today, "yyyy-MM-dd");
  const presentToday = Object.entries(statusMap).filter(([k, v]) => k.endsWith(`_${todayKey}`) && v === "present").length;
  const absentToday = Object.entries(statusMap).filter(([k, v]) => k.endsWith(`_${todayKey}`) && v === "absent").length;
  const hasTodaySession = !!sessionByDay[todayKey];

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <ClipboardCheck className="w-8 h-8 text-primary" />
          Liste de présence
        </h1>
        <p className="text-muted-foreground mt-1">
          Effectuez l'appel pour vos cours — basé sur votre emploi du temps. Seul le jour actuel est modifiable.
        </p>
      </motion.div>

      <Card>
        <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Mes filières / matières assignées</label>
            {profSubjects.length === 0 ? (
              <div className="p-3 text-sm text-muted-foreground border rounded-md bg-muted/20">
                Aucune matière assignée. Demandez à l'admin de vous attribuer une matière.
              </div>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                {Object.entries(
                  profSubjects.reduce((acc: Record<string, any[]>, s: any) => {
                    const key = `${s.filieres?.name || "—"} · ${s.level || ""}`;
                    (acc[key] ||= []).push(s);
                    return acc;
                  }, {})
                ).map(([groupName, subs]) => (
                  <div key={groupName}>
                    <p className="text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">{groupName}</p>
                    <div className="flex flex-wrap gap-2">
                      {(subs as any[]).map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setSubjectId(s.id)}
                          className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                            subjectId === s.id
                              ? "bg-primary text-primary-foreground border-primary shadow"
                              : "bg-background hover:bg-muted border-border"
                          }`}
                        >
                          {s.name}
                          {s.academic_year ? <span className="opacity-70 ml-1">({s.academic_year})</span> : null}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Semaine</label>
            <div className="flex items-center gap-2">
              <Button size="icon" variant="outline" onClick={() => setWeekStart(addDays(weekStart, -7))}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="flex-1 text-center text-sm font-medium px-3 py-2 border rounded-md bg-muted/30">
                {format(weekStart, "d MMM", { locale: fr })} – {format(addDays(weekStart, 5), "d MMM yyyy", { locale: fr })}
              </div>
              <Button size="icon" variant="outline" onClick={() => setWeekStart(addDays(weekStart, 7))}>
                <ChevronRight className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}>
                Aujourd'hui
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {subjectId && (
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Tableau de présence ({students.length} étudiant{students.length > 1 ? "s" : ""})
              </CardTitle>
              <div className="flex flex-wrap gap-2 items-center">
                <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-500/30">
                  <UserCheck className="w-3 h-3 mr-1" /> {presentToday} présents
                </Badge>
                <Badge variant="outline" className="bg-red-500/10 text-red-700 border-red-500/30">
                  <UserX className="w-3 h-3 mr-1" /> {absentToday} absents
                </Badge>
                <Button size="sm" variant="outline" onClick={() => markAllForToday("present")}>Tout cocher</Button>
                <Button size="sm" variant="outline" onClick={() => markAllForToday("absent")}>Tout décocher</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loadingStudents ? (
              <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-muted/30 animate-pulse rounded" />)}</div>
            ) : students.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <UserX className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Aucun étudiant actif inscrit dans cette matière pour l'année {selectedYear}.</p>
                <p className="text-xs mt-2">Vérifiez avec l'administrateur que les étudiants sont bien marqués comme « actifs ».</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 bg-background z-10 min-w-[200px]">Étudiant</TableHead>
                      {weekDays.map((day, i) => {
                        const dayKey = format(day, "yyyy-MM-dd");
                        const session = sessionByDay[dayKey];
                        const isCurrent = isToday(day);
                        const isPastDay = !isCurrent && !isFuture(day);
                        return (
                          <TableHead
                            key={i}
                            className={`text-center min-w-[120px] ${isCurrent ? "bg-primary/10" : ""} ${isPastDay ? "bg-muted/40 text-muted-foreground" : ""}`}
                          >
                            <div className="flex flex-col items-center gap-1">
                              <span className={`font-semibold ${isCurrent ? "text-primary" : ""}`}>
                                {DAY_LABELS[i]}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {format(day, "d MMM", { locale: fr })}
                              </span>
                              {session ? (
                                <Badge variant="secondary" className="text-[10px] gap-1">
                                  <Clock className="w-3 h-3" />
                                  {format(toLibrevilleTime(session.start_time), "HH:mm")}–{format(toLibrevilleTime(session.end_time), "HH:mm")}
                                </Badge>
                              ) : (
                                <span className="text-[10px] text-muted-foreground italic">Pas de cours</span>
                              )}
                              {isPastDay && session && (
                                <Badge variant="outline" className="text-[9px] gap-1 border-muted-foreground/30">
                                  <Lock className="w-3 h-3" /> Clôturé
                                </Badge>
                              )}
                              {isCurrent && session && (
                                <Badge className="text-[9px] bg-primary/20 text-primary border-0">Aujourd'hui</Badge>
                              )}
                            </div>
                          </TableHead>
                        );
                      })}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.map((s: any, idx: number) => (
                      <motion.tr
                        key={s.user_id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: idx * 0.02 }}
                        className="border-b hover:bg-muted/30"
                      >
                        <TableCell className="sticky left-0 bg-background font-medium">
                          <div>
                            <p className="text-sm">{s.last_name} {s.first_name}</p>
                            <p className="text-xs text-muted-foreground">{s.student_number}</p>
                          </div>
                        </TableCell>
                        {weekDays.map((day, i) => {
                          const dayKey = format(day, "yyyy-MM-dd");
                          const session = sessionByDay[dayKey];
                          const isCurrent = isToday(day);
                          const isPastDay = !isCurrent && !isFuture(day);
                          const status = statusMap[`${s.user_id}_${dayKey}`];
                          const editable = isCurrent && !!session;

                          return (
                            <TableCell
                              key={i}
                              className={`text-center ${isCurrent ? "bg-primary/5" : ""} ${isPastDay ? "bg-muted/30" : ""}`}
                            >
                              {!session ? (
                                <span className="text-muted-foreground/50 text-xs">—</span>
                              ) : (
                                <button
                                  type="button"
                                  disabled={!editable}
                                  onClick={() => toggleStatus(s.user_id, day)}
                                  className={`
                                    w-7 h-7 rounded-md border-2 transition-all flex items-center justify-center mx-auto
                                    ${status === "present" ? "bg-green-500 border-green-600 text-primary-foreground" : status === "absent" ? "bg-red-500/20 border-red-500/40" : "bg-background border-muted-foreground/40"}
                                    ${editable ? "hover:scale-110 cursor-pointer hover:border-primary" : "opacity-60 cursor-not-allowed"}
                                  `}
                                  title={editable ? "Cocher = Présent · Vide = Absent" : isPastDay ? "Jour clôturé — non modifiable" : "Disponible le jour même"}
                                >
                                  {status === "present" && <UserCheck className="w-4 h-4" />}
                                  {status === "absent" && <UserX className="w-3 h-3 text-red-700" />}
                                </button>
                              )}
                            </TableCell>
                          );
                        })}
                      </motion.tr>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {students.length > 0 && (
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                className="w-full mt-4"
                size="lg"
              >
                <Save className="w-4 h-4 mr-2" />
                {saveMutation.isPending ? "Enregistrement..." : `Valider l'appel du ${format(today, "EEEE d MMMM", { locale: fr })}`}
              </Button>
            )}
            {students.length > 0 && !hasTodaySession && (
              <p className="mt-2 text-xs text-center text-muted-foreground">
                ℹ️ Aucune séance planifiée aujourd'hui — durée par défaut : 2h
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

const ProfessorAttendancePage = () => {
  const { hasUniversite, isLoading } = useCycle();
  if (isLoading) return null;
  if (!hasUniversite) return <ProfessorSchoolAttendance />;
  return <ProfessorAttendanceUniversity />;
};

export default ProfessorAttendancePage;
