import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { ShieldCheck, ShieldX, GraduationCap, Calendar, Award, BookOpen } from "lucide-react";
import { TRIMESTRE_LABEL, mentionForAverage } from "@/lib/collegeLycee";

export default function LyceeVerifyPage() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        if (!token) throw new Error("Token manquant");
        const { data, error } = await (supabase as any).rpc("verify_releve_lycee", { _token: token });
        if (error) throw error;
        if (!data || data.length === 0) throw new Error("Document non authentique ou introuvable.");
        setData(data[0]);
      } catch (e: any) {
        setError(e?.message || "Erreur de vérification");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Vérification…</div>;
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-destructive/10 to-background p-6">
        <div className="max-w-md w-full bg-card border border-destructive/40 rounded-2xl p-8 text-center shadow-xl">
          <ShieldX className="w-16 h-16 mx-auto text-destructive mb-4" />
          <h1 className="text-2xl font-bold text-destructive">Document non authentique</h1>
          <p className="text-muted-foreground mt-2">{error || "Ce relevé est introuvable ou a été révoqué."}</p>
        </div>
      </div>
    );
  }

  const fullName = `${(data.student_last_name || "").toUpperCase()} ${data.student_first_name || ""}`.trim();
  const mention = mentionForAverage(data.moyenne_trimestre);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-background py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-border/50 overflow-hidden"
        >
          <div className="bg-gradient-to-r from-primary to-primary/80 p-6 text-primary-foreground">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {data.institution_logo ? (
                  <img src={data.institution_logo} alt={`Logo ${data.institution_name}`} className="h-14 w-14 rounded-xl bg-white/20 p-1 object-contain" />
                ) : (
                  <GraduationCap className="h-14 w-14" />
                )}
                <div>
                  <h2 className="text-xl font-extrabold">{data.institution_name}</h2>
                  <p className="text-xs opacity-90">Relevé {data.classe_cycle === "college" ? "Collège" : "Lycée"}</p>
                </div>
              </div>
              <ShieldCheck className="h-10 w-10" />
            </div>
          </div>

          <div className="bg-success/10 border-y border-success/30 px-6 py-3 flex items-center justify-center gap-2">
            <ShieldCheck className="h-5 w-5 text-success" />
            <span className="text-sm font-bold text-success uppercase">Document authentique — Vérifié par RectorPlus</span>
          </div>

          <div className="flex justify-center -mb-12 mt-6">
            <div className="relative h-32 w-32 rounded-full border-4 border-primary bg-muted overflow-hidden shadow-2xl">
              {data.student_avatar ? (
                <img src={data.student_avatar} alt={`Photo de ${fullName}`} className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full flex items-center justify-center bg-primary/10 text-3xl font-bold text-primary">
                  {(data.student_first_name?.[0] || "") + (data.student_last_name?.[0] || "")}
                </div>
              )}
            </div>
          </div>

          <div className="pt-16 pb-6 px-6 text-center">
            <h1 className="text-2xl font-bold">{fullName}</h1>
            <p className="text-muted-foreground text-sm">
              Matricule : <span className="font-mono font-semibold">{data.student_number || "—"}</span>
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 px-6 pb-6">
            <Info icon={<Calendar className="h-4 w-4" />} label="Année" value={data.academic_year} />
            <Info icon={<Award className="h-4 w-4" />} label="Trimestre" value={TRIMESTRE_LABEL[data.trimestre]} />
            <Info icon={<BookOpen className="h-4 w-4" />} label="Classe" value={data.classe_nom} />
            <Info icon={<GraduationCap className="h-4 w-4" />} label="Niveau / Série" value={`${data.classe_niveau}${data.classe_serie ? ` — ${data.classe_serie}` : ""}`} />
          </div>

          <div className="bg-gradient-to-br from-primary/10 to-transparent border-t border-border/50 px-6 py-6">
            <div className="grid grid-cols-3 gap-3 text-center">
              <Stat label="Moy. trimestre" value={data.moyenne_trimestre != null ? `${Number(data.moyenne_trimestre).toFixed(2)}/20` : "—"} highlight />
              <Stat label="Moy. annuelle" value={data.moyenne_annuelle != null ? `${Number(data.moyenne_annuelle).toFixed(2)}/20` : "—"} />
              <Stat label="Rang" value={data.rang ? `${data.rang}${data.effectif ? ` / ${data.effectif}` : ""}` : "—"} />
            </div>
            <div className="grid grid-cols-2 gap-3 text-center mt-3">
              <Stat label="Mention" value={data.mention || mention} />
              <Stat label="Décision" value={data.decision || "—"} />
            </div>
            {data.appreciation && (
              <p className="mt-4 text-sm italic text-center text-muted-foreground">« {data.appreciation} »</p>
            )}
          </div>

          {Array.isArray(data.matieres) && data.matieres.length > 0 && (
            <div className="px-6 py-5 border-t border-border/50">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-3">
                Détail des matières
              </p>
              <div className="space-y-1.5">
                {data.matieres.map((m: any, i: number) => (
                  <div key={i} className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2 border border-border/40">
                    <span className="text-sm font-medium truncate">{m.matiere}</span>
                    <span className="text-[11px] text-muted-foreground shrink-0">Coef. {m.coefficient ?? 1}</span>
                    <span className="text-sm font-bold shrink-0">
                      {m.moyenne != null ? `${Number(m.moyenne).toFixed(2)}/20` : "—"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}


          <div className="px-6 py-4 bg-muted/30 border-t border-border/50 text-center text-xs text-muted-foreground">
            Document authentifié électroniquement par <span className="font-semibold">RectorPlus</span> — © {new Date().getFullYear()}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

const Info = ({ icon, label, value }: any) => (
  <div className="flex items-center gap-3 bg-muted/40 rounded-xl px-4 py-3 border border-border/50">
    <div className="bg-primary/10 text-primary rounded-lg p-2">{icon}</div>
    <div className="flex-1 min-w-0">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">{label}</p>
      <p className="text-sm font-bold truncate">{value}</p>
    </div>
  </div>
);

const Stat = ({ label, value, highlight }: any) => (
  <div className={`rounded-2xl p-4 ${highlight ? "bg-primary text-primary-foreground shadow-lg" : "bg-card border border-border/50"}`}>
    <p className={`text-[10px] uppercase tracking-wider font-semibold ${highlight ? "opacity-80" : "text-muted-foreground"}`}>{label}</p>
    <p className="text-lg font-extrabold mt-1">{value}</p>
  </div>
);
