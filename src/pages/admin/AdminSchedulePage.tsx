import {useCampus} from "@/hooks/useCampus";
import { motion } from "framer-motion";
import { Calendar, Plus, Trash2, ChevronLeft, ChevronRight, Edit, AlertTriangle, Repeat, Layers } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { useInstitution } from "@/hooks/useInstitution";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import { AcademicYearSelector } from "@/components/AcademicYearSelector";
import { useState } from "react";
import { toast } from "sonner";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, addDays, eachDayOfInterval, getDay, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import ScheduleWeeklyGrid from "@/components/schedule/ScheduleWeeklyGrid";
import {scheduleTimestamp,scheduleInputTimestamp,scheduleWallDate,clockLabel,scheduleParts,intersectsScheduleRange} from '@/lib/scheduleLayout';
import ScheduleEventDetailDialog from "@/components/schedule/ScheduleEventDetailDialog";
import ExamPlanningView from "@/components/admin/ExamPlanningView";
import ScheduleByClassView from "@/components/schedule/ScheduleByClassView";
import { useCycle } from "@/hooks/useCycle";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

const DAY_NAMES = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const SELECTABLE_DAYS = [
  { label: "Lundi", value: 1 },
  { label: "Mardi", value: 2 },
  { label: "Mercredi", value: 3 },
  { label: "Jeudi", value: 4 },
  { label: "Vendredi", value: 5 },
  { label: "Samedi", value: 6 },
];

interface CreateForm {
  title: string;
  filiere_id: string;
  level: string;
  classe_id: string;
  subject: string;
  startDate: string;
  endDate: string;
  weekCount: string;
  startTime: string;
  endTime: string;
  location: string;
  classroom_id: string;
  type: string;
  exam_kind: string;
  days: number[];
  useWeekCount: boolean;
  singleBlock: boolean;
  blockStart: string;
  blockEnd: string;
}

const defaultForm: CreateForm = {
  title: "", filiere_id: "", level: "L1", classe_id: "", subject: "", startDate: "", endDate: "",
  weekCount: "1", startTime: "08:00", endTime: "10:00", location: "", classroom_id: "", type: "cours",
  exam_kind: "",
  days: [1], useWeekCount: true,
  singleBlock: false, blockStart: "", blockEnd: "",
};

const AdminSchedulePage = () => {
  const { getLevels, institution: instData } = useInstitution();
  const { profile } = useAuth();
  const { selectedYear, isViewingHistory } = useAcademicYear();
  const instId = profile?.institution_id;
  const {campusId} = useCampus();
  const LEVELS = getLevels();
  const qc = useQueryClient();
  const { hasCollege, hasLycee } = useCycle();
  const schoolMode = hasCollege || hasLycee;
  const [open, setOpen] = useState(false);
  const [filterFiliere, setFilterFiliere] = useState("all");
  const [filterLevel, setFilterLevel] = useState("all");
  const [filterClass,setFilterClass]=useState('all');
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [form, setForm] = useState<CreateForm>({ ...defaultForm });
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [deleteSeriesOpen, setDeleteSeriesOpen] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("planning");

  // Année scolaire — bornes annuelles (ex. "2025-2026" → 01/09/2025 → 30/06/2026)
  const yearBounds = (() => {
    const m = (selectedYear || "").match(/(\d{4}).*(\d{4})/);
    const y1 = m ? parseInt(m[1]) : new Date().getFullYear();
    const y2 = m ? parseInt(m[2]) : y1 + 1;
    return { start: `${y1}-09-01`, end: `${y2}-06-30` };
  })();

  // Ouverture du dialog en mode école : force la planification annuelle
  const openCreateDialog = () => {
    if (schoolMode) {
      setForm({
        ...defaultForm,
        singleBlock: false,
        useWeekCount: false,
        startDate: yearBounds.start,
        endDate: yearBounds.end,
        type: "cours",
      });
    } else if (activeTab === "exams") {
      setForm({ ...defaultForm, type: "exam", exam_kind: "final", singleBlock: true, title: "Examen final" });
    } else {
      setForm({ ...defaultForm });
    }
    setOpen(true);
  };


  const handleScheduleExam = (subject: any, kind: "final" | "rattrapage") => {
    setForm({
      ...defaultForm,
      title: `${kind === "rattrapage" ? "Rattrapage" : "Examen final"} — ${subject.name}`,
      filiere_id: subject.filiere_id || "",
      level: subject.level || "L1",
      subject: subject.id,
      type: kind === "rattrapage" ? "rattrapage" : "exam",
      exam_kind: kind,
      singleBlock: true,
    });
    setOpen(true);
  };

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 6) });

  const { data: filieres = [] } = useQuery({
    queryKey: ["admin-filieres", instId, campusId],
    queryFn: async () => {
      let q = supabase.from("filieres").select("*").order("name");
      if (instId) q = q.eq("institution_id", instId);
      if (campusId) q = q.or(`campus_id.is.null,campus_id.eq.${campusId}`);
      const { data } = await q;
      return data || [];
    },
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ["admin-subjects", instId, campusId],
    queryFn: async () => {
      let q = supabase.from("subjects").select("id, name, filiere_id, level, professor");
      if (instId) q = q.eq("institution_id", instId);
      if (campusId) q = q.or(`campus_id.is.null,campus_id.eq.${campusId}`);
      const { data } = await q;
      return data || [];
    },
  });

  const { data: events = [] } = useQuery({
    queryKey: ["admin-all-schedule", instId, selectedYear, campusId],
    queryFn: async () => {
      let q = supabase.from("schedule_events").select("*, subjects(name, professor), filieres(name), classrooms(id, name, capacity)").order("start_time", { ascending: true });
      if (instId) q = q.eq("institution_id", instId);
      if (campusId) q = q.eq("campus_id", campusId);
      q = q.eq("academic_year", selectedYear);
      const { data } = await q;
      return data || [];
    },
  });

  const { data: subjectGradeStats = {} } = useQuery({
    queryKey: ["admin-schedule-grade-stats", instId, selectedYear, campusId],
    queryFn: async () => {
      let q = supabase.from("grades").select("subject_id, cc_grade, exam_grade").eq("academic_year", selectedYear);
      if (instId) q = q.eq("institution_id", instId);
      if (campusId) q = q.eq("campus_id", campusId);
      const { data } = await q;
      const map: Record<string, { hasCC: boolean; hasExam: boolean }> = {};
      (data || []).forEach((g: any) => {
        if (!g.subject_id) return;
        const s = map[g.subject_id] || { hasCC: false, hasExam: false };
        if (g.cc_grade !== null && g.cc_grade !== undefined) s.hasCC = true;
        if (g.exam_grade !== null && g.exam_grade !== undefined) s.hasExam = true;
        map[g.subject_id] = s;
      });
      return map;
    },
    enabled: !!instId,
  });

  const { data: classrooms = [] } = useQuery({
    queryKey: ["admin-classrooms-for-schedule", instId, campusId],
    queryFn: async () => {
      let q = supabase.from("classrooms").select("id, name, capacity, building, is_available").order("name");
      if (instId) q = q.eq("institution_id", instId);
      if (campusId) q = q.or(`campus_id.is.null,campus_id.eq.${campusId}`);
      const { data } = await q;
      return (data || []).filter((c: any) => c.is_available !== false);
    },
    enabled: !!instId,
  });

  // School classes (Collège/Lycée)
  const { data: schoolClasses = [] } = useQuery({
    queryKey: ["admin-schedule-classes", instId, campusId,selectedYear],
    enabled: !!instId,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("classes")
        .select("id, cycle, niveau, serie, nom,campus_id")
        .eq("institution_id", instId)
        .eq('academic_year',selectedYear)
        .order("niveau").order("serie").order("nom");
      return (data || []).filter((c:any)=>!campusId||c.campus_id===campusId);
    },
  });

  // Subject ↔ class links
  const { data: subjectClassLinks = [] } = useQuery({
    queryKey: ["admin-schedule-subject-classes", instId, campusId],
    enabled: !!instId && schoolMode,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("subject_classes")
        .select("subject_id, classe_id");
      return data || [];
    },
  });

  // Student count per (filiere_id, level) for capacity check
  const { data: studentsByClass = {} } = useQuery({
    queryKey: ["admin-students-by-class", instId, campusId],
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "user");
      const ids = (roles || []).map((r: any) => r.user_id);
      if (!ids.length) return {};
      let q = supabase.from("profiles").select("filiere_id, level").in("user_id", ids);
      if (instId) q = q.eq("institution_id", instId);
      if (campusId) q = q.eq("campus_id", campusId);
      const { data } = await q;
      const map: Record<string, number> = {};
      (data || []).forEach((p: any) => {
        if (!p.filiere_id || !p.level) return;
        const k = `${p.filiere_id}::${p.level}`;
        map[k] = (map[k] || 0) + 1;
      });
      return map;
    },
    enabled: !!instId,
  });

  useRealtimeSubscription("schedule_events", [["admin-all-schedule"]]);

  const filteredEvents = events.filter((e: any) => {
    const matchFiliere = filterFiliere === "all" || e.filiere_id === filterFiliere;
    const matchLevel = filterLevel === "all" || e.level === filterLevel;
    const matchWeek = intersectsScheduleRange(e,format(weekStart,'yyyy-MM-dd'),format(addDays(weekStart,7),'yyyy-MM-dd'));
    const matchClass=filterClass==='all'||(filterClass==='unassigned'?!e.classe_id:e.classe_id===filterClass);
    return matchFiliere && matchLevel && matchWeek && matchClass;
  });

  const selectedClasse: any = schoolClasses.find((c: any) => c.id === form.classe_id);

  const formSubjects = schoolMode
    ? (() => {
        if (!form.classe_id) return [];
        const linkedIds = new Set(
          subjectClassLinks.filter((l: any) => l.classe_id === form.classe_id).map((l: any) => l.subject_id)
        );
        const linked = subjects.filter((s: any) => linkedIds.has(s.id));
        if (linked.length > 0) return linked;
        // fallback : matières du même niveau
        const niveau = (selectedClasse?.niveau || "").toLowerCase();
        return subjects.filter((s: any) => (s.level || "").toLowerCase() === niveau);
      })()
    : (form.filiere_id
        ? subjects.filter((s: any) => s.filiere_id === form.filiere_id && s.level === form.level)
        : subjects);

  // Generate all dates for the recurrence (only for recurrent mode)
  const generateOccurrences = (): Date[] => {
    if (form.singleBlock) return [];
    if (!form.startDate || form.days.length === 0) return [];
    const start = parseISO(form.startDate);
    let end: Date;
    if (form.useWeekCount) {
      end = addDays(addWeeks(start, parseInt(form.weekCount) || 1), -1);
    } else {
      if (!form.endDate) return [];
      end = parseISO(form.endDate);
    }
    if (end < start) return [];

    const allDates: Date[] = [];
    const interval = eachDayOfInterval({ start, end });
    interval.forEach(d => {
      const dow = getDay(d);
      if (form.days.includes(dow)) allDates.push(d);
    });
    return allDates;
  };

  // Check conflicts (room occupation, prof, class) + capacity warning
  const checkConflicts = (dates: Date[]): string[] => {
    const errors: string[] = [];
    const [sh, sm] = form.startTime.split(":").map(Number);
    const [eh, em] = form.endTime.split(":").map(Number);

    const selectedRoom = classrooms.find((c: any) => c.id === form.classroom_id);

    // Capacity check (once, not per date)
    if (selectedRoom && form.filiere_id && form.level) {
      const nbStudents = studentsByClass[`${form.filiere_id}::${form.level}`] || 0;
      const cap = Number(selectedRoom.capacity) || 0;
      if (cap > 0 && nbStudents > cap) {
        errors.push(`⚠️ La salle "${selectedRoom.name}" a une capacité de ${cap} places, mais la classe compte ${nbStudents} étudiants. Choisissez une salle plus grande.`);
      }
    }

    dates.forEach(d => {
      const newStart = scheduleTimestamp(format(d,'yyyy-MM-dd'),form.startTime);
      const newEnd = scheduleTimestamp(format(d,'yyyy-MM-dd'),form.endTime);

      events.forEach((evt: any) => {
        const evtStart = new Date(evt.start_time);
        const evtEnd = new Date(evt.end_time);
        if (newStart < evtEnd && newEnd > evtStart) {
          // Same classroom (by id — strong) OR fallback same location text
          if (form.classroom_id && evt.classroom_id && form.classroom_id === evt.classroom_id) {
            errors.push(`Conflit salle "${selectedRoom?.name || ""}" le ${format(d, "EEE dd/MM HH:mm", { locale: fr })} — déjà occupée par "${evt.title}"`);
          } else if (!form.classroom_id && form.location && evt.location && form.location === evt.location) {
            errors.push(`Conflit lieu "${form.location}" le ${format(d, "EEE dd/MM", { locale: fr })} (${evt.title})`);
          }
          // Same prof
          const subj = subjects.find((s: any) => s.id === form.subject);
          if (subj?.professor && evt.subjects?.professor === subj.professor) {
            errors.push(`Conflit prof "${subj.professor}" le ${format(d, "EEE dd/MM", { locale: fr })} (${evt.title})`);
          }
          // Same class (filiere+level)
          if (form.filiere_id === evt.filiere_id && form.level === evt.level) {
            errors.push(`Conflit classe le ${format(d, "EEE dd/MM", { locale: fr })} (${evt.title})`);
          }
        }
      });
    });
    return [...new Set(errors)];
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const subj = subjects.find((s: any) => s.id === form.subject);
      const selectedRoom = classrooms.find((c: any) => c.id === form.classroom_id);

      // === SINGLE BLOCK MODE (exam, multi-day block, etc.) ===
      if (form.singleBlock) {
        if (!form.blockStart || !form.blockEnd) throw new Error("Renseignez la date/heure de début et de fin.");
        const startDt = scheduleInputTimestamp(form.blockStart);
        const endDt = scheduleInputTimestamp(form.blockEnd);
        if (isNaN(startDt.getTime()) || isNaN(endDt.getTime())) throw new Error("Dates invalides.");
        if (endDt <= startDt) throw new Error("La fin doit être après le début.");

        // Conflict check (single interval)
        const errs: string[] = [];
        events.forEach((evt: any) => {
          const es = new Date(evt.start_time);
          const ee = new Date(evt.end_time);
          if (startDt < ee && endDt > es) {
            if (form.classroom_id && evt.classroom_id === form.classroom_id) {
              errs.push(`Conflit salle avec "${evt.title}" (${format(es, "dd/MM HH:mm", { locale: fr })})`);
            }
            if (subj?.professor && evt.subjects?.professor === subj.professor) {
              errs.push(`Conflit prof "${subj.professor}" avec "${evt.title}"`);
            }
            if (form.filiere_id === evt.filiere_id && form.level === evt.level) {
              errs.push(`Conflit classe avec "${evt.title}"`);
            }
          }
        });
        const unique = [...new Set(errs)];
        if (unique.length) throw new Error("Conflits :\n" + unique.join("\n"));

        const row = {
          title: form.title || subj?.name || "Séance",
          filiere_id: form.filiere_id || null,
          level: form.level,
          user_id: null,
          subject_id: form.subject || null,
          start_time: startDt.toISOString(),
          end_time: endDt.toISOString(),
          classroom_id: form.classroom_id || null,
          location: selectedRoom?.name || form.location || null,
          event_type: form.type,
          exam_kind: (form.type === "exam" || form.type === "rattrapage")
            ? (form.exam_kind || (form.type === "rattrapage" ? "rattrapage" : "final"))
            : null,
          institution_id: instId || null, campus_id: campusId,
          classe_id: form.classe_id || null,
          recurrence_group_id: null,
          academic_year: selectedYear,
        };
        const { error } = await supabase.from("schedule_events").insert([row as any]);
        if (error) throw error;
        return { count: 1 };
      }

      // === RECURRENT MODE ===
      const dates = generateOccurrences();
      if (dates.length === 0) throw new Error("Aucune séance à créer. Vérifiez les dates et jours sélectionnés.");

      const [sh, sm] = form.startTime.split(":").map(Number);
      const [eh, em] = form.endTime.split(":").map(Number);

      if (eh * 60 + em <= sh * 60 + sm) throw new Error("L'heure de fin doit être après l'heure de début.");

      const errs = checkConflicts(dates);
      if (errs.length > 0) throw new Error("Conflits détectés :\n" + errs.join("\n"));

      const groupId = crypto.randomUUID();

      const rows = dates.map(d => {
        const startDt = scheduleTimestamp(format(d,'yyyy-MM-dd'),form.startTime);
        const endDt = scheduleTimestamp(format(d,'yyyy-MM-dd'),form.endTime);
        return {
          title: form.title || subj?.name || "Cours",
          filiere_id: form.filiere_id || null,
          level: form.level,
          user_id: null,
          subject_id: form.subject || null,
          start_time: startDt.toISOString(),
          end_time: endDt.toISOString(),
          classroom_id: form.classroom_id || null,
          location: selectedRoom?.name || form.location || null,
          event_type: form.type,
          exam_kind: (form.type === "exam" || form.type === "rattrapage")
            ? (form.exam_kind || (form.type === "rattrapage" ? "rattrapage" : "final"))
            : null,
          institution_id: instId || null, campus_id: campusId,
          classe_id: form.classe_id || null,
          recurrence_group_id: dates.length > 1 ? groupId : null,
          academic_year: selectedYear,
        };
      });

      const { error } = await supabase.from("schedule_events").insert(rows as any);
      if (error) throw error;
      return { count: rows.length };
    },
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ["admin-all-schedule", campusId] });
      toast.success(`${res?.count || 1} séance(s) créée(s) avec succès`);
      setOpen(false);
      setForm({ ...defaultForm });
      setConflicts([]);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("schedule_events").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-all-schedule", campusId] });
      toast.success("Séance supprimée");
    },
  });

  const deleteSeriesMutation = useMutation({
    mutationFn: async (groupId: string) => {
      const { error } = await supabase.from("schedule_events").delete().eq("recurrence_group_id", groupId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-all-schedule", campusId] });
      setDeleteSeriesOpen(null);
      toast.success("Série supprimée");
    },
  });

  const handlePreview = () => {
    const dates = generateOccurrences();
    if (dates.length === 0) {
      setConflicts(["Aucune séance générée. Vérifiez dates et jours."]);
      return;
    }
    const errs = checkConflicts(dates);
    setConflicts(errs.length > 0 ? errs : [`✅ ${dates.length} séance(s) sans conflit`]);
  };

  const toggleDay = (day: number) => {
    setForm(f => ({
      ...f,
      days: f.days.includes(day) ? f.days.filter(d => d !== day) : [...f.days, day],
    }));
  };

  const occurrences = generateOccurrences();

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <ScheduleEventDetailDialog
        event={selectedEvent}
        open={!!selectedEvent}
        onOpenChange={(o) => !o && setSelectedEvent(null)}
        allEvents={events}
      />

      {/* Delete series dialog */}
      <Dialog open={!!deleteSeriesOpen} onOpenChange={(o) => !o && setDeleteSeriesOpen(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Supprimer la série ?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Cette action supprimera toutes les séances liées à cette série. Cette action est irréversible.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteSeriesOpen(null)}>Annuler</Button>
            <Button variant="destructive" onClick={() => deleteSeriesMutation.mutate(deleteSeriesOpen)} disabled={deleteSeriesMutation.isPending}>
              {deleteSeriesMutation.isPending ? "Suppression..." : "Supprimer la série"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground flex items-center gap-2">
            <Calendar className="w-7 h-7 text-accent" /> Planning avancé
          </h1>
          <p className="text-muted-foreground mt-1">
            {selectedYear} {isViewingHistory && <span className="text-warning font-medium">(historique — lecture seule)</span>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <AcademicYearSelector />
          {!isViewingHistory && (
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setConflicts([]); setForm({ ...defaultForm }); } }}>
          <Button
            className="gradient-gold text-accent-foreground gap-2"
            onClick={openCreateDialog}
          >
            <Plus className="w-4 h-4" />
            {(!schoolMode && activeTab === "exams") ? "Programmer un examen" : "Créer un cours"}
          </Button>

          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Repeat className="w-5 h-5" />
                {form.singleBlock
                  ? (form.type === "exam" ? "Programmer un examen" : form.type === "rattrapage" ? "Programmer un rattrapage" : "Nouvelle séance (bloc)")
                  : "Nouveau cours récurrent"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {schoolMode ? (
                /* Classe (Collège / Lycée) — remplace Filière + Niveau */
                <div>
                  <label className="text-xs font-semibold text-foreground mb-1 block">Classe *</label>
                  <Select
                    value={form.classe_id}
                    onValueChange={(v) => {
                      const c = schoolClasses.find((x: any) => x.id === v);
                      setForm({
                        ...form,
                        classe_id: v,
                        level: c?.niveau || "",
                        filiere_id: "",
                        subject: "",
                      });
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Sélectionner une classe…" /></SelectTrigger>
                    <SelectContent>
                      {schoolClasses.length === 0 && (
                        <div className="p-2 text-xs text-muted-foreground">Aucune classe créée</div>
                      )}
                      {schoolClasses.map((c: any) => {
                        const isLycee = (c.cycle || "").toLowerCase() === "lycee";
                        return (
                          <SelectItem key={c.id} value={c.id}>
                            {c.niveau}{isLycee && c.serie ? ` ${c.serie}` : ""} — {c.nom}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  {selectedClasse && (
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Cycle : {selectedClasse.cycle === "lycee" ? "Lycée" : "Collège"}
                      {selectedClasse.cycle === "lycee" && selectedClasse.serie ? ` · Série ${selectedClasse.serie}` : ""}
                    </p>
                  )}
                </div>
              ) : (
                /* Filière & Level (Université) */
                <div className="grid grid-cols-2 gap-3">
                  <Select value={form.filiere_id} onValueChange={(v) => setForm({ ...form, filiere_id: v, subject: "" })}>
                    <SelectTrigger><SelectValue placeholder="Filière *" /></SelectTrigger>
                    <SelectContent>{filieres.map((f: any) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={form.level} onValueChange={(v) => setForm({ ...form, level: v, subject: "" })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{LEVELS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}

              {/* Subject */}
              <Select value={form.subject} onValueChange={(v) => {
                const subj = subjects.find((s: any) => s.id === v);
                const isExamMode = form.type === "exam" || form.type === "rattrapage";
                let nextType = form.type;
                let nextKind = form.exam_kind;
                let nextTitle = subj?.name || form.title;
                if (isExamMode && v) {
                  const hasFinal = events.some((e: any) =>
                    e.subject_id === v &&
                    (e.exam_kind === "final" || (e.event_type === "exam" && !e.exam_kind))
                  );
                  if (hasFinal) {
                    nextType = "rattrapage";
                    nextKind = "rattrapage";
                    nextTitle = `Rattrapage — ${subj?.name || ""}`.trim();
                  } else {
                    nextType = "exam";
                    nextKind = "final";
                    nextTitle = `Examen final — ${subj?.name || ""}`.trim();
                  }
                }
                setForm({ ...form, subject: v, type: nextType, exam_kind: nextKind, title: nextTitle });
              }}>
                <SelectTrigger><SelectValue placeholder="Matière" /></SelectTrigger>
                <SelectContent>{formSubjects.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name} {s.professor ? `(${s.professor})` : ""}</SelectItem>)}</SelectContent>
              </Select>

              {(form.type === "exam" || form.type === "rattrapage") && form.subject && (
                <div className={`text-xs rounded-md px-3 py-2 border ${form.exam_kind === "rattrapage" ? "bg-destructive/10 border-destructive/30 text-destructive" : "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400"}`}>
                  {form.exam_kind === "rattrapage"
                    ? "🔁 Un examen final est déjà programmé pour cette matière → sera programmé en RATTRAPAGE."
                    : "📝 Aucun examen final détecté → sera programmé en EXAMEN FINAL."}
                </div>
              )}

              <Input placeholder="Titre (auto-rempli si matière)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />

              {/* Mode toggle: bloc unique (durée libre, multi-jours) vs récurrent — masqué en Collège/Lycée (planning annuel) */}
              {!schoolMode && (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-secondary/20 p-2.5">
                  <div>
                    <p className="text-xs font-semibold text-foreground">
                      {form.singleBlock ? "Bloc unique (durée personnalisée)" : "Récurrent (plusieurs semaines)"}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {form.singleBlock
                        ? "Une seule séance, peut s'étaler sur plusieurs jours."
                        : "Génère plusieurs séances aux jours et heures choisis."}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => setForm(f => ({ ...f, singleBlock: !f.singleBlock }))}
                  >
                    {form.singleBlock ? "Passer en récurrent" : "Passer en bloc unique"}
                  </Button>
                </div>
              )}

              {schoolMode && (
                <div className="rounded-lg border border-accent/30 bg-accent/5 p-2.5">
                  <p className="text-xs font-semibold text-foreground">Planning annuel</p>
                  <p className="text-[10px] text-muted-foreground">
                    Le cours sera répété toutes les semaines jusqu'à la fin de l'année scolaire ({selectedYear}). Il sera réinitialisé automatiquement à la clôture du 3<sup>ème</sup> trimestre.
                  </p>
                </div>
              )}


              {form.singleBlock ? (
                /* SINGLE BLOCK — datetime range (supports multi-day) */
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] text-muted-foreground">Début (date & heure) *</label>
                    <Input
                      type="datetime-local"
                      value={form.blockStart}
                      onChange={(e) => setForm({ ...form, blockStart: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-muted-foreground">Fin (date & heure) *</label>
                    <Input
                      type="datetime-local"
                      value={form.blockEnd}
                      onChange={(e) => setForm({ ...form, blockEnd: e.target.value })}
                    />
                  </div>
                  {form.blockStart && form.blockEnd && (() => {
                    const s = scheduleInputTimestamp(form.blockStart); const e = scheduleInputTimestamp(form.blockEnd);
                    if (isNaN(s.getTime()) || isNaN(e.getTime()) || e <= s) return null;
                    const mins = Math.round((e.getTime() - s.getTime()) / 60000);
                    const days = Math.floor(mins / 1440);
                    const hours = Math.floor((mins % 1440) / 60);
                    const m = mins % 60;
                    return (
                      <p className="sm:col-span-2 text-[11px] text-muted-foreground">
                        Durée totale : {days > 0 ? `${days}j ` : ""}{hours}h{m > 0 ? ` ${m}min` : ""}
                      </p>
                    );
                  })()}
                </div>
              ) : (
                <>
                  {/* Days selection */}
                  <div>
                    <label className="text-xs font-semibold text-foreground mb-2 block">Jours de cours *</label>
                    <div className="flex flex-wrap gap-2">
                      {SELECTABLE_DAYS.map(d => (
                        <label key={d.value} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm cursor-pointer transition-all ${form.days.includes(d.value) ? "bg-accent/15 border-accent text-accent font-medium" : "bg-secondary/30 border-border text-muted-foreground hover:bg-secondary/50"}`}>
                          <Checkbox checked={form.days.includes(d.value)} onCheckedChange={() => toggleDay(d.value)} />
                          {d.label}
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Period — masqué en Collège/Lycée (annuel automatique) */}
                  {!schoolMode && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <label className="text-xs font-semibold text-foreground">Période</label>
                        <Button type="button" variant="ghost" size="sm" className="text-xs h-6" onClick={() => setForm(f => ({ ...f, useWeekCount: !f.useWeekCount }))}>
                          {form.useWeekCount ? "Utiliser dates fin" : "Utiliser nb semaines"}
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] text-muted-foreground">Date de début *</label>
                          <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
                        </div>
                        {form.useWeekCount ? (
                          <div className="space-y-1">
                            <label className="text-[10px] text-muted-foreground">Durée (semaines)</label>
                            <Select value={form.weekCount} onValueChange={(v) => setForm({ ...form, weekCount: v })}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {[1, 2, 3, 4, 6, 8, 12, 16].map(n => <SelectItem key={n} value={String(n)}>{n} semaine{n > 1 ? "s" : ""}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <label className="text-[10px] text-muted-foreground">Date de fin *</label>
                            <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
                          </div>
                        )}
                      </div>
                    </div>
                  )}


                  {/* Hours */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] text-muted-foreground">Heure début *</label>
                      <Input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-muted-foreground">Heure fin *</label>
                      <Input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
                    </div>
                  </div>
                </>
              )}

              {/* Classroom & Type */}
              <div className="grid grid-cols-2 gap-3">
                <Select value={form.classroom_id || "none"} onValueChange={(v) => setForm({ ...form, classroom_id: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Salle" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Aucune salle —</SelectItem>
                    {classrooms.map((c: any) => {
                      const nb = (form.filiere_id && form.level) ? (studentsByClass[`${form.filiere_id}::${form.level}`] || 0) : 0;
                      const cap = Number(c.capacity) || 0;
                      const tooSmall = cap > 0 && nb > 0 && nb > cap;
                      // 🔥 Détecte si la salle est occupée sur le créneau choisi
                      const dates = generateOccurrences();
                      const [sh, sm] = form.startTime.split(":").map(Number);
                      const [eh, em] = form.endTime.split(":").map(Number);
                      let occupied = false;
                      if (c.is_available === false) occupied = true;
                      if (!occupied && dates.length && !isNaN(sh) && !isNaN(eh)) {
                        occupied = dates.some((d) => {
                          const ns = scheduleTimestamp(format(d,'yyyy-MM-dd'),form.startTime);
                          const ne = scheduleTimestamp(format(d,'yyyy-MM-dd'),form.endTime);
                          return events.some((evt: any) => {
                            if (evt.classroom_id !== c.id) return false;
                            const es = new Date(evt.start_time); const ee = new Date(evt.end_time);
                            return ns < ee && ne > es;
                          });
                        });
                      }
                      const dot = c.is_available === false ? "⚪" : (occupied ? "🔴" : "🟢");
                      return (
                        <SelectItem key={c.id} value={c.id} disabled={occupied}>
                          {dot} {c.name} {c.building ? `(${c.building})` : ""} — {cap || "?"} pl. {tooSmall ? "⚠️" : ""}{occupied ? " · Occupée" : ""}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v, exam_kind: v === "rattrapage" ? "rattrapage" : (v === "exam" ? "final" : "") })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cours">Cours</SelectItem>
                    <SelectItem value="td">TD</SelectItem>
                    <SelectItem value="tp">TP</SelectItem>
                    {!schoolMode && <SelectItem value="exam">Examen final</SelectItem>}
                    {!schoolMode && <SelectItem value="rattrapage">Rattrapage</SelectItem>}

                  </SelectContent>
                </Select>
              </div>

              {/* Capacity hint */}
              {form.classroom_id && form.filiere_id && form.level && (() => {
                const room = classrooms.find((c: any) => c.id === form.classroom_id);
                const nb = studentsByClass[`${form.filiere_id}::${form.level}`] || 0;
                const cap = Number(room?.capacity) || 0;
                if (!cap) return null;
                const ok = nb <= cap;
                return (
                  <div className={`text-xs rounded-md p-2 ${ok ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-destructive/10 text-destructive"}`}>
                    {ok
                      ? `✓ ${nb} étudiant(s) — capacité ${cap} OK`
                      : `⚠️ ${nb} étudiant(s) > ${cap} places. Choisissez une salle plus grande.`}
                  </div>
                );
              })()}

              {/* Preview */}
              {!form.singleBlock && occurrences.length > 0 && (
                <div className="bg-secondary/30 rounded-lg p-3 space-y-1">
                  <p className="text-xs font-semibold text-foreground flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5" /> {occurrences.length} séance(s) à générer
                  </p>
                  <div className="max-h-24 overflow-y-auto space-y-0.5">
                    {occurrences.map((d, i) => (
                      <p key={i} className="text-[11px] text-muted-foreground">
                        {i + 1}. {format(d, "EEEE dd/MM/yyyy", { locale: fr })} — {form.startTime} → {form.endTime}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* Conflicts */}
              {conflicts.length > 0 && (
                <div className={`rounded-lg p-3 space-y-1 ${conflicts[0].startsWith("✅") ? "bg-emerald-500/10 border border-emerald-500/30" : "bg-destructive/10 border border-destructive/30"}`}>
                  {conflicts.map((c, i) => (
                    <p key={i} className={`text-xs flex items-start gap-1 ${c.startsWith("✅") ? "text-emerald-700 dark:text-emerald-300" : "text-destructive"}`}>
                      {!c.startsWith("✅") && <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />}
                      {c}
                    </p>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                {!form.singleBlock && (
                  <Button type="button" variant="outline" className="flex-1" onClick={handlePreview}>
                    Vérifier les conflits
                  </Button>
                )}
                <Button
                  onClick={() => createMutation.mutate()}
                  disabled={
                    (schoolMode ? !form.classe_id : !form.filiere_id) || createMutation.isPending ||
                    (form.singleBlock
                      ? (!form.blockStart || !form.blockEnd)
                      : (!form.startDate || form.days.length === 0 || !form.startTime || !form.endTime))
                  }
                  className="flex-1 gradient-gold text-accent-foreground"
                >
                  {createMutation.isPending
                    ? "Création..."
                    : form.singleBlock
                      ? "Créer la séance"
                      : `Créer ${occurrences.length} séance(s)`}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
          )}
        </div>
      </motion.div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="planning">Planning des cours</TabsTrigger>
          {schoolMode && <TabsTrigger value="by-class">Par classe</TabsTrigger>}
          {!schoolMode && <TabsTrigger value="exams">Examens & Rattrapages</TabsTrigger>}
        </TabsList>

        {schoolMode && (
          <TabsContent value="by-class" className="mt-4">
            <ScheduleByClassView />
          </TabsContent>
        )}

        {!schoolMode && (
          <TabsContent value="exams" className="mt-4">
            <ExamPlanningView onScheduleExam={handleScheduleExam} />
          </TabsContent>
        )}


        <TabsContent value="planning" className="mt-4 space-y-6">
      {/* Filters + week nav */}
      <motion.div variants={item} className="flex flex-wrap items-center gap-3">
        {!!schoolClasses.length&&<Select value={filterClass} onValueChange={setFilterClass}><SelectTrigger className="w-48" aria-label="Filtrer le planning par classe"><SelectValue placeholder="Toutes les classes"/></SelectTrigger><SelectContent><SelectItem value="all">Toutes les classes</SelectItem><SelectItem value="unassigned">Séances sans classe</SelectItem>{schoolClasses.map((c:any)=><SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>)}</SelectContent></Select>}
        <Select value={filterFiliere} onValueChange={setFilterFiliere}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Toutes les filières" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les filières</SelectItem>
            {filieres.map((f: any) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterLevel} onValueChange={setFilterLevel}>
          <SelectTrigger className="w-32"><SelectValue placeholder="Niveau" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            {LEVELS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="schedule-week-navigation flex items-center gap-2 ml-auto">
          <Button variant="outline" size="icon" aria-label="Semaine précédente" onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))}><ChevronLeft className="w-4 h-4" /></Button>
          <span className="schedule-week-range text-sm font-medium text-foreground min-w-[200px] text-center">
            {format(weekStart, "dd MMM", { locale: fr })} — {format(weekEnd, "dd MMM yyyy", { locale: fr })}
          </span>
          <Button variant="outline" size="icon" aria-label="Semaine suivante" onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}><ChevronRight className="w-4 h-4" /></Button>
          <Button className="schedule-today-button" variant="ghost" size="sm" onClick={() => setCurrentWeek(new Date())}>Aujourd'hui</Button>
        </div>
      </motion.div>

      {/* Weekly Grid */}
      <motion.div variants={item}>
        <ScheduleWeeklyGrid
          weekDays={weekDays}
          weekEvents={filteredEvents}
          allEvents={events}
          onEventClick={setSelectedEvent}
          showFiliere
          showProfessor
        />
      </motion.div>

      {/* List view with series actions */}
      <motion.div variants={item}>
        <Card className="glass-card-elevated border-border/50 overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    <th className="text-left p-3 text-xs font-semibold text-foreground">Date</th>
                    <th className="text-center p-3 text-xs font-semibold text-foreground">Heure</th>
                    <th className="text-left p-3 text-xs font-semibold text-foreground">Matière</th>
                    <th className="text-center p-3 text-xs font-semibold text-foreground">Prof</th>
                    <th className="text-center p-3 text-xs font-semibold text-foreground">Salle</th>
                    <th className="text-center p-3 text-xs font-semibold text-foreground">Type</th>
                    <th className="text-center p-3 text-xs font-semibold text-foreground">Filière</th>
                    <th className="text-center p-3 text-xs font-semibold text-foreground">Série</th>
                    <th className="text-center p-3 text-xs font-semibold text-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEvents.length === 0 ? (
                    <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">Aucun événement cette semaine</td></tr>
                  ) : filteredEvents.map((e: any) => {
                    const seriesCount = e.recurrence_group_id
                      ? events.filter((ev: any) => ev.recurrence_group_id === e.recurrence_group_id).length
                      : 1;
                    return (
                      <tr key={e.id} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                        <td className="p-3 text-sm font-medium text-foreground">{format(scheduleWallDate(e.start_time), "EEE dd/MM", { locale: fr })}</td>
                        <td className="p-3 text-sm text-center text-foreground">{clockLabel(scheduleParts(e.start_time).minute)} - {clockLabel(scheduleParts(e.end_time).minute)}</td>
                        <td className="p-3 text-sm font-medium text-foreground cursor-pointer hover:text-accent" onClick={() => setSelectedEvent(e)}>{e.title}</td>
                        <td className="p-3 text-xs text-center text-muted-foreground">{e.subjects?.professor || "—"}</td>
                        <td className="p-3 text-xs text-center text-muted-foreground">{e.location || "—"}</td>
                        <td className="p-3 text-center">
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/10 text-accent font-semibold uppercase">{e.event_type}</span>
                        </td>
                        <td className="p-3 text-xs text-center text-muted-foreground">{e.filieres?.name || "—"} {e.level}</td>
                        <td className="p-3 text-center">
                          {seriesCount > 1 ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/10 text-accent font-medium flex items-center justify-center gap-0.5">
                              <Layers className="w-3 h-3" /> {seriesCount}
                            </span>
                          ) : <span className="text-xs text-muted-foreground">—</span>}
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(e.id)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                            {e.recurrence_group_id && seriesCount > 1 && (
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteSeriesOpen(e.recurrence_group_id)} title="Supprimer la série">
                                <Repeat className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </motion.div>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
};

export default AdminSchedulePage;
