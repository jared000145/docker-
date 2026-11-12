import { loadEnv } from 'vite';
const env={...loadEnv('production',process.cwd(),''),...process.env};
const url=env.VITE_SUPABASE_URL;
const key=env.VITE_SUPABASE_PUBLISHABLE_KEY;
let valid=false;
try { const parsed=new URL(url); valid=parsed.protocol==='https:' && parsed.hostname!=='your-project.supabase.co'; } catch { /* Report configuration names only. */ }
if(!valid || !key || key==='your-supabase-publishable-key') throw new Error('Déploiement réel refusé : renseigner VITE_SUPABASE_URL (HTTPS) et VITE_SUPABASE_PUBLISHABLE_KEY.');
let role='';
try { role=JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString()).role || ''; } catch { /* Publishable keys need not be JWTs. */ }
if(key.startsWith('sb_secret_') || role==='service_role') throw new Error('Clé secrète interdite dans le frontend. Utiliser uniquement la clé publique Supabase.');
console.log('Configuration publique du backend vérifiée.');
