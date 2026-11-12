import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Award, BarChart3, CheckCircle2, Clock, Download, FileText, Sparkles, Upload } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { toast } from "sonner";

const STATUS_LABEL: Record<string, string> = { present: "Présent", absent: "Absent", late: "Retard", justified: "Justifié" };
const semesterFromDate = (d: string) => {
  const m = new Date(d).getMonth() + 1;
  return m >= 9 || m <= 1 ? "S1" : "S2";
};
const currentSemester = () => (new Date().getMonth() + 1 >= 9 || new Date().getMonth() + 1 <= 1 ? "S1" : "S2");

const StudentAbsencesPage = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [semFilter, setSemFilter] = useState<"all" | "S1" | "S2">("all");
  const [dialogRow, setDialogRow] = useState<any>(null);
  const [file, setFile] = useState<File | null>(null);
  const [reason, setReason] = useState("");
  const [uploading, setUploading] = useState(false);

  const { data: rows = [] } = useQuery({
    queryKey: ["student-absences", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("attendance")
        .select("*, subjects(name)")
        .eq("user_id", user!.id)
        .order("date", { ascending: false });
      return data || [];
    },
  });

  const filtered = useMemo(() => {
    if (semFilter === "all") return rows;
    return (rows as any[]).filter((r) => semesterFromDate(r.date) === semFilter);
  }, [rows, semFilter]);

  const absentOrLate = (r: any) => r.status === "absent" || r.status === "late";

  const totalH = (list: any[]) => list.filter(absentOrLate).reduce((s, r) => s + Number(r.duration_hours || 0), 0);
  const kpi = {
    global: totalH(rows as any[]),
    s1: totalH((rows as any[]).filter((r) => semesterFromDate(r.date) === "S1")),
    s2: totalH((rows as any[]).filter((r) => semesterFromDate(r.date) === "S2")),
    current: totalH((rows as any[]).filter((r) => semesterFromDate(r.date) === currentSemester())),
  };

  const bySubject = useMemo(() => {
    const map: Record<string, { name: string; hours: number }> = {};
    (rows as any[]).filter(absentOrLate).forEach((r) => {
      const name = r.subjects?.name || "Autre";
      if (!map[name]) map[name] = { name, hours: 0 };
      map[name].hours += Number(r.duration_hours || 0);
    });
    return Object.values(map).sort((a, b) => b.hours - a.hours);
  }, [rows]);

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!dialogRow || !file || !user) throw new Error("Fichier requis");
      const ext = file.name.split(".").pop();
      const path = `${user.id}/${dialogRow.id}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("justificatifs").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { error: updErr } = await supabase
        .from("attendance")
        .update({
          justificatif_url: path,
          justificatif_reason: reason,
          justificatif_status: "pending",
          justificatif_submitted_at: new Date().toISOString(),
        } as any)
        .eq("id", dialogRow.id);
      if (updErr) throw updErr;
    },
    onSuccess: () => {
      toast.success("Justificatif envoyé, en attente de validation");
      qc.invalidateQueries({ queryKey: ["student-absences"] });
      setDialogRow(null);
      setFile(null);
      setReason("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const download = async (path: string) => {
    const { data, error } = await supabase.storage.from("justificatifs").createSignedUrl(path, 60);
    if (error) { toast.error("Impossible de télécharger"); return; }
    window.open(data.signedUrl, "_blank");
  };

  const badgeFor = (r: any) => {
    if (r.status === "present") return <Badge variant="default">Présent</Badge>;
    if (r.status === "justified" || r.justificatif_status === "approved")
      return <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30">Justifiée</Badge>;
    if (r.justificatif_status === "pending")
      return <Badge className="bg-amber-500/15 text-amber-700 border-amber-500/30">En attente</Badge>;
    if (r.status === "late") return <Badge className="bg-amber-500/15 text-amber-700 border-amber-500/30">Retard</Badge>;
    return <Badge variant="destructive">Non justifiée</Badge>;
  };

  const noAbs = (rows as any[]).filter(absentOrLate).length === 0;

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl md:text-3xl font-heading font-bold">Mes absences</h1>
        <p className="text-muted-foreground text-sm mt-1">Suivi détaillé et gestion des justificatifs</p>
      </motion.div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {[
          { label: "Total cumulé", value: kpi.global, icon: BarChart3, color: "from-blue-500 to-indigo-600" },
          { label: "Semestre 1", value: kpi.s1, icon: Clock, color: "from-violet-500 to-purple-600" },
          { label: "Semestre 2", value: kpi.s2, icon: Clock, color: "from-fuchsia-500 to-pink-600" },
          { label: `Semestre en cours (${currentSemester()})`, value: kpi.current, icon: AlertTriangle, color: "from-orange-500 to-red-600" },
        ].map((k, i) => (
          <motion.div key={k.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className="overflow-hidden relative">
              <div className={`absolute inset-0 bg-gradient-to-br ${k.color} opacity-10`} />
              <CardContent className="p-4 relative">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">{k.label}</p>
                    <p className="text-2xl md:text-3xl font-bold mt-1">{k.value.toFixed(1)}<span className="text-sm font-normal text-muted-foreground ml-1">h</span></p>
                  </div>
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${k.color} flex items-center justify-center`}>
                    <k.icon className="w-5 h-5 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {noAbs && (
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <Card className="border-emerald-500/40 bg-gradient-to-br from-emerald-500/10 to-teal-500/10">
            <CardContent className="p-8 text-center space-y-3">
              <div className="mx-auto w-16 h-16 rounded-full bg-emerald-500 flex items-center justify-center">
                <Award className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-emerald-700">Félicitations, 0 absence !</h3>
              <p className="text-sm text-muted-foreground">Continue comme ça, l'assiduité paie 🎉</p>
              <Sparkles className="w-5 h-5 text-amber-500 mx-auto animate-pulse" />
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Chart */}
      {bySubject.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><BarChart3 className="w-4 h-4" /> Répartition par matière</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bySubject} margin={{ top: 10, right: 10, left: -20, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="name" angle={-25} textAnchor="end" fontSize={11} interval={0} />
                <YAxis fontSize={11} />
                <RTooltip formatter={(v: any) => `${v}h`} />
                <Bar dataKey="hours" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
          <CardTitle className="text-base">Historique détaillé</CardTitle>
          <Tabs value={semFilter} onValueChange={(v) => setSemFilter(v as any)}>
            <TabsList>
              <TabsTrigger value="all">Tous</TabsTrigger>
              <TabsTrigger value="S1">S1</TabsTrigger>
              <TabsTrigger value="S2">S2</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Matière</TableHead>
                  <TableHead>Durée</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Aucune donnée</TableCell></TableRow>
                )}
                {(filtered as any[]).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap text-sm">{new Date(r.date).toLocaleDateString("fr-FR")}</TableCell>
                    <TableCell className="text-sm font-medium">{r.subjects?.name || "—"}</TableCell>
                    <TableCell className="text-sm">{r.duration_hours ? `${Number(r.duration_hours).toFixed(1)} h` : "—"}</TableCell>
                    <TableCell>{badgeFor(r)}</TableCell>
                    <TableCell className="text-right">
                      {r.justificatif_url ? (
                        <Button variant="ghost" size="sm" onClick={() => download(r.justificatif_url)}>
                          <Download className="w-4 h-4 mr-1" /> Justificatif
                        </Button>
                      ) : absentOrLate(r) && r.status !== "justified" ? (
                        <Button variant="outline" size="sm" onClick={() => { setDialogRow(r); setFile(null); setReason(""); }}>
                          <Upload className="w-4 h-4 mr-1" /> Soumettre
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!dialogRow} onOpenChange={(v) => !v && setDialogRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><FileText className="w-5 h-5" /> Soumettre un justificatif</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Absence du <b>{dialogRow && new Date(dialogRow.date).toLocaleDateString("fr-FR")}</b> — {dialogRow?.subjects?.name}
            </div>
            <div>
              <Label>Motif</Label>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex : Certificat médical, convocation..." rows={3} />
            </div>
            <div>
              <Label>Fichier (PDF ou image)</Label>
              <Input type="file" accept="application/pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogRow(null)}>Annuler</Button>
            <Button onClick={() => uploadMutation.mutate()} disabled={!file || uploadMutation.isPending}>
              {uploadMutation.isPending ? "Envoi..." : "Envoyer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StudentAbsencesPage;
