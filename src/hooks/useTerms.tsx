import { useCycle } from "@/hooks/useCycle";

/**
 * Terminologie dynamique selon les cycles activés.
 * - Collège/Lycée uniquement → « élève »
 * - Sinon (universitaire ou mixte) → « étudiant »
 */
export const useTerms = () => {
  const { hasUniversite, hasCollege, hasLycee } = useCycle();
  const scolaireOnly = (hasCollege || hasLycee) && !hasUniversite;

  const t = scolaireOnly
    ? { student: "élève", students: "élèves", Student: "Élève", Students: "Élèves" }
    : { student: "étudiant", students: "étudiants", Student: "Étudiant", Students: "Étudiants" };

  return {
    ...t,
    isScolaireOnly: scolaireOnly,
    isUniversiteOnly: hasUniversite && !(hasCollege || hasLycee),
    isMixte: hasUniversite && (hasCollege || hasLycee),
  };
};
