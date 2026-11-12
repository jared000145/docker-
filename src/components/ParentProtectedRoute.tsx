import FullScreenLoader from "@/components/loading/FullScreenLoader";
import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useParent } from "@/hooks/useParent";

const Spinner = () => (
  <FullScreenLoader />
);

const ParentProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { user, loading } = useAuth();
  const { isParent, isLoading } = useParent();

  if (loading || isLoading) return <Spinner />;
  if (!user) return <Navigate to="/parent/login" replace />;
  if (!isParent) return <Navigate to="/" replace />;
  return <>{children}</>;
};

export default ParentProtectedRoute;
