// Shared grade calculation utilities so Notes, Dashboard and Card show the same numbers.

export type CalcMode =
  | "MOYENNE_UE_PONDEREE"
  | "MOYENNE_UE_SIMPLE"
  | "MOYENNE_MATIERES_PONDEREE"
  | "MOYENNE_MATIERES_SIMPLE";

export interface GradeRow {
  subject_id: string;
  average: number | null;
  subjects?: { credits?: number | null; coefficient?: number | null } | null;
}
export interface RattRow {
  subject_id: string;
  rattrapage_grade: number | null;
  status: string | null;
}
export interface UeLinkRow {
  ue_id: string;
  subject_id: string;
  ues?: { credits?: number | null } | null;
}

export function getFinalAvg(g: GradeRow, ratt?: RattRow | null): number | null {
  if (g.average == null && !ratt) return null;
  const base = g.average == null ? 0 : Number(g.average);
  if (ratt && ratt.status === "passed" && ratt.rattrapage_grade != null) {
    return Math.max(base, Number(ratt.rattrapage_grade));
  }
  return g.average == null ? null : base;
}

export function computeUeAverages(grades: GradeRow[], rattrapages: RattRow[], ueLinks: UeLinkRow[]) {
  const rattMap = new Map(rattrapages.map((r) => [r.subject_id, r]));
  const map: Record<string, { ue: any; weighted: number; coef: number; count: number }> = {};
  ueLinks.forEach((l) => {
    const g = grades.find((x) => x.subject_id === l.subject_id);
    if (!g) return;
    const fa = getFinalAvg(g, rattMap.get(g.subject_id));
    if (fa == null) return;
    const coef = Number(g.subjects?.coefficient ?? 1) || 1;
    if (!map[l.ue_id]) map[l.ue_id] = { ue: l.ues, weighted: 0, coef: 0, count: 0 };
    map[l.ue_id].weighted += fa * coef;
    map[l.ue_id].coef += coef;
    map[l.ue_id].count += 1;
  });
  return Object.values(map).map((u) => ({ ue: u.ue, moyenne: u.coef > 0 ? u.weighted / u.coef : 0, count: u.count }));
}

export function computeOverallAverage(
  grades: GradeRow[],
  rattrapages: RattRow[],
  ueLinks: UeLinkRow[],
  mode: CalcMode = "MOYENNE_UE_PONDEREE"
): number | null {
  const rattMap = new Map(rattrapages.map((r) => [r.subject_id, r]));
  const finalGrades = grades.map((g) => ({ g, fa: getFinalAvg(g, rattMap.get(g.subject_id)) })).filter((x) => x.fa != null) as { g: GradeRow; fa: number }[];
  if (!finalGrades.length) return null;
  const ueAvgs = computeUeAverages(grades, rattrapages, ueLinks);

  if (mode === "MOYENNE_UE_PONDEREE") {
    const valid = ueAvgs.filter((u) => u.ue?.credits);
    const totalC = valid.reduce((s, u) => s + Number(u.ue.credits || 0), 0);
    if (totalC > 0) return valid.reduce((s, u) => s + u.moyenne * Number(u.ue.credits || 0), 0) / totalC;
  }
  if (mode === "MOYENNE_UE_SIMPLE" && ueAvgs.length > 0) {
    return ueAvgs.reduce((s, u) => s + u.moyenne, 0) / ueAvgs.length;
  }
  if (mode === "MOYENNE_MATIERES_PONDEREE") {
    const totalCoef = finalGrades.reduce((s, x) => s + (Number(x.g.subjects?.coefficient) || 1), 0);
    if (totalCoef > 0) return finalGrades.reduce((s, x) => s + x.fa * (Number(x.g.subjects?.coefficient) || 1), 0) / totalCoef;
  }
  // fallback simple
  return finalGrades.reduce((s, x) => s + x.fa, 0) / finalGrades.length;
}

export function computeCreditsValidated(grades: GradeRow[], rattrapages: RattRow[]): { acquired: number; total: number } {
  const rattMap = new Map(rattrapages.map((r) => [r.subject_id, r]));
  let acquired = 0;
  let total = 0;
  grades.forEach((g) => {
    const credits = Number(g.subjects?.credits) || 0;
    total += credits;
    const fa = getFinalAvg(g, rattMap.get(g.subject_id));
    if (fa != null && fa >= 10) acquired += credits;
  });
  return { acquired, total };
}
