import { useSyncExternalStore } from 'react';
type Language = 'fr' | 'en';
const listeners = new Set<() => void>();
let language: Language = 'fr';
try { language = localStorage.getItem('rp_language') === 'en' ? 'en' : 'fr'; } catch { /* storage unavailable */ }
document.documentElement.lang = language;
export function useLanguage() {
  const current = useSyncExternalStore((listener) => { listeners.add(listener); return () => listeners.delete(listener); }, () => language);
  const setLanguage = (next: Language) => {
    language = next;
    document.documentElement.lang = next;
    try { localStorage.setItem('rp_language', next); } catch { /* storage unavailable */ }
    listeners.forEach(listener => listener());
  };
  return { language: current, setLanguage, t: (fr: string, en: string) => current === 'fr' ? fr : en };
}
