import {useQuery} from '@tanstack/react-query';
import {supabase} from '@/integrations/supabase/client';
import {useAuth} from '@/hooks/useAuth';
import {useInstitution} from '@/hooks/useInstitution';
import {institutionCycles,studentCycle} from '@/lib/academicCycles';

/** Resolve an individual's registration; enabled institution cycles alone are not a placement. */
export function useStudentPlacement(studentId?:string|null,year?:string){
 const {user,profile}=useAuth();
 const {institution,isLoading}=useInstitution();
 const target=studentId===undefined?user?.id:studentId;
 const selectedYear=year||institution?.academic_year;
 const query=useQuery({queryKey:['student-placement',target,selectedYear,institution?.id],enabled:!!target&&!!selectedYear&&!!institution,
  queryFn:async()=>{
   const annual=await(supabase as any).from('student_years').select('niveau,classe_id,classes(cycle,nom,niveau,serie)').eq('user_id',target).eq('academic_year',selectedYear).maybeSingle();
   if(annual.error)throw annual.error;
   if(annual.data)return {...annual.data,cycle:studentCycle(annual.data.classes?.niveau||annual.data.niveau,annual.data.classes?.cycle)};
   // Never use today's class to fill a missing historical registration.
   if(selectedYear!==institution!.academic_year)return null;
   let details:{level?:string|null;classe_id?:string|null}|null=profile;
   if(target!==user?.id){
    const person=await supabase.from('profiles').select('level,classe_id').eq('user_id',target!).maybeSingle();
    if(person.error)throw person.error;details=person.data;
   }
   const classe=details?.classe_id?await supabase.from('classes').select('cycle,nom,niveau,serie').eq('id',details.classe_id).maybeSingle():null;
   if(classe?.error)throw classe.error;
   const cycles=institutionCycles(institution);
   return {niveau:details?.level,classe_id:details?.classe_id||null,classes:classe?.data||null,cycle:studentCycle(classe?.data?.niveau||details?.level,classe?.data?.cycle)||(cycles.length===1?cycles[0]:null)};
  },staleTime:15000,refetchOnWindowFocus:true,
 });
 const cycle=query.data?.cycle||null;
 return {placement:query.data,cycle,isSchool:cycle==='college'||cycle==='lycee',isUniversity:cycle==='universite',isPending:isLoading||!!target&&(!institution||!selectedYear||query.isPending),isError:query.isError};
}
