import {useAcademicYear} from '@/hooks/useAcademicYear';
import {useCampus} from "@/hooks/useCampus";
import { useMemo } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet, TrendingUp, AlertTriangle } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

const fmt = (n: number) => (n || 0).toLocaleString("fr-FR") + " FCFA";
const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } };

export default function DirectorFinancePage() {
  const { profile } = useAuth();
  const instId = profile?.institution_id;
  const {selectedYear}=useAcademicYear();
  const {campusId} = useCampus();

  const { data: payments = [] } = useQuery({
    queryKey: ["dir-fin-payments", instId, campusId, selectedYear],
    queryFn: async () => {
      const { data } = await supabase
        .from("payments")
        .select("amount, paid_amount, status, payment_date, created_at, campus_id")
        .eq("institution_id", instId!).eq("academic_year",selectedYear);
      return (data || []).filter((row: any) => !campusId || row.campus_id === campusId);
    },
    enabled: !!instId,
  });

  const today = new Date();
  const stats = useMemo(() => {
    const totalPaid = payments.reduce((s: number, p: any) => s + Number(p.paid_amount || 0), 0);
    const unpaid = payments.reduce((s: number, p: any) => s + Math.max(0, Number(p.amount || 0) - Number(p.paid_amount || 0)), 0);
    const monthPaid = payments.filter((p: any) => {
      const d = p.payment_date ? new Date(p.payment_date) : new Date(p.created_at);
      return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
    }).reduce((s: number, p: any) => s + Number(p.paid_amount || 0), 0);
    return { totalPaid, unpaid, monthPaid };
  }, [payments]);

  const chartData = useMemo(() => {
    const map = new Map<string, number>();
    payments.forEach((p: any) => {
      const d = p.payment_date ? new Date(p.payment_date) : new Date(p.created_at);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      map.set(k, (map.get(k) || 0) + Number(p.paid_amount || 0));
    });
    const rows = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      rows.push({ label: d.toLocaleDateString("fr-FR", { month: "short" }), revenue: map.get(k) || 0 });
    }
    return rows;
  }, [payments]);

  const cards = [
    { label: "Total payé", value: fmt(stats.totalPaid), icon: Wallet, tint: "text-emerald-600 bg-emerald-500/10" },
    { label: "Impayés", value: fmt(stats.unpaid), icon: AlertTriangle, tint: "text-destructive bg-destructive/10" },
    { label: "Revenus du mois", value: fmt(stats.monthPaid), icon: TrendingUp, tint: "text-primary bg-primary/10" },
  ];

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={item}>
        <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground flex items-center gap-2">
          <Wallet className="w-7 h-7 text-accent" /> Résumé financier
        </h1>
        <p className="text-muted-foreground mt-1">Vue simple et synthétique de la situation financière.</p>
      </motion.div>

      <motion.div variants={item} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {cards.map((c) => (
          <Card key={c.label} className="border-border/60">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`w-11 h-11 rounded-lg flex items-center justify-center ${c.tint}`}>
                <c.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{c.label}</p>
                <p className="text-lg font-bold text-foreground">{c.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </motion.div>

      <motion.div variants={item}>
        <Card className="border-border/60">
          <CardHeader><CardTitle className="text-lg">Évolution des revenus (6 mois)</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="finG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: any) => fmt(Number(v))} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                <Area type="monotone" dataKey="revenue" stroke="hsl(var(--accent))" fill="url(#finG)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
