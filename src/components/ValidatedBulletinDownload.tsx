import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {supabase} from '@/integrations/supabase/client';
import {useInstitution} from '@/hooks/useInstitution';
import {Button} from '@/components/ui/button';
import {generateClassBulletinsPdf} from '@/lib/bulletinPdf';
import {toast} from 'sonner';
export default function ValidatedBulletinDownload({studentId,year,period}:{studentId?:string|null;year?:string|null;period?:string}){
 const {institution}=useInstitution();const [busy,setBusy]=useState(false);
 const query=useQuery({queryKey:['validated-bulletin',studentId,year,period],enabled:!!studentId&&!!year,refetchInterval:30000,queryFn:async()=>{const {data,error}=await(supabase as any).rpc('student_validated_bulletin',{_student:studentId,_year:year,_period:period||null});if(error)throw error;return data;}});
 async function download(){if(!query.data||!institution)return;setBusy(true);try{await generateClassBulletinsPdf({institution,academicYear:year,document:query.data,withSignatures:true});}catch(error){toast.error((error as Error).message);}finally{setBusy(false);}}
 return <div className="rounded-xl border bg-card p-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold text-sm">Bulletin officiel</h2><p className="text-xs text-muted-foreground mt-1">{query.isError?'Le statut du bulletin est indisponible.':query.isLoading?'Vérification…':query.data?'Résultats examinés et signés par l’établissement.':'Le téléchargement sera disponible après la validation finale de l’établissement.'}</p></div><Button variant="outline" size="sm" disabled={!query.data||busy} onClick={()=>void download()}>{busy?'Préparation…':'Télécharger le bulletin signé'}</Button></div>;
}
