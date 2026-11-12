import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { playNotificationSound } from "@/lib/notificationSound";

const SETTINGS_KEY = "rectorplus.notif.settings";

interface LocalSettings { allow_sound: boolean; allow_push: boolean; }

const readLocal = (): LocalSettings => {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { allow_sound: true, allow_push: true, ...JSON.parse(raw) };
  } catch { /* Optional operation: retain the existing fallback. */ }
  return { allow_sound: true, allow_push: true };
};

export const useNotificationCenter = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const channelRef = useRef<any>(null);

  useEffect(() => {
    if (!user) return;
    const userId = user.id;

    const channel = supabase
      .channel(`notif-center-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          const n: any = payload.new;
          const settings = readLocal();

          // Invalider les queries existantes
          qc.invalidateQueries({ queryKey: ["student-notifications"] });
          qc.invalidateQueries({ queryKey: ["notifications-unread-count"] });
          qc.invalidateQueries({ queryKey: ["module-badges"] });

          // Son
          if (settings.allow_sound) {
            try { playNotificationSound(); } catch { /* Optional operation: retain the existing fallback. */ }
          }

          // Toast in-app (bulle façon WhatsApp)
          toast(n.title || "Notification", {
            description: n.message,
            action: n.link ? {
              label: "Ouvrir",
              onClick: () => { window.location.href = n.link; },
            } : undefined,
          });

          // Les notifications hors application sont envoyées par le push serveur (push-sw.js).
        }
      )
      .subscribe();

    channelRef.current = channel;
    return () => {
      try { supabase.removeChannel(channel); } catch { /* Optional operation: retain the existing fallback. */ }
      channelRef.current = null;
    };
  }, [user, qc]);
};

export const requestNotificationPermission = async (): Promise<NotificationPermission> => {
  if (typeof Notification === "undefined") return "denied";
  if (Notification.permission === "granted" || Notification.permission === "denied") return Notification.permission;
  return await Notification.requestPermission();
};

export const getLocalNotifSettings = readLocal;
export const setLocalNotifSettings = (s: Partial<LocalSettings>) => {
  const cur = readLocal();
  const next = { ...cur, ...s };
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(next)); } catch { /* Optional operation: retain the existing fallback. */ }
  return next;
};
