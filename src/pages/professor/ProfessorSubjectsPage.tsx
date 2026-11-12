import { useAuth } from "@/hooks/useAuth";
import { useCycle } from "@/hooks/useCycle";
import ProfessorSchoolSubjects from "@/components/professor/ProfessorSchoolSubjects";
import { motion } from "framer-motion";
import { BookOpen, Archive, Users, Clock, FileUp, FileText, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useProfessorSubjects } from "@/hooks/useProfessorSubjects";
import { useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useAcademicYear } from "@/hooks/useAcademicYear";

const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

const ProfessorSubjectsUniversity = () => {
  const { data: subjectsInfo = [], isLoading } = useProfessorSubjects();
  const [showArchived, setShowArchived] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const qc = useQueryClient();
  const { selectedYear, isViewingHistory } = useAcademicYear();
  const { user } = useAuth();

  const uploadPV = async (subjectId: string, file: File) => {
    if (!user || isViewingHistory) return toast.error("Utilisez l’année active pour transmettre un PV.");
    if (!/\.pdf$/i.test(file.name) || file.type !== "application/pdf" || file.size > 10 * 1024 * 1024) return toast.error("Un fichier PDF de 10 Mo maximum est requis.");
    setUploadingId(subjectId);
    try {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/${subjectId}/${crypto.randomUUID()}.pdf`;
      const { error: upErr } = await supabase.storage.from("pv-professeurs").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const currentSubject = subjectsInfo.find(({ subject }) => subject.id === subjectId)?.subject;
      const { error } = await supabase.rpc("professor_set_pv" as any, {
        _subject_id: subjectId,
        _pv_url: path,
        _academic_year: selectedYear ?? null,
        _semester: (currentSubject as any)?.semester ?? null,
      });
      if (error) throw error;
      toast.success("PV envoyé à l'administration");
      qc.invalidateQueries({ queryKey: ["prof-subjects-full"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploadingId(null);
    }
  };


  const active = useMemo(() => subjectsInfo.filter(s => !s.isArchived), [subjectsInfo]);
  const archived = useMemo(() => subjectsInfo.filter(s => s.isArchived), [subjectsInfo]);
  const visible = showArchived ? archived : active;

  return (
    <motion.div initial="hidden" animate="show" variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } }} className="space-y-6">
      <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-accent" /> Mes matières
          </h1>
          <p className="text-muted-foreground mt-1">
            {active.length} active(s) · {archived.length} archivée(s)
          </p>
        </div>
        <Button size="sm" variant={showArchived ? "default" : "outline"} onClick={() => setShowArchived(!showArchived)} className="gap-2">
          <Archive className="w-4 h-4" />
          {showArchived ? "Voir actives" : `Archives (${archived.length})`}
        </Button>
      </motion.div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement...</p>
      ) : visible.length === 0 ? (
        <Card className="glass-card border-border/50">
          <CardContent className="p-8 text-center text-muted-foreground">
            {showArchived ? "Aucune matière archivée." : "Aucune matière assignée."}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {visible.map(({ subject: s, studentCount, lastSessionEnd, isArchived }) => (
            <motion.div key={s.id} variants={item}>
              <Card className={`glass-card border-border/50 hover:border-accent/30 transition-colors ${isArchived ? "opacity-80" : ""}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{s.name}</CardTitle>
                    {isArchived && <Badge variant="secondary" className="text-[10px] gap-1 shrink-0"><Archive className="w-3 h-3" />Archivée</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">{s.code || "—"}</p>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Filière</span>
                    <span className="text-foreground">{(s as any).filieres?.name || "—"}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Niveau · Semestre</span>
                    <span className="bg-accent/15 text-accent px-2 py-0.5 rounded-full text-xs">{s.level} · {s.semester}</span>
                  </div>
                  <div className="flex justify-between text-sm items-center">
                    <span className="text-muted-foreground flex items-center gap-1"><Users className="w-3.5 h-3.5" /> Étudiants</span>
                    <span className="font-semibold text-accent">{isArchived ? "—" : studentCount}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Crédits / Coeff</span>
                    <span className="text-foreground">{s.credits} / {s.coefficient}</span>
                  </div>
                  {lastSessionEnd && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground pt-1 border-t border-border/50">
                      <Clock className="w-3 h-3" />
                      {isArchived ? "Terminée le " : "Jusqu'au "}
                      {format(lastSessionEnd, "dd MMM yyyy", { locale: fr })}
                    </div>
                  )}
                  <div className="flex gap-2 text-xs text-muted-foreground pt-1">
                    <span>CM: {s.volume_horaire_cm || 0}h</span>
                    <span>TD: {s.volume_horaire_td || 0}h</span>
                    <span>TP: {s.volume_horaire_tp || 0}h</span>
                  </div>
                  {!isArchived && (
                    <div className="pt-2 border-t border-border/50">
                      <input
                        ref={(el) => { inputRefs.current[s.id] = el; }}
                        type="file"
                        accept="application/pdf,image/*"
                        className="hidden"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPV(s.id, f); e.target.value = ""; }}
                      />
                      <Button size="sm" variant={s.pv_url ? "secondary" : "outline"} className="w-full gap-2" onClick={() => inputRefs.current[s.id]?.click()} disabled={uploadingId === s.id || isViewingHistory}>
                        {uploadingId === s.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : s.pv_url ? <FileText className="w-3.5 h-3.5" /> : <FileUp className="w-3.5 h-3.5" />}
                        {s.pv_url ? "Remplacer le PV" : "Envoyer PV à l'administration"}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
};


const ProfessorSubjectsPage = () => {
  const { hasUniversite, isLoading } = useCycle();
  if (isLoading) return null;
  if (!hasUniversite) return <ProfessorSchoolSubjects />;
  return <ProfessorSubjectsUniversity />;
};

export default ProfessorSubjectsPage;

