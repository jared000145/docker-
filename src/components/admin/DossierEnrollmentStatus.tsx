import {useQuery} from '@tanstack/react-query';
import {supabase} from '@/integrations/supabase/client';
import {useAcademicYear} from '@/hooks/useAcademicYear';
import {Badge} from '@/components/ui/badge';

const labels:Record<string,string>={active:'Inscription active',pending:'Inscription préparée',completed:'Année terminée',blocked_unpaid:'Accès suspendu · impayé',blocked_unregistered:'Accès suspendu',end_of_cycle_archived:'Fin de cycle',repeating:'Redoublement',expelled:'Exclusion',dropped:'Abandon',transferred:'Transfert'};
export default function DossierEnrollmentStatus({studentId}:{studentId:string}){
 const {selectedYear}=useAcademicYear();
 const {data,isPending,isError}=useQuery({queryKey:['dossier-enrollment',studentId,selectedYear],queryFn:async()=>{
  const {data,error}=await(supabase as any).from('student_years').select('enrollment_status,can_access,progression').eq('user_id',studentId).eq('academic_year',selectedYear).maybeSingle();if(error)throw error;return data;
 }});
 if(isPending)return null;
 if(isError)return <Badge variant="outline">Inscription indisponible</Badge>;
 if(!data)return <Badge variant="outline">Inscription non renseignée · {selectedYear}</Badge>;
 return <><Badge variant="secondary">{labels[data.enrollment_status]||'Inscription à vérifier'} · {selectedYear}</Badge>{data.progression==='repeat'&&data.enrollment_status!=='repeating'&&<Badge variant="outline">Redoublement</Badge>}</>;
}
