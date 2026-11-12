import {beforeEach,describe,expect,it,vi} from 'vitest';
import {renderHook,waitFor} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {useStudentPlacement} from '@/hooks/useStudentPlacement';

const fixture=vi.hoisted(()=>({annual:null as any,classes:null as any,level:'L1',classId:null as string|null,calls:[] as string[]}));
vi.mock('@/hooks/useAuth',()=>({useAuth:()=>({user:{id:'student'},profile:{level:fixture.level,classe_id:fixture.classId}})}));
vi.mock('@/hooks/useInstitution',()=>({useInstitution:()=>({institution:{id:'mixed',academic_year:'2026-2027',enabled_cycles:['college','lycee','universite']},isLoading:false})}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{from:(table:string)=>{
 fixture.calls.push(table);const query:any={select:()=>query,eq:()=>query,maybeSingle:async()=>({data:table==='student_years'?fixture.annual:fixture.classes,error:null})};return query;
}}}));
const wrapper=({children}:{children:React.ReactNode})=><QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}>{children}</QueryClientProvider>;
beforeEach(()=>{fixture.annual=null;fixture.classes=null;fixture.level='L1';fixture.classId=null;fixture.calls=[];});
describe('individual academic placement',()=>{
 it('keeps a lycée pupil in school views even if the institution also has university courses',async()=>{
  fixture.annual={niveau:'Terminale',classe_id:'terminal',classes:{cycle:'lycee',niveau:'Terminale'}};
  const {result}=renderHook(()=>useStudentPlacement(undefined,'2026-2027'),{wrapper});
  await waitFor(()=>expect(result.current.isSchool).toBe(true));expect(result.current.isUniversity).toBe(false);
 });
 it('uses an old college registration instead of the current university profile',async()=>{
  fixture.annual={niveau:'3e',classe_id:'old',classes:{cycle:'college',niveau:'3e'}};
  const {result}=renderHook(()=>useStudentPlacement(undefined,'2024-2025'),{wrapper});
  await waitFor(()=>expect(result.current.cycle).toBe('college'));expect(result.current.placement.classe_id).toBe('old');
 });
 it('does not substitute the current profile for a missing historical year',async()=>{
  fixture.classId='today';fixture.classes={cycle:'lycee',niveau:'Terminale'};
  const {result}=renderHook(()=>useStudentPlacement(undefined,'2024-2025'),{wrapper});
  await waitFor(()=>expect(result.current.isPending).toBe(false));expect(result.current.cycle).toBeNull();expect(fixture.calls).not.toContain('classes');
 });
 it('falls back to the current class when the current registration has not been created',async()=>{
  fixture.classId='today';fixture.classes={cycle:'college',niveau:'3e'};
  const {result}=renderHook(()=>useStudentPlacement(undefined,'2026-2027'),{wrapper});
  await waitFor(()=>expect(result.current.cycle).toBe('college'));expect(result.current.placement.classe_id).toBe('today');
 });
 it('retains the university view for a university registration',async()=>{
  fixture.annual={niveau:'M1',classe_id:null,classes:null};
  const {result}=renderHook(()=>useStudentPlacement(undefined,'2026-2027'),{wrapper});
  await waitFor(()=>expect(result.current.isUniversity).toBe(true));expect(result.current.isSchool).toBe(false);
 });
});
