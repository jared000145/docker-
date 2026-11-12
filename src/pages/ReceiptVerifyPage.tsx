import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2 } from "lucide-react";
import { QRAuthGate } from "@/components/QRAuthGate";

export default function ReceiptVerifyPage() {
  const { id } = useParams();
  const { data, isLoading } = useQuery({
    queryKey: ["verify-receipt", id],
    queryFn: async () => {
      const { data: row } = await supabase.rpc("verify_payment_by_id", { _id: id! }).maybeSingle();
      if (!row) return null;
      const r: any = row;
      return {
        payment: {
          id: r.id, amount: r.amount, paid_amount: r.paid_amount, status: r.status,
          payment_date: r.payment_date, description: r.description,
        },
        profile: {
          first_name: r.student_first_name, last_name: r.student_last_name,
          student_number: r.student_number, level: r.student_level,
          filieres: r.filiere_name ? { name: r.filiere_name } : null,
        },
        inst: { name: r.institution_name, logo_url: r.institution_logo },
      };
    },
    enabled: !!id,
  });

  return (
    <QRAuthGate isValid={!!data} loading={isLoading} title="Connexion pour consulter le reçu">
      {data && (() => {
        const { payment, profile, inst } = data as any;
        return (
          <div className="min-h-screen flex items-center justify-center p-6 bg-muted/30">
            <Helmet>
              <title>Vérification du reçu — {inst?.name || "Rectorplus"}</title>
              <meta name="description" content={`Vérification d'authenticité d'un reçu de paiement émis par ${inst?.name || "l'établissement"}.`} />
              <link rel="canonical" href={`https://rectorplus.com/verify/receipt/${payment.id}`} />
              <meta name="robots" content="noindex" />
            </Helmet>
            <Card className="max-w-lg w-full">
              <CardHeader className="text-center">
                {inst?.logo_url && <img src={inst.logo_url} alt={`Logo ${inst?.name || "de l'établissement"}`} className="w-16 h-16 mx-auto mb-2 object-contain" />}
                <h1 className="sr-only">Vérification de reçu — {inst?.name || "Établissement"}</h1>
                <CardTitle>{inst?.name || "Établissement"}</CardTitle>
                <div className="flex items-center justify-center gap-2 mt-2 text-green-600">
                  <CheckCircle2 className="w-5 h-5" /> <span className="font-semibold">Reçu authentique</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Étudiant</span><span className="font-medium">{profile?.first_name} {profile?.last_name}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Matricule</span><span>{profile?.student_number || "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Filière</span><span>{(profile as any)?.filieres?.name || "—"} {profile?.level || ""}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Description</span><span>{payment.description || "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Montant payé</span><span className="font-semibold">{Number(payment.paid_amount || 0).toLocaleString()} FCFA</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Statut</span><span>{payment.status === "paid" ? "Payé" : payment.status === "partial" ? "Partiel" : "Non payé"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Date</span><span>{payment.payment_date || "—"}</span></div>
                <div className="text-xs text-muted-foreground text-center pt-3">ID: {payment.id}</div>
              </CardContent>
            </Card>
          </div>
        );
      })()}
    </QRAuthGate>
  );
}
