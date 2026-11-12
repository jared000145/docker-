import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2 } from "lucide-react";
import { QRAuthGate } from "@/components/QRAuthGate";

export default function AttestationVerifyPage() {
  const { userId } = useParams();
  const { data, isLoading } = useQuery({
    queryKey: ["verify-attestation", userId],
    queryFn: async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name, student_number, level, academic_year, avatar_url, institution_id, filieres(name)")
        .eq("user_id", userId!)
        .maybeSingle();
      if (!profile) return null;
      const { data: inst } = profile.institution_id
        ? await supabase.from("institutions").select("name, logo_url").eq("id", profile.institution_id).maybeSingle()
        : { data: null } as any;
      return { profile, inst };
    },
    enabled: !!userId,
  });

  return (
    <QRAuthGate isValid={!!data} loading={isLoading} title="Connexion pour consulter l'attestation">
      {data && (() => {
        const { profile, inst } = data as any;
        return (
          <div className="min-h-screen flex items-center justify-center p-6 bg-muted/30">
            <Card className="max-w-lg w-full">
              <CardHeader className="text-center">
                {inst?.logo_url && <img src={inst.logo_url} alt={`Logo ${inst?.name || "de l'établissement"}`} className="w-16 h-16 mx-auto mb-2 object-contain" />}
                <CardTitle>{inst?.name || "Établissement"}</CardTitle>
                <div className="flex items-center justify-center gap-2 mt-2 text-green-600">
                  <CheckCircle2 className="w-5 h-5" /> <span className="font-semibold">Attestation authentique</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {profile.avatar_url && <img src={profile.avatar_url} alt={`Photo de ${profile.first_name} ${profile.last_name}`} className="w-24 h-24 rounded-full object-cover mx-auto" />}
                <div className="flex justify-between"><span className="text-muted-foreground">Nom complet</span><span className="font-medium">{profile.first_name} {profile.last_name}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Matricule</span><span>{profile.student_number || "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Filière</span><span>{profile.filieres?.name || "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Niveau</span><span>{profile.level || "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Année académique</span><span>{profile.academic_year || "—"}</span></div>
              </CardContent>
            </Card>
          </div>
        );
      })()}
    </QRAuthGate>
  );
}
