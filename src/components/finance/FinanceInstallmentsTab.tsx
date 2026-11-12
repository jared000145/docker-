import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useInstitution } from "@/hooks/useInstitution";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

const fmt = (n: number) => (n || 0).toLocaleString("fr-FR") + " FCFA";

export default function FinanceInstallmentsTab() {
  const { user } = useAuth();
  const { institution } = useInstitution();
  const { selectedYear } = useAcademicYear();
  const instId = institution?.id;
  const qc = useQueryClient();

  const [selectedPayment, setSelectedPayment] = useState<string>("");
  const [form, setForm] = useState({ number: 1, amount: 0, due_date: "" });

  const { data: payments = [] } = useQuery({
    queryKey: ["fin-inst-payments", instId, selectedYear],
    enabled: !!instId,
    queryFn: async () => {
      const { data } = await supabase.from("payments")
        .select("id, description, amount, user_id")
        .eq("institution_id", instId!).eq("academic_year", selectedYear)
        .order("created_at", { ascending: false }).limit(500);
      return data || [];
    },
  });

  const { data: students = [] } = useQuery({
    queryKey: ["fin-inst-students", instId],
    enabled: !!instId,
    queryFn: async () => {
      const { data } = await supabase.from("profiles")
        .select("user_id, first_name, last_name, student_number")
        .eq("institution_id", instId!);
      return data || [];
    },
  });
  const stuMap = new Map(students.map((s: any) => [s.user_id, s]));

  const { data: installments = [] } = useQuery({
    queryKey: ["fin-installments", instId],
    enabled: !!instId,
    queryFn: async () => {
      const { data } = await supabase.from("payment_installments")
        .select("*").eq("institution_id", instId!)
        .order("due_date", { ascending: true });
      return data || [];
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["fin-installments"] });

  const addInstallment = async () => {
    if (!selectedPayment || !form.amount) return toast.error("Paiement et montant requis");
    const { error } = await supabase.from("payment_installments").insert({
      payment_id: selectedPayment,
      installment_number: form.number,
      amount: form.amount,
      due_date: form.due_date || null,
      institution_id: instId!,
      created_by: user?.id,
      updated_by: user?.id,
    } as any);
    if (error) return toast.error(error.message);
    toast.success("Tranche créée");
    setForm({ number: form.number + 1, amount: 0, due_date: "" });
    refresh();
  };

  const updatePaid = async (id: string, paid: number) => {
    const { error } = await supabase.from("payment_installments")
      .update({ paid_amount: paid, updated_by: user?.id } as any).eq("id", id);
    if (error) return toast.error(error.message);
    refresh();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("payment_installments").delete().eq("id", id);
    if (error) return toast.error(error.message);
    refresh();
  };

  const overdueCount = installments.filter((i: any) => i.status === "overdue").length;
  const paymentMap = new Map(payments.map((p: any) => [p.id, p]));

  return (
    <div className="space-y-4">
      {overdueCount > 0 && (
        <Card className="border-warning bg-warning/5">
          <CardContent className="p-3 flex items-center gap-2 text-sm">
            <AlertTriangle className="w-4 h-4 text-warning" />
            <span>{overdueCount} tranche(s) en retard</span>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Définir une nouvelle tranche</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
            <div className="md:col-span-5">
              <Label className="text-xs">Paiement (étudiant — description)</Label>
              <Select value={selectedPayment} onValueChange={setSelectedPayment}>
                <SelectTrigger><SelectValue placeholder="Choisir un paiement" /></SelectTrigger>
                <SelectContent>
                  {payments.map((p: any) => {
                    const s: any = stuMap.get(p.user_id);
                    const name = s ? `${s.first_name} ${s.last_name}` : "—";
                    return <SelectItem key={p.id} value={p.id}>{name} — {p.description} ({fmt(p.amount)})</SelectItem>;
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs">N° tranche</Label>
              <Input type="number" min={1} value={form.number} onChange={(e) => setForm({ ...form, number: Number(e.target.value) })} />
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs">Montant</Label>
              <Input type="number" value={form.amount || ""} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} />
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs">Date limite</Label>
              <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
            </div>
            <Button className="md:col-span-1" onClick={addInstallment}><Plus className="w-4 h-4" /></Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Tranches existantes</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="text-left p-2">Étudiant</th>
                <th className="text-left p-2">Paiement</th>
                <th className="text-center p-2">N°</th>
                <th className="text-center p-2">Montant</th>
                <th className="text-center p-2">Payé</th>
                <th className="text-center p-2">Échéance</th>
                <th className="text-center p-2">Statut</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {installments.length === 0 && (
                <tr><td colSpan={8} className="text-center p-6 text-muted-foreground">Aucune tranche</td></tr>
              )}
              {installments.map((i: any) => {
                const p: any = paymentMap.get(i.payment_id);
                const s: any = p && stuMap.get(p.user_id);
                return (
                  <tr key={i.id} className="border-b hover:bg-secondary/20">
                    <td className="p-2">{s ? `${s.first_name} ${s.last_name}` : "—"}</td>
                    <td className="p-2 text-muted-foreground">{p?.description || "—"}</td>
                    <td className="p-2 text-center">{i.installment_number}</td>
                    <td className="p-2 text-center">{fmt(i.amount)}</td>
                    <td className="p-2 text-center">
                      <Input type="number" defaultValue={i.paid_amount} className="h-8 w-24 mx-auto"
                        onBlur={(e) => Number(e.target.value) !== i.paid_amount && updatePaid(i.id, Number(e.target.value))} />
                    </td>
                    <td className="p-2 text-center">{i.due_date ? new Date(i.due_date).toLocaleDateString("fr-FR") : "—"}</td>
                    <td className="p-2 text-center">
                      <Badge variant={i.status === "paid" ? "default" : i.status === "overdue" ? "destructive" : "secondary"}>
                        {i.status === "paid" ? "Payé" : i.status === "overdue" ? "En retard" : i.status === "partial" ? "Partiel" : "En attente"}
                      </Badge>
                    </td>
                    <td className="p-2">
                      <ConfirmDialog
                        trigger={
                          <Button variant="ghost" size="icon">
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        }
                        onConfirm={() => remove(i.id)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
