import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {useCampus} from '@/hooks/useCampus';
import {useAuth} from '@/hooks/useAuth';
import { Search, GraduationCap, BookMarked, Phone, Mail } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";

/**
 * Global admin search bar (header).
 * Calls the `admin_global_search` RPC, which is institution-scoped on the server side.
 * Clicking a student opens their detail page; clicking a professor jumps to the prof list.
 */
export const GlobalSearchBar = () => {
  const {campusId}=useCampus();const {user}=useAuth();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const { data: results = [], isFetching } = useQuery({
    queryKey: ["admin-global-search", user?.id,campusId,query],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("admin_global_search", { _query: query,_campus:campusId });
      if (error) throw error;
      return (data as any[]) || [];
    },
    enabled: query.trim().length >= 2,
    staleTime: 10_000,
  });

  const handlePick = (row: any) => {
    setOpen(false);
    setQuery("");
    if (row.kind === "student") {
      navigate(`/admin/students/${row.user_id}`);
    } else {
      navigate(`/admin/professors`);
    }
  };

  return (
    <Popover open={open && query.trim().length >= 2} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder="Rechercher étudiant, professeur, matricule..."
            className="pl-9 h-9 bg-background/60 border-border"
          />
        </div>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[420px] p-0 max-h-96 overflow-y-auto"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {isFetching && (
          <div className="p-4 text-sm text-muted-foreground">Recherche...</div>
        )}
        {!isFetching && results.length === 0 && (
          <div className="p-4 text-sm text-muted-foreground">Aucun résultat</div>
        )}
        {results.map((r: any) => (
          <button
            key={`${r.kind}-${r.user_id}`}
            onClick={() => handlePick(r)}
            className="w-full flex items-center gap-3 p-3 hover:bg-secondary/60 text-left border-b border-border/50 last:border-0 transition-colors"
          >
            <Avatar className="w-10 h-10">
              <AvatarImage src={r.avatar_url || undefined} />
              <AvatarFallback className="text-xs bg-primary/10">
                {(r.first_name?.[0] || "") + (r.last_name?.[0] || "")}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                {r.kind === "student" ? (
                  <GraduationCap className="w-3.5 h-3.5 text-info" />
                ) : (
                  <BookMarked className="w-3.5 h-3.5 text-accent" />
                )}
                <span className="text-sm font-medium text-foreground truncate">
                  {r.first_name} {r.last_name}
                </span>
                {r.student_number && (
                  <span className="text-[11px] font-mono text-muted-foreground">{r.student_number}</span>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                {r.email && <span className="flex items-center gap-1 truncate"><Mail className="w-3 h-3" />{r.email}</span>}
                {r.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{r.phone}</span>}
              </div>
            </div>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
};
