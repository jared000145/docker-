import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const UnsubscribePage = () => {
  const [sp] = useSearchParams();
  const token = sp.get("token") || "";
  const [state, setState] = useState<"loading" | "valid" | "already" | "invalid" | "done" | "error">("loading");

  useEffect(() => {
    if (!token) { setState("invalid"); return; }
    (async () => {
      try {
        const r = await fetch(`${SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${token}`, { headers: { apikey: ANON } });
        const j = await r.json();
        if (j.valid) setState("valid");
        else if (j.reason === "already_unsubscribed") setState("already");
        else setState("invalid");
      } catch { setState("invalid"); }
    })();
  }, [token]);

  const confirm = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("handle-email-unsubscribe", { body: { token } });
      if (error) throw error;
      setState((data as any)?.success ? "done" : "already");
    } catch { setState("error"); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="glass-card-elevated p-8 max-w-md text-center space-y-4">
        {state === "loading" && <Loader2 className="w-10 h-10 mx-auto animate-spin text-primary" />}
        {state === "valid" && (<>
          <h1 className="text-xl font-bold">Confirmer la désinscription</h1>
          <p className="text-sm text-muted-foreground">Vous ne recevrez plus d'emails de Rectorplus à cette adresse.</p>
          <Button onClick={confirm} className="w-full">Se désinscrire</Button>
        </>)}
        {state === "done" && (<><CheckCircle2 className="w-12 h-12 mx-auto text-emerald-500" /><h1 className="text-xl font-bold">Désinscription confirmée</h1></>)}
        {state === "already" && (<><CheckCircle2 className="w-12 h-12 mx-auto text-emerald-500" /><h1 className="text-xl font-bold">Vous êtes déjà désinscrit</h1></>)}
        {(state === "invalid" || state === "error") && (<><XCircle className="w-12 h-12 mx-auto text-destructive" /><h1 className="text-xl font-bold">Lien invalide ou expiré</h1></>)}
      </div>
    </div>
  );
};

export default UnsubscribePage;
