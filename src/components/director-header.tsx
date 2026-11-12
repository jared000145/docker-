import {useAcademicYear} from '@/hooks/useAcademicYear';
import {useEffect,useState} from 'react';
import {Link,useLocation} from 'react-router-dom';
import {useQuery} from '@tanstack/react-query';
import {supabase} from '@/integrations/supabase/client';
import {useAuth} from '@/hooks/useAuth';
import {useCampus} from '@/hooks/useCampus';
import {usePermissions} from '@/hooks/usePermissions';
import {Search,Home,ChevronRight,Bell} from 'lucide-react';
import AccountMenu from '@/components/account/AccountMenu';
import {SidebarTrigger} from '@/components/ui/sidebar';
import {CampusSelector} from '@/components/admin/CampusSelector';
export default function DirectorHeader(){
 const {selectedYear,availableYears,setSelectedYear}=useAcademicYear();
 const [search,setSearch]=useState(''),[term,setTerm]=useState('');const{user}=useAuth(),{campusId,campuses,setCampusId}=useCampus(),{can}=usePermissions(),location=useLocation();
 useEffect(()=>{const t=setTimeout(()=>setTerm(search.trim()),250);return()=>clearTimeout(t);},[search]);useEffect(()=>setSearch(''),[location.pathname]);
 const people=useQuery({queryKey:['director-search',user?.id,term,campusId],enabled:term.length>=2,queryFn:async()=>{const{data,error}=await(supabase as any).rpc('contact_directory',{_search:term,_campus:campusId});if(error)throw error;return(data as any[]).filter(p=>p.is_student).slice(0,6);}});
 const notifs=useQuery({queryKey:['director-unread',user?.id],enabled:!!user,refetchInterval:15000,queryFn:async()=>{const{count,error}=await supabase.from('notifications').select('id',{count:'exact',head:true}).eq('user_id',user!.id).eq('is_read',false);if(error)throw error;return count||0;}});
 const campusResults=term.length>=2?campuses.filter(c=>(c.name+' '+c.city).toLocaleLowerCase().includes(term.toLocaleLowerCase())).slice(0,4):[];
 return <header className="director-header"><SidebarTrigger/><nav className="director-breadcrumb" aria-label="Fil d’Ariane"><Link to="/director" aria-label="Accueil directeur"><Home/></Link><ChevronRight/><span>RectorPlus</span><ChevronRight/><span>Directeur</span></nav><div className="director-search"><Search/><input aria-label="Rechercher un étudiant ou un campus" placeholder="Rechercher un étudiant, un campus…" value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>{if(e.key==='Escape')setSearch('');}}/>{term.length>=2&&<div className="director-search-results">{campusResults.map(c=><button key={c.id} onClick={()=>{setCampusId(c.id);setSearch('');}}><strong>{c.name}</strong><small>Campus · {c.city}</small></button>)}{people.data?.map(p=><Link key={p.user_id} to={can('etudiants')?'/admin/students/'+p.user_id:'/director/reports'}><strong>{p.first_name} {p.last_name}</strong><small>{p.student_number} · {p.campus_name}</small></Link>)}{!campusResults.length&&!people.data?.length&&<p>{people.isFetching?'Recherche…':people.isError?'Recherche indisponible.':'Aucun résultat dans vos accès.'}</p>}</div>}</div><CampusSelector/>{location.pathname!=='/director'&&<select className="director-header-year" aria-label="Ann?e scolaire" value={selectedYear} onChange={e=>setSelectedYear(e.target.value)}>{availableYears.map(y=><option key={y}>{y}</option>)}</select>}<Link className="director-notification-button" to="/director/notifications" aria-label="Notifications"><Bell/>{!!notifs.data&&<b>{notifs.data>99?'99+':notifs.data}</b>}</Link><AccountMenu role="Directeur"/></header>;
}
