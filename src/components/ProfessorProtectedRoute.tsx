import FullScreenLoader from "@/components/loading/FullScreenLoader";
import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useProfessor } from "@/hooks/useProfessor";
import { useInstitution } from "@/hooks/useInstitution";

const ProfessorProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { user, loading } = useAuth();
  const { isProfessor, isLoading } = useProfessor();
  const { institution, isLoading: institutionLoading } = useInstitution();

  if (loading || isLoading || institutionLoading) {
    return (
      <FullScreenLoader />
    );
  }

  if (!user) return <Navigate to="/" replace />;
  if (!isProfessor) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
};

export default ProfessorProtectedRoute;
