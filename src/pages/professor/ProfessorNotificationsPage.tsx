import { useState } from "react";
import { motion } from "framer-motion";
import { Bell, Check, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";

const ProfessorNotificationsPage = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string[]>([]);

  useRealtimeSubscription("notifications", [["prof-notifs", user?.id || ""]], user ? { column: "user_id", value: user.id } : undefined);

  const { data: notifications = [] } = useQuery({
    queryKey: ["prof-notifs", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("notifications").select("*").eq("user_id", user!.id).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["prof-notifs"] }),
  });

  const removeMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("notifications").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_d, ids) => {
      toast.success(`${ids.length} notification(s) supprimée(s)`);
      setSelected([]);
      qc.invalidateQueries({ queryKey: ["prof-notifs"] });
      qc.invalidateQueries({ queryKey: ["notifications-unread-count"] });
    },
    onError: () => toast.error("Suppression impossible"),
  });

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const allSelected = notifications.length > 0 && selected.length === notifications.length;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
          <Bell className="w-6 h-6 text-accent" /> Notifications
        </h1>
        {selected.length > 0 && (
          <Button variant="destructive" size="sm" className="gap-2" onClick={() => removeMutation.mutate(selected)}>
            <Trash2 className="w-4 h-4" /> Supprimer ({selected.length})
          </Button>
        )}
      </div>

      {notifications.length > 0 && (
        <div className="flex items-center gap-3">
          <Checkbox checked={allSelected} onCheckedChange={(v) => setSelected(v ? notifications.map((n: any) => n.id) : [])} />
          <span className="text-xs text-muted-foreground">Tout sélectionner</span>
        </div>
      )}

      <div className="space-y-2">
        {notifications.length === 0 ? (
          <Card className="glass-card border-border/50">
            <CardContent className="p-8 text-center text-muted-foreground">Aucune notification</CardContent>
          </Card>
        ) : notifications.map((n: any) => (
          <Card key={n.id} className={`glass-card border-border/50 ${!n.is_read ? "border-l-4 border-l-accent" : ""}`}>
            <CardContent className="p-4 flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <Checkbox className="mt-1" checked={selected.includes(n.id)} onCheckedChange={() => toggle(n.id)} />
                <div>
                  <p className="text-sm font-medium text-foreground">{n.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">{n.message}</p>
                  <p className="text-xs text-muted-foreground mt-2">{format(new Date(n.created_at), "dd/MM/yyyy HH:mm", { locale: fr })}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {!n.is_read && (
                  <Button variant="ghost" size="sm" onClick={() => markRead.mutate(n.id)}>
                    <Check className="w-4 h-4" />
                  </Button>
                )}
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => removeMutation.mutate([n.id])}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </motion.div>
  );
};

export default ProfessorNotificationsPage;
