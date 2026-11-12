import { motion } from "framer-motion";
import { Lock, LogOut, Phone, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";

export const SubscriptionExpiredScreen = () => {
  const { signOut } = useAuth();
  const { institution, daysLeft, subscription } = useSubscription();

  const isBlocked = institution?.is_active === false;
  const expiredSince = daysLeft !== null && daysLeft < 0 ? Math.abs(daysLeft) : null;

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-xl"
      >
        <Card className="border-amber-500/20 bg-white shadow-2xl overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-600" />
          <CardContent className="p-8 text-center space-y-6">
            <motion.div
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ repeat: Infinity, duration: 2.4 }}
              className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-rose-600 shadow-xl"
            >
              {isBlocked ? <Lock className="h-10 w-10 text-white" /> : <ShieldAlert className="h-10 w-10 text-white" />}
            </motion.div>

            <div className="space-y-1">
              <h1 className="text-2xl font-bold text-slate-900">
                {isBlocked ? "Accès suspendu" : "Abonnement expiré"}
              </h1>
              {institution?.name && (
                <p className="text-sm font-medium text-slate-500">{institution.name}</p>
              )}
            </div>

            <p className="text-base text-slate-700 leading-relaxed">
              {isBlocked
                ? "L'accès à votre plateforme a été temporairement suspendu."
                : `Votre abonnement est arrivé à échéance${expiredSince ? ` depuis ${expiredSince} jour(s)` : ""}.`}
              <br />
              Pour rétablir le service, veuillez{" "}
              <strong>contacter votre fournisseur</strong> afin de renouveler votre abonnement.
            </p>

            <div className="rounded-xl bg-slate-50 border border-slate-200 p-5 text-left space-y-3">
              <p className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <Phone className="h-4 w-4 text-amber-600" /> Étapes pour réactiver l'accès
              </p>
              <ol className="space-y-1.5 text-sm text-slate-600 list-decimal list-inside">
                <li>Contactez votre fournisseur de la plateforme</li>
                <li>Procédez au règlement de votre abonnement</li>
                <li>L'accès sera rétabli automatiquement après validation</li>
              </ol>
              {subscription?.ends_at && (
                <p className="text-xs text-slate-500 pt-2 border-t border-slate-200">
                  Échéance : <span className="font-medium text-slate-700">{new Date(subscription.ends_at).toLocaleDateString("fr-FR")}</span>
                </p>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => signOut?.()}
              >
                <LogOut className="h-4 w-4 mr-2" /> Se déconnecter
              </Button>
            </div>

            <p className="text-xs text-slate-400">
              Vos données restent sécurisées et seront accessibles dès la réactivation.
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};
