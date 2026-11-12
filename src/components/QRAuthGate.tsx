import { ReactNode, useState } from "react";
import { motion } from "framer-motion";
import { ShieldCheck, XCircle, Lock, LogIn } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface QRAuthGateProps {
  /** True when the document was found and is considered authentic. */
  isValid: boolean;
  /** Show a loading spinner while verification is in progress. */
  loading?: boolean;
  /** Title displayed above the login form. */
  title?: string;
  /** Document content displayed after successful authentication. */
  children: ReactNode;
}

/**
 * Universal QR-code verification gate.
 *
 * Flow:
 * 1. While loading → spinner.
 * 2. If document is invalid/not found → "Document non authentique ou introuvable".
 * 3. If document is valid but the visitor is not logged in → secure login form.
 * 4. Once logged in → render the authenticated document.
 */
export function QRAuthGate({ isValid, loading, title = "Authentification requise", children }: QRAuthGateProps) {
  const { user } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/30 to-background">
        <div className="animate-pulse text-muted-foreground">Vérification…</div>
      </div>
    );
  }

  if (!isValid) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-background via-destructive/5 to-background">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-3">
            <XCircle className="w-16 h-16 mx-auto text-destructive" />
            <h1 className="text-xl font-bold">Document non authentique ou introuvable</h1>
            <p className="text-muted-foreground text-sm">
              Le QR code scanné ne correspond à aucun document délivré par Rectorplus.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (user) {
    return <>{children}</>;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier || !password) return;
    setSubmitting(true);
    try {
      // Resolve identifier (matricule, email, etc.) to an email when needed
      const email = identifier.trim();
      if (!email.includes("@")) {
        // Try student / professor matricule conventions
        const candidates = [
          `${email}@student.campusflow.com`,
          `${email}@prof.campusflow.com`,
        ];
        let signed = false;
        for (const candidate of candidates) {
          const { error } = await supabase.auth.signInWithPassword({ email: candidate, password });
          if (!error) { signed = true; break; }
        }
        if (!signed) throw new Error("Identifiant ou mot de passe incorrect");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw new Error("Identifiant ou mot de passe incorrect");
      }
      toast.success("Connexion réussie");
    } catch (err: any) {
      toast.error(err.message || "Connexion impossible");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-background via-primary/5 to-background">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <Card className="border-primary/30 shadow-xl">
          <CardHeader className="text-center space-y-2">
            <div className="mx-auto w-14 h-14 rounded-2xl gradient-gold flex items-center justify-center">
              <ShieldCheck className="w-7 h-7 text-accent-foreground" />
            </div>
            <CardTitle className="text-xl">{title}</CardTitle>
            <p className="text-sm text-muted-foreground">
              Ce document est authentique. Connectez-vous pour le consulter.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-3">
              <div>
                <Label htmlFor="identifier">Identifiant ou email</Label>
                <Input
                  id="identifier"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="Matricule ou adresse email"
                  autoFocus
                />
              </div>
              <div>
                <Label htmlFor="password">Mot de passe</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    className="pl-9"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
              </div>
              <Button type="submit" className="w-full gap-2" disabled={submitting || !identifier || !password}>
                <LogIn className="w-4 h-4" />
                {submitting ? "Connexion…" : "Se connecter"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

export default QRAuthGate;
