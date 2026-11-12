import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { pickAudioMimeType } from "@/lib/chatMedia";

export type RecorderStatus = "idle" | "recording" | "paused" | "preview";

/**
 * Enregistreur vocal avec pause/reprise, écoute avant envoi et suppression.
 */
export const useVoiceRecorder = () => {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [seconds, setSeconds] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<number | null>(null);

  const clearTimer = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const startTimer = () => {
    clearTimer();
    timerRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
  };

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const reset = useCallback(() => {
    clearTimer();
    stopStream();
    recorderRef.current = null;
    chunksRef.current = [];
    setSeconds(0);
    setBlob(null);
    setPreviewUrl((url) => {
      if (url) URL.revokeObjectURL(url);
      return null;
    });
    setStatus("idle");
  }, []);

  useEffect(() => () => { clearTimer(); stopStream(); }, []);

  const start = useCallback(async () => {
    if (typeof MediaRecorder === "undefined") {
      toast.error("Enregistrement non supporté par ce navigateur");
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickAudioMimeType();
      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const type = mr.mimeType || mimeType || "audio/webm";
        const b = new Blob(chunksRef.current, { type });
        stopStream();
        if (b.size === 0) {
          toast.error("Enregistrement vide");
          reset();
          return;
        }
        setBlob(b);
        setPreviewUrl(URL.createObjectURL(b));
        setStatus("preview");
      };
      mr.start();
      recorderRef.current = mr;
      streamRef.current = stream;
      setSeconds(0);
      setStatus("recording");
      startTimer();
      return true;
    } catch {
      toast.error("Microphone non disponible");
      return false;
    }
  }, [reset]);

  const pause = useCallback(() => {
    const mr = recorderRef.current;
    if (mr && mr.state === "recording") {
      mr.pause();
      clearTimer();
      setStatus("paused");
    }
  }, []);

  const resume = useCallback(() => {
    const mr = recorderRef.current;
    if (mr && mr.state === "paused") {
      mr.resume();
      startTimer();
      setStatus("recording");
    }
  }, []);

  const stop = useCallback(() => {
    const mr = recorderRef.current;
    clearTimer();
    if (mr && mr.state !== "inactive") mr.stop();
  }, []);

  const discard = useCallback(() => {
    const mr = recorderRef.current;
    if (mr && mr.state !== "inactive") {
      mr.onstop = () => { stopStream(); };
      mr.stop();
    }
    reset();
  }, [reset]);

  return { status, seconds, blob, previewUrl, start, pause, resume, stop, discard, reset };
};

export const formatDuration = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
