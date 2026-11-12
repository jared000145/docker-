import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, MessageCircle, Send, X, Volume2, VolumeX, Play, Pause, MoreHorizontal, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

interface Reel {
  id: string;
  author_id: string;
  content: string | null;
  video_url: string | null;
  image_url: string | null; // thumbnail
  created_at: string;
}

interface ReelsViewerProps {
  reels: Reel[];
  initialIndex: number;
  profileMap: Map<string, any>;
  onClose: () => void;
}

export const ReelsViewer = ({ reels, initialIndex, profileMap, onClose }: ReelsViewerProps) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [muted, setMuted] = useState(true);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showHeart, setShowHeart] = useState(false);
  const [expandedCaption, setExpandedCaption] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [lastTap, setLastTap] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const touchStartY = useRef<number | null>(null);

  const currentReel = reels[currentIndex];

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  // Likes for current reel
  const { data: likeData = { count: 0, liked: false } } = useQuery({
    queryKey: ["reel-likes", currentReel?.id, user?.id],
    queryFn: async () => {
      if (!currentReel) return { count: 0, liked: false };
      const [{ count }, { data: mine }] = await Promise.all([
        supabase.from("community_likes").select("*", { count: "exact", head: true }).eq("post_id", currentReel.id),
        user ? supabase.from("community_likes").select("id").eq("post_id", currentReel.id).eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      return { count: count || 0, liked: !!mine };
    },
    enabled: !!currentReel,
  });

  const { data: comments = [] } = useQuery({
    queryKey: ["reel-comments", currentReel?.id],
    queryFn: async () => {
      if (!currentReel) return [];
      const { data } = await supabase.from("community_comments").select("*").eq("post_id", currentReel.id).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!currentReel,
  });

  const likeMutation = useMutation({
    mutationFn: async () => {
      if (!user || !currentReel) return;
      if (likeData.liked) {
        await supabase.from("community_likes").delete().eq("post_id", currentReel.id).eq("user_id", user.id);
      } else {
        await supabase.from("community_likes").insert({ post_id: currentReel.id, user_id: user.id });
      }
    },
    onMutate: async () => {
      if (!currentReel) return;
      await qc.cancelQueries({ queryKey: ["reel-likes", currentReel.id, user?.id] });
      const previous = qc.getQueryData<{ count: number; liked: boolean }>(["reel-likes", currentReel.id, user?.id]) || likeData;
      qc.setQueryData(["reel-likes", currentReel.id, user?.id], {
        liked: !previous.liked,
        count: Math.max(0, previous.count + (previous.liked ? -1 : 1)),
      });
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (currentReel && context?.previous) qc.setQueryData(["reel-likes", currentReel.id, user?.id], context.previous);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["reel-likes", currentReel?.id] });
      qc.invalidateQueries({ queryKey: ["community-like-counts"] });
      qc.invalidateQueries({ queryKey: ["community-likes"] });
    },
  });

  const commentMutation = useMutation({
    mutationFn: async (text: string) => {
      if (!user || !currentReel || !text.trim()) return;
      await supabase.from("community_comments").insert({
        post_id: currentReel.id,
        author_id: user.id,
        content: text.trim(),
      });
    },
    onSuccess: () => {
      setCommentText("");
      qc.invalidateQueries({ queryKey: ["reel-comments", currentReel?.id] });
      qc.invalidateQueries({ queryKey: ["community-comments"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!currentReel) return;
      await supabase.from("community_comments").delete().eq("post_id", currentReel.id);
      await supabase.from("community_likes").delete().eq("post_id", currentReel.id);
      await supabase.from("community_posts").delete().eq("id", currentReel.id);
    },
    onSuccess: () => {
      toast.success("Reel supprimé");
      qc.invalidateQueries({ queryKey: ["community-posts"] });
      onClose();
    },
  });

  // Navigation
  const goNext = useCallback(() => {
    if (currentIndex < reels.length - 1) {
      setCurrentIndex((i) => i + 1);
      setExpandedCaption(false);
      setProgress(0);
      setPaused(false);
    }
  }, [currentIndex, reels.length]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
      setExpandedCaption(false);
      setProgress(0);
      setPaused(false);
    }
  }, [currentIndex]);

  // Play current, pause others; reset progress
  useEffect(() => {
    videoRefs.current.forEach((v, i) => {
      if (!v) return;
      if (i === currentIndex) {
        v.currentTime = 0;
        v.muted = muted;
        if (!paused) v.play().catch(() => { /* autoplay may need interaction */ });
      } else {
        v.pause();
        v.currentTime = 0;
      }
    });
  }, [currentIndex, muted, paused]);

  // Update progress for current video
  useEffect(() => {
    const v = videoRefs.current[currentIndex];
    if (!v) return;
    const onTime = () => {
      if (v.duration) setProgress((v.currentTime / v.duration) * 100);
    };
    const onEnd = () => goNext();
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("ended", onEnd);
    return () => {
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("ended", onEnd);
    };
  }, [currentIndex, goNext]);

  // Wheel navigation (desktop)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let throttle = false;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (throttle) return;
      throttle = true;
      setTimeout(() => { throttle = false; }, 600);
      if (e.deltaY > 0) goNext();
      else if (e.deltaY < 0) goPrev();
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [goNext, goPrev]);

  // Keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") goNext();
      else if (e.key === "ArrowUp") goPrev();
      else if (e.key === "Escape") onClose();
      else if (e.key === " ") {
        e.preventDefault();
        setPaused((p) => !p);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, goPrev, onClose]);

  // Touch gestures
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const deltaY = touchStartY.current - e.changedTouches[0].clientY;
    if (Math.abs(deltaY) > 60) {
      if (deltaY > 0) goNext();
      else goPrev();
    }
    touchStartY.current = null;
  };

  const handleTap = () => {
    const now = Date.now();
    if (now - lastTap < 300) {
      // Double tap = like
      if (!likeData.liked) likeMutation.mutate();
      setShowHeart(true);
      setTimeout(() => setShowHeart(false), 800);
    } else {
      // Single tap = play/pause
      setPaused((p) => !p);
    }
    setLastTap(now);
  };

  // Pre-load adjacent reels only (must be declared before any early return)
  const renderRange = useMemo(() => {
    const start = Math.max(0, currentIndex - 1);
    const end = Math.min(reels.length - 1, currentIndex + 1);
    return { start, end };
  }, [currentIndex, reels.length]);

  if (!currentReel) return null;

  const author: any = profileMap.get(currentReel.author_id);
  const initials = author ? `${author.first_name?.[0] || ""}${author.last_name?.[0] || ""}`.toUpperCase() : "?";
  const isOwn = currentReel.author_id === user?.id;
  const caption = currentReel.content || "";
  const longCaption = caption.length > 80;

  // Render hashtags
  const renderCaption = (text: string) => {
    return text.split(/(#[\p{L}0-9_]+)/gu).map((part, i) =>
      part.startsWith("#") ? (
        <span key={i} className="text-accent font-medium">{part}</span>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black"
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 left-4 z-50 w-10 h-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/60 transition-colors"
        aria-label="Fermer"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Mute button */}
      <button
        onClick={() => setMuted((m) => !m)}
        className="absolute top-4 right-4 z-50 w-10 h-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/60 transition-colors"
        aria-label={muted ? "Activer le son" : "Couper le son"}
      >
        {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
      </button>

      {/* Reel indicator */}
      <div className="absolute top-5 left-1/2 -translate-x-1/2 z-50 text-white/70 text-xs font-medium">
        {currentIndex + 1} / {reels.length}
      </div>

      {/* Vertical reel container */}
      <div
        ref={containerRef}
        className="relative w-full h-full overflow-hidden"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <AnimatePresence initial={false} mode="popLayout">
          <motion.div
            key={currentReel.id}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "-100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 35 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            {/* Video stack: render only nearby for perf */}
            {reels.map((r, idx) => {
              if (idx < renderRange.start || idx > renderRange.end) return null;
              if (idx !== currentIndex) return null; // only show active in view
              return (
                <div
                  key={r.id}
                  className="absolute inset-0 w-full h-full flex items-center justify-center"
                  onClick={handleTap}
                >
                  <video
                    ref={(el) => { videoRefs.current[idx] = el; }}
                    src={r.video_url || undefined}
                    poster={r.image_url || undefined}
                    className="max-w-full max-h-full object-contain bg-black"
                    playsInline
                    loop={false}
                    autoPlay
                    muted={muted}
                    preload="auto"
                  />
                </div>
              );
            })}

            {/* Pre-load next & prev (hidden) */}
            {reels.map((r, idx) => {
              if (idx === currentIndex) return null;
              if (idx < renderRange.start || idx > renderRange.end) return null;
              return (
                <video
                  key={`pre-${r.id}`}
                  ref={(el) => { videoRefs.current[idx] = el; }}
                  src={r.video_url || undefined}
                  className="hidden"
                  preload="auto"
                  muted
                  playsInline
                />
              );
            })}
          </motion.div>
        </AnimatePresence>

        {/* Progress bar */}
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-white/15 z-40">
          <div
            className="h-full bg-white transition-[width] duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Pause overlay */}
        <AnimatePresence>
          {paused && (
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none z-40"
            >
              <div className="w-20 h-20 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center">
                <Play className="w-10 h-10 text-white fill-white" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Double-tap heart */}
        <AnimatePresence>
          {showHeart && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1.3, opacity: 1 }}
              exit={{ scale: 1.6, opacity: 0 }}
              transition={{ duration: 0.6 }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none z-40"
            >
              <Heart className="w-32 h-32 text-destructive fill-destructive drop-shadow-2xl" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom gradient + caption + author */}
        <div className="absolute bottom-0 left-0 right-0 z-30 bg-gradient-to-t from-black/90 via-black/50 to-transparent pointer-events-none">
          <div className="flex items-end gap-2 p-4 pb-8 pr-20 pointer-events-auto">
            <div className="flex-1 min-w-0 text-white">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-[1.5px] rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600">
                  <Avatar className="w-9 h-9 ring-2 ring-black">
                    <AvatarImage src={author?.avatar_url || undefined} />
                    <AvatarFallback className="bg-secondary text-foreground text-[10px] font-bold">{initials}</AvatarFallback>
                  </Avatar>
                </div>
                <div className="leading-tight min-w-0">
                  <p className="text-sm font-semibold truncate">
                    {author ? `${author.first_name} ${author.last_name}` : "Anonyme"}
                  </p>
                  <p className="text-[11px] text-white/60">
                    {formatDistanceToNow(new Date(currentReel.created_at), { locale: fr, addSuffix: true })}
                  </p>
                </div>
                {isOwn && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="w-8 h-8 text-white/70 hover:bg-white/10 ml-auto">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-[hsl(225,40%,10%)] border-white/10 text-white">
                      <DropdownMenuItem onClick={() => deleteMutation.mutate()} className="text-destructive focus:bg-white/5">
                        <Trash2 className="w-4 h-4 mr-2" /> Supprimer
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
              {caption && (
                <div className="text-sm leading-relaxed">
                  {!expandedCaption && longCaption ? (
                    <>
                      <span>{renderCaption(caption.slice(0, 80))}...</span>{" "}
                      <button
                        onClick={() => setExpandedCaption(true)}
                        className="text-white/70 font-medium"
                      >
                        plus
                      </button>
                    </>
                  ) : (
                    <span className="whitespace-pre-wrap">{renderCaption(caption)}</span>
                  )}
                  {expandedCaption && longCaption && (
                    <>
                      {" "}
                      <button
                        onClick={() => setExpandedCaption(false)}
                        className="text-white/70 font-medium"
                      >
                        moins
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right action rail */}
        <div className="absolute right-3 bottom-24 z-30 flex flex-col items-center gap-5">
          <button
            onClick={() => likeMutation.mutate()}
            className="flex flex-col items-center gap-1 group"
          >
            <div className="w-11 h-11 flex items-center justify-center">
              <Heart
                className={`w-8 h-8 transition-all drop-shadow-lg ${
                  likeData.liked
                    ? "text-destructive fill-destructive scale-110"
                    : "text-white group-active:scale-90"
                }`}
              />
            </div>
            <span className="text-white text-[11px] font-semibold drop-shadow-md">
              {likeData.count}
            </span>
          </button>

          <button
            onClick={() => setCommentsOpen(true)}
            className="flex flex-col items-center gap-1 group"
          >
            <div className="w-11 h-11 flex items-center justify-center">
              <MessageCircle className="w-8 h-8 text-white drop-shadow-lg group-active:scale-90 transition-transform" />
            </div>
            <span className="text-white text-[11px] font-semibold drop-shadow-md">
              {comments.length}
            </span>
          </button>

          <button
            onClick={() => {
              navigator.clipboard.writeText(`${window.location.origin}/community#${currentReel.id}`);
              toast.success("Lien copié !");
            }}
            className="flex flex-col items-center gap-1 group"
          >
            <div className="w-11 h-11 flex items-center justify-center">
              <Send className="w-8 h-8 text-white drop-shadow-lg group-active:scale-90 transition-transform" />
            </div>
            <span className="text-white text-[11px] font-semibold drop-shadow-md">Partager</span>
          </button>

          {/* Author avatar mini */}
          <div className="mt-2">
            <Avatar className="w-9 h-9 ring-2 ring-white/40">
              <AvatarImage src={author?.avatar_url || undefined} />
              <AvatarFallback className="bg-secondary text-foreground text-[10px] font-bold">{initials}</AvatarFallback>
            </Avatar>
          </div>
        </div>

        {/* Up/down nav hints (desktop) */}
        <div className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 z-30 flex-col gap-2">
          <button
            onClick={goPrev}
            disabled={currentIndex === 0}
            className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md text-white disabled:opacity-30 hover:bg-white/20 transition-colors flex items-center justify-center rotate-180"
            aria-label="Précédent"
          >
            ▼
          </button>
          <button
            onClick={goNext}
            disabled={currentIndex === reels.length - 1}
            className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md text-white disabled:opacity-30 hover:bg-white/20 transition-colors flex items-center justify-center"
            aria-label="Suivant"
          >
            ▼
          </button>
        </div>
      </div>

      {/* Comments sheet */}
      <Sheet open={commentsOpen} onOpenChange={setCommentsOpen}>
        <SheetContent
          side="bottom"
          className="bg-[hsl(225,40%,8%)] border-white/10 text-white h-[70vh] rounded-t-2xl p-0 flex flex-col"
        >
          <SheetHeader className="p-4 border-b border-white/10">
            <SheetTitle className="text-white text-base">
              {comments.length} commentaire{comments.length > 1 ? "s" : ""}
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {comments.length === 0 && (
              <p className="text-center text-white/50 text-sm py-8">
                Soyez le premier à commenter !
              </p>
            )}
            {comments.map((c: any) => {
              const ca: any = profileMap.get(c.author_id);
              const cini = ca ? `${ca.first_name?.[0] || ""}${ca.last_name?.[0] || ""}`.toUpperCase() : "?";
              return (
                <div key={c.id} className="flex gap-2.5">
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={ca?.avatar_url || undefined} />
                    <AvatarFallback className="bg-secondary text-foreground text-[10px] font-bold">{cini}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="bg-white/[0.04] rounded-2xl px-3 py-2">
                      <p className="text-[12px] font-semibold text-white">
                        {ca ? `${ca.first_name} ${ca.last_name}` : "Anonyme"}
                      </p>
                      <p className="text-[13px] text-white/90 break-words whitespace-pre-wrap">{c.content}</p>
                    </div>
                    <p className="text-[10px] text-white/40 mt-0.5 px-2">
                      {formatDistanceToNow(new Date(c.created_at), { locale: fr, addSuffix: true })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="p-3 border-t border-white/10 flex items-center gap-2">
            <input
              placeholder="Ajouter un commentaire..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && commentText.trim()) commentMutation.mutate(commentText);
              }}
              className="flex-1 bg-white/[0.04] border border-white/10 rounded-full px-4 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:border-accent"
            />
            <Button
              size="sm"
              onClick={() => commentMutation.mutate(commentText)}
              disabled={!commentText.trim() || commentMutation.isPending}
              className="rounded-full gradient-gold text-accent-foreground"
            >
              Publier
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </motion.div>
  );
};
