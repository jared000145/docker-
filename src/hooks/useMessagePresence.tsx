import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/** Confirme rapidement la livraison, même lorsque l'utilisateur n'est pas sur la page Messages. */
export function useMessagePresence() {
  const { user } = useAuth();
  const busy = useRef(false);

  useEffect(() => {
    if (!user) return;

    const markDelivered = async () => {
      if (busy.current || document.visibilityState !== "visible") return;
      busy.current = true;
      await supabase
        .from("messages")
        .update({ delivered_at: new Date().toISOString() } as any)
        .eq("recipient_id", user.id)
        .is("delivered_at", null);
      busy.current = false;
    };

    void markDelivered();
    const channel = supabase
      .channel(`message-presence-${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `recipient_id=eq.${user.id}` }, markDelivered)
      .subscribe();
    document.addEventListener("visibilitychange", markDelivered);

    return () => {
      document.removeEventListener("visibilitychange", markDelivered);
      supabase.removeChannel(channel);
    };
  }, [user]);
}