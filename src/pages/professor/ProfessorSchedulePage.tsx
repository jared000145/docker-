import { motion } from "framer-motion";
import { Calendar, ChevronLeft, ChevronRight, Clock, MapPin, User, Archive, Layers } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval, addDays, isPast } from "date-fns";
import { fr } from "date-fns/locale";
import { useState } from "react";
import ScheduleEventDetailDialog from "@/components/schedule/ScheduleEventDetailDialog";
import ScheduleWeeklyGrid from "@/components/schedule/ScheduleWeeklyGrid";
import {projectScheduleWeek,scheduleWallDate,intersectsScheduleRange} from '@/lib/scheduleLayout';
import { useProfessorClasses } from "@/hooks/useProfessorClasses";

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

const ProfessorSchedulePage = () => {
  const { profile } = useAuth();
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [view, setView] = useState<"grid" | "list">("grid");
  const [showArchived, setShowArchived] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 6) });

  const { data: assignments = [] } = useProfessorClasses();
  const myClassIds = Array.from(new Set(assignments.map((a: any) => a.classe_id).filter(Boolean)));

  const { data: mySubjects = [] } = useQuery({
    queryKey: ["prof-subjects-for-schedule", profile?.first_name, profile?.last_name, profile?.institution_id, assignments.length],
    queryFn: async () => {
      const fullName = `${profile?.first_name} ${profile?.last_name}`.trim();
      const { data } = await supabase.from("subjects").select("id, name, filiere_id, level").ilike("professor", `%${fullName}%`).eq("institution_id", profile!.institution_id!);
      const byName = data || [];
      // Collège / Lycée : les matières viennent des affectations classe × matière
      const fromClasses = assignments
        .filter((a: any) => a.subject)
        .map((a: any) => ({ id: a.subject.id, name: a.subject.name, filiere_id: null, level: a.classe?.niveau ?? null }));
      const map = new Map<string, any>();
      [...byName, ...fromClasses].forEach((s: any) => map.set(s.id, s));
      return Array.from(map.values());
    },
    enabled: !!profile?.institution_id,
  });

  const subjectIds = mySubjects.map((s: any) => s.id);

  const { data: events = [] } = useQuery({
    queryKey: ["prof-schedule-events", profile?.institution_id, subjectIds.join(","), myClassIds.join(",")],
    queryFn: async () => {
      if (subjectIds.length === 0 && myClassIds.length === 0) return [];
      const filters: string[] = [];
      if (subjectIds.length) filters.push(`subject_id.in.(${subjectIds.join(",")})`);
      if (myClassIds.length) filters.push(`classe_id.in.(${myClassIds.join(",")})`);
      const { data } = await supabase
        .from("schedule_events")
        .select("*, subjects(name, professor), filieres(name)")
        .eq("institution_id", profile!.institution_id!)
        .or(filters.join(","))
        .order("start_time", { ascending: true });
      return data || [];
    },
    enabled: !!profile?.institution_id && (subjectIds.length > 0 || myClassIds.length > 0),
  });

  useRealtimeSubscription("schedule_events", [["prof-schedule-events", profile?.institution_id || "", subjectIds.join(","), myClassIds.join(",")]]);

  const activeEvents = events.filter((e: any) => !isPast(new Date(e.end_time)));

  // Collège/Lycée : les séances enregistrées constituent le modèle hebdomadaire.
  // On les projette sur la semaine consultée, même si les occurrences datées sont passées.
  const projectedWeekEvents = projectScheduleWeek(events,weekDays.map(day=>format(day,'yyyy-MM-dd')));

  const datedWeekEvents = (showArchived ? events : activeEvents).filter((e: any) => {
    return intersectsScheduleRange(e,format(weekStart,'yyyy-MM-dd'),format(addDays(weekStart,7),'yyyy-MM-dd'));
  });
  const weekEvents = assignments.length > 0 ? projectedWeekEvents : datedWeekEvents;

  const upcomingWeeks = Array.from({ length: 4 }, (_, i) => {
    const ws = startOfWeek(addWeeks(new Date(), i), { weekStartsOn: 1 });
    const we = endOfWeek(addWeeks(new Date(), i), { weekStartsOn: 1 });
    const count = assignments.length > 0
      ? projectedWeekEvents.length
      : activeEvents.filter((e: any) => { return intersectsScheduleRange(e,format(ws,'yyyy-MM-dd'),format(addDays(ws,7),'yyyy-MM-dd')); }).length;
    return { start: ws, end: we, count };
  });

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <ScheduleEventDetailDialog event={selectedEvent} open={!!selectedEvent} onOpenChange={(o) => !o && setSelectedEvent(null)} allEvents={events} />

      <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2"><Calendar className="w-6 h-6 text-accent" /> Mon planning</h1>
          <p className="text-muted-foreground mt-1">{mySubjects.length} matière(s) · {assignments.length > 0 ? `${projectedWeekEvents.length} séance(s) par semaine` : `${activeEvents.length} cours à venir`}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant={view === "grid" ? "default" : "outline"} size="sm" onClick={() => setView("grid")}>Grille</Button>
          <Button variant={view === "list" ? "default" : "outline"} size="sm" onClick={() => setView("list")}>Liste</Button>
          <Button variant={showArchived ? "default" : "outline"} size="sm" onClick={() => setShowArchived(!showArchived)} className="gap-1">
            <Archive className="w-3.5 h-3.5" /> {showArchived ? "Masquer" : "Archivés"}
          </Button>
        </div>
      </motion.div>

      <motion.div variants={item} className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))}><ChevronLeft className="w-4 h-4" /></Button>
          <span className="text-sm font-medium text-foreground min-w-[200px] text-center">{format(weekStart, "dd MMM", { locale: fr })} — {format(weekEnd, "dd MMM yyyy", { locale: fr })}</span>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}><ChevronRight className="w-4 h-4" /></Button>
          <Button variant="ghost" size="sm" onClick={() => setCurrentWeek(new Date())}>Aujourd'hui</Button>
        </div>
        <div className="hidden lg:flex gap-2">
          {upcomingWeeks.map((w, i) => (
            <Button key={i} variant="ghost" size="sm" className={`text-xs ${weekStart.getTime() === w.start.getTime() ? "bg-accent/15 text-accent" : ""}`} onClick={() => setCurrentWeek(w.start)}>S{format(w.start, "ww")} ({w.count})</Button>
          ))}
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div variants={item} className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {mySubjects.slice(0, 4).map((s: any) => {
          const count = activeEvents.filter((e: any) => e.subject_id === s.id).length;
          return (
            <Card key={s.id} className="glass-card border-border/50">
              <CardContent className="p-3">
                <p className="text-sm font-medium text-foreground truncate">{s.name}</p>
                <p className="text-xs text-muted-foreground">{s.level}</p>
                <p className="text-lg font-bold text-accent mt-1">{count} <span className="text-xs font-normal text-muted-foreground">séances</span></p>
              </CardContent>
            </Card>
          );
        })}
      </motion.div>

      {mySubjects.length === 0 && myClassIds.length === 0 ? (
        <Card className="glass-card border-border/50"><CardContent className="p-8 text-center text-muted-foreground">Aucune matière assignée.</CardContent></Card>
      ) : view === "grid" ? (
        <motion.div variants={item}>
          <ScheduleWeeklyGrid weekDays={weekDays} weekEvents={weekEvents} allEvents={events} onEventClick={event=>setSelectedEvent(event._source_event||event)} showFiliere showProfessor={false} />
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
                    <th className="text-center p-4 text-sm font-semibold text-foreground">Filière</th>
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
                      <td className="p-4 text-sm text-center text-foreground">{format(scheduleWallDate(event.start_time), "HH:mm")} - {format(scheduleWallDate(event.end_time), "HH:mm")}</td>
                      <td className="p-4 text-sm font-medium text-foreground">{event.title}</td>
                      <td className="p-4 text-sm text-center text-muted-foreground">{event.filieres?.name || "—"} {event.level}</td>
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
    </motion.div>
  );
};

export default ProfessorSchedulePage;
