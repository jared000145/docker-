import type { AcademicScope } from "@/lib/permissions";

/** Map a class level (L1, M2, etc.) to a higher-education cycle. */
export const levelToCycle = (level?: string | null): "licence" | "master" | null => {
  if (!level) return null;
  const upper = String(level).trim().toUpperCase();
  if (/^L[1-3]$/.test(upper)) return "licence";
  if (/^M[1-2]$/.test(upper)) return "master";
  return null;
};

/** Returns true if a given level is allowed by the current academic scope. */
export const levelInScope = (level: string | null | undefined, scope: AcademicScope): boolean => {
  if (scope === "all") return true;
  const cycle = levelToCycle(level);
  if (!cycle) return true; // levels we don't recognise (high-school) stay visible
  return cycle === scope;
};

/** Filter helper for arrays of rows that expose a `level` field. */
export function applyScope<T extends { level?: string | null }>(rows: T[] | undefined, scope: AcademicScope): T[] {
  if (!rows) return [];
  if (scope === "all") return rows;
  return rows.filter((r) => levelInScope(r.level, scope));
}
