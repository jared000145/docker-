import { useEffect, useRef, useState } from "react";
import { resolveChatMediaUrl } from "@/lib/chatMedia";
import { cn } from "@/lib/utils";

const useMediaUrl = (value?: string | null, enabled = true) => {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    if (!value || !enabled) { setUrl(null); return; }
    resolveChatMediaUrl(value).then((u) => { if (active) setUrl(u); });
    return () => { active = false; };
  }, [enabled, value]);
  return url;
};

export const ChatAudio = ({ value, className }: { value?: string | null; className?: string }) => {
  const url = useMediaUrl(value);
  if (!value) return null;
  if (!url) return <p className="text-[11px] italic opacity-70 mt-1">Chargement du message vocal…</p>;
  return <audio controls preload="metadata" className={cn("chat-audio mt-2 h-10 w-full min-w-[210px] max-w-full", className)} src={url} />;
};

export const ChatImage = ({ value, className }: { value?: string | null; className?: string }) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const [nearViewport, setNearViewport] = useState(false);
  useEffect(() => {
    const node = hostRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setNearViewport(true); observer.disconnect(); }
    }, { rootMargin: "320px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const url = useMediaUrl(value, nearViewport);
  if (!value) return null;
  if (!url) return <div ref={hostRef} className="mt-2 h-32 w-48 max-w-full rounded-lg bg-muted animate-pulse" />;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer">
      <img
        src={url}
        alt="Image envoyée dans la conversation"
        loading="lazy"
        decoding="async"
        width={480}
        height={288}
        className={cn("mt-2 max-h-72 w-auto max-w-full rounded-lg border border-border object-cover shadow-sm", className)}
      />
    </a>
  );
};
