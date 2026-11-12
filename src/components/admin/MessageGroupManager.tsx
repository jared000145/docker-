import { useState } from "react";
import { Users, Plus, Send, Trash2, UserPlus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useInstitution } from "@/hooks/useInstitution";
import { toast } from "sonner";

interface Props {
  filieres: any[];
  levels: string[];
  institutionId: string;
  students: any[];
}

export default function MessageGroupManager({ filieres, levels, institutionId, students }: Props) {
  const { user } = useAuth();
  const { institution } = useInstitution();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [groupName, setGroupName] = useState("");
  const [groupType, setGroupType] = useState("custom");
  const [groupFiliere, setGroupFiliere] = useState("all");
  const [groupLevel, setGroupLevel] = useState("all");
  const [msgSubject, setMsgSubject] = useState("");
  const [msgBody, setMsgBody] = useState("");

  const academicYear = institution?.academic_year || "2025-2026";

  const { data: groups = [] } = useQuery({
    queryKey: ["message-groups", institutionId],
    queryFn: async () => {
      const { data } = await supabase
        .from("message_groups")
        .select("*, message_group_members(count)")
        .eq("institution_id", institutionId)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!institutionId,
  });

  const createGroupMutation = useMutation({
    mutationFn: async () => {
      // Create the group
      const { data: group, error } = await supabase
        .from("message_groups")
        .insert({
          name: groupName,
          group_type: groupType,
          filiere_id: groupFiliere !== "all" ? groupFiliere : null,
          level: groupLevel !== "all" ? groupLevel : null,
          institution_id: institutionId,
          academic_year: academicYear,
          created_by: user!.id,
        })
        .select()
        .single();
      if (error) throw error;

      // Auto-populate members based on type
      let memberIds: string[] = [];
      if (groupType === "classe") {
        memberIds = students.filter(s =>
          (groupFiliere === "all" || s.filiere_id === groupFiliere) &&
          (groupLevel === "all" || s.level === groupLevel)
        ).map(s => s.user_id);
      } else if (groupType === "filiere") {
        memberIds = students.filter(s => s.filiere_id === groupFiliere).map(s => s.user_id);
      } else if (groupType === "niveau") {
        memberIds = students.filter(s => s.level === groupLevel).map(s => s.user_id);
      }

      if (memberIds.length > 0) {
        await supabase.from("message_group_members").insert(
          memberIds.map(uid => ({ group_id: group.id, user_id: uid }))
        );
      }

      return { group, memberCount: memberIds.length };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["message-groups"] });
      toast.success(`Groupe "${groupName}" créé avec ${data.memberCount} membre(s)`);
      setCreateOpen(false);
      setGroupName("");
      setGroupType("custom");
      setGroupFiliere("all");
      setGroupLevel("all");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteGroupMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("message_groups").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["message-groups"] });
      toast.success("Groupe supprimé");
    },
  });

  const sendGroupMessageMutation = useMutation({
    mutationFn: async () => {
      if (!selectedGroupId) throw new Error("Aucun groupe sélectionné");
      // Fetch members
      const { data: members } = await supabase
        .from("message_group_members")
        .select("user_id")
        .eq("group_id", selectedGroupId);

      if (!members?.length) throw new Error("Le groupe est vide");

      const inserts = members.map(m => ({
        sender_id: user!.id,
        recipient_id: m.user_id,
        subject: msgSubject,
        body: msgBody,
      }));

      const { error } = await supabase.from("messages").insert(inserts);
      if (error) throw error;
      return members.length;
    },
    onSuccess: (count) => {
      toast.success(`Message envoyé à ${count} membre(s)`);
      setSendOpen(false);
      setMsgSubject("");
      setMsgBody("");
      setSelectedGroupId(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "classe": return "Classe";
      case "filiere": return "Filière";
      case "niveau": return "Niveau";
      default: return "Personnalisé";
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "classe": return "bg-primary/15 text-primary";
      case "filiere": return "bg-accent/15 text-accent";
      case "niveau": return "bg-info/15 text-info";
      default: return "bg-secondary text-foreground";
    }
  };

  return (
    <>
      <Card className="glass-card-elevated border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="w-5 h-5 text-accent" /> Groupes de messages
            </CardTitle>
            <Button size="sm" className="gap-2" onClick={() => setCreateOpen(true)}>
              <Plus className="w-4 h-4" /> Créer un groupe
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {groups.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Aucun groupe créé</p>
          ) : (
            <div className="space-y-2">
              {groups.map((g: any) => {
                const memberCount = g.message_group_members?.[0]?.count || 0;
                return (
                  <div key={g.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-accent/15 flex items-center justify-center flex-shrink-0">
                        <Users className="w-5 h-5 text-accent" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm text-foreground truncate">{g.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="outline" className={`text-[10px] ${getTypeColor(g.group_type)}`}>
                            {getTypeLabel(g.group_type)}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{memberCount} membre(s)</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => { setSelectedGroupId(g.id); setSendOpen(true); }}
                      >
                        <Send className="w-4 h-4 text-accent" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => deleteGroupMutation.mutate(g.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Group Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-accent" /> Créer un groupe
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground">Nom du groupe</label>
              <Input value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="Ex: L2 Informatique 2025" className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Type de groupe</label>
              <Select value={groupType} onValueChange={setGroupType}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="classe">📚 Classe (filière + niveau)</SelectItem>
                  <SelectItem value="filiere">🏫 Filière entière</SelectItem>
                  <SelectItem value="niveau">📊 Niveau entier</SelectItem>
                  <SelectItem value="custom">✏️ Personnalisé</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(groupType === "classe" || groupType === "filiere") && (
              <div>
                <label className="text-sm font-medium text-foreground">Filière</label>
                <Select value={groupFiliere} onValueChange={setGroupFiliere}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes</SelectItem>
                    {filieres.map((f: any) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {(groupType === "classe" || groupType === "niveau") && (
              <div>
                <label className="text-sm font-medium text-foreground">Niveau</label>
                <Select value={groupLevel} onValueChange={setGroupLevel}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous</SelectItem>
                    {levels.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {groupType !== "custom" && (
              <p className="text-xs text-muted-foreground">
                {students.filter(s => {
                  const mF = groupFiliere === "all" || s.filiere_id === groupFiliere;
                  const mL = groupLevel === "all" || s.level === groupLevel;
                  if (groupType === "classe") return mF && mL;
                  if (groupType === "filiere") return mF;
                  if (groupType === "niveau") return mL;
                  return false;
                }).length} étudiant(s) seront ajoutés automatiquement
              </p>
            )}
            <Button
              onClick={() => createGroupMutation.mutate()}
              disabled={!groupName || createGroupMutation.isPending}
              className="w-full gradient-gold text-accent-foreground gap-2"
            >
              <Plus className="w-4 h-4" /> Créer le groupe
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Send Group Message Dialog */}
      <Dialog open={sendOpen} onOpenChange={setSendOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-5 h-5 text-accent" /> Envoyer au groupe
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input placeholder="Objet" value={msgSubject} onChange={e => setMsgSubject(e.target.value)} />
            <Textarea placeholder="Votre message..." value={msgBody} onChange={e => setMsgBody(e.target.value)} rows={4} />
            <Button
              onClick={() => sendGroupMessageMutation.mutate()}
              disabled={!msgBody || sendGroupMessageMutation.isPending}
              className="w-full gradient-gold text-accent-foreground gap-2"
            >
              <Send className="w-4 h-4" /> Envoyer
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
