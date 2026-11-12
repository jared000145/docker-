import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Download, FileCheck2, FileText, Filter, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useInstitution } from "@/hooks/useInstitution";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ALL = "all";

export default function AdminPVPage() {
  const { profile } = useAuth();
  const { getLevels } = useInstitution();
  const instId = profile?.institution_id;
  const levels = getLevels();
  const [search, setSearch] = useState("");
  const [filiereId, setFiliereId] = useState(ALL);
  const [level, setLevel] = useState(ALL);
  const [semester, setSemester] = useState(ALL);
  const [status, setStatus] = useState(ALL);

  const { data: filieres = [] } = useQuery({
    queryKey: ["pv-filieres", instId],
    queryFn: async () => {
      let q = supabase.from("filieres").select("id,name").order("name");
      if (instId) q = q.eq("institution_id", instId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!instId,
  });

  const { data: subjects = [], isLoading } = useQuery({
    queryKey: ["admin-pv-subjects", instId],
    queryFn: async () => {
      let q = supabase
        .from("subjects")
        .select("id,name,code,level,semester,professor,filiere_id,pv_url,pv_uploaded_at,pv_academic_year,pv_semester,filieres(name)")
        .order("name");
      if (instId) q = q.eq("institution_id", instId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!instId,
  });

  const stats = useMemo(() => {
    const uploaded = (subjects as any[]).filter((s) => !!s.pv_url).length;
    return { total: subjects.length, uploaded, missing: subjects.length - uploaded };
  }, [subjects]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (subjects as any[]).filter((s) => {
      if (filiereId !== ALL && s.filiere_id !== filiereId) return false;
      if (level !== ALL && s.level !== level) return false;
      if (semester !== ALL && s.semester !== semester) return false;
      if (status === "available" && !s.pv_url) return false;
      if (status === "missing" && s.pv_url) return false;
      if (!needle) return true;
      const haystack = `${s.name ?? ""} ${s.code ?? ""} ${s.professor ?? ""} ${s.filieres?.name ?? ""}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [subjects, search, filiereId, level, semester, status]);

  const openPV = async (path?: string | null) => {
    if (!path) return toast.error("Aucun PV disponible");
    const { data, error } = await supabase.storage.from("pv-professeurs").createSignedUrl(path, 60 * 5);
    if (error || !data?.signedUrl) return toast.error("Impossible d'ouvrir le PV");
    window.open(data.signedUrl, "_blank");
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-heading font-bold flex items-center gap-3">
            <FileCheck2 className="w-7 h-7 text-accent" /> PV des matières
          </h1>
          <p className="text-muted-foreground">Procès-verbaux transmis par les professeurs, par filière, niveau et semestre.</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="glass-card border-border/50"><CardContent className="p-4"><p className="text-sm text-muted-foreground">Matières</p><p className="text-2xl font-bold">{stats.total}</p></CardContent></Card>
        <Card className="glass-card border-border/50"><CardContent className="p-4"><p className="text-sm text-muted-foreground">PV disponibles</p><p className="text-2xl font-bold text-primary">{stats.uploaded}</p></CardContent></Card>
        <Card className="glass-card border-border/50"><CardContent className="p-4"><p className="text-sm text-muted-foreground">PV manquants</p><p className="text-2xl font-bold text-destructive">{stats.missing}</p></CardContent></Card>
      </div>

      <Card className="glass-card-elevated border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Filter className="w-4 h-4" /> Filtres</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-5">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Matière, professeur, code…" className="pl-9" />
          </div>
          <Select value={filiereId} onValueChange={setFiliereId}>
            <SelectTrigger><SelectValue placeholder="Filière" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Toutes filières</SelectItem>
              {(filieres as any[]).map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={level} onValueChange={setLevel}>
            <SelectTrigger><SelectValue placeholder="Niveau" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Tous niveaux</SelectItem>
              {levels.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue placeholder="Statut" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Tous statuts</SelectItem>
              <SelectItem value="available">PV disponible</SelectItem>
              <SelectItem value="missing">PV manquant</SelectItem>
            </SelectContent>
          </Select>
          <Select value={semester} onValueChange={setSemester}>
            <SelectTrigger><SelectValue placeholder="Semestre" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Tous semestres</SelectItem>
              <SelectItem value="S1">S1</SelectItem>
              <SelectItem value="S2">S2</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card className="glass-card-elevated border-border/50 overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  <th className="text-left p-4 text-sm font-semibold">Matière</th>
                  <th className="text-left p-4 text-sm font-semibold">Filière</th>
                  <th className="text-center p-4 text-sm font-semibold">Niveau</th>
                  <th className="text-center p-4 text-sm font-semibold">Semestre</th>
                  <th className="text-left p-4 text-sm font-semibold">Professeur</th>
                  <th className="text-center p-4 text-sm font-semibold">Statut</th>
                  <th className="text-center p-4 text-sm font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Chargement…</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Aucun PV trouvé.</td></tr>
                ) : filtered.map((s: any) => (
                  <tr key={s.id} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                    <td className="p-4">
                      <div className="font-medium">{s.name}</div>
                      <div className="text-xs text-muted-foreground">{s.code || "—"}</div>
                    </td>
                    <td className="p-4 text-sm text-muted-foreground">{s.filieres?.name || "—"}</td>
                    <td className="p-4 text-center"><Badge variant="secondary">{s.level || "—"}</Badge></td>
                    <td className="p-4 text-center"><Badge variant="outline">{s.pv_semester || s.semester || "—"}</Badge></td>
                    <td className="p-4 text-sm text-muted-foreground">{s.professor || "—"}</td>
                    <td className="p-4 text-center">
                      {s.pv_url ? (
                        <div className="flex flex-col items-center gap-1">
                          <Badge className="gap-1"><FileText className="w-3 h-3" /> Disponible</Badge>
                          {s.pv_uploaded_at && <span className="text-[11px] text-muted-foreground">{format(new Date(s.pv_uploaded_at), "dd MMM yyyy", { locale: fr })}</span>}
                        </div>
                      ) : <Badge variant="outline">Manquant</Badge>}
                    </td>
                    <td className="p-4 text-center">
                      <Button size="sm" variant={s.pv_url ? "default" : "outline"} disabled={!s.pv_url} onClick={() => openPV(s.pv_url)}>
                        <Download className="w-4 h-4 mr-1" /> Ouvrir
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}