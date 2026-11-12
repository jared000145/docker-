import "./lib/nativeBootstrap";
import NativeUpdatesPanel from "./components/NativeUpdatesPanel";
import { createRoot } from "react-dom/client";
import { lazy, Suspense } from "react";
import { HelmetProvider } from "react-helmet-async";
import "./index.css";
import { isConfigured } from "./lib/config";
import AppErrorBoundary from "./components/AppErrorBoundary";
import PublicApp from "./PublicApp";
import AppVersionNotice from './components/AppVersionNotice';
const App = lazy(() => import('./App.tsx'));

// Mode clair par défaut (Rectorplus — thème Social Bleu Facebook)
document.documentElement.classList.remove("dark");

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <AppVersionNotice />
    <AppErrorBoundary><Suspense fallback={<div role="status" className="min-h-screen grid place-items-center bg-white text-slate-600">Chargement de RectorPlus…</div>}><>{isConfigured ? <App /> : <PublicApp />}<NativeUpdatesPanel/></></Suspense></AppErrorBoundary>
  </HelmetProvider>
);
