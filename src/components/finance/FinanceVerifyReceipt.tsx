import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Search, ShieldCheck } from "lucide-react";

const fmt = (n: number) => (Number(n) || 0).toLocaleString("fr-FR") + " FCFA";

export default function FinanceVerifyReceipt() {
  const [num, setNum] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [notFound, setNotFound] = useState(false);

  const check = async () => {
    if (!num.trim()) return;
    setLoading(true); setResult(null); setNotFound(false);
    try {
      const { data: row } = await supabase
        .rpc("verify_payment_by_receipt", { _receipt_number: num.trim().toUpperCase() })
        .maybeSingle();
      if (!row) { setNotFound(true); setLoading(false); return; }
      const r: any = row;
      setResult({
        pay: {
          receipt_number: r.receipt_number, description: r.description,
          paid_amount: r.paid_amount, status: r.status,
          payment_date: r.payment_date, payment_method: r.payment_method,
        },
        stu: {
          first_name: r.student_first_name, last_name: r.student_last_name,
          student_number: r.student_number, level: r.student_level,
          filieres: r.filiere_name ? { name: r.filiere_name } : null,
        },
      });
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <Card className="glass-card-elevated">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="w-5 h-5 text-accent" /> Vérification de reçu
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">Entrez le numéro du reçu (ex. <code className="bg-secondary/50 px-1 rounded">RCP-2026-000001</code>) pour vérifier son authenticité.</p>
          <div className="flex gap-2">
            <Input placeholder="Numéro de reçu" value={num} onChange={(e) => setNum(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && check()} />
            <Button onClick={check} disabled={loading || !num.trim()}>
              <Search className="w-4 h-4 mr-1" /> Vérifier
            </Button>
          </div>
        </CardContent>
      </Card>

      {notFound && (
        <Card className="border-destructive/40">
          <CardContent className="p-6 text-center">
            <XCircle className="w-12 h-12 mx-auto text-destructive mb-2" />
            <p className="font-semibold">Reçu invalide ou introuvable (faux reçu).</p>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card className="border-success/40">
          <CardHeader>
            <div className="flex items-center gap-2 text-success">
              <CheckCircle2 className="w-5 h-5" />
              <CardTitle className="text-base">Reçu authentique</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">N° reçu</span><span className="font-mono">{result.pay.receipt_number}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Étudiant</span><span className="font-medium">{result.stu?.first_name} {result.stu?.last_name}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Matricule</span><span>{result.stu?.student_number || "—"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Filière</span><span>{result.stu?.filieres?.name || "—"} {result.stu?.level || ""}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Frais payé</span><span>{result.pay.description}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Montant payé</span><span className="font-semibold text-success">{fmt(result.pay.paid_amount)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Mode</span><span>{result.pay.payment_method || "Espèces"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Date</span><span>{result.pay.payment_date ? new Date(result.pay.payment_date).toLocaleDateString("fr-FR") : "—"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Statut</span><Badge>{result.pay.status === "paid" ? "Payé" : "Partiel"}</Badge></div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
