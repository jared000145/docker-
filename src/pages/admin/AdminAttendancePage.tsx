import { useCycle } from "@/hooks/useCycle";
import AdminSchoolAttendance from "@/components/admin/AdminSchoolAttendance";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useInstitution } from "@/hooks/useInstitution";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { ClipboardList, TrendingDown, Search, BookOpen, Users, FileDown, List, Pencil, Trash2, AlertTriangle, ShieldAlert } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import jsPDF from "@/lib/pdfClient";
import autoTable from "jspdf-autotable";

const LEVELS = ["L1", "L2", "L3", "M1", "M2"];

function AdminAttendanceUniversity() {
  const { institution } = useInstitution();
  const { selectedYear } = useAcademicYear();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterFiliere, setFilterFiliere] = useState<string>("all");
  const [filterNiveau, setFilterNiveau] = useState<string>("all");
  const [filterSubject, setFilterSubject] = useState<string>("all");

  // Edit / delete state
  const [editing, setEditing] = useState<any | null>(null);
  const [editStatus, setEditStatus] = useState<"present" | "absent">("present");
  const [editHours, setEditHours] = useState<string>("2");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: filieres = [] } = useQuery({
    queryKey: ["filieres", institution?.id],
    queryFn: async () => (await supabase.from("filieres").select("*").eq("institution_id", institution!.id)).data || [],
    enabled: !!institution?.id,
  });

  const { data: subjectsAll = [] } = useQuery({
    queryKey: ["subjects-all-quota", institution?.id],
    queryFn: async () =>
      (await supabase.from("subjects").select("id, name, filiere_id, level, quota_absence_hours").eq("institution_id", institution!.id)).data || [],
    enabled: !!institution?.id,
  });

  // Global default quota from institution settings
  const { data: globalQuota = 0 } = useQuery({
    queryKey: ["global-quota-absence", institution?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("parametres_etablissement")
        .select("quota_absence_hours")
        .eq("institution_id", institution!.id)
        .maybeSingle();
      return Number((data as any)?.quota_absence_hours) || 0;
    },
    enabled: !!institution?.id,
  });

  const subjectsMap = useMemo(() => {
    const m: Record<string, any> = {};
    subjectsAll.forEach((s: any) => { m[s.id] = s; });
    return m;
  }, [subjectsAll]);

  const { data: attendances = [], isLoading } = useQuery({
    queryKey: ["all-attendance", institution?.id, selectedYear, subjectsAll.length],
    queryFn: async () => {
      // Restrict to subjects of the current institution (attendance has no institution_id column)
      const subjIds = subjectsAll.map((s: any) => s.id);
      if (!subjIds.length) return [];
      const { data: att } = await supabase
        .from("attendance")
        .select("*, subjects(name, filiere_id, level, quota_absence_hours)")
        .in("subject_id", subjIds)
        .eq("academic_year", selectedYear)
        .order("date", { ascending: false });
      const list = att || [];
      const uids = [...new Set(list.map((a: any) => a.user_id))];
      if (!uids.length) return list;
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name, student_number, filiere_id, level")
        .in("user_id", uids);
      const pm: Record<string, any> = {};
      (profs || []).forEach((p: any) => { pm[p.user_id] = p; });
      return list.map((a: any) => ({ ...a, profiles: pm[a.user_id] }));
    },
    enabled: !!institution?.id && subjectsAll.length > 0,
  });

  const filieresMap = useMemo(() => {
    const m: Record<string, string> = {};
    filieres.forEach((f: any) => { m[f.id] = f.name; });
    return m;
  }, [filieres]);

  // Mutations
  const updateMut = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      const { error } = await supabase
        .from("attendance")
        .update({ status: editStatus, duration_hours: parseFloat(editHours) || 0 })
        .eq("id", editing.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pointage mis à jour");
      qc.invalidateQueries({ queryKey: ["all-attendance"] });
      setEditing(null);
    },
    onError: (e: any) => toast.error(e.message || "Erreur de mise à jour"),
  });

  const deleteMut = useMutation({
    mutationFn: async () => {
      if (!deleteId) return;
      const { error } = await supabase.from("attendance").delete().eq("id", deleteId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pointage supprimé");
      qc.invalidateQueries({ queryKey: ["all-attendance"] });
      setDeleteId(null);
    },
    onError: (e: any) => toast.error(e.message || "Erreur de suppression"),
  });

  // Filtered attendance
  const filteredAttendance = useMemo(() => {
    return attendances.filter((a: any) => {
      const fid = a.subjects?.filiere_id || a.profiles?.filiere_id;
      const lvl = a.subjects?.level || a.profiles?.level;
      if (filterFiliere !== "all" && fid !== filterFiliere) return false;
      if (filterNiveau !== "all" && lvl !== filterNiveau) return false;
      if (filterSubject !== "all" && a.subject_id !== filterSubject) return false;
      if (search) {
        const q = search.toLowerCase();
        const name = `${a.profiles?.first_name || ""} ${a.profiles?.last_name || ""} ${a.profiles?.student_number || ""}`.toLowerCase();
        if (!name.includes(q)) return false;
      }
      return true;
    });
  }, [attendances, filterFiliere, filterNiveau, filterSubject, search]);

  const subjectOptions = useMemo(() => {
    return subjectsAll.filter((s: any) => {
      if (filterFiliere !== "all" && s.filiere_id !== filterFiliere) return false;
      if (filterNiveau !== "all" && s.level !== filterNiveau) return false;
      return true;
    });
  }, [subjectsAll, filterFiliere, filterNiveau]);

  // Per student-subject quota tracking (from ALL attendances, not just filtered)
  // Quota: per-subject value if > 0, else fallback to global institution quota
  const quotaByUserSubject = useMemo(() => {
    const map: Record<string, { absent_h: number; quota: number; subject?: any; profile?: any }> = {};
    attendances.forEach((a: any) => {
      if (!a.subject_id) return;
      const key = `${a.user_id}::${a.subject_id}`;
      if (!map[key]) {
        const subjQuota = Number(a.subjects?.quota_absence_hours) || 0;
        map[key] = {
          absent_h: 0,
          quota: subjQuota > 0 ? subjQuota : globalQuota,
          subject: a.subjects,
          profile: a.profiles,
        };
      }
      if (a.status === "absent") map[key].absent_h += Number(a.duration_hours) || 0;
    });
    return map;
  }, [attendances, globalQuota]);

  // Per-student stats
  const studentStats = filteredAttendance.reduce((acc: any, a: any) => {
    const uid = a.user_id;
    if (!acc[uid])
      acc[uid] = { user_id: uid, profile: a.profiles, present: 0, absent: 0, hours_present: 0, hours_absent: 0, subjects: new Set(), exceeded: 0 };
    const h = Number(a.duration_hours) || 2;
    if (a.status === "present") { acc[uid].present++; acc[uid].hours_present += h; }
    else { acc[uid].absent++; acc[uid].hours_absent += h; }
    acc[uid].subjects.add(a.subjects?.name);
    return acc;
  }, {} as Record<string, any>);

  // Tag exceeded subject count per student
  Object.keys(studentStats).forEach((uid) => {
    let count = 0;
    Object.entries(quotaByUserSubject).forEach(([k, v]) => {
      if (k.startsWith(uid + "::") && v.quota > 0 && v.absent_h > v.quota) count++;
    });
    studentStats[uid].exceeded = count;
  });

  const studentsArray = Object.values(studentStats).sort((a: any, b: any) => b.absent - a.absent);

  const subjectStats = filteredAttendance.reduce((acc: any, a: any) => {
    const sid = a.subject_id;
    if (!sid) return acc;
    if (!acc[sid]) acc[sid] = { subject_id: sid, subject: a.subjects, present: 0, absent: 0, hours_total: 0, hours_absent: 0 };
    const h = Number(a.duration_hours) || 2;
    if (a.status === "present") acc[sid].present++;
    else { acc[sid].absent++; acc[sid].hours_absent += h; }
    acc[sid].hours_total += h;
    return acc;
  }, {} as Record<string, any>);

  const subjectsArray = Object.values(subjectStats);

  // Students who exceeded quota (from full data, filtered by current filters at subject level)
  const exceededList = useMemo(() => {
    return Object.entries(quotaByUserSubject)
      .filter(([_, v]) => v.quota > 0 && v.absent_h > v.quota)
      .filter(([_, v]) => {
        const fid = v.subject?.filiere_id || v.profile?.filiere_id;
        const lvl = v.subject?.level || v.profile?.level;
        if (filterFiliere !== "all" && fid !== filterFiliere) return false;
        if (filterNiveau !== "all" && lvl !== filterNiveau) return false;
        if (filterSubject !== "all" && !_.endsWith("::" + filterSubject)) return false;
        if (search) {
          const q = search.toLowerCase();
          const name = `${v.profile?.first_name || ""} ${v.profile?.last_name || ""} ${v.profile?.student_number || ""}`.toLowerCase();
          if (!name.includes(q)) return false;
        }
        return true;
      })
      .map(([k, v]) => ({ key: k, ...v }))
      .sort((a, b) => (b.absent_h - b.quota) - (a.absent_h - a.quota));
  }, [quotaByUserSubject, filterFiliere, filterNiveau, filterSubject, search]);

  const exportPDF = () => {
    if (filteredAttendance.length === 0) { toast.error("Aucune donnée à exporter"); return; }
    const doc = new jsPDF();
    const filiereLabel = filterFiliere === "all" ? "Toutes filières" : filieresMap[filterFiliere] || "—";
    const niveauLabel = filterNiveau === "all" ? "Tous niveaux" : filterNiveau;
    const subjectLabel = filterSubject === "all" ? "Toutes matières" : subjectsAll.find((s: any) => s.id === filterSubject)?.name || "—";

    doc.setFontSize(16);
    doc.text(`Liste des présences — ${institution?.name || ""}`, 14, 15);
    doc.setFontSize(10);
    doc.text(`Année académique: ${selectedYear}`, 14, 22);
    doc.text(`Filière: ${filiereLabel}  •  Niveau: ${niveauLabel}  •  Matière: ${subjectLabel}`, 14, 28);
    doc.text(`Total pointages: ${filteredAttendance.length}`, 14, 34);

    autoTable(doc, {
      startY: 40,
      head: [["Date", "Étudiant", "Matricule", "Matière", "Niveau", "Statut", "Heures"]],
      body: filteredAttendance.map((a: any) => [
        new Date(a.date).toLocaleDateString("fr-FR"),
        `${a.profiles?.last_name || ""} ${a.profiles?.first_name || ""}`.trim() || "—",
        a.profiles?.student_number || "—",
        a.subjects?.name || "—",
        a.subjects?.level || "—",
        a.status === "present" ? "Présent" : "Absent",
        `${a.duration_hours || 2}h`,
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [30, 58, 95] },
    });

    doc.save(`presences_${filiereLabel.replace(/\s+/g, "_")}_${niveauLabel}_${selectedYear}.pdf`);
    toast.success("PDF exporté avec succès");
  };

  const exportExceededPDF = () => {
    if (exceededList.length === 0) {
      toast.error("Aucun étudiant ayant dépassé son quota");
      return;
    }
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`Étudiants exclus d'examen (quota dépassé)`, 14, 15);
    doc.setFontSize(10);
    doc.text(`${institution?.name || ""} — Année ${selectedYear}`, 14, 22);
    doc.text(`Total: ${exceededList.length} étudiant(s)`, 14, 28);

    autoTable(doc, {
      startY: 34,
      head: [["Matricule", "Nom & Prénom", "Filière", "Niveau", "Matière", "Absent", "Quota", "Dépassement"]],
      body: exceededList.map((row: any) => [
        row.profile?.student_number || "—",
        `${row.profile?.last_name || ""} ${row.profile?.first_name || ""}`.trim() || "—",
        filieresMap[row.subject?.filiere_id || row.profile?.filiere_id] || "—",
        row.subject?.level || row.profile?.level || "—",
        row.subject?.name || "—",
        `${row.absent_h}h`,
        `${row.quota}h`,
        `+${(row.absent_h - row.quota).toFixed(1)}h`,
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [220, 38, 38] },
    });

    const safeName = (institution?.name || "etablissement").replace(/\s+/g, "_");
    doc.save(`quota_depasse_${safeName}_${selectedYear}.pdf`);
    toast.success("PDF exporté avec succès");
  };

  const openEdit = (a: any) => {
    setEditing(a);
    setEditStatus(a.status === "present" ? "present" : "absent");
    setEditHours(String(a.duration_hours || 2));
  };

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center md:justify-between gap-3"
      >
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <ClipboardList className="w-8 h-8 text-primary" />
            Suivi des présences
          </h1>
          <p className="text-muted-foreground mt-1">
            Année {selectedYear} — {filteredAttendance.length} / {attendances.length} pointages
          </p>
        </div>
        <Button onClick={exportPDF} variant="default">
          <FileDown className="w-4 h-4 mr-2" /> Exporter PDF
        </Button>
      </motion.div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Rechercher étudiant..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={filterFiliere} onValueChange={(v) => { setFilterFiliere(v); setFilterSubject("all"); }}>
            <SelectTrigger><SelectValue placeholder="Filière" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes filières</SelectItem>
              {filieres.map((f: any) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterNiveau} onValueChange={(v) => { setFilterNiveau(v); setFilterSubject("all"); }}>
            <SelectTrigger><SelectValue placeholder="Niveau" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous niveaux</SelectItem>
              {LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterSubject} onValueChange={setFilterSubject}>
            <SelectTrigger><SelectValue placeholder="Matière" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes matières</SelectItem>
              {subjectOptions.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Tabs defaultValue="list">
        <TabsList>
          <TabsTrigger value="list"><List className="w-4 h-4 mr-1" /> Liste détaillée</TabsTrigger>
          <TabsTrigger value="students"><Users className="w-4 h-4 mr-1" /> Par étudiant</TabsTrigger>
          <TabsTrigger value="subjects"><BookOpen className="w-4 h-4 mr-1" /> Par matière</TabsTrigger>
          <TabsTrigger value="exceeded">
            <ShieldAlert className="w-4 h-4 mr-1" /> Quota dépassé
            {exceededList.length > 0 && <Badge variant="destructive" className="ml-2 h-5 min-w-5 px-1">{exceededList.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        {/* === LIST VIEW === */}
        <TabsContent value="list">
          <Card>
            <CardContent className="pt-6">
              {isLoading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (<div key={i} className="h-12 bg-muted/30 animate-pulse rounded" />))}
                </div>
              ) : filteredAttendance.length === 0 ? (
                <p className="text-center text-muted-foreground py-12">Aucun pointage avec ces filtres.</p>
              ) : (
                <>
                  {/* Desktop table */}
                  <div className="hidden md:block overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Étudiant</TableHead>
                          <TableHead>Matricule</TableHead>
                          <TableHead>Matière</TableHead>
                          <TableHead>Filière</TableHead>
                          <TableHead>Niveau</TableHead>
                          <TableHead>Statut</TableHead>
                          <TableHead>Heures</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredAttendance.slice(0, 500).map((a: any) => (
                          <TableRow key={a.id}>
                            <TableCell>{new Date(a.date).toLocaleDateString("fr-FR")}</TableCell>
                            <TableCell className="font-medium">{a.profiles?.last_name} {a.profiles?.first_name}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{a.profiles?.student_number || "—"}</TableCell>
                            <TableCell>{a.subjects?.name || "—"}</TableCell>
                            <TableCell className="text-xs">{filieresMap[a.subjects?.filiere_id || a.profiles?.filiere_id] || "—"}</TableCell>
                            <TableCell><Badge variant="outline">{a.subjects?.level || "—"}</Badge></TableCell>
                            <TableCell>
                              {a.status === "present" ? (
                                <Badge className="bg-green-500/10 text-green-700 border-green-500/30">Présent</Badge>
                              ) : (
                                <Badge variant="destructive">Absent</Badge>
                              )}
                            </TableCell>
                            <TableCell>{a.duration_hours || 2}h</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button variant="ghost" size="icon" onClick={() => openEdit(a)} title="Modifier (justification)">
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => setDeleteId(a.id)} title="Supprimer" className="text-destructive hover:text-destructive">
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {filteredAttendance.length > 500 && (
                      <p className="text-xs text-muted-foreground mt-3 text-center">
                        Affichage des 500 premières lignes. Exportez en PDF pour la liste complète.
                      </p>
                    )}
                  </div>
                  {/* Mobile cards */}
                  <div className="md:hidden space-y-2">
                    {filteredAttendance.slice(0, 200).map((a: any) => (
                      <div key={a.id} className="border rounded-lg p-3 space-y-2">
                        <div className="flex justify-between items-start gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold text-sm truncate">{a.profiles?.last_name} {a.profiles?.first_name}</p>
                            <p className="text-xs text-muted-foreground truncate">{a.subjects?.name}</p>
                          </div>
                          {a.status === "present" ? (
                            <Badge className="bg-green-500/10 text-green-700 border-green-500/30 shrink-0">Présent</Badge>
                          ) : (
                            <Badge variant="destructive" className="shrink-0">Absent</Badge>
                          )}
                        </div>
                        <div className="flex justify-between items-center">
                          <div className="flex gap-2 text-xs text-muted-foreground">
                            <span>{new Date(a.date).toLocaleDateString("fr-FR")}</span>
                            <span>•</span>
                            <span>{a.duration_hours || 2}h</span>
                          </div>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(a)}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(a.id)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* === BY STUDENT === */}
        <TabsContent value="students" className="space-y-3">
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => <Card key={i} className="h-24 animate-pulse bg-muted/30" />)}
            </div>
          ) : studentsArray.length === 0 ? (
            <Card className="p-12 text-center text-muted-foreground">Aucune donnée.</Card>
          ) : (
            studentsArray.map((s: any, i: number) => {
              const totalH = s.hours_present + s.hours_absent;
              const rate = totalH ? (s.hours_present / totalH) * 100 : 0;
              return (
                <motion.div key={s.user_id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}>
                  <Card>
                    <CardContent className="pt-4 space-y-2">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div>
                          <p className="font-semibold">{s.profile?.last_name} {s.profile?.first_name}</p>
                          <p className="text-xs text-muted-foreground">{s.profile?.student_number} • {s.subjects.size} matière(s)</p>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          <Badge variant="outline" className="bg-green-500/10 text-green-700">{s.hours_present}h présent</Badge>
                          <Badge variant="outline" className="bg-red-500/10 text-red-700">{s.hours_absent}h absent</Badge>
                          {s.exceeded > 0 && (
                            <Badge variant="destructive"><ShieldAlert className="w-3 h-3 mr-1" /> {s.exceeded} matière(s) bloquée(s)</Badge>
                          )}
                          {s.absent >= 3 && s.exceeded === 0 && <Badge variant="destructive"><TrendingDown className="w-3 h-3 mr-1" /> Risque</Badge>}
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-xs text-muted-foreground mb-1">
                          <span>Taux de présence</span>
                          <span className="font-semibold">{rate.toFixed(1)}%</span>
                        </div>
                        <Progress value={rate} className="h-2" />
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })
          )}
        </TabsContent>

        {/* === BY SUBJECT === */}
        <TabsContent value="subjects" className="space-y-3">
          {subjectsArray.length === 0 ? (
            <Card className="p-12 text-center text-muted-foreground">Aucune matière correspondante.</Card>
          ) : (
            subjectsArray.map((s: any, i: number) => {
              const total = s.present + s.absent;
              const rate = total ? (s.present / total) * 100 : 0;
              const quota = Number(s.subject?.quota_absence_hours) || 0;
              return (
                <motion.div key={s.subject_id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}>
                  <Card>
                    <CardContent className="pt-4 space-y-2">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div>
                          <p className="font-semibold">{s.subject?.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {filieresMap[s.subject?.filiere_id] || "—"} • {s.subject?.level} • {s.hours_total}h total
                          </p>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          <Badge>{rate.toFixed(0)}% présence</Badge>
                          {quota > 0 ? (
                            <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/30">
                              Quota: {quota}h
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">Pas de quota</Badge>
                          )}
                        </div>
                      </div>
                      <Progress value={rate} className="h-2" />
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })
          )}
        </TabsContent>

        {/* === EXCEEDED QUOTA === */}
        <TabsContent value="exceeded" className="space-y-3">
          {exceededList.length === 0 ? (
            <Card className="p-12 text-center text-muted-foreground">
              <ShieldAlert className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
              Aucun étudiant n'a dépassé son quota d'absence.
            </Card>
          ) : (
            <>
              <Card className="bg-destructive/5 border-destructive/30">
                <CardContent className="pt-4 flex items-start gap-3 flex-wrap">
                  <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                  <div className="text-sm flex-1 min-w-[200px]">
                    <p className="font-semibold text-destructive">{exceededList.length} étudiant(s) exclu(s) d'examen</p>
                    <p className="text-muted-foreground">Ces étudiants ont dépassé le quota d'absence et ne peuvent pas se présenter à l'examen de la matière concernée.</p>
                  </div>
                  <Button onClick={exportExceededPDF} variant="destructive" size="sm">
                    <FileDown className="w-4 h-4 mr-2" /> Exporter PDF
                  </Button>
                </CardContent>
              </Card>
              {exceededList.map((row: any, i: number) => {
                const over = row.absent_h - row.quota;
                return (
                  <motion.div key={row.key} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}>
                    <Card className="border-destructive/40">
                      <CardContent className="pt-4 space-y-2">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div>
                            <p className="font-semibold">{row.profile?.last_name} {row.profile?.first_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {row.profile?.student_number || "—"} • {row.subject?.name} ({row.subject?.level})
                            </p>
                          </div>
                          <div className="flex gap-2 flex-wrap">
                            <Badge variant="outline" className="bg-red-500/10 text-red-700">{row.absent_h}h absent</Badge>
                            <Badge variant="outline">Quota: {row.quota}h</Badge>
                            <Badge variant="destructive">+{over.toFixed(1)}h dépassement</Badge>
                          </div>
                        </div>
                        <Progress value={Math.min(100, (row.absent_h / row.quota) * 100)} className="h-2" />
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* === EDIT DIALOG === */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier le pointage</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="text-sm bg-muted/40 rounded-md p-3 space-y-1">
                <p className="font-medium">{editing.profiles?.last_name} {editing.profiles?.first_name}</p>
                <p className="text-xs text-muted-foreground">
                  {editing.subjects?.name} • {new Date(editing.date).toLocaleDateString("fr-FR")}
                </p>
              </div>
              <div className="space-y-2">
                <Label>Statut</Label>
                <Select value={editStatus} onValueChange={(v: any) => setEditStatus(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="present">Présent (justifié)</SelectItem>
                    <SelectItem value="absent">Absent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Durée (heures)</Label>
                <Input type="number" min="0" step="0.5" value={editHours} onChange={(e) => setEditHours(e.target.value)} />
                <p className="text-xs text-muted-foreground">
                  Vous pouvez réduire les heures d'absence si l'étudiant a fourni une justification.
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Annuler</Button>
            <Button onClick={() => updateMut.mutate()} disabled={updateMut.isPending}>
              {updateMut.isPending ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* === DELETE CONFIRMATION === */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce pointage ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est définitive et supprimera l'historique de ce pointage.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteMut.mutate()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

const AdminAttendancePage = () => {
  const { hasUniversite, isLoading } = useCycle();
  if (isLoading) return null;
  if (!hasUniversite) return <AdminSchoolAttendance />;
  return <AdminAttendanceUniversity />;
};

export default AdminAttendancePage;
