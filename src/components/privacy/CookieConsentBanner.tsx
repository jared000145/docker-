import { useEffect, useState } from "react";
import { Link,useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import RectorPlusLogo from "@/components/branding/RectorPlusLogo";

type ConsentChoice = "all" | "essential";

const CONSENT_KEY = "rectorplus-cookie-consent";

const CookieConsentBanner = () => {
  const {pathname}=useLocation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      setVisible(!localStorage.getItem(CONSENT_KEY));
    } catch {
      setVisible(true);
    }
  }, []);

  const saveChoice = (choice: ConsentChoice) => {
    try {
      localStorage.setItem(CONSENT_KEY, JSON.stringify({ choice, savedAt: new Date().toISOString() }));
    } catch {
      // Le choix reste appliqué pendant la visite si le stockage est indisponible.
    }
    setVisible(false);
  };

  if (!visible||pathname.startsWith('/verify')) return null;

  return (
    <aside
      aria-label="Choix des cookies"
      className="fixed inset-x-3 bottom-3 z-[100] mx-auto max-w-4xl rounded-lg border border-border bg-card p-3 text-card-foreground shadow-elevated sm:inset-x-6 sm:bottom-6 sm:p-5"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <RectorPlusLogo className="h-9 w-9 shrink-0 rounded-lg bg-primary/10 p-1 sm:h-11 sm:w-11 sm:p-1.5" label="Logo RectorPlus" />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold sm:text-base">Vos préférences de confidentialité</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">
            RectorPlus utilise des cookies nécessaires à la connexion et aux préférences. Avec votre accord, des mesures anonymes peuvent aussi améliorer le service. Consultez notre{" "}
            <Link to="/confidentialite" className="font-medium text-primary underline underline-offset-4">
              politique de confidentialité
            </Link>.
          </p>
        </div>
        <div className="grid shrink-0 grid-cols-2 gap-2">
          <Button type="button" variant="outline" onClick={() => saveChoice("essential")}>
            Nécessaires seulement
          </Button>
          <Button type="button" onClick={() => saveChoice("all")}>
            Tout accepter
          </Button>
        </div>
      </div>
    </aside>
  );
};

export default CookieConsentBanner;
