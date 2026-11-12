import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useParentContext } from "@/components/ParentLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { GraduationCap, ClipboardCheck, CreditCard, Bell, TrendingUp } from "lucide-react";

const ParentDashboardPage = () => {
  const { selectedChildId, children } = useParentContext();
  const child: any = children.find((c: any) => c.user_id === selectedChildId);

  const { data: stats } = useQuery({
    queryKey: ["parent-stats", selectedChildId],
    enabled: !!selectedChildId,
    queryFn: async () => {
      const [grades, payments, attendance, notifs, filiere] = await Promise.all([
        supabase.from("grades").select("average").eq("user_id", selectedChildId!),
        supabase.from("payments").select("amount, paid_amount").eq("user_id", selectedChildId!),
        supabase.from("attendance").select("status, date").eq("user_id", selectedChildId!).gte("date", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)),
        supabase.from("notifications").select("*").eq("user_id", selectedChildId!).order("created_at", { ascending: false }).limit(5),
        child?.filiere_id ? supabase.from("filieres").select("name").eq("id", child.filiere_id).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      const avgs = (grades.data || []).map((g: any) => Number(g.average)).filter((n) => !isNaN(n));
      const moyenne = avgs.length ? (avgs.reduce((a, b) => a + b, 0) / avgs.length).toFixed(2) : "—";
      const totalDue = (payments.data || []).reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
      const totalPaid = (payments.data || []).reduce((s: number, p: any) => s + Number(p.paid_amount || 0), 0);
      const restant = totalDue - totalPaid;
      const absences = (attendance.data || []).filter((a: any) => a.status === "absent").length;
      return { moyenne, restant, absences, notifs: notifs.data || [], filiere: (filiere as any).data?.name || "—" };
    },
  });

  if (!child) return <div className="text-muted-foreground">Aucun enfant lié à votre compte. Contactez l'établissement.</div>;

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex items-center gap-4 p-6">
          <Avatar className="w-20 h-20">
            <AvatarImage src={child.avatar_url || undefined} />
            <AvatarFallback className="text-2xl">{child.first_name?.[0]}{child.last_name?.[0]}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <h1 className="text-2xl font-heading font-bold">{child.first_name} {child.last_name}</h1>
            <p className="text-sm text-muted-foreground">Matricule : {child.student_number || "—"}</p>
            <div className="flex flex-wrap gap-2 mt-2">
              <Badge variant="secondary">{stats?.filiere}</Badge>
              <Badge variant="outline">{child.level || "—"}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={TrendingUp} label="Moyenne actuelle" value={stats?.moyenne ?? "—"} suffix="/20" />
        <StatCard icon={ClipboardCheck} label="Absences ce mois" value={stats?.absences ?? 0} />
        <StatCard icon={CreditCard} label="Restant à payer" value={(stats?.restant ?? 0).toLocaleString()} suffix=" FCFA" />
        <StatCard icon={GraduationCap} label="Niveau" value={child.level || "—"} />
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Bell className="w-5 h-5" /> Dernières notifications</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {(stats?.notifs || []).length === 0 && <p className="text-sm text-muted-foreground">Aucune notification.</p>}
          {(stats?.notifs || []).map((n: any) => (
            <div key={n.id} className="p-3 rounded-lg border bg-muted/30">
              <p className="text-sm font-semibold">{n.title}</p>
              <p className="text-xs text-muted-foreground">{n.message}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

const StatCard = ({ icon: Icon, label, value, suffix }: any) => (
  <Card>
    <CardContent className="p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center"><Icon className="w-5 h-5 text-primary" /></div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-bold truncate">{value}{suffix || ""}</p>
      </div>
    </CardContent>
  </Card>
);

export default ParentDashboardPage;
