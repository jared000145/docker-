import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { UserX, Search, RefreshCw, Snowflake, Ban } from "lucide-react";
import { toast } from "sonner";

const STATUS: Record<string, { label: string; tone: "default"|"secondary"|"destructive"|"outline" }> = {
  active: { label: "Actif", tone: "default" },
  expelled: { label: "EXCLU", tone: "destructive" },
  dropped: { label: "ABANDON", tone: "secondary" },
  blocked_unregistered: { label: "Non réinscrit", tone: "destructive" },
  blocked_unpaid: { label: "Non soldé", tone: "destructive" },
  end_of_cycle_archived: { label: "Fin de cycle", tone: "secondary" },
  transferred: { label: "Transféré", tone: "secondary" },
};

export default function AdminExclusionsPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("active");
  const [search, setSearch] = useState("");
  const [target, setTarget] = useState<any | null>(null);
  const [reason, setReason] = useState("");
  const [exitType, setExitType] = useState("discipline");
  const [mode, setMode] = useState<"exclude"|"freeze">("exclude");

  const { data: rows, isLoading } = useQuery({
    queryKey: ["exclusions-list", tab],
    queryFn: async () => {
      const { data: sy, error } = await supabase
        .from("student_years")
        .select("id, user_id, academic_year, niveau, enrollment_status, block_reason, debt_frozen, debt_cancelled, exit_type, exit_date, updated_at")
        .order("updated_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      const ids = Array.from(new Set((sy ?? []).map((r: any) => r.user_id)));
      if (!ids.length) return [];
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name, student_number, email")
        .in("user_id", ids);
      const map = new Map((profs ?? []).map((p: any) => [p.user_id, p]));
      return (sy ?? []).map((r: any) => ({ ...r, profiles: map.get(r.user_id) ?? null }));
    },
  });

  const filtered = useMemo(() => (rows ?? []).filter((r: any) => {
    if (tab === "active" && r.enrollment_status !== "active") return false;
    if (tab === "expelled" && r.enrollment_status !== "expelled") return false;
    if (tab === "dropped" && !["dropped","blocked_unregistered"].includes(r.enrollment_status)) return false;
    if (!search) return true;
    const p = r.profiles;
    const blob = `${p?.first_name} ${p?.last_name} ${p?.student_number} ${p?.email}`.toLowerCase();
    return blob.includes(search.toLowerCase());
  }), [rows, tab, search]);

  const openExclude = (r: any) => { setTarget(r); setReason(""); setExitType("discipline"); setMode("exclude"); };
  const openFreeze = (r: any) => { setTarget(r); setReason(""); setExitType("abandon"); setMode("freeze"); };

  const submit = async () => {
    if (!target || !reason.trim()) { toast.error("Motif obligatoire"); return; }
    const fn = mode === "exclude" ? "exclude_student" : "freeze_student_debt";
    const { error } = await supabase.rpc(fn as any, {
      _user_id: target.user_id,
      _reason: reason,
      _exit_type: exitType,
      _academic_year: target.academic_year,
    });
    if (error) { toast.error(error.message); return; }
    toast.success(mode === "exclude" ? "Étudiant exclu — dette annulée" : "Dette gelée");
    setTarget(null);
    qc.invalidateQueries({ queryKey: ["exclusions-list"] });
  };

  const reactivate = async (id: string) => {
    const { error } = await supabase.rpc("reactivate_student" as any, { _student_year_id: id });
    if (error) { toast.error(error.message); return; }
    toast.success("Étudiant réactivé");
    qc.invalidateQueries({ queryKey: ["exclusions-list"] });
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-heading font-bold flex items-center gap-3">
          <UserX className="w-7 h-7" /> Gestion des exclusions
        </h1>
        <p className="text-muted-foreground">Exclusions, abandons et non-réinscriptions — synchronisé avec la finance.</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="active">Actifs</TabsTrigger>
          <TabsTrigger value="expelled">Exclus</TabsTrigger>
          <TabsTrigger value="dropped">Abandons / Non réinscrits</TabsTrigger>
        </TabsList>

        <TabsContent value={tab}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="w-4 h-4" />
                <Input placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? <p className="text-sm text-muted-foreground py-8 text-center">Chargement…</p> :
                !filtered.length ? <p className="text-sm text-muted-foreground py-8 text-center">Aucun étudiant.</p> : (
                <div className="border rounded-lg divide-y">
                  {filtered.map((r: any) => {
                    const s = STATUS[r.enrollment_status] ?? { label: r.enrollment_status, tone: "outline" as const };
                    return (
                      <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                        <div className="min-w-0">
                          <p className="font-medium">{r.profiles?.last_name} {r.profiles?.first_name}{" "}
                            <span className="text-xs text-muted-foreground">({r.profiles?.student_number})</span></p>
                          <p className="text-xs text-muted-foreground flex flex-wrap gap-2 items-center mt-1">
                            <span>{r.academic_year} · {r.niveau}</span>
                            <Badge variant={s.tone}>{s.label}</Badge>
                            {r.debt_cancelled && <Badge variant="outline">Dette annulée</Badge>}
                            {r.debt_frozen && <Badge variant="outline">Dette gelée</Badge>}
                            {r.exit_type && <span className="italic">— {r.exit_type}</span>}
                            {r.block_reason && <span className="italic">· {r.block_reason}</span>}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          {r.enrollment_status === "active" ? (
                            <>
                              <Button size="sm" variant="outline" onClick={() => openFreeze(r)}>
                                <Snowflake className="w-3.5 h-3.5 mr-1" /> Geler (abandon)
                              </Button>
                              <Button size="sm" variant="destructive" onClick={() => openExclude(r)}>
                                <Ban className="w-3.5 h-3.5 mr-1" /> Exclure
                              </Button>
                            </>
                          ) : (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="outline">
                                  <RefreshCw className="w-3.5 h-3.5 mr-1" /> Réactiver
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Réactiver l'étudiant ?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Le compte sera réactivé, les échéances gelées remises en cours.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => reactivate(r.id)}>Réactiver</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {mode === "exclude" ? "Exclusion de l'étudiant" : "Geler la dette (abandon)"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {mode === "exclude" ? (
              <p className="text-sm text-muted-foreground">
                ⚠️ Action définitive : la dette sera annulée, le compte bloqué (lecture seule des documents conservée).
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                La dette sera gelée — pas d'effacement, plus de relance ni d'échéance future.
              </p>
            )}
            <div className="space-y-1">
              <Label>Type</Label>
              <Select value={exitType} onValueChange={setExitType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {mode === "exclude" ? (
                    <>
                      <SelectItem value="discipline">Discipline</SelectItem>
                      <SelectItem value="fraude">Fraude</SelectItem>
                      <SelectItem value="decision_admin">Décision administrative</SelectItem>
                      <SelectItem value="autre">Autre</SelectItem>
                    </>
                  ) : (
                    <>
                      <SelectItem value="abandon">Abandon volontaire</SelectItem>
                      <SelectItem value="absence_prolongee">Absence prolongée</SelectItem>
                      <SelectItem value="non_reinscrit">Non réinscrit</SelectItem>
                      <SelectItem value="autre">Autre</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Motif (obligatoire)</Label>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Détaillez le motif…" rows={4} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTarget(null)}>Annuler</Button>
            <Button variant={mode === "exclude" ? "destructive" : "default"} onClick={submit}>
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
