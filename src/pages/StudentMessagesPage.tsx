import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, Send, Search, Trash2, Pencil, Mic, ArrowLeft, Eye, ImagePlus, MoreVertical, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { useMessageDelivery, useMessageRead } from "@/hooks/useMessageDelivery";
import { useState, useRef, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { ChatAudio, ChatImage } from "@/components/chat/ChatMedia";
import { canEditMessage, isHiddenForUser, optimizeChatImage, uploadChatMedia } from "@/lib/chatMedia";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import VoiceRecorderBar from "@/components/chat/VoiceRecorderBar";
import MessageReceipt from "@/components/chat/MessageReceipt";
import ViewOnceMedia from "@/components/chat/ViewOnceMedia";


interface Contact {
  user_id: string;
  first_name: string;
  last_name: string;
  avatar_url?: string | null;
  role: "admin" | "student";
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount?: number;
}

const StudentMessagesPage = () => {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [body, setBody] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const voice = useVoiceRecorder();
  const [sendingVoice, setSendingVoice] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [viewOnce, setViewOnce] = useState(false);


  // Fetch admins of this institution
  const { data: adminProfiles = [] } = useQuery({
    queryKey: ["admin-profiles-for-student", profile?.institution_id],
    queryFn: async () => {
      const { data: adminRoles } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
      if (!adminRoles?.length) return [];
      const adminIds = adminRoles.map(r => r.user_id);
      let q = supabase.from("profiles").select("user_id, first_name, last_name, avatar_url");
      if (profile?.institution_id) q = q.eq("institution_id", profile.institution_id);
      q = q.in("user_id", adminIds);
      const { data } = await q;
      return data || [];
    },
    enabled: !!profile,
  });

  // Fetch students of same class (institution + filière + niveau)
  const { data: otherStudents = [] } = useQuery({
    queryKey: ["other-students", user?.id, profile?.institution_id, profile?.filiere_id, profile?.level],
    queryFn: async () => {
      if (!user || !profile?.institution_id || !profile?.filiere_id) return [];

      let classmatesQuery = supabase
        .from("profiles")
        .select("user_id, first_name, last_name, avatar_url, filiere_id, level, student_number")
        .neq("user_id", user.id)
        .eq("institution_id", profile.institution_id)
        .eq("filiere_id", profile.filiere_id);

      if (profile.level) {
        classmatesQuery = classmatesQuery.eq("level", profile.level);
      }

      const { data: classmates, error: classmatesError } = await classmatesQuery.order("last_name");
      if (classmatesError) throw classmatesError;
      if (!classmates?.length) return [];

      const classmateIds = classmates.map((student) => student.user_id);
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", classmateIds);

      const roleMap = new Map<string, string[]>();
      (roles || []).forEach((entry) => {
        const existing = roleMap.get(entry.user_id) || [];
        existing.push(entry.role);
        roleMap.set(entry.user_id, existing);
      });

      return classmates.filter((student) => {
        const userRoles = roleMap.get(student.user_id);
        if (!userRoles?.length) return true;
        return userRoles.includes("user") && !userRoles.some((role) => ["admin", "professor", "super_admin", "moderator"].includes(role));
      });
    },
    enabled: !!user && !!profile?.institution_id && !!profile?.filiere_id,
  });

  // Fetch all messages
  const { data: messages = [] } = useQuery({
    queryKey: ["student-messages", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("messages").select("*")
        .or(`sender_id.eq.${user!.id},recipient_id.eq.${user!.id}`)
        .order("created_at", { ascending: true }).limit(500);
      return data || [];
    },
    enabled: !!user,
  });

  useRealtimeSubscription("messages", [["student-messages", user?.id || ""]]);

  // Mark all received messages as delivered as soon as they arrive
  useMessageDelivery(user?.id, messages);
  useMessageRead(user?.id, selectedContact?.user_id, messages);

  // Build profile map for name resolution
  const profileMap = useMemo(() => {
    const map = new Map<string, { first_name: string; last_name: string; avatar_url?: string | null }>();
    adminProfiles.forEach((a: any) => map.set(a.user_id, a));
    otherStudents.forEach((s: any) => map.set(s.user_id, s));
    return map;
  }, [adminProfiles, otherStudents]);

  const adminIds = useMemo(() => new Set(adminProfiles.map((a: any) => a.user_id)), [adminProfiles]);

  // Build contacts list with last message info
  const contacts = useMemo<Contact[]>(() => {
    const contactMap = new Map<string, Contact>();

    // Add admins
    adminProfiles.forEach((a: any) => {
      contactMap.set(a.user_id, {
        user_id: a.user_id,
        first_name: a.first_name,
        last_name: a.last_name,
        avatar_url: a.avatar_url,
        role: "admin",
      });
    });

    // Add students from filière
    otherStudents.forEach((s: any) => {
      contactMap.set(s.user_id, {
        user_id: s.user_id,
        first_name: s.first_name,
        last_name: s.last_name,
        avatar_url: s.avatar_url,
        role: "student",
      });
    });

    // Also add contacts from existing messages (in case someone messaged us)
    messages.forEach((m: any) => {
      const otherId = m.sender_id === user?.id ? m.recipient_id : m.sender_id;
      if (otherId === user?.id) return;
      if (!contactMap.has(otherId)) {
        const p = profileMap.get(otherId);
        if (p) {
          contactMap.set(otherId, {
            user_id: otherId,
            first_name: p.first_name,
            last_name: p.last_name,
            avatar_url: p.avatar_url,
            role: adminIds.has(otherId) ? "admin" : "student",
          });
        }
      }
    });

    // Enrich with last message info
    const reversedMsgs = [...messages].reverse();
    contactMap.forEach((contact) => {
      const lastMsg = reversedMsgs.find(
        (m: any) =>
          (m.sender_id === contact.user_id && m.recipient_id === user?.id) ||
          (m.sender_id === user?.id && m.recipient_id === contact.user_id)
      );
      if (lastMsg) {
        contact.lastMessage = (lastMsg as any).body;
        contact.lastMessageTime = (lastMsg as any).created_at;
      }
      contact.unreadCount = messages.filter(
        (m: any) => m.sender_id === contact.user_id && m.recipient_id === user?.id && !m.is_read
      ).length;
    });

    // Sort: contacts with messages first (by last message time), then alphabetically
    return Array.from(contactMap.values()).sort((a, b) => {
      if (a.lastMessageTime && b.lastMessageTime) return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime();
      if (a.lastMessageTime) return -1;
      if (b.lastMessageTime) return 1;
      return `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`);
    });
  }, [adminProfiles, otherStudents, messages, user?.id, profileMap, adminIds]);

  // Filtered contacts
  const filteredContacts = useMemo(() => {
    if (!searchQuery.trim()) return contacts;
    const q = searchQuery.toLowerCase();
    return contacts.filter(c => `${c.first_name} ${c.last_name}`.toLowerCase().includes(q));
  }, [contacts, searchQuery]);

  // Messages for selected conversation
  const conversationMessages = useMemo(() => {
    if (!selectedContact) return [];
    return messages.filter(
      (m: any) =>
        !isHiddenForUser(m, user?.id) &&
        ((m.sender_id === selectedContact.user_id && m.recipient_id === user?.id) ||
          (m.sender_id === user?.id && m.recipient_id === selectedContact.user_id))
    );
  }, [messages, selectedContact, user?.id]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversationMessages.length]);

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!selectedContact) throw new Error("Aucun contact sélectionné");
      const { error } = await supabase.from("messages").insert({
        sender_id: user!.id,
        recipient_id: selectedContact.user_id,
        subject: "",
        body,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["student-messages"] });
      setBody("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const editMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("messages").update({ body: editBody, edited_at: new Date().toISOString() }).eq("id", editingId!);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["student-messages"] });
      setEditingId(null);
      setEditBody("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Supprimer pour moi : le message reste chez l'autre
  const deleteForMeMutation = useMutation({
    mutationFn: async (m: any) => {
      const next = Array.from(new Set([...(m.deleted_for || []), user!.id]));
      const { error } = await supabase.from("messages").update({ deleted_for: next } as any).eq("id", m.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["student-messages"] });
      toast.success("Supprimé pour vous");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Supprimer pour tout le monde (uniquement mes messages)
  const deleteForEveryoneMutation = useMutation({
    mutationFn: async (m: any) => {
      const { error } = await supabase
        .from("messages")
        .update({ deleted_for_everyone: true, body: "", audio_url: null, image_url: null } as any)
        .eq("id", m.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["student-messages"] });
      toast.success("Supprimé pour tout le monde");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const sendImage = async (file: File) => {
    if (!selectedContact) { toast.error("Choisissez un contact"); return; }
    if (!file.type.startsWith("image/")) { toast.error("Fichier image uniquement"); return; }
    setUploadingImage(true);
    try {
      const optimizedFile = await optimizeChatImage(file);
      const path = await uploadChatMedia(user!.id, selectedContact.user_id, optimizedFile, "image");
      const { error } = await supabase.from("messages").insert({
        sender_id: user!.id, recipient_id: selectedContact.user_id, subject: "", body: body.trim() || "", image_url: path, view_once: viewOnce,
      } as any);
      if (error) throw error;
      setBody("");
      setViewOnce(false);
      qc.invalidateQueries({ queryKey: ["student-messages"] });
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de l'envoi de l'image");
    } finally {
      setUploadingImage(false);
    }
  };

  const startRecording = async () => {
    if (!selectedContact) { toast.error("Choisissez un contact"); return; }
    await voice.start();
  };

  const sendVoice = async () => {
    if (!voice.blob || !selectedContact) return;
    setSendingVoice(true);
    try {
      const type = voice.blob.type || "audio/webm";
      const path = await uploadChatMedia(user!.id, selectedContact.user_id, voice.blob, "audio", type);
      const { error } = await supabase.from("messages").insert({
        sender_id: user!.id, recipient_id: selectedContact.user_id, subject: "", body: "🎤 Message vocal", audio_url: path, view_once: viewOnce,
      } as any);
      if (error) throw error;
      voice.discard();
      setViewOnce(false);
      qc.invalidateQueries({ queryKey: ["student-messages"] });
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de l'envoi du vocal");
    } finally {
      setSendingVoice(false);
    }
  };

  const getInitials = (firstName: string, lastName: string) =>
    `${firstName?.charAt(0) || ""}${lastName?.charAt(0) || ""}`.toUpperCase();

  const getName = (userId: string) => {
    const p = profileMap.get(userId);
    return p ? `${p.first_name} ${p.last_name}` : "Utilisateur";
  };

  const handleSelectContact = (c: Contact) => {
    setSelectedContact(c);
    setMobileShowChat(true);
  };

  const totalUnread = contacts.reduce((sum, c) => sum + (c.unreadCount || 0), 0);

  return (
    <div className="flex h-[calc(100dvh-8rem)] min-h-[520px] overflow-hidden rounded-lg border border-border bg-card/30 backdrop-blur-md shadow-lg">
      {/* Contacts sidebar */}
      <div className={cn(
        "w-full md:w-80 lg:w-96 flex-shrink-0 border-r border-border/50 flex flex-col bg-card/40 backdrop-blur-md",
        mobileShowChat && "hidden md:flex"
      )}>
        {/* Header */}
        <div className="p-4 border-b border-border/30 bg-gradient-to-r from-primary/5 to-accent/5">
          <h2 className="text-lg font-heading font-bold text-foreground flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-accent" />
            Messages
            {totalUnread > 0 && (
              <span className="ml-auto bg-accent text-accent-foreground text-xs font-bold px-2 py-0.5 rounded-full">
                {totalUnread}
              </span>
            )}
          </h2>
          <div className="mt-3 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un contact..."
              className="pl-9 bg-secondary/50 border-0 h-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Contacts list */}
        <ScrollArea className="flex-1">
          {filteredContacts.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Aucun contact trouvé</div>
          ) : (
            <div className="divide-y divide-border/20">
              {filteredContacts.map((c) => (
                <button
                  key={c.user_id}
                  onClick={() => handleSelectContact(c)}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 hover:bg-secondary/50 transition-colors text-left",
                    selectedContact?.user_id === c.user_id && "bg-accent/10"
                  )}
                >
                  <Avatar className="h-11 w-11 flex-shrink-0">
                    {c.avatar_url && <AvatarImage src={c.avatar_url} />}
                    <AvatarFallback className={cn(
                      "text-sm font-semibold",
                      c.role === "admin" ? "bg-primary text-primary-foreground" : "bg-accent/20 text-accent-foreground"
                    )}>
                      {getInitials(c.first_name, c.last_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm text-foreground truncate">
                        {c.first_name} {c.last_name}
                      </span>
                      {c.lastMessageTime && (
                        <span className="text-[10px] text-muted-foreground flex-shrink-0 ml-2">
                          {format(new Date(c.lastMessageTime), "HH:mm", { locale: fr })}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <p className="text-xs text-muted-foreground truncate max-w-[180px]">
                        {c.role === "admin" && <span className="text-primary font-medium">Admin · </span>}
                        {c.lastMessage || "Aucun message"}
                      </p>
                      {(c.unreadCount || 0) > 0 && (
                        <span className="bg-accent text-accent-foreground text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full flex-shrink-0">
                          {c.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Chat area */}
      <div className={cn(
        "flex-1 flex flex-col",
        !mobileShowChat && !selectedContact && "hidden md:flex"
      )}>
        {!selectedContact ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3">
            <div className="w-20 h-20 rounded-full bg-secondary/50 flex items-center justify-center">
              <MessageSquare className="w-10 h-10 text-muted-foreground/40" />
            </div>
            <p className="text-sm">Sélectionnez une conversation</p>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="px-4 py-3 border-b border-border/30 bg-gradient-to-r from-primary/5 to-accent/5 flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden h-8 w-8"
                onClick={() => { setMobileShowChat(false); setSelectedContact(null); }}
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <Avatar className="h-10 w-10">
                {selectedContact.avatar_url && <AvatarImage src={selectedContact.avatar_url} />}
                <AvatarFallback className={cn(
                  "text-sm font-semibold",
                  selectedContact.role === "admin" ? "bg-primary text-primary-foreground" : "bg-accent/20 text-accent-foreground"
                )}>
                  {getInitials(selectedContact.first_name, selectedContact.last_name)}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold text-sm text-foreground">
                  {selectedContact.first_name} {selectedContact.last_name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {selectedContact.role === "admin" ? "Administrateur" : "Étudiant"}
                </p>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-2 max-w-3xl mx-auto">
                {conversationMessages.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-8">
                    Envoyez votre premier message à {selectedContact.first_name}
                  </p>
                )}
                <AnimatePresence initial={false}>
                  {conversationMessages.map((m: any) => {
                    const isMine = m.sender_id === user?.id;
                    const removed = !!m.deleted_for_everyone;
                    const editable = isMine && !removed && canEditMessage(m) && !m.audio_url;
                    return (
                      <motion.div
                        key={m.id}
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ duration: 0.2 }}
                        className={cn("flex", isMine ? "justify-end" : "justify-start")}
                      >
                        <div
                          className={cn(
                             "group relative max-w-[86%] rounded-xl px-3 py-2.5 shadow-sm sm:max-w-[75%]",
                            isMine
                               ? "rounded-br-sm bg-primary text-primary-foreground"
                               : "rounded-bl-sm border border-border bg-card text-foreground"
                          )}
                        >
                          {editingId === m.id ? (
                            <div className="space-y-2">
                              <Textarea
                                value={editBody}
                                onChange={(e) => setEditBody(e.target.value)}
                                rows={2}
                                className="bg-background/50 border-border/50 text-sm"
                              />
                              <div className="flex gap-2">
                                <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={() => editMutation.mutate()}>OK</Button>
                                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingId(null)}>Annuler</Button>
                              </div>
                            </div>
                          ) : removed ? (
                            <p className="text-sm italic opacity-70">🚫 Ce message a été supprimé</p>
                          ) : (
                            <>
                               {m.body && (!m.view_once || (!m.image_url && !m.audio_url)) && <p className="text-sm whitespace-pre-wrap break-words">{m.body}</p>}
                               {m.view_once && (m.image_url || m.audio_url) ? <ViewOnceMedia message={m} isMine={isMine} /> : <><ChatImage value={m.image_url} /><ChatAudio value={m.audio_url} /></>}
                              <div className={cn("flex items-center gap-1 mt-1", isMine ? "justify-end" : "justify-start")}>
                                <span className={cn("text-[10px]", isMine ? "text-accent-foreground/60" : "text-muted-foreground")}>
                                  {format(new Date(m.created_at), "HH:mm", { locale: fr })}
                                </span>
                                {m.edited_at && <span className={cn("text-[10px] italic", isMine ? "text-accent-foreground/50" : "text-muted-foreground/70")}>modifié</span>}
                                 {isMine && <MessageReceipt message={m} />}
                              </div>
                            </>
                          )}

                          {/* Actions */}
                          {editingId !== m.id && (
                            <div className="absolute -top-3 right-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button className="p-1 rounded-md bg-card border border-border/50 shadow-sm">
                                    <MoreVertical className="w-3.5 h-3.5 text-muted-foreground" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-56">
                                  {editable && (
                                    <DropdownMenuItem onClick={() => { setEditingId(m.id); setEditBody(m.body); }}>
                                      <Pencil className="w-4 h-4 mr-2" /> Modifier
                                    </DropdownMenuItem>
                                  )}
                                  {isMine && !removed && !editable && (
                                    <DropdownMenuItem disabled>
                                      <Pencil className="w-4 h-4 mr-2" /> Modification expirée (20 min)
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem onClick={() => deleteForMeMutation.mutate(m)}>
                                    <Trash2 className="w-4 h-4 mr-2" /> Supprimer pour moi
                                  </DropdownMenuItem>
                                  {isMine && !removed && (
                                    <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => deleteForEveryoneMutation.mutate(m)}>
                                      <Users className="w-4 h-4 mr-2" /> Supprimer pour tout le monde
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          )}

                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Input area */}
            <div className="p-3 border-t border-border/30 bg-card/50 backdrop-blur-md">
              <div className="flex items-end gap-2 max-w-3xl mx-auto">
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) sendImage(f);
                    e.target.value = "";
                  }}
                />
                <Button
                  onClick={() => imageInputRef.current?.click()}
                  disabled={uploadingImage || voice.status !== "idle"}
                  variant="outline"
                  size="icon"
                  aria-label="Envoyer une image"
                  className="flex-shrink-0 h-10 w-10 rounded-full"
                >
                  <ImagePlus className="w-4 h-4" />
                </Button>
                <Button type="button" onClick={() => setViewOnce((value) => !value)} variant={viewOnce ? "default" : "outline"} size="icon" aria-label={viewOnce ? "Désactiver la vue unique" : "Activer la vue unique"} title="Vue unique pour le prochain média" className="h-10 w-10 flex-shrink-0 rounded-full">
                  <Eye className="h-4 w-4" />
                </Button>
                {voice.status === "idle" && (
                  <Button
                    onClick={startRecording}
                    variant="outline"
                    size="icon"
                    aria-label="Enregistrer un message vocal"
                    className="flex-shrink-0 h-10 w-10 rounded-full"
                  >
                    <Mic className="w-4 h-4" />
                  </Button>
                )}

                {voice.status !== "idle" ? (
                  <VoiceRecorderBar
                    status={voice.status}
                    seconds={voice.seconds}
                    previewUrl={voice.previewUrl}
                    sending={sendingVoice}
                    onPause={voice.pause}
                    onResume={voice.resume}
                    onStop={voice.stop}
                    onDiscard={voice.discard}
                    onSend={sendVoice}
                    viewOnce={viewOnce}
                    onViewOnceChange={setViewOnce}
                  />
                ) : (
                  <div className="flex-1 relative">
                    <Input
                      placeholder="Écrire un message..."
                      className="pr-12 rounded-full bg-secondary/40 border-border/30 h-10"
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey && body.trim()) {
                          e.preventDefault();
                          sendMutation.mutate();
                        }
                      }}
                    />
                  </div>
                )}
                <Button
                  onClick={() => sendMutation.mutate()}
                  disabled={!body.trim() || sendMutation.isPending}
                  size="icon"
                  className="flex-shrink-0 h-10 w-10 rounded-full bg-accent text-accent-foreground hover:bg-accent/90"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default StudentMessagesPage;
