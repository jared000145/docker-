import FullScreenLoader from "@/components/loading/FullScreenLoader";
import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";

const SuperAdminProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { user, loading } = useAuth();
  const { isSuperAdmin, isLoading } = useSuperAdmin();
  const location = useLocation();

  if (loading || isLoading) {
    return (
      <FullScreenLoader />
    );
  }

  if (!user) return <Navigate to={`/login?mode=email&next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  if (!isSuperAdmin) return <Navigate to="/admin" replace />;

  return <>{children}</>;
};

export default SuperAdminProtectedRoute;
