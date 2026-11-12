import {useCampus} from "@/hooks/useCampus";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useInstitution } from "@/hooks/useInstitution";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

const fmt = (n: number) => (n || 0).toLocaleString("fr-FR") + " FCFA";

export default function FinanceHistoryTab() {
  const { institution, getLevels } = useInstitution();
  const instId = institution?.id;
  const {campusId} = useCampus();
  const LEVELS = getLevels();

  const [year, setYear] = useState("all");
  const [filiere, setFiliere] = useState("all");
  const [level, setLevel] = useState("all");
  const [status, setStatus] = useState("all");
  const [feeType, setFeeType] = useState("all");
  const [month, setMonth] = useState("all");
  const [search, setSearch] = useState("");

  const { data: payments = [] } = useQuery({
    queryKey: ["fin-history-payments", instId, campusId],
    enabled: !!instId,
    queryFn: async () => {
      const { data } = await supabase.from("payments").select("*")
        .eq("institution_id", instId!).order("created_at", { ascending: false }).limit(2000);
      return (data || []).filter((row: any) => !campusId || !("campus_id" in row) || row.campus_id === campusId);
    },
  });
  const { data: students = [] } = useQuery({
    queryKey: ["fin-history-students", instId, campusId],
    enabled: !!instId,
    queryFn: async () => {
      const { data } = await supabase.from("profiles")
        .select("user_id, first_name, last_name, filiere_id, level, student_number, campus_id")
        .eq("institution_id", instId!);
      return (data || []).filter((row: any) => !campusId || !("campus_id" in row) || row.campus_id === campusId);
    },
  });
  const { data: filieres = [] } = useQuery({
    queryKey: ["fin-history-fil", instId, campusId],
    enabled: !!instId,
    queryFn: async () => {
      const { data } = await supabase.from("filieres").select("id, name").eq("institution_id", instId!);
      return (data || []).filter((row: any) => !campusId || !("campus_id" in row) || row.campus_id === campusId);
    },
  });
  const { data: feeTypes = [] } = useQuery({
    queryKey: ["fin-history-fees", instId, campusId],
    enabled: !!instId,
    queryFn: async () => {
      const { data } = await supabase.from("fee_types").select("label").eq("institution_id", instId!);
      return (data || []).filter((row: any) => !campusId || !("campus_id" in row) || row.campus_id === campusId);
    },
  });

  const stuMap = new Map(students.map((s: any) => [s.user_id, s]));
  const filMap = new Map(filieres.map((f: any) => [f.id, f.name]));

  const years = useMemo(() => Array.from(new Set(payments.map((p: any) => p.academic_year).filter(Boolean))), [payments]);

  const filtered = useMemo(() => payments.filter((p: any) => {
    const s: any = stuMap.get(p.user_id);
    if (year !== "all" && p.academic_year !== year) return false;
    if (status !== "all" && p.status !== status) return false;
    if (feeType !== "all" && p.description !== feeType) return false;
    if (filiere !== "all" && s?.filiere_id !== filiere) return false;
    if (level !== "all" && s?.level !== level) return false;
    if (month !== "all") {
      const d = new Date(p.payment_date || p.created_at);
      if (`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` !== month) return false;
    }
    if (search && s) {
      const q = search.toLowerCase();
      if (!`${s.first_name} ${s.last_name} ${s.student_number || ""}`.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [payments, year, status, feeType, filiere, level, month, search, stuMap]);

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Historique ({filtered.length})</CardTitle></CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-7 gap-2 mb-4">
          <Input placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)} className="col-span-2" />
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger><SelectValue placeholder="Année" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes années</SelectItem>
              {years.map((y: any) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filiere} onValueChange={setFiliere}>
            <SelectTrigger><SelectValue placeholder="Filière" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes filières</SelectItem>
              {filieres.map((f: any) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={level} onValueChange={setLevel}>
            <SelectTrigger><SelectValue placeholder="Niveau" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous niveaux</SelectItem>
              {LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={feeType} onValueChange={setFeeType}>
            <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous types</SelectItem>
              {feeTypes.map((f: any) => <SelectItem key={f.label} value={f.label}>{f.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue placeholder="Statut" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              <SelectItem value="paid">Payé</SelectItem>
              <SelectItem value="partial">Partiel</SelectItem>
              <SelectItem value="pending">Non payé</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="text-left p-2">Date</th>
                <th className="text-left p-2">Étudiant</th>
                <th className="text-left p-2">Filière</th>
                <th className="text-left p-2">Niveau</th>
                <th className="text-left p-2">Description</th>
                <th className="text-center p-2">Montant</th>
                <th className="text-center p-2">Payé</th>
                <th className="text-center p-2">Statut</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 500).map((p: any) => {
                const s: any = stuMap.get(p.user_id);
                return (
                  <tr key={p.id} className="border-b hover:bg-secondary/20">
                    <td className="p-2 text-xs">{new Date(p.payment_date || p.created_at).toLocaleDateString("fr-FR")}</td>
                    <td className="p-2">{s ? `${s.first_name} ${s.last_name}` : "—"}</td>
                    <td className="p-2 text-muted-foreground">{s ? filMap.get(s.filiere_id) || "—" : "—"}</td>
                    <td className="p-2">{s?.level || "—"}</td>
                    <td className="p-2">{p.description}</td>
                    <td className="p-2 text-center">{fmt(p.amount)}</td>
                    <td className="p-2 text-center text-success">{fmt(p.paid_amount)}</td>
                    <td className="p-2 text-center"><Badge variant={p.status === "paid" ? "default" : "secondary"}>{p.status === "paid" ? "Payé" : p.status === "partial" ? "Partiel" : p.status === "failed" ? "Échec" : "Non payé"}</Badge></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
