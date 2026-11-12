import {useCampus} from "@/hooks/useCampus";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useInstitution } from "@/hooks/useInstitution";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChevronDown, ChevronUp, Download, Search, CheckCircle2, Wallet, Plus } from "lucide-react";
import { toast } from "sonner";
import { downloadReceiptPdf } from "@/lib/receiptPdf";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

const fmt = (n: number) => (Number(n) || 0).toLocaleString("fr-FR") + " FCFA";
const frStatus = (s: string) => s === "paid" ? "Payé" : s === "partial" ? "Partiel" : s === "failed" ? "Échec" : "Non payé";

export default function FinancePaymentsGrouped() {
  const { institution, getLevels } = useInstitution();
  const { selectedYear, isViewingHistory } = useAcademicYear();
  const { profile } = useAuth();
  const instId = institution?.id;
  const {campusId} = useCampus();
  const qc = useQueryClient();
  const LEVELS = getLevels();

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState("");
  const [fFil, setFFil] = useState("all");
  const [fLevel, setFLevel] = useState("all");
  const [fStatus, setFStatus] = useState("all");
  const [fType, setFType] = useState("all");
  const [advance, setAdvance] = useState<any | null>(null);
  const [advAmount, setAdvAmount] = useState("");
  const [addOpen, setAddOpen] = useState<{ user: any } | null>(null);
  const [newDesc, setNewDesc] = useState("");
  const [newAmount, setNewAmount] = useState("");

  const { data: students = [] } = useQuery({
    queryKey: ["fpg-students", instId, campusId],
    enabled: !!instId,
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "user");
      const ids = (roles || []).map((r: any) => r.user_id);
      if (!ids.length) return [];
      const { data } = await supabase.from("profiles")
        .select("user_id, first_name, last_name, student_number, avatar_url, filiere_id, level, campus_id")
        .eq("institution_id", instId!).in("user_id", ids);
      return (data || []).filter((row: any) => !campusId || !("campus_id" in row) || row.campus_id === campusId);
    },
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["fpg-payments", instId, selectedYear, campusId],
    enabled: !!instId,
    queryFn: async () => {
      const { data } = await supabase.from("payments").select("*")
        .eq("institution_id", instId!).eq("academic_year", selectedYear)
        .order("created_at", { ascending: false });
      return (data || []).filter((row: any) => !campusId || !("campus_id" in row) || row.campus_id === campusId);
    },
  });

  const { data: filieres = [] } = useQuery({
    queryKey: ["fpg-fil", instId, campusId],
    enabled: !!instId,
    queryFn: async () => (await supabase.from("filieres").select("id,name").eq("institution_id", instId!)).data || [],
  });
  const { data: feeTypes = [] } = useQuery({
    queryKey: ["fpg-fees", instId, campusId],
    enabled: !!instId,
    queryFn: async () => (await supabase.from("fee_types").select("*").eq("institution_id", instId!).eq("is_active", true)).data || [],
  });

  const filMap = useMemo(() => new Map((filieres as any[]).map(f => [f.id, f.name])), [filieres]);
  const stuMap = useMemo(() => new Map(students.map((s: any) => [s.user_id, s])), [students]);

  // Group payments by student
  const grouped = useMemo(() => {
    const m = new Map<string, { student: any; items: any[]; total: number; paid: number }>();
    for (const p of payments as any[]) {
      const s = stuMap.get(p.user_id);
      if (!s) continue;
      // Filtres
      if (fFil !== "all" && s.filiere_id !== fFil) continue;
      if (fLevel !== "all" && s.level !== fLevel) continue;
      if (fType !== "all" && p.description !== fType) continue;
      if (fStatus !== "all") {
        const st = p.status;
        if (fStatus === "paid" && st !== "paid") continue;
        if (fStatus === "unpaid" && st === "paid") continue;
        if (fStatus === "partial" && st !== "partial") continue;
      }
      if (search) {
        const q = search.toLowerCase();
        if (!`${s.first_name} ${s.last_name} ${s.student_number || ""}`.toLowerCase().includes(q)) continue;
      }
      const row = m.get(p.user_id) || { student: s, items: [], total: 0, paid: 0 };
      row.items.push(p);
      row.total += Number(p.amount || 0);
      row.paid += Number(p.paid_amount || 0);
      m.set(p.user_id, row);
    }
    return Array.from(m.values()).sort((a, b) =>
      `${a.student.last_name} ${a.student.first_name}`.localeCompare(`${b.student.last_name} ${b.student.first_name}`)
    );
  }, [payments, stuMap, fFil, fLevel, fType, fStatus, search]);

  const downloadReceipt = async (p: any) => {
    const s: any = stuMap.get(p.user_id);
    if (!s) return;
    await downloadReceiptPdf({
      payment: p,
      student: { first_name: s.first_name, last_name: s.last_name, student_number: s.student_number, level: s.level, filiere_name: filMap.get(s.filiere_id) },
      institution: { name: (institution as any)?.name, logo_url: (institution as any)?.logo_url, address: (institution as any)?.address, phone: (institution as any)?.phone },
    });
  };

  const markPaid = useMutation({
    mutationFn: async (p: any) => {
      const { error } = await supabase.from("payments").update({ paid_amount: p.amount, status: "paid", updated_by: profile?.user_id } as any).eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fpg-payments", campusId] }); toast.success("Frais soldé"); },
    onError: (e: any) => toast.error(e.message),
  });

  const saveAdvance = useMutation({
    mutationFn: async () => {
      if (!advance) return;
      const add = Math.max(0, parseInt(advAmount || "0", 10) || 0);
      const prev = Number(advance.paid_amount) || 0;
      const newPaid = Math.min(Number(advance.amount), prev + add);
      const status = newPaid >= Number(advance.amount) ? "paid" : newPaid > 0 ? "partial" : "pending";
      const { error } = await supabase.from("payments").update({ paid_amount: newPaid, status, updated_by: profile?.user_id } as any).eq("id", advance.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fpg-payments", campusId] });
      toast.success("Avance enregistrée");
      setAdvance(null); setAdvAmount("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const addFee = useMutation({
    mutationFn: async () => {
      if (!addOpen?.user || !newDesc || !newAmount) return;
      const { error } = await supabase.from("payments").insert({
        user_id: addOpen.user.user_id,
        description: newDesc,
        amount: parseInt(newAmount, 10),
        status: "pending",
        institution_id: instId!,
        academic_year: selectedYear,
        created_by: profile?.user_id,
        updated_by: profile?.user_id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fpg-payments", campusId] });
      toast.success("Frais ajouté");
      setAddOpen(null); setNewDesc(""); setNewAmount("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const types = useMemo(() => Array.from(new Set((payments as any[]).map(p => p.description))), [payments]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card className="glass-card-elevated">
        <CardContent className="p-3 grid grid-cols-2 md:grid-cols-6 gap-2">
          <div className="relative col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Rechercher étudiant..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={fFil} onValueChange={setFFil}>
            <SelectTrigger><SelectValue placeholder="Filière" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes filières</SelectItem>
              {(filieres as any[]).map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={fLevel} onValueChange={setFLevel}>
            <SelectTrigger><SelectValue placeholder="Niveau" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous niveaux</SelectItem>
              {LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={fType} onValueChange={setFType}>
            <SelectTrigger><SelectValue placeholder="Type de frais" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous types</SelectItem>
              {types.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={fStatus} onValueChange={setFStatus}>
            <SelectTrigger><SelectValue placeholder="Statut" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous statuts</SelectItem>
              <SelectItem value="paid">Payé</SelectItem>
              <SelectItem value="partial">Partiel</SelectItem>
              <SelectItem value="unpaid">Non payé</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">{grouped.length} étudiant(s) — {selectedYear}</p>

      <div className="space-y-3">
        {grouped.length === 0 && (
          <Card><CardContent className="p-8 text-center text-muted-foreground">Aucun paiement.</CardContent></Card>
        )}
        {grouped.map((g) => {
          const isOpen = expanded[g.student.user_id] ?? false;
          const pct = g.total ? Math.round((g.paid / g.total) * 100) : 0;
          return (
            <motion.div key={g.student.user_id} layout>
              <Card className="glass-card-elevated">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    {g.student.avatar_url ? (
                      <img src={g.student.avatar_url} alt={`Photo de ${g.student.first_name} ${g.student.last_name}`} className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-sm font-semibold">
                        {(g.student.first_name?.[0] || "") + (g.student.last_name?.[0] || "")}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{g.student.last_name} {g.student.first_name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {filMap.get(g.student.filiere_id) || "—"} · {g.student.level || "—"} {g.student.student_number ? `· ${g.student.student_number}` : ""}
                      </div>
                    </div>
                    <div className="text-right hidden sm:block min-w-[180px]">
                      <div className="text-xs text-muted-foreground">Payé / Total</div>
                      <div className="font-bold text-sm"><span className="text-success">{fmt(g.paid)}</span> / {fmt(g.total)}</div>
                      <Progress value={pct} className="h-1.5 mt-1" />
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => setExpanded((e) => ({ ...e, [g.student.user_id]: !isOpen }))}>
                      {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </Button>
                  </div>

                  <AnimatePresence>
                    {isOpen && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                        <div className="mt-4 space-y-2">
                          {g.items.map((p) => {
                            const paid = Number(p.paid_amount || 0);
                            const remaining = Math.max(0, Number(p.amount) - paid);
                            return (
                              <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-md bg-secondary/30 border border-border/40">
                                <div className="flex-1 min-w-[180px]">
                                  <div className="text-sm font-medium">{p.description}</div>
                                  <div className="text-xs text-muted-foreground">
                                    Initial {fmt(p.amount)} · Avancé <span className="text-success">{fmt(paid)}</span> · Reste <span className="text-warning">{fmt(remaining)}</span>
                                  </div>
                                </div>
                                <Badge variant={p.status === "paid" ? "default" : "secondary"} className={p.status === "paid" ? "bg-success/15 text-success" : p.status === "partial" ? "bg-info/15 text-info" : "bg-warning/15 text-warning"}>
                                  {frStatus(p.status)}
                                </Badge>
                                <div className="flex gap-1">
                                  {!isViewingHistory && p.status !== "paid" && (
                                    <>
                                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setAdvance(p); setAdvAmount(""); }}>Avance</Button>
                                      <ConfirmDialog
                                        trigger={<Button size="sm" variant="outline" className="h-7 text-xs">Tout payer</Button>}
                                        title="Marquer comme totalement payé"
                                        description="Êtes-vous sûr de vouloir marquer toutes les tranches de ce frais comme payées ?"
                                        confirmText="Tout payer"
                                        destructive={false}
                                        onConfirm={() => markPaid.mutate(p)}
                                      />
                                    </>
                                  )}
                                  {paid > 0 && (
                                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => downloadReceipt(p)}>
                                      <Download className="w-3 h-3 mr-1" /> Reçu
                                    </Button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                          {!isViewingHistory && (
                            <Button size="sm" variant="ghost" className="text-xs" onClick={() => { setAddOpen({ user: g.student }); setNewDesc(""); setNewAmount(""); }}>
                              <Plus className="w-3 h-3 mr-1" /> Ajouter un frais
                            </Button>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Advance dialog */}
      <Dialog open={!!advance} onOpenChange={(v) => !v && setAdvance(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Enregistrer une avance</DialogTitle></DialogHeader>
          {advance && (() => {
            const prev = Number(advance.paid_amount) || 0;
            const total = Number(advance.amount);
            const max = Math.max(0, total - prev);
            const add = Math.max(0, parseInt(advAmount || "0", 10) || 0);
            const newPaid = Math.min(total, prev + add);
            return (
              <div className="space-y-3">
                <div className="rounded-lg bg-secondary/30 p-3 text-sm space-y-1">
                  <div className="flex justify-between"><span className="text-muted-foreground">Frais</span><span>{advance.description}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Initial</span><span>{fmt(total)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Déjà payé</span><span className="text-success">{fmt(prev)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Reste</span><span className="text-warning">{fmt(max)}</span></div>
                </div>
                <Input type="number" min="0" max={max} value={advAmount} onChange={(e) => setAdvAmount(e.target.value)} placeholder={`Montant à ajouter (max ${fmt(max)})`} />
                <div className="text-xs text-muted-foreground">Nouveau total payé : <span className="font-medium text-success">{fmt(newPaid)}</span></div>
                <Button className="w-full" onClick={() => saveAdvance.mutate()} disabled={!advAmount || add <= 0 || saveAdvance.isPending}>
                  <Wallet className="w-4 h-4 mr-2" /> Enregistrer l'avance
                </Button>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Add fee dialog */}
      <Dialog open={!!addOpen} onOpenChange={(v) => !v && setAddOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Ajouter un frais — {addOpen?.user.first_name} {addOpen?.user.last_name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {(feeTypes as any[]).length > 0 && (
              <Select value="" onValueChange={(id) => {
                const ft: any = (feeTypes as any[]).find((f: any) => f.id === id);
                if (ft) { setNewDesc(ft.label); setNewAmount(String(ft.amount)); }
              }}>
                <SelectTrigger><SelectValue placeholder="Pré-remplir depuis un type de frais" /></SelectTrigger>
                <SelectContent>
                  {(feeTypes as any[]).map((f) => <SelectItem key={f.id} value={f.id}>{f.label} — {fmt(f.amount)}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <Input placeholder="Description" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
            <Input type="number" placeholder="Montant (FCFA)" value={newAmount} onChange={(e) => setNewAmount(e.target.value)} />
            <Button className="w-full" onClick={() => addFee.mutate()} disabled={!newDesc || !newAmount || addFee.isPending}>
              <CheckCircle2 className="w-4 h-4 mr-2" /> Ajouter
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
