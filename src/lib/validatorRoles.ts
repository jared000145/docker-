import type { SignatureRoleScope } from "@/lib/directorSignature";

export type ValidatorRoleKey = "pedagogique" | "cycle";

export interface ValidatorRoleConfig {
  key: ValidatorRoleKey;
  teamRole: "responsable_pedagogique" | "responsable_cycle";
  scope: SignatureRoleScope;
  routePrefix: string;
  label: string;
  shortLabel: string;
  /** Column suffix in `document_validations`: `${col}_status`, `${col}_signed_by`, ... */
  col: "pedagogique" | "cycle";
}

export const VALIDATOR_ROLES: Record<ValidatorRoleKey, ValidatorRoleConfig> = {
  pedagogique: {
    key: "pedagogique",
    teamRole: "responsable_pedagogique",
    scope: "responsable_pedagogique",
    routePrefix: "/pedagogique",
    label: "Responsable Pédagogique",
    shortLabel: "Pédagogique",
    col: "pedagogique",
  },
  cycle: {
    key: "cycle",
    teamRole: "responsable_cycle",
    scope: "responsable_cycle",
    routePrefix: "/cycle",
    label: "Responsable du Cycle",
    shortLabel: "Cycle",
    col: "cycle",
  },
};
