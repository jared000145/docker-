import {describe,it,expect} from 'vitest';
import * as XLSX from 'xlsx';
import {parseInstitutionWorkbook,IMPORT_SHEETS} from '@/lib/institutionData';
import {ROUTE_MODULE_MAP} from '@/lib/permissions';
const inst='10000000-0000-4000-8000-000000000001',student='10000000-0000-4000-8000-000000000002';
const empty={filieres:[],subjects:[],profiles:[{user_id:student,student_number:'ET-01',campus_id:null}],grades:[],payments:[],attendance:[]};
function workbook(sheets:Record<string,Record<string,unknown>[]>){const b=XLSX.utils.book_new();for(const [name,rows]of Object.entries(sheets)){const spec=IMPORT_SHEETS.find(s=>s.sheet===name)!;XLSX.utils.book_append_sheet(b,XLSX.utils.json_to_sheet(rows,{header:spec.columns}),name);}return XLSX.write(b,{type:'array',bookType:'xlsx'}) as ArrayBuffer;}
describe('institution data transfer',()=>{
 it('assigns historical receipts to the campus of that annual registration, not the current profile',async()=>{
  const refs={...empty,profiles:[{user_id:student,student_number:'ET-01',campus_id:'new-campus',academic_year:'2027-2028'}],student_years:[{user_id:student,academic_year:'2026-2027',campus_id:'old-campus'}]};
  const parsed=await parseInstitutionWorkbook(workbook({Paiements:[{reference:'OLD-01',matricule:'ET-01',description:'Frais',montant:100,montant_paye:100,date:'2026-11-09'}]}),inst,'2026-2027',refs);expect(parsed.errors).toEqual([]);expect(parsed.payload.payments[0].campus_id).toBe('old-campus');
 });
 it('resolves new programmes and subjects before grades and generates stable identities',async()=>{
  const buf=workbook({Filieres:[{nom:'Informatique'}],Matieres:[{code:'ALGO',nom:'Algorithmique',filiere:'Informatique',niveau:'L1',semestre:'S1',credits:6,coefficient:2}],Notes:[{matricule:'ET-01',code_matiere:'ALGO',semestre:'S1',note_cc:10,note_examen:15}]});
  const first=await parseInstitutionWorkbook(buf,inst,'2026-2027',empty),again=await parseInstitutionWorkbook(buf,inst,'2026-2027',empty);
  expect(first.errors).toEqual([]);expect(first.payload.grades[0].average).toBe(13);expect(first.payload.grades[0].subject_id).toBe(first.payload.subjects[0].id);expect(first.payload).toEqual(again.payload);
 });
 it('refuses duplicate rows, invalid marks, missing students and conflicting payment ownership',async()=>{
  const refs={...empty,subjects:[{id:'s1',code:'ALG',semester:'S1',academic_year:'2026-2027'}],payments:[{id:'p1',receipt_number:'R-01',user_id:'another'}]};
  const parsed=await parseInstitutionWorkbook(workbook({Notes:[{matricule:'ET-01',code_matiere:'ALG',semestre:'S1',note_cc:21,note_examen:10},{matricule:'UNKNOWN',code_matiere:'ALG',semestre:'S1',note_cc:10,note_examen:10}],Paiements:[{reference:'R-01',matricule:'ET-01',description:'Frais',montant:100,montant_paye:10,date:'2026-11-09'}]}),inst,'2026-2027',refs);
  expect(parsed.errors).toHaveLength(3);expect(parsed.payload.grades).toHaveLength(0);expect(parsed.payload.payments).toHaveLength(0);
 });
 it('preserves an existing row identity and rejects locked marks',async()=>{
  const refs={...empty,subjects:[{id:'s1',code:'ALG',semester:'S1',academic_year:'2026-2027'}],grades:[{id:'g1',subject_id:'s1',user_id:student,semester:'S1',academic_year:'2026-2027',is_locked:true}]};
  const parsed=await parseInstitutionWorkbook(workbook({Notes:[{matricule:'ET-01',code_matiere:'ALG',semestre:'S1',note_cc:10,note_examen:12}]}),inst,'2026-2027',refs);expect(parsed.errors[0]).toMatch(/verrouillée/);
 });
 it('maps every administrative route category to a permission',()=>{for(const route of ['classes','groups','cycles','grades-trimestre','closure-trimestre','applications','admissions'])expect(ROUTE_MODULE_MAP[route]).toBeTruthy();});
});
