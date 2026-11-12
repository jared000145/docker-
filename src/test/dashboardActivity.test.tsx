import {cleanup,render,screen} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {MemoryRouter} from 'react-router-dom';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import DashboardActivity from '@/components/admin/DashboardActivity';
const state=vi.hoisted(()=>({institutionId:'institution-a' as string|null,allowed:true,empty:false,fail:false,from:vi.fn()}));
vi.mock('@/hooks/useAuth',()=>({useAuth:()=>({profile:{institution_id:state.institutionId}})}));
vi.mock('@/hooks/useAcademicYear',()=>({useAcademicYear:()=>({selectedYear:'2026-2027'})}));
vi.mock('@/hooks/usePermissions',()=>({usePermissions:()=>({can:()=>state.allowed,isLoading:false})}));
vi.mock('@/hooks/useRealtimeSubscription',()=>({useRealtimeSubscription:vi.fn()}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{from:state.from}}));
beforeEach(()=>{
 state.institutionId='institution-a';state.allowed=true;state.empty=false;state.fail=false;
 state.from.mockImplementation((table:string)=>{
  const filters:Record<string,unknown>={};let head=false;
  const builder={select:(_value:string,options?:{head?:boolean})=>{head=!!options?.head;return builder;},eq:(key:string,value:unknown)=>{filters[key]=value;return builder;},in:(key:string,value:unknown)=>{filters[key]=value;return builder;},order:()=>builder,limit:()=>builder,
   then:(resolve:(value:unknown)=>unknown,reject:(reason:unknown)=>unknown)=>{
    const rows:Record<string,unknown[]>={attendance:[{id:'a1',user_id:'s1',date:'2026-11-09',subject_id:'m1',justificatif_status:null,status:'justified'}],profiles:[{user_id:'s1',first_name:'Aïcha',last_name:'Diallo',level:'L2',avatar_url:null}],subjects:[{id:'m1',name:'Mathématiques'}],audit_logs:[{id:'log1',action:'create',description:'Inscription enregistrée',created_at:'2026-11-09T10:00:00Z',user_role:'admin',module:'Scolarité'}]};
    return Promise.resolve({data:state.empty?[]:(rows[table]||[]),count:head?(state.empty?0:Array.isArray(filters.status)&&filters.status.length===2?1:3):null,error:state.fail&&table==='attendance'?{message:'Unavailable'}:null}).then(resolve,reject);
   }};
  return builder;
 });
});
afterEach(()=>{cleanup();vi.clearAllMocks();});
function mount(){const client=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}});return render(<QueryClientProvider client={client}><MemoryRouter><DashboardActivity/></MemoryRouter></QueryClientProvider>);}
it('renders actual attendance, identity and audit data',async()=>{
 mount();
 expect(await screen.findByRole('img',{name:'66.7 % de présence'})).toBeInTheDocument();
 expect(await screen.findByText('Aïcha Diallo')).toBeInTheDocument();
 expect(screen.getByText('Approuvé')).toBeInTheDocument();
 expect(screen.getByText('Inscription enregistrée')).toBeInTheDocument();
 expect(screen.getByRole('link',{name:/Tout voir/})).toHaveAttribute('href','/admin/attendance');
});
it('does not invent a percentage for an empty institution',async()=>{
 state.empty=true;mount();
 expect(await screen.findByRole('img',{name:'Aucun pointage'})).toBeInTheDocument();
 expect(screen.queryByText('100 %')).not.toBeInTheDocument();
});
it('shows a failure instead of fabricated attendance statistics',async()=>{
 state.fail=true;mount();
 expect((await screen.findAllByRole('alert')).length).toBeGreaterThan(0);
 expect(screen.queryByRole('img',{name:/de présence/})).not.toBeInTheDocument();
});
it('does not request restricted modules',()=>{
 state.allowed=false;mount();expect(state.from).not.toHaveBeenCalled();
});
it('does not query another institution when the profile has no institution',()=>{
 state.institutionId=null;mount();expect(state.from).not.toHaveBeenCalled();
});
