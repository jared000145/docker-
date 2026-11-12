import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useParentContext } from "@/components/ParentLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const ParentPlanningPage = () => {
  const { selectedChildId, children } = useParentContext();
  const child: any = children.find((c: any) => c.user_id === selectedChildId);

  const { data: childProfile } = useQuery({
    queryKey: ["parent-planning-profile", selectedChildId],
    enabled: !!selectedChildId,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("classe_id, filiere_id, level")
        .eq("user_id", selectedChildId!)
        .maybeSingle();
      return data;
    },
  });

  const classeId = childProfile?.classe_id || child?.classe_id;
  const filiereId = childProfile?.filiere_id || child?.filiere_id;
  const level = childProfile?.level || child?.level;

  const { data: events = [] } = useQuery({
    queryKey: ["parent-planning", selectedChildId, classeId, filiereId, level],
    enabled: !!classeId || (!!filiereId && !!level),
    queryFn: async () => {
      let q = supabase
        .from("schedule_events")
        .select("*, classrooms(name)")
        .gte("start_time", new Date().toISOString())
        .order("start_time")
        .limit(50);
      if (classeId) {
        q = q.eq("classe_id", classeId);
      } else {
        q = q.eq("filiere_id", filiereId).eq("level", level);
      }
      const { data } = await q;
      return data || [];
    },
  });


  return (
    <Card>
      <CardHeader><CardTitle>Planning à venir</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {events.length === 0 && <p className="text-sm text-muted-foreground">Aucune séance planifiée.</p>}
        {events.map((e: any) => (
          <div key={e.id} className="p-3 rounded-lg border flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold truncate">{e.title}</p>
              <p className="text-xs text-muted-foreground">{new Date(e.start_time).toLocaleString("fr-FR")}{e.classrooms?.name ? ` • Salle ${e.classrooms.name}` : ""}</p>
            </div>
            <span className="text-xs px-2 py-1 rounded bg-muted">{e.event_type || "cours"}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default ParentPlanningPage;
