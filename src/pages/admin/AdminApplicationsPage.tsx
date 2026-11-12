import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Inbox, Send, Loader2, CheckCircle2, XCircle, FileText, MessageSquare, User, Search,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { DossierCandidat } from "@/components/orientation/DossierCandidat";
import AdmissionDossier from '@/components/orientation/AdmissionDossier';
import {AdmissionPayment} from '@/components/admin/AdmissionsOperations';

const STATUS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "En attente", variant: "secondary" },
  in_review: { label: "En cours d'examen", variant: "outline" },
  accepted: { label: "Acceptée", variant: "default" },
  rejected: { label: "Refusée", variant: "destructive" },
};

export default function AdminApplicationsPage() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<any | null>(null);
  const [message, setMessage] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [filiereFilter, setFiliereFilter] = useState("all");
  const [search, setSearch] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const institutionId = (profile as any)?.institution_id as string | undefined;

  const { data: applications = [], isLoading } = useQuery({
    queryKey: ["institution-applications", institutionId],
    enabled: !!institutionId,
    refetchInterval: 20000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("applications")
        .select("*, partner_programs(name, domain, level), filieres:target_filiere_id(id, name)")
        .eq("target_institution_id", institutionId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = (data as any[]) || [];
      const userIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))];
      if (userIds.length) {
        const { data: profs } = await (supabase as any).from("profiles")
          .select("user_id, first_name, last_name, email, phone, avatar_url, student_number")
          .in("user_id", userIds);
        const byId = new Map((profs as any[] ?? []).map((p) => [p.user_id, p]));
        rows.forEach((r) => { r.profiles = byId.get(r.user_id) ?? r.dossier?.profile ?? null; });
      }
      return rows;
    },
  });

  const { data: messages = [] } = useQuery({
    queryKey: ["application-messages-admin", selected?.id],
    enabled: !!selected,
    refetchInterval: 5000,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("application_messages")
        .select("*").eq("application_id", selected.id).order("created_at");
      if (error) throw error;
      return (data as any[]) || [];
    },
  });

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length]);
  useEffect(() => { setNote(selected?.decision_note ?? ""); }, [selected?.id]);

  const filieres = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of applications as any[]) {
      const name = a.filieres?.name ?? a.partner_programs?.name;
      const id = a.filieres?.id ?? a.program_id;
      if (id && name) map.set(id, name);
    }
    return Array.from(map, ([id, name]) => ({ id, name }));
  }, [applications]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (applications as any[]).filter((a) => {
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (filiereFilter !== "all" && a.filieres?.id !== filiereFilter && a.program_id !== filiereFilter) return false;
      if (!q) return true;
      const p = a.profiles;
      return `${p?.first_name ?? ""} ${p?.last_name ?? ""} ${p?.student_number ?? ""} ${p?.email ?? ""}`.toLowerCase().includes(q);
    });
  }, [applications, statusFilter, filiereFilter, search]);

  const sendMessage = async () => {
    if (!message.trim() || !selected) return;
    setBusy(true);
    try {
      const { error } = await (supabase as any).from("application_messages").insert({
        application_id: selected.id, sender_id: user!.id, sender_role: "institution", content: message.trim(),
      });
      if (error) throw error;
      setMessage("");
      qc.invalidateQueries({ queryKey: ["application-messages-admin", selected.id] });
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally { setBusy(false); }
  };

  const decide = async (status: string) => {
    if (!selected) return;
    if (status === "rejected" && !note.trim()) {
      toast({ title: "Motif obligatoire", description: "Indiquez le motif du refus : le candidat le verra.", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const { error } = await (supabase as any).rpc('decide_admission',{_application:selected.id,_status:status,_note:note.trim()});
      if (error) throw error;
      toast({ title: "Décision enregistrée", description: "Le candidat a été notifié." });
      setSelected({ ...selected, status, decision_note: note.trim() || null });
      qc.invalidateQueries({ queryKey: ["institution-applications", institutionId] });
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally { setBusy(false); }
  };

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: applications.length };
    for (const a of applications as any[]) c[a.status] = (c[a.status] ?? 0) + 1;
    return c;
  }, [applications]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold flex items-center gap-2"><Inbox className="h-6 w-6 text-primary" /> Candidatures reçues</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Consultez le parcours complet des candidats, validez ou refusez avec un motif.
        </p>
      </div>

      <Card className="glass-card">
        <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Nom, matricule, email…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger><SelectValue placeholder="Statut" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts ({counts.all ?? 0})</SelectItem>
              {Object.entries(STATUS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label} ({counts[k] ?? 0})</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filiereFilter} onValueChange={setFiliereFilter}>
            <SelectTrigger><SelectValue placeholder="Filière" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les filières</SelectItem>
              {filieres.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : filtered.length === 0 ? (
        <Card className="glass-card"><CardContent className="p-8 text-center space-y-2">
          <Inbox className="h-10 w-10 mx-auto text-muted-foreground/50" />
          <p className="font-medium">Aucune candidature à afficher.</p>
          <p className="text-sm text-muted-foreground">Ouvrez vos admissions et vos filières pour recevoir des dossiers.</p>
        </CardContent></Card>
      ) : (
        <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-4">
          <div className="space-y-3 lg:max-h-[80vh] lg:overflow-y-auto pr-1">
            {filtered.map((a) => {
              const st = STATUS[a.status] ?? STATUS.pending;
              const p = a.profiles;
              return (
                <Card key={a.id} className={`glass-card cursor-pointer transition-all hover:border-primary/50 ${selected?.id === a.id ? "ring-2 ring-primary" : ""}`}
                  onClick={() => setSelected(a)}>
                  <CardContent className="p-4 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-sm flex items-center gap-1.5">
                        <User className="h-4 w-4 text-muted-foreground" />
                        {p ? `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() : "Candidat"}
                      </p>
                      <Badge variant={st.variant}>{st.label}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {a.filieres?.name ?? a.partner_programs?.name ?? "Formation"}
                      {a.partner_programs?.level ? ` · ${a.partner_programs.level}` : ""}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Reçue le {format(new Date(a.created_at), "d MMMM yyyy", { locale: fr })}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div>
            {selected ? (
              <Card className="glass-card">
                <CardHeader className="border-b border-border py-3">
                  <CardTitle className="text-base">
                    {selected.profiles ? `${selected.profiles.first_name ?? ""} ${selected.profiles.last_name ?? ""}`.trim() : "Dossier du candidat"}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {selected.filieres?.name ?? selected.partner_programs?.name} · {selected.profiles?.email}
                    {selected.profiles?.phone ? ` · ${selected.profiles.phone}` : ""}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4">
                  <Tabs defaultValue="dossier">
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="dossier">Dossier</TabsTrigger>
                      <TabsTrigger value="decision">Décision</TabsTrigger>
                      <TabsTrigger value="echanges">Échanges</TabsTrigger>
                    </TabsList>

                    <TabsContent value="dossier" className="mt-4 space-y-4 max-h-[70vh] overflow-y-auto">
                      {selected.motivation && (
                        <div>
                          <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">Lettre de motivation</p>
                          <p className="text-sm p-3 rounded bg-muted/50 border border-border whitespace-pre-wrap">{selected.motivation}</p>
                        </div>
                      )}
                      <AdmissionDossier application={selected}/>
                    </TabsContent>

                    <TabsContent value="decision" className="mt-4 space-y-3">
                      <AdmissionPayment key={selected.id+selected.payment_status} application={applications.find((a:any)=>a.id===selected.id)||selected}/>
                      <p className="text-xs text-muted-foreground">
                        Le motif est transmis au candidat avec la décision. Il est obligatoire en cas de refus.
                      </p>
                      <Textarea rows={4} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Motif de la décision / instructions pour le candidat…" />
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => decide("in_review")}>Mettre à l'étude</Button>
                        <Button size="sm" disabled={busy} onClick={() => decide("accepted")}><CheckCircle2 className="h-4 w-4 mr-1" /> Accepter</Button>
                        <Button size="sm" variant="destructive" disabled={busy} onClick={() => decide("rejected")}><XCircle className="h-4 w-4 mr-1" /> Refuser</Button>
                      </div>
                      {selected.decided_at && (
                        <p className="text-xs text-muted-foreground">
                          Décision enregistrée le {format(new Date(selected.decided_at), "d MMMM yyyy 'à' HH:mm", { locale: fr })}
                        </p>
                      )}
                    </TabsContent>

                    <TabsContent value="echanges" className="mt-4">
                      <div className="max-h-64 overflow-y-auto space-y-2 mb-2">
                        {messages.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Aucun message.</p>}
                        {messages.map((m) => {
                          const mine = m.sender_role !== "student";
                          return (
                            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                              <div className={`max-w-[80%] px-3 py-2 rounded-xl text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-muted border border-border"}`}>
                                <p>{m.content}</p>
                                <p className={`text-[10px] mt-1 ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                                  {mine ? "Vous" : "Candidat"} · {format(new Date(m.created_at), "HH:mm")}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                        <div ref={bottomRef} />
                      </div>
                      <div className="flex gap-2">
                        <Input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Votre message…"
                          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendMessage())} />
                        <Button size="icon" onClick={sendMessage} disabled={busy || !message.trim()}>
                          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        </Button>
                      </div>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            ) : (
              <Card className="glass-card h-[400px] flex items-center justify-center">
                <div className="text-center space-y-2 p-6">
                  <FileText className="h-10 w-10 mx-auto text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">Sélectionnez une candidature pour consulter le dossier complet.</p>
                </div>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
