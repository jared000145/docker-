import { useCampus } from "@/hooks/useCampus";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, MapPin } from "lucide-react";

export const CampusSelector = () => {
  const { campuses, campusId, setCampusId, canSwitch, canViewAll, isLoading } = useCampus();

  if (isLoading || campuses.length <= 1 && !canSwitch) return null;

  // Hide if only one campus and user can't switch (single-campus institution)
  if (campuses.length <= 1 && campuses[0]?.is_main && !canSwitch) return null;

  return (
    <div className="hidden sm:flex items-center gap-2">
      <MapPin className="w-4 h-4 text-muted-foreground" />
      <Select
        value={campusId ?? (canViewAll ? "__all__" : campuses[0]?.id)}
        onValueChange={(v) => setCampusId(v === "__all__" ? null : v)}
      >
        <SelectTrigger className="h-8 w-[180px] text-xs">
          <SelectValue placeholder="Tous les campus" />
        </SelectTrigger>
        <SelectContent>
          {canViewAll && (
            <SelectItem value="__all__">
              <div className="flex items-center gap-2">
                <Building2 className="w-3.5 h-3.5" /> Tous les campus
              </div>
            </SelectItem>
          )}
          {campuses.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              <div className="flex items-center gap-2">
                <span className="font-medium">{c.name}</span>
                {c.is_main && <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">Principal</span>}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
