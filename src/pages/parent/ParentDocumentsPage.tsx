import { useQuery } from "@tanstack/react-query";
import { useParentContext } from "@/components/ParentLayout";
import { useInstitution } from "@/hooks/useInstitution";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download } from "lucide-react";
import { downloadAttestationPdf } from "@/lib/attestationPdf";

const ParentDocumentsPage = () => {
  const { selectedChildId } = useParentContext();
  const { institution } = useInstitution();

  const { data: child } = useQuery({
    queryKey: ["parent-doc-child", selectedChildId],
    enabled: !!selectedChildId,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name, student_number, level, date_of_birth, birth_place, academic_year, filieres(name)")
        .eq("user_id", selectedChildId!)
        .maybeSingle();
      return data as any;
    },
  });

  const handleAttestation = () => {
    if (!child) return;
    downloadAttestationPdf({
      student: {
        user_id: child.user_id,
        first_name: child.first_name,
        last_name: child.last_name,
        student_number: child.student_number,
        date_of_birth: child.date_of_birth,
        birth_place: child.birth_place,
        level: child.level,
        filiere_name: child.filieres?.name,
        academic_year: child.academic_year,
      },
      institution: {
        name: (institution as any)?.name,
        logo_url: (institution as any)?.logo_url,
        address: (institution as any)?.address,
        country_header: (institution as any)?.country_header,
        country_motto: (institution as any)?.country_motto,
        ministry: (institution as any)?.ministry,
        signatory_name: (institution as any)?.signatory_name,
        signatory_title: (institution as any)?.signatory_title,
        city: (institution as any)?.city,
      },
    }).then((res) => {
      if (res.ok === false) {
        import("sonner").then(({ toast }) => toast.error(res.reason));
      }
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FileText className="w-5 h-5" /> Documents</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg border">
            <div>
              <p className="font-medium">Attestation de scolarité</p>
              <p className="text-xs text-muted-foreground">Téléchargez l'attestation officielle pour {child?.first_name} {child?.last_name}</p>
            </div>
            <Button onClick={handleAttestation} disabled={!child}>
              <Download className="w-4 h-4 mr-2" /> Télécharger
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Les bulletins seront publiés ici par l'établissement à la fin de chaque semestre.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default ParentDocumentsPage;
