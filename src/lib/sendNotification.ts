import { supabase } from "@/integrations/supabase/client";

export type NotificationType =
  | "info" | "success" | "warning" | "error"
  | "note" | "message" | "absence" | "paiement"
  | "planning" | "examen" | "admin" | "systeme" | "visio";

export interface SendNotificationInput {
  user_id: string;
  title: string;
  message: string;
  type?: NotificationType;
  link?: string | null;
  institution_id?: string | null;
}

/**
 * sendNotification — API interne unifiée.
 * Insère la notification ; le trigger Realtime + le hook useNotificationCenter
 * gèrent automatiquement le son, la bulle et la notification navigateur.
 */
export const sendNotification = async (input: SendNotificationInput) => {
  const { error } = await supabase.from("notifications").insert({
    user_id: input.user_id,
    title: input.title,
    message: input.message,
    type: input.type || "info",
    link: input.link || null,
    institution_id: input.institution_id || null,
  } as any);
  if (error) throw error;
};

export const sendNotificationBatch = async (inputs: SendNotificationInput[]) => {
  if (!inputs.length) return;
  const rows = inputs.map((i) => ({
    user_id: i.user_id,
    title: i.title,
    message: i.message,
    type: i.type || "info",
    link: i.link || null,
    institution_id: i.institution_id || null,
  }));
  const { error } = await supabase.from("notifications").insert(rows as any);
  if (error) throw error;
};
