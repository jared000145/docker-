import {supabase} from '@/integrations/supabase/client';
export async function resolvePrivateMedia(value:string|null|undefined):Promise<string|null>{
 if(!value)return null;let path=value;
 if(/^https?:/.test(value)){try{const parsed=new URL(value);const marker='/object/public/media/';const index=parsed.pathname.indexOf(marker);if(index<0)return value;path=decodeURIComponent(parsed.pathname.slice(index+marker.length));}catch{return null;}}
 if(path.startsWith('media:'))path=path.slice(6);
 const {data,error}=await supabase.storage.from('media').createSignedUrl(path,300);if(error)throw error;return data?.signedUrl||null;
}
