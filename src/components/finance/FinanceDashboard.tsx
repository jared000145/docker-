import {useCampus} from "@/hooks/useCampus";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useInstitution } from "@/hooks/useInstitution";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Wallet, TrendingUp, AlertTriangle, CheckCircle2 } from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis,
  Tooltip, ResponsiveContainer, Legend, CartesianGrid,
} from "recharts";

const fmt = (n: number) => (n || 0).toLocaleString("fr-FR") + " FCFA";
const COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--success))", "hsl(var(--warning))", "hsl(var(--info))", "#a855f7", "#ec4899", "#14b8a6"];

export default function FinanceDashboard() {
  const { institution } = useInstitution();
  const { selectedYear } = useAcademicYear();
  const instId = institution?.id;
  const {campusId} = useCampus();

  const { data: payments = [] } = useQuery({
    queryKey: ["finance-dash-payments", instId, selectedYear, campusId],
    enabled: !!instId,
    queryFn: async () => {
      const { data } = await supabase
        .from("payments").select("*")
        .eq("institution_id", instId!).eq("academic_year", selectedYear);
      return (data || []).filter((row: any) => !campusId || !("campus_id" in row) || row.campus_id === campusId);
    },
  });

  const { data: students = [] } = useQuery({
    queryKey: ["finance-dash-students", instId, campusId],
    enabled: !!instId,
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "user");
      const ids = (roles || []).map((r: any) => r.user_id);
      if (ids.length === 0) return [];
      const { data } = await supabase.from("profiles")
        .select("user_id, first_name, last_name, filiere_id, level, campus_id")
        .eq("institution_id", instId!).in("user_id", ids);
      return (data || []).filter((row: any) => !campusId || !("campus_id" in row) || row.campus_id === campusId);
    },
  });

  const { data: filieres = [] } = useQuery({
    queryKey: ["finance-dash-filieres", instId, campusId],
    enabled: !!instId,
    queryFn: async () => {
      const { data } = await supabase.from("filieres").select("id, name").eq("institution_id", instId!);
      return (data || []).filter((row: any) => !campusId || !("campus_id" in row) || row.campus_id === campusId);
    },
  });

  const stu = useMemo(() => new Map(students.map((s: any) => [s.user_id, s])), [students]);
  const fil = useMemo(() => new Map(filieres.map((f: any) => [f.id, f.name])), [filieres]);

  const totals = useMemo(() => {
    const total = payments.reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
    const paid = payments.reduce((s: number, p: any) => s + Number(p.paid_amount || 0), 0);
    return { total, paid, remaining: total - paid, pct: total ? Math.round((paid / total) * 100) : 0 };
  }, [payments]);

  // monthly
  const monthly = useMemo(() => {
    const m = new Map<string, { month: string; paye: number; total: number }>();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i);
      const k = d.toLocaleString("fr-FR", { month: "short", year: "2-digit" });
      m.set(`${d.getFullYear()}-${d.getMonth()}`, { month: k, paye: 0, total: 0 });
    }
    payments.forEach((p: any) => {
      const d = new Date(p.payment_date || p.created_at);
      const k = `${d.getFullYear()}-${d.getMonth()}`;
      const row = m.get(k); if (!row) return;
      row.paye += Number(p.paid_amount || 0);
      row.total += Number(p.amount || 0);
    });
    return Array.from(m.values());
  }, [payments]);

  // by filière
  const byFiliere = useMemo(() => {
    const m = new Map<string, { name: string; paye: number; total: number }>();
    payments.forEach((p: any) => {
      const s: any = stu.get(p.user_id);
      const name = (s && fil.get(s.filiere_id)) || "Sans filière";
      const row = m.get(name) || { name, paye: 0, total: 0 };
      row.paye += Number(p.paid_amount || 0); row.total += Number(p.amount || 0);
      m.set(name, row);
    });
    return Array.from(m.values());
  }, [payments, stu, fil]);

  // by level
  const byLevel = useMemo(() => {
    const m = new Map<string, { level: string; paye: number; total: number }>();
    payments.forEach((p: any) => {
      const s: any = stu.get(p.user_id);
      const lvl = s?.level || "?";
      const row = m.get(lvl) || { level: lvl, paye: 0, total: 0 };
      row.paye += Number(p.paid_amount || 0); row.total += Number(p.amount || 0);
      m.set(lvl, row);
    });
    return Array.from(m.values()).sort((a, b) => a.level.localeCompare(b.level));
  }, [payments, stu]);

  // by class (filière + niveau)
  const byClass = useMemo(() => {
    const m = new Map<string, { cls: string; paye: number; total: number }>();
    payments.forEach((p: any) => {
      const s: any = stu.get(p.user_id);
      if (!s) return;
      const cls = `${fil.get(s.filiere_id) || "?"} ${s.level || ""}`.trim();
      const row = m.get(cls) || { cls, paye: 0, total: 0 };
      row.paye += Number(p.paid_amount || 0); row.total += Number(p.amount || 0);
      m.set(cls, row);
    });
    return Array.from(m.values()).sort((a, b) => b.paye - a.paye).slice(0, 10);
  }, [payments, stu, fil]);

  const latestPayments = useMemo(
    () => [...payments].sort((a: any, b: any) =>
      new Date(b.payment_date || b.created_at).getTime() - new Date(a.payment_date || a.created_at).getTime()
    ).slice(0, 8),
    [payments]
  );

  const topFilieres = useMemo(() =>
    [...byFiliere].map(f => ({ ...f, pct: f.total ? (f.paye / f.total) * 100 : 0 }))
      .sort((a, b) => b.pct - a.pct).slice(0, 5),
    [byFiliere]
  );

  const lateStudents = useMemo(() => {
    const m = new Map<string, { id: string; name: string; due: number }>();
    payments.forEach((p: any) => {
      const due = Number(p.amount) - Number(p.paid_amount || 0);
      if (due <= 0) return;
      const s: any = stu.get(p.user_id);
      const name = s ? `${s.first_name} ${s.last_name}` : p.user_id.slice(0, 8);
      const row = m.get(p.user_id) || { id: p.user_id, name, due: 0 };
      row.due += due; m.set(p.user_id, row);
    });
    return Array.from(m.values()).sort((a, b) => b.due - a.due).slice(0, 8);
  }, [payments, stu]);

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total facturé", value: fmt(totals.total), icon: Wallet, color: "text-foreground" },
          { label: "Total payé", value: fmt(totals.paid), icon: CheckCircle2, color: "text-success" },
          { label: "Total restant", value: fmt(totals.remaining), icon: AlertTriangle, color: "text-warning" },
          { label: "Taux de paiement", value: `${totals.pct}%`, icon: TrendingUp, color: "text-accent" },
        ].map((k) => (
          <Card key={k.label} className="glass-card-elevated">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{k.label}</span>
                <k.icon className={`w-4 h-4 ${k.color}`} />
              </div>
              <p className={`text-xl font-bold mt-2 ${k.color}`}>{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Progress value={totals.pct} className="h-2" />

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Paiements par mois (12 derniers)</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="month" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip formatter={(v: any) => fmt(Number(v))} />
                <Legend />
                <Line type="monotone" dataKey="paye" name="Payé" stroke="hsl(var(--success))" strokeWidth={2} />
                <Line type="monotone" dataKey="total" name="Facturé" stroke="hsl(var(--primary))" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Répartition par filière</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={byFiliere} dataKey="paye" nameKey="name" outerRadius={85} label={(e: any) => e.name}>
                  {byFiliere.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: any) => fmt(Number(v))} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Paiements par niveau</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byLevel}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="level" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip formatter={(v: any) => fmt(Number(v))} />
                <Legend />
                <Bar dataKey="paye" name="Payé" fill="hsl(var(--success))" />
                <Bar dataKey="total" name="Facturé" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Top classes (payé)</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byClass} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis type="number" fontSize={11} />
                <YAxis type="category" dataKey="cls" width={140} fontSize={11} />
                <Tooltip formatter={(v: any) => fmt(Number(v))} />
                <Bar dataKey="paye" fill="hsl(var(--accent))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Derniers paiements</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {latestPayments.length === 0 && <p className="text-xs text-muted-foreground">Aucun paiement</p>}
            {latestPayments.map((p: any) => {
              const s: any = stu.get(p.user_id);
              return (
                <div key={p.id} className="flex justify-between text-sm border-b border-border/40 pb-1.5">
                  <span className="truncate">{s ? `${s.first_name} ${s.last_name}` : "—"}</span>
                  <span className="text-success font-medium">{fmt(p.paid_amount)}</span>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Filières les plus solvables</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {topFilieres.length === 0 && <p className="text-xs text-muted-foreground">—</p>}
            {topFilieres.map((f) => (
              <div key={f.name}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="truncate">{f.name}</span>
                  <span className="font-medium">{Math.round(f.pct)}%</span>
                </div>
                <Progress value={f.pct} className="h-1.5" />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Étudiants en retard</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {lateStudents.length === 0 && <p className="text-xs text-muted-foreground">Tous à jour 🎉</p>}
            {lateStudents.map((l) => (
              <div key={l.id} className="flex justify-between text-sm border-b border-border/40 pb-1.5">
                <span className="truncate">{l.name}</span>
                <span className="text-warning font-medium">{fmt(l.due)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
