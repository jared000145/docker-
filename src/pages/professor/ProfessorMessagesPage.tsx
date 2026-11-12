import { motion } from "framer-motion";
import { MessageSquare, Send, Trash2, Pencil, Mic, Video, Users, ImagePlus, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { useState, useRef } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { ChatAudio, ChatImage } from "@/components/chat/ChatMedia";
import { canEditMessage, isHiddenForUser, optimizeChatImage, uploadChatMedia } from "@/lib/chatMedia";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import VoiceRecorderBar from "@/components/chat/VoiceRecorderBar";
import MessageReceipt from "@/components/chat/MessageReceipt";
import ViewOnceMedia from "@/components/chat/ViewOnceMedia";
import { useMessageDelivery, useVisibleMessagesRead } from "@/hooks/useMessageDelivery";


const ProfessorMessagesPage = () => {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const [recipientId, setRecipientId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const voice = useVoiceRecorder();
  const [sendingVoice, setSendingVoice] = useState(false);
  const [visioOpen, setVisioOpen] = useState(false);
  const [visioTitle, setVisioTitle] = useState("");
  const [visioUrl, setVisioUrl] = useState("");
  const [visioFiliere, setVisioFiliere] = useState("");
  const [viewOnce, setViewOnce] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useRealtimeSubscription("messages", [["prof-messages", user?.id || ""]]);

  const { data: messages = [] } = useQuery({
    queryKey: ["prof-messages", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("messages").select("*")
        .or(`sender_id.eq.${user!.id},recipient_id.eq.${user!.id}`)
        .order("created_at", { ascending: false }).limit(50);
      return data || [];
    },
    enabled: !!user,
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["all-profiles-for-msg"],
    queryFn: async () => { const { data } = await supabase.from("profiles").select("user_id, first_name, last_name, student_number, filiere_id"); return data || []; },
  });

  const { data: filieres = [] } = useQuery({
    queryKey: ["prof-filieres", profile?.institution_id],
    queryFn: async () => {
      let q = supabase.from("filieres").select("id,name").order("name");
      if (profile?.institution_id) q = q.eq("institution_id", profile.institution_id);
      const { data } = await q;
      const seen = new Set<string>();
      return (data || []).filter((f: any) => { if (seen.has(f.id)) return false; seen.add(f.id); return true; });
    },
    enabled: !!profile?.institution_id,
  });

  const profileMap = new Map(profiles.map((p: any) => [p.user_id, p]));
  useMessageDelivery(user?.id, messages);
  useVisibleMessagesRead(user?.id, messages);

  const sendMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("messages").insert({ sender_id: user!.id, recipient_id: recipientId, subject, body });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["prof-messages"] }); setRecipientId(""); setSubject(""); setBody(""); toast.success("Envoyé"); },
    onError: (e: any) => toast.error(e.message),
  });

  const editMutation = useMutation({
    mutationFn: async () => { await supabase.from("messages").update({ body: editBody, edited_at: new Date().toISOString() } as any).eq("id", editingId!); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["prof-messages"] }); setEditingId(null); toast.success("Modifié"); },
  });

  const deleteForMeMutation = useMutation({
    mutationFn: async (m: any) => {
      const next = Array.from(new Set([...(m.deleted_for || []), user!.id]));
      const { error } = await supabase.from("messages").update({ deleted_for: next } as any).eq("id", m.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["prof-messages"] }); toast.success("Supprimé pour vous"); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteForEveryoneMutation = useMutation({
    mutationFn: async (m: any) => {
      const { error } = await supabase.from("messages").update({ deleted_for_everyone: true, body: "", audio_url: null, image_url: null } as any).eq("id", m.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["prof-messages"] }); toast.success("Supprimé pour tout le monde"); },
    onError: (e: any) => toast.error(e.message),
  });


  // Visio conference
  const createVisioMutation = useMutation({
    mutationFn: async () => {
      // Create conference record
      const { data: profile } = await supabase.from("profiles").select("institution_id").eq("user_id", user!.id).maybeSingle();
      await (supabase as any).from("video_conferences").insert({
        professor_id: user!.id, title: visioTitle, meeting_url: visioUrl,
        filiere_id: visioFiliere || null, institution_id: profile?.institution_id || null,
      });
      // Notify students of the filière
      const studentsToNotify = profiles.filter((p: any) => visioFiliere ? p.filiere_id === visioFiliere : true);
      if (studentsToNotify.length) {
        const notifs = studentsToNotify.map((s: any) => ({
          user_id: s.user_id, title: "📹 Cours en visioconférence", type: "visio",
          message: `${visioTitle} — Rejoignez : ${visioUrl}`, institution_id: profile?.institution_id || null,
        }));
        await supabase.from("notifications").insert(notifs);
      }
    },
    onSuccess: () => { toast.success("Visio créée et étudiants notifiés !"); setVisioOpen(false); setVisioTitle(""); setVisioUrl(""); setVisioFiliere(""); },
    onError: (e: any) => toast.error(e.message),
  });

  const startRecording = async () => {
    if (!recipientId) { toast.error("Choisissez un destinataire"); return; }
    await voice.start();
  };

  const sendImage = async (file: File) => {
    if (!recipientId) { toast.error("Choisissez un destinataire"); return; }
    if (!file.type.startsWith("image/")) { toast.error("Fichier image uniquement"); return; }
    setUploadingImage(true);
    try {
      const optimizedFile = await optimizeChatImage(file);
      const path = await uploadChatMedia(user!.id, recipientId, optimizedFile, "image");
      const { error } = await supabase.from("messages").insert({ sender_id: user!.id, recipient_id: recipientId, subject, body: body.trim(), image_url: path, view_once: viewOnce } as any);
      if (error) throw error;
      setBody(""); setViewOnce(false); qc.invalidateQueries({ queryKey: ["prof-messages"] });
    } catch (e: any) { toast.error(e.message || "Erreur lors de l'envoi de l'image"); }
    finally { setUploadingImage(false); }
  };

  const sendVoice = async () => {
    if (!voice.blob || !recipientId) return;
    setSendingVoice(true);
    try {
      const type = voice.blob.type || "audio/webm";
      const path = await uploadChatMedia(user!.id, recipientId, voice.blob, "audio", type);
      const { error } = await supabase.from("messages").insert({ sender_id: user!.id, recipient_id: recipientId, subject: "🎤 Audio", body: "Message vocal", audio_url: path, view_once: viewOnce } as any);
      if (error) throw error;
      voice.discard();
      setViewOnce(false);
      qc.invalidateQueries({ queryKey: ["prof-messages"] });
      toast.success("Message vocal envoyé");
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de l'envoi du vocal");
    } finally {
      setSendingVoice(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
          <MessageSquare className="w-6 h-6 text-accent" /> Messages
        </h1>
        <Button onClick={() => setVisioOpen(true)} className="gap-2">
          <Video className="w-4 h-4" /> Créer une visio
        </Button>
      </div>

      {/* Visio Dialog */}
      <Dialog open={visioOpen} onOpenChange={setVisioOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>📹 Créer un cours en visioconférence</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Input placeholder="Titre du cours" value={visioTitle} onChange={(e) => setVisioTitle(e.target.value)} />
            <Input placeholder="Lien de la visio (Zoom, Meet, etc.)" value={visioUrl} onChange={(e) => setVisioUrl(e.target.value)} />
            <Select value={visioFiliere} onValueChange={setVisioFiliere}>
              <SelectTrigger><SelectValue placeholder="Filière concernée" /></SelectTrigger>
              <SelectContent>
                {filieres.map((f: any) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Les étudiants de cette filière recevront une notification avec le lien.</p>
            <Button onClick={() => createVisioMutation.mutate()} disabled={!visioTitle || !visioUrl || createVisioMutation.isPending} className="w-full">
              {createVisioMutation.isPending ? "Envoi..." : "Créer et notifier"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Card className="glass-card border-border/50">
        <CardHeader><CardTitle className="text-base">Nouveau message</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Select value={recipientId} onValueChange={setRecipientId}>
            <SelectTrigger><SelectValue placeholder="Destinataire" /></SelectTrigger>
            <SelectContent>
              {profiles.filter((p: any) => p.user_id !== user?.id).map((p: any) => (
                <SelectItem key={p.user_id} value={p.user_id}>{p.first_name} {p.last_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input placeholder="Sujet" value={subject} onChange={(e) => setSubject(e.target.value)} />
          <Textarea placeholder="Message..." value={body} onChange={(e) => setBody(e.target.value)} rows={3} />
          <div className="flex items-center gap-2">
            <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) sendImage(file); e.target.value = ""; }} />
            <Button type="button" onClick={() => imageInputRef.current?.click()} disabled={uploadingImage || voice.status !== "idle"} variant="outline" size="icon" aria-label="Envoyer une image"><ImagePlus className="h-4 w-4" /></Button>
            <Button type="button" onClick={() => setViewOnce(value => !value)} variant={viewOnce ? "default" : "outline"} size="icon" aria-label="Vue unique" title="Vue unique pour le prochain média"><Eye className="h-4 w-4" /></Button>
            {voice.status === "idle" ? (
              <>
                <Button onClick={startRecording} variant="outline" size="icon" aria-label="Enregistrer un message vocal">
                  <Mic className="w-4 h-4" />
                </Button>
                <div className="flex-1" />
              </>
            ) : (
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
            )}
            <Button onClick={() => sendMutation.mutate()} disabled={!recipientId || !body || sendMutation.isPending} className="gradient-gold text-accent-foreground gap-2">
              <Send className="w-4 h-4" /> Envoyer
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card border-border/50">
        <CardHeader><CardTitle className="text-base">Boîte de réception</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {messages.length === 0 ? <p className="text-sm text-muted-foreground">Aucun message</p> : messages.filter((m: any) => !isHiddenForUser(m, user?.id)).map((m: any) => {
            const sender = profileMap.get(m.sender_id);
            const isMine = m.sender_id === user?.id;
            const removed = !!(m as any).deleted_for_everyone;
            const editable = isMine && !removed && canEditMessage(m) && !(m as any).audio_url;
            return (
               <div key={m.id} className={`rounded-lg border border-border p-3 shadow-sm ${isMine ? "ml-auto max-w-[92%] bg-primary text-primary-foreground" : "mr-auto max-w-[92%] bg-card text-foreground"}`}>
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-muted-foreground">
                      {isMine ? "Vous" : sender ? `${sender.first_name} ${sender.last_name}` : "Inconnu"} · {m.subject || "Sans sujet"}
                    </p>
                    {(m as any).edited_at && <span className="text-xs text-muted-foreground italic">(modifié)</span>}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">{format(new Date(m.created_at), "dd/MM HH:mm", { locale: fr })}</span>
                     {isMine && <MessageReceipt message={m} className="text-primary-foreground" />}
                    {editable && (
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setEditingId(m.id); setEditBody(m.body); }}><Pencil className="w-3 h-3" /></Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-6 w-6" title="Supprimer pour moi" onClick={() => deleteForMeMutation.mutate(m)}><Trash2 className="w-3 h-3" /></Button>
                    {isMine && !removed && (
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" title="Supprimer pour tout le monde" onClick={() => deleteForEveryoneMutation.mutate(m)}><Users className="w-3 h-3" /></Button>
                    )}
                  </div>
                </div>
                {editingId === m.id ? (
                  <div className="mt-2 space-y-2">
                    <Textarea value={editBody} onChange={(e) => setEditBody(e.target.value)} rows={2} />
                    <div className="flex gap-2"><Button size="sm" onClick={() => editMutation.mutate()}>Sauvegarder</Button><Button size="sm" variant="outline" onClick={() => setEditingId(null)}>Annuler</Button></div>
                  </div>
                ) : removed ? <p className="text-sm italic text-muted-foreground mt-1">🚫 Ce message a été supprimé</p> : (
                  <>
                     {m.body && (!m.view_once || (!m.image_url && !m.audio_url)) && <p className="mt-1 text-sm">{m.body}</p>}
                     {m.view_once && (m.image_url || m.audio_url) ? <ViewOnceMedia message={m} isMine={isMine} /> : <><ChatImage value={m.image_url} /><ChatAudio value={m.audio_url} /></>}
                  </>
                )}
              </div>

            );
          })}
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default ProfessorMessagesPage;
