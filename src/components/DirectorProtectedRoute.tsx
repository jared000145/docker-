import FullScreenLoader from "@/components/loading/FullScreenLoader";
import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useDirector } from "@/hooks/useDirector";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { usePermissions } from "@/hooks/usePermissions";

const Spinner = () => (
  <FullScreenLoader />
);

const DirectorProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { user, loading } = useAuth();
  const { isDirector, isLoading } = useDirector();
  const { isSuperAdmin, isLoading: saLoading } = useSuperAdmin();
  const { isPrincipal, can, isLoading: permLoading } = usePermissions();
  const location=useLocation();

  if (loading || isLoading || saLoading || permLoading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (!isDirector && !isSuperAdmin && !isPrincipal) {
    return <Navigate to="/" replace />;
  }
  const moduleByPage={documents:'director_documents',reports:'director_reports',finance:'director_finance',signature:'director_signature'} as const;
  const page=location.pathname.split('/')[2];
  const required=moduleByPage[page as keyof typeof moduleByPage] || ((!page||page==='campuses')?'director_dashboard':null);
  if(required&&!can(required))return <div className="p-8"><h1>Accès non attribué</h1><p>Ce module ne fait pas partie des droits de votre compte. Contactez l’administration de votre établissement.</p><a href="/account">Mon compte</a></div>;
  return <>{children}</>;
};

export default DirectorProtectedRoute;
