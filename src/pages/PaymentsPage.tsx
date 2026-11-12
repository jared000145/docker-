import { motion } from "framer-motion";
import { CreditCard, CheckCircle2, AlertCircle, Clock, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { downloadReceiptPdf } from "@/lib/receiptPdf";
import { useInstitution } from "@/hooks/useInstitution";
import { useAcademicYear } from "@/hooks/useAcademicYear";

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.08 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

const formatCFA = (n: number) => n.toLocaleString("fr-FR") + " FCFA";

const PaymentsPage = () => {
  const { user, profile } = useAuth();
  const { institution } = useInstitution();
  const { selectedYear, isViewingHistory } = useAcademicYear();


  const { data: filiere } = useQuery({
    queryKey: ["my-filiere", profile?.filiere_id],
    queryFn: async () => {
      if (!profile?.filiere_id) return null;
      const { data } = await supabase.from("filieres").select("name").eq("id", profile.filiere_id).maybeSingle();
      return data as any;
    },
    enabled: !!profile?.filiere_id,
  });

  const downloadReceipt = async (p: any) => {
    await downloadReceiptPdf({
      payment: p,
      student: { first_name: profile?.first_name, last_name: profile?.last_name, student_number: profile?.student_number, level: profile?.level, filiere_name: filiere?.name },
      institution: { name: institution?.name, logo_url: institution?.logo_url, address: institution?.address, phone: institution?.phone },
    });
  };

  const { data: payments = [] } = useQuery({
    queryKey: ["payments", user?.id, selectedYear],
    queryFn: async () => {
      const { data } = await supabase
        .from("payments")
        .select("*")
        .eq("user_id", user!.id)
        .eq("academic_year", selectedYear)
        .order("created_at", { ascending: true });
      return data || [];
    },
    enabled: !!user && !!selectedYear,
  });

  useRealtimeSubscription("payments", [["payments", user?.id || "", selectedYear]], user ? { column: "user_id", value: user.id } : undefined);


  const getPaidAmount = (p: any) => p.paid_amount || (p.status === "paid" ? p.amount : 0);
  const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);
  const paidAmount = payments.reduce((sum, p) => sum + getPaidAmount(p), 0);
  const remaining = totalAmount - paidAmount;
  const paidPercent = totalAmount > 0 ? Math.round((paidAmount / totalAmount) * 100) : 0;

  const isBoursier = profile?.statut_boursier;

  // Group payments by description category for summary
  const categoryMap = new Map<string, { total: number; paid: number }>();
  payments.forEach((p) => {
    const key = p.description;
    const existing = categoryMap.get(key) || { total: 0, paid: 0 };
    existing.total += p.amount;
    existing.paid += getPaidAmount(p);
    categoryMap.set(key, existing);
  });

  // Paid tranches count
  const paidCount = payments.filter(p => p.status === "paid").length;
  const partialCount = payments.filter(p => p.status === "partial").length;
  const totalCount = payments.length;

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={item}>
        <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground">
          {isViewingHistory ? `Paiements — ${selectedYear}` : "Paiements"}
        </h1>
        <p className="text-muted-foreground mt-1">Suivez vos frais de scolarité pour l'année {selectedYear}</p>
      </motion.div>


      {/* Status badges */}
      <motion.div variants={item}>
        <div className="inline-flex items-center gap-2 flex-wrap">
          <span className={`text-xs font-medium px-3 py-1.5 rounded-full ${isBoursier ? "bg-success/15 text-success" : "bg-info/15 text-info"}`}>
            {isBoursier ? "🎓 Boursier" : "📚 Non boursier"}
          </span>
          <span className={`text-xs font-medium px-3 py-1.5 rounded-full ${paidPercent >= 100 ? "bg-success/15 text-success" : remaining > 0 ? "bg-warning/15 text-warning" : "bg-success/15 text-success"}`}>
            {paidPercent >= 100 ? "✅ À jour" : `⏳ ${paidCount}/${totalCount} payée(s) · ${partialCount} avance(s)`}
          </span>
        </div>
      </motion.div>

      {/* Summary cards */}
      <motion.div variants={item} className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="glass-card-elevated border-border/50">
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-accent" />
              </div>
              <span className="text-sm text-muted-foreground">Frais totaux</span>
            </div>
            <p className="text-2xl font-heading font-bold text-foreground">{formatCFA(totalAmount)}</p>
          </CardContent>
        </Card>
        <Card className="glass-card-elevated border-border/50">
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-success/15 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-success" />
              </div>
              <span className="text-sm text-muted-foreground">Montant payé</span>
            </div>
            <p className="text-2xl font-heading font-bold text-success">{formatCFA(paidAmount)}</p>
          </CardContent>
        </Card>
        <Card className="glass-card-elevated border-border/50">
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-warning/15 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-warning" />
              </div>
              <span className="text-sm text-muted-foreground">Reste à payer</span>
            </div>
            <p className="text-2xl font-heading font-bold text-warning">{formatCFA(remaining)}</p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Progress bar */}
      {totalAmount > 0 && (
        <motion.div variants={item}>
          <Card className="glass-card-elevated border-border/50">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-foreground flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-accent" /> Progression des paiements
                </span>
                <span className="text-sm font-bold text-accent">{paidPercent}%</span>
              </div>
              <Progress value={paidPercent} className="h-3" />
              <p className="text-xs text-muted-foreground mt-2">
                {paidCount} tranche(s) payée(s), {partialCount} avec avance sur {totalCount}
              </p>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Category breakdown */}
      {categoryMap.size > 1 && (
        <motion.div variants={item}>
          <Card className="glass-card-elevated border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-heading">Répartition par catégorie</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {Array.from(categoryMap.entries()).map(([desc, data]) => {
                const pct = data.total > 0 ? Math.round((data.paid / data.total) * 100) : 0;
                return (
                  <div key={desc} className="p-3 rounded-lg bg-secondary/20 border border-border/30">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-foreground">{desc}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatCFA(data.paid)} / {formatCFA(data.total)}
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

      {/* Payment history table */}
      <motion.div variants={item}>
        <Card className="glass-card-elevated border-border/50 overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-heading">Historique des paiements</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {payments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Aucun paiement enregistré pour l'année {selectedYear}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-secondary/30">
                      <th className="text-left p-4 text-sm font-semibold text-foreground">Description</th>
                      <th className="text-center p-4 text-sm font-semibold text-foreground">Montant initial</th>
                      <th className="text-center p-4 text-sm font-semibold text-foreground">Avance</th>
                      <th className="text-center p-4 text-sm font-semibold text-foreground">Reste</th>
                      <th className="text-center p-4 text-sm font-semibold text-foreground">Date</th>
                      <th className="text-center p-4 text-sm font-semibold text-foreground">Statut</th>
                      <th className="text-center p-4 text-sm font-semibold text-foreground">Reçu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => {
                      const paid = getPaidAmount(p);
                      const left = Math.max(0, p.amount - paid);
                      return <tr key={p.id} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                        <td className="p-4 text-sm text-foreground">{p.description}</td>
                        <td className="p-4 text-sm text-center font-medium text-foreground">{formatCFA(p.amount)}</td>
                        <td className="p-4 text-sm text-center font-medium text-success">{formatCFA(paid)}</td>
                        <td className="p-4 text-sm text-center font-medium text-warning">{formatCFA(left)}</td>
                        <td className="p-4 text-sm text-center text-muted-foreground">
                          {p.payment_date ? new Date(p.payment_date).toLocaleDateString("fr-FR") : p.due_date ? new Date(p.due_date).toLocaleDateString("fr-FR") : "—"}
                        </td>
                        <td className="p-4 text-center">
                          <span className={`text-xs font-medium px-2.5 py-1 rounded-full inline-flex items-center gap-1 ${
                            p.status === "paid" ? "bg-success/15 text-success" : p.status === "partial" ? "bg-info/15 text-info" : "bg-warning/15 text-warning"
                          }`}>
                            {p.status === "paid" ? <><CheckCircle2 className="w-3 h-3" /> Payé</> : p.status === "partial" ? <><TrendingUp className="w-3 h-3" /> Partiel</> : <><Clock className="w-3 h-3" /> Non payé</>}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          {paid > 0 ? (
                            <Button size="sm" variant="outline" onClick={() => downloadReceipt(p)}><Download className="w-3 h-3 mr-1" /> Reçu</Button>
                          ) : <span className="text-xs text-muted-foreground">—</span>}
                        </td>
                      </tr>;
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
};

export default PaymentsPage;
