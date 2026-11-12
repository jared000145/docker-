import {useCampus} from "@/hooks/useCampus";
import { motion } from "framer-motion";
import { GraduationCap, Plus, Trash2, Pencil } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useInstitution } from "@/hooks/useInstitution";
import { useState } from "react";
import { toast } from "sonner";

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

const AdminFilieresPage = () => {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { getLevels } = useInstitution();
  const LEVELS = getLevels();
  const instId = profile?.institution_id;
  const {campusId} = useCampus();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", description: "" });

  const { data: filieres = [] } = useQuery({
    queryKey: ["admin-filieres", instId, campusId],
    queryFn: async () => {
      let q = supabase.from("filieres").select("*").order("name");
      if (instId) q = q.eq("institution_id", instId);
      if (campusId) q = q.or(`campus_id.is.null,campus_id.eq.${campusId}`);
      const { data } = await q;
      return data || [];
    },
    enabled: !!instId,
  });

  // Count students per filière
  const { data: studentCounts = {} } = useQuery({
    queryKey: ["admin-filiere-counts", instId, campusId],
    queryFn: async () => {
      let q = supabase.from("profiles").select("filiere_id");
      if (instId) q = q.eq("institution_id", instId);
      if (campusId) q = q.eq("campus_id", campusId);
      const { data } = await q;
      const counts: Record<string, number> = {};
      (data || []).forEach((p: any) => {
        if (p.filiere_id) counts[p.filiere_id] = (counts[p.filiere_id] || 0) + 1;
      });
      return counts;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editId) {
        const { error } = await supabase.from("filieres").update({ name: form.name, description: form.description || null }).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("filieres").insert({ name: form.name, description: form.description || null, institution_id: instId || null, campus_id: campusId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-filieres", campusId] });
      toast.success(editId ? "Filière modifiée" : "Filière créée");
      setOpen(false);
      setEditId(null);
      setForm({ name: "", description: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("filieres").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-filieres", campusId] });
      toast.success("Filière supprimée");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openEdit = (f: any) => {
    setEditId(f.id);
    setForm({ name: f.name, description: f.description || "" });
    setOpen(true);
  };

  const openCreate = () => {
    setEditId(null);
    setForm({ name: "", description: "" });
    setOpen(true);
  };

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground">Filières</h1>
          <p className="text-muted-foreground mt-1">{filieres.length} filière(s) — Cliquez sur un niveau pour voir ses classes, étudiants et matières</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditId(null); }}>
          <DialogTrigger asChild>
            <Button onClick={openCreate} className="gradient-gold text-accent-foreground gap-2"><Plus className="w-4 h-4" /> Ajouter</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editId ? "Modifier la filière" : "Nouvelle filière"}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <Input placeholder="Nom de la filière (ex: Informatique)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <Input placeholder="Description (optionnel)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              <Button onClick={() => saveMutation.mutate()} disabled={!form.name || saveMutation.isPending} className="w-full gradient-gold text-accent-foreground">
                {saveMutation.isPending ? "Enregistrement..." : editId ? "Modifier" : "Créer la filière"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </motion.div>

      <motion.div variants={item} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filieres.length === 0 ? (
          <Card className="col-span-full glass-card-elevated border-border/50">
            <CardContent className="p-8 text-center">
              <GraduationCap className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground">Aucune filière créée</p>
            </CardContent>
          </Card>
        ) : filieres.map((f: any) => (
          <Card key={f.id} className="glass-card-elevated border-border/50 hover:shadow-lg transition-all">
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-accent/15 text-accent">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => openEdit(f)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => deleteMutation.mutate(f.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
              <h3 className="font-heading font-semibold text-foreground text-lg">{f.name}</h3>
              {f.description && <p className="text-sm text-muted-foreground mt-1">{f.description}</p>}
              <div className="mt-4 flex items-center justify-between pt-3 border-t border-border/50">
                <span className="text-xs text-muted-foreground">{(studentCounts as any)[f.id] || 0} étudiant(s)</span>
                <div className="flex gap-1 flex-wrap justify-end">
                  {(LEVELS && LEVELS.length > 0 ? LEVELS : ["L1", "L2", "L3", "M1", "M2"]).map((lvl: string) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => navigate(`/admin/filieres/${f.id}/${encodeURIComponent(lvl)}`)}
                      className="text-[10px] font-medium bg-secondary/60 text-muted-foreground px-2 py-1 rounded transition-all cursor-pointer hover:bg-accent hover:text-accent-foreground hover:scale-110 hover:shadow-md"
                      title={`Voir la classe ${f.name} — ${lvl}`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </motion.div>
    </motion.div>
  );
};

export default AdminFilieresPage;
