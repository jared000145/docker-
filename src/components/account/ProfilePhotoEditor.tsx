import { useEffect, useRef, useState } from 'react';
import { Camera, Loader2, RotateCcw, Save } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cropRectangle, photoMime, PROFILE_PHOTO_BUCKET, PROFILE_PHOTO_PREFIX, privatePhotoPath } from '@/lib/profilePhoto';
import { toast } from 'sonner';

export default function ProfilePhotoEditor() {
  const {user,profile,updateAvatar}=useAuth();
  const input=useRef<HTMLInputElement>(null);const canvas=useRef<HTMLCanvasElement>(null);
  const activeUser=useRef(user?.id);activeUser.current=user?.id;
  const [image,setImage]=useState<HTMLImageElement|null>(null);
  const [source,setSource]=useState<string|null>(null);
  const [zoom,setZoom]=useState(1);const [x,setX]=useState(0);const [y,setY]=useState(0);
  const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  useEffect(()=>()=>{if(source)URL.revokeObjectURL(source);},[source]);
  useEffect(()=>{setImage(null);setSource(null);setError('');},[user?.id]);
  useEffect(()=>{
    if(!image||!canvas.current)return;
    const context=canvas.current.getContext('2d');if(!context)return;
    const crop=cropRectangle(image.naturalWidth,image.naturalHeight,zoom,x,y);
    context.clearRect(0,0,512,512);context.drawImage(image,crop.left,crop.top,crop.side,crop.side,0,0,512,512);
  },[image,zoom,x,y]);
  async function choose(file?:File){
    if(!file)return;setError('');setBusy(true);
    const id=user?.id;let objectUrl:string|undefined;
    try{
      if(file.size>5*1024*1024||file.size===0)throw Error('Choisissez une image de moins de 5 Mo.');
      const mime=photoMime(new Uint8Array(await file.slice(0,16).arrayBuffer()));
      if(!mime)throw Error('Format non accepté. Utilisez une photo JPEG, PNG ou WebP.');
      objectUrl=URL.createObjectURL(file);
      const decoded=await new Promise<HTMLImageElement>((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('Cette image ne peut pas être lue. Essayez une autre photo.'));img.src=objectUrl!;});
      if(decoded.naturalWidth*decoded.naturalHeight>40_000_000)throw Error('Image trop grande. Choisissez une photo de moins de 40 mégapixels.');
      if(activeUser.current!==id){URL.revokeObjectURL(objectUrl);return;}
      setImage(decoded);setSource(objectUrl);setZoom(1);setX(0);setY(0);
    }catch(caught){if(objectUrl)URL.revokeObjectURL(objectUrl);setError(caught instanceof Error?caught.message:'Lecture impossible.');}
    finally{setBusy(false);if(input.current)input.current.value='';}
  }
  async function save(){
    if(!canvas.current||!user||!image)return;
    const id=user.id;setBusy(true);setError('');let uploaded:string|undefined;
    try{
      const blob=await new Promise<Blob>((resolve,reject)=>canvas.current!.toBlob(b=>b?resolve(b):reject(Error('Préparation de la photo impossible.')),'image/webp',0.88));
      const path=`${id}/${crypto.randomUUID()}.${blob.type==='image/webp'?'webp':'png'}`;
      const result=await supabase.storage.from(PROFILE_PHOTO_BUCKET).upload(path,blob,{contentType:blob.type,upsert:false});
      if(result.error)throw Error('La photo n’a pas été enregistrée. Vérifiez votre connexion et l’activation du stockage privé par RectorPlus.');
      uploaded=path;
      if(activeUser.current!==id)throw Error('Votre compte a changé. Recommencez depuis le bon compte.');
      const oldPath=privatePhotoPath(profile?.avatar_url);
      await updateAvatar(PROFILE_PHOTO_PREFIX+path);
      uploaded=undefined;setImage(null);setSource(null);toast.success('Votre photo de profil est enregistrée.');
      // Only remove our previous private photo after the new profile is saved.
      if(oldPath?.startsWith(id+'/'))void supabase.storage.from(PROFILE_PHOTO_BUCKET).remove([oldPath]);
    }catch(caught){if(uploaded)void supabase.storage.from(PROFILE_PHOTO_BUCKET).remove([uploaded]);setError(caught instanceof Error?caught.message:'Enregistrement impossible.');}
    finally{setBusy(false);}
  }
  const name=[profile?.first_name,profile?.last_name].filter(Boolean).join(' ')||'Votre compte';
  return <section className="account-panel" aria-labelledby="photo-title"><div className="account-section-heading"><span className="account-icon"><Camera /></span><div><h2 id="photo-title">Photo de profil</h2><p>Votre photo apparaît dans votre compte et les espaces où vous êtes autorisé.</p></div></div>
    <div className="flex flex-wrap items-center gap-5"><Avatar className="h-24 w-24 border-4 border-white shadow-md"><AvatarImage src={profile?.avatar_url||undefined} alt={`Photo de ${name}`} /><AvatarFallback className="bg-blue-50 text-2xl font-semibold text-blue-700">{(profile?.first_name?.[0]||'')+(profile?.last_name?.[0]||'')||'U'}</AvatarFallback></Avatar><div className="space-y-2"><p className="font-semibold">{name}</p><p className="text-sm text-muted-foreground">JPEG, PNG ou WebP · 5 Mo maximum</p><Button type="button" variant="outline" disabled={busy} onClick={()=>input.current?.click()}><Camera className="mr-2 h-4 w-4" />Choisir une photo</Button><input ref={input} type="file" aria-label="Choisir une photo de profil" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={busy} onChange={e=>void choose(e.target.files?.[0])} /></div></div>
    {image&&<div className="mt-6 grid gap-6 sm:grid-cols-[220px_1fr]"><div><canvas ref={canvas} width={512} height={512} className="h-auto w-full max-w-[220px] rounded-2xl border bg-slate-100" aria-label="Aperçu de la photo recadrée" /><p className="mt-2 text-xs text-muted-foreground">Aperçu du cadrage enregistré.</p></div><div className="space-y-4">{[{label:'Zoom',value:zoom,set:setZoom,min:1,max:3,step:.05},{label:'Position horizontale',value:x,set:setX,min:-100,max:100,step:1},{label:'Position verticale',value:y,set:setY,min:-100,max:100,step:1}].map(control=><label className="block text-sm font-medium" key={control.label}>{control.label}<input className="mt-3 block w-full accent-blue-600" type="range" aria-label={control.label} min={control.min} max={control.max} step={control.step} value={control.value} onChange={e=>control.set(Number(e.target.value))} disabled={busy} /></label>)}<div className="flex flex-wrap gap-2"><Button type="button" disabled={busy} onClick={()=>void save()}>{busy?<Loader2 className="mr-2 h-4 w-4 animate-spin" />:<Save className="mr-2 h-4 w-4" />}Enregistrer ma photo</Button><Button type="button" variant="ghost" disabled={busy} onClick={()=>{setImage(null);setSource(null);setError('');}}><RotateCcw className="mr-2 h-4 w-4" />Annuler</Button></div></div></div>}
    {error&&<p role="alert" className="mt-4 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
    <p className="mt-5 text-xs text-muted-foreground">Les nouvelles photos sont préparées sans leurs métadonnées d’origine et enregistrées dans un espace privé. Votre photo actuelle est conservée si l’enregistrement échoue.</p>
  </section>;
}
