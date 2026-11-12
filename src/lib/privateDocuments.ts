import { supabase } from '@/integrations/supabase/client';

export async function privateDocumentUrl(bucket: string, value: string, expiresIn = 3600) {
  let path = value;
  if (/^https?:\/\//i.test(value)) {
    const url = new URL(value);
    const prefix = `/storage/v1/object/`;
    const match = url.pathname.match(new RegExp(`${prefix}(?:public|sign|authenticated)/${bucket}/(.+)`));
    if (!match) throw new Error('Chemin du document invalide.');
    path = decodeURIComponent(match[1]);
  }
  if (!path || path.startsWith('/') || path.split('/').includes('..')) throw new Error('Chemin du document invalide.');
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}
