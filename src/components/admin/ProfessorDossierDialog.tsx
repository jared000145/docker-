import { useState, useRef, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  FileText, Upload, Trash2, Download, GraduationCap, Loader2, Eye,
  User, BookOpen, Briefcase, Calendar, History, FolderOpen, Award, Plus, Pencil
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { privateDocumentUrl } from "@/lib/privateDocuments";
import { toast } from "sonner";
import { DIPLOMA_LEVELS, getHighestDiplomaLevel, getProfessorTitle, TITLE_FOR } from "@/lib/professorTitle";

const TITLES = ["Licence", "Master", "Master Ingénieur", "Doctorat", "Professeur Agrégé", "Autre"];
const GRADES = ["Vacataire", "Assistant", "Maître Assistant", "Maître de Conférences", "Professeur Titulaire"];
const STATUTS = ["Permanent", "Vacataire", "Contractuel", "Invité"];
const DOC_TYPES = [
  { value: "diplome", label: "Diplôme" },
  { value: "cv", label: "CV" },
  { value: "contrat", label: "Contrat" },
  { value: "piece_identite", label: "Pièce d'identité" },
  { value: "autre", label: "Autre" },
];

async function logHistory(profUserId: string, instId: string | null | undefined, action: string, details: any) {
  if (!instId) return;
  try {
    await (supabase as any).from("professor_history").insert({
      professor_user_id: profUserId,
      institution_id: instId,
      action,
      details,
    });
  } catch (e) { /* ignore */ }
}

export function ProfessorDossierDialog({ professor, open, onOpenChange }: { professor: any; open: boolean; onOpenChange: (o: boolean) => void }) {
  if (!professor) return null;
  return <ProfessorDossierContent key={professor.user_id} professor={professor} open={open} onOpenChange={onOpenChange} />;
}

function ProfessorDossierContent({ professor, open, onOpenChange }: { professor: any; open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const { profile } = useAuth();
  const instId = profile?.institution_id;


  // === Profil
  const [title, setTitle] = useState(professor?.academic_title || "");
  const [department, setDepartment] = useState(professor?.department || "");
  const [phone, setPhone] = useState(professor?.phone || "");
  const [address, setAddress] = useState(professor?.address || "");

  // === Docs / diplômes
  const fileRef = useRef<HTMLInputElement>(null);
  const [docType, setDocType] = useState("diplome");
  const [docTitle, setDocTitle] = useState("");
  const [diplomaLevel, setDiplomaLevel] = useState<string>("");
  const [diplomaField, setDiplomaField] = useState("");
  const [diplomaYear, setDiplomaYear] = useState("");
  const [issuer, setIssuer] = useState("");
  const [docGrade, setDocGrade] = useState("");
  const [uploading, setUploading] = useState(false);

  // === Expérience
  const [expForm, setExpForm] = useState({ position: "", organization: "", start_date: "", end_date: "", description: "" });

  const { data: docs = [] } = useQuery({
    queryKey: ["prof-docs", professor.user_id],
    queryFn: async () => {
      const { data } = await supabase.from("professor_documents").select("*").eq("professor_user_id", professor.user_id).order("created_at", { ascending: false });
      return Promise.all(((data as any[]) || []).map(async doc => ({ ...doc, file_url: await privateDocumentUrl('professor-documents', doc.file_url) })));
    },
    enabled: !!professor?.user_id && open,
    refetchInterval: 45 * 60 * 1000,
  });

  const { data: experiences = [] } = useQuery({
    queryKey: ["prof-exp", professor.user_id],
    queryFn: async () => {
      const { data } = await (supabase as any).from("professor_experiences").select("*").eq("professor_user_id", professor.user_id).order("start_date", { ascending: false });
      return (data as any[]) || [];
    },
    enabled: !!professor?.user_id && open,
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ["prof-subjects", professor.user_id, instId],
    queryFn: async () => {
      const full = `${professor.first_name || ""} ${professor.last_name || ""}`.trim().toLowerCase();
      const { data } = await supabase.from("subjects").select("id,name,code,semester,academic_year,level,professor,filiere_id,filieres:filiere_id(name)").eq("institution_id", instId);
      if (!data) return [];
      return data.filter((s: any) =>
        (s.professor || "").toLowerCase().includes(full) ||
        (full && (s.professor || "").toLowerCase().includes(professor.last_name?.toLowerCase() || "___"))
      );
    },
    enabled: !!professor?.user_id && !!instId && open,
  });

  const { data: schedule = [] } = useQuery({
    queryKey: ["prof-schedule", professor.user_id, instId],
    queryFn: async () => {
      const { data } = await (supabase as any).from("schedule_events").select("id,title,start_time,end_time,filiere_id,level,filieres:filiere_id(name)").eq("institution_id", instId).eq("user_id", professor.user_id).order("start_time", { ascending: false }).limit(50);
      return (data as any[]) || [];
    },
    enabled: !!professor?.user_id && !!instId && open,
  });

  const { data: history = [] } = useQuery({
    queryKey: ["prof-history", professor.user_id],
    queryFn: async () => {
      const { data } = await (supabase as any).from("professor_history").select("*").eq("professor_user_id", professor.user_id).order("created_at", { ascending: false }).limit(100);
      return (data as any[]) || [];
    },
    enabled: !!professor?.user_id && open,
  });

  const diplomas = useMemo(() => docs.filter((d: any) => d.doc_type === "diplome" || d.diploma_level), [docs]);
  const otherDocs = useMemo(() => docs.filter((d: any) => d.doc_type !== "diplome" && !d.diploma_level), [docs]);
  const highest = getHighestDiplomaLevel(docs);
  const autoTitle = highest ? TITLE_FOR[highest] : getProfessorTitle(docs, professor.academic_title);

  const profileMutation = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from("profiles").update({
        academic_title: title || null,
        department: department || null,
        phone: phone || null,
        address: address || null,
      }).eq("user_id", professor.user_id);
      if (error) throw error;
      await logHistory(professor.user_id, instId, "profil_modifie", { title, department, phone });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-professors"] });
      qc.invalidateQueries({ queryKey: ["prof-history", professor.user_id] });
      toast.success("Profil mis à jour");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleUpload = async (file: File) => {
    if (!docTitle.trim()) { toast.error("Donnez un titre"); return; }
    if (docType === "diplome" && !diplomaLevel) { toast.error("Sélectionnez le niveau du diplôme"); return; }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${professor.user_id}/${Date.now()}_${docType}.${ext}`;
      const { error: upErr } = await supabase.storage.from("professor-documents").upload(path, file);
      if (upErr) throw upErr;
      const payload: any = {
        professor_user_id: professor.user_id,
        institution_id: instId || null,
        doc_type: docType,
        title: docTitle,
        file_url: path,
      };
      if (docType === "diplome") {
        payload.diploma_level = diplomaLevel;
        payload.diploma_field = diplomaField || null;
        payload.diploma_year = diplomaYear ? parseInt(diplomaYear) : null;
        payload.issuing_institution = issuer || null;
        payload.grade = docGrade || null;
      }
      const { error } = await (supabase as any).from("professor_documents").insert(payload);
      if (error) throw error;
      await logHistory(professor.user_id, instId, "document_ajoute", { title: docTitle, type: docType, niveau: diplomaLevel || null });
      qc.invalidateQueries({ queryKey: ["prof-docs", professor.user_id] });
      qc.invalidateQueries({ queryKey: ["prof-history", professor.user_id] });
      setDocTitle(""); setDiplomaField(""); setDiplomaYear(""); setIssuer(""); setDocGrade(""); setDiplomaLevel("");
      if (fileRef.current) fileRef.current.value = "";
      toast.success("Document ajouté");
    } catch (e: any) {
      toast.error(e.message || "Erreur upload");
    } finally {
      setUploading(false);
    }
  };

  const deleteDoc = useMutation({
    mutationFn: async (doc: any) => {
      const { error } = await supabase.from("professor_documents").delete().eq("id", doc.id);
      if (error) throw error;
      await logHistory(professor.user_id, instId, "document_supprime", { title: doc.title });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prof-docs", professor.user_id] });
      qc.invalidateQueries({ queryKey: ["prof-history", professor.user_id] });
      toast.success("Supprimé");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const addExp = useMutation({
    mutationFn: async () => {
      if (!expForm.position.trim()) throw new Error("Poste requis");
      const { error } = await (supabase as any).from("professor_experiences").insert({
        professor_user_id: professor.user_id,
        institution_id: instId || null,
        position: expForm.position,
        organization: expForm.organization || null,
        start_date: expForm.start_date || null,
        end_date: expForm.end_date || null,
        description: expForm.description || null,
      });
      if (error) throw error;
      await logHistory(professor.user_id, instId, "experience_ajoutee", expForm);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prof-exp", professor.user_id] });
      qc.invalidateQueries({ queryKey: ["prof-history", professor.user_id] });
      setExpForm({ position: "", organization: "", start_date: "", end_date: "", description: "" });
      toast.success("Expérience ajoutée");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteExp = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("professor_experiences").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["prof-exp", professor.user_id] }); toast.success("Supprimée"); },
    onError: (e: any) => toast.error(e.message),
  });

  const displayName = `${autoTitle ? autoTitle + " " : ""}${professor.first_name || ""} ${professor.last_name || ""}`.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <FolderOpen className="w-5 h-5 text-accent" />
            Dossier Professeur — {displayName}
            {professor.student_number && <Badge variant="outline" className="font-mono text-xs">{professor.student_number}</Badge>}
            {autoTitle && <Badge className="bg-accent text-accent-foreground text-xs">{autoTitle}</Badge>}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="synthese">
          <TabsList className="grid w-full grid-cols-7 h-auto">
            <TabsTrigger value="synthese" className="text-xs"><Award className="w-3 h-3 mr-1" />Synthèse</TabsTrigger>
            <TabsTrigger value="info" className="text-xs"><User className="w-3 h-3 mr-1" />Infos</TabsTrigger>
            <TabsTrigger value="diplomes" className="text-xs"><GraduationCap className="w-3 h-3 mr-1" />Diplômes</TabsTrigger>
            <TabsTrigger value="docs" className="text-xs"><FileText className="w-3 h-3 mr-1" />Docs</TabsTrigger>
            <TabsTrigger value="ue" className="text-xs"><BookOpen className="w-3 h-3 mr-1" />UE</TabsTrigger>
            <TabsTrigger value="affect" className="text-xs"><Calendar className="w-3 h-3 mr-1" />Affect.</TabsTrigger>
            <TabsTrigger value="hist" className="text-xs"><History className="w-3 h-3 mr-1" />Hist.</TabsTrigger>
          </TabsList>

          {/* ====================== SYNTHÈSE ====================== */}
          <TabsContent value="synthese" className="space-y-4 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <SummaryCard label="Titre académique" value={autoTitle ? `${autoTitle} (auto)` : "—"} icon={Award} />
              <SummaryCard label="Diplôme le plus élevé" value={highest ? DIPLOMA_LEVELS.find(d=>d.value===highest)?.label || highest : "—"} icon={GraduationCap} />
              <SummaryCard label="Département" value={professor.department || "—"} icon={Briefcase} />
              <SummaryCard label="Téléphone" value={professor.phone || "—"} icon={User} />
              <SummaryCard label="Diplômes" value={`${diplomas.length}`} icon={GraduationCap} />
              <SummaryCard label="Documents" value={`${docs.length}`} icon={FileText} />
              <SummaryCard label="UE enseignées" value={`${subjects.length}`} icon={BookOpen} />
              <SummaryCard label="Affectations (planning)" value={`${schedule.length}`} icon={Calendar} />
            </div>
            <div className="border border-border/50 rounded-lg p-4 bg-secondary/20">
              <p className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wider">Dernières expériences</p>
              {experiences.length === 0 ? <p className="text-sm text-muted-foreground">Aucune</p> : (
                <ul className="space-y-1 text-sm">
                  {experiences.slice(0, 3).map((e: any) => (
                    <li key={e.id}>• <strong>{e.position}</strong>{e.organization ? ` — ${e.organization}` : ""}{e.start_date ? ` (${e.start_date?.slice(0,4)}${e.end_date ? "–"+e.end_date.slice(0,4) : "+"})` : ""}</li>
                  ))}
                </ul>
              )}
            </div>
          </TabsContent>

          {/* ====================== INFOS ====================== */}
          <TabsContent value="info" className="space-y-3 pt-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Prénom" value={professor.first_name} readOnly />
              <Field label="Nom" value={professor.last_name} readOnly />
              <Field label="Matricule" value={professor.student_number} readOnly mono />
              <Field label="Email" value={professor.email} readOnly />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Titre / Grade (manuel)</Label>
              <Select value={title} onValueChange={setTitle}>
                <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
                <SelectContent>{TITLES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">Le préfixe (Dr./Ing./M./Lic.) est calculé automatiquement depuis les diplômes.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-xs">Département</Label><Input value={department} onChange={(e) => setDepartment(e.target.value)} /></div>
              <div className="space-y-1"><Label className="text-xs">Téléphone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
            </div>
            <div className="space-y-1"><Label className="text-xs">Adresse</Label><Input value={address} onChange={(e) => setAddress(e.target.value)} /></div>
            <Button onClick={() => profileMutation.mutate()} disabled={profileMutation.isPending} className="w-full gradient-gold text-accent-foreground">
              {profileMutation.isPending ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </TabsContent>

          {/* ====================== DIPLÔMES ====================== */}
          <TabsContent value="diplomes" className="space-y-4 pt-4">
            <div className="border border-border/50 rounded-lg p-4 space-y-3 bg-secondary/20">
              <p className="text-sm font-semibold">Ajouter un diplôme</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px]">Niveau *</Label>
                  <Select value={diplomaLevel} onValueChange={(v) => { setDiplomaLevel(v); setDocType("diplome"); }}>
                    <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Niveau" /></SelectTrigger>
                    <SelectContent>{DIPLOMA_LEVELS.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label className="text-[10px]">Intitulé *</Label><Input className="h-9 text-xs" value={docTitle} onChange={(e) => { setDocTitle(e.target.value); setDocType("diplome"); }} placeholder="Ex: Doctorat en Informatique" /></div>
                <div><Label className="text-[10px]">Filière / Spécialité</Label><Input className="h-9 text-xs" value={diplomaField} onChange={(e) => setDiplomaField(e.target.value)} /></div>
                <div><Label className="text-[10px]">Année</Label><Input type="number" className="h-9 text-xs" value={diplomaYear} onChange={(e) => setDiplomaYear(e.target.value)} placeholder="2022" /></div>
                <div className="col-span-2"><Label className="text-[10px]">Établissement émetteur</Label><Input className="h-9 text-xs" value={issuer} onChange={(e) => setIssuer(e.target.value)} /></div>
                <div className="col-span-2">
                  <Label className="text-[10px]">Grade / Mention</Label>
                  <Select value={docGrade} onValueChange={setDocGrade}>
                    <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Mention" /></SelectTrigger>
                    <SelectContent>{GRADES.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <input ref={fileRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setDocType("diplome"); handleUpload(f); } }} />
              <Button onClick={() => { setDocType("diplome"); fileRef.current?.click(); }} disabled={uploading || !docTitle.trim() || !diplomaLevel} className="w-full gap-2" size="sm">
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {uploading ? "Upload..." : "Choisir le fichier du diplôme"}
              </Button>
            </div>

            <DocList items={diplomas} onDelete={(d) => deleteDoc.mutate(d)} showDiploma />
          </TabsContent>

          {/* ====================== DOCUMENTS ====================== */}
          <TabsContent value="docs" className="space-y-4 pt-4">
            <div className="border border-border/50 rounded-lg p-4 space-y-3 bg-secondary/20">
              <p className="text-sm font-semibold">Ajouter un document officiel</p>
              <div className="grid grid-cols-2 gap-2">
                <Select value={docType} onValueChange={setDocType}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{DOC_TYPES.filter(d => d.value !== "diplome").map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent>
                </Select>
                <Input className="h-9 text-xs" placeholder="Titre (ex: CV 2026)" value={docTitle} onChange={(e) => setDocTitle(e.target.value)} />
              </div>
              <input ref={fileRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }} />
              <Button onClick={() => fileRef.current?.click()} disabled={uploading || !docTitle.trim() || docType === "diplome"} className="w-full gap-2" size="sm">
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {uploading ? "Upload..." : "Choisir un fichier"}
              </Button>
            </div>
            <DocList items={otherDocs} onDelete={(d) => deleteDoc.mutate(d)} />
          </TabsContent>

          {/* ====================== UE ====================== */}
          <TabsContent value="ue" className="space-y-3 pt-4">
            {subjects.length === 0 ? (
              <EmptyState icon={BookOpen} text="Aucune UE/matière assignée à ce professeur" />
            ) : (
              <div className="border border-border/50 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/30 text-xs"><tr>
                    <th className="text-left p-2">Matière</th><th className="text-left p-2">Filière</th><th className="text-center p-2">Niveau</th><th className="text-center p-2">Semestre</th><th className="text-center p-2">Année</th>
                  </tr></thead>
                  <tbody>{subjects.map((s: any) => (
                    <tr key={s.id} className="border-t border-border/40">
                      <td className="p-2 font-medium">{s.name} {s.code && <span className="text-[10px] text-muted-foreground">({s.code})</span>}</td>
                      <td className="p-2 text-muted-foreground">{s.filieres?.name || "—"}</td>
                      <td className="p-2 text-center"><Badge variant="outline" className="text-[10px]">{s.level}</Badge></td>
                      <td className="p-2 text-center">{s.semester}</td>
                      <td className="p-2 text-center text-muted-foreground">{s.academic_year}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </TabsContent>

          {/* ====================== AFFECTATIONS ====================== */}
          <TabsContent value="affect" className="space-y-4 pt-4">
            <div className="border border-border/50 rounded-lg p-4 space-y-3 bg-secondary/20">
              <p className="text-sm font-semibold">Ajouter une expérience professionnelle</p>
              <div className="grid grid-cols-2 gap-2">
                <Input className="h-9 text-xs" placeholder="Poste *" value={expForm.position} onChange={(e) => setExpForm({ ...expForm, position: e.target.value })} />
                <Input className="h-9 text-xs" placeholder="Organisation" value={expForm.organization} onChange={(e) => setExpForm({ ...expForm, organization: e.target.value })} />
                <Input type="date" className="h-9 text-xs" value={expForm.start_date} onChange={(e) => setExpForm({ ...expForm, start_date: e.target.value })} />
                <Input type="date" className="h-9 text-xs" value={expForm.end_date} onChange={(e) => setExpForm({ ...expForm, end_date: e.target.value })} />
              </div>
              <Textarea placeholder="Description / missions" value={expForm.description} onChange={(e) => setExpForm({ ...expForm, description: e.target.value })} className="text-xs" rows={2} />
              <Button onClick={() => addExp.mutate()} disabled={addExp.isPending || !expForm.position.trim()} size="sm" className="w-full gap-2">
                <Plus className="w-4 h-4" /> Ajouter
              </Button>
            </div>

            {experiences.length === 0 ? <EmptyState icon={Briefcase} text="Aucune expérience" /> : (
              <div className="space-y-2">{experiences.map((e: any) => (
                <div key={e.id} className="flex items-start justify-between p-3 rounded-lg border border-border/50 bg-card/50">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm">{e.position}</p>
                    {e.organization && <p className="text-xs text-muted-foreground">{e.organization}</p>}
                    {(e.start_date || e.end_date) && <p className="text-[10px] text-muted-foreground mt-1">{e.start_date || "?"} → {e.end_date || "en cours"}</p>}
                    {e.description && <p className="text-xs mt-1">{e.description}</p>}
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteExp.mutate(e.id)}><Trash2 className="w-4 h-4" /></Button>
                </div>
              ))}</div>
            )}

            <div className="border-t border-border/40 pt-4">
              <p className="text-sm font-semibold mb-2 flex items-center gap-2"><Calendar className="w-4 h-4 text-accent" /> Affectations planning (50 dernières)</p>
              {schedule.length === 0 ? <EmptyState icon={Calendar} text="Aucune affectation au planning" /> : (
                <div className="space-y-1 max-h-64 overflow-y-auto">{schedule.map((s: any) => (
                  <div key={s.id} className="flex items-center justify-between text-xs p-2 rounded border border-border/40">
                    <span className="font-medium">{s.title}</span>
                    <span className="text-muted-foreground">{s.filieres?.name} {s.level} • {new Date(s.start_time).toLocaleString("fr-FR")}</span>
                  </div>
                ))}</div>
              )}
            </div>
          </TabsContent>

          {/* ====================== HISTORIQUE ====================== */}
          <TabsContent value="hist" className="space-y-2 pt-4">
            {history.length === 0 ? <EmptyState icon={History} text="Aucune action enregistrée" /> : (
              <div className="space-y-1">{history.map((h: any) => (
                <div key={h.id} className="flex items-start justify-between gap-3 p-2 rounded border border-border/40 text-xs">
                  <div className="min-w-0">
                    <p className="font-medium">{h.action}</p>
                    {h.details && <pre className="text-[10px] text-muted-foreground whitespace-pre-wrap break-all">{JSON.stringify(h.details, null, 0)}</pre>}
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">{new Date(h.created_at).toLocaleString("fr-FR")}</span>
                </div>
              ))}</div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function SummaryCard({ label, value, icon: Icon }: any) {
  return (
    <div className="p-3 rounded-lg border border-border/50 bg-card/50 flex items-center gap-3">
      <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center"><Icon className="w-4 h-4 text-accent" /></div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold truncate">{value}</p>
      </div>
    </div>
  );
}

function Field({ label, value, readOnly, mono }: { label: string; value: any; readOnly?: boolean; mono?: boolean }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input value={value || ""} readOnly={readOnly} className={mono ? "font-mono text-xs" : ""} />
    </div>
  );
}

function EmptyState({ icon: Icon, text }: any) {
  return <div className="text-center py-8 text-sm text-muted-foreground"><Icon className="w-10 h-10 mx-auto mb-2 opacity-30" />{text}</div>;
}

function DocList({ items, onDelete, showDiploma }: { items: any[]; onDelete: (d: any) => void; showDiploma?: boolean }) {
  const [preview, setPreview] = useState<any>(null);
  if (items.length === 0) return <EmptyState icon={FileText} text="Aucun document" />;
  const isImage = (url: string) => /\.(png|jpe?g|gif|webp|svg|bmp)(\?|$)/i.test(url || "");
  return (
    <>
      <div className="space-y-2">{items.map((d: any) => (
        <div key={d.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border/50 bg-card/50">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <FileText className="w-5 h-5 text-accent shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{d.title}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                {showDiploma ? (
                  <>{d.diploma_level || "diplôme"} {d.diploma_field ? `• ${d.diploma_field}` : ""} {d.diploma_year ? `• ${d.diploma_year}` : ""} {d.issuing_institution ? `• ${d.issuing_institution}` : ""} {d.grade ? `• ${d.grade}` : ""}</>
                ) : (DOC_TYPES.find(x => x.value === d.doc_type)?.label || d.doc_type)}
              </p>
            </div>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setPreview(d)} title="Visualiser"><Eye className="w-4 h-4" /></Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" asChild title="Télécharger"><a href={d.file_url} target="_blank" rel="noreferrer" download><Download className="w-4 h-4" /></a></Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => onDelete(d)} title="Supprimer"><Trash2 className="w-4 h-4" /></Button>
          </div>
        </div>
      ))}</div>
      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-5xl w-[95vw] h-[90vh] p-0 flex flex-col">
          <DialogHeader className="p-4 border-b">
            <DialogTitle className="flex items-center justify-between gap-2 pr-8">
              <span className="truncate">{preview?.title}</span>
              {preview?.file_url && (
                <Button size="sm" variant="outline" asChild>
                  <a href={preview.file_url} target="_blank" rel="noreferrer" download className="gap-2">
                    <Download className="w-4 h-4" /> Télécharger
                  </a>
                </Button>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto bg-muted/30">
            {preview && (isImage(preview.file_url)
              ? <img src={preview.file_url} alt={preview.title} className="max-w-full max-h-full mx-auto object-contain" />
              : <iframe src={preview.file_url} title={preview.title} className="w-full h-full border-0" />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
