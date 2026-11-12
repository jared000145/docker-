/**
 * Module catalog used across the admin permission system.
 * Each module key controls visibility in the sidebar AND access to one or more
 * admin routes. Keep keys short, lowercase, snake-free.
 */
export const ADMIN_MODULES = [
  { key: "etudiants",              label: "Étudiants" },
  { key: "profs",                  label: "Professeurs" },
  { key: "notes",                  label: "Notes" },
  { key: "rattrapage",             label: "Rattrapages" },
  { key: "presences",              label: "Présences" },
  { key: "paiements",              label: "Paiements" },
  { key: "documents",              label: "Bibliothèque & documents" },
  { key: "parametres_academiques", label: "Paramètres académiques" },
  { key: "communaute",             label: "Communauté & événements" },
  { key: "releves",                label: "Relevés / clôture" },
  { key: "cloture",                label: "Clôture de l'exercice" },
  { key: "bulletins",              label: "Bulletins" },
  { key: "planning",               label: "Planning / emploi du temps" },
  { key: "salles",                 label: "Salles de classe" },
  { key: "soutenances",            label: "Soutenances" },
  { key: "parents",                label: "Parents" },
  { key: "equipe",                 label: "Gestion d'équipe" },
  { key: "audit",                  label: "Audit & traçabilité" },
  { key: "exclusions",             label: "Exclusions & abandons" },
  // Director-only scopes (hidden from the admin team picker UI but valid)
  { key: "director_dashboard",     label: "Tableau de bord Direction" },
  { key: "director_documents",     label: "Documents à valider" },
  { key: "director_reports",       label: "Rapports académiques" },
  { key: "director_finance",       label: "Résumé financier (Direction)" },
  { key: "director_signature",     label: "Signature & cachet" },
] as const;

export type ModuleKey = typeof ADMIN_MODULES[number]["key"];

/** Maps an admin URL path to the module(s) that grant access to it. */
export const ROUTE_MODULE_MAP: Record<string, ModuleKey> = {
  "cycles": "parametres_academiques",
  "classes": "parametres_academiques",
  "groups": "parametres_academiques",
  "grades-trimestre": "notes",
  "closure-trimestre": "cloture",
  "applications": "etudiants",
  "admissions": "parametres_academiques",
  "students":           "etudiants",
  "professors":         "profs",
  "grades":             "notes",
  "pv":                 "notes",
  "rattrapages":        "rattrapage",
  "attendance":         "presences",
  "payments":           "paiements",
  "finance":            "paiements",
  "finances":           "paiements",
  "library":            "documents",
  "academic-settings":  "parametres_academiques",
  "filieres":           "parametres_academiques",
  "subjects":           "parametres_academiques",
  "ues":                "parametres_academiques",
  "settings":           "parametres_academiques",
  "events":             "communaute",
  "bde":                "communaute",
  "notifications":      "communaute",
  "schedule":           "planning",
  "classrooms":         "salles",
  "soutenances":        "soutenances",
  "student-years":      "releves",
  "access-control":     "etudiants",
  "parents":            "parents",
  "closure":            "cloture",
  "end-of-year":        "cloture",
  "team":               "equipe",
  "permissions":        "equipe",
  "audit":              "audit",
  "exclusions":         "exclusions",
};

/** Available pre-defined team roles. */
export const TEAM_ROLES = [
  { value: "admin_principal",          label: "Administrateur Principal" },
  { value: "directeur",                label: "Directeur" },
  { value: "responsable_pedagogique",  label: "Responsable Pédagogique" },
  { value: "responsable_cycle",        label: "Responsable du Cycle" },
  { value: "responsable_notes",        label: "Responsable des Notes" },
  { value: "responsable_presences",    label: "Responsable des Présences" },
  { value: "responsable_financier",    label: "Responsable Financier" },
  { value: "responsable_scolarite",    label: "Responsable Scolarité" },
  { value: "secretaire",               label: "Secrétaire" },
  { value: "assistant_pedagogique",    label: "Assistant Pédagogique" },
  { value: "responsable_vie_etudiante", label: "Responsable Vie Étudiante" },
  { value: "professeur",               label: "Professeur" },
  { value: "role_personnalise",        label: "Rôle personnalisé" },
] as const;

export type TeamRoleValue = typeof TEAM_ROLES[number]["value"];

export type AcademicScope = "licence" | "master" | "all";

export const ACADEMIC_SCOPES: { value: AcademicScope; label: string }[] = [
  { value: "all",     label: "Licence et Master" },
  { value: "licence", label: "Licence uniquement" },
  { value: "master",  label: "Master uniquement" },
];

/** Director modules used to scope its dedicated sidebar/router. */
export const DIRECTOR_MODULES: ModuleKey[] = [
  "director_dashboard",
  "director_documents",
  "director_reports",
  "director_finance",
  "director_signature",
];

/** Default modules attached to a given team role. */
export const ROLE_DEFAULT_MODULES: Record<TeamRoleValue, ModuleKey[]> = {
  admin_principal: ADMIN_MODULES.map((m) => m.key),
  directeur: DIRECTOR_MODULES,
  responsable_pedagogique: DIRECTOR_MODULES,
  responsable_cycle: DIRECTOR_MODULES,
  responsable_notes: ["notes", "rattrapage"],
  responsable_presences: ["presences"],
  responsable_financier: ["paiements"],
  responsable_scolarite: ["etudiants", "parents", "releves"],
  secretaire: ["etudiants", "documents"],
  assistant_pedagogique: ["notes", "presences"],
  responsable_vie_etudiante: ["communaute"],
  professeur: ["notes", "presences"],
  role_personnalise: [],
};

/* ------------------------------------------------------------------ */
/* Adaptation Collège / Lycée                                          */
/* ------------------------------------------------------------------ */

/** Libellés des rôles adaptés au vocabulaire scolaire (Collège / Lycée). */
export const SCHOOL_ROLE_LABELS: Partial<Record<TeamRoleValue, string>> = {
  directeur: "Directeur / Proviseur",
  responsable_pedagogique: "Censeur (Responsable pédagogique)",
  responsable_cycle: "Préfet des études (Responsable de cycle)",
  responsable_notes: "Responsable des notes",
  responsable_presences: "Surveillant général",
  responsable_financier: "Économe / Intendant",
  responsable_scolarite: "Responsable de la scolarité",
  secretaire: "Secrétaire",
  assistant_pedagogique: "Surveillant",
  responsable_vie_etudiante: "Responsable vie scolaire",
  professeur: "Enseignant",
};

/** Modules réservés à l'université, masqués en Collège / Lycée. */
export const UNIVERSITY_ONLY_MODULES: ModuleKey[] = ["soutenances", "rattrapage"];

/** Portées académiques proposées en Collège / Lycée. */
export const SCHOOL_ACADEMIC_SCOPES: { value: string; label: string }[] = [
  { value: "all",     label: "Collège et Lycée" },
  { value: "college", label: "Collège uniquement" },
  { value: "lycee",   label: "Lycée uniquement" },
];
