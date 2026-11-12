import {usePermissions} from "@/hooks/usePermissions";
import {Link} from "react-router-dom";
import {ADMIN_MODULES,ROUTE_MODULE_MAP} from "@/lib/permissions";
import {useCampus} from "@/hooks/useCampus";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Users, BookOpen, CreditCard, BookMarked } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { useInstitution } from "@/hooks/useInstitution";
import { useAuth } from "@/hooks/useAuth";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import { AcademicYearSelector } from "@/components/AcademicYearSelector";
import DashboardActivity from '@/components/admin/DashboardActivity';
import CampusOverview from '@/components/admin/CampusOverview';
import DashboardCommunications from '@/components/admin/DashboardCommunications';
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, Label as ChartLabel,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid,
} from "recharts";

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.08 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

const PIE_COLORS = ["hsl(var(--accent))", "hsl(var(--info))", "hsl(var(--success))", "hsl(var(--warning))", "hsl(var(--destructive))", "hsl(var(--primary))"];

const AdminDashboardOverview = () => {
  const { profile } = useAuth();
  const { institution } = useInstitution();
  const { selectedYear } = useAcademicYear();
  const instId = profile?.institution_id;
  const {campusId} = useCampus();
  const navigate = useNavigate();
  const [period, setPeriod] = useState<"3" | "6" | "12">("6");
  const months = parseInt(period, 10);

  const { data: studentsCount = 0 } = useQuery({
    queryKey: ["admin-students-count", instId, campusId],
    queryFn: async () => {
      const { data: studentRoles } = await supabase.from("user_roles").select("user_id").eq("role", "user");
      if (!studentRoles?.length) return 0;
      const ids = studentRoles.map((r: any) => r.user_id);
      let q = supabase.from("profiles").select("*", { count: "exact", head: true }).in("user_id", ids);
      if (instId) q = q.eq("institution_id", instId);
      if (campusId) q = q.eq("campus_id", campusId);
      const { count } = await q;
      return count || 0;
    },
    enabled: !!instId,
  });

  const { data: profsCount = 0 } = useQuery({
    queryKey: ["admin-profs-count", instId, campusId],
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "professor");
      if (!roles?.length) return 0;
      const ids = roles.map((r: any) => r.user_id);
      let q = supabase.from("profiles").select("*", { count: "exact", head: true }).in("user_id", ids);
      if (instId) q = q.eq("institution_id", instId);
      if (campusId) q = q.eq("campus_id", campusId);
      const { count } = await q;
      return count || 0;
    },
    enabled: !!instId,
  });

  const { data: subjectsCount = 0 } = useQuery({
    queryKey: ["admin-subjects-count", instId, campusId],
    queryFn: async () => {
      let q = supabase.from("subjects").select("*", { count: "exact", head: true });
      if (instId) q = q.eq("institution_id", instId);
      if (campusId) q = q.eq("campus_id", campusId);
      const { count } = await q;
      return count || 0;
    },
    enabled: !!instId,
  });

  const { data: studentRows = [] } = useQuery({
    queryKey: ["admin-dash-students", instId, campusId],
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "user");
      if (!roles?.length) return [];
      const ids = roles.map((r: any) => r.user_id);
      let q = supabase.from("profiles").select("level, filiere_id").in("user_id", ids);
      if (instId) q = q.eq("institution_id", instId);
      if (campusId) q = q.eq("campus_id", campusId);
      const { data } = await q;
      return data || [];
    },
    enabled: !!instId,
  });

  const { data: filieres = [] } = useQuery({
    queryKey: ["admin-dash-filieres", instId, campusId],
    queryFn: async () => {
      let q = supabase.from("filieres").select("id, name");
      if (instId) q = q.eq("institution_id", instId);
      if (campusId) q = q.eq("campus_id", campusId);
      const { data } = await q;
      return data || [];
    },
    enabled: !!instId,
  });

  const studentsByLevel = useMemo(() => {
    const map = new Map<string, number>();
    studentRows.forEach((r: any) => map.set(r.level || "—", (map.get(r.level || "—") || 0) + 1));
    return Array.from(map.entries()).map(([level, count]) => ({ level, count })).sort((a, b) => a.level.localeCompare(b.level));
  }, [studentRows]);

  const studentsByFiliere = useMemo(() => {
    const fmap = new Map(filieres.map((f: any) => [f.id, f.name]));
    const map = new Map<string, number>();
    studentRows.forEach((r: any) => {
      const name = (r.filiere_id && fmap.get(r.filiere_id)) || "Non assigné";
      map.set(name as string, (map.get(name as string) || 0) + 1);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value, filiere_id: [...fmap.entries()].find(([, v]) => v === name)?.[0] }));
  }, [studentRows, filieres]);

  const { data: payments = [] } = useQuery({
    queryKey: ["admin-dash-payments", instId, selectedYear, campusId],
    queryFn: async () => {
      let q = supabase.from("payments").select("amount, paid_amount, status, payment_date, created_at, academic_year");
      if (instId) q = q.eq("institution_id", instId);
      if (campusId) q = q.eq("campus_id", campusId);
      if (selectedYear) q = q.eq("academic_year", selectedYear);
      const { data } = await q;
      return data || [];
    },
    enabled: !!instId,
  });

  const paymentSummary = useMemo(() => {
    const now = new Date();
    const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const buckets: { key: string; label: string; paye: number; nonPaye: number }[] = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({
        key: monthKey(d),
        label: d.toLocaleDateString("fr-FR", { month: "short" }),
        paye: 0,
        nonPaye: 0,
      });
    }
    payments.forEach((p: any) => {
      const date = p.payment_date || p.created_at;
      if (!date) return;
      const k = monthKey(new Date(date));
      const slot = buckets.find((m) => m.key === k);
      if (!slot) return;
      if (p.status === "paid") slot.paye += p.paid_amount || p.amount || 0;
      else slot.nonPaye += Math.max(0, (p.amount || 0) - (p.paid_amount || 0));
    });
    const totalPayeMois = buckets[buckets.length - 1]?.paye || 0;
    const totalImpayes = payments.reduce((s: number, p: any) => {
      if (p.status === "paid") return s;
      return s + Math.max(0, (p.amount || 0) - (p.paid_amount || 0));
    }, 0);
    return { buckets, totalPayeMois, totalImpayes };
  }, [payments, months]);

  useRealtimeSubscription("profiles", [["admin-students-count", instId], ["admin-profs-count", instId], ["admin-dash-students", instId]]);
  useRealtimeSubscription("user_roles", [["admin-students-count", instId], ["admin-profs-count", instId], ["admin-dash-students", instId]]);
  useRealtimeSubscription("filieres", [["admin-dash-filieres", instId]]);
  useRealtimeSubscription("subjects", [["admin-subjects-count", instId]]);
  useRealtimeSubscription("payments", [["admin-dash-payments", instId, selectedYear]]);

  const displayName = institution?.name || "Rectorplus";

  const stats = [
    { label: "Étudiants", value: studentsCount, icon: Users, color: "bg-info/15 text-info", to: "/admin/students" },
    { label: "Professeurs", value: profsCount, icon: BookMarked, color: "bg-primary/15 text-primary", to: "/admin/professors" },
    { label: "Matières", value: subjectsCount, icon: BookOpen, color: "bg-accent/15 text-accent", to: "/admin/subjects" },
    { label: "Payé ce mois", value: `${paymentSummary.totalPayeMois.toLocaleString("fr-FR")} FCFA`, icon: CreditCard, color: "bg-success/15 text-success", to: "/admin/finances" },
  ];

  const goLevel = (level: string) => {
    if (!level || level === "—") return;
    navigate("/admin/students", { state: { level } });
  };
  const goFiliere = (filiere_id?: string) => {
    if (!filiere_id) return;
    navigate("/admin/students", { state: { filiere_id } });
  };

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <CampusOverview/>
      <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground">
            Tableau de bord
          </h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <p className="text-muted-foreground">
              Vue d’ensemble de {displayName}
            </p>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">
              Cycle {((institution as any)?.cycle || "lmd").toUpperCase()}
            </span>
            {(institution as any)?.is_multi_campus && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/20 text-accent-foreground font-semibold">
                Multi-campus
              </span>
            )}
          </div>
        </div>
        <AcademicYearSelector />
      </motion.div>

      {/* KPI cards */}
      <motion.div variants={item} className="grid grid-cols-1 min-[420px]:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card
            key={stat.label}
            onClick={() => navigate(stat.to)}
            role="link" tabIndex={0} aria-label={`${stat.label} : ${stat.value}. Ouvrir le détail`}
            onKeyDown={event=>{if(event.key==='Enter')navigate(stat.to);}}
            className="dashboard-stat glass-card-elevated border-border/50 cursor-pointer transition-all"
          >
            <CardContent className="flex min-h-[130px] items-center gap-4 p-5 sm:p-5 sm:pt-5">
              <div className={`h-14 w-14 shrink-0 rounded-2xl flex items-center justify-center ${stat.color}`}>
                <stat.icon className="h-7 w-7" />
              </div>
              <div className="min-w-0"><p className="text-sm font-medium text-muted-foreground">{stat.label}</p><p className="mt-2 font-heading text-2xl font-bold tracking-tight text-foreground truncate">{stat.value}</p></div>
            </CardContent>
          </Card>
        ))}
      </motion.div>

      {/* Charts row 1 */}
      <motion.div variants={item} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="glass-card-elevated">
          <CardHeader>
            <CardTitle className="text-base">
              Étudiants par niveau{" "}
              <span className="text-xs font-normal text-muted-foreground">— cliquez sur une barre</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {studentsByLevel.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">Aucune donnée</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={studentsByLevel} onClick={(e: any) => goLevel(e?.activeLabel)}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="level" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Bar
                    dataKey="count"
                    name="Étudiants"
                    fill="hsl(var(--primary))"
                    radius={[6, 6, 0, 0]}
                    cursor="pointer"
                    onClick={(d: any) => goLevel(d?.level)}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="glass-card-elevated">
          <CardHeader><CardTitle className="text-base">Répartition par filière</CardTitle></CardHeader>
          <CardContent className="h-72">
            {studentsByFiliere.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">Aucune donnée</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={studentsByFiliere}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={64}
                    outerRadius={94}
                    cursor="pointer"
                    onClick={(d: any) => goFiliere(d?.filiere_id)}
                  >
                    {studentsByFiliere.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                    <ChartLabel position="center" content={({viewBox})=>{
                      const center=viewBox as {cx?:number;cy?:number};
                      return <g><text x={center.cx} y={center.cy} dy={-2} textAnchor="middle" fill="hsl(var(--foreground))" fontSize={30} fontWeight={700}>{studentRows.length}</text><text x={center.cx} y={center.cy} dy={21} textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize={12}>Étudiants</text></g>;
                    }} />
                  </Pie>
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <DashboardCommunications />
      <DashboardActivity />

      {/* Payments chart */}
      <motion.div variants={item} className="grid grid-cols-1 gap-4">
        <Card className="glass-card-elevated">
          <CardHeader>
            <CardTitle className="text-base flex flex-wrap items-center justify-between gap-3">
              <span>Évolution des paiements</span>
              <div className="flex items-center gap-3">
                <span className="text-xs font-normal text-muted-foreground">
                  Impayés : {paymentSummary.totalImpayes.toLocaleString("fr-FR")} FCFA
                </span>
                <Select value={period} onValueChange={(v: any) => setPeriod(v)}>
                  <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">3 derniers mois</SelectItem>
                    <SelectItem value="6">6 derniers mois</SelectItem>
                    <SelectItem value="12">12 derniers mois</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {payments.length===0?<div className="grid h-full place-content-center text-center text-sm text-muted-foreground"><CreditCard className="mx-auto mb-3 h-9 w-9 text-primary/40"/><p>Aucun paiement enregistré pour cette année.</p><p className="mt-1 text-xs">Le graphique apparaîtra après les premiers paiements.</p></div>:
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={paymentSummary.buckets}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                  formatter={(v: number) => `${v.toLocaleString("fr-FR")} FCFA`}
                />
                <Legend />
                <Line type="monotone" dataKey="paye" name="Payé" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="nonPaye" name="Non payé" stroke="hsl(var(--warning))" strokeWidth={2.5} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
            }
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
};

function AdminDashboardPage(){
 const {isLoading,isPrincipal,can}=usePermissions();if(isLoading)return <p>Chargement de vos accès…</p>;if(isPrincipal)return <AdminDashboardOverview/>;
 const destinations=ADMIN_MODULES.filter(module=>can(module.key)&&!module.key.startsWith('director_')).map(module=>({...module,path:Object.entries(ROUTE_MODULE_MAP).find(([route,key])=>key===module.key&&route!=='settings')?.[0]})).filter(module=>module.path);
 return <div className="space-y-6"><div><h1 className="text-3xl font-bold">Votre espace de travail</h1><p className="text-muted-foreground mt-2">Les outils autorisés par votre établissement, réunis ici.</p></div><div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">{destinations.map(module=><Link key={module.key} to={'/admin/'+module.path} className="rounded-xl border bg-card p-5 hover:border-primary transition-colors"><h2 className="font-semibold">{module.label}</h2><p className="text-sm text-primary mt-3">Ouvrir le module →</p></Link>)}<Link to="/admin/messages" className="rounded-xl border bg-card p-5"><h2 className="font-semibold">Messagerie</h2><p className="text-sm text-primary mt-3">Consulter mes échanges →</p></Link></div>{!destinations.length&&<p className="text-sm text-muted-foreground">Aucun module métier n’est attribué. Contactez l’administrateur principal.</p>}</div>;
}
export default AdminDashboardPage;
