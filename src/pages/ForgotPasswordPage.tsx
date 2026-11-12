import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Mail, Hash, ArrowLeft, KeyRound, RefreshCw, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const ForgotPasswordPage = () => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [matricule, setMatricule] = useState("");
  const [tab, setTab] = useState("email");
  const [cooldown, setCooldown] = useState(0);
  const [lastPayload, setLastPayload] = useState<{ email?: string; matricule?: string } | null>(null);
  const [sentTo, setSentTo] = useState("");

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const sendReset = async (payload: { email?: string; matricule?: string }) => {
    const { data, error } = await supabase.functions.invoke("request-password-reset", {
      body: { ...payload, redirect_to: `${window.location.origin}/reset-password` },
    });
    if (error) {
      const response = (error as any)?.context;
      const details = typeof response?.json === "function" ? await response.json().catch(() => null) : null;
      if (details?.retry_after) setCooldown(Number(details.retry_after));
      throw new Error(details?.error || error.message || "Échec de l'envoi");
    }
    if ((data as any)?.retry_after) setCooldown(Number((data as any).retry_after));
    if ((data as any)?.recipient) setSentTo((data as any).recipient);
    if ((data as any)?.error) throw new Error((data as any).error);
    setLastPayload(payload);
  };

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    try {
      await sendReset({ email: email.trim() });
      toast.success("Si un compte correspond, un lien sera envoyé à son adresse de récupération.");
    } catch (err: any) {
      toast.error(err.message || "Échec de l'envoi");
    } finally {
      setLoading(false);
    }
  };

  const handleMatricule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!matricule) return;
    setLoading(true);
    try {
      await sendReset({ matricule: matricule.trim() });
      toast.success("Si un compte correspond, un lien sera envoyé à son adresse de récupération.");
    } catch (err: any) {
      toast.error(err.message || "Échec de l'envoi");
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    if (!lastPayload || cooldown > 0) return;
    setLoading(true);
    try {
      await sendReset(lastPayload);
      toast.success("E-mail renvoyé.");
    } catch (err: any) {
      toast.error(err.message || "Échec du renvoi");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-background via-primary/5 to-background">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="glass-card-elevated p-6 sm:p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="mx-auto w-14 h-14 rounded-2xl gradient-gold flex items-center justify-center">
              <KeyRound className="w-7 h-7 text-accent-foreground" />
            </div>
            <h1 className="text-2xl font-heading font-bold">Mot de passe oublié</h1>
            <p className="text-sm text-muted-foreground">
              Recevez un lien de réinitialisation par email
            </p>
          </div>

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="email">Par email</TabsTrigger>
              <TabsTrigger value="matricule">Par matricule</TabsTrigger>
            </TabsList>

            <TabsContent value="email" className="mt-5">
              <form onSubmit={handleEmail} className="space-y-4">
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    type="email"
                    placeholder="votre@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-11 h-12"
                    required
                  />
                </div>
                <Button type="submit" disabled={loading} className="w-full h-12 btn-gold">
                  {loading ? "Envoi..." : "Envoyer le lien"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="matricule" className="mt-5">
              <form onSubmit={handleMatricule} className="space-y-4">
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    placeholder="XXXX-XXXX-XXXXX"
                    value={matricule}
                    onChange={(e) => setMatricule(e.target.value)}
                    className="pl-11 h-12"
                    required
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Le lien sera envoyé à l'adresse email de récupération liée à votre compte.
                </p>
                <Button type="submit" disabled={loading} className="w-full h-12 btn-gold">
                  {loading ? "Envoi..." : "Envoyer le lien"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          {lastPayload && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-primary mt-0.5" />
                <div className="space-y-1 text-sm">
                  <p className="font-medium">Lien de réinitialisation envoyé</p>
                  <p className="text-muted-foreground">
                    {sentTo ? `Adresse liée : ${sentTo}` : "Vérifiez l'adresse liée au compte étudiant."}
                  </p>
                </div>
              </div>
              <Button type="button" variant="outline" onClick={resend} disabled={loading || cooldown > 0} className="w-full h-11">
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                {cooldown > 0 ? `Renvoyer l'e-mail dans ${cooldown}s` : "Renvoyer l'e-mail"}
              </Button>
            </div>
          )}

          <Link to="/login" className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Retour à la connexion
          </Link>
        </div>
      </motion.div>
    </div>
  );
};

export default ForgotPasswordPage;
