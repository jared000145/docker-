import {beforeAll,expect,it,vi} from 'vitest';
import {webcrypto} from 'node:crypto';
import * as XLSX from 'xlsx';
import {parseStudentWorkbook} from '@/lib/studentSpreadsheet';
beforeAll(()=>{vi.stubGlobal('crypto',webcrypto);});
const context={year:'2026-2027',levels:['L1','L2'],filieres:[{id:'10000000-0000-4000-8000-000000000001',name:'Informatique'}],classes:[]};
function workbook(rows:unknown[][]){const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet(rows),'Etudiants');return XLSX.write(book,{bookType:'xlsx',type:'array'}) as ArrayBuffer;}
it('reads accented headers and Excel birth dates, resolves the programme and preserves explicit matricules',async()=>{
 const rows=await parseStudentWorkbook(workbook([['Nom','Prénom','Matricule','Niveau','Filière','Date de naissance','Statut'],['Diallo','Aïcha','00123','l1','informatique',38000,'non-boursier']]),context);
 expect(rows[0].errors).toEqual([]);expect(rows[0].data).toMatchObject({last_name:'Diallo',first_name:'Aïcha',level:'L1',matricule:'00123',academic_year:'2026-2027',filiere_id:context.filieres[0].id,statut_boursier:false});expect(rows[0].data?.date_of_birth).toMatch(/^2004-/);
});
it('uses stable replay keys for the same workbook',async()=>{
 const buffer=workbook([['Nom','Prenom','Niveau'],['A','B','L1']]);
 const first=await parseStudentWorkbook(buffer,context),second=await parseStudentWorkbook(buffer,context);expect(first[0].key).toBe(second[0].key);expect(first[0].key).toHaveLength(64);
});
it('keeps zero-padded numeric student numbers as displayed in Excel',async()=>{
 const book=XLSX.utils.book_new(),sheet=XLSX.utils.aoa_to_sheet([['Nom','Prenom','Niveau','Matricule'],['A','B','L1',123]]);sheet.D2.z='00000';XLSX.utils.book_append_sheet(book,sheet,'Etudiants');
 const [entry]=await parseStudentWorkbook(XLSX.write(book,{type:'array',bookType:'xlsx'}),context);expect(entry.data?.matricule).toBe('00123');
});
it('recognizes the French collège spelling 6ème as the configured level 6e',async()=>{
 const [entry]=await parseStudentWorkbook(workbook([['Nom','Prénom','Niveau'],['A','B','6ème']]),{...context,levels:['6e']});
 expect(entry.errors).toEqual([]);expect(entry.data?.level).toBe('6e');
});
it('flags duplicates, unknown programmes and historical data instead of silently dropping them',async()=>{
 const rows=await parseStudentWorkbook(workbook([['Nom','Prenom','Niveau','Filiere','notes'],['A','B','L1','Inconnue','Maths:12'],['A','B','L1','Inconnue','Maths:12']]),context);
 expect(rows[0].errors.join(' ')).toMatch(/Filière inconnue/);expect(rows[0].errors.join(' ')).toMatch(/Doublon/);expect(rows[0].errors.join(' ')).toMatch(/historiques/);
});
it('refuses formulas, invalid dates and years',async()=>{
 const book=XLSX.utils.book_new(),sheet=XLSX.utils.aoa_to_sheet([['Nom','Prenom','Niveau','Date naissance','Annee'],['A','B','L1','31/02/2004','2025-2026']]);sheet.A2={t:'s',v:'A',f:'"A"'};XLSX.utils.book_append_sheet(book,sheet,'Etudiants');
 const rows=await parseStudentWorkbook(XLSX.write(book,{type:'array',bookType:'xlsx'}),context);expect(rows[0].errors.join(' ')).toMatch(/Formule/);expect(rows[0].errors.join(' ')).toMatch(/naissance invalide/);
});
it('rejects oversized batches and sheets without student headers',async()=>{
 await expect(parseStudentWorkbook(workbook([['Titre'],['Valeur']]),context)).rejects.toThrow(/Nom et Prénom/);
 await expect(parseStudentWorkbook(workbook([['Nom','Prenom','Niveau'],...Array.from({length:501},()=>['A','B','L1'])]),context)).rejects.toThrow(/500 lignes/);
});
