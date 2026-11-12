import { useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  FileClock, CheckCircle2, XCircle, ShieldCheck, GraduationCap,
  Layers, ArrowRight, PenSquare, FileCheck2, TrendingUp, Timer,
  AlertTriangle, Sparkles, Activity, Users,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip,
  BarChart, Bar, CartesianGrid, Cell,
} from "recharts";
import type { ValidatorRoleConfig } from "@/lib/validatorRoles";

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

const TYPE_LABELS: Record<string, string> = {
  releve: "Relevés",
  bulletin: "Bulletins",
  attestation: "Attestations",
  pv: "Procès-verbaux",
};
const TYPE_COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "hsl(217 91% 60%)", "hsl(160 84% 39%)"];

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-700 border-amber-300/40",
  validated: "bg-emerald-500/15 text-emerald-700 border-emerald-300/40",
  rejected: "bg-destructive/15 text-destructive border-destructive/30",
  to_correct: "bg-blue-500/15 text-blue-700 border-blue-300/40",
};

const fmtDate = (d: string | Date) =>
  new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });

export default function ValidatorDashboardPage({ role }: { role: ValidatorRoleConfig }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const instId = profile?.institution_id;

  const colStatus = `${role.col}_status` as const;
  const colSignedAt = `${role.col}_signed_at` as const;

  // Realtime sync
  useEffect(() => {
    if (!instId) return;
    const ch = supabase
      .channel(`validator-${role.key}-${instId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "document_validations", filter: `institution_id=eq.${instId}` },
        () => qc.invalidateQueries({ queryKey: ["validator-dash", instId, role.key] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [instId, role.key, qc]);

  const { data: docs = [] } = useQuery({
    queryKey: ["validator-dash", instId, role.key],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("document_validations")
        .select("id, title, document_type, academic_year, created_at, pedagogique_status, cycle_status, status, pedagogique_signed_at, cycle_signed_at, student_user_id")
        .eq("institution_id", instId!)
        .order("created_at", { ascending: false })
        .limit(500);
      return data || [];
    },
    enabled: !!instId,
  });

  const { data: signature } = useQuery({
    queryKey: ["validator-dash-sig", instId, role.scope],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("director_signatures")
        .select("id, director_name, signature_url, stamp_url")
        .eq("institution_id", instId!)
        .eq("role_scope", role.scope)
        .eq("is_active", true)
        .maybeSingle();
      return data;
    },
    enabled: !!instId,
  });

  const stats = useMemo(() => {
    let pending = 0, validated = 0, rejected = 0, validatedToday = 0;
    let pendingOverdue = 0;
    const byType: Record<string, { pending: number; validated: number; rejected: number }> = {};
    const dailyMap: Record<string, { received: number; validated: number }> = {};
    const today = new Date(); today.setHours(0, 0, 0, 0);
    let totalLag = 0, lagCount = 0;
    const studentSet = new Set<string>();

    // last 14 days buckets
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      dailyMap[d.toISOString().slice(0, 10)] = { received: 0, validated: 0 };
    }

    docs.forEach((d: any) => {
      const s = d[colStatus] || "pending";
      const type = d.document_type;
      if (!byType[type]) byType[type] = { pending: 0, validated: 0, rejected: 0 };

      if (s === "pending") {
        pending++;
        byType[type].pending++;
        const ageHours = (Date.now() - new Date(d.created_at).getTime()) / 36e5;
        if (ageHours > 48) pendingOverdue++;
      } else if (s === "validated") {
        validated++;
        byType[type].validated++;
        const signedAt = d[colSignedAt];
        if (signedAt) {
          const signed = new Date(signedAt);
          if (signed >= today) validatedToday++;
          const lag = (signed.getTime() - new Date(d.created_at).getTime()) / 36e5;
          if (lag >= 0) { totalLag += lag; lagCount++; }
          const k = signed.toISOString().slice(0, 10);
          if (dailyMap[k]) dailyMap[k].validated++;
        }
      } else if (s === "rejected") {
        rejected++;
        byType[type].rejected++;
      }

      const k = new Date(d.created_at).toISOString().slice(0, 10);
      if (dailyMap[k]) dailyMap[k].received++;
      if (d.student_user_id) studentSet.add(d.student_user_id);
    });

    const avgLagHours = lagCount > 0 ? totalLag / lagCount : 0;
    const total = docs.length;
    const validationRate = total > 0 ? Math.round(((validated + rejected) / total) * 100) : 0;
    const daily = Object.entries(dailyMap).map(([date, v]) => ({ date, ...v }));
    const typeData = Object.entries(byType).map(([type, v]) => ({
      type: TYPE_LABELS[type] || type,
      key: type,
      ...v,
      total: v.pending + v.validated + v.rejected,
    }));

    return {
      pending, validated, rejected, validatedToday, pendingOverdue,
      avgLagHours, validationRate, daily, typeData, total,
      studentsCount: studentSet.size,
    };
  }, [docs, colStatus, colSignedAt]);

  const priority = useMemo(
    () => docs
      .filter((d: any) => (d[colStatus] || "pending") === "pending")
      .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .slice(0, 5),
    [docs, colStatus],
  );

  const recentActivity = useMemo(
    () => docs
      .filter((d: any) => d[colSignedAt])
      .sort((a: any, b: any) => new Date(b[colSignedAt]).getTime() - new Date(a[colSignedAt]).getTime())
      .slice(0, 5),
    [docs, colSignedAt],
  );

  const kpis = [
    { label: "En attente", value: stats.pending, sub: stats.pendingOverdue > 0 ? `${stats.pendingOverdue} > 48h` : "À jour",
      icon: FileClock, tint: "from-amber-500/20 to-amber-500/5 text-amber-700", ring: "ring-amber-300/40" },
    { label: "Validés (total)", value: stats.validated, sub: `+${stats.validatedToday} aujourd'hui`,
      icon: CheckCircle2, tint: "from-emerald-500/20 to-emerald-500/5 text-emerald-700", ring: "ring-emerald-300/40" },
    { label: "Délai moyen", value: stats.avgLagHours > 0 ? `${stats.avgLagHours.toFixed(1)}h` : "—",
      sub: "Réception → validation", icon: Timer, tint: "from-blue-500/20 to-blue-500/5 text-blue-700", ring: "ring-blue-300/40" },
    role.col === "pedagogique"
      ? { label: "Étudiants concernés", value: stats.studentsCount, sub: `${stats.total} documents traités`,
          icon: Users, tint: "from-primary/20 to-primary/5 text-primary", ring: "ring-primary/40" }
      : { label: "Taux de validation", value: `${stats.validationRate}%`, sub: `${stats.total} documents au total`,
          icon: TrendingUp, tint: "from-violet-500/20 to-violet-500/5 text-violet-700", ring: "ring-violet-300/40" },
  ];

  const isPed = role.col === "pedagogique";
  const heroGradient = isPed
    ? "from-primary/15 via-primary/5 to-transparent"
    : "from-accent/20 via-accent/5 to-transparent";

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      {/* HERO */}
      <motion.div variants={item} className={`relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br ${heroGradient} p-5 sm:p-7`}>
        <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4 min-w-0">
            <div className="w-14 h-14 rounded-2xl bg-background/80 backdrop-blur ring-1 ring-border/60 flex items-center justify-center shadow-sm">
              {isPed ? <GraduationCap className="w-7 h-7 text-primary" /> : <ShieldCheck className="w-7 h-7 text-accent" />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground">
                  Espace {role.label}
                </h1>
                <Badge variant="outline" className="border-accent/40 text-accent bg-accent/10">
                  <Sparkles className="w-3 h-3 mr-1" /> Tableau de bord pro
                </Badge>
              </div>
              <p className="text-muted-foreground mt-1 text-sm max-w-2xl">
                {isPed
                  ? "Vérifiez la cohérence académique (notes, UE, matières) avant la validation pédagogique officielle."
                  : "Contrôlez la conformité du cycle et apposez la seconde signature pour finaliser les documents."}
              </p>
              {profile && (
                <p className="text-xs text-muted-foreground/80 mt-1">
                  Connecté en tant que <span className="font-medium text-foreground">{profile.first_name} {profile.last_name}</span>
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={() => navigate(`${role.routePrefix}/documents`)} className="shadow-sm">
              <FileCheck2 className="w-4 h-4 mr-1" /> Examiner les documents
            </Button>
            <Button variant="outline" onClick={() => navigate(`${role.routePrefix}/signature`)}>
              <PenSquare className="w-4 h-4 mr-1" /> Signature & cachet
            </Button>
          </div>
        </div>

        {!signature && (
          <div className="relative mt-4 flex items-center gap-2 rounded-lg border border-amber-300/40 bg-amber-50/70 dark:bg-amber-500/10 px-3 py-2 text-sm text-amber-800">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>Aucune signature active. Configurez-la pour pouvoir valider officiellement les documents.</span>
            <Button size="sm" variant="ghost" className="ml-auto h-7" onClick={() => navigate(`${role.routePrefix}/signature`)}>
              Configurer <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </div>
        )}
      </motion.div>

      {/* KPI */}
      <motion.div variants={item} className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((c) => (
          <Card key={c.label} className={`border-border/60 bg-gradient-to-br ${c.tint} ring-1 ${c.ring}`}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-medium opacity-80">{c.label}</p>
                  <p className="text-2xl font-bold mt-1">{c.value}</p>
                  <p className="text-[11px] opacity-70 mt-1 truncate">{c.sub}</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-background/60 backdrop-blur flex items-center justify-center">
                  <c.icon className="w-5 h-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </motion.div>

      {/* Charts */}
      <motion.div variants={item} className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="border-border/60 lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" /> Activité (14 derniers jours)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.daily} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="vReceived" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="vValidated" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(160 84% 39%)" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="hsl(160 84% 39%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                  <XAxis dataKey="date" tickFormatter={fmtDate} fontSize={11} stroke="hsl(var(--muted-foreground))" />
                  <YAxis allowDecimals={false} fontSize={11} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--background))", fontSize: 12 }}
                    labelFormatter={(l) => fmtDate(l as string)}
                  />
                  <Area type="monotone" dataKey="received" name="Reçus" stroke="hsl(var(--primary))" fill="url(#vReceived)" strokeWidth={2} />
                  <Area type="monotone" dataKey="validated" name="Validés" stroke="hsl(160 84% 39%)" fill="url(#vValidated)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Layers className="w-4 h-4 text-accent" /> Répartition par type
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.typeData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">Aucun document.</p>
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.typeData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                    <XAxis dataKey="type" fontSize={11} stroke="hsl(var(--muted-foreground))" />
                    <YAxis allowDecimals={false} fontSize={11} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--background))", fontSize: 12 }} />
                    <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                      {stats.typeData.map((_, i) => (
                        <Cell key={i} fill={TYPE_COLORS[i % TYPE_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Per-type progress */}
      {stats.typeData.length > 0 && (
        <motion.div variants={item}>
          <Card className="border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Avancement par type de document</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {stats.typeData.map((t) => {
                const done = t.validated + t.rejected;
                const pct = t.total > 0 ? Math.round((done / t.total) * 100) : 0;
                return (
                  <div key={t.key}>
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <span className="font-medium">{t.type}</span>
                      <span className="text-muted-foreground text-xs">
                        {done}/{t.total} traités • {t.pending} en attente
                      </span>
                    </div>
                    <Progress value={pct} className="h-2" />
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Priority + Activity */}
      <motion.div variants={item} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-border/60">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" /> À traiter en priorité
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate(`${role.routePrefix}/documents`)}>
              Tout voir <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            {priority.length === 0 ? (
              <div className="py-8 text-center">
                <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500 mb-2" />
                <p className="text-sm text-muted-foreground">Aucun document en attente. Bravo !</p>
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {priority.map((d: any) => {
                  const ageHours = (Date.now() - new Date(d.created_at).getTime()) / 36e5;
                  const overdue = ageHours > 48;
                  return (
                    <div key={d.id} className="py-2.5 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate text-sm">{d.title || TYPE_LABELS[d.document_type] || "Document"}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {TYPE_LABELS[d.document_type] || d.document_type} • {d.academic_year || "—"} • reçu {fmtDate(d.created_at)}
                        </p>
                      </div>
                      <Badge variant="outline" className={overdue ? "bg-destructive/10 text-destructive border-destructive/30" : "bg-amber-500/10 text-amber-700 border-amber-300/40"}>
                        {overdue ? `+${Math.floor(ageHours / 24)}j` : `${Math.round(ageHours)}h`}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-600" /> Dernières validations
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Aucune validation enregistrée pour le moment.</p>
            ) : (
              <div className="divide-y divide-border/60">
                {recentActivity.map((d: any) => (
                  <div key={d.id} className="py-2.5 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate text-sm">{d.title || TYPE_LABELS[d.document_type] || "Document"}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {TYPE_LABELS[d.document_type] || d.document_type} • signé {fmtDate(d[colSignedAt])}
                      </p>
                    </div>
                    <Badge variant="outline" className={STATUS_BADGE[d[colStatus]] || ""}>
                      {d[colStatus]}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
