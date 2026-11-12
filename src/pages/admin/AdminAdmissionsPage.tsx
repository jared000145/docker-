import {useCampus} from '@/hooks/useCampus';
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { DoorOpen, Loader2, Save, GraduationCap, CheckCircle2 } from "lucide-react";
import {ProgramFeesEditor,AnbgVerification} from '@/components/admin/AdmissionsOperations';
import {useCycle} from '@/hooks/useCycle';

export default function AdminAdmissionsPage() {
  const {hasUniversite}=useCycle(); const {campusId}=useCampus();
  const { profile } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const institutionId = (profile as any)?.institution_id as string | undefined;

  const [contact, setContact] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: institution } = useQuery({
    queryKey: ["admissions-institution", institutionId],
    enabled: !!institutionId,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("institutions")
        .select("id, name, accepts_applications, admission_contact")
        .eq("id", institutionId!).maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  const { data: filieres = [] } = useQuery({
    queryKey: ["admissions-filieres", institutionId,campusId],
    enabled: !!institutionId,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("filieres")
        .select("*")
        .eq("institution_id", institutionId!).order("name");
      if (error) throw error;
      return ((data as any[]) || []).filter(f=>!campusId||f.campus_id===campusId);
    },
  });

  useEffect(() => {
    if (institution) setContact(institution.admission_contact ?? "");
  }, [institution]);

  const saveInstitution = async () => {
    setSaving(true);
    try {
      const { error } = await (supabase as any).from("institutions")
        .update({ accepts_applications: true, admission_contact: contact || institution?.admission_contact || null })
        .eq("id", institutionId!);
      if (error) throw error;
      toast({ title: "Admissions mises à jour" });
      qc.invalidateQueries({ queryKey: ["admissions-institution", institutionId] });
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const updateFiliere = async (id: string, patch: Record<string, any>) => {
    const { error } = await (supabase as any).from("filieres").update(patch).eq("id", id);
    if (error) { toast({ title: "Erreur", description: error.message, variant: "destructive" }); return; }
    qc.invalidateQueries({ queryKey: ["admissions-filieres", institutionId,campusId] });
  };

  if(!hasUniversite)return <div className="space-y-6"><header><h1 className="text-2xl font-bold">Orientation des bacheliers</h1><p className="text-muted-foreground mt-2">Publiez les résultats du bac depuis le dossier de chaque élève, puis accompagnez ses candidatures. Les formations proposées appartiennent aux universités du réseau.</p></header><AnbgVerification/></div>;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
          <DoorOpen className="h-6 w-6 text-primary" /> Admissions
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Vos filières existantes sont automatiquement visibles par les élèves de Terminale.
        </p>
      </div>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg">Candidatures de l'établissement</CardTitle>
          <CardDescription>
            Votre établissement apparaît automatiquement dans l'orientation. Aucun catalogue séparé n'est à créer.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-border p-3 bg-muted/30">
            <div>
              <p className="font-medium text-sm">Réception des candidatures active</p>
              <p className="text-xs text-muted-foreground">{institution?.name}</p>
            </div>
            <CheckCircle2 className="h-5 w-5 text-primary" aria-label="Active" />
          </div>
          <div className="space-y-1.5">
            <Label>Contact admissions (optionnel)</Label>
            <Input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="admissions@etablissement.ga · +241 …" />
          </div>
          <Button onClick={saveInstitution} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Enregistrer
          </Button>
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2"><GraduationCap className="h-5 w-5" /> Filières proposées</CardTitle>
          <CardDescription>Toutes les filières déjà enregistrées sont proposées automatiquement aux candidats.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {filieres.length === 0 && <p className="text-sm text-muted-foreground">Aucune filière enregistrée.</p>}
          {filieres.map((f) => (
            <div key={f.id} className="rounded-lg border border-border p-3 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-sm">{f.name}</p>
                  {f.description && <p className="text-xs text-muted-foreground">{f.description}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">Visible</Badge>
                </div>
              </div>
              <ProgramFeesEditor key={f.id} program={f}/>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Niveau d'entrée</Label>
                    <Input defaultValue={f.admission_level ?? ""} placeholder="L1, BTS 1…"
                      onBlur={(e) => e.target.value !== (f.admission_level ?? "") && updateFiliere(f.id, { admission_level: e.target.value || null })} />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-xs">Informations pour les candidats</Label>
                    <Textarea rows={2} defaultValue={f.admission_info ?? ""} placeholder="Séries acceptées, moyenne minimale, frais…"
                      onBlur={(e) => e.target.value !== (f.admission_info ?? "") && updateFiliere(f.id, { admission_info: e.target.value || null })} />
                  </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
      <AnbgVerification/>
    </div>
  );
}
