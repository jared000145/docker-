import {GraduationCap} from 'lucide-react';
import {Link} from 'react-router-dom';
import {useInstitution} from '@/hooks/useInstitution';
import {useSidebar} from '@/components/ui/sidebar';
export default function WorkspaceBrand({label='Gestion scolaire'}:{label?:string}){
 const {institution}=useInstitution();const {state}=useSidebar();const collapsed=state==='collapsed';
 return <Link to="/login" className="workspace-brand flex min-w-0 items-center gap-3" aria-label="RectorPlus — mon espace"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600/15 text-blue-400">{institution?.logo_url?<img src={institution.logo_url} alt="" className="h-10 w-10 rounded-lg object-cover" />:<GraduationCap className="h-9 w-9" />}</span>{!collapsed&&<span className="min-w-0"><strong className="block font-heading text-[23px] font-bold leading-tight tracking-tight text-white">RectorPlus</strong><span className="mt-1 block truncate text-xs font-normal text-slate-300">{institution?.name||label}</span></span>}</Link>;
}
