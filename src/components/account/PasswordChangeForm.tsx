import {useState} from 'react';
import {KeyRound,Loader2} from 'lucide-react';
import {useAuth} from '@/hooks/useAuth';
import {useQueryClient} from '@tanstack/react-query';
import {supabase} from '@/integrations/supabase/client';
import {invokeServer} from '@/lib/serverCall';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {toast} from 'sonner';
export default function PasswordChangeForm({initial=false}:{initial?:boolean}){
 const {user}=useAuth(),qc=useQueryClient();const [password,setPassword]=useState(''),[confirm,setConfirm]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function submit(e:React.FormEvent){e.preventDefault();setError('');if(password.length<6||password.length>128){setError('Saisissez entre 6 et 128 caractères.');return;}if(password!==confirm){setError('Les deux mots de passe ne correspondent pas.');return;}if(password==='123456'){setError('Choisissez un mot de passe personnel différent du mot de passe initial.');return;}setBusy(true);try{await invokeServer('update-user-password',{new_password:password});const refresh=await supabase.auth.refreshSession();if(refresh.error){toast.success('Mot de passe modifié. Reconnectez-vous avec le nouveau mot de passe.');await supabase.auth.signOut();return;}await qc.invalidateQueries();setPassword('');setConfirm('');toast.success('Mot de passe modifié');}catch(e:any){setError(e.message||'Le mot de passe n’a pas pu être modifié.');}finally{setBusy(false);}}
 return <section className="account-panel"><div className="account-section-heading"><span className="account-icon"><KeyRound/></span><div><h2>{initial?'Choisir mon mot de passe personnel':'Modifier mon mot de passe'}</h2><p>{initial?'Votre compte utilise un mot de passe initial. Remplacez-le pour accéder à votre espace.':'Cette modification concerne uniquement votre compte.'}</p></div></div><form className="space-y-4" onSubmit={submit}><label className="grid gap-2 text-sm">Nouveau mot de passe<Input type="password" autoComplete="new-password" minLength={6} maxLength={128} required value={password} onChange={e=>setPassword(e.target.value)}/></label><label className="grid gap-2 text-sm">Confirmer le nouveau mot de passe<Input type="password" autoComplete="new-password" minLength={6} maxLength={128} required value={confirm} onChange={e=>setConfirm(e.target.value)}/></label><p className="text-xs text-muted-foreground">Entre 6 et 128 caractères. Évitez de réutiliser le mot de passe initial.</p>{error&&<p role="alert" className="text-sm text-destructive">{error}</p>}<Button type="submit" disabled={busy||!user}>{busy?<Loader2 className="animate-spin"/>:<KeyRound/>}{busy?'Enregistrement…':'Enregistrer mon mot de passe'}</Button></form></section>;
}
