import {saveWorkbook} from "@/lib/nativeExports";
﻿import * as XLSX from 'xlsx';
export const DATA_MODULES = [
 {table:'campuses',label:'Campus'}, {table:'filieres',label:'Filières'}, {table:'classes',label:'Classes'},
 {table:'subjects',label:'Matières'}, {table:'profiles',label:'Profils existants'}, {table:'student_years',label:'Inscriptions annuelles'},
 {table:'schedule_events',label:'Planning'}, {table:'grades',label:'Notes semestrielles'}, {table:'grades_trimestre',label:'Notes trimestrielles'},
 {table:'payments',label:'Paiements'}, {table:'attendance',label:'Présences'},
];
export const IMPORT_SHEETS = [
 {table:'filieres',sheet:'Filieres',columns:['nom','description']},
 {table:'subjects',sheet:'Matieres',columns:['code','nom','filiere','niveau','semestre','credits','coefficient']},
 {table:'grades',sheet:'Notes',columns:['matricule','code_matiere','semestre','note_cc','note_examen']},
 {table:'payments',sheet:'Paiements',columns:['reference','matricule','description','montant','montant_paye','date']},
 {table:'attendance',sheet:'Presences',columns:['matricule','code_matiere','date','statut','duree_heures']},
];
export function downloadInstitutionTemplate(){
 const book=XLSX.utils.book_new();
 XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([
 ['Modèle RectorPlus — données d’un établissement'],
 ['1. Créer les comptes étudiants avec le modèle Étudiants, puis conserver leurs matricules.'],
 ['2. Remplir les feuilles utiles ; laisser les autres vides. Ne pas renommer les en-têtes.'],
 ['3. Utiliser des codes matières et références de paiement uniques. Dates : AAAA-MM-JJ.'],
 ['4. L’année et l’établissement sont choisis dans RectorPlus, jamais déduits du fichier.'],
 ['5. Notes sur 20. Semestre S1/S2. Présences : present, absent, late, excused.'],
 ['6. Aperçu obligatoire. Par défaut, les lignes existantes sont conservées.'],
 ['Ce modèle importe les filières, matières, notes, paiements et présences. Les autres modules sont restaurables depuis les versions internes.'],
 ]),'Instructions');
 for(const sheet of IMPORT_SHEETS){const ws=XLSX.utils.aoa_to_sheet([sheet.columns]);ws['!cols']=sheet.columns.map(()=>({wch:23}));XLSX.utils.book_append_sheet(book,ws,sheet.sheet);}
 saveWorkbook(book,'RectorPlus-modele-etablissement.xlsx');
}
export type DataRow=Record<string,any>;
export type InstitutionReferences={filieres:DataRow[];subjects:DataRow[];profiles:DataRow[];grades:DataRow[];payments:DataRow[];attendance:DataRow[];student_years?:DataRow[]};
const norm=(value:unknown)=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
const number=(v:unknown,label:string)=>{if(String(v??'').trim()==='')throw Error(`${label} requis`);const n=Number(String(v).replace(',','.'));if(!Number.isFinite(n))throw Error(`${label} invalide`);return n;};
const unique=(rows:DataRow[],test:(r:DataRow)=>boolean,label:string,required=true)=>{const matches=rows.filter(test);if(matches.length>1)throw Error(`${label} ambigu : corriger les doublons`);if(!matches.length&&required)throw Error(`${label} introuvable`);return matches[0];};
async function stableId(value:string){const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));bytes[6]=(bytes[6]&15)|80;bytes[8]=(bytes[8]&63)|128;const hex=Array.from(bytes.slice(0,16),x=>x.toString(16).padStart(2,'0')).join('');return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;}
export async function parseInstitutionWorkbook(buffer:ArrayBuffer,institutionId:string,year:string,refs:InstitutionReferences){
 if(buffer.byteLength>5*1024*1024)throw Error('5 Mo maximum.');
 const wb=XLSX.read(buffer,{type:'array',cellFormula:true});const payload:Record<string,DataRow[]>={},errors:string[]=[];let count=0;
 for(const sheet of IMPORT_SHEETS){const ws=wb.Sheets[sheet.sheet];if(!ws)continue;
  for(const [cell,value]of Object.entries(ws)){if(!cell.startsWith('!')&&(value as XLSX.CellObject).f)errors.push(`${sheet.sheet} ${cell} : les formules doivent être remplacées par leurs valeurs.`);}
  const rows=XLSX.utils.sheet_to_json<DataRow>(ws,{defval:'',raw:false});if(!rows.length)continue;
  if(sheet.columns.some(key=>!Object.prototype.hasOwnProperty.call(rows[0],key)))errors.push(`${sheet.sheet} : colonnes attendues ${sheet.columns.join(', ')}.`);
  payload[sheet.table]=[];const seen=new Set<string>();
  for(let i=0;i<rows.length;i++){
   if(++count>2000)throw Error('2 000 lignes maximum par fichier.');const row=rows[i];
   try{
    let data:DataRow={institution_id:institutionId},existing:DataRow|undefined,key='';
    const text=(k:string,max=250)=>{const v=String(row[k]??'').trim();if(!v||v.length>max)throw Error(`${k} requis (${max} caractères maximum)`);return v;};
    const date=()=>{const d=text('date',10);if(!/^\d{4}-\d{2}-\d{2}$/.test(d)||!Number.isFinite(Date.parse(d))||new Date(d).toISOString().slice(0,10)!==d)throw Error('Date invalide, format AAAA-MM-JJ');return d;};
    const student=()=>unique(refs.profiles,r=>norm(r.student_number)===norm(text('matricule')),'Matricule');
    const recordCampus=(p:DataRow)=>{const y=unique(refs.student_years||[],r=>r.user_id===p.user_id&&r.academic_year===year,'Inscription annuelle',false);if(refs.student_years&&!y&&p.academic_year&&p.academic_year!==year)throw Error('Inscription annuelle absente pour cette année');return y?y.campus_id||null:p.campus_id||null;};
    const subject=()=>unique([...(payload.subjects||[]),...refs.subjects].filter((r,i,a)=>a.findIndex(x=>x.id===r.id)===i),r=>norm(r.code)===norm(text('code_matiere'))&&(!r.academic_year||r.academic_year===year),'Code matière');
    if(sheet.table==='filieres'){
     data={...data,name:text('nom'),description:String(row.description||'').slice(0,2000)||null};key=norm(data.name);existing=unique(refs.filieres,r=>norm(r.name)===key,'Filière',false);
    }else if(sheet.table==='subjects'){
     const code=text('code',40);const all=[...refs.filieres,...(payload.filieres||[])];const f=unique(all.filter((r,i,a)=>a.findIndex(x=>x.id===r.id)===i),r=>norm(r.name)===norm(text('filiere')),'Filière');
     const credits=number(row.credits,'Crédits'),coefficient=number(row.coefficient,'Coefficient');if(credits<0||credits>120||coefficient<=0||coefficient>100)throw Error('Crédits ou coefficient hors limites');
     const semester=text('semestre');if(!['S1','S2'].includes(semester))throw Error('Semestre S1 ou S2 requis');
     data={...data,code,name:text('nom'),filiere_id:f.id,level:text('niveau',30),semester,credits,coefficient,academic_year:year};key=norm(code);existing=unique(refs.subjects,r=>norm(r.code)===key&&r.academic_year===year,'Code matière',false);
    }else if(sheet.table==='grades'){
     const p=student(),s=subject(),semester=text('semestre');if(!['S1','S2'].includes(semester)||s.semester!==semester)throw Error('Semestre incompatible avec la matière');
     const cc=number(row.note_cc,'Note CC'),exam=number(row.note_examen,'Note examen');if(cc<0||cc>20||exam<0||exam>20)throw Error('Notes entre 0 et 20');
     data={...data,user_id:p.user_id,subject_id:s.id,semester,academic_year:year,cc_grade:cc,exam_grade:exam,average:Math.round((cc*.4+exam*.6)*100)/100,campus_id:recordCampus(p)};key=`${p.user_id}|${s.id}|${semester}`;
     existing=unique(refs.grades,r=>r.user_id===p.user_id&&r.subject_id===s.id&&r.semester===semester&&r.academic_year===year,'Note',false);if(existing?.is_locked)throw Error('Note verrouillée : rouvrir la période avant import');
    }else if(sheet.table==='payments'){
     const p=student(),reference=text('reference',100),amount=number(row.montant,'Montant'),paid=number(row.montant_paye,'Montant payé');if(amount<0||paid<0||paid>amount)throw Error('Montants incohérents');
     data={...data,user_id:p.user_id,receipt_number:reference,description:text('description',500),amount,paid_amount:paid,payment_date:date(),status:paid>=amount?'paid':paid>0?'partial':'pending',academic_year:year,campus_id:recordCampus(p)};key=norm(reference);existing=unique(refs.payments,r=>norm(r.receipt_number)===key,'Référence de paiement',false);
     if(existing&&existing.user_id!==p.user_id)throw Error('Référence déjà attribuée à un autre étudiant');
    }else{
     const p=student(),s=subject(),d=date(),status=text('statut'),duration=number(row.duree_heures,'Durée');if(!['present','absent','late','excused'].includes(status)||duration<=0||duration>24)throw Error('Statut ou durée invalide');
     data={...data,user_id:p.user_id,subject_id:s.id,date:d,status,duration_hours:duration,academic_year:year,campus_id:recordCampus(p)};key=`${p.user_id}|${s.id}|${d}`;existing=unique(refs.attendance,r=>r.user_id===p.user_id&&r.subject_id===s.id&&r.date===d,'Présence',false);
    }
    if(seen.has(key))throw Error('Ligne en doublon dans cette feuille');seen.add(key);
    data.id=existing?.id||await stableId(`${institutionId}|${year}|${sheet.table}|${key}`);payload[sheet.table].push(data);
   }catch(error){errors.push(`${sheet.sheet}, ligne ${i+2} : ${(error as Error).message}`);}
  }
 }
 if(!count)throw Error('Aucune ligne reconnue. Utilisez le modèle RectorPlus.');
 return {payload,errors,count};
}
