import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight, Trash2, Heart, Send, Eye } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export interface Story {
  id: string;
  user_id: string;
  media_url: string;
  media_type: "image" | "video";
  description?: string | null;
  created_at: string;
  expires_at: string;
}

export interface UserStoriesGroup {
  user_id: string;
  profile: { first_name: string; last_name: string; avatar_url: string | null } | null;
  stories: Story[];
}

interface StoryViewerProps {
  groups: UserStoriesGroup[];
  initialGroupIndex: number;
  onClose: () => void;
}

const IMAGE_DURATION = 9000;

export const StoryViewer = ({ groups, initialGroupIndex, onClose }: StoryViewerProps) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [groupIndex, setGroupIndex] = useState(initialGroupIndex);
  const [storyIndex, setStoryIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [replyFocused, setReplyFocused] = useState(false);
  const [replyText, setReplyText] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const startTimeRef = useRef<number>(Date.now());
  const elapsedRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);
  const timerFrozenRef = useRef(false);

  const currentGroup = groups[groupIndex];
  const currentStory = currentGroup?.stories[storyIndex];
  const isReplying = replyFocused || replyText.trim().length > 0;

  const { data: storyStats = { likes: 0, liked: false, views: 0 } } = useQuery({
    queryKey: ["story-stats", currentStory?.id, user?.id],
    queryFn: async () => {
      if (!currentStory) return { likes: 0, liked: false, views: 0 };
      const canViewViews = currentStory.user_id === user?.id;
      const [{ count: likes }, { data: mine }, viewsResult] = await Promise.all([
        (supabase as any).from("story_likes").select("*", { count: "exact", head: true }).eq("story_id", currentStory.id),
        user ? (supabase as any).from("story_likes").select("id").eq("story_id", currentStory.id).eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null }),
        canViewViews
          ? (supabase as any).from("story_views").select("*", { count: "exact", head: true }).eq("story_id", currentStory.id)
          : Promise.resolve({ count: 0 }),
      ]);
      return { likes: likes || 0, liked: !!mine, views: viewsResult.count || 0 };
    },
    enabled: !!currentStory,
  });

  const goNextStory = () => {
    if (!currentGroup) return;
    if (storyIndex < currentGroup.stories.length - 1) {
      setStoryIndex(storyIndex + 1);
      resetProgress();
    } else if (groupIndex < groups.length - 1) {
      setGroupIndex(groupIndex + 1);
      setStoryIndex(0);
      resetProgress();
    } else {
      onClose();
    }
  };

  const goPrevStory = () => {
    if (storyIndex > 0) {
      setStoryIndex(storyIndex - 1);
      resetProgress();
    } else if (groupIndex > 0) {
      const prevGroup = groups[groupIndex - 1];
      setGroupIndex(groupIndex - 1);
      setStoryIndex(prevGroup.stories.length - 1);
      resetProgress();
    }
  };

  const resetProgress = () => {
    setProgress(0);
    elapsedRef.current = 0;
    startTimeRef.current = Date.now();
  };

  // Progress loop
  useEffect(() => {
    if (!currentStory) return;
    resetProgress();

    if (currentStory.media_type === "image") {
      const tick = () => {
        if (timerFrozenRef.current) {
          startTimeRef.current = Date.now();
          rafRef.current = requestAnimationFrame(tick);
          return;
        }
        const elapsed = elapsedRef.current + (Date.now() - startTimeRef.current);
        const pct = Math.min((elapsed / IMAGE_DURATION) * 100, 100);
        setProgress(pct);
        if (pct >= 100) {
          goNextStory();
          return;
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      startTimeRef.current = Date.now();
      rafRef.current = requestAnimationFrame(tick);
    }

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStory?.id]);

  // Pause/resume tracking elapsed
  useEffect(() => {
    const frozen = paused || isReplying;
    timerFrozenRef.current = frozen;
    if (frozen) {
      elapsedRef.current += Date.now() - startTimeRef.current;
    } else {
      startTimeRef.current = Date.now();
    }
  }, [paused, isReplying]);

  // Video handlers
  useEffect(() => {
    const v = videoRef.current;
    if (!v || currentStory?.media_type !== "video") return;

    const onTime = () => {
      if (v.duration) setProgress((v.currentTime / v.duration) * 100);
    };
    const onEnded = () => goNextStory();
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("ended", onEnded);

    if (paused || isReplying) v.pause();
    else v.play().catch(() => {});

    return () => {
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("ended", onEnded);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStory?.id, paused, isReplying]);

  useEffect(() => {
    if (!currentStory || !user) return;
    (supabase as any)
      .from("story_views")
      .upsert({ story_id: currentStory.id, user_id: user.id }, { onConflict: "story_id,user_id" })
      .then(() => {
        qc.invalidateQueries({ queryKey: ["story-stats", currentStory.id, user.id] });
        qc.invalidateQueries({ queryKey: ["story-views", user.id] });
      });
  }, [currentStory?.id, qc, user]);

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") goNextStory();
      else if (e.key === "ArrowLeft") goPrevStory();
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  });

  const deleteMutation = useMutation({
    mutationFn: async (storyId: string) => {
      const { error } = await supabase.from("stories").delete().eq("id", storyId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stories"] });
      toast.success("Story supprimée");
      goNextStory();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const likeMutation = useMutation({
    mutationFn: async () => {
      if (!currentStory || !user) return;
      if (storyStats.liked) {
        await (supabase as any).from("story_likes").delete().eq("story_id", currentStory.id).eq("user_id", user.id);
      } else {
        await (supabase as any).from("story_likes").insert({ story_id: currentStory.id, user_id: user.id });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["story-stats", currentStory?.id, user?.id] }),
  });

  const replyMutation = useMutation({
    mutationFn: async () => {
      if (!currentStory || !user || !replyText.trim()) return;
      await (supabase as any).from("story_replies").insert({
        story_id: currentStory.id,
        author_id: user.id,
        content: replyText.trim(),
      });
    },
    onSuccess: () => {
      setReplyText("");
      toast.success("Réponse envoyée");
      qc.invalidateQueries({ queryKey: ["story-stats", currentStory?.id, user?.id] });
    },
  });

  if (!currentGroup || !currentStory) return null;

  const initials = currentGroup.profile
    ? `${currentGroup.profile.first_name?.[0] || ""}${currentGroup.profile.last_name?.[0] || ""}`.toUpperCase()
    : "?";
  const isOwn = currentStory.user_id === user?.id;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black flex items-center justify-center"
      >
        {/* Tap zones */}
        <button
          onClick={goPrevStory}
          onMouseDown={() => setPaused(true)}
          onMouseUp={() => setPaused(false)}
          onTouchStart={() => setPaused(true)}
          onTouchEnd={() => setPaused(false)}
          className="absolute left-0 top-0 bottom-0 w-1/3 z-10"
          aria-label="Story précédente"
        />
        <button
          onClick={goNextStory}
          onMouseDown={() => setPaused(true)}
          onMouseUp={() => setPaused(false)}
          onTouchStart={() => setPaused(true)}
          onTouchEnd={() => setPaused(false)}
          className="absolute right-0 top-0 bottom-0 w-1/3 z-10"
          aria-label="Story suivante"
        />

        {/* Desktop arrows */}
        {groupIndex > 0 && (
          <button
            onClick={goPrevStory}
            className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white items-center justify-center z-20"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}
        {groupIndex < groups.length - 1 && (
          <button
            onClick={goNextStory}
            className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white items-center justify-center z-20"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}

        {/* Story container */}
        <div className="relative w-full max-w-md h-full md:h-[90vh] md:max-h-[800px] md:rounded-2xl overflow-hidden bg-neutral-900">
          {/* Progress bars */}
          <div className="absolute top-0 left-0 right-0 z-20 flex gap-1 p-2">
            {currentGroup.stories.map((_, i) => (
              <div key={i} className="flex-1 h-0.5 bg-white/30 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white transition-all"
                  style={{
                    width: i < storyIndex ? "100%" : i === storyIndex ? `${progress}%` : "0%",
                  }}
                />
              </div>
            ))}
          </div>

          {/* Header */}
          <div className="absolute top-4 left-0 right-0 z-20 px-3 pt-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Avatar className="w-8 h-8 ring-1 ring-white/40">
                <AvatarImage src={currentGroup.profile?.avatar_url || undefined} />
                <AvatarFallback className="bg-neutral-700 text-white text-[10px] font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="leading-tight">
                <p className="text-[13px] font-semibold text-white">
                  {currentGroup.profile
                    ? `${currentGroup.profile.first_name} ${currentGroup.profile.last_name}`
                    : "Anonyme"}
                </p>
                <p className="text-[11px] text-white/70">
                  {formatDistanceToNow(new Date(currentStory.created_at), { locale: fr, addSuffix: true })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 z-30">
              {isOwn && (
                <button
                  onClick={() => {
                    if (confirm("Supprimer cette story ?")) deleteMutation.mutate(currentStory.id);
                  }}
                  className="w-9 h-9 rounded-full hover:bg-white/10 text-white flex items-center justify-center"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={onClose}
                className="w-9 h-9 rounded-full hover:bg-white/10 text-white flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Media */}
          <div className="w-full h-full flex items-center justify-center">
            {currentStory.media_type === "image" ? (
              <img
                key={currentStory.id}
                src={currentStory.media_url}
                alt=""
                 decoding="async"
                className="max-w-full max-h-full object-contain"
                draggable={false}
              />
            ) : (
              <video
                key={currentStory.id}
                ref={videoRef}
                src={currentStory.media_url}
                autoPlay
                muted
                playsInline
                preload="auto"
                className="max-w-full max-h-full object-contain"
              />
            )}
          </div>

          <div className="absolute bottom-0 left-0 right-0 z-30 bg-gradient-to-t from-black/80 via-black/35 to-transparent px-3 pb-4 pt-16">
            {currentStory.description && (
              <p className="mb-3 max-w-[calc(100%-3.5rem)] whitespace-pre-wrap text-sm font-medium leading-relaxed text-white drop-shadow-md">
                {currentStory.description}
              </p>
            )}
            {!isOwn && (
              <div className="flex items-center gap-2 pr-12">
                <Input
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onFocus={() => setReplyFocused(true)}
                  onBlur={() => setReplyFocused(false)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && replyText.trim()) replyMutation.mutate();
                  }}
                  placeholder={`Répondre à ${currentGroup.profile?.first_name || "cette story"}...`}
                  className="h-11 rounded-full border-white/30 bg-white/10 text-white placeholder:text-white/60 backdrop-blur-md focus-visible:ring-white/30"
                />
                <button
                  onClick={() => replyMutation.mutate()}
                  disabled={!replyText.trim() || replyMutation.isPending}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-md disabled:opacity-40"
                  aria-label="Répondre"
                >
                  <Send className="h-5 w-5" />
                </button>
              </div>
            )}
          </div>

          <div className="absolute bottom-20 right-3 z-40 flex flex-col items-center gap-4 text-white">
            <button onClick={() => likeMutation.mutate()} className="flex flex-col items-center gap-1" aria-label="Aimer la story">
              <Heart className={`h-7 w-7 drop-shadow-lg ${storyStats.liked ? "fill-destructive text-destructive" : "text-white"}`} />
              <span className="text-[11px] font-semibold drop-shadow-md">{storyStats.likes}</span>
            </button>
            {isOwn && (
              <div className="flex flex-col items-center gap-1" aria-label="Vues">
                <Eye className="h-7 w-7 drop-shadow-lg" />
                <span className="text-[11px] font-semibold drop-shadow-md">{storyStats.views}</span>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
