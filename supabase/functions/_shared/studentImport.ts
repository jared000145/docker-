import {INITIAL_PASSWORD,institutionInitials,personInitials} from '../../../shared/accountCredentials.ts';
import {StudentImportError,validateStudentImport} from '../../../shared/studentImportValidation.ts';
export {StudentImportError} from '../../../shared/studentImportValidation.ts';
const digest=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),byte=>byte.toString(16).padStart(2,'0')).join('');
const check=(error:unknown,message='Impossible de vérifier les données de cette ligne.')=>{if(error)throw new StudentImportError(400,message);};
export async function importStudent(db:any,institution:string,value:unknown,importKey:unknown){
 const row=validateStudentImport(value);
 if(typeof importKey!=='string'||!/^[a-f0-9]{64}$/.test(importKey))throw new StudentImportError(400,'Clé de reprise invalide. Rechargez le fichier.');
 const ownerKey=await digest(institution+'|'+importKey),fingerprint=await digest(JSON.stringify(row));
 const inst=await db.from('institutions').select('academic_year,name').eq('id',institution).single();check(inst.error);
 if(row.academic_year!==inst.data?.academic_year)throw new StudentImportError(400,'L’import est réservé à l’année active de l’établissement.');
 const reservation=row.matricule?{data:row.matricule,error:null}:await db.rpc('reserve_registration_number',{_institution:institution,_prefix:institutionInitials(inst.data.name),_initials:personInitials(row.first_name,row.last_name),_key:'import:'+ownerKey});check(reservation.error);const number=reservation.data as string;
 const email=number.toLowerCase().replace(/[^a-z0-9]/g,'')+'@student.campusflow.com';
 if(row.campus_id){const found=await db.from('campuses').select('id').eq('id',row.campus_id).eq('institution_id',institution).eq('is_active',true).maybeSingle();if(found.error||!found.data)throw new StudentImportError(400,'Campus ?tranger ou inactif.');}
 if(row.filiere_id){const found=await db.from('filieres').select('id').eq('id',row.filiere_id).eq('institution_id',institution).maybeSingle();if(found.error||!found.data)throw new StudentImportError(400,'Filière absente de cet établissement.');}
 if(row.classe_id){const found=await db.from('classes').select('id').eq('id',row.classe_id).eq('institution_id',institution).eq('academic_year',row.academic_year).maybeSingle();if(found.error||!found.data)throw new StudentImportError(400,'Classe absente de cette année ou de cet établissement.');}
 const existing=await db.from('profiles').select('user_id,institution_id,email').eq('student_number',number).maybeSingle();check(existing.error);
 let userId:string|undefined;let password:string|undefined;let created=false;
 const resume=async(candidate:any)=>{
  if(!candidate)throw new StudentImportError(409,'Matricule déjà utilisé ou création impossible. Aucun compte existant ne sera remplacé.');
  const auth=await db.auth.admin.getUserById(candidate.user_id);check(auth.error);
  const tag=auth.data.user?.app_metadata?.rectorplus_import;
  if(tag?.key!==ownerKey||tag?.fingerprint!==fingerprint||tag?.institution!==institution)throw new StudentImportError(409,'Ce matricule appartient déjà à un compte. Aucun remplacement automatique.');
  if(candidate.institution_id&&candidate.institution_id!==institution)throw new StudentImportError(403,'Compte non autorisé.');
  const roles=await db.from('user_roles').select('role').eq('user_id',candidate.user_id);check(roles.error);
  if(roles.data?.some((role:{role:string})=>role.role!=='user'))throw new StudentImportError(409,'Ce compte a changé de rôle. Vérification manuelle requise.');
  userId=candidate.user_id;
  return candidate.institution_id===institution&&roles.data?.some((role:{role:string})=>role.role==='user');
 };
 if(existing.data){if(await resume(existing.data))return {created:false,status:'already_imported',user_id:userId,matricule:number};}
 if(!userId){
  if(!row.matricule){let query=db.from('profiles').select('user_id').eq('institution_id',institution).ilike('first_name',row.first_name.replace(/[%_]/g,'')).ilike('last_name',row.last_name.replace(/[%_]/g,''));if(row.date_of_birth)query=query.eq('date_of_birth',row.date_of_birth);const homonym=await query.limit(1);check(homonym.error);if(homonym.data?.length)throw new StudentImportError(409,'Un étudiant homonyme existe. Vérifiez sa fiche ou indiquez un matricule distinct.');}
  password=INITIAL_PASSWORD;
  const result=await db.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{first_name:row.first_name,last_name:row.last_name},app_metadata:{must_change_password:true,rectorplus_import:{key:ownerKey,fingerprint,institution}}});
  if(result.error||!result.data.user){const candidate=await db.from('profiles').select('user_id,institution_id,email').eq('email',email).maybeSingle();check(candidate.error);if(await resume(candidate.data))return {created:false,status:'already_imported',user_id:userId,matricule:number};password=undefined;}
  else {userId=result.data.user.id;created=true;}
 }
 // Tagged partial accounts are resumable. Never delete an account after a
 // transport error: the provisioning transaction may already have committed.
 const provision=await db.rpc('provision_account',{_user_id:userId,_institution_id:institution,_role:'user',_profile:{...row,student_number:number}});
 check(provision.error,'Inscription incomplète. Relancez la même ligne pour la reprendre sans doublon.');
 return {created,status:created?'created':'resumed',user_id:userId,matricule:number,...(created?{password}:{})};
}
