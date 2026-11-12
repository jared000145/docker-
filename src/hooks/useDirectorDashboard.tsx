import {useQuery} from '@tanstack/react-query';
import {supabase} from '@/integrations/supabase/client';
import {useAuth} from '@/hooks/useAuth';
import {useCampus} from '@/hooks/useCampus';
import {useAcademicYear} from '@/hooks/useAcademicYear';
import {useRealtimeSubscription} from '@/hooks/useRealtimeSubscription';
export interface DirectorSite{id:string;name:string;city:string|null;photo_path:string|null;students:number;success:number|null}
export interface DirectorSummary{students:number;assessed:number;success:number|null;received:number|null;unpaid:number|null;pending:number|null;unassigned:number;sites:DirectorSite[];evolution:{month:string;students:number}[]}
export function useDirectorDashboard(){
 const {profile,user}=useAuth(),{campusId,isLoading}=useCampus(),{selectedYear}=useAcademicYear();
 const query=useQuery({queryKey:['director-summary',user?.id,profile?.institution_id,selectedYear,campusId],enabled:!!profile?.institution_id&&!isLoading,refetchInterval:30000,queryFn:async()=>{const {data,error}=await(supabase as any).rpc('director_dashboard',{_year:selectedYear,_campus:campusId});if(error)throw error;return data as DirectorSummary;}});
 useRealtimeSubscription('student_years',[['director-summary']]);useRealtimeSubscription('grades',[['director-summary']]);useRealtimeSubscription('grades_trimestre' as any,[['director-summary']]);useRealtimeSubscription('payments',[['director-summary']]);useRealtimeSubscription('document_validations',[['director-summary']]);
 return query;
}
