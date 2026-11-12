import { supabase } from "@/integrations/supabase/client";

export const CHAT_BUCKET = "chat-media";

/** Fenêtre d'édition d'un message : 20 minutes après l'envoi. */
export const EDIT_WINDOW_MS = 20 * 60 * 1000;

export const canEditMessage = (m: { created_at: string; deleted_for_everyone?: boolean }) =>
  !m.deleted_for_everyone && Date.now() - new Date(m.created_at).getTime() < EDIT_WINDOW_MS;

export const remainingEditMs = (m: { created_at: string }) =>
  Math.max(0, EDIT_WINDOW_MS - (Date.now() - new Date(m.created_at).getTime()));

const SIGNED_URL_TTL_SECONDS = 60 * 60;
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();
const pendingSignedUrls = new Map<string, Promise<string | null>>();

/** Un message masqué "pour moi" ne doit plus apparaître dans ma liste. */
export const isHiddenForUser = (m: any, userId?: string) =>
  !!userId && Array.isArray(m?.deleted_for) && m.deleted_for.includes(userId);

const extFromType = (type: string, fallback: string) => {
  const map: Record<string, string> = {
    "audio/webm": "webm",
    "audio/mp4": "m4a",
    "audio/ogg": "ogg",
    "audio/mpeg": "mp3",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
  };
  return map[type] || fallback;
};

/** Choisit un format audio réellement supporté par le navigateur. */
export const pickAudioMimeType = () => {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) || "";
};

/**
 * Envoie un fichier de discussion dans le bucket privé et renvoie son chemin
 * (stocké tel quel en base ; l'URL signée est générée à l'affichage).
 */
export async function uploadChatMedia(
  senderId: string,
  recipientId: string,
  file: Blob,
  kind: "audio" | "image",
  mimeType?: string
): Promise<string> {
  const type = mimeType || (file as File).type || (kind === "audio" ? "audio/webm" : "image/jpeg");
  const ext = extFromType(type, kind === "audio" ? "webm" : "jpg");
  const path = `${senderId}/${recipientId || "broadcast"}/${kind}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(CHAT_BUCKET).upload(path, file, {
    contentType: type,
    upsert: false,
  });
  if (error) throw error;
  return path;
}

/** Réduit les photos lourdes avant leur envoi, sans modifier les GIF animés. */
export async function optimizeChatImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif" || file.size < 350_000) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const maxEdge = 1920;
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) { bitmap.close(); return file; }
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.82));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, ".webp"), { type: "image/webp", lastModified: file.lastModified });
  } catch {
    return file;
  }
}

/** Résout une valeur stockée : ancienne URL publique ou chemin du bucket privé. */
export async function resolveChatMediaUrl(value: string): Promise<string | null> {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  const cached = signedUrlCache.get(value);
  if (cached && cached.expiresAt > Date.now()) return cached.url;
  const pending = pendingSignedUrls.get(value);
  if (pending) return pending;

  const request = supabase.storage.from(CHAT_BUCKET).createSignedUrl(value, SIGNED_URL_TTL_SECONDS)
    .then(({ data, error }) => {
      const url = error ? null : data?.signedUrl ?? null;
      if (url) signedUrlCache.set(value, { url, expiresAt: Date.now() + (SIGNED_URL_TTL_SECONDS - 120) * 1000 });
      return url;
    })
    .finally(() => pendingSignedUrls.delete(value));
  pendingSignedUrls.set(value, request);
  return request;
}
