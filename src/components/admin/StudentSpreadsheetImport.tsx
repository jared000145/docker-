import {useCampus} from "@/hooks/useCampus";
import {useRef,useState,useEffect} from 'react';
import {useQuery} from '@tanstack/react-query';
import {Upload,Download,FileSpreadsheet,Loader2,CheckCircle2,AlertCircle} from 'lucide-react';
import {supabase} from '@/integrations/supabase/client';
import {useInstitution} from '@/hooks/useInstitution';
import {useAcademicYear} from '@/hooks/useAcademicYear';
import {usePermissions} from '@/hooks/usePermissions';
import {useAuth} from '@/hooks/useAuth';
import {Button} from '@/components/ui/button';
import {Progress} from '@/components/ui/progress';
import {parseStudentWorkbook,downloadStudentTemplate,downloadImportCredentials,type StudentSheetEntry} from '@/lib/studentSpreadsheet';
export default function StudentSpreadsheetImport({institutionId,onImportComplete,target}:{institutionId:string;onImportComplete:()=>void;target?:{academic_year:string;levels:string[]}}){
 const {campusId:contextCampusId}=useCampus();const [importCampus,setImportCampus]=useState('');const campusId=contextCampusId||importCampus||null;
 const importCampuses=useQuery({queryKey:['student-import-campuses',institutionId],enabled:!!institutionId,queryFn:async()=>{const{data,error}=await supabase.from('campuses').select('id,name').eq('institution_id',institutionId).eq('is_active',true).order('name');if(error)throw error;return data||[];}});
 useEffect(()=>setImportCampus(''),[institutionId]);
 const {getLevels,institution}=useInstitution();const academicContext=useAcademicYear();const selectedYear=target?.academic_year||academicContext.selectedYear;const isViewingHistory=target?false:academicContext.isViewingHistory;const {isPrincipal,isLoading:permissionsLoading}=usePermissions();
 const [entries,setEntries]=useState<StudentSheetEntry[]>([]),[busy,setBusy]=useState(false),[reading,setReading]=useState(false),[error,setError]=useState(''),[fileName,setFileName]=useState('');
 const input=useRef<HTMLInputElement>(null),stop=useRef(false),lock=useRef(false);
 const {user}=useAuth();const identity=institutionId+'|'+user?.id+'|'+selectedYear+'|'+campusId;const active=useRef(identity);active.current=identity;
 useEffect(()=>{active.current=identity;stop.current=true;setEntries([]);setFileName('');setError('');return()=>{active.current='';stop.current=true;};},[identity]);
 const references=useQuery({queryKey:['student-import-references',institutionId,selectedYear,campusId],enabled:!!institutionId,queryFn:async()=>{
  const [filieres,classes]=await Promise.all([supabase.from('filieres').select('id,name,campus_id').eq('institution_id',institutionId).order('name'),supabase.from('classes').select('id,nom,niveau,academic_year,campus_id').eq('institution_id',institutionId).eq('academic_year',selectedYear)]);
  if(filieres.error)throw filieres.error;if(classes.error)throw classes.error;return {filieres:(filieres.data||[]).filter(row=>!campusId||!row.campus_id||row.campus_id===campusId),classes:(classes.data||[]).filter(row=>!campusId||!row.campus_id||row.campus_id===campusId)};
 }});
 const done=entries.filter(entry=>entry.state&&entry.state!=='failed').length;
 const valid=entries.filter(entry=>entry.data&&!entry.errors.length);
 async function read(file?:File){
  if(!file||busy)return;setEntries([]);setError('');setFileName(file.name);setReading(true);
  if(importCampuses.isError||importCampuses.isLoading||!!importCampuses.data?.length&&!campusId){setError('Choisissez le campus de ce fichier avant de le charger.');setReading(false);return;}
  try{if(!/\.(xlsx|xls|csv)$/i.test(file.name))throw Error('Sélectionnez un fichier XLSX, XLS ou CSV.');if(file.size>5*1024*1024)throw Error('5 Mo maximum par fichier.');if(!references.data)throw Error('Les filières et classes doivent être chargées avant le fichier.');setEntries(await parseStudentWorkbook(await file.arrayBuffer(),{year:selectedYear,campusId,levels:target?.levels||getLevels(),...references.data}));}
  catch(caught){setError(caught instanceof Error?caught.message:'Lecture impossible.');}finally{setReading(false);if(input.current)input.current.value='';}
 }
 async function run(){
  if(lock.current||!isPrincipal||isViewingHistory)return;lock.current=true;stop.current=false;setBusy(true);setError('');let changes=0;const operationIdentity=active.current;
  try{for(const entry of valid){if(stop.current||operationIdentity!==active.current)break;if(entry.state&&entry.state!=='failed')continue;
   let patch:Partial<StudentSheetEntry>;
   try{const {data,error}=await supabase.functions.invoke('import-student',{body:{institution_id:institutionId,import_key:entry.key,row:entry.data}});
    if(error){let message='La ligne n’a pas pu être importée.';if('context' in error){try{message=(await (error.context as Response).json()).error||message;}catch{/* Preserve a readable fallback. */}}throw Error(message);}
    if(data?.error||!['created','already_imported','resumed'].includes(data?.status)||!data?.matricule)throw Error(data?.error||'Réponse serveur non reconnue.');
    patch={state:data.status,matricule:data.matricule,password:data.password,message:data.status==='already_imported'?'Déjà importé, conservé':data.status==='resumed'?'Compte repris ; régénérez son mot de passe depuis sa fiche si nécessaire.':'Compte créé'};changes++;
   }catch(caught){patch={state:'failed',message:caught instanceof Error?caught.message:'Erreur de connexion.'};}
   if(operationIdentity!==active.current)break;
   setEntries(current=>current.map(item=>item.key===entry.key?{...item,...patch}:item));
  }}finally{lock.current=false;setBusy(false);if(changes)onImportComplete();}
 }
 return <section className="student-import-panel space-y-5" aria-label="Import Excel des étudiants">
  <div className="flex items-start gap-3"><span className="account-icon"><FileSpreadsheet/></span><div><h2 className="text-lg font-bold">Inscrire les étudiants depuis Excel</h2><p className="text-sm text-muted-foreground mt-1">Prévisualisez les lignes, corrigez les erreurs, puis créez les comptes automatiquement.</p></div></div>
  <div className="student-import-notice"><p><strong>Année active : {target?.academic_year||institution?.academic_year||selectedYear}.</strong> 500 étudiants et 5 Mo maximum par lot. Les filières et classes indiquées doivent déjà exister.</p><p className="mt-2">Le matricule est recommandé. S’il est vide, il est généré automatiquement. Réutilisez le même fichier pour reprendre un import interrompu ; conservez les matricules pour les futurs fichiers.</p></div>
  {(isViewingHistory||(!permissionsLoading&&!isPrincipal))&&<p role="alert" className="text-sm text-destructive">{isViewingHistory?'L’import est désactivé pour les années archivées.':'Seul l’administrateur principal peut créer ces comptes.'}</p>}
  {references.isError&&<p role="alert" className="text-sm text-destructive">Les filières et classes n’ont pas pu être chargées. <button type="button" className="underline" onClick={()=>void references.refetch()}>Réessayer</button></p>}
  <div className="flex flex-wrap gap-3"><Button type="button" variant="outline" disabled={busy||!references.data} onClick={()=>downloadStudentTemplate(selectedYear,getLevels()[0]||'L1',references.data?.filieres[0]?.name||'')}><Download className="mr-2 h-4 w-4"/>Télécharger le modèle</Button><Button type="button" variant="outline" disabled={busy||reading||!references.data||!isPrincipal||isViewingHistory} onClick={()=>input.current?.click()}>{reading?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:<Upload className="mr-2 h-4 w-4"/>}Choisir le fichier</Button><input ref={input} type="file" aria-label="Fichier des étudiants" accept=".xlsx,.xls,.csv" className="sr-only" disabled={busy||reading} onChange={event=>void read(event.target.files?.[0])}/></div>
  {!!importCampuses.data?.length&&<label className="block text-sm font-medium">Campus de ce fichier<select aria-label="Campus de ce fichier" className="mt-2 block w-full rounded-lg border bg-white p-2" value={campusId||''} disabled={!!contextCampusId||busy} onChange={e=>setImportCampus(e.target.value)}><option value="">Choisir un campus avant de charger le fichier</option>{importCampuses.data.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}
  {error&&<p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
  {!!entries.length&&<><div className="flex flex-wrap items-center justify-between gap-3 text-sm"><span className="font-semibold break-all">{fileName}</span><span>{entries.length} ligne(s) · {valid.length} valide(s) · {entries.length-valid.length} à corriger</span></div><div className="student-import-preview"><table><thead><tr><th>Ligne</th><th>Étudiant</th><th>Niveau</th><th>Matricule</th><th>État</th></tr></thead><tbody>{entries.map(entry=><tr key={entry.key}><td>{entry.line}</td><td>{entry.label}</td><td>{entry.data?.level||'—'}</td><td>{entry.matricule||entry.data?.matricule||'Automatique'}</td><td className={entry.errors.length||entry.state==='failed'?'text-red-700':'text-emerald-700'}>{entry.errors.join(' ')||entry.message||'Prêt à importer'}</td></tr>)}</tbody></table></div><Progress value={valid.length?done/valid.length*100:0}/><div className="flex flex-wrap items-center gap-3"><Button type="button" disabled={busy||!valid.length||done===valid.length||!isPrincipal||isViewingHistory} onClick={()=>void run()}>{busy?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:<CheckCircle2 className="mr-2 h-4 w-4"/>}{busy?'Import en cours…':done?'Reprendre les lignes restantes':`Importer ${valid.length} étudiant(s)`}</Button>{busy&&<Button type="button" variant="outline" onClick={()=>{stop.current=true;}}>Arrêter après cette ligne</Button>}<span className="text-xs text-muted-foreground">{done} compte(s) traité(s), {entries.filter(entry=>entry.state==='failed').length} erreur(s) serveur.</span></div></>}
  {entries.some(entry=>entry.password)&&<div className="student-import-notice"><p className="flex items-center gap-2 font-semibold"><AlertCircle className="h-4 w-4"/>Les mots de passe initiaux ne sont affichés qu’à cet import.</p><p className="text-sm mt-2">Téléchargez les identifiants avant de fermer. Ce fichier contient des informations confidentielles ; remettez chaque identifiant uniquement à son titulaire.</p><Button type="button" variant="outline" className="mt-3" onClick={()=>downloadImportCredentials(entries)}><Download className="mr-2 h-4 w-4"/>Télécharger les identifiants créés</Button></div>}
 </section>;
}
