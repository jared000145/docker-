import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, ShieldCheck, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const isInternalPlaceholder = (email?: string | null) =>
  !!email && (email.endsWith("@student.campusflow.com") || email.endsWith("@prof.campusflow.com"));
const GOOGLE_LINK_TOKEN_KEY = "rectorplus_google_link_token";
const GOOGLE_LINK_RETURN_SESSION_KEY = "rectorplus_google_link_return_session";

const findGoogleIdentity = (user: any) =>
  user?.identities?.find((i: any) => i.provider === "google");

const waitForLinkedIdentity = async () => {
  for (let i = 0; i < 25; i += 1) {
    const { data } = await supabase.auth.getUser();
    const identity = findGoogleIdentity(data.user);
    const email = identity?.identity_data?.email;
    if (email && !isInternalPlaceholder(email)) return { user: data.user!, email: email as string };
    await new Promise((r) => setTimeout(r, 300));
  }
  return null;
};

const restoreOriginalSession = async () => {
  const raw = sessionStorage.getItem(GOOGLE_LINK_RETURN_SESSION_KEY);
  if (!raw) return false;
  try {
    const session = JSON.parse(raw);
    if (session?.access_token && session?.refresh_token) {
      await supabase.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token });
      return true;
    }
  } catch {
    return false;
  }
  return false;
};

const GoogleLinkCallbackPage = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Validation de la liaison Google…");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Give Supabase a moment to hydrate the session from the redirect.
        await new Promise((r) => setTimeout(r, 400));
        const linkToken = sessionStorage.getItem(GOOGLE_LINK_TOKEN_KEY);

        if (linkToken) {
          setMessage("Validation sécurisée du compte Google…");
          const { data, error } = await supabase.functions.invoke("link-google-account", {
            body: { action: "complete", token: linkToken },
          });
          if (error) throw new Error(error.message?.replace(/^Edge Function returned a non-2xx status code\s*/i, "") || "La validation Google a échoué.");
          if (!data?.success) throw new Error(data?.error || "La liaison Google a échoué.");

          sessionStorage.removeItem(GOOGLE_LINK_TOKEN_KEY);
          await restoreOriginalSession();
          sessionStorage.removeItem(GOOGLE_LINK_RETURN_SESSION_KEY);

          if (!cancelled) {
            setStatus("success");
            setMessage(`Compte Google lié : ${data.google_email}`);
            toast.success("Compte Google lié");
            setTimeout(() => navigate("/settings", { replace: true }), 1400);
          }
          return;
        }

        const found = await waitForLinkedIdentity();
        if (!found) throw new Error("Aucun compte Google détecté. Réessayez la liaison.");

        const { error } = await supabase
          .from("profiles")
          .update({ google_email: found.email, recovery_email: found.email } as any)
          .eq("user_id", found.user.id);
        if (error) throw error;

        if (!cancelled) {
          setStatus("success");
          setMessage("Compte Google lié avec succès.");
          toast.success("Compte Google lié");
          setTimeout(() => navigate("/settings", { replace: true }), 1400);
        }
      } catch (e: any) {
        await restoreOriginalSession();
        if (!cancelled) {
          setStatus("error");
          setMessage(e?.message || "La liaison Google a échoué.");
          toast.error(e?.message || "La liaison Google a échoué.");
        }
      }
    })();
    return () => { cancelled = true; };
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="glass-card-elevated w-full max-w-md space-y-5 p-6 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/15">
          {status === "loading" ? <Loader2 className="h-7 w-7 animate-spin text-accent" /> : null}
          {status === "success" ? <ShieldCheck className="h-7 w-7 text-accent" /> : null}
          {status === "error" ? <AlertTriangle className="h-7 w-7 text-destructive" /> : null}
        </div>
        <div>
          <h1 className="text-xl font-heading font-bold text-foreground">Liaison Google</h1>
          <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        </div>
        {status === "error" ? (
          <Button onClick={() => navigate("/settings", { replace: true })} className="w-full btn-gold">
            Retour aux paramètres
          </Button>
        ) : null}
      </div>
    </div>
  );
};

export default GoogleLinkCallbackPage;
