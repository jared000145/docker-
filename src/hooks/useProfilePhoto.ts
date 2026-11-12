import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { privatePhotoPath, PROFILE_PHOTO_BUCKET, PROFILE_PHOTO_PREFIX } from '@/lib/profilePhoto';

export function useProfilePhoto(value?: string | null) {
  const path=privatePhotoPath(value);
  const {data}=useQuery({queryKey:['private-profile-photo',path],enabled:!!path,staleTime:45*60*1000,refetchInterval:45*60*1000,retry:1,queryFn:async()=>{
    const {data,error}=await supabase.storage.from(PROFILE_PHOTO_BUCKET).createSignedUrl(path!,3600);
    if(error)throw error;
    return data.signedUrl;
  }});
  return value?.startsWith(PROFILE_PHOTO_PREFIX) ? data : value || undefined;
}
