import { useEffect, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ZoomIn, ZoomOut, Moon, Sun, Bookmark, Highlighter, StickyNote, Maximize2, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const COLORS = ["#fde047", "#86efac", "#fca5a5", "#93c5fd", "#f0abfc"];

type Props = { bookId: string; fileUrl: string; onClose?: () => void };

export default function PdfReader({ bookId, fileUrl }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [numPages, setNumPages] = useState<number>(0);
  const [page, setPage] = useState(1);
  const [scale, setScale] = useState(1.1);
  const [night, setNight] = useState(false);
  const [highlightColor, setHighlightColor] = useState(COLORS[0]);
  const [noteText, setNoteText] = useState("");
  const saveTimer = useRef<number | null>(null);

  // Load reading position
  const { data: history } = useQuery({
    queryKey: ["lib-history", bookId, user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase.from("library_reading_history").select("last_page").eq("book_id", bookId).eq("user_id", user.id).maybeSingle();
      return data;
    },
    enabled: !!user && !!bookId,
  });
  useEffect(() => { if (history?.last_page) setPage(history.last_page); }, [history?.last_page]);

  // Auto-save position
  useEffect(() => {
    if (!user) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      await supabase.from("library_reading_history").upsert(
        { user_id: user.id, book_id: bookId, last_page: page, last_read_at: new Date().toISOString() },
        { onConflict: "user_id,book_id" },
      );
    }, 1500);
  }, [page, user, bookId]);

  // Annotations / bookmarks for the current page
  const { data: annotations = [] } = useQuery({
    queryKey: ["lib-annot", bookId, user?.id, page],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase.from("library_annotations").select("*").eq("book_id", bookId).eq("user_id", user.id).eq("page", page).order("created_at");
      return data || [];
    },
    enabled: !!user,
  });
  const { data: bookmarks = [] } = useQuery({
    queryKey: ["lib-bookmarks", bookId, user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase.from("library_bookmarks").select("*").eq("book_id", bookId).eq("user_id", user.id).order("page");
      return data || [];
    },
    enabled: !!user,
  });

  const addHighlight = async () => {
    const sel = window.getSelection?.()?.toString().trim();
    if (!sel) { toast.error("Sélectionnez d'abord du texte"); return; }
    if (!user) return;
    await supabase.from("library_annotations").insert({ user_id: user.id, book_id: bookId, page, type: "highlight", color: highlightColor, text: sel });
    qc.invalidateQueries({ queryKey: ["lib-annot", bookId, user.id, page] });
    toast.success("Surlignage enregistré");
  };

  const addNote = async () => {
    if (!noteText.trim() || !user) return;
    await supabase.from("library_annotations").insert({ user_id: user.id, book_id: bookId, page, type: "note", text: noteText.trim() });
    setNoteText("");
    qc.invalidateQueries({ queryKey: ["lib-annot", bookId, user.id, page] });
  };

  const addBookmark = async () => {
    if (!user) return;
    await supabase.from("library_bookmarks").insert({ user_id: user.id, book_id: bookId, page, label: `Page ${page}` });
    qc.invalidateQueries({ queryKey: ["lib-bookmarks", bookId, user.id] });
    toast.success("Signet ajouté");
  };

  const docOptions = useMemo(() => ({ cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`, cMapPacked: true }), []);

  return (
    <div className="flex h-[80vh] w-full gap-3">
      <div className="flex-1 flex flex-col rounded-md border bg-muted/30 overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-2 p-2 border-b bg-background flex-wrap">
          <Button size="sm" variant="ghost" onClick={() => setPage((p) => Math.max(1, p - 1))}><ChevronLeft className="w-4 h-4" /></Button>
          <span className="text-sm">Page {page} / {numPages || "?"}</span>
          <Button size="sm" variant="ghost" onClick={() => setPage((p) => Math.min(numPages, p + 1))}><ChevronRight className="w-4 h-4" /></Button>
          <div className="w-px h-5 bg-border mx-1" />
          <Button size="sm" variant="ghost" onClick={() => setScale((s) => Math.max(0.5, s - 0.1))}><ZoomOut className="w-4 h-4" /></Button>
          <span className="text-xs w-12 text-center">{Math.round(scale * 100)}%</span>
          <Button size="sm" variant="ghost" onClick={() => setScale((s) => Math.min(2.5, s + 0.1))}><ZoomIn className="w-4 h-4" /></Button>
          <Button size="sm" variant="ghost" onClick={() => setScale(1.4)}><Maximize2 className="w-4 h-4" /></Button>
          <div className="w-px h-5 bg-border mx-1" />
          <Button size="sm" variant={night ? "default" : "ghost"} onClick={() => setNight((n) => !n)}>{night ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}</Button>
          <div className="w-px h-5 bg-border mx-1" />
          <div className="flex items-center gap-1">
            {COLORS.map((c) => (
              <button key={c} onClick={() => setHighlightColor(c)} className={`w-5 h-5 rounded-full border-2 ${highlightColor === c ? "border-foreground" : "border-transparent"}`} style={{ backgroundColor: c }} />
            ))}
          </div>
          <Button size="sm" variant="outline" onClick={addHighlight}><Highlighter className="w-4 h-4 mr-1" />Surligner</Button>
          <Button size="sm" variant="outline" onClick={addBookmark}><Bookmark className="w-4 h-4 mr-1" />Signet</Button>
        </div>
        {/* Pages */}
        <ScrollArea className="flex-1">
          <div className={`p-4 flex justify-center ${night ? "bg-zinc-900" : ""}`} style={night ? { filter: "invert(1) hue-rotate(180deg)" } : undefined}>
            <Document file={fileUrl} options={docOptions} onLoadSuccess={(d) => setNumPages(d.numPages)} loading={<div className="text-sm">Chargement du PDF…</div>} error={<div className="text-sm text-destructive">Impossible de charger le PDF</div>}>
              <Page pageNumber={page} scale={scale} renderTextLayer renderAnnotationLayer={false} />
            </Document>
          </div>
        </ScrollArea>
      </div>

      {/* Side panel */}
      <Card className="w-80 p-3 hidden md:flex flex-col">
        <Tabs defaultValue="notes" className="flex-1 flex flex-col">
          <TabsList className="grid grid-cols-3">
            <TabsTrigger value="notes"><StickyNote className="w-4 h-4 mr-1" />Notes</TabsTrigger>
            <TabsTrigger value="marks"><Bookmark className="w-4 h-4 mr-1" />Signets</TabsTrigger>
            <TabsTrigger value="hl"><Highlighter className="w-4 h-4 mr-1" />Surl.</TabsTrigger>
          </TabsList>
          <TabsContent value="notes" className="flex-1 flex flex-col gap-2 mt-2">
            <Textarea placeholder={`Note pour la page ${page}…`} value={noteText} onChange={(e) => setNoteText(e.target.value)} />
            <Button size="sm" onClick={addNote}>Ajouter</Button>
            <ScrollArea className="flex-1">
              <div className="space-y-2">
                {annotations.filter((a: any) => a.type === "note").map((a: any) => (
                  <div key={a.id} className="text-xs bg-muted p-2 rounded">{a.text}</div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
          <TabsContent value="marks" className="flex-1 mt-2">
            <ScrollArea className="h-full">
              <div className="space-y-1">
                {bookmarks.map((b: any) => (
                  <button key={b.id} onClick={() => setPage(b.page)} className="w-full text-left text-sm px-2 py-1 rounded hover:bg-muted">📑 {b.label || `Page ${b.page}`}</button>
                ))}
                {bookmarks.length === 0 && <div className="text-xs text-muted-foreground">Aucun signet.</div>}
              </div>
            </ScrollArea>
          </TabsContent>
          <TabsContent value="hl" className="flex-1 mt-2">
            <ScrollArea className="h-full">
              <div className="space-y-2">
                {annotations.filter((a: any) => a.type === "highlight").map((a: any) => (
                  <div key={a.id} className="text-xs p-2 rounded" style={{ backgroundColor: a.color || "#fde047" }}>{a.text}</div>
                ))}
                {annotations.filter((a: any) => a.type === "highlight").length === 0 && <div className="text-xs text-muted-foreground">Aucun surlignage sur cette page.</div>}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}
