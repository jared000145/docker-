import {useState} from 'react';
import {Link} from 'react-router-dom';
import {useQuery} from '@tanstack/react-query';
import {Mail,Users,ArrowRight,Send,Inbox} from 'lucide-react';
import {supabase} from '@/integrations/supabase/client';
import {useAuth} from '@/hooks/useAuth';
import {useRealtimeSubscription} from '@/hooks/useRealtimeSubscription';
import {Avatar,AvatarFallback,AvatarImage} from '@/components/ui/avatar';
import {Card,CardHeader,CardTitle,CardContent} from '@/components/ui/card';
import {isHiddenForUser} from '@/lib/chatMedia';

export default function DashboardCommunications(){
 const {user,profile}=useAuth();const institutionId=profile?.institution_id;
 const [folder,setFolder]=useState<'received'|'sent'>('received');
 const [peopleKind,setPeopleKind]=useState<'admin'|'user'>('admin');
 const messages=useQuery({queryKey:['dashboard-messages',institutionId,user?.id,folder],enabled:!!institutionId&&!!user,refetchInterval:30_000,queryFn:async()=>{
  const {data,error}=await supabase.from('messages').select('id,subject,body,sender_id,recipient_id,created_at,is_read,deleted_for,deleted_for_everyone,view_once,image_url,audio_url').eq('institution_id',institutionId!).eq(folder==='received'?'recipient_id':'sender_id',user!.id).order('created_at',{ascending:false}).limit(30);
  if(error)throw error;
  const visible=(data||[]).filter(message=>!isHiddenForUser(message,user!.id)&&!message.deleted_for_everyone).slice(0,5);
  const ids=[...new Set(visible.map(message=>folder==='received'?message.sender_id:message.recipient_id))];
  const contacts=ids.length?await supabase.from('profiles').select('user_id,first_name,last_name,avatar_url').eq('institution_id',institutionId!).in('user_id',ids):{data:[],error:null};
  if(contacts.error)throw contacts.error;
  return visible.map(message=>({...message,contact:contacts.data?.find(contact=>contact.user_id===(folder==='received'?message.sender_id:message.recipient_id))}));
 }});
 const people=useQuery({queryKey:['dashboard-people',institutionId,peopleKind],enabled:!!institutionId,queryFn:async()=>{
  const roles=await supabase.from('user_roles').select('user_id').eq('role',peopleKind).limit(100);if(roles.error)throw roles.error;
  if(!roles.data?.length)return [];
  const {data,error}=await supabase.from('profiles').select('user_id,first_name,last_name,avatar_url,level,department').eq('institution_id',institutionId!).in('user_id',roles.data.map(role=>role.user_id)).order('last_name').limit(6);
  if(error)throw error;return data||[];
 }});
 useRealtimeSubscription('messages',[['dashboard-messages']],institutionId?{column:'institution_id',value:institutionId}:undefined);
 useRealtimeSubscription('profiles',[['dashboard-people'],['dashboard-messages']]);
 useRealtimeSubscription('user_roles',[['dashboard-people']]);
 const face=(person:{first_name?:string|null;last_name?:string|null;avatar_url?:string|null}|undefined)=>{const name=[person?.first_name,person?.last_name].filter(Boolean).join(' ')||'Contact indisponible';return <Avatar className="h-10 w-10 shrink-0"><AvatarImage src={person?.avatar_url||undefined} alt={name}/><AvatarFallback className="bg-blue-50 text-blue-700">{person?.first_name?.[0]}{person?.last_name?.[0]||'U'}</AvatarFallback></Avatar>;};
 return <div className="dashboard-communications">
  <Card><CardHeader className="flex-row flex-wrap items-center justify-between gap-3"><CardTitle className="workspace-card-title"><Mail/>Messagerie</CardTitle><Link to="/admin/messages" className="workspace-detail-link">Ouvrir <ArrowRight/></Link></CardHeader><CardContent><div className="workspace-segmented" aria-label="Dossier des messages">{(['received','sent'] as const).map(value=><button type="button" key={value} aria-pressed={folder===value} onClick={()=>setFolder(value)}>{value==='received'?<Inbox/>:<Send/>}{value==='received'?'Reçus':'Envoyés'}</button>)}</div>
   {messages.isError?<p role="alert" className="workspace-panel-message">Les messages sont momentanément indisponibles.</p>:messages.isPending?<p className="workspace-panel-message">Chargement des messages…</p>:!messages.data?.length?<p className="workspace-panel-message">Aucun message {folder==='received'?'reçu':'envoyé'} pour le moment.</p>:<ul className="dashboard-message-list">{messages.data.map(message=>{const name=[message.contact?.first_name,message.contact?.last_name].filter(Boolean).join(' ')||'Contact indisponible';const target=folder==='received'?message.sender_id:message.recipient_id;return <li key={message.id}><Link to={`/admin/messages?to=${encodeURIComponent(target)}`} className="dashboard-message-link">{face(message.contact)}<span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2"><strong className="truncate text-sm">{name}</strong><time className="text-xs text-muted-foreground" dateTime={message.created_at}>{new Date(message.created_at).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</time></span><span className="block truncate text-xs font-medium mt-1">{message.subject||'Sans objet'}</span><span className="block truncate text-xs text-muted-foreground mt-1">{message.view_once?'Message à vue unique':message.body|| (message.image_url?'Image':message.audio_url?'Message vocal':'Message')}</span></span>{folder==='received'&&!message.is_read&&<span aria-label="Non lu" className="message-unread-dot"/>}</Link></li>;})}</ul>}
  </CardContent></Card>
  <Card><CardHeader className="flex-row flex-wrap items-center justify-between gap-3"><CardTitle className="workspace-card-title"><Users/>Les personnes</CardTitle><Link to={peopleKind==='admin'?'/admin/team':'/admin/students'} className="workspace-detail-link">Voir tout <ArrowRight/></Link></CardHeader><CardContent><div className="workspace-segmented" aria-label="Type de personnes"><button type="button" aria-pressed={peopleKind==='admin'} onClick={()=>setPeopleKind('admin')}>Administration</button><button type="button" aria-pressed={peopleKind==='user'} onClick={()=>setPeopleKind('user')}>Étudiants</button></div>
   {people.isError?<p role="alert" className="workspace-panel-message">Les contacts sont momentanément indisponibles.</p>:people.isPending?<p className="workspace-panel-message">Chargement des contacts…</p>:!people.data?.length?<p className="workspace-panel-message">Aucun contact disponible.</p>:<ul className="dashboard-people-list">{people.data.map(person=><li key={person.user_id}>{face(person)}<div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{person.first_name} {person.last_name}</p><p className="truncate text-xs text-muted-foreground mt-1">{peopleKind==='admin'?person.department||'Administration':person.level||'Étudiant'}</p></div>{person.user_id!==user?.id&&<Link className="people-message-button" aria-label={`Écrire à ${person.first_name} ${person.last_name}`} to={`/admin/messages?to=${encodeURIComponent(person.user_id)}`}><Mail/></Link>}</li>)}</ul>}
  </CardContent></Card>
 </div>;
}
