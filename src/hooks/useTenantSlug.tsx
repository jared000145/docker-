import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Resolves the tenant based on the current host.
 *
 * `mon-ecole.rectorplus.com` -> slug = "mon-ecole"      (sous-domaine automatique)
 * `afram.com`                -> domaine personnalisé   (résolu via get_institution_by_domain)
 * `rectorplus.com` / `www.` / `localhost` / previews -> site marketing (aucun tenant)
 */
const RESERVED = new Set(["www", "app", "admin", "api", "preview", "id-preview", "localhost"]);
const ROOT_DOMAINS = ["rectorplus.com", "scolarplus.com"];
const PLATFORM_HOSTS = new Set([
  "rectorplus.vercel.app",
  "rectorplus-jareds-projects-7b8d0c08.vercel.app",
]);

const currentHost = () => (typeof window !== "undefined" ? window.location.hostname : "").toLowerCase();

const isPlatformHost = (h: string) =>
  !h ||
  PLATFORM_HOSTS.has(h) ||
  /^rectorplus-[a-z0-9]+-jareds-projects-7b8d0c08\.vercel\.app$/.test(h) ||
  h === "localhost" || h === "::1" || h === "[::1]" ||
  h.endsWith(".localhost") ||
  /^\d+\.\d+\.\d+\.\d+$/.test(h) ||
  h.endsWith(".lovable.app") ||
  h.endsWith(".lovableproject.com");

export const getTenantSlugFromHost = (host?: string): string | null => {
  const h = (host ?? currentHost()).toLowerCase();
  if (isPlatformHost(h)) return null;
  const root = ROOT_DOMAINS.find((d) => h === d || h.endsWith(`.${d}`));
  if (!root) return null; // custom domain, handled separately
  if (h === root) return null;
  const sub = h.slice(0, h.length - root.length - 1).split(".")[0];
  if (!sub || RESERVED.has(sub)) return null;
  return sub;
};

/** Returns the custom domain (e.g. afram.com) when the host is not a RectorPlus domain. */
export const getCustomDomainFromHost = (host?: string): string | null => {
  const h = (host ?? currentHost()).toLowerCase();
  if (isPlatformHost(h)) return null;
  if (ROOT_DOMAINS.some((d) => h === d || h.endsWith(`.${d}`))) return null;
  return h.replace(/^www\./, "");
};

export interface TenantBranding {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  slogan: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
  cover_image_url: string | null;
  institution_type: string | null;
  is_active: boolean;
  login_title?: string | null;
  login_subtitle?: string | null;
  login_layout?: string | null;
  login_overlay?: number | null;
  login_button_color?: string | null;
}


/**
 * Repli quand l'hébergeur redirige les sous-domaines vers le domaine principal :
 * `rectorplus.com/e/olsen` (ou `?e=olsen`) ouvre l'espace de l'établissement.
 */
export const getTenantSlugFromPath = (): string | null => {
  if (typeof window === "undefined") return null;
  const m = window.location.pathname.match(/^\/e\/([a-z0-9-]+)/i);
  const fromQuery = new URLSearchParams(window.location.search).get("e");
  const found = (m?.[1] ?? fromQuery ?? "").toLowerCase();
  if (found) {
    try { sessionStorage.setItem("rp_tenant_slug", found); } catch { /* ignore */ }
    return found;
  }
  try { return sessionStorage.getItem("rp_tenant_slug"); } catch { return null; }
};

const TENANT_BRANDING_KEY = "rp_tenant_branding";

/** Mémorise l'établissement identifié (clé d'accès) pour garder son branding sur le domaine principal. */
export const storeTenantBranding = (tenant: TenantBranding | null | undefined) => {
  try {
    if (!tenant) localStorage.removeItem(TENANT_BRANDING_KEY);
    else {
      localStorage.setItem(TENANT_BRANDING_KEY, JSON.stringify(tenant));
      if (tenant.slug) sessionStorage.setItem("rp_tenant_slug", tenant.slug);
    }
  } catch { /* ignore */ }
};

export const getStoredTenantBranding = (): TenantBranding | null => {
  try {
    const raw = localStorage.getItem(TENANT_BRANDING_KEY);
    return raw ? (JSON.parse(raw) as TenantBranding) : null;
  } catch {
    return null;
  }
};

export const useTenantSlug = () => {
  const slug = getTenantSlugFromHost() ?? getTenantSlugFromPath();
  const customDomain = slug ? null : getCustomDomainFromHost();


  const { data, isLoading } = useQuery({
    queryKey: ["tenant-host", slug, customDomain],
    queryFn: async () => {
      if (slug) {
        const { data, error } = await (supabase as any).rpc("get_institution_by_slug", { _slug: slug });
        if (error) return null;
        const row = Array.isArray(data) ? data[0] : data;
        return (row as TenantBranding) ?? null;
      }
      if (customDomain) {
        const { data, error } = await (supabase as any).rpc("get_institution_by_domain", { _domain: customDomain });
        if (error) return null;
        const row = Array.isArray(data) ? data[0] : data;
        return (row as TenantBranding) ?? null;
      }
      return null;
    },
    enabled: !!slug || !!customDomain,
    staleTime: 10 * 60 * 1000,
  });

  // A cached institution must never replace a different or unknown host's result.
  const tenant = slug || customDomain
    ? (data as TenantBranding | null) ?? null
    : getStoredTenantBranding();

  return { slug: slug ?? tenant?.slug ?? null, customDomain, tenant, isLoading, isTenantHost: !!slug || !!customDomain };
};

