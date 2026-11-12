import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useInstitution } from "@/hooks/useInstitution";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Layers, Save, GraduationCap, School, University } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

const CYCLES = [
  { key: "college", label: "Collège", desc: "6e, 5e, 4e, 3e — trimestres, notes sur 20", icon: School },
  { key: "lycee", label: "Lycée", desc: "2nde, 1ère, Terminale (séries A/B/C/D/S) — trimestres", icon: GraduationCap },
  { key: "universite", label: "Université (LMD)", desc: "L1–M2, UE, crédits, semestres — cycle historique", icon: University },
];

export default function AdminCyclesPage() {
  const { institution } = useInstitution();
  const qc = useQueryClient();
  const [enabled, setEnabled] = useState<string[]>([]);
  const [thirdNote, setThirdNote] = useState(false);

  const { data } = useQuery({
    queryKey: ["institution-cycles", institution?.id],
    queryFn: async () => {
      const { data } = await (supabase as any).from("institutions").select("enabled_cycles, trimestre_third_note").eq("id", institution!.id).maybeSingle();
      return data;
    },
    enabled: !!institution?.id,
  });

  useEffect(() => {
    if (data) {
      setEnabled(data.enabled_cycles || ["universite"]);
      setThirdNote(!!data.trimestre_third_note);
    }
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      if (enabled.length === 0) throw new Error("Au moins un cycle doit rester activé");
      const { error } = await (supabase as any).from("institutions").update({
        enabled_cycles: enabled,
        trimestre_third_note: thirdNote,
      }).eq("id", institution!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cycles enregistrés");
      qc.invalidateQueries({ queryKey: ["institution-cycles"] });
      qc.invalidateQueries({ queryKey: ["user-institution"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggle = (key: string) => {
    setEnabled((prev) => prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Layers className="w-8 h-8 text-primary" />
          Cycles de l'établissement
        </h1>
        <p className="text-muted-foreground mt-1">
          Activez uniquement les cycles pris en charge par votre établissement. Le module Université reste indépendant.
        </p>
      </motion.div>

      <Card>
        <CardHeader>
          <CardTitle>Cycles disponibles</CardTitle>
          <CardDescription>Chaque cycle activé fait apparaître ses propres écrans (classes, notes, relevés).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {CYCLES.map((c) => {
            const Icon = c.icon;
            const active = enabled.includes(c.key);
            return (
              <label key={c.key} className={`flex items-start gap-4 p-4 border-2 rounded-lg cursor-pointer transition ${active ? "border-primary bg-primary/5" : "border-border hover:bg-muted/30"}`}>
                <Icon className={`w-6 h-6 mt-0.5 ${active ? "text-primary" : "text-muted-foreground"}`} />
                <div className="flex-1">
                  <div className="font-semibold">{c.label}</div>
                  <p className="text-sm text-muted-foreground mt-0.5">{c.desc}</p>
                </div>
                <Switch checked={active} onCheckedChange={() => toggle(c.key)} />
              </label>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notation trimestrielle (Collège & Lycée)</CardTitle>
          <CardDescription>Par défaut, 2 notes par trimestre. Activez pour ajouter une 3e note (composition, examen…).</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-4">
          <Label htmlFor="third">Activer la 3ème note trimestrielle</Label>
          <Switch id="third" checked={thirdNote} onCheckedChange={setThirdNote} />
        </CardContent>
      </Card>

      <Button onClick={() => save.mutate()} disabled={save.isPending}>
        <Save className="w-4 h-4 mr-2" />
        {save.isPending ? "Enregistrement…" : "Enregistrer"}
      </Button>
    </div>
  );
}
