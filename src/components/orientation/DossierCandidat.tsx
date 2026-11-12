import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  GraduationCap, FileText, TrendingUp, TrendingDown, Minus, User,
  Award, BookOpen, AlertTriangle,
} from "lucide-react";
import {
  Parcours, fmtNote, matieresFragiles, moyenneGenerale, sortedAnnees, tendance, topMatieres,
} from "@/lib/parcoursScolaire";

export function useDossier(applicationId?: string, enabled = true) {
  return useQuery({
    queryKey: ["dossier-candidat", applicationId ?? "me"],
    enabled,
    refetchOnWindowFocus: false,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("application-dossier", {
        body: applicationId ? { application_id: applicationId } : {},
      });
      if (error) throw new Error((data as any)?.error || error.message);
      return data as { live: Parcours; snapshot: any; application: any };
    },
  });
}

function TrendIcon({ label }: { label: string }) {
  if (label === "En progression") return <TrendingUp className="h-4 w-4 text-emerald-500" />;
  if (label === "En baisse") return <TrendingDown className="h-4 w-4 text-destructive" />;
  return <Minus className="h-4 w-4 text-muted-foreground" />;
}

export function DossierCandidat({
  applicationId,
  compact = false,
}: {
  applicationId?: string;
  compact?: boolean;
}) {
  const { data, isLoading, error } = useDossier(applicationId);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/40">
        <CardContent className="p-4 flex items-center gap-2 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4" /> {(error as any).message}
        </CardContent>
      </Card>
    );
  }

  const live = data?.live as Parcours | undefined;
  if (!live) return null;

  const annees = sortedAnnees(live.annees || []);
  const moy = moyenneGenerale(live.annees || []);
  const tend = tendance(live.annees || []);
  const forts = topMatieres(live.matieres || []);
  const faibles = matieresFragiles(live.matieres || []);
  const p = live.profile || {};

  return (
    <div className="space-y-4">
      {/* Identité */}
      <Card className="glass-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4 text-primary" /> Identité du candidat
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
          <Info label="Nom" value={`${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || "—"} />
          <Info label="Matricule" value={p.student_number} />
          <Info label="Établissement d'origine" value={p.institution} />
          <Info label="Date de naissance" value={p.date_of_birth} />
          <Info label="Lieu de naissance" value={p.birth_place} />
          <Info label="Nationalité" value={p.nationality} />
          <Info label="Série" value={p.serie} />
          <Info label="Téléphone" value={p.phone} />
          <Info label="Email" value={p.email} />
        </CardContent>
      </Card>

      {/* Synthèse */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard icon={<Award className="h-4 w-4 text-primary" />} label="Moyenne du parcours" value={fmtNote(moy)} />
        <StatCard icon={<TrendIcon label={tend.label} />} label="Évolution" value={`${tend.label} (${tend.delta > 0 ? "+" : ""}${tend.delta})`} />
        <StatCard icon={<GraduationCap className="h-4 w-4 text-primary" />} label="Années enregistrées" value={String(annees.length)} />
      </div>

      {/* Parcours année par année */}
      <Card className="glass-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-primary" /> Parcours scolaire
          </CardTitle>
          <CardDescription>De la 6e à la Terminale, d'après les relevés enregistrés.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {annees.length === 0 && (
            <p className="text-sm text-muted-foreground">Aucun relevé enregistré pour le moment.</p>
          )}
          {annees.map((a, i) => (
            <div key={i} className="rounded-lg border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{a.niveau ?? a.classe ?? "Classe"}</Badge>
                  <span className="text-sm font-medium">{a.classe ?? ""}</span>
                  <span className="text-xs text-muted-foreground">{a.academic_year}</span>
                </div>
                <span className="text-sm font-semibold">{fmtNote(a.moyenne_annuelle)}</span>
              </div>
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
                {(a.trimestres || []).map((t, j) => (
                  <div key={j} className="rounded-md bg-muted/40 p-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{t.trimestre ?? "Trimestre"}</span>
                      <span>{fmtNote(t.moyenne)}</span>
                    </div>
                    {t.rang != null && <p className="text-muted-foreground mt-0.5">Rang {t.rang}</p>}
                    {t.pdf_url && (
                      <Button variant="link" size="sm" className="h-auto p-0 text-xs" asChild>
                        <a href={t.pdf_url} target="_blank" rel="noopener noreferrer">Voir le bulletin</a>
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Matières */}
      {!compact && (live.matieres || []).length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-emerald-500" /> Points forts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {forts.map((m) => (
                <div key={m.matiere} className="flex items-center justify-between text-sm">
                  <span>{m.matiere}</span>
                  <Badge variant="secondary">{fmtNote(m.moyenne)}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-amber-500" /> Matières à renforcer
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {faibles.map((m) => (
                <div key={m.matiere} className="flex items-center justify-between text-sm">
                  <span>{m.matiere}</span>
                  <Badge variant="outline">{fmtNote(m.moyenne)}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* BAC + documents */}
      <Card className="glass-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" /> BAC et pièces du dossier
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {live.bac ? (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3">
              <FileText className="h-6 w-6 text-primary" />
              <div className="flex-1 min-w-[180px]">
                <p className="font-medium">
                  BAC {live.bac.serie ?? "?"} · {live.bac.mention ?? "—"} · {fmtNote(live.bac.moyenne)}
                </p>
                <p className="text-xs text-muted-foreground">{live.bac.academic_year ?? ""}</p>
              </div>
              {live.bac.file_url && (
                <Button variant="outline" size="sm" asChild>
                  <a href={live.bac.file_url} target="_blank" rel="noopener noreferrer">Ouvrir</a>
                </Button>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground">Relevé du BAC non encore déposé.</p>
          )}

          {(live.documents || []).map((d) => (
            <div key={d.id} className="flex items-center gap-3 rounded-lg border border-border p-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p className="truncate">{d.title ?? d.doc_type ?? "Document"}</p>
                <p className="text-xs text-muted-foreground">{d.academic_year ?? ""}</p>
              </div>
              {d.file_url && (
                <Button variant="ghost" size="sm" asChild>
                  <a href={d.file_url} target="_blank" rel="noopener noreferrer">Ouvrir</a>
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function Info({ label, value }: { label: string; value?: any }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium break-words">{value ? String(value) : "—"}</p>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card className="glass-card">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon} {label}</div>
        <p className="text-xl font-bold mt-1">{value}</p>
      </CardContent>
    </Card>
  );
}
