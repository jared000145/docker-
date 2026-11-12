import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
const buildStamp=[process.env.VERCEL_GIT_COMMIT_SHA?.slice(0,12) || 'local',Date.now().toString(36)].join('-');

// https://vitejs.dev/config/
export default defineConfig(() => ({
  publicDir: process.env.RECTORPLUS_MOBILE_BUILD === "1" ? ".tools/mobile-public" : "public",
  define: { __APP_BUILD__: JSON.stringify(buildStamp) },
  server: {
    host: "::",
    port: 8080,
    watch: { ignored: ['**/.tools/**','**/android/**','**/releases/**','**/supabase/**','**/vendor/**','**/public/mobile/bundles/**'] },
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), {
    name: 'rectorplus-version',
    apply: 'build',
    generateBundle() { this.emitFile({type:'asset',fileName:'version.json',source:JSON.stringify({build:buildStamp})}); },
  }],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
