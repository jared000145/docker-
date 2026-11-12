import {institutionCycles} from '@/lib/academicCycles';
import { useInstitution } from "@/hooks/useInstitution";

/**
 * Cycles activés pour l'établissement.
 * - "universite": LMD (UE, crédits, semestres) — intact
 * - "college": trimestres, matières simples
 * - "lycee": trimestres, matières + série
 */
export const useCycle = () => {
  const { institution, isLoading } = useInstitution();
  const legacy: "lmd" | "bts" = (institution?.cycle === "bts" ? "bts" : "lmd");

  const enabled = institutionCycles(institution);

  return {
    // legacy (universitaire, ne rien casser)
    cycle: legacy,
    isLMD: legacy === "lmd",
    isBTS: legacy === "bts",
    // nouveaux drapeaux collège/lycée
    enabledCycles: enabled,
    hasUniversite: enabled.includes("universite"),
    hasCollege: enabled.includes("college"),
    hasLycee: enabled.includes("lycee"),
    thirdNoteEnabled: !!institution?.trimestre_third_note,
    isMultiCampus: !!institution?.is_multi_campus,
    isLoading,
  };
};
