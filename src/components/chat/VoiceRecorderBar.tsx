import { Eye, Mic, Pause, Play, Square, Trash2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDuration, RecorderStatus } from "@/hooks/useVoiceRecorder";

interface Props {
  status: RecorderStatus;
  seconds: number;
  previewUrl: string | null;
  sending?: boolean;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onDiscard: () => void;
  onSend: () => void;
  viewOnce?: boolean;
  onViewOnceChange?: (value: boolean) => void;
}

/** Barre d'enregistrement vocal : pause/reprise, écoute avant envoi, corbeille. */
const VoiceRecorderBar = ({ status, seconds, previewUrl, sending, onPause, onResume, onStop, onDiscard, onSend, viewOnce, onViewOnceChange }: Props) => {
  if (status === "idle") return null;

  return (
    <div className="flex-1 flex items-center gap-2 min-w-0 h-auto min-h-10 px-3 py-2 rounded-2xl bg-secondary/40 border border-border/40">
      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={onDiscard} aria-label="Supprimer l'enregistrement">
        <Trash2 className="w-4 h-4" />
      </Button>

      {status === "preview" ? (
        <audio src={previewUrl || undefined} controls className="flex-1 min-w-0 h-9" />
      ) : (
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <Mic className={`w-4 h-4 text-destructive ${status === "recording" ? "animate-pulse" : "opacity-60"}`} />
          <span className="text-sm tabular-nums text-foreground">{formatDuration(seconds)}</span>
          <span className="text-xs text-muted-foreground truncate">
            {status === "recording" ? "Enregistrement..." : "En pause"}
          </span>
        </div>
      )}

      {status === "recording" && (
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={onPause} aria-label="Mettre en pause">
          <Pause className="w-4 h-4" />
        </Button>
      )}
      {status === "paused" && (
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={onResume} aria-label="Reprendre">
          <Play className="w-4 h-4" />
        </Button>
      )}
      {(status === "recording" || status === "paused") && (
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={onStop} aria-label="Terminer l'enregistrement">
          <Square className="w-4 h-4" />
        </Button>
      )}
      {status === "preview" && (
        <Button type="button" variant={viewOnce ? "default" : "outline"} size="icon" className="h-8 w-8 rounded-full" onClick={() => onViewOnceChange?.(!viewOnce)} aria-label={viewOnce ? "Désactiver la vue unique" : "Activer la vue unique"} title="Vue unique">
          <Eye className="w-4 h-4" />
        </Button>
      )}
      {status === "preview" && (
        <Button size="icon" className="h-8 w-8 rounded-full bg-accent text-accent-foreground hover:bg-accent/90" disabled={sending} onClick={onSend} aria-label="Envoyer le vocal">
          <Send className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
};

export default VoiceRecorderBar;
