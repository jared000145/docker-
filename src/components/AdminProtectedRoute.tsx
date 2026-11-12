import FullScreenLoader from "@/components/loading/FullScreenLoader";
import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { useInstitution } from "@/hooks/useInstitution";
import { usePermissions } from "@/hooks/usePermissions";
import { useDirector } from "@/hooks/useDirector";
import { ROUTE_MODULE_MAP } from "@/lib/permissions";

const Spinner = () => (
  <FullScreenLoader />
);

const AdminProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { user, loading } = useAuth();
  const { isAdmin, isLoading } = useAdmin();
  const { institution, isLoading: institutionLoading } = useInstitution();
  const { isLoading: permLoading, isPrincipal, can, teamRole } = usePermissions();
  const { isDirector, isLoading: dirLoading } = useDirector();
  const location = useLocation();

  if (loading || isLoading || institutionLoading || permLoading || dirLoading) return <Spinner />;

  if (!user) return <Navigate to="/" replace />;

  const segments = location.pathname.split("/").filter(Boolean);
  const sub = segments[1];
  const requiredModule = sub ? ROUTE_MODULE_MAP[sub] : null;

  // Validators (responsable_pedagogique / cycle) can access admin modules they were granted.
  // If they hit /admin root or a route they don't have, send them to their validator dashboard.
  const isValidator = teamRole === "responsable_pedagogique" || teamRole === "responsable_cycle";
  const validatorHome = teamRole === "responsable_pedagogique" ? "/pedagogique" : "/cycle";
  // Personal conversations remain scoped by participant RLS, independently of
  // the academic/finance modules granted to a member of the administration.
  if(sub==='messages'&&(isAdmin||isDirector||isValidator))return <>{children}</>;

  if (isDirector && !isPrincipal) {
    // Allow directors to enter admin sub-routes when they were granted the matching module.
    if (!requiredModule || !can(requiredModule)) return <Navigate to="/director" replace />;
    return <>{children}</>;
  }
  if (isValidator && !isPrincipal) {
    if (!requiredModule || !can(requiredModule)) return <Navigate to={validatorHome} replace />;
    return <>{children}</>;
  }
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  if (sub === "settings" && !isPrincipal) return <Navigate to={can("parametres_academiques") ? "/admin/academic-settings" : "/admin"} replace />;

  // Module-level guard for team members. Principals & super-admins bypass.
  if (!isPrincipal) {
    if (sub === "team" && !can("equipe")) return <Navigate to="/admin" replace />;
    if (sub && (!requiredModule || !can(requiredModule))) {
      return <Navigate to="/admin" replace />;
    }
  }

  return <>{children}</>;
};

export default AdminProtectedRoute;
