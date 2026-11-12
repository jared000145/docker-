import FullScreenLoader from "@/components/loading/FullScreenLoader";
import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { usePermissions } from "@/hooks/usePermissions";
import type { ValidatorRoleConfig } from "@/lib/validatorRoles";

const Spinner = () => (
  <FullScreenLoader />
);

const ValidatorProtectedRoute = ({
  children,
  role,
}: {
  children: ReactNode;
  role: ValidatorRoleConfig;
}) => {
  const { user, loading } = useAuth();
  const { isSuperAdmin, isLoading: saLoading } = useSuperAdmin();
  const { teamRole, isPrincipal, hasPerm, isLoading: permLoading } = usePermissions();

  if (loading || saLoading || permLoading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;

  // Permission-based access takes priority. Falls back to legacy team_role for compat.
  const requiredPerm = role.col === "pedagogique" ? "view_pedagogique_validation" : "view_cycle_validation";
  const ok = isSuperAdmin || isPrincipal || hasPerm(requiredPerm) || teamRole === role.teamRole;
  if (!ok) return <Navigate to="/" replace />;
  return <>{children}</>;
};

export default ValidatorProtectedRoute;
