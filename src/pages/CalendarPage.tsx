import { motion } from "framer-motion";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock, MapPin, User, Archive, Layers } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useInstitution } from "@/hooks/useInstitution";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval, addDays, isPast, isSameDay } from "date-fns";
import { fr } from "date-fns/locale";
import ScheduleEventDetailDialog from "@/components/schedule/ScheduleEventDetailDialog";
import ScheduleWeeklyGrid from "@/components/schedule/ScheduleWeeklyGrid";
import {projectScheduleWeek,scheduleWallDate,intersectsScheduleRange} from '@/lib/scheduleLayout';
import { NewYearAccessGuard } from "@/components/student/NewYearAccessGuard";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { useCycle } from "@/hooks/useCycle";
import { generateEmploiDuTempsPdf, type EdtSeance } from "@/lib/emploiDuTempsPdf";

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

const CalendarPage = () => {
  const { profile } = useAuth();
  const { institution } = useInstitution();
  const { hasUniversite, hasCollege, hasLycee } = useCycle();
  const isSchool = (hasCollege || hasLycee) && !hasUniversite;
  const activeYear = institution?.academic_year || "2025-2026";
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [view, setView] = useState<"grid" | "list">("grid");
  const [showArchived, setShowArchived] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 6) });

  // Étudiants : école (classe_id) OU université (filiere_id + level)
  const hasSchoolClass = !!profile?.classe_id;
  const hasUniAssignment = !!profile?.filiere_id && !!profile?.level;
  const isAssigned = hasSchoolClass || hasUniAssignment;

  const { data: events = [] } = useQuery({
    queryKey: ["schedule", profile?.classe_id, profile?.filiere_id, profile?.level, activeYear],
    queryFn: async () => {
      let q = supabase
        .from("schedule_events")
        .select("*, subjects(name, professor), filieres(name)")
        .eq("academic_year", activeYear);
      if (hasSchoolClass) {
        q = q.eq("classe_id", profile!.classe_id!);
      } else {
        q = q.eq("filiere_id", profile!.filiere_id!).eq("level", profile!.level!);
      }
      const { data } = await q.order("start_time", { ascending: true });
      return data || [];
    },
    enabled: isAssigned,
  });

  const { data: classe } = useQuery({
    queryKey: ["cal-classe", profile?.classe_id],
    enabled: !!profile?.classe_id,
    queryFn: async () => {
      const { data } = await supabase.from("classes").select("*").eq("id", profile!.classe_id!).maybeSingle();
      return data;
    },
  });

  const { data: dirSig } = useQuery({
    queryKey: ["cal-dir-sig", institution?.id],
    enabled: !!institution?.id,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("director_signatures")
        .select("director_name, signature_url, stamp_url")
        .eq("institution_id", institution!.id)
        .maybeSingle();
      return data;
    },
  });

  const handleDownload = async () => {
    const seen = new Set<string>();
    const seances: EdtSeance[] = [];
    (events as any[]).forEach((e) => {
      const st = scheduleWallDate(e.start_time);
      const en = scheduleWallDate(e.end_time);
      const dayIdx = (st.getDay() + 6) % 7;
      if (dayIdx > 5) return;
      const startMin = st.getHours() * 60 + st.getMinutes();
      const endMin = en.getHours() * 60 + en.getMinutes();
      const key = `${dayIdx}-${startMin}-${endMin}-${e.subjects?.name || e.title}`;
      if (seen.has(key)) return;
      seen.add(key);
      seances.push({
        dayIdx,
        startMin,
        endMin,
        matiere: e.subjects?.name || e.title,
        professeur: e.subjects?.professor || null,
        salle: e.location || null,
      });
    });
    if (seances.length === 0) { toast.error("Aucun cours à télécharger"); return; }
    try {
      const blob = await generateEmploiDuTempsPdf({
        institution: {
          name: institution?.name || "Établissement",
          logo_url: institution?.logo_url,
          bp: (institution as any)?.bp,
          telephone: (institution as any)?.phone,
        },
        titre: (classe as any)?.nom || profile?.level || "Emploi du temps",
        sousTitre: `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim() || null,
        academic_year: activeYear,
        seances,
        director: dirSig ? { name: (dirSig as any).director_name, signature_url: (dirSig as any).signature_url, stamp_url: (dirSig as any).stamp_url } : undefined,
      });
      window.open(URL.createObjectURL(blob), "_blank");
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de la génération");
    }
  };

  useRealtimeSubscription("schedule_events", [["schedule", profile?.classe_id || "", profile?.filiere_id || "", profile?.level || "", activeYear]]);

  const activeEvents = events.filter((e: any) => !isPast(new Date(e.end_time)));
  const archivedEvents = events.filter((e: any) => isPast(new Date(e.end_time)));
  const displayEvents = showArchived ? events : activeEvents;

  const rawWeekEvents = displayEvents.filter((e: any) => {
    return intersectsScheduleRange(e,format(weekStart,'yyyy-MM-dd'),format(addDays(weekStart,7),'yyyy-MM-dd'));
  });

  // Collège/Lycée : le planning est un modèle hebdomadaire annuel récurrent.
  // On projette les séances (dédupliquées par jour/heure/matière) sur la semaine affichée.
  const schoolWeekEvents = projectScheduleWeek(events,weekDays.map(day=>format(day,'yyyy-MM-dd')));

  const weekEvents = isSchool ? schoolWeekEvents : rawWeekEvents;

  const upcomingWeeks = Array.from({ length: 4 }, (_, i) => {
    const ws = startOfWeek(addWeeks(new Date(), i), { weekStartsOn: 1 });
    const we = endOfWeek(addWeeks(new Date(), i), { weekStartsOn: 1 });
    const count = activeEvents.filter((e: any) => { return intersectsScheduleRange(e,format(ws,'yyyy-MM-dd'),format(addDays(ws,7),'yyyy-MM-dd')); }).length;
    return { start: ws, end: we, count };
  });

  return (
    <NewYearAccessGuard>
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <ScheduleEventDetailDialog event={selectedEvent} open={!!selectedEvent} onOpenChange={(o) => !o && setSelectedEvent(null)} allEvents={events} />

      <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground">Emploi du temps</h1>
          <p className="text-muted-foreground mt-1">
            {!isAssigned
              ? "Vous n'êtes pas encore rattaché(e) à une classe / filière"
              : isSchool
                ? `${(classe as any)?.nom || ""} · ${schoolWeekEvents.length} séance(s) par semaine · ${activeYear}`
                : `${activeEvents.length} cours actif(s) · ${archivedEvents.length} archivé(s)`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant={view === "grid" ? "default" : "outline"} size="sm" onClick={() => setView("grid")}>Grille</Button>
          <Button variant={view === "list" ? "default" : "outline"} size="sm" onClick={() => setView("list")}>Liste</Button>
          {isAssigned && (
            <Button variant="outline" size="sm" onClick={handleDownload} className="gap-1">
              <Download className="w-3.5 h-3.5" /> Télécharger
            </Button>
          )}
          <Button variant={showArchived ? "default" : "outline"} size="sm" onClick={() => setShowArchived(!showArchived)} className="gap-1">
            <Archive className="w-3.5 h-3.5" /> {showArchived ? "Masquer archivés" : "Voir archivés"}
          </Button>
        </div>
      </motion.div>

      {/* Week navigation */}
      <motion.div variants={item} className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))}><ChevronLeft className="w-4 h-4" /></Button>
          <span className="text-sm font-medium text-foreground min-w-[200px] text-center">
            {format(weekStart, "dd MMM", { locale: fr })} — {format(weekEnd, "dd MMM yyyy", { locale: fr })}
          </span>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}><ChevronRight className="w-4 h-4" /></Button>
          <Button variant="ghost" size="sm" onClick={() => setCurrentWeek(new Date())}>Aujourd'hui</Button>
        </div>
        <div className="hidden lg:flex gap-2">
          {upcomingWeeks.map((w, i) => (
            <Button key={i} variant="ghost" size="sm" className={`text-xs ${weekStart.getTime() === w.start.getTime() ? "bg-accent/15 text-accent" : ""}`} onClick={() => setCurrentWeek(w.start)}>
              S{format(w.start, "ww")} ({w.count})
            </Button>
          ))}
        </div>
      </motion.div>

      {!isAssigned ? (
        <motion.div variants={item}>
          <Card className="glass-card-elevated border-border/50">
            <CardContent className="p-8 text-center">
              <CalendarIcon className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-sm text-muted-foreground">Vous n'êtes pas encore rattaché(e) à une classe ou filière.</p>
            </CardContent>
          </Card>
        </motion.div>
      ) : view === "grid" ? (
        <motion.div variants={item}>
          <ScheduleWeeklyGrid weekDays={weekDays} weekEvents={weekEvents} allEvents={events} onEventClick={event=>setSelectedEvent(event._source_event||event)} showProfessor />
        </motion.div>
      ) : (
        <motion.div variants={item}>
          <Card className="glass-card-elevated border-border/50 overflow-hidden">
            <CardContent className="p-0">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    <th className="text-left p-4 text-sm font-semibold text-foreground">Date</th>
                    <th className="text-center p-4 text-sm font-semibold text-foreground">Horaire</th>
                    <th className="text-left p-4 text-sm font-semibold text-foreground">Matière</th>
                    <th className="text-center p-4 text-sm font-semibold text-foreground">Professeur</th>
                    <th className="text-center p-4 text-sm font-semibold text-foreground">Salle</th>
                    <th className="text-center p-4 text-sm font-semibold text-foreground">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {weekEvents.length === 0 ? (
                    <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Aucun cours cette semaine</td></tr>
                  ) : weekEvents.map((event: any) => (
                    <tr key={event.id} onClick={() => setSelectedEvent(event)} className="border-b border-border/50 hover:bg-secondary/20 transition-colors cursor-pointer">
                      <td className="p-4 text-sm font-medium text-foreground">{format(scheduleWallDate(event.start_time), "EEE dd/MM", { locale: fr })}</td>
                      <td className="p-4 text-sm text-center text-foreground flex items-center justify-center gap-1"><Clock className="w-3.5 h-3.5 text-muted-foreground" />{format(scheduleWallDate(event.start_time), "HH:mm")} - {format(scheduleWallDate(event.end_time), "HH:mm")}</td>
                      <td className="p-4 text-sm font-medium text-foreground">{event.title}</td>
                      <td className="p-4 text-sm text-center text-muted-foreground">{event.subjects?.professor || "—"}</td>
                      <td className="p-4 text-sm text-center text-muted-foreground">{event.location || "—"}</td>
                      <td className="p-4 text-center"><span className="text-xs px-2.5 py-1 rounded-full bg-accent/10 text-accent font-semibold uppercase">{event.event_type}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Legend */}
      <motion.div variants={item} className="flex flex-wrap gap-4 justify-center">
        {Object.entries({ cours: "Cours", td: "TD", tp: "TP", exam: "Examen" }).map(([key, label]) => (
          <div key={key} className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-sm border-l-[3px] ${key === "cours" ? "border-blue-500 bg-blue-500/15" : key === "td" ? "border-amber-500 bg-amber-500/15" : key === "tp" ? "border-emerald-500 bg-emerald-500/15" : "border-red-500 bg-red-500/15"}`} />
            <span className="text-xs text-muted-foreground">{label}</span>
          </div>
        ))}
      </motion.div>
    </motion.div>
    </NewYearAccessGuard>
  );
};

export default CalendarPage;
