import { useMemo } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wallet, TrendingUp, CheckCircle2, XCircle, Ban, Building2 } from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";

const fmt = (n: number) => (n || 0).toLocaleString("fr-FR") + " FCFA";

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.08 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

export default function SuperAdminFinancePage() {
  const { data: institutions = [] } = useQuery({
    queryKey: ["sa-fin-institutions"],
    queryFn: async () => {
      const { data } = await supabase
        .from("institutions")
        .select("id, name, logo_url, is_active");
      return data || [];
    },
  });

  const { data: subscriptions = [] } = useQuery({
    queryKey: ["sa-fin-subscriptions"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("institution_subscriptions")
        .select("*")
        .order("updated_at", { ascending: false });
      return data || [];
    },
  });

  const today = new Date();
  const totalRevenue = useMemo(
    () => subscriptions
      .filter((s: any) => ["active", "past_due"].includes(s.status) || s.status === "trial")
      .reduce((sum: number, s: any) => sum + Number(s.amount || 0), 0),
    [subscriptions],
  );

  const stats = useMemo(() => {
    const active = subscriptions.filter((s: any) => s.ends_at && new Date(s.ends_at) >= today && s.status !== "blocked").length;
    const expired = subscriptions.filter((s: any) => s.ends_at && new Date(s.ends_at) < today).length;
    const suspended = institutions.filter((i: any) => i.is_active === false).length;
    return { active, expired, suspended };
  }, [subscriptions, institutions]);

  const monthlyRevenue = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of subscriptions as any[]) {
      const date = new Date(s.updated_at || s.created_at);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      map.set(key, (map.get(key) || 0) + Number(s.amount || 0));
    }
    const months: { label: string; revenue: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      months.push({
        label: d.toLocaleDateString("fr-FR", { month: "short" }),
        revenue: map.get(key) || 0,
      });
    }
    return months;
  }, [subscriptions]);

  const recentPayments = useMemo(() => {
    const instMap = new Map(institutions.map((i: any) => [i.id, i]));
    return subscriptions.slice(0, 10).map((s: any) => ({
      ...s,
      institution: instMap.get(s.institution_id),
    }));
  }, [subscriptions, institutions]);

  const institutionStatus = useMemo(() => {
    return institutions.map((inst: any) => {
      const sub = subscriptions.find((s: any) => s.institution_id === inst.id);
      let status: "active" | "expired" | "suspended" = "active";
      if (inst.is_active === false) status = "suspended";
      else if (sub?.ends_at && new Date(sub.ends_at) < today) status = "expired";
      return { ...inst, subscription: sub, status };
    });
  }, [institutions, subscriptions]);

  const statBoxes = [
    { label: "Total reçu", value: fmt(totalRevenue), icon: Wallet, color: "from-amber-500 to-orange-600" },
    { label: "Abonnements actifs", value: stats.active, icon: CheckCircle2, color: "from-emerald-500 to-teal-600" },
    { label: "Abonnements expirés", value: stats.expired, icon: XCircle, color: "from-rose-500 to-red-600" },
    { label: "Établissements suspendus", value: stats.suspended, icon: Ban, color: "from-slate-500 to-zinc-600" },
  ];

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={item}>
        <h1 className="text-2xl lg:text-3xl font-heading font-bold flex items-center gap-2">
          <Wallet className="w-7 h-7 text-accent" /> Tableau de bord financier
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Suivi global des revenus issus des abonnements des établissements
        </p>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statBoxes.map((s) => (
          <motion.div key={s.label} variants={item}>
            <Card className="border-border/50 overflow-hidden">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">{s.label}</p>
                    <p className="text-2xl font-bold text-foreground mt-1 truncate">{s.value}</p>
                  </div>
                  <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center shrink-0`}>
                    <s.icon className="w-5 h-5 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <motion.div variants={item}>
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="w-5 h-5 text-primary" /> Revenus mensuels (12 derniers mois)
            </CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyRevenue}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                  formatter={(value: any) => fmt(Number(value))}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2.5}
                  fill="url(#rev)"
                  animationDuration={900}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div variants={item}>
          <Card className="border-border/50">
            <CardHeader><CardTitle className="text-base">Derniers paiements reçus</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {recentPayments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Aucun paiement</p>
              ) : recentPayments.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-secondary/40 border border-border/40">
                  <div className="flex items-center gap-3 min-w-0">
                    {p.institution?.logo_url ? (
                      <img src={p.institution.logo_url} alt={`Logo ${p.institution.name}`} className="w-9 h-9 rounded-lg object-cover" />
                    ) : (
                      <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                        <Building2 className="w-4 h-4 text-white" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{p.institution?.name || "—"}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(p.updated_at || p.created_at).toLocaleDateString("fr-FR")} · {p.plan_name}
                      </p>
                    </div>
                  </div>
                  <span className="font-bold text-sm whitespace-nowrap">{fmt(p.amount)}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card className="border-border/50">
            <CardHeader><CardTitle className="text-base">Statut des établissements</CardTitle></CardHeader>
            <CardContent className="space-y-2 max-h-[420px] overflow-y-auto">
              {institutionStatus.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Aucun établissement</p>
              ) : institutionStatus.map((inst: any) => (
                <div key={inst.id} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-secondary/40 border border-border/40">
                  <div className="flex items-center gap-3 min-w-0">
                    {inst.logo_url ? (
                      <img src={inst.logo_url} alt={`Logo ${inst.name}`} className="w-9 h-9 rounded-lg object-cover" />
                    ) : (
                      <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center">
                        <Building2 className="w-4 h-4 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{inst.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {inst.subscription?.ends_at
                          ? `Expire le ${new Date(inst.subscription.ends_at).toLocaleDateString("fr-FR")}`
                          : "Aucun abonnement"}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant={inst.status === "active" ? "default" : "destructive"}
                    className={
                      inst.status === "active" ? "bg-success/15 text-success border-success/30"
                      : inst.status === "expired" ? "bg-warning/15 text-warning border-warning/30"
                      : "bg-muted text-muted-foreground"
                    }
                  >
                    {inst.status === "active" ? "Actif" : inst.status === "expired" ? "Expiré" : "Suspendu"}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}
