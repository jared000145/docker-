import { useState,useEffect } from "react";
import {scheduleTimestamp,scheduleWallDate,scheduleDayKey,scheduleParts,clockLabel,editableScheduleOccurrences} from '@/lib/scheduleLayout';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Calendar, Clock, MapPin, User, Layers, BookOpen, Pencil, Trash2, Save, X } from "lucide-react";
import { format, differenceInWeeks } from "date-fns";
import { fr } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface ScheduleEvent {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  event_type: string;
  location?: string;
  level?: string;
  subject_id?: string;
  recurrence_group_id?:string|null;
  classe_id?:string|null;
  filiere_id?:string|null;
  filieres?: { name: string } | null;
  subjects?: { name: string; professor: string } | null;
}

interface Props {
  event: ScheduleEvent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allEvents: ScheduleEvent[];
  /** Autorise la modification / suppression du créneau (administration) */
  manageable?: boolean;
}

const typeLabels: Record<string, string> = {
  cours: "Cours magistral",
  td: "Travaux dirigés",
  tp: "Travaux pratiques",
  exam: "Examen",
};

const typeColors: Record<string, string> = {
  cours: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500",
  td: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500",
  tp: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500",
  exam: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500",
};

const hhmm = (iso: string) => clockLabel(scheduleParts(iso).minute);

const ScheduleEventDetailDialog = ({ event, open, onOpenChange, allEvents, manageable = false }: Props) => {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [startHM, setStartHM] = useState("");
  const [endHM, setEndHM] = useState("");
  const [location, setLocation] = useState("");
  useEffect(()=>{setEditing(false);},[event?.id,open]);

  if (!event) return null;


  // Count all sessions for same subject
  const subjectSessions = event.subject_id
    ? allEvents.filter(e => e.subject_id === event.subject_id)
    : allEvents.filter(e => e.title === event.title);

  const sortedSessions = [...subjectSessions].sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  );

  const totalSessions = sortedSessions.length;
  const currentIndex = sortedSessions.findIndex(s => s.id === event.id) + 1;

  // Calculate span in weeks
  let spanLabel = "";
  if (totalSessions > 1) {
    const firstDate = new Date(sortedSessions[0].start_time);
    const lastDate = new Date(sortedSessions[totalSessions - 1].end_time);
    const weeks = differenceInWeeks(lastDate, firstDate) + 1;
    spanLabel = weeks <= 1 ? "1 semaine" : `${weeks} semaines`;
  }

  const start = scheduleWallDate(event.start_time);
  const end = scheduleWallDate(event.end_time);
  const durationMin = Math.round((Date.parse(event.end_time)-Date.parse(event.start_time)) / 60000);
  const durationH = Math.floor(durationMin / 60);
  const durationM = durationMin % 60;

  const colors = typeColors[event.event_type] || typeColors.cours;

  // Toutes les occurrences du même créneau hebdomadaire (même jour, même heure, même matière)
  const slotOccurrences = editableScheduleOccurrences(event,allEvents);

  const openEdit = () => {
    setStartHM(hhmm(event.start_time));
    setEndHM(hhmm(event.end_time));
    setLocation(event.location || "");
    setEditing(true);
  };

  const applyTime = (iso: string, hm: string) => {
    return scheduleTimestamp(scheduleDayKey(iso),hm).toISOString();
  };

  const saveSlot = async () => {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(startHM) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(endHM)) {
      toast.error("Horaires invalides");
      return;
    }
    setBusy(true);
    try {
      if(Date.parse(applyTime(event.end_time,endHM))<=Date.parse(applyTime(event.start_time,startHM)))throw Error('La fin doit être après le début.');
      for (const s of slotOccurrences) {
        const { error } = await supabase
          .from("schedule_events")
          .update({
            start_time: applyTime(s.start_time, startHM),
            end_time: applyTime(s.end_time, endHM),
            location: location || null,
          })
          .eq("id", s.id);
        if (error) throw error;
      }
      toast.success(`Créneau modifié (${slotOccurrences.length} séance(s))`);
      qc.invalidateQueries({ queryKey: ["sched-annual-events"] });
      qc.invalidateQueries({queryKey:['admin-all-schedule']});
      setEditing(false);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const deleteSlot = async () => {
    setBusy(true);
    try {
      const ids = slotOccurrences.map((s) => s.id);
      const { error } = await supabase.from("schedule_events").delete().in("id", ids);
      if (error) throw error;
      toast.success(`Cours supprimé (${ids.length} séance(s))`);
      qc.invalidateQueries({ queryKey: ["sched-annual-events"] });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) setEditing(false); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <BookOpen className="w-5 h-5 text-accent" />
            {event.title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Type badge */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={`${colors} border text-xs font-semibold`}>
              {typeLabels[event.event_type] || event.event_type.toUpperCase()}
            </Badge>
            {totalSessions > 1 && (
              <Badge variant="outline" className="text-xs gap-1">
                <Layers className="w-3 h-3" />
                Séance {currentIndex}/{totalSessions}
              </Badge>
            )}
          </div>

          {manageable && (
            <div className="flex flex-wrap gap-2">
              {!editing ? (
                <>
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={openEdit}>
                    <Pencil className="w-3.5 h-3.5" /> Modifier
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="destructive" className="gap-1.5" disabled={busy}>
                        <Trash2 className="w-3.5 h-3.5" /> Supprimer
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Supprimer ce cours ?</AlertDialogTitle>
                        <AlertDialogDescription>
                          {slotOccurrences.length} séance(s) de « {event.title} » seront définitivement supprimées de l'emploi du temps.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction onClick={deleteSlot} className="bg-destructive text-destructive-foreground">
                          Supprimer
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              ) : (
                <div className="w-full space-y-3 rounded-lg border border-border/60 p-3 bg-secondary/20">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Début</Label>
                      <Input type="time" value={startHM} onChange={(e) => setStartHM(e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">Fin</Label>
                      <Input type="time" value={endHM} onChange={(e) => setEndHM(e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Salle / lieu</Label>
                    <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Salle 5" />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    S'applique aux {slotOccurrences.length} séance(s) de ce créneau hebdomadaire.
                  </p>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={saveSlot} disabled={busy} className="gap-1.5">
                      <Save className="w-3.5 h-3.5" /> Enregistrer
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(false)} className="gap-1.5">
                      <X className="w-3.5 h-3.5" /> Annuler
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}


          {/* Date & time */}
          <div className="space-y-2.5 bg-secondary/30 rounded-lg p-3">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium text-foreground">
                {format(start, "EEEE dd MMMM yyyy", { locale: fr })}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-foreground">
                {format(start, "HH:mm")} — {format(end, "HH:mm")}
                <span className="text-muted-foreground ml-2">
                  ({durationH}h{durationM > 0 ? `${durationM.toString().padStart(2, "0")}` : ""})
                </span>
              </span>
            </div>
            {event.location && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                <span className="text-foreground">{event.location}</span>
              </div>
            )}
            {event.subjects?.professor && (
              <div className="flex items-center gap-2 text-sm">
                <User className="w-4 h-4 text-muted-foreground" />
                <span className="text-foreground">{event.subjects.professor}</span>
              </div>
            )}
          </div>

          {/* Period info */}
          {totalSessions > 1 && (
            <div className="bg-accent/5 border border-accent/20 rounded-lg p-3 space-y-2">
              <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Layers className="w-4 h-4 text-accent" />
                {totalSessions} séance{totalSessions > 1 ? "s" : ""} programmée{totalSessions > 1 ? "s" : ""}
                {spanLabel && <span className="text-muted-foreground font-normal">· {spanLabel}</span>}
              </p>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {sortedSessions.map((s, i) => {
                  const sStart = scheduleWallDate(s.start_time);
                  const isCurrent = s.id === event.id;
                  return (
                    <div
                      key={s.id}
                      className={`text-xs flex items-center gap-2 px-2 py-1 rounded ${isCurrent ? "bg-accent/15 font-semibold text-accent" : "text-muted-foreground"}`}
                    >
                      <span className="w-4 text-right">{i + 1}.</span>
                      <span>{format(sStart, "EEE dd/MM", { locale: fr })}</span>
                      <span>{hhmm(s.start_time)} - {hhmm(s.end_time)}</span>
                      {isCurrent && <Badge variant="outline" className="text-[9px] ml-auto">Actuel</Badge>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Filiere & Level */}
          {(event.filieres?.name || event.level) && (
            <div className="text-xs text-muted-foreground flex items-center gap-2">
              📚 {event.filieres?.name} {event.level && `· ${event.level}`}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ScheduleEventDetailDialog;
