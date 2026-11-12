import { useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Search, Plus, Trash2, Calendar, History } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useInstitution } from "@/hooks/useInstitution";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { AcademicYearSelector } from "@/components/AcademicYearSelector";

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

const AdminRattrapagesPage = () => {
  const qc = useQueryClient();
  const { getLevels } = useInstitution();
  const { selectedYear, isViewingHistory } = useAcademicYear();
  const LEVELS = getLevels();
  const [filterFiliere, setFilterFiliere] = useState("all");
  const [filterLevel, setFilterLevel] = useState("all");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    user_id: "", subject_id: "", filiere_id: "", level: "", exam_date: "", location: "",
  });

  const { profile } = useAuth();
  const instId = profile?.institution_id;

  const { data: filieres = [] } = useQuery({
    queryKey: ["admin-filieres", instId],
    queryFn: async () => {
      let q = supabase.from("filieres").select("*").order("name");
      if (instId) q = q.eq("institution_id", instId);
      const { data } = await q;
      return data || [];
    },
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ["admin-subjects-rattrapage", form.filiere_id, form.level, instId],
    queryFn: async () => {
      let q = supabase.from("subjects").select("*");
      if (instId) q = q.eq("institution_id", instId);
      if (form.filiere_id) q = q.eq("filiere_id", form.filiere_id);
      if (form.level) q = q.eq("level", form.level);
      const { data } = await q.order("name");
      return data || [];
    },
  });

  const { data: students = [] } = useQuery({
    queryKey: ["admin-students-rattrapage", form.filiere_id, form.level, instId],
    queryFn: async () => {
      const { data: studentRoles } = await supabase.from("user_roles").select("user_id").eq("role", "user");
      if (!studentRoles || studentRoles.length === 0) return [];
      const ids = studentRoles.map((r: any) => r.user_id);
      let q = supabase.from("profiles").select("user_id, first_name, last_name, student_number, filiere_id, level").in("user_id", ids);
      if (instId) q = q.eq("institution_id", instId);
      if (form.filiere_id) q = q.eq("filiere_id", form.filiere_id);
      if (form.level) q = q.eq("level", form.level);
      const { data } = await q.order("last_name");
      return data || [];
    },
  });

  const { data: rattrapages = [] } = useQuery({
    queryKey: ["admin-rattrapages", filterFiliere, filterLevel, instId, selectedYear],
    enabled: !!instId,
    queryFn: async () => {
      const { data: instProfiles } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("institution_id", instId!);
      const instUserIds = (instProfiles || []).map((p: any) => p.user_id);
      if (instUserIds.length === 0) return [];

      let q = supabase.from("rattrapages").select("*, subjects(name, credits), filieres:filiere_id(name)").in("user_id", instUserIds);
      q = q.eq("academic_year", selectedYear);
      if (filterFiliere !== "all") q = q.eq("filiere_id", filterFiliere);
      if (filterLevel !== "all") q = q.eq("level", filterLevel);
      const { data } = await q.order("created_at", { ascending: false });
      if (!data) return [];

      const userIds = [...new Set(data.map((r: any) => r.user_id))];
      if (userIds.length === 0) return data;
      const { data: profiles } = await supabase.from("profiles").select("user_id, first_name, last_name, student_number").in("user_id", userIds);
      const profileMap: Record<string, any> = {};
      (profiles || []).forEach((p: any) => { profileMap[p.user_id] = p; });
      return data.map((r: any) => ({ ...r, profile: profileMap[r.user_id] }));
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data: grade } = await supabase.from("grades")
        .select("average")
        .eq("user_id", form.user_id)
        .eq("subject_id", form.subject_id)
        .maybeSingle();

      const { error } = await supabase.from("rattrapages").insert({
        user_id: form.user_id,
        subject_id: form.subject_id,
        filiere_id: form.filiere_id || null,
        level: form.level || null,
        original_average: grade?.average || null,
        exam_date: form.exam_date ? new Date(form.exam_date).toISOString() : null,
        location: form.location || null,
        status: "pending",
        academic_year: selectedYear,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-rattrapages"] });
      toast.success("Rattrapage créé !");
      setOpen(false);
      setForm({ user_id: "", subject_id: "", filiere_id: "", level: "", exam_date: "", location: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateGradeMutation = useMutation({
    mutationFn: async ({ id, rattrapage_grade, userId, subjectId, academicYear, subjectCredits }: { id: string; rattrapage_grade: number; userId: string; subjectId: string; academicYear: string; subjectCredits: number }) => {
      const passed = rattrapage_grade >= 10;
      const { error } = await supabase.from("rattrapages").update({
        rattrapage_grade,
        final_grade: rattrapage_grade,
        status: passed ? "passed" : "failed",
      }).eq("id", id);
      if (error) throw error;

      // Si validé : on attribue les crédits dans l'historique où la matière
      // figure dans ue_to_retake_ids (peu importe l'année — utile pour les redoublants
      // dont la matière à rattraper appartient à une année antérieure).
      // Si non validé : on s'assure que la matière reste dans ue_to_retake_ids
      // de son historique d'origine et n'est PAS comptée dans les crédits.
      {
        // 1. Chercher tous les historiques de l'étudiant
        const { data: histories } = await supabase
          .from("student_year_history")
          .select("*")
          .eq("user_id", userId)
          .order("academic_year", { ascending: false });

        // 2. Trouver l'historique contenant cette matière dans ue_to_retake_ids
        //    (priorité), sinon celui qui la contient déjà dans ue_validated_ids,
        //    sinon l'historique de l'année du rattrapage.
        let targetHistory = (histories || []).find(
          (h: any) => (h.ue_to_retake_ids || []).includes(subjectId)
        );
        if (!targetHistory) {
          targetHistory = (histories || []).find(
            (h: any) => (h.ue_validated_ids || []).includes(subjectId)
          );
        }
        if (!targetHistory) {
          targetHistory = (histories || []).find(
            (h: any) => h.academic_year === academicYear
          );
        }

        if (targetHistory) {
          const currentValidated: string[] = targetHistory.ue_validated_ids || [];
          const currentRetake: string[] = targetHistory.ue_to_retake_ids || [];
          const wasValidated = currentValidated.includes(subjectId);

          if (passed) {
            // Validé → ajouter aux UE validées + retirer des rattrapages + ajouter crédits
            if (!wasValidated) {
              const newValidated = [...currentValidated, subjectId];
              const newRetake = currentRetake.filter((id) => id !== subjectId);
              await supabase.from("student_year_history").update({
                ue_validated_ids: newValidated,
                ue_to_retake_ids: newRetake,
                credits_acquired: (targetHistory.credits_acquired || 0) + (subjectCredits || 0),
              }).eq("id", targetHistory.id);
            }
          } else {
            // Non validé → s'assurer que la matière est bien dans les rattrapages
            // ET retirer les crédits si elle avait été validée par erreur précédemment
            const newRetake = currentRetake.includes(subjectId)
              ? currentRetake
              : [...currentRetake, subjectId];
            const newValidated = currentValidated.filter((id) => id !== subjectId);
            const creditsDelta = wasValidated ? -(subjectCredits || 0) : 0;
            await supabase.from("student_year_history").update({
              ue_validated_ids: newValidated,
              ue_to_retake_ids: newRetake,
              credits_acquired: Math.max(0, (targetHistory.credits_acquired || 0) + creditsDelta),
            }).eq("id", targetHistory.id);
          }
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-rattrapages"] });
      qc.invalidateQueries({ queryKey: ["student-year-histories"] });
      toast.success("Note de rattrapage enregistrée !");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("rattrapages").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-rattrapages"] });
      toast.success("Supprimé !");
    },
  });

  const filtered = rattrapages.filter((r: any) => {
    if (!search) return true;
    const name = `${r.profile?.first_name || ""} ${r.profile?.last_name || ""} ${r.profile?.student_number || ""}`.toLowerCase();
    return name.includes(search.toLowerCase());
  });

  const statusBadge = (status: string) => {
    switch (status) {
      case "passed": return <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">Validé</Badge>;
      case "failed": return <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">Non validé</Badge>;
      default: return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">En attente</Badge>;
    }
  };

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={item} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Rattrapages</h1>
          <p className="text-muted-foreground mt-1">
            Gestion des examens de rattrapage — {selectedYear}
            {isViewingHistory && <span className="text-warning ml-2 font-medium">(historique)</span>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <AcademicYearSelector />
          {!isViewingHistory && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-amber-500 to-orange-600 text-white gap-2">
                <Plus className="w-4 h-4" /> Nouveau rattrapage
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Créer un rattrapage</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <Select value={form.filiere_id} onValueChange={(v) => setForm({ ...form, filiere_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Filière" /></SelectTrigger>
                    <SelectContent>
                      {filieres.map((f: any) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={form.level} onValueChange={(v) => setForm({ ...form, level: v })}>
                    <SelectTrigger><SelectValue placeholder="Niveau" /></SelectTrigger>
                    <SelectContent>
                      {LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Select value={form.user_id} onValueChange={(v) => setForm({ ...form, user_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Étudiant" /></SelectTrigger>
                  <SelectContent>
                    {students.map((s: any) => (
                      <SelectItem key={s.user_id} value={s.user_id}>
                        {s.first_name} {s.last_name} ({s.student_number || "—"})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={form.subject_id} onValueChange={(v) => setForm({ ...form, subject_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Matière" /></SelectTrigger>
                  <SelectContent>
                    {subjects.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <div className="grid grid-cols-2 gap-3">
                  <Input type="datetime-local" value={form.exam_date} onChange={(e) => setForm({ ...form, exam_date: e.target.value })} />
                  <Input placeholder="Salle" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
                </div>
                <Button
                  onClick={() => createMutation.mutate()}
                  disabled={!form.user_id || !form.subject_id || createMutation.isPending}
                  className="w-full bg-gradient-to-r from-amber-500 to-orange-600 text-white"
                >
                  {createMutation.isPending ? "Création..." : "Créer le rattrapage"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          )}
        </div>
      </motion.div>

      {/* Filters */}
      <motion.div variants={item} className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Rechercher..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={filterFiliere} onValueChange={setFilterFiliere}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les filières</SelectItem>
            {filieres.map((f: any) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterLevel} onValueChange={setFilterLevel}>
          <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous niveaux</SelectItem>
            {LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
      </motion.div>

      {/* Table */}
      <motion.div variants={item}>
        <Card className="border-border/50">
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  <th className="text-left p-4 text-sm font-semibold">Étudiant</th>
                  <th className="text-left p-4 text-sm font-semibold">Matière</th>
                  <th className="text-left p-4 text-sm font-semibold">Année d'origine</th>
                  <th className="text-left p-4 text-sm font-semibold">Moy. initiale</th>
                  <th className="text-left p-4 text-sm font-semibold">Note rattrapage</th>
                  <th className="text-left p-4 text-sm font-semibold">Crédits</th>
                  <th className="text-left p-4 text-sm font-semibold">Date</th>
                  <th className="text-left p-4 text-sm font-semibold">Statut</th>
                  <th className="text-left p-4 text-sm font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">Aucun rattrapage</td></tr>
                ) : filtered.map((r: any) => (
                  <tr key={r.id} className="border-b border-border/50 hover:bg-secondary/20">
                    <td className="p-4 text-sm font-medium">
                      {r.profile?.first_name} {r.profile?.last_name}
                      <span className="block text-xs text-muted-foreground">{r.profile?.student_number}</span>
                    </td>
                    <td className="p-4 text-sm text-muted-foreground">{(r as any).subjects?.name || "—"}</td>
                    <td className="p-4 text-sm">
                      <Badge variant="outline" className="gap-1 text-xs">
                        <History className="w-3 h-3" /> {r.academic_year || "—"}
                      </Badge>
                    </td>
                    <td className="p-4 text-sm">{r.original_average != null ? `${r.original_average}/20` : "—"}</td>
                    <td className="p-4">
                      <Input
                        type="number"
                        min="0"
                        max="20"
                        step="0.5"
                        className="w-20 h-8 text-sm"
                        defaultValue={r.rattrapage_grade || ""}
                        onBlur={(e) => {
                          const val = parseFloat(e.target.value);
                          if (!isNaN(val)) updateGradeMutation.mutate({
                            id: r.id,
                            rattrapage_grade: val,
                            userId: r.user_id,
                            subjectId: r.subject_id,
                            academicYear: r.academic_year || selectedYear,
                            subjectCredits: (r as any).subjects?.credits || 0,
                          });
                        }}
                      />
                    </td>
                    <td className="p-4 text-sm text-muted-foreground">{(r as any).subjects?.credits || "—"}</td>
                    <td className="p-4 text-sm text-muted-foreground">
                      {r.exam_date ? new Date(r.exam_date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
                    </td>
                    <td className="p-4">{statusBadge(r.status)}</td>
                    <td className="p-4">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => deleteMutation.mutate(r.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
};

export default AdminRattrapagesPage;
