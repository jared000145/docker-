import {resolvePrivateMedia} from "@/lib/privateMedia";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, MessageCircle, Send, ImagePlus, Smile, MoreHorizontal, Trash2, Bookmark, Camera, PlusSquare, Bell, MessageSquare, Flame, Star, Award, Search, TrendingUp, Sparkles, Users as UsersIcon, Hash, X, Film, Play, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useInstitution } from "@/hooks/useInstitution";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { useCallback, useEffect, useState, useRef, useMemo } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { StoryCreator } from "@/components/community/StoryCreator";
import { StoryViewer, type UserStoriesGroup } from "@/components/community/StoryViewer";
import { VideoPostCreator } from "@/components/community/VideoPostCreator";
import { ReelsViewer } from "@/components/community/ReelsViewer";

const EMOJI_LIST = ["❤️", "😂", "😮", "😢", "😡", "👍", "👏", "🔥", "🎉", "💯", "🙏", "💪", "✨", "😍", "🥰", "😎", "🤔", "😤", "🥳", "💀", "😭", "🫡", "🤝", "💕"];
const QUICK_REACTIONS = ["❤️", "🔥", "😂", "😮", "😍", "👏"];

const WEEKLY_CHALLENGES = [
  "Montre ton meilleur moment sur le campus",
  "Partage une astuce qui aide les étudiants",
  "Publie une photo de ton groupe ou ta classe",
  "Raconte une réussite de la semaine",
  "Partage ton coin préféré de l’établissement",
  "Présente une activité, un club ou un talent",
  "Publie un souvenir drôle ou motivant",
];

const getWeekStart = (date: Date) => {
  const d = new Date(date);
  const day = d.getDay() || 7;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day + 1);
  return d;
};

const getWeekIndex = (date: Date) => Math.floor(getWeekStart(date).getTime() / (7 * 24 * 60 * 60 * 1000));

const formatShortDate = (date: Date) => date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });

// Anti-spam / contenu adulte (filtre invisible)
const FORBIDDEN_PATTERNS = [
  /\b(porn|xxx|sexe|nude|nudes|escort|viagra|casino)\b/i,
  /(https?:\/\/[^\s]+){4,}/i,
  /(.)\1{15,}/i,
];
const isForbidden = (txt: string) => FORBIDDEN_PATTERNS.some((r) => r.test(txt));

// Hashtag rendering
const renderWithHashtags = (text: string) => {
  const parts = text.split(/(#[\p{L}0-9_]+)/gu);
  return parts.map((part, i) =>
    part.startsWith("#") ? (
      <span key={i} className="text-primary font-medium hover:underline cursor-pointer">{part}</span>
    ) : (
      <span key={i}>{part}</span>
    )
  );
};

type FeedFilter = "all" | "trending" | "saved" | "reels";

const CommunityPage = () => {
  const { user } = useAuth();
  const { institution } = useInstitution();
  const qc = useQueryClient();
  const [newContent, setNewContent] = useState("");
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [commentText, setCommentText] = useState<Record<string, string>>({});
  const [showComments, setShowComments] = useState<Record<string, boolean>>({});
  const [showNewPost, setShowNewPost] = useState(false);
  const [showStoryCreator, setShowStoryCreator] = useState(false);
  const [showVideoCreator, setShowVideoCreator] = useState(false);
  const [reelsViewerIndex, setReelsViewerIndex] = useState<number | null>(null);
  const [viewerGroupIndex, setViewerGroupIndex] = useState<number | null>(null);
  const [feedFilter, setFeedFilter] = useState<FeedFilter>("all");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null);
  const [storyRepliesOpen, setStoryRepliesOpen] = useState(false);
  const autoPlayVideosRef = useRef(new Map<string, HTMLVideoElement>());
  const soundUnlockedRef = useRef(false);

  const registerAutoPlayVideo = useCallback((id: string) => (node: HTMLVideoElement | null) => {
    if (node) autoPlayVideosRef.current.set(id, node);
    else autoPlayVideosRef.current.delete(id);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const video = entry.target as HTMLVideoElement;
          if (entry.isIntersecting) {
            video.muted = !soundUnlockedRef.current;
            video.play().catch(() => undefined);
          } else {
            video.pause();
            video.currentTime = 0;
          }
        });
      },
      { threshold: 0.58, rootMargin: "-12% 0px -18% 0px" }
    );

    autoPlayVideosRef.current.forEach((video) => observer.observe(video));
    return () => observer.disconnect();
  });

  useEffect(() => {
    const unlockSound = () => {
      soundUnlockedRef.current = true;
      autoPlayVideosRef.current.forEach((video) => {
        video.muted = false;
        if (!video.paused) video.play().catch(() => undefined);
      });
    };

    window.addEventListener("pointerdown", unlockSound, { once: true });
    window.addEventListener("keydown", unlockSound, { once: true });
    window.addEventListener("touchstart", unlockSound, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlockSound);
      window.removeEventListener("keydown", unlockSound);
      window.removeEventListener("touchstart", unlockSound);
    };
  }, []);

  useRealtimeSubscription("community_posts", [["community-posts"]]);
  useRealtimeSubscription("community_comments", [["community-comments"]]);
  useRealtimeSubscription("community_likes", [["community-likes", user?.id || ""], ["community-like-counts"]]);
  useRealtimeSubscription("community_reactions", [["community-reactions"]]);
  useRealtimeSubscription("community_bookmarks", [["community-bookmarks", user?.id || ""]]);
  useRealtimeSubscription("community_comment_likes", [["community-comment-likes"]]);
  useRealtimeSubscription("stories", [["stories"]]);
  useRealtimeSubscription("story_replies", [["story-replies", user?.id || ""]]);

  const instId = institution?.id;
  const { data: posts = [], isLoading: postsLoading } = useQuery({
    queryKey: ["community-posts", instId],
    queryFn: async () => {
      let q = supabase.from("community_posts").select("*").order("created_at", { ascending: false }).limit(50);
      if (instId) q = q.eq("institution_id", instId);
      const { data, error } = await q;
      if (error) throw error;
      return await Promise.all((data || []).map(async post => ({...post,image_url:await resolvePrivateMedia(post.image_url)})));
    },
    enabled: !!user,
  });

  const { data: likes = [] } = useQuery({
    queryKey: ["community-likes", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("community_likes").select("post_id").eq("user_id", user!.id);
      return data?.map((l: any) => l.post_id) || [];
    },
    enabled: !!user,
  });

  const { data: allLikeCounts = {} } = useQuery({
    queryKey: ["community-like-counts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("community_likes").select("post_id");
      if (error) throw error;
      const counts: Record<string, number> = {};
      data?.forEach((l: any) => { counts[l.post_id] = (counts[l.post_id] || 0) + 1; });
      return counts;
    },
    enabled: !!user,
  });

  const { data: allComments = [] } = useQuery({
    queryKey: ["community-comments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("community_comments").select("*").order("created_at");
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Bookmarks
  const { data: bookmarks = [] } = useQuery({
    queryKey: ["community-bookmarks", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("community_bookmarks").select("post_id").eq("user_id", user!.id);
      return data?.map((b: any) => b.post_id) || [];
    },
    enabled: !!user,
  });

  // Reactions
  const { data: allReactions = [] } = useQuery({
    queryKey: ["community-reactions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("community_reactions").select("*");
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Comment likes
  const { data: commentLikes = [] } = useQuery({
    queryKey: ["community-comment-likes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("community_comment_likes").select("*");
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const { data: studentIds = [] } = useQuery({
    queryKey: ["community-student-ids"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("user_id").eq("role", "user");
      if (error) throw error;
      return data?.map((r: any) => r.user_id) || [];
    },
    enabled: !!user,
  });

  const { data: filieres = [] } = useQuery({
    queryKey: ["community-filieres"],
    queryFn: async () => { const { data, error } = await supabase.from("filieres").select("id, name"); if (error) throw error; return data || []; },
    enabled: !!user,
  });
  const filiereMap = useMemo(() => new Map(filieres.map((f: any) => [f.id, f.name])), [filieres]);

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-community", instId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("community_directory");
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });
  const profileMap = useMemo(() => new Map(profiles.map((p: any) => [p.user_id, p])), [profiles]);

  // Notifications non lues
  const { data: unreadNotifs = 0 } = useQuery({
    queryKey: ["community-unread-notifs", user?.id],
    queryFn: async () => {
      const { count } = await supabase.from("notifications").select("*", { count: "exact", head: true }).eq("user_id", user!.id).eq("is_read", false);
      return count || 0;
    },
    enabled: !!user,
  });
  const { data: unreadMsgs = 0 } = useQuery({
    queryKey: ["community-unread-msgs", user?.id],
    queryFn: async () => {
      const { count } = await supabase.from("messages").select("*", { count: "exact", head: true }).eq("recipient_id", user!.id).eq("is_read", false);
      return count || 0;
    },
    enabled: !!user,
  });

  const { data: stories = [] } = useQuery({
    queryKey: ["stories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stories").select("*")
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const { data: viewedStoryIds = [] } = useQuery({
    queryKey: ["story-views", user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("story_views")
        .select("story_id")
        .eq("user_id", user!.id);
      if (error) throw error;
      return data?.map((v: any) => v.story_id) || [];
    },
    enabled: !!user,
  });

  const viewedStorySet = useMemo(() => new Set(viewedStoryIds), [viewedStoryIds]);

  const storyGroups: UserStoriesGroup[] = useMemo(() => {
    const map = new Map<string, UserStoriesGroup>();
    for (const s of stories as any[]) {
      const existing = map.get(s.user_id);
      if (existing) existing.stories.push(s);
      else map.set(s.user_id, { user_id: s.user_id, profile: profileMap.get(s.user_id) as any || null, stories: [s] });
    }
    const arr = Array.from(map.values());
    arr.sort((a, b) => {
      if (a.user_id === user?.id) return -1;
      if (b.user_id === user?.id) return 1;
      return 0;
    });
    return arr;
  }, [stories, profileMap, user?.id]);

  const myStoryGroup = storyGroups.find((g) => g.user_id === user?.id);
  const otherStoryGroups = storyGroups.filter((g) => g.user_id !== user?.id);
  const isStudent = !!user && studentIds.includes(user.id);

  const myStoryIds = useMemo(
    () => (stories as any[]).filter((s) => s.user_id === user?.id).map((s) => s.id),
    [stories, user?.id]
  );

  const { data: storyReplies = [] } = useQuery({
    queryKey: ["story-replies", user?.id, myStoryIds.join(",")],
    queryFn: async () => {
      if (myStoryIds.length === 0) return [];
      const { data, error } = await (supabase as any)
        .from("story_replies")
        .select("id, story_id, author_id, content, created_at")
        .in("story_id", myStoryIds)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && myStoryIds.length > 0,
  });

  const recentStoryReplies = useMemo(() => {
    return (storyReplies as any[]).map((reply) => ({
      ...reply,
      author: profileMap.get(reply.author_id) as any,
      story: (stories as any[]).find((story) => story.id === reply.story_id),
    }));
  }, [storyReplies, profileMap, stories]);

  // Réactions groupées par post
  const reactionsByPost = useMemo(() => {
    const map: Record<string, { emoji: string; count: number; mine: boolean }[]> = {};
    for (const r of allReactions as any[]) {
      if (!map[r.post_id]) map[r.post_id] = [];
      const existing = map[r.post_id].find((x) => x.emoji === r.emoji);
      if (existing) {
        existing.count++;
        if (r.user_id === user?.id) existing.mine = true;
      } else {
        map[r.post_id].push({ emoji: r.emoji, count: 1, mine: r.user_id === user?.id });
      }
    }
    Object.values(map).forEach((arr) => arr.sort((a, b) => b.count - a.count));
    return map;
  }, [allReactions, user?.id]);

  // Comment likes map
  const commentLikeCounts = useMemo(() => {
    const map: Record<string, { count: number; mine: boolean }> = {};
    for (const cl of commentLikes as any[]) {
      if (!map[cl.comment_id]) map[cl.comment_id] = { count: 0, mine: false };
      map[cl.comment_id].count++;
      if (cl.user_id === user?.id) map[cl.comment_id].mine = true;
    }
    return map;
  }, [commentLikes, user?.id]);

  // Tendances : top hashtags
  const trendingHashtags = useMemo(() => {
    const counts: Record<string, number> = {};
    posts.forEach((p: any) => {
      const tags = (p.content || "").match(/#[\p{L}0-9_]+/gu) || [];
      tags.forEach((t: string) => { counts[t.toLowerCase()] = (counts[t.toLowerCase()] || 0) + 1; });
    });
    return Object.entries(counts).sort(([, a], [, b]) => b - a).slice(0, 5);
  }, [posts]);

  // Suggestions à découvrir : étudiants même filière + niveau, exclusion soi
  const suggestions = useMemo(() => {
    const me: any = user ? profileMap.get(user.id) : null;
    if (!me || !isStudent) return [];
    return profiles
      .filter((p: any) => p.user_id !== user?.id && p.filiere_id === me.filiere_id && p.level === me.level && studentIds.includes(p.user_id))
      .slice(0, 8);
  }, [profiles, profileMap, user?.id, isStudent, studentIds]);

  // Feed filtré
  // Reels: posts with a video_url
  const reelsList = useMemo(() => {
    return (posts as any[]).filter((p) => !!p.video_url);
  }, [posts]);

  const filteredPosts = useMemo(() => {
    let arr = [...posts];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      arr = arr.filter((p: any) => {
        const author: any = profileMap.get(p.author_id);
        const name = author ? `${author.first_name} ${author.last_name}`.toLowerCase() : "";
        return (p.content || "").toLowerCase().includes(q) || name.includes(q);
      });
    }
    if (feedFilter === "trending") {
      arr.sort((a: any, b: any) => {
        const sa = (allLikeCounts as any)[a.id] || 0;
        const sb = (allLikeCounts as any)[b.id] || 0;
        const ra = (reactionsByPost[a.id] || []).reduce((s, x) => s + x.count, 0);
        const rb = (reactionsByPost[b.id] || []).reduce((s, x) => s + x.count, 0);
        return (sb + rb) - (sa + ra);
      });
    } else if (feedFilter === "saved") {
      arr = arr.filter((p: any) => bookmarks.includes(p.id));
    } else if (feedFilter === "reels") {
      arr = arr.filter((p: any) => !!p.video_url);
    }
    return arr;
  }, [posts, feedFilter, searchQuery, profileMap, allLikeCounts, reactionsByPost, bookmarks]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const postMutation = useMutation({
    mutationFn: async () => {
      if (newContent && isForbidden(newContent)) throw new Error("Contenu non autorisé détecté.");
      let imageUrl: string | null = null;
      if (selectedFile && user) {
        setUploading(true);
        const ext = selectedFile.name.split(".").pop();
        const path = `${user.id}/community/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("media").upload(path, selectedFile);
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from("media").getPublicUrl(path);
        imageUrl = "media:" + path;
      }
      const { error } = await supabase.from("community_posts").insert({
        author_id: user!.id, content: newContent, image_url: imageUrl,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["community-posts"] });
      setNewContent(""); setSelectedFile(null); setPreviewUrl(null); setUploading(false); setShowNewPost(false);
      toast.success("Publié !");
    },
    onError: (e: any) => { setUploading(false); toast.error(e.message); },
  });

  const likeMutation = useMutation({
    mutationFn: async (postId: string) => {
      if (likes.includes(postId)) {
        await supabase.from("community_likes").delete().eq("post_id", postId).eq("user_id", user!.id);
      } else {
        await supabase.from("community_likes").insert({ post_id: postId, user_id: user!.id });
      }
    },
    onMutate: async (postId) => {
      await Promise.all([
        qc.cancelQueries({ queryKey: ["community-likes", user?.id] }),
        qc.cancelQueries({ queryKey: ["community-like-counts"] }),
      ]);
      const previousLikes = qc.getQueryData<string[]>(["community-likes", user?.id]) || likes;
      const previousCounts = qc.getQueryData<Record<string, number>>(["community-like-counts"]) || allLikeCounts as Record<string, number>;
      const wasLiked = previousLikes.includes(postId);

      qc.setQueryData<string[]>(["community-likes", user?.id], wasLiked ? previousLikes.filter((id) => id !== postId) : [...previousLikes, postId]);
      qc.setQueryData<Record<string, number>>(["community-like-counts"], {
        ...previousCounts,
        [postId]: Math.max(0, (previousCounts[postId] || 0) + (wasLiked ? -1 : 1)),
      });

      return { previousLikes, previousCounts };
    },
    onError: (_error, _postId, context) => {
      if (!context) return;
      qc.setQueryData(["community-likes", user?.id], context.previousLikes);
      qc.setQueryData(["community-like-counts"], context.previousCounts);
    },
    onSettled: () => { qc.invalidateQueries({ queryKey: ["community-likes"] }); qc.invalidateQueries({ queryKey: ["community-like-counts"] }); },
  });

  const reactionMutation = useMutation({
    mutationFn: async ({ postId, emoji }: { postId: string; emoji: string }) => {
      const existing = (allReactions as any[]).find((r) => r.post_id === postId && r.user_id === user!.id && r.emoji === emoji);
      if (existing) {
        await supabase.from("community_reactions").delete().eq("id", existing.id);
      } else {
        await supabase.from("community_reactions").insert({ post_id: postId, user_id: user!.id, emoji });
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["community-reactions"] }); setShowReactionPicker(null); },
  });

  const bookmarkMutation = useMutation({
    mutationFn: async (postId: string) => {
      if (bookmarks.includes(postId)) {
        await supabase.from("community_bookmarks").delete().eq("post_id", postId).eq("user_id", user!.id);
        return false;
      } else {
        await supabase.from("community_bookmarks").insert({ post_id: postId, user_id: user!.id });
        return true;
      }
    },
    onSuccess: (added) => {
      qc.invalidateQueries({ queryKey: ["community-bookmarks"] });
      toast.success(added ? "Publication enregistrée" : "Retiré des signets");
    },
  });

  const commentLikeMutation = useMutation({
    mutationFn: async (commentId: string) => {
      const existing = (commentLikes as any[]).find((cl) => cl.comment_id === commentId && cl.user_id === user!.id);
      if (existing) {
        await supabase.from("community_comment_likes").delete().eq("id", existing.id);
      } else {
        await supabase.from("community_comment_likes").insert({ comment_id: commentId, user_id: user!.id });
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["community-comment-likes"] }); },
  });

  const commentMutation = useMutation({
    mutationFn: async (postId: string) => {
      const text = commentText[postId];
      if (!text) return;
      if (isForbidden(text)) throw new Error("Commentaire bloqué (contenu non autorisé).");
      const {error}=await supabase.from("community_comments").insert({ post_id: postId, author_id: user!.id, content: text });if(error)throw error;
    },
    onSuccess: (_, postId) => {
      qc.invalidateQueries({ queryKey: ["community-comments"] });
      setCommentText({ ...commentText, [postId]: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deletePostMutation = useMutation({
    mutationFn: async (postId: string) => {
      await supabase.from("community_comments").delete().eq("post_id", postId);
      await supabase.from("community_likes").delete().eq("post_id", postId);
      await supabase.from("community_reactions").delete().eq("post_id", postId);
      await supabase.from("community_bookmarks").delete().eq("post_id", postId);
      const {error}=await supabase.from("community_posts").delete().eq("id", postId);if(error)throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["community-posts"] }); toast.success("Publication supprimée"); },
  });

  const addEmoji = (emoji: string) => setNewContent(prev => prev + emoji);
  const addEmojiToComment = (postId: string, emoji: string) => setCommentText(prev => ({ ...prev, [postId]: (prev[postId] || "") + emoji }));

  const myProfile: any = user ? profileMap.get(user.id) : null;
  const myInitials = myProfile ? `${myProfile.first_name?.[0] || ""}${myProfile.last_name?.[0] || ""}`.toUpperCase() : "?";

  // Stats activité de l'utilisateur (badges)
  const myPostsCount = useMemo(() => posts.filter((p: any) => p.author_id === user?.id).length, [posts, user?.id]);
  const myLikesReceived = useMemo(() => {
    const myPostIds = posts.filter((p: any) => p.author_id === user?.id).map((p: any) => p.id);
    return myPostIds.reduce((sum, id) => sum + ((allLikeCounts as any)[id] || 0), 0);
  }, [posts, allLikeCounts, user?.id]);

  const badges = useMemo(() => {
    const arr: { icon: any; label: string; className: string }[] = [];
    if (myPostsCount >= 5) arr.push({ icon: Flame, label: "Actif", className: "bg-primary text-primary-foreground" });
    if (myLikesReceived >= 10) arr.push({ icon: Star, label: "Populaire", className: "bg-warning text-warning-foreground" });
    if (myPostsCount >= 20) arr.push({ icon: Award, label: "Légende", className: "bg-secondary text-secondary-foreground" });
    return arr;
  }, [myPostsCount, myLikesReceived]);

  const topCreators = useMemo(() => {
    const scores = new Map<string, { userId: string; posts: number; likes: number; comments: number; score: number }>();
    posts.forEach((p: any) => {
      const entry = scores.get(p.author_id) || { userId: p.author_id, posts: 0, likes: 0, comments: 0, score: 0 };
      entry.posts += 1;
      entry.likes += (allLikeCounts as any)[p.id] || 0;
      entry.comments += allComments.filter((c: any) => c.post_id === p.id).length;
      entry.score = entry.posts * 2 + entry.likes + entry.comments;
      scores.set(p.author_id, entry);
    });
    return Array.from(scores.values())
      .map((entry) => ({ ...entry, profile: profileMap.get(entry.userId) as any }))
      .filter((entry) => entry.profile)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }, [posts, allLikeCounts, allComments, profileMap]);

  const campusPulse = useMemo(() => {
    const today = new Date().toDateString();
    const postsToday = posts.filter((p: any) => new Date(p.created_at).toDateString() === today).length;
    const creators = new Set(posts.map((p: any) => p.author_id)).size;
    const interactions = Object.values(allLikeCounts as Record<string, number>).reduce((sum, count) => sum + count, 0) + allComments.length;
    return { postsToday, creators, interactions };
  }, [posts, allLikeCounts, allComments]);

  const weeklyChallenge = useMemo(() => {
    const now = new Date();
    const start = getWeekStart(now);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const previousStart = new Date(start);
    previousStart.setDate(start.getDate() - 7);
    const previousEnd = new Date(start);
    previousEnd.setMilliseconds(-1);
    const currentIndex = getWeekIndex(now);
    const title = WEEKLY_CHALLENGES[currentIndex % WEEKLY_CHALLENGES.length];

    const previousScores = new Map<string, { userId: string; posts: number; likes: number; comments: number; score: number }>();
    posts.forEach((p: any) => {
      const created = new Date(p.created_at);
      if (created < previousStart || created > previousEnd) return;
      const entry = previousScores.get(p.author_id) || { userId: p.author_id, posts: 0, likes: 0, comments: 0, score: 0 };
      entry.posts += 1;
      entry.likes += (allLikeCounts as any)[p.id] || 0;
      entry.comments += allComments.filter((c: any) => c.post_id === p.id).length;
      entry.score = entry.posts * 3 + entry.likes + entry.comments;
      previousScores.set(p.author_id, entry);
    });

    const winner = Array.from(previousScores.values())
      .map((entry) => ({ ...entry, profile: profileMap.get(entry.userId) as any }))
      .filter((entry) => entry.profile)
      .sort((a, b) => b.score - a.score)[0] || null;

    return {
      title,
      period: `${formatShortDate(start)} - ${formatShortDate(end)}`,
      winner,
    };
  }, [posts, allLikeCounts, allComments, profileMap]);

  const [lastTap, setLastTap] = useState<Record<string, number>>({});
  const [showHeartAnim, setShowHeartAnim] = useState<Record<string, boolean>>({});

  const handleDoubleTap = (postId: string) => {
    const now = Date.now();
    if (lastTap[postId] && now - lastTap[postId] < 300) {
      if (!likes.includes(postId)) likeMutation.mutate(postId);
      setShowHeartAnim({ ...showHeartAnim, [postId]: true });
      setTimeout(() => setShowHeartAnim(prev => ({ ...prev, [postId]: false })), 1000);
    }
    setLastTap({ ...lastTap, [postId]: now });
  };

  const instName = institution?.name?.trim() || "";

  return (
    <div className="community-futuristic-bg relative min-h-screen overflow-hidden text-foreground -m-3 sm:-m-5 lg:-m-7">
      <div className="community-orbit-grid pointer-events-none absolute inset-0 opacity-80" />
      <div className="pointer-events-none absolute -left-24 top-10 h-64 w-64 rounded-full bg-primary/10 blur-3xl animate-slow-drift" />
      <div className="pointer-events-none absolute -right-28 top-36 h-72 w-72 rounded-full bg-accent/10 blur-3xl animate-slow-drift" />
      <div className="community-3d-stage pointer-events-none fixed inset-0 overflow-hidden">
        <div className="community-holo-plane animate-plane-scan absolute left-[6%] top-24 hidden h-72 w-72 rounded-[2rem] lg:block" />
        <div className="community-holo-plane animate-plane-scan absolute right-[7%] top-[48%] hidden h-80 w-80 rounded-[2rem] opacity-70 lg:block" />
        <div className="community-macro-orb animate-macro-float absolute left-[9%] top-[44%] hidden h-28 w-28 rounded-full lg:block" />
        <div className="community-macro-orb animate-macro-float absolute right-[11%] top-24 hidden h-20 w-20 rounded-full lg:block" />
      </div>
      <div className="relative mx-auto w-full max-w-3xl pb-36 lg:ml-auto lg:mr-28 lg:max-w-2xl lg:pb-20 xl:mr-32">
        {/* Header communauté */}
        <header className="sticky top-0 z-30 app-header px-4 py-3.5 shadow-elevated">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              {institution?.logo_url ? (
                <img src={institution.logo_url} alt={instName} decoding="async" width={44} height={44} className="h-11 w-11 shrink-0 rounded-xl object-cover ring-1 ring-border" />
              ) : (
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl gradient-gold text-sm font-bold text-primary-foreground shadow-sm">
                  {instName.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 leading-tight">
                <h1 className="truncate text-lg font-heading font-bold text-foreground">
                   {instName && <>{instName} <span className="font-semibold text-muted-foreground">communauté</span></>}
                </h1>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button onClick={() => setSearchOpen(!searchOpen)} className="w-10 h-10 rounded-full hover:bg-muted flex items-center justify-center transition-colors">
                <Search className={`w-5 h-5 ${searchOpen ? "text-primary" : "text-foreground"}`} />
              </button>
              <Link to="/notifications" className="relative w-10 h-10 rounded-full hover:bg-muted flex items-center justify-center transition-colors">
                <Bell className="w-5 h-5 text-foreground" />
                {unreadNotifs > 0 && (
                    <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground flex items-center justify-center ring-2 ring-background">
                    {unreadNotifs > 9 ? "9+" : unreadNotifs}
                  </span>
                )}
              </Link>
              <Link to="/messages" className="relative w-10 h-10 rounded-full hover:bg-muted flex items-center justify-center transition-colors">
                <MessageSquare className="w-5 h-5 text-foreground" />
                {unreadMsgs > 0 && (
                  <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-accent text-[10px] font-bold text-primary-foreground flex items-center justify-center ring-2 ring-background">
                    {unreadMsgs > 9 ? "9+" : unreadMsgs}
                  </span>
                )}
              </Link>
            </div>
          </div>

          {/* Barre recherche */}
          <AnimatePresence>
            {searchOpen && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="relative mt-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    autoFocus
                    placeholder="Rechercher publications, étudiants, #hashtags..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-card border border-input rounded-full pl-10 pr-10 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </header>

        <motion.section
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 90, damping: 18 }}
          className="px-4 pt-5"
        >
          <div className="community-command-panel perspective-card relative overflow-hidden rounded-3xl p-4">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px animate-shimmer" />
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Espace social campus</p>
                <h2 className="mt-1 text-xl font-heading font-bold text-foreground">Pulse Communauté</h2>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Stories, reels, tendances et échanges étudiants en temps réel.</p>
              </div>
              <div className="grid shrink-0 grid-cols-2 gap-1.5 text-center">
                <div className="rounded-2xl bg-primary/10 px-3 py-2">
                  <p className="text-base font-bold text-foreground">{campusPulse.postsToday}</p>
                  <p className="text-[9px] uppercase text-muted-foreground">posts</p>
                </div>
                <div className="rounded-2xl bg-accent/10 px-3 py-2">
                  <p className="text-base font-bold text-foreground">{campusPulse.interactions}</p>
                  <p className="text-[9px] uppercase text-muted-foreground">flux</p>
                </div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button size="sm" onClick={() => setShowNewPost(true)} className="gradient-gold text-primary-foreground shadow-gold">
                <PlusSquare className="mr-1.5 h-4 w-4" /> Publier
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setShowVideoCreator(true)} className="shadow-sm">
                <Video className="mr-1.5 h-4 w-4" /> Reel
              </Button>
            </div>
          </div>
        </motion.section>

        {/* Profil rapide étudiant + badges */}
        {isStudent && myProfile && (
          <div className="px-4 pt-5 pb-3">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="community-glass-panel perspective-card flex items-center gap-3 rounded-2xl px-3 py-3">
              <div className="shrink-0 p-[2px] rounded-full gradient-prestige animate-holo-sheen">
                <Avatar className="h-14 w-14 ring-2 ring-background">
                  <AvatarImage src={myProfile.avatar_url || undefined} />
                  <AvatarFallback className="bg-primary text-primary-foreground font-bold">{myInitials}</AvatarFallback>
                </Avatar>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{myProfile.first_name} {myProfile.last_name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {myProfile.level || ""}{myProfile.filiere_id && filiereMap.get(myProfile.filiere_id) ? ` · ${filiereMap.get(myProfile.filiere_id)}` : ""}
                </p>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className="text-[11px] text-muted-foreground"><b className="text-foreground">{myPostsCount}</b> posts</span>
                  <span className="text-[11px] text-muted-foreground"><b className="text-foreground">{myLikesReceived}</b> likes</span>
                  {badges.map((b) => (
                    <span key={b.label} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${b.className}`}>
                      <b.icon className="w-3 h-3" /> {b.label}
                    </span>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Stories */}
        <div className="px-4 py-4 border-b border-border/70 overflow-x-auto scrollbar-none">
          <div className="flex gap-4">
            <div className="flex flex-col items-center gap-1.5 shrink-0">
              <button
                onClick={() => {
                  if (myStoryGroup) setViewerGroupIndex(0);
                  else if (isStudent) setShowStoryCreator(true);
                  else toast.info("Seuls les étudiants peuvent publier des stories");
                }}
                className="relative group"
              >
                  <div className={myStoryGroup ? "p-[2.5px] rounded-full story-ring-seen" : "p-[2.5px] rounded-full bg-muted"}>
                  <div className="p-[2px] rounded-full bg-background">
                    <Avatar className="w-[64px] h-[64px]">
                      <AvatarImage src={myProfile?.avatar_url || undefined} />
                      <AvatarFallback className="bg-primary text-primary-foreground text-sm font-bold">{myInitials}</AvatarFallback>
                    </Avatar>
                  </div>
                </div>
                {isStudent && (
                  <button onClick={(e) => { e.stopPropagation(); setShowStoryCreator(true); }}
                    className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full gradient-gold text-primary-foreground flex items-center justify-center text-sm border-2 border-background font-bold shadow-md hover:scale-110 transition-transform">+</button>
                )}
              </button>
              <span className="text-[11px] text-muted-foreground truncate w-16 text-center">{myStoryGroup ? "Votre story" : "Vous"}</span>
            </div>

            {otherStoryGroups.map((g, idx) => {
              const ini = g.profile ? `${g.profile.first_name?.[0] || ""}${g.profile.last_name?.[0] || ""}`.toUpperCase() : "?";
              const groupIdx = myStoryGroup ? idx + 1 : idx;
              const hasUnseenStories = g.stories.some((story) => !viewedStorySet.has(story.id));
              return (
                <motion.button key={g.user_id} whileHover={{ y: -3 }} whileTap={{ scale: 0.96 }} onClick={() => setViewerGroupIndex(groupIdx)} className="flex flex-col items-center gap-1.5 shrink-0 group">
                  <div className={`p-[2.5px] rounded-full group-hover:scale-105 transition-transform ${hasUnseenStories ? "story-ring-unseen" : "story-ring-seen"}`}>
                    <div className="p-[2px] rounded-full bg-background">
                      <Avatar className="w-[64px] h-[64px]">
                        <AvatarImage src={g.profile?.avatar_url || undefined} />
                        <AvatarFallback className="bg-primary text-primary-foreground text-sm font-bold">{ini}</AvatarFallback>
                      </Avatar>
                    </div>
                  </div>
                  <span className="text-[11px] text-foreground truncate w-16 text-center font-medium">{g.profile?.first_name || "Anonyme"}</span>
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Tendances : hashtags */}
        {trendingHashtags.length > 0 && (
          <div className="px-4 pt-3 pb-1 flex items-center gap-2 overflow-x-auto scrollbar-none">
            <TrendingUp className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="text-[11px] text-muted-foreground uppercase tracking-wider shrink-0 mr-1">Tendances</span>
            {trendingHashtags.map(([tag, count]) => (
              <button key={tag} onClick={() => { setSearchQuery(tag); setSearchOpen(true); }}
                className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-card hover:bg-muted border border-border text-[11px] text-foreground transition-colors">
                <Hash className="w-3 h-3" />{tag.slice(1)}
                <span className="text-muted-foreground">{count}</span>
              </button>
            ))}
          </div>
        )}

        {/* Engagement campus */}
        <div className="px-4 pt-3">
            <motion.div initial={{ opacity: 0, y: 24, rotateX: -8 }} whileInView={{ opacity: 1, y: 0, rotateX: 0 }} viewport={{ once: true, margin: "-80px" }} transition={{ type: "spring", stiffness: 80, damping: 16 }} className="community-glass-panel perspective-card relative overflow-hidden rounded-2xl p-4">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px animate-shimmer" />
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Défi de la semaine · {weeklyChallenge.period}</p>
                <h2 className="text-base font-heading font-bold text-foreground">{weeklyChallenge.title}</h2>
              </div>
              <Button size="sm" onClick={() => setShowNewPost(true)} className="gradient-gold text-primary-foreground shrink-0">
                Participer
              </Button>
            </div>
            {weeklyChallenge.winner && (
              <div className="mt-3 flex items-center gap-3 rounded-xl border border-primary/25 bg-primary/10 px-3 py-2">
                <Award className="h-5 w-5 text-primary shrink-0" />
                <p className="min-w-0 text-xs text-foreground">
                  Gagnant semaine passée : <span className="font-bold text-foreground">{weeklyChallenge.winner.profile.first_name} {weeklyChallenge.winner.profile.last_name}</span>
                  <span className="text-muted-foreground"> · {weeklyChallenge.winner.score} pts</span>
                </p>
              </div>
            )}
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-muted/70 px-2 py-2 shadow-sm transition-transform hover:-translate-y-0.5">
                <p className="text-lg font-bold text-foreground">{campusPulse.postsToday}</p>
                <p className="text-[10px] text-muted-foreground">posts du jour</p>
              </div>
              <div className="rounded-xl bg-muted/70 px-2 py-2 shadow-sm transition-transform hover:-translate-y-0.5">
                <p className="text-lg font-bold text-foreground">{campusPulse.creators}</p>
                <p className="text-[10px] text-muted-foreground">créateurs</p>
              </div>
              <div className="rounded-xl bg-muted/70 px-2 py-2 shadow-sm transition-transform hover:-translate-y-0.5">
                <p className="text-lg font-bold text-foreground">{campusPulse.interactions}</p>
                <p className="text-[10px] text-muted-foreground">réactions</p>
              </div>
            </div>
          </motion.div>
        </div>

        {topCreators.length > 0 && feedFilter === "all" && !searchQuery && (
          <div className="px-4 pt-3 overflow-x-auto scrollbar-none">
            <div className="flex items-center gap-2 mb-2">
              <Award className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="text-[11px] text-muted-foreground uppercase tracking-wider">Créateurs actifs</span>
            </div>
            <div className="flex gap-3">
              {topCreators.map((creator, index) => {
                const initials = `${creator.profile.first_name?.[0] || ""}${creator.profile.last_name?.[0] || ""}`.toUpperCase();
                return (
                  <motion.div key={creator.userId} whileHover={{ y: -4, rotateX: 2 }} className="community-glass-panel shrink-0 w-[136px] rounded-2xl p-3 text-center perspective-card">
                    <div className="mx-auto mb-2 h-12 w-12 rounded-full p-[2px] gradient-gold">
                      <Avatar className="h-full w-full ring-2 ring-background">
                        <AvatarImage src={creator.profile.avatar_url || undefined} />
                        <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">{initials}</AvatarFallback>
                      </Avatar>
                    </div>
                    <p className="truncate text-xs font-semibold text-foreground">#{index + 1} {creator.profile.first_name}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">{creator.score} pts · {creator.posts} posts</p>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        {/* Filtres feed */}
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="sticky top-[57px] z-20 mx-4 mt-3 flex items-center gap-2 overflow-x-auto rounded-2xl border border-border/70 bg-card/78 px-2 py-2 shadow-sm backdrop-blur-xl scrollbar-none">
          {([
            { id: "all" as FeedFilter, label: "Récents", icon: Sparkles },
            { id: "reels" as FeedFilter, label: "Reels", icon: Film },
            { id: "trending" as FeedFilter, label: "Tendances", icon: TrendingUp },
            { id: "saved" as FeedFilter, label: "Enregistrés", icon: Bookmark },
          ]).map((f) => (
            <button key={f.id} onClick={() => setFeedFilter(f.id)}
              className={`inline-flex shrink-0 items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium transition-all hover:-translate-y-0.5 ${
                feedFilter === f.id
                  ? "bg-primary text-primary-foreground shadow-gold"
                  : "bg-background/70 text-muted-foreground border border-border hover:bg-muted hover:text-foreground"
              }`}>
              <f.icon className="w-3.5 h-3.5" />{f.label}
            </button>
          ))}
        </motion.div>

        {/* Suggestions à découvrir */}
        {suggestions.length > 0 && feedFilter === "all" && !searchQuery && (
          <div className="px-4 py-3 border-y border-border overflow-x-auto scrollbar-none">
            <div className="flex items-center gap-2 mb-2">
              <UsersIcon className="w-3.5 h-3.5 text-primary" />
              <span className="text-[11px] text-muted-foreground uppercase tracking-wider">Étudiants de votre classe</span>
            </div>
            <div className="flex gap-3">
              {suggestions.map((s: any) => {
                const ini = `${s.first_name?.[0] || ""}${s.last_name?.[0] || ""}`.toUpperCase();
                return (
                  <motion.div key={s.user_id} whileHover={{ y: -4 }} className="community-glass-panel perspective-card shrink-0 w-[110px] rounded-2xl p-3 flex flex-col items-center text-center">
                    <Avatar className="w-12 h-12 mb-2">
                      <AvatarImage src={s.avatar_url || undefined} />
                      <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">{ini}</AvatarFallback>
                    </Avatar>
                    <p className="text-[11px] font-semibold text-foreground truncate w-full">{s.first_name}</p>
                    <p className="text-[9px] text-muted-foreground truncate w-full">{s.level || ""}</p>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        <StoryCreator open={showStoryCreator} onOpenChange={setShowStoryCreator} />
        <VideoPostCreator open={showVideoCreator} onOpenChange={setShowVideoCreator} />
        {viewerGroupIndex !== null && storyGroups.length > 0 && (
          <StoryViewer groups={storyGroups} initialGroupIndex={Math.min(viewerGroupIndex, storyGroups.length - 1)} onClose={() => setViewerGroupIndex(null)} />
        )}
        {reelsViewerIndex !== null && reelsList.length > 0 && (
          <ReelsViewer
            reels={reelsList as any}
            initialIndex={Math.min(reelsViewerIndex, reelsList.length - 1)}
            profileMap={profileMap as any}
            onClose={() => setReelsViewerIndex(null)}
          />
        )}

        {/* New post dialog */}
        <Dialog open={showNewPost} onOpenChange={setShowNewPost}>
          <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden bg-card/95 border-border text-foreground backdrop-blur-sm">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <Button variant="ghost" size="sm" onClick={() => setShowNewPost(false)} className="text-muted-foreground hover:text-foreground hover:bg-muted">Annuler</Button>
              <span className="font-semibold text-sm">Nouvelle publication</span>
              <Button variant="ghost" size="sm" onClick={() => postMutation.mutate()} disabled={(!newContent && !selectedFile) || postMutation.isPending || uploading} className="text-primary font-semibold hover:bg-muted">
                {uploading ? "..." : "Partager"}
              </Button>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex gap-3">
                <Avatar className="w-10 h-10">
                  <AvatarImage src={myProfile?.avatar_url || undefined} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">{myInitials}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="text-sm font-semibold">{myProfile ? `${myProfile.first_name} ${myProfile.last_name}` : "Moi"}</p>
                  {myProfile?.level && <p className="text-[11px] text-muted-foreground">{myProfile.level}{myProfile.filiere_id ? ` · ${filiereMap.get(myProfile.filiere_id) || ""}` : ""}</p>}
                </div>
              </div>
              <Textarea
                placeholder="Quoi de neuf sur le campus ? Ajoutez des #hashtags..."
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                rows={4}
                className="resize-none border-none bg-transparent focus-visible:ring-0 text-sm placeholder:text-muted-foreground p-0 text-foreground"
                autoFocus
              />
              {previewUrl && (
                <div className="relative rounded-xl overflow-hidden">
                  <img src={previewUrl} alt="Aperçu de l'image à publier" decoding="async" className="w-full max-h-64 object-cover rounded-xl" />
                  <button onClick={() => { setPreviewUrl(null); setSelectedFile(null); }} className="absolute top-2 right-2 bg-foreground/70 text-background rounded-full w-7 h-7 flex items-center justify-center text-sm">✕</button>
                </div>
              )}
              <div className="flex items-center gap-1 pt-2 border-t border-border">
                <Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()} className="text-muted-foreground hover:text-primary hover:bg-muted"><ImagePlus className="w-5 h-5" /></Button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
                <Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()} className="text-muted-foreground hover:text-primary hover:bg-muted"><Camera className="w-5 h-5" /></Button>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary hover:bg-muted"><Smile className="w-5 h-5" /></Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-2 bg-popover/95 border-border text-popover-foreground shadow-elevated backdrop-blur-xl" align="start">
                    <div className="grid grid-cols-8 gap-1">
                      {EMOJI_LIST.map(e => (
                        <button key={e} onClick={() => addEmoji(e)} className="text-xl hover:scale-125 transition-transform p-1 rounded hover:bg-muted">{e}</button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
                <span className="ml-auto text-[10px] text-muted-foreground">{newContent.length}/500</span>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Feed - Skeleton loading */}
        {postsLoading && (
          <div className="space-y-3 py-3">
            {[1, 2].map((i) => (
              <div key={i} className="glass-card p-4 animate-pulse">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-full bg-muted" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-32 bg-muted rounded" />
                    <div className="h-2 w-20 bg-muted rounded" />
                  </div>
                </div>
                <div className="h-48 bg-muted rounded-xl" />
              </div>
            ))}
          </div>
        )}

        {/* Reels grid (TikTok-style discovery) */}
        {feedFilter === "reels" && !postsLoading && (
          <div className="px-1 py-3">
            {reelsList.length === 0 ? (
              <div className="py-20 text-center px-6">
                <Film className="w-16 h-16 text-muted-foreground mx-auto mb-4 stroke-1" />
                <p className="text-lg font-medium text-foreground">Aucun Reel pour l'instant</p>
                <p className="text-sm text-muted-foreground mt-1">Soyez le premier à publier une vidéo !</p>
                <Button size="sm" className="mt-4 gradient-gold text-primary-foreground" onClick={() => setShowVideoCreator(true)}>
                  <Video className="w-4 h-4 mr-1" /> Créer un Reel
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-1">
                {reelsList.map((r: any, idx: number) => {
                  const author: any = profileMap.get(r.author_id);
                  const likeCount = (allLikeCounts as any)[r.id] || 0;
                  return (
                    <button
                      key={r.id}
                      onClick={() => setReelsViewerIndex(idx)}
                      className="relative aspect-[9/16] rounded-md overflow-hidden bg-foreground group"
                    >
                      <video
                        ref={registerAutoPlayVideo(`reel-grid-${r.id}`)}
                        src={r.video_url}
                        poster={r.image_url || undefined}
                        className="w-full h-full object-cover"
                        muted
                        autoPlay
                        playsInline
                        loop
                        preload="auto"
                      />
                      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/60" />
                      <div className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-foreground/40 backdrop-blur-sm flex items-center justify-center">
                        <Play className="w-3.5 h-3.5 text-background fill-background" />
                      </div>
                      <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center justify-between text-background text-[10px] font-semibold">
                        <span className="truncate drop-shadow">{author?.first_name || ""}</span>
                        <span className="flex items-center gap-0.5 drop-shadow">
                          <Heart className="w-3 h-3 fill-background" /> {likeCount}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Feed (normal posts list) */}
        {feedFilter !== "reels" && (
        <div className="space-y-3 py-3">
          {filteredPosts.map((p: any) => {
            const author: any = profileMap.get(p.author_id);
            const isLiked = likes.includes(p.id);
            const likeCount = (allLikeCounts as any)[p.id] || 0;
            const comments = allComments.filter((c: any) => c.post_id === p.id);
            const showC = showComments[p.id];
            const initials = author ? `${author.first_name?.[0] || ""}${author.last_name?.[0] || ""}`.toUpperCase() : "?";
            const isOwn = p.author_id === user?.id;
            const timeAgo = formatDistanceToNow(new Date(p.created_at), { locale: fr, addSuffix: false });
            const authorMeta = author ? [author.level, author.filiere_id ? filiereMap.get(author.filiere_id) : null].filter(Boolean).join(" · ") : "";
            const isNew = Date.now() - new Date(p.created_at).getTime() < 3600000; // < 1h
            const isBookmarked = bookmarks.includes(p.id);
            const reactions = reactionsByPost[p.id] || [];

            return (
              <motion.div key={p.id} initial={{ opacity: 0, y: 34, rotateX: -10, scale: 0.96 }} whileInView={{ opacity: 1, y: 0, rotateX: 0, scale: 1 }} viewport={{ once: true, margin: "-70px" }} transition={{ type: "spring", stiffness: 92, damping: 18 }} whileHover={{ y: -5, rotateX: 1.6, rotateY: -1.2 }} className="community-glass-panel community-post-card perspective-card rounded-2xl">
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="p-[1.5px] rounded-full gradient-gold">
                        <Avatar className="w-9 h-9 ring-2 ring-card">
                        <AvatarImage src={author?.avatar_url || undefined} />
                        <AvatarFallback className="bg-primary text-primary-foreground text-[10px] font-bold">{initials}</AvatarFallback>
                      </Avatar>
                    </div>
                    <div className="leading-tight">
                      <div className="flex items-center gap-1.5">
                        <p className="text-[13px] font-semibold text-foreground">{author ? `${author.first_name} ${author.last_name}` : "Anonyme"}</p>
                        {isNew && (
                          <span className="px-1.5 py-0.5 rounded-full bg-accent/20 text-primary text-[9px] font-bold uppercase tracking-wider">Nouveau</span>
                        )}
                      </div>
                      {authorMeta && <p className="text-[11px] text-muted-foreground">{authorMeta} · il y a {timeAgo}</p>}
                    </div>
                  </div>
                  {isOwn && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="w-8 h-8 text-muted-foreground hover:bg-muted"><MoreHorizontal className="w-5 h-5" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-popover/95 border-border text-popover-foreground shadow-elevated backdrop-blur-xl">
                        <DropdownMenuItem onClick={() => deletePostMutation.mutate(p.id)} className="text-destructive focus:bg-muted">
                          <Trash2 className="w-4 h-4 mr-2" /> Supprimer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>

                {p.video_url ? (
                  <button
                    type="button"
                    onClick={() => {
                      const idx = reelsList.findIndex((r: any) => r.id === p.id);
                      if (idx >= 0) setReelsViewerIndex(idx);
                    }}
                    className="relative w-full bg-foreground select-none aspect-[9/16] max-h-[600px] overflow-hidden group"
                  >
                    <video ref={registerAutoPlayVideo(`feed-${p.id}`)} src={p.video_url} poster={p.image_url || undefined} className="w-full h-full object-cover" muted autoPlay playsInline loop preload="auto" />
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/40" />
                    <div className="absolute top-3 left-3 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-foreground/70 backdrop-blur-md text-background text-[10px] font-bold uppercase tracking-wider">
                      <Film className="w-3 h-3" /> Reel
                    </div>
                  </button>
                ) : p.image_url ? (
                  <div className="relative w-full bg-foreground cursor-pointer select-none" onClick={() => handleDoubleTap(p.id)}>
                    <img src={p.image_url} alt={p.content ? `Illustration de la publication : ${p.content.slice(0, 120)}` : "Image de la publication"} className="w-full max-h-[600px] object-contain" draggable={false} loading="lazy" decoding="async" />
                    <AnimatePresence>
                      {showHeartAnim[p.id] && (
                        <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1.2, opacity: 1 }} exit={{ scale: 0, opacity: 0 }} transition={{ duration: 0.3 }} className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <Heart className="w-24 h-24 text-destructive fill-destructive drop-shadow-2xl" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ) : null}

                {!p.image_url && !p.video_url && p.content && (
                  <div className="px-4 pt-2">
                    <div className="bg-muted rounded-xl p-5 mb-2 border border-border cursor-pointer" onClick={() => handleDoubleTap(p.id)}>
                      <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{renderWithHashtags(p.content)}</p>
                    </div>
                  </div>
                )}

                <div className="px-4 pt-2 pb-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <button onClick={() => likeMutation.mutate(p.id)} className="group">
                        <Heart className={`w-6 h-6 transition-all ${isLiked ? "text-destructive fill-destructive scale-110" : "text-foreground hover:text-muted-foreground"} group-active:scale-75`} />
                      </button>
                      <button onClick={() => setShowComments({ ...showComments, [p.id]: !showC })}>
                        <MessageCircle className="w-6 h-6 text-foreground hover:text-muted-foreground transition-colors" />
                      </button>
                      <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/community#${p.id}`); toast.success("Lien copié !"); }}>
                        <Send className="w-6 h-6 text-foreground hover:text-muted-foreground transition-colors" />
                      </button>
                      {/* Reaction picker */}
                      <Popover open={showReactionPicker === p.id} onOpenChange={(o) => setShowReactionPicker(o ? p.id : null)}>
                        <PopoverTrigger asChild>
                          <button className="text-xl hover:scale-110 transition-transform">😊</button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-2 bg-popover/95 border-border text-popover-foreground rounded-full shadow-elevated backdrop-blur-xl" side="top" align="start">
                          <div className="flex gap-1">
                            {QUICK_REACTIONS.map((emoji) => (
                              <button key={emoji} onClick={() => reactionMutation.mutate({ postId: p.id, emoji })}
                                className="text-2xl hover:scale-150 transition-transform p-1.5 rounded-full hover:bg-muted">{emoji}</button>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <button onClick={() => bookmarkMutation.mutate(p.id)}>
                      <Bookmark className={`w-6 h-6 transition-all ${isBookmarked ? "text-primary fill-primary" : "text-foreground hover:text-muted-foreground"}`} />
                    </button>
                  </div>

                  {/* Reactions display */}
                  {reactions.length > 0 && (
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      {reactions.map((r) => (
                        <button key={r.emoji} onClick={() => reactionMutation.mutate({ postId: p.id, emoji: r.emoji })}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-all ${
                            r.mine
                              ? "bg-primary/15 border-primary/35 text-foreground"
                              : "bg-muted border-border text-foreground hover:bg-secondary"
                          }`}>
                          <span>{r.emoji}</span>
                          <span className="font-semibold text-[11px]">{r.count}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {likeCount > 0 && (
                    <p className="text-[13px] font-semibold text-foreground mt-2">{likeCount} J'aime{likeCount > 1 ? "s" : ""}</p>
                  )}

                  {p.image_url && p.content && (
                    <p className="text-[13px] text-foreground mt-1">
                      <span className="font-semibold mr-1.5">{author ? author.first_name : "Anonyme"}</span>
                      {renderWithHashtags(p.content)}
                    </p>
                  )}

                  {comments.length > 0 && !showC && (
                    <button onClick={() => setShowComments({ ...showComments, [p.id]: true })} className="text-[13px] text-muted-foreground mt-1 block">
                      Voir les {comments.length} commentaire{comments.length > 1 ? "s" : ""}
                    </button>
                  )}
                </div>

                {showC && (
                  <div className="px-4 pb-3 space-y-3 mt-1">
                    {comments.map((c: any) => {
                      const ca: any = profileMap.get(c.author_id);
                      const cl = commentLikeCounts[c.id] || { count: 0, mine: false };
                      return (
                        <div key={c.id} className="flex gap-2 group">
                          <Avatar className="w-7 h-7 mt-0.5">
                            <AvatarImage src={ca?.avatar_url || undefined} />
                            <AvatarFallback className="bg-primary text-primary-foreground text-[9px] font-bold">{ca ? `${ca.first_name?.[0]}${ca.last_name?.[0]}` : "?"}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="bg-muted rounded-2xl px-3 py-2 inline-block max-w-full">
                              <p className="text-[12px] font-semibold text-foreground">{ca ? `${ca.first_name} ${ca.last_name}` : "Anonyme"}</p>
                              <p className="text-[13px] text-foreground break-words">{renderWithHashtags(c.content)}</p>
                            </div>
                            <div className="flex items-center gap-3 mt-0.5 px-2">
                              <p className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(c.created_at), { locale: fr, addSuffix: true })}</p>
                              <button onClick={() => commentLikeMutation.mutate(c.id)}
                                className={`text-[10px] font-semibold transition-colors ${cl.mine ? "text-destructive" : "text-muted-foreground hover:text-foreground"}`}>
                                {cl.mine ? "❤️ " : ""}J'aime{cl.count > 0 ? ` · ${cl.count}` : ""}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="flex items-center gap-2 px-4 py-2.5 border-t border-border">
                  <Avatar className="w-7 h-7">
                    <AvatarImage src={myProfile?.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-[9px] font-bold">{myInitials}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 flex items-center">
                    <input
                      placeholder="Ajouter un commentaire..."
                      value={commentText[p.id] || ""}
                      onChange={(e) => setCommentText({ ...commentText, [p.id]: e.target.value })}
                      className="flex-1 text-[13px] bg-transparent border-none outline-none placeholder:text-muted-foreground text-foreground"
                      onKeyDown={(e) => { if (e.key === "Enter" && commentText[p.id]) commentMutation.mutate(p.id); }}
                    />
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="text-muted-foreground hover:text-foreground p-1"><Smile className="w-4 h-4" /></button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-2 bg-popover/95 border-border text-popover-foreground shadow-elevated backdrop-blur-xl" align="end">
                        <div className="grid grid-cols-8 gap-1">
                          {EMOJI_LIST.map(e => (
                            <button key={e} onClick={() => addEmojiToComment(p.id, e)} className="text-lg hover:scale-125 transition-transform p-0.5">{e}</button>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                    {commentText[p.id] && (
                      <button onClick={() => commentMutation.mutate(p.id)} className="text-primary font-semibold text-[13px] ml-2">Publier</button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
        )}

        {!postsLoading && feedFilter !== "reels" && filteredPosts.length === 0 && (
          <div className="py-20 text-center px-6">
            {feedFilter === "saved" ? (
              <>
                <Bookmark className="w-16 h-16 text-muted-foreground mx-auto mb-4 stroke-1" />
                <p className="text-lg font-medium text-foreground">Aucun signet</p>
                <p className="text-sm text-muted-foreground mt-1">Enregistrez vos publications préférées pour les retrouver ici</p>
              </>
            ) : searchQuery ? (
              <>
                <Search className="w-16 h-16 text-muted-foreground mx-auto mb-4 stroke-1" />
                <p className="text-lg font-medium text-foreground">Aucun résultat</p>
                <p className="text-sm text-muted-foreground mt-1">Essayez d'autres mots-clés</p>
              </>
            ) : (
              <>
                <Camera className="w-16 h-16 text-muted-foreground mx-auto mb-4 stroke-1" />
                <p className="text-lg font-medium text-foreground">Partagez vos moments</p>
                <p className="text-sm text-muted-foreground mt-1">Soyez le premier à partager un instant de campus</p>
                <Button size="sm" className="mt-4 gradient-gold text-primary-foreground" onClick={() => setShowNewPost(true)}>
                  Créer une publication
                </Button>
              </>
            )}
          </div>
        )}

        <div className="fixed bottom-24 right-5 z-40 flex flex-col items-end gap-3 lg:bottom-8">
          {recentStoryReplies.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setStoryRepliesOpen((open) => !open)}
                className="group relative flex h-14 w-14 items-center justify-center rounded-full border border-primary/25 bg-card/95 text-primary shadow-elevated backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:bg-primary hover:text-primary-foreground"
                aria-label="Réponses reçues aux stories"
              >
                <MessageCircle className="h-6 w-6 transition-transform group-hover:scale-110" />
                <span className="absolute -right-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-destructive px-1 text-[11px] font-bold text-destructive-foreground ring-2 ring-background">
                  {recentStoryReplies.length > 9 ? "9+" : recentStoryReplies.length}
                </span>
              </button>

              <AnimatePresence>
                {storyRepliesOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.96 }}
                    className="absolute bottom-16 right-0 w-[min(340px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border bg-card/95 p-3 shadow-elevated backdrop-blur-xl"
                  >
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-heading font-bold text-foreground">Réponses stories</p>
                        <p className="text-[11px] text-muted-foreground">{recentStoryReplies.length} message{recentStoryReplies.length > 1 ? "s" : ""} reçu{recentStoryReplies.length > 1 ? "s" : ""}</p>
                      </div>
                      <button onClick={() => setStoryRepliesOpen(false)} className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Fermer">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                      {recentStoryReplies.map((reply: any) => {
                        const initials = reply.author ? `${reply.author.first_name?.[0] || ""}${reply.author.last_name?.[0] || ""}`.toUpperCase() : "?";
                        return (
                          <div key={reply.id} className="flex gap-2 rounded-xl bg-muted/70 p-2">
                            <Avatar className="h-8 w-8 shrink-0">
                              <AvatarImage src={reply.author?.avatar_url || undefined} />
                              <AvatarFallback className="bg-primary text-[10px] font-bold text-primary-foreground">{initials}</AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <p className="truncate text-xs font-semibold text-foreground">
                                  {reply.author ? `${reply.author.first_name} ${reply.author.last_name}` : "Anonyme"}
                                </p>
                                <span className="shrink-0 text-[10px] text-muted-foreground">
                                  {formatDistanceToNow(new Date(reply.created_at), { locale: fr, addSuffix: true })}
                                </span>
                              </div>
                              <p className="mt-0.5 line-clamp-3 text-xs leading-relaxed text-foreground">{reply.content}</p>
                            </div>
                            {reply.story?.media_url && <img src={reply.story.media_url} alt="Story liée" className="h-9 w-9 shrink-0 rounded-lg object-cover" loading="lazy" decoding="async" width={36} height={36} />}
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          <button
            onClick={() => setShowVideoCreator(true)}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-elevated transition-transform hover:scale-110"
            aria-label="Créer un Reel"
          >
            <Video className="h-6 w-6" />
          </button>

          <button
            onClick={() => setShowNewPost(true)}
            className="flex h-14 w-14 items-center justify-center rounded-full gradient-gold text-primary-foreground shadow-elevated transition-transform hover:scale-110"
            aria-label="Créer une publication"
          >
            <PlusSquare className="h-6 w-6" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default CommunityPage;
