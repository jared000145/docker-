import { ReactNode } from "react";
import { Lock, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { useNewYearAccess } from "@/hooks/useNewYearAccess";
import { useAcademicYear } from "@/hooks/useAcademicYear";

/**
 * Affiche un bandeau bloquant si l'étudiant n'est pas à jour de ses frais
 * administratifs pour la nouvelle année active.
 * - Visible uniquement quand l'année sélectionnée == année active.
 * - Les années antérieures restent consultables sans restriction.
 */
export function NewYearAccessGuard({ children }: { children: ReactNode }) {
  const { hasAccess, isLoading } = useNewYearAccess();
  const { isStudent, isViewingHistory, currentYear } = useAcademicYear();
  const navigate = useNavigate();

  if (!isStudent || isViewingHistory || isLoading || hasAccess) {
    return <>{children}</>;
  }

  return (
    <div className="space-y-4">
      <Card className="border-destructive/40 bg-destructive/5">
        <CardContent className="p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-destructive/15 flex items-center justify-center flex-shrink-0">
            <Lock className="w-6 h-6 text-destructive" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-base text-destructive mb-1">
              Accès restreint à l'année {currentYear}
            </h3>
            <p className="text-sm text-muted-foreground">
              Veuillez régulariser vos frais administratifs pour accéder à la nouvelle année académique.
            </p>
          </div>
          <Button onClick={() => navigate("/payments")} className="gap-2 flex-shrink-0">
            <CreditCard className="w-4 h-4" /> Régler mes frais
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
