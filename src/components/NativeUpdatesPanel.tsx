import {useEffect,useState} from 'react';
import {Download,RefreshCw,Smartphone,Bell} from 'lucide-react';
import {Dialog,DialogContent,DialogHeader,DialogTitle} from '@/components/ui/dialog';
import {Button} from '@/components/ui/button';
import {Switch} from '@/components/ui/switch';
import {isNativeApp,nativeUpdates,type NativeReleaseStatus} from '@/lib/nativeUpdates';
import release from '../../mobile/release.json';
export default function NativeUpdatesPanel(){
 const [status,setStatus]=useState<NativeReleaseStatus|null>(null),[open,setOpen]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 useEffect(()=>{
  if(!isNativeApp())return;document.body.classList.add('rectorplus-native');let active=true,healthy=true,pending=false;
  const failed=()=>{healthy=false;};window.addEventListener('error',failed);window.addEventListener('unhandledrejection',failed);
  void nativeUpdates.status().then(value=>{if(active)setStatus(value);}).catch(()=>{});
  const check=async()=>{if(pending||document.visibilityState==='hidden'||!navigator.onLine)return;pending=true;try{const value=await nativeUpdates.check({userInitiated:false});if(active)setStatus(value);}catch{/* Keep the current complete release. */}finally{pending=false;}};
  const ready=setTimeout(()=>{if(active&&healthy)void nativeUpdates.confirmReady({build:release.webBuild}).catch(()=>{});},10000);
  const poll=setInterval(()=>void check(),60000);void check();const foreground=()=>void check();document.addEventListener('visibilitychange',foreground);
  return()=>{active=false;clearTimeout(ready);clearInterval(poll);window.removeEventListener('error',failed);window.removeEventListener('unhandledrejection',failed);document.removeEventListener('visibilitychange',foreground);};
 },[]);
 if(!isNativeApp())return null;
 async function check(){setBusy(true);setMessage('');try{const value=await nativeUpdates.check({userInitiated:true});setStatus(value);setMessage(value.storeAvailable?'Une nouvelle application est disponible sur le Play Store.':value.pendingVersion?'La mise à jour est prête. Elle sera appliquée à la prochaine ouverture.':'Votre application est à jour.');}catch{setMessage('Vérification impossible pour le moment. La version actuelle est conservée.');}finally{setBusy(false);}}
 return <><button onClick={()=>setOpen(true)} className="native-version-pill" aria-label="Version et mises à jour de RectorPlus"><Smartphone className="h-3.5 w-3.5"/>Version {status?.nativeVersion||release.nativeVersion}{status?.storeAvailable?<span className="native-update-dot"/>:status?.pendingVersion?<span className="text-blue-600">· Mise à jour prête</span>:null}</button>
 <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>RectorPlus · Mises à jour</DialogTitle></DialogHeader><div className="space-y-5 text-sm"><div className="rounded-xl border bg-slate-50 p-4"><p className="font-semibold">Application {status?.nativeVersion||release.nativeVersion}</p><p className="text-slate-500 mt-1">Interface {status?.webVersion||release.webVersion} · {status?.channel==='preview'?'Canal de test':'Canal stable'}</p></div>
 {status?.rolledBack&&<p className="rounded-lg border p-3">La version précédente a été conservée après un problème de démarrage.</p>}
 <p>Les petites mises à jour sont vérifiées puis préparées en Wi-Fi. Elles s’appliquent à la prochaine ouverture, sans interrompre vos saisies. Le bouton de vérification autorise aussi le téléchargement sur votre connexion actuelle.</p>
 {status?.pendingVersion&&<div className="rounded-xl border border-blue-200 bg-blue-50 p-4"><p className="font-semibold">Interface {status.pendingVersion} prête</p><Button className="mt-3 w-full" onClick={()=>{if(window.confirm('Enregistrez vos modifications avant de redémarrer RectorPlus. Continuer ?'))void nativeUpdates.applyReady();}}>Redémarrer et appliquer</Button></div>}
 {status?.storeAvailable&&<div className="rounded-xl border border-blue-200 p-4"><p className="font-semibold">Nouvelle application {status.storeVersion}</p><p className="text-slate-500 mt-1">Cette version nécessite une installation depuis le Play Store. Votre version actuelle reste en place.</p><Button className="mt-3 w-full" onClick={()=>void nativeUpdates.openStore()}><Download className="h-4 w-4 mr-2"/>Ouvrir le Play Store</Button></div>}
 <label className="flex items-center justify-between gap-3"><span className="flex items-center gap-2"><Bell className="h-4 w-4"/>M’avertir des versions Play Store</span><Switch checked={!!status?.notifications} onCheckedChange={enabled=>void nativeUpdates.notifications({enabled}).then(setStatus).catch(()=>setMessage('Notifications indisponibles.'))}/></label>
 <Button variant="outline" className="w-full" disabled={busy} onClick={()=>void check()}><RefreshCw className={`h-4 w-4 mr-2 ${busy?'animate-spin':''}`}/>{busy?'Vérification…':'Vérifier les mises à jour'}</Button>{message&&<p role="status" className="text-slate-600">{message}</p>}
 </div></DialogContent></Dialog></>;
}
