import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { enablePush, pushStatusMessage, syncPushIfGranted } from "@/lib/webPush";
import { setLocalNotifSettings } from "@/hooks/useNotificationCenter";

const DISMISS_KEY = "rectorplus.push.dismissed";

/** Invite l'utilisateur connecté à activer les notifications hors application. */
export default function PushPrompt() {
  const { user } = useAuth();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!user) { setShow(false); return; }
    void syncPushIfGranted();
    const perm = typeof Notification !== "undefined" ? Notification.permission : "denied";
    const dismissed = Number(localStorage.getItem(DISMISS_KEY) || 0);
    setShow(perm === "default" && Date.now() - dismissed > 3 * 86400000 && window.top === window.self);
  }, [user]);

  if (!show) return null;

  const activate = async () => {
    const s = await enablePush();
    if (s === "enabled") { toast.success(pushStatusMessage.enabled); setLocalNotifSettings({ allow_push: true }); setShow(false); }
    else { toast.error(pushStatusMessage[s], { duration: 8000 }); if (s === "denied") setShow(false); }
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-sm z-50 rounded-2xl border border-border bg-card/95 backdrop-blur p-4 shadow-lg">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0"><Bell className="w-5 h-5" /></div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">Activer les notifications</p>
          <p className="text-xs text-muted-foreground mt-0.5">Recevez vos messages et alertes même quand RectorPlus est fermé.</p>
          <div className="flex gap-2 mt-3">
            <Button size="sm" onClick={activate}>Activer</Button>
            <Button size="sm" variant="ghost" onClick={() => { localStorage.setItem(DISMISS_KEY, String(Date.now())); setShow(false); }}>Plus tard</Button>
          </div>
        </div>
        <button aria-label="Fermer" className="text-muted-foreground" onClick={() => { localStorage.setItem(DISMISS_KEY, String(Date.now())); setShow(false); }}><X className="w-4 h-4" /></button>
      </div>
    </div>
  );
}
