import { useState } from "react";
import { motion } from "framer-motion";
import { Building2, Users, GraduationCap, Inbox, ArrowRight } from "lucide-react";
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableHead, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.08 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

const SuperAdminDashboardPage = () => {
  const { profile } = useAuth();
  const navigate=useNavigate();
  const [studentsOpen, setStudentsOpen] = useState(false);

  const { data: institutions = [] } = useQuery({
    queryKey: ["sa-institutions"],
    queryFn: async () => {
      const { data } = await supabase.from("institutions").select("id, name, logo_url").order("name");
      return data || [];
    },
  });

  const { data: admins = [] } = useQuery({
    queryKey: ["sa-admins-count"],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
      return data || [];
    },
  });

  const { data: studentRoles = [] } = useQuery({
    queryKey: ["sa-student-roles"],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("user_id").eq("role", "user");
      return data || [];
    },
  });

  const { data: studentProfiles = [] } = useQuery({
    queryKey: ["sa-student-profiles", studentRoles.length],
    enabled: studentRoles.length > 0,
    queryFn: async () => {
      const ids = studentRoles.map((r: any) => r.user_id);
      const { data } = await supabase.from("profiles").select("user_id, institution_id").in("user_id", ids);
      return data || [];
    },
  });

  const totalStudents = studentRoles.length;
  const requests=useQuery({queryKey:['sa-pending-requests'],queryFn:async()=>{
    const {count,error}=await supabase.from('institution_preregistrations').select('*',{count:'exact',head:true}).eq('status','pending');
    if(error)throw error;return count??0;
  }});

  // count students per institution
  const perInstitution = institutions.map((inst: any) => {
    const count = studentProfiles.filter((p: any) => p.institution_id === inst.id).length;
    return { ...inst, count };
  }).sort((a: any, b: any) => b.count - a.count);

  const stats = [
    { label: "Établissements", value: institutions.length, icon: Building2, color: "from-blue-500 to-blue-600", onClick: () => navigate('/super-admin/institutions') },
    { label: "Administrateurs", value: admins.length, icon: Users, color: "from-blue-500 to-indigo-600", onClick: () => navigate('/super-admin/admins') },
    { label: "Étudiants total", value: totalStudents, icon: GraduationCap, color: "from-amber-500 to-orange-600", onClick: () => setStudentsOpen(true) },
    { label: "Dossiers en attente", value: requests.isError?'—':requests.isPending?'…':requests.data, icon: Inbox, color: "from-indigo-500 to-violet-600", onClick: () => navigate('/super-admin/preinscriptions') },
  ];

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={item}>
        <h1 className="text-3xl font-heading font-bold text-foreground">
          Tableau de bord <span className="text-indigo-500">Super Admin</span>
        </h1>
        <p className="text-muted-foreground mt-1">Bonjour {profile?.first_name || "Admin"}. Suivez les établissements et les demandes d’inscription.</p>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((s) => (
          <motion.div key={s.label} variants={item}>
            <Card
              onClick={s.onClick}
              role="button" tabIndex={0} aria-label={`${s.label} : ${s.value}. Ouvrir le détail`}
              onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();s.onClick();}}}
              className="dashboard-stat cursor-pointer border-border/50 overflow-hidden hover:shadow-lg transition-shadow"
            >
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{s.label}</p>
                    <p className="text-3xl font-bold text-foreground mt-1">{s.value}</p>
                    {s.label === "Étudiants total" && (
                      <p className="text-xs text-muted-foreground mt-1">Cliquez pour voir le détail</p>
                    )}
                  </div>
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center`}>
                    <s.icon className="w-6 h-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <Card><CardHeader className="flex-row flex-wrap items-center justify-between gap-3"><CardTitle className="workspace-card-title"><Building2/>Établissements de la plateforme</CardTitle><Link className="workspace-detail-link" to="/super-admin/institutions">Gérer les établissements <ArrowRight/></Link></CardHeader><CardContent>
        {institutions.length===0?<p className="py-10 text-center text-sm text-muted-foreground">Les établissements apparaîtront ici après leur création ou la validation d’un dossier.</p>:<Table><TableHeader><TableRow><TableHead>Établissement</TableHead><TableHead>Étudiants visibles</TableHead><TableHead className="text-right">Gestion</TableHead></TableRow></TableHeader><TableBody>{perInstitution.slice(0,8).map(inst=><TableRow key={inst.id}><TableCell><div className="flex items-center gap-3">{inst.logo_url?<img src={inst.logo_url} alt="" className="h-9 w-9 rounded-lg object-contain"/>:<span className="activity-symbol"><Building2/></span>}<span className="font-medium">{inst.name}</span></div></TableCell><TableCell>{inst.count}</TableCell><TableCell className="text-right"><Link className="workspace-detail-link" to="/super-admin/subscriptions">Abonnements <ArrowRight/></Link></TableCell></TableRow>)}</TableBody></Table>}
      </CardContent></Card>

      <Dialog open={studentsOpen} onOpenChange={setStudentsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Étudiants par établissement</DialogTitle></DialogHeader>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {perInstitution.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">Aucun établissement</p>
            ) : (
              perInstitution.map((inst: any) => (
                <div key={inst.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/40 border border-border/50">
                  <div className="flex items-center gap-3">
                    {inst.logo_url ? (
                      <img src={inst.logo_url} alt={`Logo ${inst.name}`} className="w-9 h-9 rounded-lg object-cover" />
                    ) : (
                      <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                        <Building2 className="w-4 h-4 text-white" />
                      </div>
                    )}
                    <span className="font-medium">{inst.name}</span>
                  </div>
                  <span className="text-lg font-bold text-foreground">{inst.count}</span>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};

export default SuperAdminDashboardPage;
