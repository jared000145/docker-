export class StudentImportError extends Error{constructor(public status:number,message:string){super(message);}}
export function validateStudentImport(value:unknown){
 if(!value||typeof value!=='object'||Array.isArray(value))throw new StudentImportError(400,'Ligne invalide.');
 const row=value as Record<string,unknown>;
 const text=(key:string,max:number,required=false)=>{const value=row[key]===undefined||row[key]===null?'':typeof row[key]==='string'?(row[key] as string).trim():null;if(value===null||value.length>max||(required&&!value))throw new StudentImportError(400,'Champ invalide : '+key);return value;};
 const uuid=(key:string)=>{const value=text(key,36);if(value&&!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value))throw new StudentImportError(400,'Référence invalide : '+key);return value||null;};
 const year=text('academic_year',9,true);const match=year.match(/^(\d{4})-(\d{4})$/);if(!match||Number(match[2])!==Number(match[1])+1)throw new StudentImportError(400,'Année scolaire invalide.');
 const matricule=text('matricule',40).toUpperCase();if(matricule&&!/^[A-Z0-9][A-Z0-9._/-]{1,39}$/.test(matricule))throw new StudentImportError(400,'Matricule invalide (2 à 40 caractères, sans espace).');
 const date=text('date_of_birth',10);if(date&&(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date||date>new Date().toISOString().slice(0,10)))throw new StudentImportError(400,'Date de naissance invalide.');
 const email=text('recovery_email',254).toLowerCase();if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new StudentImportError(400,'Email de contact invalide.');
 if(row.statut_boursier!==undefined&&typeof row.statut_boursier!=='boolean')throw new StudentImportError(400,'Statut boursier invalide.');
 return {...(row.campus_id?{campus_id:uuid('campus_id')}:{}),first_name:text('first_name',100,true),last_name:text('last_name',100,true),level:text('level',40,true),academic_year:year,matricule,date_of_birth:date,recovery_email:email,phone:text('phone',40),filiere_id:uuid('filiere_id'),classe_id:uuid('classe_id'),statut_boursier:row.statut_boursier===true};
}
