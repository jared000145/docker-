import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { ADMIN_MODULES, ModuleKey, type AcademicScope } from "@/lib/permissions";
const MODULE_TO_PERM: Record<string, string[]> = {
  etudiants: ["manage_etudiants"],
  profs: ["manage_profs"],
  notes: ["manage_notes"],
  rattrapage: ["manage_rattrapages"],
  presences: ["manage_presences"],
  paiements: ["manage_paiements"],
  documents: ["manage_documents"],
  parametres_academiques: ["manage_academic_settings"],
  communaute: ["manage_evenements"],
  releves: ["validate_releve"],
  cloture: ["validate_releve"],
  bulletins: ["validate_bulletin"],
  planning: ["manage_planning"],
  salles: ["manage_salles"],
  soutenances: ["manage_soutenances"],
  parents: ["manage_parents"],
  equipe: ["manage_team"],
  audit: ["view_audit"],
  exclusions: ["manage_exclusions"],
  director_dashboard: ["view_director_dashboard"],
  director_documents: ["view_pedagogique_validation", "view_cycle_validation"],
  director_reports: ["view_director_reports"],
  director_finance: ["view_director_finance"],
  director_signature: ["manage_signature"],
};

export const usePermissions = () => {
  const { user } = useAuth();
  const { isAdmin } = useAdmin();
  const { isSuperAdmin } = useSuperAdmin();

  const { data: teamData, isLoading: tmLoading } = useQuery({
    queryKey: ["team-permissions", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("team_members")
        .select("id, is_principal, team_role, allowed_modules, custom_role_label, institution_id, academic_scope")
        .eq("user_id", user.id)
        .maybeSingle();
      return data as any;
    },
    enabled: !!user,
    staleTime: 15_000,
    refetchInterval: 15_000,
  });

  // Dynamic permission keys from new roles/permissions system
  const { data: permKeys = [], isLoading: pkLoading } = useQuery({
    queryKey: ["user-permission-keys", user?.id],
    queryFn: async () => {
      if (!user) return [] as string[];
      const { data, error } = await supabase.rpc("get_user_permissions", { _user_id: user.id });
      if (error) return [] as string[];
      return (data as string[]) || [];
    },
    enabled: !!user,
    staleTime: 15_000,
    refetchInterval: 15_000,
  });

  // Principal = explicitly marked principal in team_members, OR super_admin,
  // OR has `admin` role AND is NOT a team_member with a restricted sub-role.
  // A team member with a specific role (directeur, responsable…) must be
  // scoped to their allowed_modules even if they also have the `admin` role.
  const hasTeamSubRole = !!teamData && teamData.is_principal === false;
  const isPrincipal = !!teamData?.is_principal || isSuperAdmin || (isAdmin && !hasTeamSubRole);
  const ALL_MODULES: ModuleKey[] = ADMIN_MODULES.map((m) => m.key);

  const allowedModules: ModuleKey[] = isPrincipal
    ? ALL_MODULES
    : ((teamData?.allowed_modules ?? []) as ModuleKey[]);

  const can = (_module: ModuleKey) => {
    if (isPrincipal) return true;
    if (allowedModules.includes(_module)) return true;
    const perms = MODULE_TO_PERM[_module];
    if (perms && perms.some(p => permissions.includes(p))) return true;
    return false;
  };

  // Dynamic permission helpers
  const permissions: string[] = permKeys;
  const hasPerm = (key: string) => isPrincipal || isSuperAdmin || permissions.includes(key);
  const hasAnyPerm = (keys: string[]) => isPrincipal || isSuperAdmin || keys.some((k) => permissions.includes(k));

  const academicScope: AcademicScope = (teamData?.academic_scope as AcademicScope) || "all";
  const teamRole: string | null = teamData?.team_role ?? null;
  const isDirector = teamRole === "directeur";
  const isResponsablePedagogique = teamRole === "responsable_pedagogique";
  const isResponsableCycle = teamRole === "responsable_cycle";

  return {
    isLoading: tmLoading || pkLoading,
    isPrincipal,
    isDirector,
    isResponsablePedagogique,
    isResponsableCycle,
    isAdmin: isAdmin || isSuperAdmin,
    allowedModules,
    teamRole,
    customRoleLabel: teamData?.custom_role_label ?? null,
    academicScope,
    can,
    // new
    permissions,
    hasPerm,
    hasAnyPerm,
  };
};
