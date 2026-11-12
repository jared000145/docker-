import {saveWorkbook} from "@/lib/nativeExports";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ShieldAlert, FileSpreadsheet, Wallet, Users, ClipboardCheck, FileText,
  Settings as SettingsIcon, GraduationCap, Layers, Download, Search, ArrowLeft,
} from "lucide-react";
import * as XLSX from "xlsx";

type Cat = {
  key: string; label: string; icon: any; description: string; tone: string;
};

const CATEGORIES: Cat[] = [
  { key: "notes", label: "Notes", icon: FileSpreadsheet, description: "Ajouts, modifications, suppressions de notes", tone: "from-blue-500/20 to-indigo-500/10" },
  { key: "finances", label: "Finances", icon: Wallet, description: "Paiements physiques enregistrés, échéances, frais", tone: "from-emerald-500/20 to-green-500/10" },
  { key: "utilisateurs", label: "Utilisateurs", icon: Users, description: "Créations, rôles, réinitialisations", tone: "from-violet-500/20 to-fuchsia-500/10" },
  { key: "presences", label: "Présences", icon: ClipboardCheck, description: "Marquage et modifications de présence", tone: "from-sky-500/20 to-cyan-500/10" },
  { key: "documents", label: "Documents", icon: FileText, description: "Génération, validation, rejet de documents", tone: "from-amber-500/20 to-orange-500/10" },
  { key: "parametres", label: "Paramètres", icon: SettingsIcon, description: "Modifications de configuration", tone: "from-slate-500/20 to-zinc-500/10" },
  { key: "scolarite", label: "Scolarité", icon: GraduationCap, description: "Filières, matières, UE, statuts annuels", tone: "from-rose-500/20 to-pink-500/10" },
  { key: "evenements", label: "Événements", icon: Layers, description: "Création et gestion d'événements", tone: "from-purple-500/20 to-indigo-500/10" },
  { key: "communication", label: "Communication", icon: Users, description: "Posts BDE et communauté", tone: "from-orange-500/20 to-red-500/10" },
];

function summarize(row: any): string {
  if (row.description) return row.description;
  return `${row.table_name} · ${row.action}`;
}

function describePayment(row: any): string | null {
  if (row.table_name !== "payments") return null;
  const nv = row.new_value || {};
  const ov = row.old_value || {};
  const amount = nv.paid_amount ?? nv.amount;
  if (row.action === "create") return `Paiement enregistré : ${amount ?? "?"} — ${nv.description ?? ""} (${nv.payment_method ?? "—"})`;
  if (row.action === "update") return `Paiement modifié : ${ov.paid_amount ?? "?"} → ${nv.paid_amount ?? "?"} (${nv.payment_method ?? "—"})`;
  if (row.action === "delete") return `Paiement supprimé : ${ov.paid_amount ?? "?"} — ${ov.description ?? ""}`;
  return null;
}

function describeGrade(row: any): string | null {
  if (row.table_name !== "grades") return null;
  const nv = row.new_value || {};
  const ov = row.old_value || {};
  const fields = ["cc_grade", "exam_grade", "average", "rattrapage_grade"];
  if (row.action === "create") return `Note ajoutée : moyenne ${nv.average ?? "?"}`;
  if (row.action === "update") {
    const diff = fields.filter(f => ov[f] !== nv[f]).map(f => `${f}: ${ov[f] ?? "—"} → ${nv[f] ?? "—"}`).join(", ");
    return diff ? `Note modifiée — ${diff}` : "Note modifiée";
  }
  if (row.action === "delete") return `Note supprimée (moyenne ${ov.average ?? "?"})`;
  return null;
}

export default function AdminAuditPage() {
  const [cat, setCat] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [action, setAction] = useState<string>("all");
  const [days, setDays] = useState<string>("30");

  const { data: rows, isLoading } = useQuery({
    queryKey: ["audit-logs", cat, action, days],
    queryFn: async () => {
      const since = new Date(Date.now() - parseInt(days) * 86400000).toISOString();
      let q = supabase
        .from("audit_logs")
        .select("*")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(500);
      if (cat !== "all") q = q.eq("categorie", cat);
      if (action !== "all") q = q.eq("action", action);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    if (!rows) return [];
    if (!search) return rows;
    const s = search.toLowerCase();
    return rows.filter((r: any) =>
      (r.user_email ?? "").toLowerCase().includes(s) ||
      (r.description ?? "").toLowerCase().includes(s) ||
      (r.table_name ?? "").toLowerCase().includes(s) ||
      JSON.stringify(r.new_value ?? {}).toLowerCase().includes(s)
    );
  }, [rows, search]);

  const exportCSV = () => {
    const data = filtered.map((r: any) => ({
      Date: new Date(r.created_at).toLocaleString(),
      Utilisateur: r.user_email ?? "",
      Rôle: r.user_role ?? "",
      Action: r.action,
      Table: r.table_name,
      Description: describePayment(r) || describeGrade(r) || summarize(r),
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "Audit");
    saveWorkbook(wb, `audit_${cat}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  if (cat === "categories") {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-heading font-bold flex items-center gap-3">
            <ShieldAlert className="w-7 h-7" /> Audit
          </h1>
          <p className="text-muted-foreground">Suivi de toutes les actions importantes du système.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              onClick={() => setCat(c.key)}
              className={`text-left rounded-xl border bg-gradient-to-br ${c.tone} p-5 hover:shadow-lg transition-shadow`}
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-lg bg-background/70 flex items-center justify-center">
                  <c.icon className="w-6 h-6" />
                </div>
                <div>
                  <p className="font-heading font-bold text-lg">{c.label}</p>
                  <p className="text-xs text-muted-foreground">{c.description}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const current = CATEGORIES.find((c) => c.key === cat) ?? { label: "Toutes", icon: ShieldAlert };
  return (
    <div className="p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setCat("categories")}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Catégories
          </Button>
          <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
            <current.icon className="w-6 h-6" /> Audit · {current.label}
          </h1>
        </div>
        <Button variant="outline" onClick={exportCSV} disabled={!filtered.length}>
          <Download className="w-4 h-4 mr-2" /> Exporter
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 flex-1 min-w-[220px]">
              <Search className="w-4 h-4 text-muted-foreground" />
              <Input placeholder="Recherche utilisateur, description…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={action} onValueChange={setAction}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Action" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes actions</SelectItem>
                <SelectItem value="create">Création</SelectItem>
                <SelectItem value="update">Modification</SelectItem>
                <SelectItem value="delete">Suppression</SelectItem>
              </SelectContent>
            </Select>
            <Select value={cat} onValueChange={setCat}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Catégorie" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes catégories</SelectItem>
                {CATEGORIES.map((c) => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Dernières 24h</SelectItem>
                <SelectItem value="7">7 jours</SelectItem>
                <SelectItem value="30">30 jours</SelectItem>
                <SelectItem value="90">90 jours</SelectItem>
                <SelectItem value="365">1 an</SelectItem>
              </SelectContent>
            </Select>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Chargement…</p>
          ) : !filtered.length ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Aucune action enregistrée sur la période.</p>
          ) : (
            <div className="border rounded-lg divide-y max-h-[70vh] overflow-auto">
              {filtered.map((r: any) => (
                <div key={r.id} className="p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant={r.action === "delete" ? "destructive" : r.action === "create" ? "default" : "secondary"}>
                        {r.action}
                      </Badge>
                      <span className="font-medium">{describePayment(r) || describeGrade(r) || summarize(r)}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {r.user_email ?? "système"}{r.user_role ? ` · ${r.user_role}` : ""} · {r.table_name}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
