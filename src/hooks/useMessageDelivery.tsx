import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Marque automatiquement comme "livrés" tous les messages reçus par l'utilisateur
 * qui n'ont pas encore de delivered_at.
 * Doit être appelé dans le composant racine de la messagerie (présence de l'utilisateur en ligne).
 */
export function useMessageDelivery(userId: string | undefined, messages: any[]) {
  useEffect(() => {
    if (!userId || !messages?.length) return;
    const undelivered = messages
      .filter((m: any) => m.recipient_id === userId && !m.delivered_at)
      .map((m: any) => m.id);
    if (undelivered.length === 0) return;
    supabase
      .from("messages")
      .update({ delivered_at: new Date().toISOString() } as any)
      .in("id", undelivered)
      .then(() => {});
  }, [userId, messages]);
}

/** Marque immédiatement comme lus les messages du correspondant actuellement ouvert. */
export function useMessageRead(userId: string | undefined, senderId: string | undefined, messages: any[]) {
  useEffect(() => {
    if (!userId || !senderId || !messages?.length || document.visibilityState !== "visible") return;
    const unread = messages
      .filter((m: any) => m.recipient_id === userId && m.sender_id === senderId && !m.is_read)
      .map((m: any) => m.id);
    if (!unread.length) return;
    supabase.from("messages").update({ is_read: true } as any).in("id", unread).then(() => {});
  }, [userId, senderId, messages]);
}

/** Marque lus les messages reçus déjà visibles dans une boîte de réception ouverte. */
export function useVisibleMessagesRead(userId: string | undefined, messages: any[]) {
  useEffect(() => {
    if (!userId || !messages?.length || document.visibilityState !== "visible") return;
    const unread = messages.filter((m: any) => m.recipient_id === userId && !m.is_read).map((m: any) => m.id);
    if (!unread.length) return;
    supabase.from("messages").update({ is_read: true } as any).in("id", unread).then(() => {});
  }, [userId, messages]);
}
