import {useNavigate} from 'react-router-dom';
import {useAcademicYear} from '@/hooks/useAcademicYear';
import {AcademicYearSelector} from '@/components/AcademicYearSelector';
import {useCampus} from '@/hooks/useCampus';
import {useAuth} from '@/hooks/useAuth';
import {usePermissions} from '@/hooks/usePermissions';
import {saveWorkbook} from "@/lib/nativeExports";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Shield, Search, Download } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

const STATUS_LABELS: Record<string, { label: string; tone: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: {label:"Inscription préparée",tone:"outline"},
  completed: {label:"Année terminée",tone:"secondary"},
  active: { label: "Actif", tone: "default" },
  blocked_unpaid: { label: "Non soldé", tone: "destructive" },
  blocked_unregistered: { label: "Non réinscrit", tone: "destructive" },
  end_of_cycle_archived: { label: "Fin de cycle (archivé actif)", tone: "secondary" },
  repeating: { label: "Redoublant", tone: "outline" },
  expelled: { label: "Exclu", tone: "destructive" },
  dropped: { label: "Abandon", tone: "secondary" },
  transferred: { label: "Transféré", tone: "secondary" },
};

export default function AdminAccessControlPage() {
  const qc = useQueryClient();
  const navigate=useNavigate(),{profile}=useAuth(),{campusId}=useCampus(),{can}=usePermissions();
  const {selectedYear,isViewingHistory}=useAcademicYear();
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");

  const { data: rows, isLoading, isError } = useQuery({
    queryKey: ["student-access-list",profile?.institution_id,selectedYear,campusId],
    enabled:!!profile?.institution_id,
    queryFn: async () => {
      let query = (supabase as any)
        .from("student_years")
        .select("id, user_id, academic_year, niveau, enrollment_status, block_reason, can_access, updated_at")
        .eq('institution_id',profile!.institution_id).eq('academic_year',selectedYear)
        .order("updated_at", { ascending: false });
      if(campusId)query=query.eq('campus_id',campusId);
      const {data,error}=await query;if(error)throw error;
      if(!data?.length)return [];
      const people=new Map<string,any>();
      const ids=[...new Set<string>(data.map((row:any)=>row.user_id))];
      for(let offset=0;offset<ids.length;offset+=200){
        const result=await supabase.from('profiles').select('user_id,first_name,last_name,student_number,email').in('user_id',ids.slice(offset,offset+200));
        if(result.error)throw result.error;
        for(const person of result.data||[])people.set(person.user_id,person);
      }
      return data.filter((row:any)=>people.has(row.user_id)).map((row:any)=>({...row,profiles:people.get(row.user_id)}));
    },
  });

  const filtered = (rows ?? []).filter((r: any) => {
    if (tab !== "all" && r.enrollment_status !== tab) return false;
    if (!search) return true;
    const p = r.profiles;
    const blob = `${p?.first_name} ${p?.last_name} ${p?.student_number} ${p?.email}`.toLowerCase();
    return blob.includes(search.toLowerCase());
  });

  const setStatus = async (id: string, status: string, reason?: string) => {
    if(isViewingHistory||!can('etudiants'))return;
    if(!window.confirm(status==='active'?'Rétablir l’accès de cette inscription ?':'Suspendre l’accès de cette inscription ? Les notes et documents seront conservés.'))return;
    const { error } = await supabase.from("student_years").update({
      enrollment_status: status,
      block_reason: reason ?? null,
      can_access: !status.startsWith("blocked"),
      blocked_at: status.startsWith("blocked") ? new Date().toISOString() : null,
    }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Statut mis à jour"); qc.invalidateQueries({ queryKey: ["student-access-list"] }); }
  };

  const exportXLSX = () => {
    const data = filtered.map((r: any) => ({
      Matricule: r.profiles?.student_number, Nom: r.profiles?.last_name, Prenom: r.profiles?.first_name,
      Email: r.profiles?.email, Annee: r.academic_year, Niveau: r.niveau,
      Statut: STATUS_LABELS[r.enrollment_status]?.label ?? r.enrollment_status,
      Motif: r.block_reason ?? "",
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "Acces");
    saveWorkbook(wb, `acces_etudiants_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-heading font-bold flex items-center gap-3"><Shield className="w-7 h-7" /> Inscriptions & accès</h1>
          <p className="text-muted-foreground">Consultez les inscriptions annuelles et contrôlez l’accès au portail, sans supprimer le dossier scolaire.</p>
        </div>
        <AcademicYearSelector/>
        <Button variant="outline" onClick={exportXLSX}><Download className="w-4 h-4 mr-2" /> Exporter</Button>
      </div>

      <div className="rounded-xl border bg-blue-50/50 p-4 text-sm text-muted-foreground">L’inscription correspond à une année précise. Les passages et redoublements se préparent dans le parcours du dossier ; les exclusions se traitent dans « Exclusions & abandons ». {isViewingHistory?'Cette année est consultée en lecture seule.':''}</div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="all">Tous</TabsTrigger>
          <TabsTrigger value="blocked_unpaid">Non soldés</TabsTrigger>
          <TabsTrigger value="blocked_unregistered">Non réinscrits</TabsTrigger>
          <TabsTrigger value="end_of_cycle_archived">Fin de cycle</TabsTrigger>
          <TabsTrigger value="repeating">Redoublants</TabsTrigger>
          <TabsTrigger value="expelled">Exclus</TabsTrigger>
        </TabsList>

        <TabsContent value={tab}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="w-4 h-4" />
                <Input placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isError ? <p role="alert" className="text-sm text-destructive">Impossible de charger les inscriptions. Réessayez dans quelques instants.</p> : isLoading ? <p className="text-sm text-muted-foreground">Chargement…</p> :
                !filtered.length ? <p className="text-sm text-muted-foreground py-8 text-center">Aucun étudiant dans cette catégorie.</p> : (
                <div className="border rounded-lg divide-y">
                  {filtered.map((r: any) => {
                    const s = STATUS_LABELS[r.enrollment_status] ?? { label: r.enrollment_status, tone: "outline" as const };
                    return (
                      <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                        <div className="min-w-0">
                          <p className="font-medium">{r.profiles?.last_name} {r.profiles?.first_name} <span className="text-xs text-muted-foreground">({r.profiles?.student_number})</span></p>
                          <p className="text-xs text-muted-foreground">{r.academic_year} · {r.niveau} · <Badge variant={s.tone}>{s.label}</Badge>{r.block_reason && <span className="ml-2 italic">— {r.block_reason}</span>}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button variant="outline" size="sm" onClick={()=>navigate('/admin/students/'+r.user_id)}>Ouvrir le dossier</Button>
                          {!isViewingHistory&&can('etudiants')&&['active','blocked_unregistered'].includes(r.enrollment_status)&&<Button variant="outline" size="sm" onClick={()=>void setStatus(r.id,r.enrollment_status==='active'?'blocked_unregistered':'active',r.enrollment_status==='active'?'Accès suspendu par la scolarité':undefined)}>{r.enrollment_status==='active'?'Suspendre l’accès':'Rétablir l’accès'}</Button>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
