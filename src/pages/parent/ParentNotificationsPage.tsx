import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useParentContext } from "@/components/ParentLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bell } from "lucide-react";

const ParentNotificationsPage = () => {
  const { selectedChildId } = useParentContext();
  const { data: rows = [] } = useQuery({
    queryKey: ["parent-notifications", selectedChildId],
    enabled: !!selectedChildId,
    queryFn: async () => {
      const { data } = await supabase.from("notifications").select("*").eq("user_id", selectedChildId!).order("created_at", { ascending: false }).limit(100);
      return data || [];
    },
  });

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Bell className="w-5 h-5" /> Notifications</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {rows.length === 0 && <p className="text-sm text-muted-foreground">Aucune notification.</p>}
        {rows.map((n: any) => (
          <div key={n.id} className="p-3 rounded-lg border bg-muted/20">
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold text-sm">{n.title}</p>
              <span className="text-[10px] text-muted-foreground">{new Date(n.created_at).toLocaleDateString("fr-FR")}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{n.message}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default ParentNotificationsPage;
