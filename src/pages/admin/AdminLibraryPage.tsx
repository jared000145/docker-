import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { BookOpen, Plus, Trash2, Upload, RefreshCcw, Settings2, FileSearch, ExternalLink, Library, BookOpenCheck } from "lucide-react";
import PdfReader from "@/components/library/PdfReader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useInstitution } from "@/hooks/useInstitution";
import { toast } from "sonner";

const MODE_LABELS: Record<string, { label: string; color: string }> = {
  internal: { label: "Bibliothèque interne", color: "bg-blue-100 text-blue-800" },
  external_scraping: { label: "Scraping HTML", color: "bg-purple-100 text-purple-800" },
  api_public: { label: "API publique", color: "bg-emerald-100 text-emerald-800" },
  api_protected: { label: "API protégée (clé)", color: "bg-amber-100 text-amber-800" },
  redirect: { label: "Redirection externe", color: "bg-zinc-100 text-zinc-800" },
};

const AdminLibraryPage = () => {
  const { user } = useAuth();
  const { institution } = useInstitution();
  const qc = useQueryClient();
  const instId = institution?.id;

  const [openBook, setOpenBook] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ title: "", author: "", description: "", category: "", visibility: "all", filiere_id: "none", niveau: "" });
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [docFile, setDocFile] = useState<File | null>(null);
  const [readingBook, setReadingBook] = useState<any | null>(null);

  // === Settings ===
  const { data: settings } = useQuery({
    queryKey: ["library-settings", instId],
    queryFn: async () => {
      if (!instId) return null;
      const { data } = await supabase.from("library_settings").select("*").eq("institution_id", instId).maybeSingle();
      return data;
    },
    enabled: !!instId,
  });
  const [apiUrl, setApiUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  useEffect(() => {
    if (settings) {
      setApiUrl(settings.api_url || "");
      setApiKey(settings.api_key || "");
    }
  }, [settings?.api_url, settings?.api_key]);

  // === Books ===
  const { data: books = [] } = useQuery({
    queryKey: ["library-books", instId],
    queryFn: async () => {
      if (!instId) return [];
      const { data } = await supabase.from("library_books").select("*").eq("institution_id", instId).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!instId,
  });

  const { data: filieres = [] } = useQuery({
    queryKey: ["lib-filieres", instId],
    queryFn: async () => (await supabase.from("filieres").select("id,name").eq("institution_id", instId!)).data || [],
    enabled: !!instId,
  });

  // === Logs ===
  const { data: logs = [] } = useQuery({
    queryKey: ["library-logs", instId],
    queryFn: async () => {
      if (!instId) return [];
      const { data } = await supabase.from("library_sync_logs").select("*").eq("institution_id", instId).order("started_at", { ascending: false }).limit(30);
      return data || [];
    },
    enabled: !!instId,
  });

  const filtered = books.filter((b: any) => (b.title || "").toLowerCase().includes(search.toLowerCase()) || (b.author || "").toLowerCase().includes(search.toLowerCase()));

  const detectMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("library-detect-mode", { body: { institution_id: instId, api_url: apiUrl, api_key: apiKey || null } });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Mode détecté : ${MODE_LABELS[data.mode_detected]?.label || data.mode_detected}`);
      qc.invalidateQueries({ queryKey: ["library-settings", instId] });
    },
    onError: (e: any) => toast.error("Détection échouée : " + (e.message || e)),
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("library-sync", { body: { institution_id: instId } });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      const imported = data?.summary?.[0]?.imported ?? 0;
      const fb = data?.summary?.[0]?.used_fallback;
      if (imported > 0) {
        toast.success(`${imported} livre${imported > 1 ? "s" : ""} importé${imported > 1 ? "s" : ""}${fb ? " (via Open Library)" : ""} ✅`);
      } else {
        toast.warning("Aucun livre extrait — vérifiez l'URL/clé dans les logs.");
      }
      qc.invalidateQueries({ queryKey: ["library-books", instId] });
      qc.invalidateQueries({ queryKey: ["library-logs", instId] });
      qc.invalidateQueries({ queryKey: ["library-settings", instId] });
    },
    onError: (e: any) => toast.error("Sync échouée : " + (e.message || e)),
  });

  const uploadFile = async (file: File, prefix: string) => {
    const path = `library/${instId}/${prefix}-${Date.now()}-${file.name.replace(/\s+/g, "_")}`;
    const { error } = await supabase.storage.from("media").upload(path, file, { upsert: true });
    if (error) throw error;
    return supabase.storage.from("media").getPublicUrl(path).data.publicUrl;
  };

  const createBook = useMutation({
    mutationFn: async () => {
      if (!form.title.trim() || !instId || !user) throw new Error("Titre requis");
      let coverUrl: string | null = null;
      let fileUrl: string | null = null;
      if (coverFile) coverUrl = await uploadFile(coverFile, "cover");
      if (docFile) fileUrl = await uploadFile(docFile, "pdf");
      const { error } = await supabase.from("library_books").insert({
        institution_id: instId, uploaded_by: user.id, source: "internal",
        title: form.title.trim(), author: form.author || null, description: form.description || null,
        category: form.category || null, visibility: form.visibility,
        filiere_id: form.filiere_id === "none" ? null : form.filiere_id, niveau: form.niveau || null,
        cover_url: coverUrl, cover_image: coverUrl, file_url: fileUrl,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Livre ajouté");
      setOpenBook(false);
      setForm({ title: "", author: "", description: "", category: "", visibility: "all", filiere_id: "none", niveau: "" });
      setCoverFile(null); setDocFile(null);
      qc.invalidateQueries({ queryKey: ["library-books", instId] });
    },
    onError: (e: any) => toast.error(e.message || String(e)),
  });

  const deleteBook = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("library_books").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Livre supprimé"); qc.invalidateQueries({ queryKey: ["library-books", instId] }); },
  });

  const currentMode = settings?.mode_detected || "internal";

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Library className="w-7 h-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Bibliothèque numérique intelligente</h1>
          <p className="text-sm text-muted-foreground">Configuration automatique + synchronisation + logs.</p>
        </div>
      </div>

      <Tabs defaultValue="books">
        <TabsList>
          <TabsTrigger value="books"><BookOpen className="w-4 h-4 mr-1" />Livres</TabsTrigger>
          <TabsTrigger value="settings"><Settings2 className="w-4 h-4 mr-1" />Paramètres</TabsTrigger>
          <TabsTrigger value="logs"><FileSearch className="w-4 h-4 mr-1" />Logs</TabsTrigger>
        </TabsList>

        {/* === LIVRES === */}
        <TabsContent value="books" className="space-y-4">
          <div className="flex flex-wrap gap-2 items-center justify-between">
            <Input placeholder="Rechercher un livre…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
            <Dialog open={openBook} onOpenChange={setOpenBook}>
              <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-1" />Ajouter un livre</Button></DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>Nouveau livre (interne)</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>Titre *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label>Auteur</Label><Input value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} /></div>
                    <div><Label>Catégorie</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
                  </div>
                  <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label>Filière</Label>
                      <Select value={form.filiere_id} onValueChange={(v) => setForm({ ...form, filiere_id: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Toutes</SelectItem>
                          {filieres.map((f: any) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div><Label>Niveau</Label><Input placeholder="L1, L2…" value={form.niveau} onChange={(e) => setForm({ ...form, niveau: e.target.value })} /></div>
                    <div>
                      <Label>Visibilité</Label>
                      <Select value={form.visibility} onValueChange={(v) => setForm({ ...form, visibility: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Tous</SelectItem>
                          <SelectItem value="teachers">Enseignants</SelectItem>
                          <SelectItem value="premium">Premium</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label>Couverture (image)</Label><Input type="file" accept="image/*" onChange={(e) => setCoverFile(e.target.files?.[0] || null)} /></div>
                    <div><Label>Fichier PDF</Label><Input type="file" accept="application/pdf" onChange={(e) => setDocFile(e.target.files?.[0] || null)} /></div>
                  </div>
                  <Button className="w-full" onClick={() => createBook.mutate()} disabled={createBook.isPending}>
                    <Upload className="w-4 h-4 mr-1" /> Enregistrer
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {filtered.map((b: any) => (
              <Card key={b.id} className="overflow-hidden">
                <div className="aspect-[3/4] bg-muted relative">
                  {(b.cover_image || b.cover_url) ? (
                    <img src={b.cover_image || b.cover_url} alt={b.title} loading="lazy" decoding="async" width={320} height={427} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"><BookOpen className="w-12 h-12 text-muted-foreground" /></div>
                  )}
                  <Badge className="absolute top-2 left-2" variant="secondary">{b.source === "internal" ? "Interne" : "Externe"}</Badge>
                </div>
                <CardContent className="p-3 space-y-1">
                  <div className="font-medium text-sm truncate" title={b.title}>{b.title}</div>
                  <div className="text-xs text-muted-foreground truncate">{b.author || "—"}</div>
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {(b.file_url || b.external_link) && (
                      <Button size="sm" variant="default" onClick={() => setReadingBook(b)}>
                        <BookOpenCheck className="w-3.5 h-3.5 mr-1" />Lire
                      </Button>
                    )}
                    {b.external_link && (
                      <a href={b.external_link} target="_blank" rel="noreferrer"><Button size="sm" variant="outline"><ExternalLink className="w-3.5 h-3.5 mr-1" />Ouvrir</Button></a>
                    )}
                    <Button size="sm" variant="ghost" className="text-destructive ml-auto" onClick={() => { if (confirm("Supprimer ce livre ?")) deleteBook.mutate(b.id); }}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {filtered.length === 0 && <div className="col-span-full text-center text-sm text-muted-foreground py-8">Aucun livre.</div>}
          </div>
        </TabsContent>

        {/* === PARAMÈTRES === */}
        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">Mode de bibliothèque
                {currentMode && <Badge className={MODE_LABELS[currentMode]?.color}>{MODE_LABELS[currentMode]?.label}</Badge>}
              </CardTitle>
              <CardDescription>Choisissez comment votre établissement gère sa bibliothèque numérique.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-3 gap-3">
                {[
                  { key: "internal", title: "📚 Manuel (interne)", desc: "Vous ajoutez vous-même vos livres / romans en PDF." },
                  { key: "api_protected", title: "🔌 API + Clé", desc: "Vous fournissez une URL et une clé API, le système détecte le format." },
                  { key: "redirect", title: "🔗 Lien externe", desc: "Un simple lien qui redirige vers une plateforme externe." },
                ].map((opt) => {
                  const active = currentMode === opt.key || (opt.key === "api_protected" && ["api_public","external_scraping","api_protected"].includes(currentMode));
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={async () => {
                        if (!instId) return;
                        await supabase.from("library_settings").upsert({
                          institution_id: instId,
                          mode_detected: opt.key,
                          api_url: opt.key === "internal" ? null : (apiUrl || settings?.api_url || null),
                          api_key: opt.key === "internal" ? null : (apiKey || settings?.api_key || null),
                        }, { onConflict: "institution_id" });
                        qc.invalidateQueries({ queryKey: ["library-settings", instId] });
                        toast.success(`Mode défini : ${opt.title}`);
                      }}
                      className={`text-left p-4 border rounded-lg transition ${active ? "border-primary bg-primary/5 ring-2 ring-primary" : "hover:border-primary/50"}`}
                    >
                      <div className="font-semibold">{opt.title}</div>
                      <div className="text-xs text-muted-foreground mt-1">{opt.desc}</div>
                    </button>
                  );
                })}
              </div>

              {currentMode === "internal" && (
                <div className="text-sm text-muted-foreground pt-3 border-t">
                  Allez dans l'onglet <b>Livres</b> pour ajouter manuellement vos romans / PDF.
                </div>
              )}

              {currentMode !== "internal" && (
                <div className="space-y-3 pt-3 border-t">
                  <div>
                    <Label>URL {currentMode === "redirect" ? "de la plateforme" : "API / Bibliothèque externe"}</Label>
                    <Input value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} placeholder="https://votre-bibliotheque.com/api/books" />
                    <p className="text-[11px] text-muted-foreground mt-1">Chaque établissement met son propre point d'accès (JSON, XML, RSS, ou page HTML publique).</p>
                  </div>
                  {currentMode !== "redirect" && (
                    <div>
                      <Label>Clé API (facultatif)</Label>
                      <Input value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="••••••••••••" type="password" />
                      <p className="text-[11px] text-muted-foreground mt-1">Stockée de façon sécurisée et utilisée uniquement côté serveur.</p>
                    </div>
                  )}
                  <div className="flex gap-2 flex-wrap">
                    <Button variant="outline" onClick={async () => {
                      if (!instId) return;
                      await supabase.from("library_settings").upsert({ institution_id: instId, api_url: apiUrl || null, api_key: apiKey || null, mode_detected: currentMode }, { onConflict: "institution_id" });
                      toast.success("Enregistré");
                      qc.invalidateQueries({ queryKey: ["library-settings", instId] });
                    }}>Enregistrer</Button>
                    {currentMode !== "redirect" && (
                      <>
                        <Button onClick={() => detectMutation.mutate()} disabled={detectMutation.isPending || !instId || !apiUrl}>
                          <Settings2 className="w-4 h-4 mr-1" /> Détecter le format
                        </Button>
                        <Button variant="outline" onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending || !instId}>
                          <RefreshCcw className={`w-4 h-4 mr-1 ${syncMutation.isPending ? "animate-spin" : ""}`} /> Synchroniser
                        </Button>
                        <Button
                          variant="default"
                          disabled={!instId || !apiUrl || detectMutation.isPending || syncMutation.isPending}
                          onClick={async () => {
                            if (!instId || !apiUrl) return;
                            try {
                              await supabase.from("library_settings").upsert({ institution_id: instId, api_url: apiUrl, api_key: apiKey || null }, { onConflict: "institution_id" });
                              const det: any = await detectMutation.mutateAsync();
                              if (det && (det.mode_detected === "api_public" || det.mode_detected === "api_protected" || det.mode_detected === "external_scraping")) {
                                await syncMutation.mutateAsync();
                                toast.success("Bibliothèque connectée et livres importés ✅");
                              } else {
                                toast.message("Format détecté : " + (MODE_LABELS[det?.mode_detected]?.label || det?.mode_detected));
                              }
                            } catch (e: any) {
                              toast.error(e.message || String(e));
                            }
                          }}
                        >
                          <RefreshCcw className="w-4 h-4 mr-1" /> Connecter & importer les livres
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              )}

              {settings && currentMode !== "internal" && (
                <div className="grid grid-cols-2 gap-3 text-sm pt-3 border-t">
                  <div><div className="text-muted-foreground">Authentification</div><div className="font-medium">{settings.detected_auth_type || "—"}</div></div>
                  <div><div className="text-muted-foreground">Format</div><div className="font-medium">{settings.detected_response_format || "—"}</div></div>
                  <div><div className="text-muted-foreground">Chemin données</div><div className="font-mono text-xs">{settings.detected_data_path || "—"}</div></div>
                  <div><div className="text-muted-foreground">Dernière sync</div><div className="font-medium">{settings.last_sync ? new Date(settings.last_sync).toLocaleString("fr-FR") : "Jamais"}</div></div>
                  {currentMode !== "redirect" && (
                    <div className="col-span-2 flex items-center gap-2">
                      <Switch checked={!!settings.auto_sync_enabled} onCheckedChange={async (v) => {
                        await supabase.from("library_settings").update({ auto_sync_enabled: v }).eq("institution_id", instId!);
                        qc.invalidateQueries({ queryKey: ["library-settings", instId] });
                      }} />
                      <Label>Synchronisation automatique (toutes les 24h)</Label>
                    </div>
                  )}
                </div>
              )}
              {currentMode === "redirect" && settings?.api_url && (
                <a href={settings.api_url} target="_blank" rel="noreferrer">
                  <Button variant="secondary"><ExternalLink className="w-4 h-4 mr-1" />Tester le lien</Button>
                </a>
              )}
            </CardContent>
          </Card>
        </TabsContent>


        {/* === LOGS === */}
        <TabsContent value="logs">
          <Card>
            <CardHeader><CardTitle>Journaux de synchronisation</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {logs.length === 0 && <div className="text-sm text-muted-foreground">Aucune synchronisation enregistrée.</div>}
                {logs.map((l: any) => (
                  <div key={l.id} className="border rounded-md p-3 text-sm">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="font-medium">{new Date(l.started_at).toLocaleString("fr-FR")}</div>
                      <Badge variant={l.status === "success" ? "default" : l.status === "partial" ? "secondary" : "destructive"}>{l.status}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Mode : <b>{MODE_LABELS[l.mode_used]?.label || l.mode_used}</b> · Importés : <b>{l.books_imported}</b> · Erreurs : <b>{l.errors_count}</b>
                    </div>
                    {l.error_details && (
                      <pre className="mt-2 text-xs bg-muted p-2 rounded max-h-32 overflow-auto">{JSON.stringify(l.error_details, null, 2)}</pre>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!readingBook} onOpenChange={(o) => !o && setReadingBook(null)}>
        <DialogContent className="max-w-6xl h-[90vh] p-0 overflow-hidden">
          <DialogHeader className="px-4 py-2 border-b">
            <DialogTitle className="truncate">{readingBook?.title}</DialogTitle>
          </DialogHeader>
          <div className="h-[calc(90vh-3rem)] overflow-hidden bg-muted">
            {readingBook?.file_url ? (
              <PdfReader bookId={readingBook.id} fileUrl={readingBook.file_url} />
            ) : readingBook?.external_link ? (
              <iframe
                src={readingBook.external_link}
                title={readingBook.title}
                className="w-full h-full border-0"
                sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
              />
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Aucun contenu disponible</div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};

export default AdminLibraryPage;
