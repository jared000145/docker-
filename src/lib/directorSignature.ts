import { supabase } from "@/integrations/supabase/client";

export type SignatureRoleScope = "directeur" | "responsable_pedagogique" | "responsable_cycle";

const loadAsDataUrl = (url: string): Promise<string | null> =>
  new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          const c = document.createElement("canvas");
          c.width = img.width; c.height = img.height;
          const ctx = c.getContext("2d");
          if (!ctx) return resolve(null);
          ctx.drawImage(img, 0, 0);
          resolve(c.toDataURL("image/png"));
        } catch { resolve(null); }
      };
      img.onerror = () => resolve(null);
      img.src = url;
    } catch { resolve(null); }
  });

export interface DirectorSignatureAssets {
  signature: string | null;
  stamp: string | null;
  name: string | null;
}

export interface ValidatorSignatures {
  signedAt?: string;
  directeur: DirectorSignatureAssets | null;
  pedagogique: DirectorSignatureAssets | null;
  cycle: DirectorSignatureAssets | null;
}

const cache = new Map<string, Promise<DirectorSignatureAssets | null>>();
let bundleCache: Promise<ValidatorSignatures> | null = null;

export function invalidateDirectorSignatureCache() {
  cache.clear();
  bundleCache = null;
}

async function resolveInstitutionId(institutionId?: string | null): Promise<string | null> {
  if (institutionId) return institutionId;
  const { data: u } = await supabase.auth.getUser();
  if (!u?.user) return null;
  const { data: p } = await supabase.from("profiles").select("institution_id").eq("user_id", u.user.id).maybeSingle();
  return (p as any)?.institution_id || null;
}

async function fetchActiveSignature(instId: string, scope: SignatureRoleScope): Promise<DirectorSignatureAssets | null> {
  const { data } = await (supabase as any)
    .from("director_signatures")
    .select("director_name, signature_url, stamp_url, role_scope")
    .eq("institution_id", instId)
    .eq("is_active", true)
    .eq("role_scope", scope)
    .maybeSingle();
  if (!data) return null;
  const [signature, stamp] = await Promise.all([
    data.signature_url ? resolveSignatureUrl(data.signature_url).then(loadAsDataUrl) : Promise.resolve(null),
    data.stamp_url ? resolveSignatureUrl(data.stamp_url).then(loadAsDataUrl) : Promise.resolve(null),
  ]);
  return { signature, stamp, name: data.director_name || null };
}

export async function getActiveDirectorSignature(
  institutionId?: string | null,
  scope: SignatureRoleScope = "directeur",
): Promise<DirectorSignatureAssets | null> {
  const instId = await resolveInstitutionId(institutionId);
  if (!instId) return null;
  const key = `${instId}::${scope}`;
  if (!cache.has(key)) {
    cache.set(key, fetchActiveSignature(instId, scope).catch(() => null));
  }
  return cache.get(key)!;
}

/** Returns directeur + pedagogique + cycle signatures bundle for an institution. */
export async function getValidatorSignatures(institutionId?: string | null): Promise<ValidatorSignatures> {
  if (bundleCache) return bundleCache;
  bundleCache = (async () => {
    const instId = await resolveInstitutionId(institutionId);
    if (!instId) return { directeur: null, pedagogique: null, cycle: null };
    const [directeur, pedagogique, cycle] = await Promise.all([
      getActiveDirectorSignature(instId, "directeur"),
      getActiveDirectorSignature(instId, "responsable_pedagogique"),
      getActiveDirectorSignature(instId, "responsable_cycle"),
    ]);
    return { directeur, pedagogique, cycle };
  })();
  return bundleCache;
}

/**
 * Removes near-white background from an image File and returns a transparent PNG File.
 */
export async function removeWhiteBackground(file: File, threshold = 42, softness = 36): Promise<File> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = dataUrl;
  });
  const c = document.createElement("canvas");
  c.width = img.width; c.height = img.height;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  const imgData = ctx.getImageData(0, 0, c.width, c.height);
  const d = imgData.data;
  const samples: number[][] = [];
  const step = Math.max(1, Math.floor(Math.min(c.width, c.height) / 24));
  const pushSample = (x: number, y: number) => {
    const idx = (Math.max(0, Math.min(c.height - 1, y)) * c.width + Math.max(0, Math.min(c.width - 1, x))) * 4;
    if (d[idx + 3] > 20) samples.push([d[idx], d[idx + 1], d[idx + 2]]);
  };
  for (let x = 0; x < c.width; x += step) { pushSample(x, 0); pushSample(x, c.height - 1); }
  for (let y = 0; y < c.height; y += step) { pushSample(0, y); pushSample(c.width - 1, y); }
  const bg = samples.length
    ? samples.reduce((acc, p) => [acc[0] + p[0], acc[1] + p[1], acc[2] + p[2]], [0, 0, 0]).map((v) => v / samples.length)
    : [255, 255, 255];
  const colorDistance = (r: number, g: number, b: number) => Math.sqrt((r - bg[0]) ** 2 + (g - bg[1]) ** 2 + (b - bg[2]) ** 2);
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const dist = colorDistance(r, g, b);
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    const bgLum = 0.299 * bg[0] + 0.587 * bg[1] + 0.114 * bg[2];
    const closeToBackground = dist <= threshold || (lum > 228 && bgLum > 210);
    if (closeToBackground) {
      d[i + 3] = 0;
    } else if (dist <= threshold + softness) {
      const t = 1 - ((dist - threshold) / softness);
      d[i + 3] = Math.round(d[i + 3] * (1 - t));
    }
  }
  ctx.putImageData(imgData, 0, 0);
  const blob: Blob = await new Promise((resolve) => c.toBlob((b) => resolve(b!), "image/png"));
  return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".png", { type: "image/png" });
}

export async function resolveSignatureUrl(value:string):Promise<string>{
 let path=value;
 if(/^https?:/.test(value)){const parsed=new URL(value);const marker='/signatures/';const index=parsed.pathname.indexOf(marker);if(index<0)throw Error('Chemin de signature invalide');path=decodeURIComponent(parsed.pathname.slice(index+marker.length));}
 const {data,error}=await supabase.storage.from('signatures').createSignedUrl(path,300);if(error||!data?.signedUrl)throw Error('Signature inaccessible');return data.signedUrl;
}
export async function getDocumentSignatures(document:any):Promise<ValidatorSignatures>{
 if(document?.status!=='validated'||!document.pedagogique_signature_id||!document.cycle_signature_id||!document.signature_id)throw Error('Le circuit de signature n’est pas terminé.');
 const ids=[document.signature_id,document.pedagogique_signature_id,document.cycle_signature_id];
 const {data,error}=await (supabase as any).from('director_signatures').select('id,director_name,signature_url,stamp_url').eq('institution_id',document.institution_id).in('id',ids);
 if(error||data?.length!==3)throw Error('Les signatures de ce dossier sont indisponibles.');
 const asset=async(id:string)=>{const row=data.find((r:any)=>r.id===id);const signature=row.signature_url?await loadAsDataUrl(await resolveSignatureUrl(row.signature_url)):null;const stamp=row.stamp_url?await loadAsDataUrl(await resolveSignatureUrl(row.stamp_url)):null;if(!signature)throw Error('Une signature ne peut pas être chargée.');return{signature,stamp,name:row.director_name};};
 const [directeur,pedagogique,cycle]=await Promise.all(ids.map(asset));return{directeur,pedagogique,cycle,signedAt:document.validated_at};
}
