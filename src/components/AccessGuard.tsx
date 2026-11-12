import { useStudentAccess } from "@/hooks/useStudentAccess";
import { AlertCircle, Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function AccessBanner() {
  const { data } = useStudentAccess();
  if (!data || data.status === "active") return null;
  const tone = data.allowed ? "border-amber-300 bg-amber-50 text-amber-900" : "border-red-300 bg-red-50 text-red-900";
  return (
    <div className={`flex items-start gap-3 rounded-lg border px-4 py-3 mb-4 ${tone}`}>
      <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
      <div className="text-sm">
        <p className="font-semibold">Accès restreint</p>
        <p>{data.reason}</p>
      </div>
    </div>
  );
}

export function FeatureGate({ feature, children }: { feature: string; children: React.ReactNode }) {
  const { data } = useStudentAccess();
  if (!data) return <>{children}</>;
  const blocked = !data.allowed || data.restricted.includes("all") || data.restricted.includes(feature);
  if (!blocked) return <>{children}</>;
  return (
    <Card className="border-dashed">
      <CardContent className="p-8 text-center space-y-2">
        <Lock className="w-10 h-10 mx-auto text-muted-foreground" />
        <p className="font-semibold">Module indisponible</p>
        <p className="text-sm text-muted-foreground">{data.reason || "Cette section est temporairement bloquée."}</p>
      </CardContent>
    </Card>
  );
}
