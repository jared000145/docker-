import {useCampus} from '@/hooks/useCampus';
import { motion } from "framer-motion";
import { Bell, Send, Search, Lock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { useInstitution } from "@/hooks/useInstitution";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import { AcademicYearSelector } from "@/components/AcademicYearSelector";
import { useState,useEffect } from "react";
import { toast } from "sonner";

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

const AdminNotificationsPage = () => {
  const { getLevels } = useInstitution();
  const { profile,user } = useAuth();
  const { selectedYear, isViewingHistory } = useAcademicYear();
  const instId = profile?.institution_id;
  const {campusId}=useCampus();
  const LEVELS = getLevels();
  const qc = useQueryClient();
  const [recipientMode, setRecipientMode] = useState("student");
  const [selectedStudent, setSelectedStudent] = useState("");
  const [selectedFiliere, setSelectedFiliere] = useState("");
  const [selectedLevel, setSelectedLevel] = useState("all");
  const [filterFiliere, setFilterFiliere] = useState("all");
  const [filterLevel, setFilterLevel] = useState("all");
  const [searchFilter, setSearchFilter] = useState("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState("info");

  const { data: filieres = [] } = useQuery({
    queryKey: ["admin-filieres", instId],
    queryFn: async () => {
      let q = supabase.from("filieres").select("*").order("name");
      if (instId) q = q.eq("institution_id", instId);
      const { data } = await q;
      return data || [];
    },
  });

  const { data: students = [] } = useQuery({
    queryKey: ["notification-students",instId,campusId,recipientMode,recipientMode==='student'?searchFilter:''],enabled:!!instId,
    queryFn: async () => {
      const {data,error}=await (supabase as any).rpc(recipientMode==='student'?'contact_directory':'broadcast_recipients',recipientMode==='student'?{_campus:campusId,_search:searchFilter}:{_campus:campusId});if(error)throw error;
      return (data||[]).filter((person:any)=>recipientMode!=='student'||person.is_student);
    },
  });

  const { data: sentNotifs = [] } = useQuery({
    queryKey:['admin-sent-notifs',user?.id,instId,selectedYear,campusId],enabled:!!instId&&!!user,
    queryFn:async()=>{const{data,error}=await(supabase as any).rpc('notification_history',{_year:selectedYear,_campus:campusId});if(error)throw error;return data as any[];},
  });
  useEffect(()=>setSelectedStudent(''),[campusId,searchFilter,recipientMode]);

  useRealtimeSubscription("notifications", [["admin-sent-notifs"]]);

  const studentMap = new Map<string,any>((students as any[]).map(s => [s.user_id, s]));

  const filteredStudents = students.filter(s => {
    const matchFiliere = filterFiliere === "all" || s.filiere_id === filterFiliere;
    const matchLevel = filterLevel === "all" || s.level === filterLevel;
    const matchSearch = `${s.first_name} ${s.last_name} ${s.student_number}`.toLowerCase().includes(searchFilter.toLowerCase());
    return matchFiliere && matchLevel && matchSearch;
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      let targets: string[] = [];
      if (recipientMode === "all") {
        targets = students.map(s => s.user_id);
      } else if (recipientMode === "filiere") {
        targets = students.filter(s => {
          const matchF = s.filiere_id === selectedFiliere;
          const matchL = selectedLevel === "all" || s.level === selectedLevel;
          return matchF && matchL;
        }).map(s => s.user_id);
      } else {
        targets = [selectedStudent];
      }
      if (targets.length === 0) throw new Error("Aucun destinataire");
      const inserts = targets.map(uid => ({ user_id: uid, title, message, type, institution_id: instId || null }));
      const { error } = await supabase.from("notifications").insert(inserts);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-sent-notifs"] });
      toast.success("Notification envoyée");
      setSelectedStudent(""); setTitle(""); setMessage("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground">Notifications</h1>
          <p className="text-muted-foreground mt-1">
            {isViewingHistory 
              ? <span>Historique des notifications — {selectedYear} <span className="text-warning font-medium">(lecture seule)</span></span>
              : <>Envoyez des notifications ciblées par filière, niveau ou étudiant — <span className="text-foreground">{selectedYear}</span></>
            }
          </p>
        </div>
        <AcademicYearSelector />
      </motion.div>

      {!isViewingHistory && (
      <motion.div variants={item}>
        <Card className="glass-card-elevated border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-heading flex items-center gap-2">
              <Bell className="w-5 h-5 text-accent" /> Nouvelle notification
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select value={recipientMode} onValueChange={setRecipientMode}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">📢 Tous les étudiants</SelectItem>
                <SelectItem value="filiere">🏫 Par filière / niveau</SelectItem>
                <SelectItem value="student">👤 Étudiant spécifique</SelectItem>
              </SelectContent>
            </Select>

            {recipientMode === "filiere" && (
              <div className="grid grid-cols-2 gap-3">
                <Select value={selectedFiliere} onValueChange={setSelectedFiliere}>
                  <SelectTrigger><SelectValue placeholder="Filière" /></SelectTrigger>
                  <SelectContent>
                    {filieres.map((f: any) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={selectedLevel} onValueChange={setSelectedLevel}>
                  <SelectTrigger><SelectValue placeholder="Niveau" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous niveaux</SelectItem>
                    {LEVELS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {recipientMode === "student" && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Select value={filterFiliere} onValueChange={setFilterFiliere}>
                    <SelectTrigger><SelectValue placeholder="Filtrer par filière" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Toutes</SelectItem>
                      {filieres.map((f: any) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={filterLevel} onValueChange={setFilterLevel}>
                    <SelectTrigger><SelectValue placeholder="Filtrer par niveau" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous niveaux</SelectItem>
                      {LEVELS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input placeholder="Rechercher..." className="pl-9" value={searchFilter} onChange={(e) => setSearchFilter(e.target.value)} />
                  </div>
                </div>
                <Select value={selectedStudent} onValueChange={setSelectedStudent}>
                  <SelectTrigger><SelectValue placeholder="Choisir un étudiant" /></SelectTrigger>
                  <SelectContent>
                    {filteredStudents.map((s) => (
                      <SelectItem key={s.user_id} value={s.user_id}>{s.first_name} {s.last_name} {s.student_number ? `(${s.student_number})` : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}

            <Input placeholder="Titre de la notification" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Textarea placeholder="Message..." value={message} onChange={(e) => setMessage(e.target.value)} rows={3} />
            <div className="flex gap-3 items-end">
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="info">ℹ️ Info</SelectItem>
                  <SelectItem value="warning">⚠️ Avertissement</SelectItem>
                  <SelectItem value="success">✅ Succès</SelectItem>
                  <SelectItem value="error">❌ Erreur</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={() => sendMutation.mutate()} disabled={!title || !message || sendMutation.isPending || (recipientMode === "student" && !selectedStudent) || (recipientMode === "filiere" && !selectedFiliere)} className="gradient-gold text-accent-foreground gap-2 flex-1">
                <Send className="w-4 h-4" /> {sendMutation.isPending ? "Envoi..." : "Envoyer"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
      )}


      <motion.div variants={item}>
        <Card className="glass-card-elevated border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-heading">Historique</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {sentNotifs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Aucune notification envoyée</p>
            ) : sentNotifs.slice(0, 20).map((n: any) => {
              const s = studentMap.get(n.user_id);
              return (
                <div key={n.id} className="p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${n.type === "info" ? "bg-info/15 text-info" : n.type === "warning" ? "bg-warning/15 text-warning" : n.type === "success" ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>{n.type}</span>
                      <span className="text-xs text-muted-foreground ml-2">→ {s ? `${s.first_name} ${s.last_name}` : n.recipient_name||"Étudiant"}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</span>
                  </div>
                  <p className="text-sm font-medium text-foreground mt-1">{n.title}</p>
                  <p className="text-xs text-muted-foreground">{n.message}</p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
};

export default AdminNotificationsPage;
