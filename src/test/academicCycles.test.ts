import {describe,it,expect} from 'vitest';
import {institutionCycles,studentCycle,canPublishBac} from '@/lib/academicCycles';
describe('school and university boundaries',()=>{
 it('honours explicitly enabled cycles without adding college or lycée automatically',()=>{
  expect(institutionCycles({institution_type:'highschool',enabled_cycles:['college']})).toEqual(['college']);
  expect(institutionCycles({institution_type:'highschool',enabled_cycles:['lycee']})).toEqual(['lycee']);
  expect(institutionCycles({enabled_cycles:['lmd','lycee']})).toEqual(['universite','lycee']);
 });
 it('uses the class cycle before a stale profile level in mixed institutions',()=>{
  expect(studentCycle('L1','college')).toBe('college');
  expect(studentCycle('Terminale','lycee')).toBe('lycee');
  expect(studentCycle('3e')).toBe('college');
  expect(studentCycle('M2')).toBe('universite');
 });
 it('only enables bac publication for Terminale within an enabled lycée cycle',()=>{
  expect(canPublishBac(['lycee'],'Terminale','lycee')).toBe(true);
  for(const [cycles,level,cycle] of [[['college'],'3e','college'],[['universite'],'L1',null],[['lycee'],'2nde','lycee'],[['universite'],'Terminale',null],[['college','lycee'],'Terminale','college']] as const){
   expect(canPublishBac([...cycles],level,cycle)).toBe(false);
  }
 });
});
