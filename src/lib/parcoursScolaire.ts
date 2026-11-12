export type ParcoursTrimestre = {
  trimestre: string | null;
  moyenne: number | null;
  rang: number | null;
  appreciation: string | null;
  pdf_url: string | null;
  qr_token: string | null;
};

export type ParcoursAnnee = {
  academic_year: string | null;
  classe: string | null;
  niveau: string | null;
  cycle: string | null;
  serie: string | null;
  trimestres: ParcoursTrimestre[];
  moyenne_annuelle: number | null;
};

export type ParcoursMatiere = {
  matiere: string;
  coefficient: number | null;
  moyenne: number | null;
  nb_notes: number;
};

export type ParcoursBac = {
  academic_year?: string | null;
  serie?: string | null;
  mention?: string | null;
  moyenne?: number | null;
  subject_scores?: { subject?: string; score?: number }[] | null;
  file_url?: string | null;
  file_name?: string | null;
  status?: string | null;
} | null;

export type ParcoursDocument = {
  id: string;
  doc_type: string | null;
  title: string | null;
  file_url: string | null;
  academic_year: string | null;
  mime_type: string | null;
  created_at: string;
};

export type Parcours = {
  profile: Record<string, any> | null;
  annees: ParcoursAnnee[];
  matieres: ParcoursMatiere[];
  bac: ParcoursBac;
  documents: ParcoursDocument[];
  generated_at: string;
};

export const LEVEL_ORDER = ["6e", "5e", "4e", "3e", "2nde", "1ère", "Terminale"];

export function levelRank(niveau?: string | null) {
  if (!niveau) return 99;
  const i = LEVEL_ORDER.findIndex((l) => l.toLowerCase() === niveau.trim().toLowerCase());
  return i === -1 ? 98 : i;
}

export function sortedAnnees(annees: ParcoursAnnee[] = []) {
  return [...annees].sort((a, b) => {
    const r = levelRank(a.niveau) - levelRank(b.niveau);
    if (r !== 0) return r;
    return String(a.academic_year ?? "").localeCompare(String(b.academic_year ?? ""));
  });
}

export function moyenneGenerale(annees: ParcoursAnnee[] = []) {
  const vals = annees.map((a) => Number(a.moyenne_annuelle)).filter((v) => Number.isFinite(v));
  if (!vals.length) return null;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100;
}

/** Tendance : comparaison de la première et de la dernière année renseignée */
export function tendance(annees: ParcoursAnnee[] = []) {
  const ordered = sortedAnnees(annees).filter((a) => Number.isFinite(Number(a.moyenne_annuelle)));
  if (ordered.length < 2) return { delta: 0, label: "Stable" as const };
  const delta =
    Number(ordered[ordered.length - 1].moyenne_annuelle) - Number(ordered[0].moyenne_annuelle);
  const label = delta > 0.5 ? ("En progression" as const) : delta < -0.5 ? ("En baisse" as const) : ("Stable" as const);
  return { delta: Math.round(delta * 100) / 100, label };
}

export function topMatieres(matieres: ParcoursMatiere[] = [], count = 5) {
  return [...matieres]
    .filter((m) => Number.isFinite(Number(m.moyenne)))
    .sort((a, b) => Number(b.moyenne) - Number(a.moyenne))
    .slice(0, count);
}

export function matieresFragiles(matieres: ParcoursMatiere[] = [], count = 5) {
  return [...matieres]
    .filter((m) => Number.isFinite(Number(m.moyenne)))
    .sort((a, b) => Number(a.moyenne) - Number(b.moyenne))
    .slice(0, count);
}

export function fmtNote(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? `${n.toFixed(2)}/20` : "—";
}
