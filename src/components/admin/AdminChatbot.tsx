import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, Send, X, Sparkles, Trash2, Minus, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import {useLocation} from 'react-router-dom';

type Msg = { id?: string; role: "user" | "assistant"; content: string; created_at?: string };

const AdminChatbot = () => {
  const location=useLocation();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Check role: only show for admin / super_admin / professor leadership
  const { data: isAllowed = false } = useQuery({
    queryKey: ["chatbot-role", user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      const roles = (data || []).map((r: any) => r.role);
      return roles.some((r: string) => ["admin", "super_admin", "moderator"].includes(r));
    },
    enabled: !!user,
  });

  // Load history (last 24h, purge older locally too)
  useEffect(() => {
    if (!open || !user) return;
    (async () => {
      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      // purge stale
      await supabase.from("admin_chatbot_messages").delete().lt("created_at", since).eq("user_id", user.id);
      const { data } = await supabase
        .from("admin_chatbot_messages")
        .select("id, role, content, created_at")
        .eq("user_id", user.id)
        .gte("created_at", since)
        .order("created_at", { ascending: true });
      setMessages((data || []) as Msg[]);
    })();
  }, [open, user]);

  // Auto scroll
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  const send = async () => {
    const txt = input.trim();
    if (!txt || loading) return;
    setInput("");
    const userMsg: Msg = { role: "user", content: txt, created_at: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-chatbot", {
        body: { message: txt, messages: messages.map(m => ({ role: m.role, content: m.content })) },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setMessages(prev => [...prev, { role: "assistant", content: data.reply, created_at: new Date().toISOString() }]);
    } catch (e: any) {
      toast.error(e.message || "Erreur de l'assistant");
      setMessages(prev => [...prev, { role: "assistant", content: "⚠️ Une erreur est survenue. Réessayez dans quelques instants." }]);
    } finally {
      setLoading(false);
    }
  };

  const clearHistory = async () => {
    if (!user) return;
    await supabase.from("admin_chatbot_messages").delete().eq("user_id", user.id);
    setMessages([]);
    toast.success("Historique effacé");
  };

  if (!isAllowed || location.pathname.includes('/messages')) return null;

  return (
    <>
      {/* Floating draggable button - bottom right by default to avoid header */}
      <motion.div
        drag
        dragMomentum={false}
        dragElastic={0}
        dragConstraints={{ left: -window.innerWidth + 80, right: 16, top: -window.innerHeight + 100, bottom: 16 }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="fixed bottom-6 right-6 z-[60] cursor-grab active:cursor-grabbing"
      >
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setOpen(o => !o)}
          className="relative flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 transition-shadow"
          aria-label="Ouvrir l'assistant"
        >
          <Bot className="w-6 h-6" />
          {!open && (
            <motion.span
              animate={{ scale: [1, 1.4, 1], opacity: [0.7, 0, 0.7] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute inset-0 rounded-full bg-primary pointer-events-none"
            />
          )}
        </motion.button>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 320, damping: 28 }}
              drag
              dragMomentum={false}
              dragListener={false}
              dragControls={undefined}
              className="absolute bottom-16 right-0 w-[min(94vw,380px)] h-[min(75vh,560px)] flex flex-col rounded-2xl border border-border/60 bg-background/95 backdrop-blur-xl shadow-2xl shadow-primary/10 overflow-hidden cursor-default"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-border/50 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
                <div className="flex items-center gap-2 min-w-0">
                  <GripVertical className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <div className="relative flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shrink-0">
                    <Bot className="w-4 h-4" />
                    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-success border-2 border-background" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground leading-tight flex items-center gap-1">
                      Assistant Rectorplus <Sparkles className="w-3 h-3 text-primary" />
                    </p>
                    <p className="text-[10px] text-muted-foreground">En ligne · Effacé après 24h</p>
                  </div>
                </div>
                <div className="flex items-center gap-0.5">
                  {messages.length > 0 && (
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={clearHistory} title="Effacer l'historique">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(false)} title="Réduire">
                    <Minus className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(false)} title="Fermer">
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3 bg-secondary/20">
              {messages.length === 0 && !loading && (
                <div className="flex flex-col items-center justify-center text-center h-full px-4 py-8">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
                    <Bot className="w-7 h-7 text-primary" />
                  </div>
                  <p className="text-sm font-semibold text-foreground mb-1">Bonjour 👋</p>
                  <p className="text-xs text-muted-foreground mb-4 max-w-xs">
                    Je suis votre assistant Rectorplus. Posez-moi vos questions sur les modules, paiements, notes, présences, etc.
                  </p>
                  <div className="grid grid-cols-1 gap-1.5 w-full max-w-xs">
                    {[
                      "Comment importer des étudiants ?",
                      "Comment saisir une note ?",
                      "Comment générer un bulletin ?",
                    ].map(q => (
                      <button
                        key={q}
                        onClick={() => setInput(q)}
                        className="text-left text-xs px-3 py-2 rounded-lg bg-background hover:bg-primary/5 border border-border/50 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((m, i) => (
                <motion.div
                  key={m.id || i}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${m.role === "user" ? "justify-start" : "justify-end"}`}
                >
                  {m.role === "assistant" && (
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-primary/70 text-primary-foreground flex items-center justify-center shrink-0 mr-2 mt-0.5 order-1">
                      <Bot className="w-4 h-4" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] px-3 py-2 rounded-2xl text-xs leading-relaxed shadow-sm ${
                      m.role === "user"
                        ? "bg-secondary text-foreground rounded-tl-sm"
                        : "bg-gradient-to-br from-primary to-primary/85 text-primary-foreground rounded-tr-sm"
                    }`}
                  >
                    {m.role === "assistant" ? (
                      <div className="prose prose-xs prose-invert max-w-none [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0 [&_strong]:text-primary-foreground [&_code]:text-[11px] [&_code]:bg-black/20 [&_code]:px-1 [&_code]:rounded">
                        <ReactMarkdown>{m.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap break-words">{m.content}</p>
                    )}
                  </div>
                </motion.div>
              ))}
              {loading && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-end">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-primary/70 text-primary-foreground flex items-center justify-center shrink-0 mr-2 mt-0.5 order-1">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="bg-gradient-to-br from-primary to-primary/85 text-primary-foreground rounded-2xl rounded-tr-sm px-3 py-2.5 shadow-sm">
                    <div className="flex gap-1 items-center">
                      {[0, 1, 2].map(i => (
                        <motion.span
                          key={i}
                          animate={{ y: [0, -4, 0] }}
                          transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.15 }}
                          className="w-1.5 h-1.5 rounded-full bg-primary-foreground/80"
                        />
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Input */}
            <div className="border-t border-border/50 bg-background p-2.5">
              <div className="flex gap-1.5">
                <Input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                  placeholder="Posez votre question..."
                  className="h-9 text-xs"
                  disabled={loading}
                  maxLength={2000}
                />
                <Button onClick={send} disabled={!input.trim() || loading} size="icon" className="h-9 w-9 shrink-0 bg-primary hover:bg-primary/90">
                  <Send className="w-3.5 h-3.5" />
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
                Réponses générées automatiquement · Données limitées à votre établissement
              </p>
            </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </>
  );
};

export default AdminChatbot;
