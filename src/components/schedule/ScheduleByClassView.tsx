import {useCampus} from '@/hooks/useCampus';
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCycle } from "@/hooks/useCycle";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GraduationCap, User, DoorOpen, AlertTriangle, UtensilsCrossed } from "lucide-react";
import { differenceInMinutes } from "date-fns";
import ScheduleEventDetailDialog from "@/components/schedule/ScheduleEventDetailDialog";
import { Printer } from "lucide-react";
import { toast } from "sonner";
import { useInstitution } from "@/hooks/useInstitution";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import { useAdmin } from "@/hooks/useAdmin";
import { buildSlots, generateEmploiDuTempsPdf, minToHHhMM, type EdtSeance } from "@/lib/emploiDuTempsPdf";
import ScheduleWeeklyGrid from './ScheduleWeeklyGrid';
import {projectScheduleWeek,scheduleParts,clockLabel} from '@/lib/scheduleLayout';
import {format} from 'date-fns';
const modelDays=Array.from({length:6},(_,index)=>new Date(2026,0,5+index));

// Grille annuelle : lundi → samedi, 08h → 18h (avec pause déjeuner 12h-13h)
const TIME_SLOTS = Array.from({ length: 10 }, (_, i) => i + 8); // 08 → 17
const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const LUNCH_HOUR = 12;

// Conversion timezone Gabon (UTC+1)
const toLibreville = (s: string) => {
  const part=scheduleParts(s);
  return new Date(part.day+'T'+clockLabel(part.minute)+':00');
};

// Palette couleurs pastel stables par matière (hash → hue)
const colorForSubject = (name: string) => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return {
    bg: `hsl(${h} 78% 90%)`,
    bgHover: `hsl(${h} 78% 85%)`,
    border: `hsl(${h} 65% 45%)`,
    text: `hsl(${h} 55% 22%)`,
    accent: `hsl(${h} 65% 40%)`,
  };
};

type Mode = "class" | "prof" | "room";

const ScheduleByClassView = () => {
  const { profile } = useAuth();
  const { hasCollege, hasLycee } = useCycle();
  const { institution } = useInstitution();
  const { selectedYear } = useAcademicYear();
  const { isAdmin } = useAdmin();
  const instId = profile?.institution_id;const {campusId}=useCampus();

  const [mode, setMode] = useState<Mode>("class");
  const [classeId, setClasseId] = useState<string>("");
  const [profName, setProfName] = useState<string>("");
  const [roomId, setRoomId] = useState<string>("");
  const [selectedEvent, setSelectedEvent] = useState<any>(null);

  // Classes (Collège / Lycée)
  const { data: classes = [] } = useQuery({
    queryKey: ["sched-classes", instId,selectedYear,campusId],
    enabled: !!instId,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("classes")
        .select("id, cycle, niveau, serie, nom, campus_id")
        .eq("institution_id", instId)
        .eq('academic_year',selectedYear)
        .order("niveau")
        .order("nom");
      return (data || []).filter((row:any)=>!campusId||row.campus_id===campusId);
    },
  });

  const { data: classrooms = [] } = useQuery({
    queryKey: ["sched-classrooms", instId,campusId],
    enabled: !!instId,
    queryFn: async () => {
      const { data } = await supabase.from("classrooms").select("id, name, campus_id").eq("institution_id", instId!).order("name");
      return (data || []).filter((row:any)=>!campusId||row.campus_id===campusId);
    },
  });

  const { data: dirSig } = useQuery({
    queryKey: ["sched-dirsig", instId],
    enabled: !!instId,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("director_signatures")
        .select("director_name, signature_url, stamp_url")
        .eq("institution_id", instId)
        .maybeSingle();
      return data;
    },
  });

  // Planning annuel : on prend TOUS les événements de l'institution (une seule occurrence par créneau hebdo)
  const { data: allEvents = [] } = useQuery({
    queryKey: ["sched-annual-events", instId,selectedYear,campusId],
    enabled: !!instId,
    queryFn: async () => {
      const { data } = await supabase
        .from("schedule_events")
        .select("*, subjects(name, professor), classrooms(name), filieres(name)")
        .eq("institution_id", instId!)
        .eq('academic_year',selectedYear)
        .order("start_time");
      return (data || []).filter((row:any)=>!campusId||row.campus_id===campusId);
    },
  });

  // Professeurs disponibles
  const professors = useMemo(() => {
    const set = new Set<string>();
    allEvents.forEach((e: any) => { if (e.subjects?.professor) set.add(e.subjects.professor); });
    return Array.from(set).sort();
  }, [allEvents]);

  const selectedClasse: any = classes.find((c: any) => c.id === classeId);

  // Filtrage principal
  const scopedEvents = useMemo(() => {
    if (mode === "class") {
      if (!selectedClasse) return [];
      return allEvents.filter((e: any) => {
        if (e.classe_id) return e.classe_id === classeId;
        const levelMatch = (e.level || "").toLowerCase() === (selectedClasse.niveau || "").toLowerCase();
        return levelMatch;
      });
    }
    if (mode === "prof") return profName ? allEvents.filter((e: any) => e.subjects?.professor === profName) : [];
    if (mode === "room") return roomId ? allEvents.filter((e: any) => e.classroom_id === roomId) : [];
    return [];
  }, [mode, allEvents, classeId, profName, roomId, selectedClasse]);

  // Déduplication annuelle : on garde une seule occurrence par (jour, heure début, matière/titre)
  const weeklyEvents = useMemo(() => {
    const map = new Map<string, any>();
    scopedEvents.forEach((e: any) => {
      const d = toLibreville(e.start_time);
      const key = `${d.getDay()}-${d.getHours()}-${d.getMinutes()}-${e.subject_id || e.title}-${e.end_time?.slice(11)}-${e.classe_id||''}-${e.classroom_id||''}-${e.event_type||''}`;
      if (!map.has(key)) map.set(key, e);
    });
    return Array.from(map.values());
  }, [scopedEvents]);
  const modelEvents=projectScheduleWeek(weeklyEvents,modelDays.map(day=>format(day,'yyyy-MM-dd')));

  // Conflits (mêmes créneaux)
  const conflicts = useMemo(() => {
    const c: string[] = [];
    for (let i = 0; i < weeklyEvents.length; i++) {
      for (let j = i + 1; j < weeklyEvents.length; j++) {
        const a = weeklyEvents[i], b = weeklyEvents[j];
        const ad = toLibreville(a.start_time);
        const bd = toLibreville(b.start_time);
        if (ad.getDay() !== bd.getDay()) continue;
        const as = ad.getHours() * 60 + ad.getMinutes();
        const ae = as + differenceInMinutes(toLibreville(a.end_time), ad);
        const bs = bd.getHours() * 60 + bd.getMinutes();
        const be = bs + differenceInMinutes(toLibreville(b.end_time), bd);
        if (as < be && bs < ae) c.push(`${a.title} ↔ ${b.title}`);
      }
    }
    return c;
  }, [weeklyEvents]);

  const headerTitle =
    mode === "class"
      ? selectedClasse ? `${selectedClasse.niveau}${selectedClasse.serie ? " " + selectedClasse.serie : ""} — ${selectedClasse.nom}` : ""
      : mode === "prof" ? profName
      : classrooms.find((r: any) => r.id === roomId)?.name || "";

  // Séances normalisées (jour / minutes) → utilisées pour la grille et l'impression
  const seances: EdtSeance[] = useMemo(
    () =>
      weeklyEvents.map((e: any) => {
        const s = toLibreville(e.start_time);
        const en = toLibreville(e.end_time);
        return {
          dayIdx: (s.getDay() + 6) % 7,
          startMin: s.getHours() * 60 + s.getMinutes(),
          endMin: en.getHours() * 60 + en.getMinutes(),
          matiere: e.subjects?.name || e.title,
          professeur: e.subjects?.professor || null,
          salle: e.classrooms?.name || e.location || null,
          _event: e,
        } as any;
      }),
    [weeklyEvents]
  );

  const slots = useMemo(() => buildSlots(seances), [seances]);

  const totalHours = weeklyEvents.reduce(
    (acc: number, e: any) => acc + differenceInMinutes(toLibreville(e.end_time), toLibreville(e.start_time)) / 60,
    0
  );

  const handlePrint = async () => {
    if (seances.length === 0) { toast.error("Aucun cours à imprimer"); return; }
    try {
      const blob = await generateEmploiDuTempsPdf({
        institution: {
          name: institution?.name || "Établissement",
          logo_url: institution?.logo_url,
          bp: (institution as any)?.bp,
          telephone: (institution as any)?.phone,
        },
        titre: headerTitle || "Emploi du temps",
        sousTitre:
          mode === "class"
            ? `${weeklyEvents.length} cours par semaine — ${totalHours.toFixed(1)} h hebdomadaires`
            : null,
        academic_year: selectedYear || "",
        seances,
        director: dirSig
          ? { name: dirSig.director_name, signature_url: dirSig.signature_url, stamp_url: dirSig.stamp_url }
          : undefined,
      });
      window.open(URL.createObjectURL(blob), "_blank");
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de la génération");
    }
  };


  if (!hasCollege && !hasLycee) {
    return (
      <Card className="glass-card border-border/50">
        <CardContent className="p-8 text-center text-muted-foreground">
          Cette vue est réservée aux cycles Collège / Lycée.
        </CardContent>
      </Card>
    );
  }

  const hasSelection = (mode === "class" && classeId) || (mode === "prof" && profName) || (mode === "room" && roomId);

  return (
    <div className="space-y-4">
      <ScheduleEventDetailDialog event={selectedEvent} open={!!selectedEvent} onOpenChange={(o) => !o && setSelectedEvent(null)} allEvents={allEvents} manageable={!!isAdmin} />

      {/* Sélecteurs */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 p-1 bg-secondary/50 rounded-lg">
          <Button variant={mode === "class" ? "default" : "ghost"} size="sm" onClick={() => setMode("class")} className="gap-1"><GraduationCap className="w-4 h-4" />Classe</Button>
          <Button variant={mode === "prof" ? "default" : "ghost"} size="sm" onClick={() => setMode("prof")} className="gap-1"><User className="w-4 h-4" />Professeur</Button>
          <Button variant={mode === "room" ? "default" : "ghost"} size="sm" onClick={() => setMode("room")} className="gap-1"><DoorOpen className="w-4 h-4" />Salle</Button>
        </div>

        {mode === "class" && (
          <Select value={classeId} onValueChange={setClasseId}>
            <SelectTrigger className="w-64"><SelectValue placeholder="Sélectionner une classe…" /></SelectTrigger>
            <SelectContent>
              {classes.length === 0 && <div className="p-2 text-xs text-muted-foreground">Aucune classe créée</div>}
              {classes.map((c: any) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.niveau}{c.serie ? ` ${c.serie}` : ""} — {c.nom}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {mode === "prof" && (
          <Select value={profName} onValueChange={setProfName}>
            <SelectTrigger className="w-64"><SelectValue placeholder="Sélectionner un professeur…" /></SelectTrigger>
            <SelectContent>
              {professors.length === 0 && <div className="p-2 text-xs text-muted-foreground">Aucun professeur</div>}
              {professors.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        {mode === "room" && (
          <Select value={roomId} onValueChange={setRoomId}>
            <SelectTrigger className="w-64"><SelectValue placeholder="Sélectionner une salle…" /></SelectTrigger>
            <SelectContent>
              {classrooms.length === 0 && <div className="p-2 text-xs text-muted-foreground">Aucune salle</div>}
              {classrooms.map((r: any) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}

        {hasSelection && (
          <div className="flex items-center gap-2 ml-auto">
            <Badge variant="secondary" className="text-xs">{weeklyEvents.length} cours / semaine</Badge>
            <Badge variant="secondary" className="text-xs">{totalHours.toFixed(1)} h</Badge>
            {conflicts.length > 0 && (
              <Badge variant="destructive" className="gap-1 text-xs"><AlertTriangle className="w-3 h-3" /> {conflicts.length} conflit(s)</Badge>
            )}
            <Button size="sm" variant="outline" className="gap-1.5" onClick={handlePrint}>
              <Printer className="w-3.5 h-3.5" /> Imprimer
            </Button>
          </div>
        )}
      </div>

      {!hasSelection ? (
        <Card className="glass-card border-border/50">
          <CardContent className="p-12 text-center text-muted-foreground">
            Sélectionne une {mode === "class" ? "classe" : mode === "prof" ? "un professeur" : "une salle"} pour afficher l'emploi du temps annuel.
          </CardContent>
        </Card>
      ) : (
        <Card className="glass-card-elevated border-border/50 overflow-hidden">
          <CardContent className="p-0">
            {/* En-tête Pronote-like */}
            <div className="bg-gradient-to-r from-accent/10 via-accent/5 to-transparent px-5 py-3 border-b border-border">
              <h3 className="text-lg font-heading font-bold text-foreground text-center tracking-wide">{headerTitle}</h3>
              <p className="text-[11px] text-muted-foreground text-center mt-0.5">Planning annuel — répété chaque semaine jusqu'à la clôture du 3<sup>ème</sup> trimestre</p>
            </div>

            <ScheduleWeeklyGrid template weekDays={modelDays} weekEvents={modelEvents} allEvents={allEvents} onEventClick={event=>setSelectedEvent(event._source_event||event)} showFiliere={mode==="prof"} showProfessor={mode!=="prof"}/>
          </CardContent>
        </Card>
      )}

      {conflicts.length > 0 && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-4">
            <p className="text-sm font-semibold text-destructive flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4" /> Conflits détectés
            </p>
            <ul className="text-xs space-y-1">
              {conflicts.map((c, i) => <li key={i} className="text-destructive/80">• {c}</li>)}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ScheduleByClassView;
