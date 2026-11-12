import { useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { useWebRelease } from '@/hooks/useWebRelease';
export default function AppVersionNotice() {
  const available=useWebRelease(__APP_BUILD__,!import.meta.env.DEV && !(Capacitor.isNativePlatform() && ['localhost','127.0.0.1'].includes(window.location.hostname)));
  const [dismissed,setDismissed]=useState<string | null>(null);
  if(!available || available===dismissed) return null;
  return <aside role="status" aria-label="Mise à jour de RectorPlus" className="fixed bottom-4 left-4 right-4 sm:right-auto z-[110] max-w-md rounded-lg border bg-white text-slate-700 shadow-lg p-4"><p className="font-semibold text-sm">Une nouvelle version de RectorPlus est disponible.</p><p className="mt-1 text-xs">Terminez vos modifications avant de l’ouvrir.</p><div className="flex gap-4 mt-3"><button className="text-sm font-semibold text-primary" onClick={()=>window.location.reload()}>Actualiser</button><button className="text-sm text-slate-500" onClick={()=>setDismissed(available)}>Plus tard</button></div></aside>;
}
