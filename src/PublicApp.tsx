import { lazy, Suspense } from 'react';
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import LandingPage from '@/pages/LandingPage';
import ConfigurationScreen from '@/components/ConfigurationScreen';
import MarketingLayout, { CONTACT_EMAIL } from '@/components/marketing/MarketingLayout';
import DemoPage from '@/pages/DemoPage';

const DocumentationPage = lazy(() => import('@/pages/marketing/DocumentationPage'));
const BlogPage = lazy(() => import('@/pages/marketing/BlogPage'));
const BlogArticlePage = lazy(() => import('@/pages/marketing/BlogArticlePage'));
const CguPage = lazy(() => import('@/pages/marketing/CguPage'));
const ConfidentialitePage = lazy(() => import('@/pages/marketing/ConfidentialitePage'));
const LogicielGestionScolairePage = lazy(() => import('@/pages/marketing/LogicielGestionScolairePage'));
const PlateformeUniversitePage = lazy(() => import('@/pages/marketing/PlateformeUniversitePage'));
const SchoolManagementSystemPage = lazy(() => import('@/pages/marketing/SchoolManagementSystemPage'));

// Public pages and the isolated demonstration work without an Auth session or a backend.
export default function PublicApp() {
  return <BrowserRouter><Suspense fallback={<div role="status" className="min-h-screen grid place-items-center bg-white text-slate-600">Chargement de la page…</div>}><Routes>
    <Route path="/" element={<LandingPage />} />
    <Route path="/apercu" element={<DemoPage />} />
    <Route path="/documentation" element={<DocumentationPage />} />
    <Route path="/blog" element={<BlogPage />} />
    <Route path="/blog/:slug" element={<BlogArticlePage />} />
    <Route path="/cgu" element={<CguPage />} />
    <Route path="/confidentialite" element={<ConfidentialitePage />} />
    <Route path="/logiciel-gestion-scolaire" element={<LogicielGestionScolairePage />} />
    <Route path="/plateforme-universite" element={<PlateformeUniversitePage />} />
    <Route path="/school-management-system" element={<SchoolManagementSystemPage />} />
    <Route path="/contact" element={<MarketingLayout><section className="site-container py-20"><p className="site-eyebrow">Parlons de votre établissement</p><h1 className="text-3xl mb-6">Contacter RectorPlus</h1><p className="mb-8">Pour présenter vos besoins ou poser une question, écrivez à notre équipe.</p><a className="site-button" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></section></MarketingLayout>} />
    <Route path="/login" element={<ConfigurationScreen />} />
    <Route path="/parent/login" element={<ConfigurationScreen />} />
    <Route path="/e/:slug" element={<ConfigurationScreen />} />
    <Route path="/preinscription" element={<ConfigurationScreen />} />
    <Route path="/forgot-password" element={<ConfigurationScreen />} />
    <Route path="*" element={<MarketingLayout><section className="site-container py-24"><p className="site-eyebrow">Page indisponible</p><h1 className="text-3xl mb-5">Retrouvons le bon chemin.</h1><Link className="site-button" to="/">Retour à l’accueil</Link></section></MarketingLayout>} />
  </Routes></Suspense></BrowserRouter>;
}
