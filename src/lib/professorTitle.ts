// Détermine le titre académique automatique d'un professeur en fonction de son
// diplôme le plus élevé. Les diplômes proviennent du tableau professor_documents
// (lignes dont doc_type === 'diplome' ou diploma_level défini).

export type DiplomaLevel =
  | "doctorat"
  | "ingenieur"
  | "master"
  | "licence"
  | "autre";

export const DIPLOMA_LEVELS: { value: DiplomaLevel; label: string }[] = [
  { value: "doctorat", label: "Doctorat (PhD)" },
  { value: "ingenieur", label: "Master / Ingénieur" },
  { value: "master", label: "Master" },
  { value: "licence", label: "Licence" },
  { value: "autre", label: "Autre" },
];

const RANK: Record<DiplomaLevel, number> = {
  doctorat: 4,
  ingenieur: 3,
  master: 2,
  licence: 1,
  autre: 0,
};

export const TITLE_FOR: Record<DiplomaLevel, string> = {
  doctorat: "Dr.",
  ingenieur: "Ing.",
  master: "M.",
  licence: "Lic.",
  autre: "",
};

/** Renvoie le diplôme de plus haut niveau d'une liste de documents. */
export function getHighestDiplomaLevel(
  documents: Array<{ doc_type?: string | null; diploma_level?: string | null }> | undefined | null
): DiplomaLevel | null {
  if (!documents || documents.length === 0) return null;
  let best: DiplomaLevel | null = null;
  for (const d of documents) {
    const lvl = (d.diploma_level || "").toLowerCase() as DiplomaLevel;
    if (!lvl || !(lvl in RANK)) continue;
    if (!best || RANK[lvl] > RANK[best]) best = lvl;
  }
  return best;
}

/** Renvoie le préfixe à afficher devant le nom (ex: "Dr."). Vide si inconnu. */
export function getProfessorTitle(
  documents: Array<{ doc_type?: string | null; diploma_level?: string | null }> | undefined | null,
  fallback?: string | null
): string {
  const lvl = getHighestDiplomaLevel(documents);
  if (lvl) return TITLE_FOR[lvl] || "";
  // fallback : si academic_title texte libre (ex: "Docteur"), on tente une déduction
  if (fallback) {
    const f = fallback.toLowerCase();
    if (f.includes("doct")) return "Dr.";
    if (f.includes("ing")) return "Ing.";
    if (f.includes("mast")) return "M.";
    if (f.includes("lic")) return "Lic.";
  }
  return "";
}

export function formatProfessorName(
  firstName?: string | null,
  lastName?: string | null,
  title?: string
): string {
  const name = [firstName, lastName].filter(Boolean).join(" ");
  return title ? `${title} ${name}` : name;
}
