import CampusExpenseEntry from './CampusExpenseEntry';
import {useQuery} from '@tanstack/react-query';
import {supabase} from '@/integrations/supabase/client';
import {useAcademicYear} from '@/hooks/useAcademicYear';
import {useCampus} from '@/hooks/useCampus';
import {useAuth} from '@/hooks/useAuth';
import {usePermissions} from '@/hooks/usePermissions';
import {useRealtimeSubscription} from '@/hooks/useRealtimeSubscription';
import {Building2,Users,ArrowDownLeft,ArrowUpRight,Wallet,Globe2} from 'lucide-react';
const money=(n:number)=>Number(n).toLocaleString('fr-FR')+' FCFA';
export default function CampusOverview(){
 const {selectedYear}=useAcademicYear(),{campuses,campusId,canViewAll}=useCampus(),{profile}=useAuth(),{can}=usePermissions();
 const permitted=can('etudiants')||can('director_dashboard')||can('paiements')||can('director_finance');
 const query=useQuery({queryKey:['campus-overview',profile?.institution_id,selectedYear],enabled:!!profile?.institution_id&&campuses.length>0&&permitted,refetchInterval:15000,queryFn:async()=>{const{data,error}=await(supabase as any).rpc('campus_overview',{_year:selectedYear});if(error)throw error;return data as any[];}});
 useRealtimeSubscription('payments',[['campus-overview']]);useRealtimeSubscription('student_years',[['campus-overview']]);useRealtimeSubscription('campus_expenses' as any,[['campus-overview']]);
 if(!campuses.length||!permitted)return null;
 const rows=query.data?.filter(c=>!campusId||c.id===campusId)||[],students=rows.reduce((s,c)=>s+Number(c.students),0),financial=rows.length>0&&rows.every(c=>c.received!==null&&c.expenses!==null),received=rows.reduce((s,c)=>s+Number(c.received||0),0),expenses=rows.reduce((s,c)=>s+Number(c.expenses||0),0);
 const stats=[{label:'Effectif inscrit',value:query.isLoading?'…':students.toLocaleString('fr-FR'),icon:Users},...(financial?[{label:'Encaissements',value:money(received),icon:ArrowDownLeft},{label:'Dépenses saisies',value:money(expenses),icon:ArrowUpRight},{label:'Solde de trésorerie',value:money(received-expenses),icon:Wallet}]:[])];
 return <section className="campus-command-center"><header><div><span className="workspace-eyebrow">Pilotage multicampus · {selectedYear}</span><h2>Vue des campus</h2><p>{canViewAll&&!campusId?'Vision globale de l’établissement':'Données des campus autorisés dans le périmètre sélectionné'}</p></div><span className="campus-scope-pill"><Globe2/>{query.isLoading?'Chargement…':rows.length+' site(s) affiché(s)'}</span></header>
 {query.isError?<p role="alert">La synthèse n’a pas pu être chargée.</p>:<><div className={`campus-kpis ${financial?'has-finance':''}`}>{stats.map(({label,value,icon:Icon})=><div key={label}><span><Icon/></span><p>{label}</p><strong>{value}</strong></div>)}</div><div className="campus-sites">{rows.map(c=><article key={c.id}><div className="flex items-center gap-3"><span className="workspace-icon"><Building2/></span><div><h3>{c.name}</h3><p>{Number(c.students).toLocaleString('fr-FR')} élèves et étudiants</p></div></div>{c.received!==null&&<dl><div><dt>Encaissements</dt><dd>{money(c.received)}</dd></div><div><dt>Dépenses</dt><dd>{money(c.expenses)}</dd></div><div><dt>Solde</dt><dd>{money(Number(c.received)-Number(c.expenses))}</dd></div></dl>}</article>)}</div></>}
 {!query.isLoading&&!financial&&<p className="text-xs text-muted-foreground">Les montants financiers ne sont pas compris dans les droits de ce périmètre.</p>}
 {financial&&<p className="text-xs text-muted-foreground">Le solde correspond aux encaissements moins les dépenses saisies ; il ne constitue pas un bénéfice comptable.</p>}<CampusExpenseEntry/></section>;
}
