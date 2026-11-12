// Référentiels Collège / Lycée africain
export const COLLEGE_NIVEAUX = ["6e", "5e", "4e", "3e"] as const;

export const LYCEE_NIVEAUX = ["2nde", "1ère", "Terminale"] as const;

// Séries autorisées par niveau lycée
export const LYCEE_SERIES: Record<string, string[]> = {
  "2nde": ["L", "S"],
  "1ère": ["A1", "A2", "B", "S"],
  "Terminale": ["A1", "A2", "B", "C", "D"],
};

export const TRIMESTRES = ["T1", "T2", "T3"] as const;
export type Trimestre = typeof TRIMESTRES[number];

export const TRIMESTRE_LABEL: Record<string, string> = {
  T1: "1er Trimestre",
  T2: "2ème Trimestre",
  T3: "3ème Trimestre",
};

export const mentionForAverage = (avg: number | null | undefined): string => {
  if (avg == null || isNaN(Number(avg))) return "—";
  const v = Number(avg);
  if (v >= 16) return "Très Bien";
  if (v >= 14) return "Bien";
  if (v >= 12) return "Assez Bien";
  if (v >= 10) return "Passable";
  return "Insuffisant";
};

// Appréciation automatique par note/moyenne (barème africain)
export const autoAppreciation = (avg: number | null | undefined): string => {
  if (avg == null || isNaN(Number(avg))) return "—";
  const v = Number(avg);
  if (v >= 18) return "Excellent";
  if (v >= 16) return "Très Bien";
  if (v >= 14) return "Bien";
  if (v >= 11) return "Assez Bien";
  if (v >= 8) return "Passable";
  if (v >= 5) return "Insuffisant";
  return "Médiocre";
};

// Décision globale du conseil de classe selon la moyenne
export const decisionForAverage = (avg: number | null | undefined): { mention: string; decision: string } => {
  if (avg == null || isNaN(Number(avg))) return { mention: "—", decision: "—" };
  const v = Number(avg);
  if (v >= 16) return { mention: "Félicitations", decision: "Admis" };
  if (v >= 14) return { mention: "Encouragements", decision: "Admis" };
  if (v >= 12) return { mention: "Tableau d'Honneur", decision: "Admis" };
  if (v >= 10) return { mention: "Passable", decision: "Admis" };
  if (v >= 8) return { mention: "Avertissement", decision: "Redouble" };
  return { mention: "Blâme", decision: "Redouble" };
};

// Conversion note vers 20 quel que soit le barème (10 ou 20)
export const toBase20 = (note: number | null | undefined, bareme: number): number | null => {
  if (note == null || isNaN(Number(note))) return null;
  const b = bareme === 10 ? 10 : 20;
  return (Number(note) * 20) / b;
};

// Moyenne d'une matière : moyenne simple des notes disponibles (converties sur 20)
export const matiereAverage = (
  n1: number | null, b1: number,
  n2: number | null, b2: number,
  n3: number | null, b3: number,
): number | null => {
  const vals = [toBase20(n1, b1), toBase20(n2, b2), toBase20(n3, b3)].filter((v): v is number => v != null);
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
};

// Moyenne trimestrielle : pondérée par coefficient de matière
export const trimestreAverage = (
  lignes: { moyenne: number | null; coefficient: number }[],
): number | null => {
  const rows = lignes.filter((l) => l.moyenne != null);
  if (rows.length === 0) return null;
  const totalCoef = rows.reduce((s, l) => s + Number(l.coefficient || 1), 0);
  if (totalCoef === 0) return null;
  return rows.reduce((s, l) => s + Number(l.moyenne) * Number(l.coefficient || 1), 0) / totalCoef;
};

export const niveauxForCycle = (cycle: "college" | "lycee"): readonly string[] =>
  cycle === "college" ? COLLEGE_NIVEAUX : LYCEE_NIVEAUX;
