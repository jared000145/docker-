import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, FileText, Download } from "lucide-react";
import { QRAuthGate } from "@/components/QRAuthGate";

const docLabel = (t: string) => ({
  receipt: "Reçu",
  attestation: "Attestation",
  inscription: "Fiche d'inscription",
  bulletin: "Bulletin",
  releve: "Relevé de notes",
  autre: "Document",
}[t] || t);

export default function DocumentVerifyPage() {
  const [params] = useSearchParams();
  const id = params.get("id");

  const { data, isLoading } = useQuery({
    queryKey: ["verify-doc", id],
    enabled: !!id,
    queryFn: async () => {
      const { data: row } = await supabase.rpc("verify_student_document", { _id: id! }).maybeSingle();
      if (!row) return null;
      const r: any = row;
      return {
        doc: {
          id: r.id, doc_type: r.doc_type, title: r.title, file_url: r.file_url,
          academic_year: r.academic_year, created_at: r.created_at,
        },
        stu: {
          first_name: r.student_first_name, last_name: r.student_last_name,
          student_number: r.student_number, level: r.student_level,
          filieres: r.filiere_name ? { name: r.filiere_name } : null,
        },
        inst: { name: r.institution_name, logo_url: r.institution_logo },
      };
    },
  });

  return (
    <QRAuthGate isValid={!!id && !!data} loading={isLoading} title="Connexion pour consulter le document">
      {data && (() => {
        const { doc, stu, inst } = data as any;
        return (
          <div className="min-h-screen flex items-center justify-center p-6 bg-muted/30">
            <Helmet>
              <title>Vérification du document — {inst?.name || "Rectorplus"}</title>
              <meta name="description" content={`Vérification d'authenticité d'un ${docLabel(doc.doc_type)} délivré par ${inst?.name || "l'établissement"}.`} />
              <link rel="canonical" href={`https://rectorplus.com/verify/document?id=${doc.id}`} />
              <meta name="robots" content="noindex" />
            </Helmet>
            <Card className="max-w-lg w-full">
              <CardHeader className="text-center">
                {inst?.logo_url && <img src={inst.logo_url} alt={`Logo ${inst?.name || "de l'établissement"}`} className="w-16 h-16 mx-auto mb-2 object-contain" />}
                <h1 className="sr-only">Vérification de document — {inst?.name || "Établissement"}</h1>
                <CardTitle>{inst?.name || "Établissement"}</CardTitle>
                <div className="flex items-center justify-center gap-2 mt-2 text-green-600">
                  <CheckCircle2 className="w-5 h-5" /> <span className="font-semibold">Document authentique</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Étudiant</span><span className="font-medium">{stu?.first_name} {stu?.last_name}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Matricule</span><span>{stu?.student_number || "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Filière</span><span>{stu?.filieres?.name || "—"} {stu?.level || ""}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Type</span><span><FileText className="inline w-3 h-3 mr-1" />{docLabel(doc.doc_type)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Titre</span><span>{doc.title}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Année académique</span><span>{doc.academic_year || "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Date d'émission</span><span>{new Date(doc.created_at).toLocaleDateString("fr-FR")}</span></div>
                {doc.file_url && (
                  <Button asChild className="w-full mt-3"><a href={doc.file_url} target="_blank" rel="noreferrer"><Download className="w-4 h-4 mr-2" /> Télécharger le PDF</a></Button>
                )}
                <div className="text-xs text-muted-foreground text-center pt-3">ID: {doc.id}</div>
              </CardContent>
            </Card>
          </div>
        );
      })()}
    </QRAuthGate>
  );
}
