import { type ReactNode, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, Menu, X } from 'lucide-react';
import RectorPlusLogo from '@/components/branding/RectorPlusLogo';
import '@/styles/marketing.css';

export const WHATSAPP_NUMBERS = [
  { label: '+241 74 44 01 89', wa: '24174440189', tel: '+24174440189' },
  { label: '+241 076 27 64 56', wa: '241076276456', tel: '+241076276456' },
];
export const CONTACT_EMAIL = 'service@rectorplus.com';
export const WA_TEXT = encodeURIComponent('Bonjour RectorPlus, je souhaite en savoir plus sur la plateforme.');
export const waLink = (number: string) => `https://web.whatsapp.com/send?phone=${number}&text=${WA_TEXT}`;
export const WHATSAPP_URL = waLink(WHATSAPP_NUMBERS[0].wa);
// Kept for existing imports; contact options live in the footer instead of floating over content.
export const WhatsAppButton = () => null;

export function MarketingNav() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const items = [{ to: '/#fonctionnalites', label: 'Le produit' }, { to: '/#espaces', label: 'Vos espaces' }, { to: '/documentation', label: 'Guide d’utilisation' }];
  return <header className="site-header"><nav className="site-container site-nav" aria-label="Navigation principale">
    <Link to="/" className="site-brand" aria-label="RectorPlus — accueil"><RectorPlusLogo className="h-9" /><span>Rector<span>Plus</span><small>GESTION SCOLAIRE</small></span></Link>
    <div className="site-nav-links">{items.map(item => <Link key={item.to} to={item.to} aria-current={pathname === item.to ? 'page' : undefined}>{item.label}</Link>)}<Link to="/preinscription">Inscrire mon établissement</Link></div>
    <div className="site-nav-actions"><Link className="site-signin" to="/login">Se connecter <ArrowRight size={15} /></Link><Link to="/apercu" className="site-button site-nav-demo">Découvrir l’interface</Link><button className="site-menu-toggle" type="button" aria-label={open ? 'Fermer le menu' : 'Ouvrir le menu'} aria-expanded={open} aria-controls="site-mobile-menu" onClick={() => setOpen(value => !value)}>{open ? <X size={22} /> : <Menu size={22} />}</button></div>
  </nav>{open && <nav id="site-mobile-menu" className="site-mobile-menu" aria-label="Navigation mobile">{items.map(item => <Link key={item.to} to={item.to} onClick={() => setOpen(false)}>{item.label}</Link>)}<Link to="/apercu" onClick={() => setOpen(false)}>Explorer la démonstration <ArrowRight size={16} /></Link></nav>}</header>;
}

export function MarketingFooter() {
  return <footer className="site-footer"><div className="site-container"><div className="site-footer-top"><div><Link to="/" className="site-footer-brand">RectorPlus<span>La vie scolaire, au même endroit.</span></Link><p>Un espace commun pour l’établissement<br />et celles et ceux qui le font vivre.</p></div><nav aria-label="Découvrir"><strong>Découvrir</strong><Link to="/apercu">La démonstration</Link><Link to="/#fonctionnalites">Les fonctionnalités</Link><Link to="/#espaces">Les espaces utilisateurs</Link></nav><nav aria-label="Ressources"><strong>À votre disposition</strong><Link to="/documentation">Guide d’utilisation</Link><Link to="/login">Connexion</Link><a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></nav></div><div className="site-footer-bottom"><span>© {new Date().getFullYear()} RectorPlus</span><div><Link to="/cgu">Conditions d’utilisation</Link><Link to="/confidentialite">Confidentialité</Link></div><span>Conçu pour l’éducation.</span></div></div></footer>;
}

export default function MarketingLayout({ children }: { children: ReactNode }) {
  const { hash, pathname } = useLocation();
  useEffect(() => {
    if (!hash) return;
    const frame = requestAnimationFrame(() => document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' }));
    return () => cancelAnimationFrame(frame);
  }, [hash, pathname]);
  return <div className="site-page"><a className="site-skip-link" href="#contenu">Aller au contenu</a><MarketingNav /><main id="contenu">{children}</main><MarketingFooter /></div>;
}
