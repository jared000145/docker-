import {invokeServer} from '@/lib/serverCall';
import {PhoneInput} from '@/components/ui/phone-input';
import ProfilePhotoEditor from '@/components/account/ProfilePhotoEditor';
import { motion } from "framer-motion";
import { Save, KeyRound, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useState } from "react";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { SignatureUploader } from "@/components/student/SignatureUploader";

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.08 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };
const GOOGLE_LINK_TOKEN_KEY = "rectorplus_google_link_token";
const GOOGLE_LINK_RETURN_SESSION_KEY = "rectorplus_google_link_return_session";

const ProfileSettingsPage = () => {
  const { profile, user } = useAuth();
  const qc = useQueryClient();

  const [phone, setPhone] = useState(profile?.phone || "");
  const [recoveryEmail, setRecoveryEmail] = useState((profile as any)?.recovery_email || "");

  const [googleLinking, setGoogleLinking] = useState(false);

  const handleGoogleLink = async () => {
    if (!user) return;
    setGoogleLinking(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session?.access_token || !sessionData.session?.refresh_token) {
        throw new Error("Session introuvable. Reconnectez-vous puis réessayez.");
      }

      const { data: beginData, error: beginError } = await supabase.functions.invoke("link-google-account", {
        body: { action: "begin" },
      });
      if (beginError) throw new Error(beginError.message?.replace(/^Edge Function returned a non-2xx status code\s*/i, "") || "Impossible de démarrer la liaison Google.");
      if (beginData?.error || !beginData?.token) throw new Error(beginData?.error || "Jeton de liaison Google manquant.");

      sessionStorage.setItem(GOOGLE_LINK_TOKEN_KEY, beginData.token);
      sessionStorage.setItem(
        GOOGLE_LINK_RETURN_SESSION_KEY,
        JSON.stringify({ access_token: sessionData.session.access_token, refresh_token: sessionData.session.refresh_token })
      );

      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: `${window.location.origin}/google-link-callback`,
        extraParams: { prompt: "select_account" },
      });

      if (result.error) throw result.error;
      if (result.redirected) return;
      window.location.assign(`${window.location.origin}/google-link-callback`);
    } catch (e: any) {
      toast.error(e?.message || "Impossible de lier Google pour le moment.");
      setGoogleLinking(false);
    }
  };


  // Password change
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const updateMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("profiles").update({ phone, recovery_email: recoveryEmail || null } as any).eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => toast.success("Profil mis à jour"),
    onError: (e: any) => toast.error(e.message),
  });

  const passwordMutation = useMutation({
    mutationFn: async () => {
      if (newPassword !== confirmPassword) throw new Error("Les mots de passe ne correspondent pas");
      if (newPassword.length < 6) throw new Error("Le mot de passe doit contenir au moins 6 caractères");
      await invokeServer('update-user-password',{new_password:newPassword});
      await supabase.auth.refreshSession();
    },
    onSuccess: () => {
      toast.success("Mot de passe mis à jour avec succès");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (e: any) => toast.error(e.message),
  });


  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={item}>
        <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground">Paramètres</h1>
        <p className="text-muted-foreground mt-1">Gérez votre profil</p>
      </motion.div>

      <motion.div variants={item}><ProfilePhotoEditor /></motion.div>

      <motion.div variants={item}>
        <Card className="glass-card-elevated border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-heading">Informations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Prénom</label>
                <Input value={profile?.first_name || ""} disabled className="bg-secondary/30" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Nom</label>
                <Input value={profile?.last_name || ""} disabled className="bg-secondary/30" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Matricule</label>
              <Input value={profile?.student_number || "—"} disabled className="bg-secondary/30 font-mono" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Téléphone</label>
              <PhoneInput value={phone} onChange={setPhone}/>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Email de récupération (mot de passe oublié)</label>
              <Input type="email" value={recoveryEmail} onChange={(e) => setRecoveryEmail(e.target.value)} placeholder="votre@email.com" />
              <p className="text-[11px] text-muted-foreground/80">Utilisé pour réinitialiser votre mot de passe si vous l'oubliez.</p>
            </div>
            <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending} className="gradient-gold text-accent-foreground gap-2">
              <Save className="w-4 h-4" /> {updateMutation.isPending ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={item}>
        <Card className="glass-card-elevated border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-heading flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-accent" /> Changer le mot de passe
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Nouveau mot de passe</label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min 6 caractères" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Confirmer le mot de passe</label>
              <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Répétez le mot de passe" />
            </div>
            {newPassword && confirmPassword && newPassword !== confirmPassword && (
              <p className="text-xs text-destructive">Les mots de passe ne correspondent pas</p>
            )}
            <Button
              onClick={() => passwordMutation.mutate()}
              disabled={!newPassword || newPassword.length < 6 || newPassword !== confirmPassword || passwordMutation.isPending}
              className="gradient-gold text-accent-foreground gap-2"
            >
              <KeyRound className="w-4 h-4" /> {passwordMutation.isPending ? "Mise à jour..." : "Changer le mot de passe"}
            </Button>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={item}>
        <SignatureUploader />
      </motion.div>

      <motion.div variants={item}>
        <Card className="glass-card-elevated border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-heading flex items-center gap-2">
              <svg className="w-5 h-5" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.4 29.3 35.5 24 35.5c-6.4 0-11.5-5.1-11.5-11.5S17.6 12.5 24 12.5c2.9 0 5.5 1.1 7.5 2.8l5.7-5.7C33.9 6.5 29.2 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5c10.4 0 19-7.5 19-19.5 0-1.2-.1-2.3-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 12.5 24 12.5c2.9 0 5.5 1.1 7.5 2.8l5.7-5.7C33.9 6.5 29.2 4.5 24 4.5 16.3 4.5 9.7 8.9 6.3 14.7z"/><path fill="#4CAF50" d="M24 43.5c5.1 0 9.7-1.9 13.2-5.1l-6.1-5c-2 1.4-4.5 2.2-7.1 2.2-5.2 0-9.7-3.1-11.3-7.5l-6.5 5C9.5 39.1 16.2 43.5 24 43.5z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.7 2.1-2.1 3.9-3.9 5.1l6.1 5c-.4.4 6.5-4.8 6.5-14.1 0-1.2-.1-2.3-.4-3.5z"/></svg>
              Compte Google
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Liez votre compte Google pour récupérer votre mot de passe et synchroniser vos examens avec Google Calendar.
            </p>
            {(profile as any)?.google_email ? (
              <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 p-3">
                <div>
                  <p className="text-sm font-medium">Compte lié</p>
                  <p className="text-xs text-muted-foreground">{(profile as any).google_email}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    const { error } = await supabase.from("profiles").update({ google_email: null } as any).eq("user_id", user!.id);
                    if (error) toast.error(error.message);
                    else { toast.success("Compte Google délié"); qc.invalidateQueries(); }
                  }}
                >
                  Délier
                </Button>
              </div>
            ) : (
              <>
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
                  ℹ️ Sur l'écran Google, il se peut que le nom affiché soit celui de notre hébergeur technique. C'est bien Rectorplus qui recevra uniquement votre email — aucune autre donnée n'est partagée.
                </div>
                <Button
                  variant="outline"
                  className="w-full gap-3"
                  onClick={async () => { await handleGoogleLink(); }}
                  disabled={googleLinking}
                >
                  {googleLinking ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {googleLinking ? "Ouverture de Google..." : "Lier mon compte Google"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={item}>
        <NotificationSettingsCard />
      </motion.div>
    </motion.div>
  );
};

// --- Notifications préférences ---
import { Bell, Volume2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  getLocalNotifSettings,
  setLocalNotifSettings,
  requestNotificationPermission,
} from "@/hooks/useNotificationCenter";
import { playNotificationSound } from "@/lib/notificationSound";
import { enablePush, disablePush, pushStatusMessage } from "@/lib/webPush";

const NotificationSettingsCard = () => {
  const [settings, setSettings] = useState(getLocalNotifSettings());
  const [perm, setPerm] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "denied"
  );

  const update = (s: Partial<typeof settings>) => setSettings(setLocalNotifSettings(s));

  return (
    <Card className="glass-card-elevated border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Bell className="w-5 h-5 text-accent" /> Notifications</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-sm">Notifications navigateur (push)</p>
            <p className="text-xs text-muted-foreground">Recevez les alertes même si l'onglet n'est pas ouvert</p>
          </div>
          <Switch
            checked={settings.allow_push && perm === "granted"}
            onCheckedChange={async (v) => {
              if (v) {
                const s = await enablePush();
                if (typeof Notification !== "undefined") setPerm(Notification.permission);
                if (s !== "enabled") { toast.error(pushStatusMessage[s]); return; }
                toast.success(pushStatusMessage.enabled);
              } else {
                await disablePush();
              }
              update({ allow_push: v });
            }}
          />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-sm flex items-center gap-2"><Volume2 className="w-4 h-4" /> Son de notification</p>
            <p className="text-xs text-muted-foreground">Jouer un son court à chaque alerte</p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => playNotificationSound()}>Tester</Button>
            <Switch checked={settings.allow_sound} onCheckedChange={(v) => update({ allow_sound: v })} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProfileSettingsPage;
