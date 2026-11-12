import { supabase } from "@/integrations/supabase/client";

export const VAPID_PUBLIC_KEY =
  "BKnxT2heXSOipaL80fHXYtnzCV8a4UA6AOfdHkFd3Bw-yjhPdY9Duuxj1jeZgqFMRfcVIz7yRzO3t_OaTRlnhrI";

export type PushStatus = "enabled" | "unsupported" | "open-in-new-tab" | "denied" | "ios-install" | "error";

const b64ToUint8 = (b64: string) => {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
};

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)").matches || (navigator as any).standalone === true;

export const pushSupported = () =>
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

const saveSubscription = async (sub: PushSubscription) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const j = sub.toJSON() as any;
  await supabase.from("push_subscriptions" as any).upsert(
    { user_id: user.id, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, user_agent: navigator.userAgent.slice(0, 250) },
    { onConflict: "endpoint" },
  );
};

/** Doit être appelé depuis un clic (exigence des navigateurs). */
export async function enablePush(): Promise<PushStatus> {
  if (window.top !== window.self) return "open-in-new-tab";
  if (isIos() && !isStandalone()) return "ios-install";
  if (!pushSupported()) return "unsupported";
  try {
    const perm = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
    if (perm !== "granted") return "denied";
    const reg = await navigator.serviceWorker.register("/push-sw.js");
    await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToUint8(VAPID_PUBLIC_KEY) });
    await saveSubscription(sub);
    return "enabled";
  } catch (e) {
    console.error("enablePush", e);
    return "error";
  }
}

/** Resynchronise silencieusement l'abonnement si la permission est déjà accordée. */
export async function syncPushIfGranted() {
  if (window.top !== window.self || !pushSupported() || Notification.permission !== "granted") return;
  try {
    const reg = await navigator.serviceWorker.register("/push-sw.js");
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToUint8(VAPID_PUBLIC_KEY) });
    await saveSubscription(sub);
  } catch { /* Optional operation: retain the existing fallback. */ }
}

export async function disablePush() {
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration("/push-sw.js");
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await supabase.from("push_subscriptions" as any).delete().eq("endpoint", sub.endpoint);
    await sub.unsubscribe();
  }
}

export const pushStatusMessage: Record<PushStatus, string> = {
  enabled: "Notifications activées sur cet appareil.",
  unsupported: "Ce navigateur ne prend pas en charge les notifications.",
  "open-in-new-tab": "Ouvrez le site dans un onglet séparé pour activer les notifications.",
  denied: "Notifications bloquées : autorisez-les dans les réglages du navigateur pour ce site.",
  "ios-install": "Sur iPhone/iPad : touchez Partager › « Sur l'écran d'accueil », puis ouvrez RectorPlus depuis l'icône et réactivez.",
  error: "Activation impossible, réessayez.",
};
