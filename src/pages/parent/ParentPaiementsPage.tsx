import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useParentContext } from "@/components/ParentLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { downloadReceiptPdf } from "@/lib/receiptPdf";
import { useInstitution } from "@/hooks/useInstitution";

const STATUS_LABEL: Record<string, string> = {
  paid: "Payé",
  pending: "Non payé",
  partial: "Partiel",
  overdue: "Non payé",
  failed: "Non payé",
};

const ParentPaiementsPage = () => {
  const { selectedChildId } = useParentContext();
  const { institution } = useInstitution();
  const [semester, setSemester] = useState<string>("all");

  const { data: rows = [] } = useQuery({
    queryKey: ["parent-payments", selectedChildId],
    enabled: !!selectedChildId,
    queryFn: async () => {
      const { data } = await supabase.from("payments").select("*").eq("user_id", selectedChildId!).order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: child } = useQuery({
    queryKey: ["parent-child-profile", selectedChildId],
    enabled: !!selectedChildId,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("first_name, last_name, student_number, level, filieres(name)").eq("user_id", selectedChildId!).maybeSingle();
      return data as any;
    },
  });

  const downloadReceipt = async (p: any) => {
    if (!child) return;
    await downloadReceiptPdf({
      payment: p,
      student: { first_name: child.first_name, last_name: child.last_name, student_number: child.student_number, level: child.level, filiere_name: child.filieres?.name },
      institution: { name: institution?.name, logo_url: institution?.logo_url, address: institution?.address, phone: institution?.phone },
    });
  };

  const filtered = useMemo(() => {
    if (semester === "all") return rows;
    return (rows as any[]).filter((p) => (p.semester || "") === semester);
  }, [rows, semester]);

  const total = filtered.reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
  const paid = filtered.reduce((s: number, p: any) => s + Number(p.paid_amount || 0), 0);
  const restant = total - paid;
  const pct = total ? Math.min(100, (paid / total) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-heading font-bold">Suivi des paiements</h1>
        <Select value={semester} onValueChange={setSemester}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les semestres</SelectItem>
            <SelectItem value="S1">Semestre 1</SelectItem>
            <SelectItem value="S2">Semestre 2</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader><CardTitle>Récapitulatif</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div><p className="text-xs text-muted-foreground">Total dû</p><p className="text-lg font-bold">{total.toLocaleString()} FCFA</p></div>
            <div><p className="text-xs text-muted-foreground">Payé</p><p className="text-lg font-bold text-emerald-600">{paid.toLocaleString()} FCFA</p></div>
            <div><p className="text-xs text-muted-foreground">Restant</p><p className="text-lg font-bold text-red-600">{restant.toLocaleString()} FCFA</p></div>
          </div>
          <Progress value={pct} className="h-3" />
          <p className="text-xs text-center text-muted-foreground">{pct.toFixed(0)}% réglé</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Historique</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Description</TableHead><TableHead>Semestre</TableHead><TableHead>Montant</TableHead><TableHead>Payé</TableHead><TableHead>Statut</TableHead><TableHead>Reçu</TableHead></TableRow></TableHeader>
            <TableBody>
              {filtered.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Aucun paiement</TableCell></TableRow>}
              {filtered.map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell>{p.description}</TableCell>
                  <TableCell>{p.semester || "—"}</TableCell>
                  <TableCell>{Number(p.amount).toLocaleString()}</TableCell>
                  <TableCell>{Number(p.paid_amount).toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant={p.status === "paid" ? "default" : p.status === "partial" ? "secondary" : "destructive"}>
                      {STATUS_LABEL[p.status] || p.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {(Number(p.paid_amount || 0) > 0) ? (
                      <Button size="sm" variant="outline" onClick={() => downloadReceipt(p)}><Download className="w-3 h-3 mr-1" /> Reçu</Button>
                    ) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default ParentPaiementsPage;
