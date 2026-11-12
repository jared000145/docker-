import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { BookOpen, Search, Heart, ExternalLink, Download, Library } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useInstitution } from "@/hooks/useInstitution";
import PdfReader from "@/components/library/PdfReader";
import { toast } from "sonner";

const StudentLibraryPage = () => {
  const { user } = useAuth();
  const { institution } = useInstitution();
  const qc = useQueryClient();
  const instId = institution?.id;

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [niveau, setNiveau] = useState("all");
  const [reader, setReader] = useState<{ id: string; url: string; title: string } | null>(null);

  const { data: settings } = useQuery({
    queryKey: ["library-settings", instId],
    queryFn: async () => (await supabase.from("library_settings").select("*").eq("institution_id", instId!).maybeSingle()).data,
    enabled: !!instId,
  });

  const { data: books = [] } = useQuery({
    queryKey: ["library-books-student", instId],
    queryFn: async () => (await supabase.from("library_books").select("*").eq("institution_id", instId!).order("title")).data || [],
    enabled: !!instId,
  });

  const { data: favorites = [] } = useQuery({
    queryKey: ["library-favs", user?.id],
    queryFn: async () => (await supabase.from("library_favorites").select("book_id").eq("user_id", user!.id)).data?.map((d: any) => d.book_id) || [],
    enabled: !!user,
  });

  const toggleFav = useMutation({
    mutationFn: async (bookId: string) => {
      if (!user) return;
      if (favorites.includes(bookId)) {
        await supabase.from("library_favorites").delete().eq("user_id", user.id).eq("book_id", bookId);
      } else {
        await supabase.from("library_favorites").insert({ user_id: user.id, book_id: bookId });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["library-favs", user?.id] }),
  });

  const categories = useMemo(() => Array.from(new Set(books.map((b: any) => b.category).filter(Boolean))), [books]);
  const niveaux = useMemo(() => Array.from(new Set(books.map((b: any) => b.niveau).filter(Boolean))), [books]);

  const filterFn = (b: any) => {
    if (search && !((b.title || "").toLowerCase().includes(search.toLowerCase()) || (b.author || "").toLowerCase().includes(search.toLowerCase()))) return false;
    if (category !== "all" && b.category !== category) return false;
    if (niveau !== "all" && b.niveau !== niveau) return false;
    return true;
  };

  const openReader = async (b: any) => {
    if (!b.file_url) { toast.error("Aucun fichier disponible"); return; }
    if (user) {
      await supabase.from("library_reading_history").upsert({ user_id: user.id, book_id: b.id, last_read_at: new Date().toISOString() }, { onConflict: "user_id,book_id" });
    }
    setReader({ id: b.id, url: b.file_url, title: b.title });
  };

  // Redirect mode
  if (settings?.mode_detected === "redirect" && settings.api_url) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
        <Library className="w-16 h-16 text-primary" />
        <h1 className="text-2xl font-bold">Bibliothèque numérique externe</h1>
        <p className="text-muted-foreground max-w-md">Votre établissement utilise une plateforme externe protégée. Cliquez pour vous connecter.</p>
        <a href={settings.api_url} target="_blank" rel="noreferrer">
          <Button size="lg"><ExternalLink className="w-4 h-4 mr-2" />Accéder à la bibliothèque numérique</Button>
        </a>
      </div>
    );
  }

  const renderGrid = (list: any[]) => (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
      {list.map((b: any) => (
        <Card key={b.id} className="overflow-hidden group">
          <div className="aspect-[3/4] bg-muted relative">
            {(b.cover_image || b.cover_url) ? (
              <img src={b.cover_image || b.cover_url} alt={b.title} loading="lazy" decoding="async" width={320} height={427} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center"><BookOpen className="w-12 h-12 text-muted-foreground" /></div>
            )}
            <button onClick={() => toggleFav.mutate(b.id)} className="absolute top-2 right-2 p-1.5 rounded-full bg-background/80 hover:bg-background">
              <Heart className={`w-4 h-4 ${favorites.includes(b.id) ? "fill-red-500 text-red-500" : "text-muted-foreground"}`} />
            </button>
          </div>
          <CardContent className="p-2 space-y-1">
            <div className="font-medium text-sm line-clamp-1" title={b.title}>{b.title}</div>
            <div className="text-xs text-muted-foreground line-clamp-1">{b.author || "—"}</div>
            <div className="flex gap-1 flex-wrap">
              {b.category && <Badge variant="secondary" className="text-[10px]">{b.category}</Badge>}
              {b.niveau && <Badge variant="outline" className="text-[10px]">{b.niveau}</Badge>}
            </div>
            <div className="flex gap-1 pt-1">
              {b.file_url ? (
                <Button size="sm" variant="default" className="flex-1 h-7 text-xs" onClick={() => openReader(b)}>Lire</Button>
              ) : b.external_link ? (
                <a href={b.external_link} target="_blank" rel="noreferrer" className="flex-1"><Button size="sm" variant="outline" className="w-full h-7 text-xs">Ouvrir</Button></a>
              ) : null}
              {b.file_url && b.download_allowed !== false && (
                <a href={b.file_url} download><Button size="sm" variant="ghost" className="h-7 px-2"><Download className="w-3 h-3" /></Button></a>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
      {list.length === 0 && <div className="col-span-full text-center text-sm text-muted-foreground py-12">Aucun livre trouvé.</div>}
    </div>
  );

  const allBooks = books.filter(filterFn);
  const favBooks = books.filter((b: any) => favorites.includes(b.id)).filter(filterFn);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Library className="w-7 h-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Bibliothèque numérique</h1>
          <p className="text-sm text-muted-foreground">{books.length} ouvrage(s) disponible(s).</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-8" placeholder="Rechercher un titre ou un auteur…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Catégorie" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes catégories</SelectItem>
            {categories.map((c: any) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={niveau} onValueChange={setNiveau}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Niveau" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous niveaux</SelectItem>
            {niveaux.map((n: any) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">Tous</TabsTrigger>
          <TabsTrigger value="fav"><Heart className="w-4 h-4 mr-1" />Favoris ({favorites.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="all" className="mt-4">{renderGrid(allBooks)}</TabsContent>
        <TabsContent value="fav" className="mt-4">{renderGrid(favBooks)}</TabsContent>
      </Tabs>

      <Dialog open={!!reader} onOpenChange={(o) => !o && setReader(null)}>
        <DialogContent className="max-w-6xl">
          <DialogHeader><DialogTitle>{reader?.title}</DialogTitle></DialogHeader>
          {reader && <PdfReader bookId={reader.id} fileUrl={reader.url} />}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};

export default StudentLibraryPage;
