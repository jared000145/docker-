import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useInstitution } from "@/hooks/useInstitution";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Download, ExternalLink } from "lucide-react";

const docLabel = (t: string) => ({
  receipt: "Reçu",
  attestation: "Attestation",
  inscription: "Fiche d'inscription",
  bulletin: "Bulletin",
  releve: "Relevé",
  autre: "Autre",
}[t] || t);

export default function FinanceDocumentsTab() {
  const { institution } = useInstitution();
  const instId = institution?.id;
  const [search, setSearch] = useState("");
  const [fType, setFType] = useState("all");
  const [fYear, setFYear] = useState("all");

  const { data: docs = [] } = useQuery({
    queryKey: ["fin-docs", instId],
    enabled: !!instId,
    queryFn: async () => {
      const { data } = await supabase.from("student_documents").select("*")
        .eq("institution_id", instId!).order("created_at", { ascending: false }).limit(1000);
      return data || [];
    },
  });
  const { data: students = [] } = useQuery({
    queryKey: ["fin-docs-stu", instId],
    enabled: !!instId,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, first_name, last_name, student_number").eq("institution_id", instId!);
      return data || [];
    },
  });
  const stuMap = useMemo(() => new Map(students.map((s: any) => [s.user_id, s])), [students]);

  const years = useMemo(() => Array.from(new Set(docs.map((d: any) => d.academic_year).filter(Boolean))).sort().reverse(), [docs]);
  const types = useMemo(() => Array.from(new Set(docs.map((d: any) => d.doc_type))), [docs]);

  const filtered = useMemo(() => docs.filter((d: any) => {
    if (fType !== "all" && d.doc_type !== fType) return false;
    if (fYear !== "all" && d.academic_year !== fYear) return false;
    if (search) {
      const s: any = stuMap.get(d.user_id);
      const q = search.toLowerCase();
      const hay = `${d.title} ${s ? s.first_name + " " + s.last_name + " " + (s.student_number || "") : ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }), [docs, fType, fYear, search, stuMap]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-3 grid grid-cols-2 md:grid-cols-4 gap-2">
          <Input placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)} className="col-span-2" />
          <Select value={fType} onValueChange={setFType}>
            <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous types</SelectItem>
              {types.map((t: any) => <SelectItem key={t} value={t}>{docLabel(t)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={fYear} onValueChange={setFYear}>
            <SelectTrigger><SelectValue placeholder="Année" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes années</SelectItem>
              {years.map((y: any) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Documents ({filtered.length})</CardTitle></CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-6">Aucun document.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="text-left p-2">Date</th>
                    <th className="text-left p-2">Étudiant</th>
                    <th className="text-left p-2">Type</th>
                    <th className="text-left p-2">Titre</th>
                    <th className="text-center p-2">Année</th>
                    <th className="text-center p-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((d: any) => {
                    const s: any = stuMap.get(d.user_id);
                    const verifyUrl = `${window.location.origin}/verify/document?id=${d.id}`;
                    return (
                      <tr key={d.id} className="border-b hover:bg-secondary/20">
                        <td className="p-2 text-xs">{new Date(d.created_at).toLocaleDateString("fr-FR")}</td>
                        <td className="p-2">{s ? `${s.last_name} ${s.first_name}` : "—"}</td>
                        <td className="p-2"><Badge variant="secondary">{docLabel(d.doc_type)}</Badge></td>
                        <td className="p-2"><div className="flex items-center gap-1"><FileText className="w-3 h-3 text-muted-foreground" /> {d.title}</div></td>
                        <td className="p-2 text-center text-muted-foreground">{d.academic_year || "—"}</td>
                        <td className="p-2 text-center">
                          <div className="flex justify-center gap-1">
                            {d.file_url && (
                              <Button size="sm" variant="outline" className="h-7" asChild>
                                <a href={d.file_url} target="_blank" rel="noreferrer"><Download className="w-3 h-3" /></a>
                              </Button>
                            )}
                            <Button size="sm" variant="outline" className="h-7" asChild>
                              <a href={verifyUrl} target="_blank" rel="noreferrer"><ExternalLink className="w-3 h-3" /></a>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
