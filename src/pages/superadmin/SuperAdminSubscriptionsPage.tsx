import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { subscriptionState } from '@/lib/subscriptionState';
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Building2, CalendarClock, RotateCcw, Ban, CheckCircle2, Search } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "sonner";

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

const PLAN_OPTIONS = ["Essai", "Basic", "Standard", "Premium"];
const fmt = (n: number) => (n || 0).toLocaleString("fr-FR") + " FCFA";

const nextDate = (cycle: string) => {
  const date = new Date();
  date.setMonth(date.getMonth() + (cycle === "annual" ? 12 : 1));
  return date.toISOString().slice(0, 10);
};

function SubscriptionField({value,type,onSave}:{value:string|number;type:'number'|'date';onSave:(value:string)=>Promise<unknown>}) {
  const [draft,setDraft]=useState(String(value));
  const [editing,setEditing]=useState(false);
  const [saving,setSaving]=useState(false);
  useEffect(()=>{if(!editing) setDraft(String(value));},[value,editing]);
  const commit=async()=>{
    if(draft===String(value)) {setEditing(false);return;}
    if(!draft || (type==='number' && (!Number.isFinite(Number(draft)) || Number(draft)<0))) {setDraft(String(value));setEditing(false);return;}
    setSaving(true);
    try {await onSave(draft);} catch {setDraft(String(value));}
    finally {setSaving(false);setEditing(false);}
  };
  return <Input aria-label={type==='number'?'Montant de l’abonnement':'Date de fin de l’abonnement'} type={type} min={type==='number'?0:undefined} value={draft} disabled={saving} onFocus={()=>setEditing(true)} onChange={event=>setDraft(event.target.value)} onBlur={()=>void commit()} onKeyDown={event=>{if(event.key==='Enter') event.currentTarget.blur();}} className={type==='number'?'w-32':'w-40'} />;
}

const SuperAdminSubscriptionsPage = () => {
  const qc = useQueryClient();
  useRealtimeSubscription('institution_subscriptions',[['sa-institution-subscriptions']]);
  useRealtimeSubscription('institutions',[['sa-subscription-institutions']]);
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("all");

  const { data: institutions = [] } = useQuery({
    queryKey: ["sa-subscription-institutions"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("institutions")
        .select("id, name, logo_url, institution_type, domain, is_active, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: subscriptions = [] } = useQuery({
    queryKey: ["sa-institution-subscriptions"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("institution_subscriptions")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const subscriptionsByInstitution = useMemo(
    () => new Map(subscriptions.map((sub: any) => [sub.institution_id, sub])),
    [subscriptions],
  );

  const today = new Date();
  const rows = useMemo(() => {
    return institutions
      .map((institution: any) => {
        const subscription: any = subscriptionsByInstitution.get(institution.id);
        let status: "active" | "expired" | "suspended" = "active";
        if (institution.is_active === false) status = "suspended";
        else if (['blocked','cancelled'].includes(subscription?.status)) status = 'suspended';
        else if (subscriptionState(subscription,true,today).isExpired) status = "expired";
        return { institution, subscription, status };
      })
      .filter(({ institution, subscription }: any) => {
        const matchesSearch = institution.name.toLowerCase().includes(search.toLowerCase());
        const matchesPlan = planFilter === "all" || (subscription?.plan_name || "Standard") === planFilter;
        return matchesSearch && matchesPlan;
      });
  }, [institutions, subscriptionsByInstitution, search, planFilter]);

  const upsert = useMutation({
    mutationFn: async ({ institution, subscription, patch }: any) => {
      const { error } = await supabase.rpc('manage_institution_subscription', {
        _institution_id:institution.id,
        _action:patch.action || 'update',
        _patch:patch,
      });
      if(error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sa-institution-subscriptions"] });
      qc.invalidateQueries({ queryKey: ["sa-subscription-institutions"] });
      qc.invalidateQueries({ queryKey: ["sa-fin-subscriptions"] });
      qc.invalidateQueries({ queryKey: ["sa-fin-institutions"] });
      toast.success("Abonnement mis à jour");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleRenew = (institution: any, subscription: any) => {
    upsert.mutate({institution,subscription,patch:{action:'renew'}});
  };

  const handleSuspend = (institution: any, subscription: any) => {
    upsert.mutate({ institution, subscription, patch: { action:"suspend" } });
  };
  const handleReactivate = (institution: any, subscription: any) => {
    upsert.mutate({ institution, subscription, patch: { action:"reactivate" } });
  };

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={item} className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-heading font-bold text-foreground">Abonnements</h1>
          <p className="text-muted-foreground mt-1">Gérez les plans, renouvellements et suspensions</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un établissement" className="w-full pl-9 sm:w-64" />
          </div>
          <Select value={planFilter} onValueChange={setPlanFilter}>
            <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Plan" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les plans</SelectItem>
              {PLAN_OPTIONS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </motion.div>

      <motion.div variants={item}>
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CalendarClock className="h-5 w-5 text-primary" /> Suivi des abonnements
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 sm:p-6 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Établissement</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Début</TableHead>
                  <TableHead>Expiration</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(({ institution, subscription, status }: any) => {
                  const plan = subscription?.plan_name || "Standard";
                  return (
                    <TableRow key={institution.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {institution.logo_url ? (
                            <img src={institution.logo_url} alt={institution.name} className="h-10 w-10 rounded-lg object-cover" />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                              <Building2 className="h-5 w-5 text-muted-foreground" />
                            </div>
                          )}
                          <div className="min-w-40">
                            <p className="font-medium text-foreground">{institution.name}</p>
                            <p className="text-xs text-muted-foreground">{institution.domain || "Sans domaine"}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Select value={plan} onValueChange={(plan_name) => upsert.mutate({ institution, subscription, patch: { plan_name } })}>
                          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {PLAN_OPTIONS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Select value={subscription?.billing_cycle || 'monthly'} onValueChange={billing_cycle=>upsert.mutate({institution,subscription,patch:{billing_cycle}})}><SelectTrigger aria-label="Cycle de facturation" className="mt-2 w-32"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="monthly">Mensuel</SelectItem><SelectItem value="annual">Annuel</SelectItem></SelectContent></Select>
                      </TableCell>
                      <TableCell>
                        <SubscriptionField type="number" value={subscription?.amount ?? 0} onSave={amount=>upsert.mutateAsync({institution,subscription,patch:{amount}})} />
                        <p className="text-[10px] text-muted-foreground mt-1">{fmt(Number(subscription?.amount || 0))}</p>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {subscription?.starts_at ? new Date(subscription.starts_at).toLocaleDateString("fr-FR") : "—"}
                      </TableCell>
                      <TableCell>
                        <SubscriptionField type="date" value={subscription?.ends_at || ''} onSave={ends_at=>upsert.mutateAsync({institution,subscription,patch:{ends_at}})} />
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={status === "active" ? "default" : "destructive"}
                          className={
                            status === "active" ? "bg-success/15 text-success border-success/30"
                            : status === "expired" ? "bg-warning/15 text-warning border-warning/30"
                            : "bg-muted text-muted-foreground"
                          }
                        >
                          {status === "active" ? (subscription?.status==='trialing'?'Essai':'Actif') : status === "expired" ? "Expiré" : "Suspendu"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <ConfirmDialog
                            trigger={
                              <Button size="sm" variant="outline" className="gap-1.5">
                                <RotateCcw className="w-3.5 h-3.5" /> Renouveler
                              </Button>
                            }
                            title="Renouveler l'abonnement"
                            description={`Renouveler l'abonnement de ${institution.name} pour une période ${subscription?.billing_cycle === "annual" ? "annuelle" : "mensuelle"} ?`}
                            confirmText="Renouveler"
                            destructive={false}
                            onConfirm={() => handleRenew(institution, subscription)}
                          />
                          {status === "suspended" ? (
                            <ConfirmDialog
                              trigger={
                                <Button size="sm" variant="default" className="gap-1.5">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Réactiver
                                </Button>
                              }
                              title="Réactiver l'établissement"
                              description={`Réactiver l'accès de ${institution.name} ?`}
                              confirmText="Réactiver"
                              destructive={false}
                              onConfirm={() => handleReactivate(institution, subscription)}
                            />
                          ) : (
                            <ConfirmDialog
                              trigger={
                                <Button size="sm" variant="destructive" className="gap-1.5">
                                  <Ban className="w-3.5 h-3.5" /> Suspendre
                                </Button>
                              }
                              title="Suspendre l'établissement"
                              description={`Suspendre l'accès de ${institution.name} ? Les utilisateurs ne pourront plus se connecter jusqu'à réactivation.`}
                              confirmText="Suspendre"
                              destructive
                              onConfirm={() => handleSuspend(institution, subscription)}
                            />
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">Aucun établissement</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
};

export default SuperAdminSubscriptionsPage;
