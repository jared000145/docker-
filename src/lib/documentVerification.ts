import {supabase} from '@/integrations/supabase/client';
// Scans must open the deployed website, including when the PDF is exported by Android.
export const PUBLIC_SITE='https://rectorplus.vercel.app';
export const verificationUrl=(token:string,kind:'releve'|'card'='releve')=>`${PUBLIC_SITE}/verify/${kind}/${encodeURIComponent(token)}`;
export async function issueAcademicVerification(documentId:string,studentId:string){
 const {data,error}=await(supabase as any).rpc('issue_academic_verification',{_document:documentId,_student:studentId});
 if(error||!data)throw error||Error('Le lien de vérification ne peut pas être créé.');return verificationUrl(data);
}

export async function issuedAcademicSummary(documentId:string,studentId:string){
 const url=await issueAcademicVerification(documentId,studentId),token=decodeURIComponent(url.split('/').pop()!);
 const {data,error}=await(supabase as any).rpc('verify_academic_document',{_token:token});if(error||data?.status!=='verified')throw error||Error('La version du relevé n’est plus valide.');return{url,results:data.results};
}
