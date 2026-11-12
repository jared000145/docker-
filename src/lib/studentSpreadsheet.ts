import {saveWorkbook} from "@/lib/nativeExports";
import * as XLSX from 'xlsx';
import {validateStudentImport} from '../../shared/studentImportValidation';
export type StudentImportRow=ReturnType<typeof validateStudentImport>;
export type StudentSheetEntry={line:number;key:string;label:string;data?:StudentImportRow;errors:string[];state?:'created'|'already_imported'|'resumed'|'failed';message?:string;matricule?:string;password?:string};
export type StudentSheetContext={year:string;levels:string[];campusId?:string|null;filieres:{id:string;name:string}[];classes:{id:string;nom:string;niveau?:string;academic_year?:string}[]};
const normalize=(value:unknown)=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const normalizeLevel=(value:unknown)=>normalize(value).replace(/^([3-6])eme$/,'$1e');
const aliases:Record<string,string[]>={first_name:['prenom','first_name'],last_name:['nom','nom de famille','last_name'],matricule:['matricule','student_number'],level:['niveau','classe niveau','level'],academic_year:['annee scolaire','annee_scolaire','academic_year','annee'],filiere:['filiere','programme'],classe:['classe','nom classe'],date_of_birth:['date naissance','date de naissance','date_naissance','date_of_birth'],recovery_email:['email','courriel','recovery_email'],phone:['telephone','phone','contact'],statut_boursier:['statut','boursier','statut_boursier']};
const hash=async(value:ArrayBuffer|string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',typeof value==='string'?new TextEncoder().encode(value):value)),byte=>byte.toString(16).padStart(2,'0')).join('');
function birthDate(value:unknown){
 if(typeof value==='number'){const date=XLSX.SSF.parse_date_code(value);return date?`${date.y}-${String(date.m).padStart(2,'0')}-${String(date.d).padStart(2,'0')}`:String(value);}
 const text=String(value??'').trim();const match=text.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/);return match?`${match[3]}-${match[2].padStart(2,'0')}-${match[1].padStart(2,'0')}`:text;
}
export async function parseStudentWorkbook(buffer:ArrayBuffer,context:StudentSheetContext){
 if(buffer.byteLength>5*1024*1024)throw Error('Fichier trop volumineux : 5 Mo maximum.');
 const book=XLSX.read(buffer,{type:'array',sheetRows:502,cellDates:false,cellFormula:true});
 const sheetName=book.SheetNames[0],sheet=book.Sheets[sheetName];if(!sheet)throw Error('Le classeur ne contient aucune feuille.');
 const range=XLSX.utils.decode_range(sheet['!fullref']||sheet['!ref']||'A1');if(range.e.r>500)throw Error('500 lignes maximum par fichier. Découpez le fichier en plusieurs lots.');
 const values=XLSX.utils.sheet_to_json<unknown[]>(sheet,{header:1,defval:'',raw:true,blankrows:true});
 const headers=(values[0]||[]).map(normalize);
 const columns=Object.fromEntries(Object.entries(aliases).map(([key,names])=>[key,headers.findIndex(header=>names.some(name=>normalize(name)===header))]));
 if(columns.first_name<0||columns.last_name<0)throw Error('La première ligne doit contenir les colonnes Nom et Prénom. Téléchargez le modèle.');
 const fileHash=await hash(buffer);const result:StudentSheetEntry[]=[];
 for(let index=1;index<values.length;index++){
  const cells=values[index]||[];if(cells.every(value=>String(value??'').trim()===''))continue;
  const get=(key:string)=>columns[key]>=0?cells[columns[key]]??'':'';
  const errors:string[]=[];
  for(const [key,column] of Object.entries(columns)){if(column>=0&&sheet[XLSX.utils.encode_cell({r:index,c:column})]?.f)errors.push(`Formule non admise (${key}) : collez la valeur.`);}
  if(headers.some((header,column)=>['notes','paiements','rattrapages'].includes(header)&&String(cells[column]??'').trim()))errors.push('Ce modèle inscrit les étudiants ; il ne reprend pas les notes ni les paiements historiques.');
  const levelText=String(get('level')).trim();const level=context.levels.find(level=>normalizeLevel(level)===normalizeLevel(levelText))||levelText;
  if(!context.levels.includes(level))errors.push('Niveau inconnu dans cet établissement.');
  const filiereName=String(get('filiere')).trim();const matchingFilieres=context.filieres.filter(item=>normalize(item.name)===normalize(filiereName));
  if(filiereName&&matchingFilieres.length!==1)errors.push('Filière inconnue ou ambiguë : créez-la avant l’import.');
  const classeName=String(get('classe')).trim();const matchingClasses=context.classes.filter(item=>normalize(item.nom)===normalize(classeName)&&(!item.niveau||normalizeLevel(item.niveau)===normalizeLevel(level))&&(!item.academic_year||item.academic_year===context.year));
  if(classeName&&matchingClasses.length!==1)errors.push('Classe inconnue ou ambiguë pour cette année et ce niveau.');
  const status=normalize(get('statut_boursier'));const validStatuses=['','non','false','0','nonboursier','oui','true','1','boursier'];if(!validStatuses.includes(status))errors.push('Statut boursier : oui/non ou boursier/non-boursier.');
  const numberCell=columns.matricule>=0?sheet[XLSX.utils.encode_cell({r:index,c:columns.matricule})]:undefined;
  const matricule=typeof get('matricule')==='number'&&numberCell?.w&&/^\d+$/.test(numberCell.w)?numberCell.w:String(get('matricule')).trim();
  let data:StudentImportRow|undefined;
  try{data=validateStudentImport({...(context.campusId?{campus_id:context.campusId}:{}),first_name:String(get('first_name')).trim(),last_name:String(get('last_name')).trim(),matricule,level,academic_year:String(get('academic_year')).trim()||context.year,filiere_id:matchingFilieres[0]?.id||null,classe_id:matchingClasses[0]?.id||null,date_of_birth:birthDate(get('date_of_birth')),recovery_email:String(get('recovery_email')).trim(),phone:String(get('phone')).trim(),statut_boursier:['oui','true','1','boursier'].includes(status)});if(data.academic_year!==context.year)errors.push('L’année doit correspondre à l’année active.');}catch(error){errors.push(error instanceof Error?error.message:'Ligne invalide.');}
  result.push({line:index+1,key:await hash(fileHash+'|'+sheetName+'|'+index),label:`${get('first_name')} ${get('last_name')}`.trim(),data,errors});
 }
 const seen=new Map<string,StudentSheetEntry>();
 for(const entry of result){if(!entry.data)continue;const identity=entry.data.matricule?'mat:'+entry.data.matricule:JSON.stringify(entry.data);const previous=seen.get(identity);if(previous){entry.errors.push(`Doublon avec la ligne ${previous.line}.`);previous.errors.push(`Doublon avec la ligne ${entry.line}.`);}else seen.set(identity,entry);}
 if(!result.length)throw Error('Le fichier ne contient aucun étudiant.');return result;
}
export function downloadStudentTemplate(year:string,level:string,filiere=''){
 const headers=['nom','prenom','matricule','niveau','annee_scolaire','filiere','classe','date_naissance','email','telephone','statut'];
 const sheet=XLSX.utils.aoa_to_sheet([headers]);sheet['!cols']=headers.map((_,i)=>({wch:i===4?20:24}));sheet['!autofilter']={ref:'A1:K501'};
 const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,sheet,'Etudiants');
 const instructions=[['MODE D’EMPLOI — IMPORT DES ÉLÈVES ET ÉTUDIANTS',''],['Année cible',year],['Campus','Sélectionner le campus dans RectorPlus avant d’importer. Un fichier par campus.'],['À remplir','Ouvrir Etudiants et saisir une personne par ligne, à partir de la ligne 2. Conserver les en-têtes.'],['Exemple','La feuille Exemple montre une ligne fictive. Elle ne sera pas importée.'],['Contrôle','RectorPlus affiche un aperçu et les erreurs avant de créer les comptes.'],['nom / prenom','Obligatoires. Nom de famille et prénom dans deux colonnes séparées.'],['matricule','Recommandé. Conserver le même matricule lors des prochains imports. Vide : initiales établissement + initiales élève + année d’inscription + numéro unique.'],['niveau',`Obligatoire. Utiliser un niveau existant, par exemple ${level}.`],['annee_scolaire',`Utiliser ${year} ; vide = année cible.`],['filiere','Nom exact d’une filière déjà créée dans cet établissement.'],['classe','Nom exact d’une classe de cette année et de ce campus, par exemple Terminale D1.'],['date_naissance','Format AAAA-MM-JJ ou JJ/MM/AAAA.'],['email / telephone','Facultatifs. Email de récupération et téléphone.'],['statut','boursier ou non-boursier ; vide = non-boursier.'],['Années et redoublements','Pour un élève existant, utiliser son dossier puis Préparer l’inscription. Ne pas créer un nouveau compte chaque année.'],['Notes, reçus et anciens paiements','Utiliser l’import sélectif de données et son modèle dédié. Ne pas ajouter ces colonnes dans ce fichier.'],['Limites','500 personnes et 5 Mo par fichier. Coller les valeurs, pas de formules.']];
 const guide=XLSX.utils.aoa_to_sheet(instructions);guide['!cols']=[{wch:32},{wch:105}];guide['!rows']=instructions.map(()=>({hpt:32}));XLSX.utils.book_append_sheet(book,guide,'Instructions');
 const example=XLSX.utils.aoa_to_sheet([headers,['Diallo','Aïcha','',level,year,filiere,'','2004-06-15','','','non-boursier']]);example['!cols']=sheet['!cols'];XLSX.utils.book_append_sheet(book,example,'Exemple');saveWorkbook(book,'modele_etudiants_rectorplus.xlsx');
}
export function downloadImportCredentials(entries:StudentSheetEntry[]){
 const rows=entries.filter(entry=>entry.password).map(entry=>({nom:entry.data?.last_name,prenom:entry.data?.first_name,matricule:entry.matricule,mot_de_passe_initial:entry.password}));
 if(!rows.length)return;const sheet=XLSX.utils.json_to_sheet(rows);sheet['!cols']=[{wch:24},{wch:24},{wch:30},{wch:42}];const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,sheet,'Identifiants');saveWorkbook(book,'identifiants_etudiants_rectorplus.xlsx');
}
