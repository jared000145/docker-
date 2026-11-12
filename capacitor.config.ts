import type { CapacitorConfig } from '@capacitor/cli';

// Remote web loading is an explicit test mode, never the default production package.
const remote=process.env.CAPACITOR_TEST_URL?.trim();
if(remote) {
  const parsed=new URL(remote);
  if(process.env.CAPACITOR_TEST_MODE!=='1' || parsed.protocol!=='https:' || parsed.username || parsed.password || parsed.search || parsed.hash) throw new Error('CAPACITOR_TEST_URL exige le mode test explicite et une URL HTTPS sans identifiants.');
}

const config: CapacitorConfig = {
  appId: 'com.rectorplus.app',
  appName: 'RectorPlus',
  webDir: process.env.RECTORPLUS_WEB_DIR || 'dist',
  server: { androidScheme: 'https', ...(remote ? {url:remote,cleartext:false} : {}) },
};
export default config;
