import FullScreenLoader from "@/components/loading/FullScreenLoader";
import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useInstitution } from "@/hooks/useInstitution";
import { useParent } from "@/hooks/useParent";

const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { user, loading } = useAuth();
  const { isLoading: institutionLoading } = useInstitution();
  const { isParent, isLoading: parentLoading } = useParent();

  if (loading || institutionLoading || parentLoading) {
    return (
      <FullScreenLoader />
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (isParent) return <Navigate to="/parent/dashboard" replace />;

  return <>{children}</>;
};

export default ProtectedRoute;
