import { useState } from "react";
import { motion } from "framer-motion";
import { KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { storeTenantBranding, type TenantBranding } from "@/hooks/useTenantSlug";

export const accessKeyStorageKey = (slug: string) => `rp_access_key_${slug}`;
export const GLOBAL_ACCESS_KEY = "rp_access_key_global";

export const hasVerifiedAccessKey = (slug: string | null) => {
  try {
    if (slug) return !!localStorage.getItem(accessKeyStorageKey(slug));
    return !!localStorage.getItem(GLOBAL_ACCESS_KEY);
  } catch {
    return false;
  }
};

export const clearAccessKey = (slug: string | null) => {
  try {
    if (slug) localStorage.removeItem(accessKeyStorageKey(slug));
    localStorage.removeItem(GLOBAL_ACCESS_KEY);
  } catch { /* ignore */ }
};

interface Props {
  /** Quand présent, la clé est validée pour cet établissement précis (sous-domaine / domaine perso). */
  slug?: string | null;
  tenant?: TenantBranding | null;
  onVerified: (tenant?: TenantBranding | null) => void;
  /** Optionnel : permet à l'équipe RectorPlus d'accéder sans clé établissement. */
  onSkip?: () => void;
}


const TenantAccessGate = ({ slug, tenant, onVerified, onSkip }: Props) => {
  const [key, setKey] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = key.trim().toUpperCase();
    if (!value) return;
    setLoading(true);
    const { data, error } = slug
      ? await (supabase as any).rpc("verify_institution_access_key", { _slug: slug, _key: value })
      : await (supabase as any).rpc("verify_access_key", { _key: value });
    setLoading(false);
    const row = (Array.isArray(data) ? data[0] : data) as TenantBranding | undefined;
    if (error || !row) {
      toast.error("Clé d'accès invalide");
      return;
    }
    try {
      localStorage.setItem(GLOBAL_ACCESS_KEY, value);
      if (row.slug) localStorage.setItem(accessKeyStorageKey(row.slug), value);
    } catch { /* stockage indisponible */ }
    storeTenantBranding(row);
    toast.success(`Accès autorisé — ${row.name}`);
    onVerified(row);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <motion.form
        onSubmit={submit}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md glass-card-elevated border border-border/50 rounded-2xl p-8 space-y-6"
      >
        <div className="text-center space-y-3">
          {tenant?.logo_url ? (
            <img src={tenant.logo_url} alt={tenant.name} className="w-16 h-16 rounded-2xl object-cover mx-auto" />
          ) : (
            <div className="w-16 h-16 rounded-2xl gradient-gold flex items-center justify-center mx-auto">
              <ShieldCheck className="w-8 h-8 text-accent-foreground" />
            </div>
          )}
          <h1 className="text-2xl font-heading font-bold text-foreground">
            {tenant?.name ?? "Espace établissement"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Cet espace est réservé. Saisissez la clé d'accès remise à votre établissement lors de la validation de son inscription.
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Clé d'accès</label>
          <div className="relative">
            <KeyRound className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={key}
              onChange={(e) => setKey(e.target.value.toUpperCase())}
              placeholder="XXXXXXXXXXXX"
              className="pl-9 font-mono tracking-widest"
              autoFocus
            />
          </div>
        </div>

        <Button type="submit" className="w-full" disabled={loading || !key.trim()}>
          {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <KeyRound className="w-4 h-4 mr-2" />}
          Déverrouiller l'accès
        </Button>

        <p className="text-xs text-muted-foreground text-center">
          Clé perdue ? Contactez l'administration Rectorplus.
        </p>

        {onSkip && (
          <button type="button" onClick={onSkip} className="w-full text-xs text-muted-foreground underline hover:text-foreground">
            Équipe RectorPlus — continuer sans clé
          </button>
        )}

      </motion.form>
    </div>
  );
};

export default TenantAccessGate;
