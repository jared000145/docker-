import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Bell, Check, Trash2 } from "lucide-react";
import { toast } from "sonner";

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.04 } } };
const item = { hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0 } };

export default function DirectorNotificationsPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [selected, setSelected] = useState<string[]>([]);

  const { data: notifs = [], isLoading } = useQuery({
    queryKey: ["dir-notifs", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(100);
      return data || [];
    },
    enabled: !!user,
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dir-notifs", user?.id] });
    },
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      await supabase.from("notifications").update({ is_read: true }).eq("user_id", user!.id).eq("is_read", false);
    },
    onSuccess: () => {
      toast.success("Toutes les notifications marquées comme lues");
      qc.invalidateQueries({ queryKey: ["dir-notifs", user?.id] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("notifications").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_d, ids) => {
      toast.success(`${ids.length} notification(s) supprimée(s)`);
      setSelected([]);
      qc.invalidateQueries({ queryKey: ["dir-notifs", user?.id] });
      qc.invalidateQueries({ queryKey: ["notifications-unread-count"] });
    },
    onError: () => toast.error("Suppression impossible"),
  });

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const allSelected = notifs.length > 0 && selected.length === notifs.length;

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-4">
      <motion.div variants={item} className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground flex items-center gap-2">
            <Bell className="w-7 h-7 text-accent" /> Notifications
          </h1>
          <p className="text-muted-foreground mt-1">Alertes système et documents en attente de validation.</p>
        </div>
        <div className="flex items-center gap-2">
          {selected.length > 0 && (
            <Button variant="destructive" size="sm" onClick={() => removeMutation.mutate(selected)}>
              <Trash2 className="w-3 h-3 mr-1" /> Supprimer ({selected.length})
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => markAllRead.mutate()}>
            <Check className="w-3 h-3 mr-1" /> Tout marquer lu
          </Button>
        </div>
      </motion.div>

      {notifs.length > 0 && (
        <motion.div variants={item} className="flex items-center gap-3">
          <Checkbox checked={allSelected} onCheckedChange={(v) => setSelected(v ? notifs.map((n: any) => n.id) : [])} />
          <span className="text-xs text-muted-foreground">Tout sélectionner</span>
        </motion.div>
      )}

      <motion.div variants={item} className="space-y-2">
        {isLoading && <p className="text-sm text-muted-foreground text-center py-6">Chargement...</p>}
        {!isLoading && notifs.length === 0 && (
          <Card className="border-border/60"><CardContent className="p-8 text-center text-muted-foreground">Aucune notification.</CardContent></Card>
        )}
        {notifs.map((n: any) => (
          <Card key={n.id} className={`border-border/60 ${!n.is_read ? "border-l-4 border-l-accent" : ""}`}>
            <CardContent className="p-4 flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 flex-1">
                <Checkbox className="mt-1" checked={selected.includes(n.id)} onCheckedChange={() => toggle(n.id)} />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-foreground">{n.title}</h3>
                    {!n.is_read && <Badge variant="outline" className="text-[10px] border-accent/40 text-accent">Nouveau</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{n.message}</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    {new Date(n.created_at).toLocaleString("fr-FR")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {!n.is_read && (
                  <Button variant="ghost" size="icon" onClick={() => markRead.mutate(n.id)}>
                    <Check className="w-4 h-4 text-emerald-600" />
                  </Button>
                )}
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => removeMutation.mutate([n.id])}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </motion.div>
    </motion.div>
  );
}
