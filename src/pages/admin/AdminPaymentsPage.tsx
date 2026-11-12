import { motion } from "framer-motion";
import { CreditCard, Plus, CheckCircle2, Clock, Search, WalletCards, Download } from "lucide-react";
import { downloadReceiptPdf } from "@/lib/receiptPdf";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { useInstitution } from "@/hooks/useInstitution";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import { AcademicYearSelector } from "@/components/AcademicYearSelector";
import { useState } from "react";
import { toast } from "sonner";

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

const formatCFA = (n: number) => n.toLocaleString("fr-FR") + " FCFA";

const AdminPaymentsPage = () => {
  const { getLevels, institution } = useInstitution();
  const { profile } = useAuth();
  const { selectedYear, isViewingHistory } = useAcademicYear();
  const instId = profile?.institution_id;
  const LEVELS = getLevels();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [filterFiliere, setFilterFiliere] = useState("all");
  const [filterLevel, setFilterLevel] = useState("all");
  const [search, setSearch] = useState("");
  const [advancePayment, setAdvancePayment] = useState<any | null>(null);
  const [advanceAmount, setAdvanceAmount] = useState("");

  const { data: filieres = [] } = useQuery({
    queryKey: ["admin-filieres", instId],
    queryFn: async () => {
      let q = supabase.from("filieres").select("*").order("name");
      if (instId) q = q.eq("institution_id", instId);
      const { data } = await q;
      return data || [];
    },
  });

  const { data: feeTypes = [] } = useQuery({
    queryKey: ["admin-fee-types", instId],
    queryFn: async () => {
      if (!instId) return [];
      const { data } = await supabase.from("fee_types").select("*").eq("institution_id", instId).eq("is_active", true).order("label");
      return data || [];
    },
    enabled: !!instId,
  });

  const { data: students = [] } = useQuery({
    queryKey: ["admin-students-pay", instId],
    queryFn: async () => {
      const { data: studentRoles } = await supabase.from("user_roles").select("user_id").eq("role", "user");
      if (!studentRoles || studentRoles.length === 0) return [];
      const ids = studentRoles.map((r: any) => r.user_id);
      let q = supabase.from("profiles").select("user_id, first_name, last_name, filiere_id, level, student_number, statut_boursier");
      if (instId) q = q.eq("institution_id", instId);
      q = q.in("user_id", ids);
      const { data } = await q;
      return data || [];
    },
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["admin-all-payments", instId, selectedYear],
    queryFn: async () => {
      let q = supabase.from("payments").select("*").order("created_at", { ascending: false });
      if (instId) q = q.eq("institution_id", instId);
      q = q.eq("academic_year", selectedYear);
      const { data } = await q;
      return data || [];
    },
  });

  useRealtimeSubscription("payments", [["admin-all-payments"]]);

  const studentMap = new Map(students.map(s => [s.user_id, s]));
  const filiereMap = new Map((filieres as any[]).map((f: any) => [f.id, f.name]));

  const downloadReceipt = async (p: any) => {
    const s: any = studentMap.get(p.user_id);
    if (!s) { toast.error("Étudiant introuvable"); return; }
    await downloadReceiptPdf({
      payment: p,
      student: { first_name: s.first_name, last_name: s.last_name, student_number: s.student_number, level: s.level, filiere_name: filiereMap.get(s.filiere_id) },
      institution: { name: (institution as any)?.name, logo_url: (institution as any)?.logo_url, address: (institution as any)?.address, phone: (institution as any)?.phone },
    });
  };

  // Filter payments
  const filteredPayments = payments.filter((p: any) => {
    const s = studentMap.get(p.user_id);
    if (!s) return filterFiliere === "all" && filterLevel === "all" && !search;
    const matchFiliere = filterFiliere === "all" || s.filiere_id === filterFiliere;
    const matchLevel = filterLevel === "all" || s.level === filterLevel;
    const matchSearch = !search || `${s.first_name} ${s.last_name} ${s.student_number}`.toLowerCase().includes(search.toLowerCase());
    return matchFiliere && matchLevel && matchSearch;
  });

  // Stats
  const totalAmount = filteredPayments.reduce((s, p) => s + p.amount, 0);
  const paidAmount = filteredPayments.reduce((s, p: any) => s + (p.paid_amount || (p.status === "paid" ? p.amount : 0)), 0);

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("payments").insert({
        user_id: selectedStudent,
        amount: parseInt(amount),
        description,
        due_date: dueDate || null,
        status: "pending",
        institution_id: instId || null,
        academic_year: selectedYear,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-all-payments"] });
      toast.success("Paiement ajouté");
      setOpen(false);
      setSelectedStudent(""); setAmount(""); setDescription(""); setDueDate("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const markPaid = useMutation({
    mutationFn: async (id: string) => {
      const payment = payments.find((p: any) => p.id === id) as any;
      if (!payment) throw new Error("Paiement introuvable");
      const { error } = await supabase.from("payments").update({ paid_amount: payment.amount, status: "paid" } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-all-payments"] });
      toast.success("Marqué comme payé");
    },
  });

  const saveAdvance = useMutation({
    mutationFn: async () => {
      if (!advancePayment) throw new Error("Paiement introuvable");
      const previousPaid = Number(advancePayment.paid_amount) || (advancePayment.status === "paid" ? Number(advancePayment.amount) : 0);
      const parsedValue = Number.parseInt(advanceAmount || "0", 10);
      const addition = Math.max(0, Number.isFinite(parsedValue) ? parsedValue : 0);
      const newPaid = Math.min(Number(advancePayment.amount), previousPaid + addition);
      const nextStatus = newPaid >= Number(advancePayment.amount) ? "paid" : newPaid > 0 ? "partial" : "pending";
      const { error } = await supabase.from("payments").update({ paid_amount: newPaid, status: nextStatus } as any).eq("id", advancePayment.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-all-payments"] });
      toast.success("Avance ajoutée et cumulée");
      setAdvancePayment(null);
      setAdvanceAmount("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground">Gestion des Paiements</h1>
          <p className="text-muted-foreground mt-1">
            {filteredPayments.length} paiement(s) — {selectedYear}
            {isViewingHistory && <span className="text-warning ml-2 font-medium">(historique — lecture seule)</span>}
            <span className="block text-xs mt-0.5">Payé: {formatCFA(paidAmount)} / Total: {formatCFA(totalAmount)}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <AcademicYearSelector />
          {!isViewingHistory && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-gold text-accent-foreground gap-2"><Plus className="w-4 h-4" /> Ajouter un paiement</Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nouveau paiement (tranche)</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <Select value={selectedStudent} onValueChange={setSelectedStudent}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un étudiant" /></SelectTrigger>
                <SelectContent>
                  {students.map((s: any) => (
                    <SelectItem key={s.user_id} value={s.user_id}>{s.first_name} {s.last_name} {s.student_number ? `(${s.student_number})` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {feeTypes.length > 0 && (
                <Select value="" onValueChange={(id) => {
                  const ft: any = feeTypes.find((f: any) => f.id === id);
                  if (ft) { setDescription(ft.label); setAmount(String(ft.amount)); }
                }}>
                  <SelectTrigger><SelectValue placeholder="Pré-remplir depuis un type de frais (Finance)" /></SelectTrigger>
                  <SelectContent>
                    {feeTypes.map((f: any) => (
                      <SelectItem key={f.id} value={f.id}>{f.label} — {formatCFA(f.amount)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Input placeholder="Description (ex: Tranche 1)" value={description} onChange={(e) => setDescription(e.target.value)} />
              <div className="grid grid-cols-2 gap-3">
                <Input type="number" placeholder="Montant (FCFA)" value={amount} onChange={(e) => setAmount(e.target.value)} />
                <Input type="date" placeholder="Date limite" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
              <Button onClick={() => createMutation.mutate()} disabled={!selectedStudent || !amount || !description || createMutation.isPending} className="w-full gradient-gold text-accent-foreground">
                {createMutation.isPending ? "Ajout..." : "Ajouter le paiement"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
          )}
        </div>
      </motion.div>

      {/* Filters */}
      <motion.div variants={item} className="flex flex-wrap gap-3">
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
            {LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Rechercher un étudiant..." className="pl-9 bg-secondary/50" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </motion.div>

      <motion.div variants={item}>
        <Card className="glass-card-elevated border-border/50 overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    <th className="text-left p-4 text-sm font-semibold text-foreground">Étudiant</th>
                    <th className="text-left p-4 text-sm font-semibold text-foreground">Description</th>
                    <th className="text-center p-4 text-sm font-semibold text-foreground">Montant initial</th>
                    <th className="text-center p-4 text-sm font-semibold text-foreground">Avance</th>
                    <th className="text-center p-4 text-sm font-semibold text-foreground">Reste</th>
                    <th className="text-center p-4 text-sm font-semibold text-foreground">Échéance</th>
                    <th className="text-center p-4 text-sm font-semibold text-foreground">Statut</th>
                    <th className="text-center p-4 text-sm font-semibold text-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPayments.length === 0 ? (
                    <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">Aucun paiement</td></tr>
                  ) : filteredPayments.map((p: any) => {
                    const s = studentMap.get(p.user_id);
                    const paid = p.paid_amount || (p.status === "paid" ? p.amount : 0);
                    const remaining = Math.max(0, p.amount - paid);
                    return (
                      <tr key={p.id} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                        <td className="p-4 text-sm font-medium text-foreground">{s ? `${s.first_name} ${s.last_name}` : p.user_id.slice(0, 8)}</td>
                        <td className="p-4 text-sm text-muted-foreground">{p.description}</td>
                        <td className="p-4 text-sm text-center font-medium">{formatCFA(p.amount)}</td>
                         <td className="p-4 text-sm text-center font-medium text-success">{formatCFA(paid)}</td>
                         <td className="p-4 text-sm text-center font-medium text-warning">{formatCFA(remaining)}</td>
                        <td className="p-4 text-sm text-center text-muted-foreground">{p.due_date ? new Date(p.due_date).toLocaleDateString("fr-FR") : "—"}</td>
                        <td className="p-4 text-center">
                          <span className={`text-xs font-medium px-2.5 py-1 rounded-full inline-flex items-center gap-1 ${p.status === "paid" ? "bg-success/15 text-success" : p.status === "partial" ? "bg-info/15 text-info" : "bg-warning/15 text-warning"}`}>
                            {p.status === "paid" ? <><CheckCircle2 className="w-3 h-3" /> Payé</> : p.status === "partial" ? <><WalletCards className="w-3 h-3" /> Avance</> : <><Clock className="w-3 h-3" /> En attente</>}
                          </span>
                        </td>
                        <td className="p-4 text-center space-x-2">
                          {!isViewingHistory && (
                            <Button variant="outline" size="sm" onClick={() => { setAdvancePayment(p); setAdvanceAmount(""); }} className="text-xs">Avance</Button>
                          )}
                          {p.status !== "paid" && !isViewingHistory && (
                            <Button variant="outline" size="sm" onClick={() => markPaid.mutate(p.id)} className="text-xs">Tout payer</Button>
                          )}
                          {paid > 0 && (
                            <Button variant="outline" size="sm" onClick={() => downloadReceipt(p)} className="text-xs"><Download className="w-3 h-3 mr-1" /> Reçu</Button>
                          )}
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

      <Dialog open={!!advancePayment} onOpenChange={(v) => !v && setAdvancePayment(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Ajouter une avance</DialogTitle></DialogHeader>
          {(() => {
            const prev = advancePayment ? (Number(advancePayment.paid_amount) || (advancePayment.status === "paid" ? Number(advancePayment.amount) : 0)) : 0;
            const total = advancePayment ? Number(advancePayment.amount) : 0;
            const add = Math.max(0, parseInt(advanceAmount || "0", 10) || 0);
            const newPaid = Math.min(total, prev + add);
            const remaining = Math.max(0, total - newPaid);
            const maxAdd = Math.max(0, total - prev);
            return (
              <div className="space-y-4">
                <div className="rounded-lg bg-secondary/30 border border-border/40 p-3 space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Montant initial</span><span className="font-medium">{formatCFA(total)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Déjà avancé</span><span className="font-medium text-success">{formatCFA(prev)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Reste actuel</span><span className="font-medium text-warning">{formatCFA(Math.max(0, total - prev))}</span></div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Nouvelle avance à ajouter (max {formatCFA(maxAdd)})</label>
                  <Input type="number" min="0" max={maxAdd} placeholder="Ex : 50000" value={advanceAmount} onChange={(e) => setAdvanceAmount(e.target.value)} />
                </div>
                <div className="rounded-lg bg-accent/10 border border-accent/30 p-3 space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Total payé après cette avance</span><span className="font-bold text-success">{formatCFA(newPaid)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Reste à payer</span><span className="font-bold text-warning">{formatCFA(remaining)}</span></div>
                </div>
                <Button onClick={() => saveAdvance.mutate()} disabled={!advancePayment || saveAdvance.isPending || add <= 0 || maxAdd <= 0} className="w-full gradient-gold text-accent-foreground">
                  {saveAdvance.isPending ? "Enregistrement..." : "Ajouter cette avance"}
                </Button>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};

export default AdminPaymentsPage;
