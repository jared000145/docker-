import { Calendar, History } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useAcademicYear } from "@/hooks/useAcademicYear";

interface Props {
  className?: string;
  showLabel?: boolean;
}

export const AcademicYearSelector = ({ className = "", showLabel = true }: Props) => {
  const { selectedYear, setSelectedYear, availableYears, currentYear, isViewingHistory } = useAcademicYear();

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {showLabel && (
        <Calendar className="w-4 h-4 text-muted-foreground" />
      )}
      <Select value={selectedYear} onValueChange={setSelectedYear}>
        <SelectTrigger className="h-9 w-[160px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {availableYears.map((y) => (
            <SelectItem key={y} value={y}>
              <div className="flex items-center gap-2">
                <span>{y}</span>
                {y === currentYear && (
                  <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">Active</Badge>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {isViewingHistory && (
        <Badge variant="outline" className="gap-1 text-[10px] border-warning/50 text-warning">
          <History className="w-3 h-3" /> Historique
        </Badge>
      )}
    </div>
  );
};
