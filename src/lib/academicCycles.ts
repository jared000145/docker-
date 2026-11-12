export type AcademicCycle = 'college' | 'lycee' | 'universite';

export function institutionCycles(institution?: Record<string, any> | null): AcademicCycle[] {
  const configured = institution?.enabled_cycles;
  if (Array.isArray(configured) && configured.length) {
    return [...new Set(configured.map(c => c === 'lmd' || c === 'bts' ? 'universite' : c))]
      .filter((c): c is AcademicCycle => ['college', 'lycee', 'universite'].includes(c));
  }
  return institution?.institution_type === 'highschool' ? ['college', 'lycee'] : ['universite'];
}

export function studentCycle(level?: string | null, classCycle?: string | null): AcademicCycle | null {
  if (['college', 'lycee'].includes(classCycle || '')) return classCycle as AcademicCycle;
  const value = (level || '').trim().toLowerCase();
  if (/^(6e|5e|4e|3e|6ème|5ème|4ème|3ème)$/.test(value)) return 'college';
  if (/^(2nde|seconde|1ère|1ere|première|premiere|terminale|tle|t-le)$/.test(value)) return 'lycee';
  if (/^(l[1-3]|m[12]|d[1-3]|bts|licence|master|doctorat)/.test(value)) return 'universite';
  return null;
}

export function canPublishBac(cycles: string[], level?: string | null, classCycle?: string | null) {
  return cycles.includes('lycee') && studentCycle(level, classCycle) === 'lycee'
    && /^(terminale|tle|t-le)$/i.test((level || '').trim());
}
