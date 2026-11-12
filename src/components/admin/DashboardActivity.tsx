import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Activity, ArrowRight, CalendarDays, CheckCircle2, ClipboardCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAcademicYear } from '@/hooks/useAcademicYear';
import { usePermissions } from '@/hooks/usePermissions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';

const dateLabel = (value: string) => new Date(value).toLocaleDateString('fr-FR', {day:'numeric',month:'short'});
function QueryMessage({loading, failed}: {loading:boolean;failed:boolean}) {
  return <p role={failed?'alert':'status'} className="py-8 text-center text-sm text-muted-foreground">{failed?'Ces données sont momentanément indisponibles.':loading?'Chargement…':'Aucun enregistrement disponible.'}</p>;
}

export default function DashboardActivity() {
  const {profile}=useAuth();
  const {selectedYear}=useAcademicYear();
  const {can,isLoading:permissionsLoading}=usePermissions();
  const institutionId=profile?.institution_id;
  const attendanceAllowed=!permissionsLoading&&can('presences');
  const auditAllowed=!permissionsLoading&&can('audit');
  const attendance=useQuery({
    queryKey:['dashboard-attendance',institutionId,selectedYear],
    enabled:!!institutionId&&attendanceAllowed,
    refetchInterval:30_000,
    queryFn:async()=>{
      const base=()=>supabase.from('attendance').select('id',{count:'exact',head:true}).eq('institution_id',institutionId!).eq('academic_year',selectedYear);
      const [all,absent,recent]=await Promise.all([
        base().in('status',['present','absent','justified']),base().in('status',['absent','justified']),
        supabase.from('attendance').select('id,user_id,date,subject_id,justificatif_status,status').eq('institution_id',institutionId!).eq('academic_year',selectedYear).in('status',['absent','justified']).order('date',{ascending:false}).order('id').limit(5),
      ]);
      for(const result of [all,absent,recent])if(result.error)throw result.error;
      if(all.count===null||absent.count===null)throw new Error('Comptage indisponible');
      const ids=[...new Set((recent.data||[]).map(row=>row.user_id))];
      const subjectIds=[...new Set((recent.data||[]).flatMap(row=>row.subject_id?[row.subject_id]:[]))];
      const [people,subjects]=await Promise.all([
        ids.length?supabase.from('profiles').select('user_id,first_name,last_name,avatar_url,level').eq('institution_id',institutionId!).in('user_id',ids):Promise.resolve({data:[],error:null}),
        subjectIds.length?supabase.from('subjects').select('id,name').eq('institution_id',institutionId!).in('id',subjectIds):Promise.resolve({data:[],error:null}),
      ]);
      if(people.error)throw people.error;if(subjects.error)throw subjects.error;
      return {total:all.count,absent:absent.count,rows:(recent.data||[]).map(row=>({...row,person:people.data?.find(person=>person.user_id===row.user_id),subject:subjects.data?.find(subject=>subject.id===row.subject_id)?.name}))};
    },
  });
  const activity=useQuery({
    queryKey:['dashboard-activity',institutionId],enabled:!!institutionId&&auditAllowed,refetchInterval:30_000,
    queryFn:async()=>{
      const {data,error}=await supabase.from('audit_logs').select('id,action,description,created_at,user_role,module').eq('institution_id',institutionId!).order('created_at',{ascending:false}).limit(5);
      if(error)throw error;return data||[];
    },
  });
  const filter=institutionId?{column:'institution_id',value:institutionId}:undefined;
  useRealtimeSubscription('attendance',[['dashboard-attendance']],filter);
  useRealtimeSubscription('audit_logs',[['dashboard-activity']],filter);
  const total=attendance.data?.total||0;
  const absent=attendance.data?.absent||0;
  const rate=total?Math.round((total-absent)/total*1000)/10:null;
  if(!attendanceAllowed&&!auditAllowed)return null;
  return <div className="dashboard-detail-grid">
    {attendanceAllowed&&<>
      <Card className="dashboard-presence"><CardHeader><CardTitle className="workspace-card-title"><ClipboardCheck />Taux de présence</CardTitle><p className="text-xs text-muted-foreground">Année {selectedYear} · absences justifiées incluses</p></CardHeader><CardContent>
        {attendance.isPending||attendance.isError?<QueryMessage loading={attendance.isPending} failed={attendance.isError}/>:<div className="flex flex-wrap items-center justify-center gap-7">
          <div className="presence-ring" role="img" aria-label={rate===null?'Aucun pointage':`${rate} % de présence`} style={{background:`conic-gradient(#2461f5 0% ${rate??0}%, #dce3fa ${rate??0}% 100%)`}}><div><strong>{rate===null?'—':`${rate.toLocaleString('fr-FR')} %`}</strong><span>Présence</span></div></div>
          <dl className="space-y-4 text-sm"><div><dt className="text-muted-foreground">Présences</dt><dd className="text-lg font-semibold">{(total-absent).toLocaleString('fr-FR')}</dd></div><div><dt className="text-muted-foreground">Absences</dt><dd className="text-lg font-semibold">{absent.toLocaleString('fr-FR')}</dd></div><div><dt className="text-muted-foreground">Pointages enregistrés</dt><dd className="font-semibold">{total.toLocaleString('fr-FR')}</dd></div></dl>
        </div>}
      </CardContent></Card>
      <Card className="dashboard-absences"><CardHeader className="flex-row items-center justify-between gap-3"><CardTitle className="workspace-card-title"><CalendarDays />Absences récentes</CardTitle><Link className="workspace-detail-link" to="/admin/attendance">Tout voir <ArrowRight/></Link></CardHeader><CardContent>
        {attendance.isPending||attendance.isError||!attendance.data?.rows.length?<QueryMessage loading={attendance.isPending} failed={attendance.isError}/>:<Table><TableHeader><TableRow><TableHead>Étudiant</TableHead><TableHead>Matière</TableHead><TableHead>Date</TableHead><TableHead>Justificatif</TableHead></TableRow></TableHeader><TableBody>{attendance.data.rows.map(row=>{
          const name=[row.person?.first_name,row.person?.last_name].filter(Boolean).join(' ')||'Étudiant';
          const approved=row.status==='justified'||row.justificatif_status==='approved';
          return <TableRow key={row.id}><TableCell><div className="flex items-center gap-3"><Avatar className="h-8 w-8"><AvatarImage src={row.person?.avatar_url||undefined} alt={name}/><AvatarFallback>{row.person?.first_name?.[0]||'E'}{row.person?.last_name?.[0]}</AvatarFallback></Avatar><div><p className="font-medium">{name}</p><p className="text-xs text-muted-foreground">{row.person?.level||'Niveau non renseigné'}</p></div></div></TableCell><TableCell>{row.subject||'Non renseignée'}</TableCell><TableCell>{dateLabel(row.date)}</TableCell><TableCell><span className={`workspace-status ${approved?'workspace-status-success':'workspace-status-neutral'}`}>{approved?'Approuvé':row.justificatif_status==='pending'?'En attente':row.justificatif_status==='rejected'?'Refusé':'Non fourni'}</span></TableCell></TableRow>;
        })}</TableBody></Table>}
      </CardContent></Card>
    </>}
    {auditAllowed&&<Card className="dashboard-activity"><CardHeader className="flex-row items-center justify-between gap-3"><CardTitle className="workspace-card-title"><Activity/>Activités récentes</CardTitle><Link className="workspace-detail-link" to="/admin/audit">Voir le journal <ArrowRight/></Link></CardHeader><CardContent>
      {activity.isPending||activity.isError||!activity.data?.length?<QueryMessage loading={activity.isPending} failed={activity.isError}/>:<ul className="workspace-activity-list">{activity.data.map(row=><li key={row.id}><span className="activity-symbol"><CheckCircle2/></span><div className="min-w-0 flex-1"><p className="font-medium text-sm break-words">{row.description||row.action}</p><p className="text-xs text-muted-foreground mt-1">{row.module||'Administration'} · {row.user_role||'Utilisateur'}</p></div><time className="text-xs text-muted-foreground shrink-0" dateTime={row.created_at}>{dateLabel(row.created_at)}</time></li>)}</ul>}
    </CardContent></Card>}
  </div>;
}
