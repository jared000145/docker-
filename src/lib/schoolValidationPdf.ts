import {issueAcademicVerification} from './documentVerification';
﻿import jsPDF from "@/lib/pdfClient";
import {generateReleveTrimestrePdf} from '@/lib/releveTrimestrePdf';
import {getDocumentSignatures} from '@/lib/directorSignature';
import {applyBrandFooterAllPages} from '@/lib/pdfBranding';
export async function generateSchoolValidationPdf({institution,document,withSignatures=false,mode='save'}:{institution:any;document:any;withSignatures?:boolean;mode?:string}){
 const payload=document.payload;if(payload?.kind!=='class_bulletins_trimestre'||!payload.results?.length)throw Error('Dossier de bulletins vide ou incompatible.');
 const signatures=withSignatures?await getDocumentSignatures(document):null;const doc=new jsPDF();
 for(let index=0;index<payload.results.length;index++){
  const result=payload.results[index];if(index)doc.addPage();
  const verificationLink=withSignatures?await issueAcademicVerification(document.id,result.user_id):undefined;
  await generateReleveTrimestrePdf({institution,student:result,classe:{...payload.classe,cycle:['6e','5e','4e','3e'].includes(payload.classe.niveau)?'college':'lycee',effectif:payload.results.length},trimestre:payload.trimestre,academic_year:payload.academicYear,lignes:result.grade_lines,class_all_grades:payload.class_all_grades||[],director:signatures?.directeur?{name:signatures.directeur.name,signature_url:signatures.directeur.signature,stamp_url:signatures.directeur.stamp,date_conseil:document.validated_at}:undefined,verification_url:verificationLink,qr_token:'APERCU'},{doc,skipFooter:true});
 }
 applyBrandFooterAllPages(doc);if(mode==='blob')return URL.createObjectURL(doc.output('blob'));if(mode==='raw')return doc.output('blob');doc.save(`bulletins-${payload.classe.nom}-${payload.trimestre}-${payload.academicYear}${withSignatures?'':'-apercu'}.pdf`);
}
