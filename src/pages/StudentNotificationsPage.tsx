import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, CheckCheck, Info, AlertTriangle, CheckCircle2, XCircle, Video, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 16, scale: 0.97 }, show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring" as const, stiffness: 300, damping: 24 } } };

const typeIcons: Record<string, any> = {
  info: Info,
  warning: AlertTriangle,
  success: CheckCircle2,
  error: XCircle,
  visio: Video,
};

const typeColors: Record<string, string> = {
  info: "bg-info/15 text-info",
  warning: "bg-warning/15 text-warning",
  success: "bg-success/15 text-success",
  error: "bg-destructive/15 text-destructive",
  visio: "bg-green-500/15 text-green-600",
};

const StudentNotificationsPage = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data: notifications = [] } = useQuery({
    queryKey: ["student-notifications", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  useRealtimeSubscription("notifications", [["student-notifications", user?.id || ""]], user ? { column: "user_id", value: user.id } : undefined);

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["student-notifications"] }),
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const unread = notifications.filter((n) => !n.is_read).map((n) => n.id);
      if (unread.length === 0) return;
      await supabase.from("notifications").update({ is_read: true }).in("id", unread);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["student-notifications"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("notifications").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_d, ids) => {
      toast.success(`${ids.length} notification(s) supprimée(s)`);
      setSelected([]);
      setConfirmOpen(false);
      qc.invalidateQueries({ queryKey: ["student-notifications"] });
      qc.invalidateQueries({ queryKey: ["notifications-unread-count"] });
    },
    onError: () => toast.error("Suppression impossible"),
  });

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const allSelected = notifications.length > 0 && selected.length === notifications.length;

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={item} className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground">
            Notifications {unreadCount > 0 && <span className="text-base font-normal text-accent">({unreadCount})</span>}
          </h1>
          <p className="text-muted-foreground mt-1">Restez informé de votre parcours</p>
        </div>
        <div className="flex items-center gap-2">
          {selected.length > 0 && (
            <Button variant="destructive" size="sm" className="gap-2" onClick={() => setConfirmOpen(true)}>
              <Trash2 className="w-4 h-4" /> Supprimer ({selected.length})
            </Button>
          )}
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={() => markAllReadMutation.mutate()} className="gap-2">
              <CheckCheck className="w-4 h-4" /> Tout marquer comme lu
            </Button>
          )}
        </div>
      </motion.div>

      <motion.div variants={item}>
        <Card className="glass-card-elevated border-border/50">
          <CardContent className="p-0">
            {notifications.length === 0 ? (
              <div className="text-center py-12">
                <Bell className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-sm text-muted-foreground">Aucune notification</p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 p-3 border-b border-border/50">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={(v) => setSelected(v ? notifications.map((n) => n.id) : [])}
                  />
                  <span className="text-xs text-muted-foreground">Tout sélectionner</span>
                </div>
                <AnimatePresence mode="popLayout">
                  {notifications.map((notif) => {
                    const Icon = typeIcons[notif.type] || Info;
                    const isVisio = notif.type === "visio";
                    return (
                      <motion.div
                        key={notif.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        layout
                        className={`flex items-start gap-3 p-4 border-b border-border/50 transition-colors ${
                          !notif.is_read ? "bg-accent/5" : "hover:bg-secondary/30"
                        }`}
                      >
                        <Checkbox
                          className="mt-3"
                          checked={selected.includes(notif.id)}
                          onCheckedChange={() => toggle(notif.id)}
                        />
                        <div
                          className="flex items-start gap-4 flex-1 min-w-0 cursor-pointer"
                          onClick={() => {
                            if (!notif.is_read) markReadMutation.mutate(notif.id);
                            if (isVisio) navigate("/visio");
                          }}
                        >
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${typeColors[notif.type] || typeColors.info}`}>
                            <Icon className="w-5 h-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-foreground">{notif.title}</p>
                              {!notif.is_read && <span className="w-2 h-2 rounded-full bg-accent flex-shrink-0" />}
                            </div>
                            <p className="text-sm text-muted-foreground mt-0.5">{notif.message}</p>
                            <div className="flex items-center gap-3 mt-1.5">
                              <p className="text-xs text-muted-foreground">
                                {new Date(notif.created_at).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}
                              </p>
                              {isVisio && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-6 text-xs gap-1 border-accent/30 text-accent hover:bg-accent/10"
                                  onClick={(e) => { e.stopPropagation(); navigate("/visio"); }}
                                >
                                  <Video className="w-3 h-3" /> Rejoindre le cours
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => deleteMutation.mutate([notif.id])}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer les notifications ?</AlertDialogTitle>
            <AlertDialogDescription>
              {selected.length} notification(s) seront définitivement supprimées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteMutation.mutate(selected)}>Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
};

export default StudentNotificationsPage;
