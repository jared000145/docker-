import {it,expect,vi,beforeAll} from 'vitest';import {webcrypto} from 'node:crypto';import * as XLSX from 'xlsx';import {downloadStudentTemplate,parseStudentWorkbook} from '@/lib/studentSpreadsheet';import {saveWorkbook} from '@/lib/nativeExports';
beforeAll(()=>vi.stubGlobal('crypto',webcrypto));
vi.mock('@/lib/nativeExports',()=>({saveWorkbook:vi.fn()}));
it('keeps the import sheet blank, puts guidance and a fictional example in separate sheets, and accepts a filled row',async()=>{
 downloadStudentTemplate('2026-2027','L1','Informatique');const book=vi.mocked(saveWorkbook).mock.calls[0][0];expect(book.SheetNames).toEqual(['Etudiants','Instructions','Exemple']);expect(XLSX.utils.sheet_to_json(book.Sheets.Etudiants)).toEqual([]);expect(XLSX.utils.sheet_to_json(book.Sheets.Exemple)).toHaveLength(1);
 XLSX.utils.sheet_add_aoa(book.Sheets.Etudiants,[['Diallo','Aïcha','ET-01','L1','2026-2027','Informatique','','2004-06-15','','','non-boursier']],{origin:'A2'});
 const rows=await parseStudentWorkbook(XLSX.write(book,{type:'array',bookType:'xlsx'}),{year:'2026-2027',levels:['L1'],filieres:[{id:'10000000-0000-4000-8000-000000000001',name:'Informatique'}],classes:[]});expect(rows).toHaveLength(1);expect(rows[0].errors).toEqual([]);expect(rows[0].data?.matricule).toBe('ET-01');
});
