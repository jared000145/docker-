import {invokeServer} from '@/lib/serverCall';
import {PhoneInput} from '@/components/ui/phone-input';
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Users, Plus, Pencil, Trash2, KeyRound, Copy, ShieldCheck, Search,
  UserCog, Mail, Phone,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { ADMIN_MODULES, TEAM_ROLES, ROLE_DEFAULT_MODULES, ACADEMIC_SCOPES, SCHOOL_ROLE_LABELS, SCHOOL_ACADEMIC_SCOPES, UNIVERSITY_ONLY_MODULES, type TeamRoleValue, type ModuleKey, type AcademicScope } from "@/lib/permissions";
import { useCycle } from "@/hooks/useCycle";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import RolesManager from "@/components/admin/RolesManager";

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

const blankForm = {
  first_name: "", last_name: "", email: "", phone: "", password: "123456",request_key:crypto.randomUUID(),
  team_role: "role_personnalise" as TeamRoleValue,
  custom_role_label: "",
  allowed_modules: [] as ModuleKey[],
  academic_scope: "all" as AcademicScope,
};

const normalizePhone = (value?: string | null) => (value || "").replace(/[\s().-]/g, "").trim();

const friendlyError = (message?: string) => {
  const msg = message || "Erreur inconnue";
  const lower = msg.toLowerCase();
  if (lower.includes("email") && (lower.includes("déjà") || lower.includes("already") || lower.includes("registered") || lower.includes("duplicate"))) {
    return "Cet email est déjà utilisé par un membre de l'équipe.";
  }
  if (lower.includes("phone") || lower.includes("téléphone") || lower.includes("numéro")) {
    return "Ce numéro de téléphone est déjà utilisé par un membre de l'équipe.";
  }
  return msg.replace(/^Edge Function returned a non-2xx status code\s*/i, "").trim();
};

const AdminTeamPage = () => {
  const qc = useQueryClient();
  const { profile } = useAuth();
  const { isPrincipal, can, isLoading: permLoading } = usePermissions();
  const { hasCollege, hasLycee, hasUniversite } = useCycle();
  const isSchool = (hasCollege || hasLycee) && !hasUniversite;
  const roleOptions = TEAM_ROLES
    .filter((r) => r.value !== "admin_principal")
    .map((r) => ({ value: r.value, label: (isSchool && SCHOOL_ROLE_LABELS[r.value]) || r.label }));
  const scopeOptions = isSchool ? SCHOOL_ACADEMIC_SCOPES : ACADEMIC_SCOPES;
  const moduleCatalog = ADMIN_MODULES.filter(
    (m) => !(isSchool && UNIVERSITY_ONLY_MODULES.includes(m.key as ModuleKey)),
  );
  const instId = profile?.institution_id;

  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ ...blankForm });
  const [editing, setEditing] = useState<any>(null);
  const [deleting, setDeleting] = useState<any>(null);
  const [resetting, setResetting] = useState<any>(null);
  const [newPassword, setNewPassword] = useState("");

  /* ---------------- Fetch ---------------- */
  const { data: members = [], isLoading } = useQuery({
    queryKey: ["team-members", instId],
    queryFn: async () => {
      let q = supabase
        .from("team_members")
        .select("*")
        .order("is_principal", { ascending: false })
        .order("last_name");
      if (instId) q = q.eq("institution_id", instId);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    enabled: !!instId && (isPrincipal || can("equipe")),
  });

  /* ---------------- Mutations ---------------- */
  const createMutation = useMutation({
    mutationFn: async () => {
      const cleanEmail = form.email.trim().toLowerCase();
      const cleanPhone = form.phone.trim();
      if (!form.first_name.trim() || !form.last_name.trim()) throw new Error("Prénom et nom requis.");
      if (!cleanEmail) throw new Error("Email requis.");
      if (!form.team_role) throw new Error("Rôle obligatoire.");
      if (members.some((m: any) => (m.email || "").toLowerCase() === cleanEmail)) {
        throw new Error("Cet email est déjà utilisé par un membre de l'équipe.");
      }
      if (cleanPhone && members.some((m: any) => normalizePhone(m.phone) === normalizePhone(cleanPhone))) {
        throw new Error("Ce numéro de téléphone est déjà utilisé par un membre de l'équipe.");
      }
      const res = await supabase.functions.invoke("create-team-member", {
        body: { ...form, institution_id: instId },
      });
      if (res.data?.error) throw new Error(res.data.error);
      if (res.error) throw new Error(friendlyError(res.error.message));
      return res.data;
    },
    onSuccess: (data) => {
      if (data?.member) {
        qc.setQueryData(["team-members", instId], (old: any[] = []) => [data.member, ...old.filter((m) => m.id !== data.member.id)]);
      }
      qc.invalidateQueries({ queryKey: ["team-members", instId] });
      toast.success(data?.generated_password ? `Membre créé. Mot de passe généré : ${data.password}` : "Membre créé avec succès");
      setForm({ ...blankForm,request_key:crypto.randomUUID() });
      setCreateOpen(false);
    },
    onError: (e: any) => toast.error(friendlyError(e.message)),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const cleanPhone = editing.phone?.trim() || "";
      if (cleanPhone && members.some((m: any) => m.id !== editing.id && normalizePhone(m.phone) === normalizePhone(cleanPhone))) {
        throw new Error("Ce numéro de téléphone est déjà utilisé par un membre de l'équipe.");
      }
      const { error } = await supabase
        .from("team_members")
        .update({
          first_name: editing.first_name,
          last_name: editing.last_name,
          phone: editing.phone || null,
          team_role: editing.team_role,
          custom_role_label: editing.custom_role_label || null,
          allowed_modules: editing.allowed_modules || [],
          academic_scope: editing.academic_scope || "all",
        } as any)
        .eq("id", editing.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team-members", instId] });
      toast.success("Membre mis à jour");
      setEditing(null);
    },
    onError: (e: any) => toast.error(friendlyError(e.message)),
  });

  const deleteMutation = useMutation({
    mutationFn: async (m: any) => {
      const res = await supabase.functions.invoke("delete-user-account", { body: { user_id: m.user_id } });
      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);
      return m.id as string;
    },
    onSuccess: (memberId) => {
      qc.setQueryData(["team-members", instId], (old: any[] = []) => old.filter((m) => m.id !== memberId));
      qc.invalidateQueries({ queryKey: ["team-members", instId] });
      toast.success("Membre supprimé");
      setDeleting(null);
    },
    onError: (e: any) => toast.error(friendlyError(e.message)),
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      if (newPassword.length < 6) throw new Error("Mot de passe : 6 caractères minimum");
      await invokeServer('update-user-password',{user_id:resetting.user_id,new_password:newPassword});
    },
    onSuccess: () => {
      toast.success("Mot de passe réinitialisé");
      setResetting(null);
      setNewPassword("");
    },
    onError: (e: any) => toast.error(friendlyError(e.message)),
  });

  /* ---------------- Helpers ---------------- */
  const toggleModule = (current: ModuleKey[], key: ModuleKey): ModuleKey[] =>
    current.includes(key) ? current.filter((k) => k !== key) : [...current, key];

  const onRoleChange = (value: TeamRoleValue, target: "create" | "edit") => {
    const defaults = ROLE_DEFAULT_MODULES[value];
    if (target === "create") setForm({ ...form, team_role: value, allowed_modules: defaults });
    else setEditing({ ...editing, team_role: value, allowed_modules: defaults });
  };

  const copy = (txt: string) => { navigator.clipboard.writeText(txt); toast.success("Copié"); };

  const roleLabel = (m: any) => {
    if (m.is_principal) return "Admin principal";
    if (m.team_role === "role_personnalise" && m.custom_role_label) return m.custom_role_label;
    return (isSchool && SCHOOL_ROLE_LABELS[m.team_role as TeamRoleValue])
      || TEAM_ROLES.find((r) => r.value === m.team_role)?.label
      || m.team_role;
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m: any) =>
      [m.first_name, m.last_name, m.email, m.phone, m.custom_role_label].some((v) =>
        (v || "").toLowerCase().includes(q),
      ),
    );
  }, [members, search]);

  const stats = useMemo(() => {
    const total = members.length;
    const principal = members.filter((m: any) => m.is_principal).length;
    const personnalises = members.filter((m: any) => !m.is_principal && m.team_role === "role_personnalise").length;
    const standards = total - principal - personnalises;
    return { total, principal, personnalises, standards };
  }, [members]);

  /* ---------------- Access guard ---------------- */
  if (permLoading) return null;
  if (!isPrincipal && !can("equipe")) {
    return (
      <Card className="border-border/60">
        <CardContent className="p-8 text-center text-muted-foreground">
          Cette page est réservée à l'admin principal de l'établissement.
        </CardContent>
      </Card>
    );
  }

  /* ---------------- Render ---------------- */
  const ModulesGrid = ({ value, onChange }: { value: ModuleKey[]; onChange: (v: ModuleKey[]) => void }) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 rounded-lg border border-border bg-muted/30">
      {moduleCatalog.map((m) => (
        <label key={m.key} className="flex items-center gap-2 text-sm cursor-pointer rounded-md px-2 py-1.5 hover:bg-muted/60 transition-colors">
          <Checkbox checked={value.includes(m.key)} onCheckedChange={() => onChange(toggleModule(value, m.key))} />
          <span>{m.label}</span>
        </label>
      ))}
    </div>
  );

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      {/* Header */}
      <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground flex items-center gap-2">
            <Users className="w-7 h-7 text-primary" /> Gestion d'équipe
          </h1>
          <p className="text-muted-foreground mt-1">
            Définissez les rôles et permissions de chaque membre de votre équipe.
          </p>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" /> Ajouter un membre
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Nouveau membre d'équipe</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Prénom *</Label>
                  <Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Nom *</Label>
                  <Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Email *</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Téléphone</Label>
                  <PhoneInput value={form.phone} onChange={phone=>setForm({...form,phone})}/>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Mot de passe initial</Label>
                <Input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="123456 par défaut" />
                <p className="text-[11px] text-muted-foreground">Par défaut : 123456. Le membre choisira son mot de passe à la première connexion.</p>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Rôle</Label>
                <Select value={form.team_role} onValueChange={(v) => onRoleChange(v as TeamRoleValue, "create")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {roleOptions.map((r) => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {form.team_role === "role_personnalise" && (
                <div className="space-y-1">
                  <Label className="text-xs">Libellé du rôle personnalisé</Label>
                  <Input value={form.custom_role_label} onChange={(e) => setForm({ ...form, custom_role_label: e.target.value })} placeholder="Ex : Coordinateur stages" />
                </div>
              )}

              <div className="space-y-1">
                <Label className="text-xs">Portée académique</Label>
                <Select value={form.academic_scope} onValueChange={(v) => setForm({ ...form, academic_scope: v as AcademicScope })} disabled={form.team_role === "directeur"}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {scopeOptions.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">Le membre ne verra que les classes du cycle choisi.</p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Modules autorisés</Label>
                <ModulesGrid value={form.allowed_modules} onChange={(v) => setForm({ ...form, allowed_modules: v })} />
              </div>

              <Button className="w-full" disabled={createMutation.isPending} onClick={() => createMutation.mutate()}>
                {createMutation.isPending ? "Création..." : "Créer le membre"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </motion.div>

      <Tabs defaultValue="members" className="space-y-4">
        <TabsList>
          <TabsTrigger value="members">Membres</TabsTrigger>
          <TabsTrigger value="roles">Rôles & permissions</TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="space-y-6">
      {/* KPIs */}
      <motion.div variants={item} className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total membres", value: stats.total, icon: Users, color: "text-primary bg-primary/10" },
          { label: "Admin principal", value: stats.principal, icon: ShieldCheck, color: "text-accent bg-accent/10" },
          { label: "Rôles standards", value: stats.standards, icon: UserCog, color: "text-foreground bg-muted" },
          { label: "Rôles personnalisés", value: stats.personnalises, icon: UserCog, color: "text-muted-foreground bg-muted" },
        ].map((k) => (
          <Card key={k.label} className="border-border/60">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${k.color}`}>
                <k.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{k.label}</p>
                <p className="text-xl font-bold text-foreground">{k.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </motion.div>

      {/* Search */}
      <motion.div variants={item} className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un membre..." className="pl-9 bg-card" />
      </motion.div>

      {/* Desktop table */}
      <motion.div variants={item} className="hidden md:block">
        <Card className="border-border/60">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Membre</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Rôle</TableHead>
                  <TableHead>Modules attribués</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Chargement...</TableCell></TableRow>}
                {!isLoading && filtered.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Aucun membre trouvé.</TableCell></TableRow>
                )}
                {filtered.map((m: any) => (
                  <TableRow key={m.id} className="hover:bg-muted/30">
                    <TableCell>
                      <div className="font-semibold text-foreground">{m.first_name} {m.last_name}</div>
                      {m.phone && <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><Phone className="w-3 h-3" /> {m.phone}</div>}
                    </TableCell>
                    <TableCell>
                      <button className="inline-flex items-center gap-1 text-sm hover:text-primary group" onClick={() => copy(m.email)}>
                        <span>{m.email}</span>
                        <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    </TableCell>
                    <TableCell>
                      {m.is_principal ? (
                        <Badge className="bg-accent/15 text-accent border-accent/30 gap-1"><ShieldCheck className="w-3 h-3" /> Admin principal</Badge>
                      ) : (
                        <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">{roleLabel(m)}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {m.is_principal ? (
                        <span className="text-xs text-muted-foreground">Tous les modules</span>
                      ) : (m.allowed_modules?.length ? (
                        <div className="flex flex-wrap gap-1 max-w-md">
                          {(m.allowed_modules as ModuleKey[]).slice(0, 4).map((k) => (
                            <Badge key={k} variant="secondary" className="text-[10px] px-1.5 py-0">
                              {ADMIN_MODULES.find((x) => x.key === k)?.label || k}
                            </Badge>
                          ))}
                          {m.allowed_modules.length > 4 && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">+{m.allowed_modules.length - 4}</Badge>
                          )}
                        </div>
                      ) : <span className="text-xs text-muted-foreground">Aucun</span>)}
                    </TableCell>
                    <TableCell className="text-right">
                      {!m.is_principal && (
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" title="Réinitialiser MDP" onClick={() => { setResetting(m); setNewPassword(""); }}>
                            <KeyRound className="w-4 h-4 text-muted-foreground" />
                          </Button>
                          <Button variant="ghost" size="icon" title="Modifier" onClick={() => setEditing({ ...m, allowed_modules: m.allowed_modules || [] })}>
                            <Pencil className="w-4 h-4 text-muted-foreground" />
                          </Button>
                          <Button variant="ghost" size="icon" title="Supprimer" onClick={() => setDeleting(m)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </motion.div>

      {/* Mobile cards */}
      <motion.div variants={item} className="md:hidden grid gap-3">
        {filtered.map((m: any) => (
          <Card key={m.id} className="border-border/60">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-foreground">{m.first_name} {m.last_name}</h3>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><Mail className="w-3 h-3" /> {m.email}</p>
                  {m.phone && <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="w-3 h-3" /> {m.phone}</p>}
                </div>
                {m.is_principal ? (
                  <Badge className="bg-accent/15 text-accent border-accent/30 shrink-0"><ShieldCheck className="w-3 h-3 mr-1" /> Principal</Badge>
                ) : (
                  <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 shrink-0">{roleLabel(m)}</Badge>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                <span className="font-medium">Modules : </span>
                {m.is_principal ? "Tous" : (m.allowed_modules?.length
                  ? (m.allowed_modules as ModuleKey[]).map((k) => ADMIN_MODULES.find((x) => x.key === k)?.label || k).join(", ")
                  : "Aucun")}
              </div>
              {!m.is_principal && (
                <div className="flex justify-end gap-1 pt-2 border-t border-border/40">
                  <Button variant="ghost" size="sm" onClick={() => { setResetting(m); setNewPassword(""); }}><KeyRound className="w-3 h-3 mr-1" /> MDP</Button>
                  <Button variant="ghost" size="sm" onClick={() => setEditing({ ...m, allowed_modules: m.allowed_modules || [] })}><Pencil className="w-3 h-3 mr-1" /> Éditer</Button>
                  <Button variant="ghost" size="sm" onClick={() => setDeleting(m)}><Trash2 className="w-3 h-3 mr-1 text-destructive" /> Supprimer</Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </motion.div>
        </TabsContent>


        <TabsContent value="roles">
          <RolesManager />
        </TabsContent>
      </Tabs>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Modifier le membre</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Prénom</Label>
                  <Input value={editing.first_name} onChange={(e) => setEditing({ ...editing, first_name: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Nom</Label>
                  <Input value={editing.last_name} onChange={(e) => setEditing({ ...editing, last_name: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Téléphone</Label>
                <PhoneInput value={editing.phone} onChange={phone=>setEditing({...editing,phone})}/>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Rôle</Label>
                <Select value={editing.team_role} onValueChange={(v) => onRoleChange(v as TeamRoleValue, "edit")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {roleOptions.map((r) => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {editing.team_role === "role_personnalise" && (
                <div className="space-y-1">
                  <Label className="text-xs">Libellé du rôle</Label>
                  <Input value={editing.custom_role_label || ""} onChange={(e) => setEditing({ ...editing, custom_role_label: e.target.value })} />
                </div>
              )}
              <div className="space-y-1">
                <Label className="text-xs">Portée académique</Label>
                <Select value={editing.academic_scope || "all"} onValueChange={(v) => setEditing({ ...editing, academic_scope: v })} disabled={editing.team_role === "directeur"}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {scopeOptions.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Modules autorisés</Label>
                <ModulesGrid value={editing.allowed_modules || []} onChange={(v) => setEditing({ ...editing, allowed_modules: v })} />
              </div>
              <Button className="w-full" disabled={updateMutation.isPending} onClick={() => updateMutation.mutate()}>
                {updateMutation.isPending ? "Enregistrement..." : "Enregistrer"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reset password dialog */}
      <Dialog open={!!resetting} onOpenChange={(o) => !o && setResetting(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Réinitialiser le mot de passe</DialogTitle></DialogHeader>
          {resetting && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Définir un nouveau mot de passe pour <strong>{resetting.first_name} {resetting.last_name}</strong>.
                L'ancien mot de passe sera immédiatement invalidé.
              </p>
              <div className="space-y-1">
                <Label className="text-xs">Nouveau mot de passe</Label>
                <Input type="text" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min. 6 caractères" />
              </div>
              <Button className="w-full" disabled={resetMutation.isPending} onClick={() => resetMutation.mutate()}>
                {resetMutation.isPending ? "Réinitialisation..." : "Confirmer la réinitialisation"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce membre ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le compte <strong>{deleting?.first_name} {deleting?.last_name}</strong> sera supprimé définitivement, ainsi que tous ses accès.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleting && deleteMutation.mutate(deleting)} className="bg-destructive text-destructive-foreground">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
};

export default AdminTeamPage;
