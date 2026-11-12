import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { ShieldCheck, GraduationCap, Calendar, Award, BookOpen, Loader2, XCircle } from "lucide-react";

interface VerifyRow {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  student_number: string | null;
  date_of_birth: string | null;
  avatar_url: string | null;
  academic_year: string;
  level: string;
  semester: string | null;
  filiere_name: string | null;
  institution_name: string | null;
  institution_logo: string | null;
  institution_slogan: string | null;
  institution_primary_color: string | null;
  semester_average: number | null;
  annual_average: number | null;
  sem1_label: string | null;
  sem1_average: number | null;
  sem2_label: string | null;
  sem2_average: number | null;
  credits_acquired: number | null;
  credits_total: number | null;
  decision: string | null;
}

const BulletinVerifyPage = () => {
  const { token } = useParams();
  const [data, setData] = useState<VerifyRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        if (!token) throw new Error("Token invalide");
        const { data: rows, error: err } = await (supabase as any).rpc("verify_bulletin", { _token: token });
        if (err) throw err;
        const row = Array.isArray(rows) ? rows[0] : rows;
        if (!row) throw new Error("Document introuvable ou lien invalide");
        setData(row as VerifyRow);
      } catch (e: any) {
        setError(e?.message || "Erreur de vérification");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md text-center space-y-3">
          <XCircle className="w-16 h-16 text-destructive mx-auto" />
          <h1 className="text-2xl font-bold">Document non authentique</h1>
          <p className="text-muted-foreground">{error || "Impossible de vérifier ce relevé."}</p>
        </div>
      </div>
    );
  }

  const fullName = `${(data.last_name || "").toUpperCase()} ${data.first_name || ""}`.trim();
  const dob = data.date_of_birth ? new Date(data.date_of_birth).toLocaleDateString("fr-FR") : "—";
  const semLabel = data.semester ? `Semestre ${data.semester.replace(/[Ss]/, "")}` : "Année complète";
  const moyenne = (data.semester ? data.semester_average : null) ?? data.annual_average;
  const creditsTotal = data.credits_total && Number(data.credits_total) > 0 ? Number(data.credits_total) : 60;
  const creditsAcquis = Number(data.credits_acquired ?? 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-background py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-card/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-border/50 overflow-hidden"
        >
          <div className="bg-gradient-to-r from-primary to-primary/80 p-6 text-primary-foreground">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {data.institution_logo ? (
                  <img src={data.institution_logo} alt={data.institution_name || ""} className="h-14 w-14 rounded-xl bg-white/20 p-1 object-contain" />
                ) : (
                  <GraduationCap className="h-14 w-14" />
                )}
                <div>
                  <h2 className="text-xl font-extrabold tracking-tight">{data.institution_name || "Établissement"}</h2>
                  {data.institution_slogan && <p className="text-xs opacity-90 italic">{data.institution_slogan}</p>}
                </div>
              </div>
              <motion.div
                initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.4, type: "spring" }}
                className="bg-white/20 backdrop-blur-md rounded-full p-2"
              >
                <ShieldCheck className="h-7 w-7" />
              </motion.div>
            </div>
          </div>

          <div className="bg-success/10 border-y border-success/30 px-6 py-3 flex items-center justify-center gap-2">
            <ShieldCheck className="h-5 w-5 text-success" />
            <span className="text-sm font-bold text-success tracking-wide uppercase">
              Relevé authentique — Vérifié par Rectorplus
            </span>
          </div>

          <div className="flex justify-center -mb-12 mt-6">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2, type: "spring" }} className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-primary to-primary/60 rounded-full blur-lg opacity-50" />
              <div className="relative h-32 w-32 rounded-full border-4 border-primary bg-muted overflow-hidden shadow-2xl">
                {data.avatar_url ? (
                  <img src={data.avatar_url} alt={fullName} className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5 text-3xl font-bold text-primary">
                    {(data.first_name?.[0] || "") + (data.last_name?.[0] || "")}
                  </div>
                )}
              </div>
            </motion.div>
          </div>

          <div className="pt-16 pb-6 px-6 text-center">
            <h1 className="text-2xl font-bold">{fullName || "—"}</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Né(e) le {dob} • Matricule : <span className="font-mono font-semibold">{data.student_number || "—"}</span>
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 px-6 pb-6">
            <InfoRow icon={<Calendar className="h-4 w-4" />} label="Année" value={data.academic_year} />
            <InfoRow icon={<GraduationCap className="h-4 w-4" />} label="Niveau" value={data.level} />
            <InfoRow icon={<BookOpen className="h-4 w-4" />} label="Filière" value={data.filiere_name || "—"} />
            <InfoRow icon={<Award className="h-4 w-4" />} label="Période" value={semLabel} />
          </div>

          {(data.sem1_average != null || data.sem2_average != null) && (
            <div className="px-6 pb-4">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Résumé de l'année</p>
              <div className="grid grid-cols-2 gap-3">
                <Stat
                  label={`Moyenne ${data.sem1_label || "S1"}`}
                  value={data.sem1_average != null ? `${Number(data.sem1_average).toFixed(2)}/20` : "—"}
                />
                <Stat
                  label={`Moyenne ${data.sem2_label || "S2"}`}
                  value={data.sem2_average != null ? `${Number(data.sem2_average).toFixed(2)}/20` : "—"}
                />
              </div>
            </div>
          )}

          <div className="bg-gradient-to-br from-primary/10 to-transparent border-t border-border/50 px-6 py-6">
            <div className="grid grid-cols-3 gap-3 text-center">
              <Stat
                label={data.semester ? "Moyenne semestre" : "Moyenne annuelle"}
                value={moyenne != null ? `${Number(moyenne).toFixed(2)}/20` : "—"}
                highlight
              />
              <Stat label="Crédits obtenus" value={`${creditsAcquis}/${creditsTotal}`} />
              <Stat label="Décision" value={mapDecision(data.decision) || "—"} />
            </div>
            {data.annual_average != null && data.semester && (
              <p className="text-center text-xs text-muted-foreground mt-3">
                Moyenne annuelle globale : <span className="font-bold text-foreground">{Number(data.annual_average).toFixed(2)}/20</span>
              </p>
            )}
          </div>

          <div className="px-6 py-4 bg-muted/30 border-t border-border/50 text-center">
            <p className="text-xs text-muted-foreground">
              Document authentifié électroniquement par <span className="font-semibold">Rectorplus</span>
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">© {new Date().getFullYear()} {data.institution_name}</p>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

const InfoRow = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div className="flex items-center gap-3 bg-muted/40 rounded-xl px-4 py-3 border border-border/50">
    <div className="bg-primary/10 text-primary rounded-lg p-2">{icon}</div>
    <div className="flex-1 min-w-0">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">{label}</p>
      <p className="text-sm font-bold truncate">{value}</p>
    </div>
  </div>
);

const Stat = ({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) => (
  <div className={`rounded-2xl p-4 ${highlight ? "bg-primary text-primary-foreground shadow-lg" : "bg-card border border-border/50"}`}>
    <p className={`text-[10px] uppercase tracking-wider font-semibold ${highlight ? "opacity-80" : "text-muted-foreground"}`}>{label}</p>
    <p className="text-lg font-extrabold mt-1">{value}</p>
  </div>
);

const mapDecision = (d?: string | null) => {
  if (!d) return null;
  switch (d) {
    case "admis": return "Admis";
    case "admis_conditionnel": return "Admis cond.";
    case "redoublant": return "Redoublant";
    case "exclu": return "Exclu";
    default: return d;
  }
};

export default BulletinVerifyPage;
