import { Link } from 'react-router-dom';
import { lazy } from 'react';
import { ArrowRight, BookOpen, CalendarDays, CreditCard, Users } from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import MarketingLayout from '@/components/marketing/MarketingLayout';
import { getCustomDomainFromHost, getTenantSlugFromHost } from '@/hooks/useTenantSlug';
import { isConfigured } from '@/lib/config';
import ConfigurationScreen from '@/components/ConfigurationScreen';
const LoginPage = lazy(() => import('@/pages/LoginPage'));
import ProductPreview from '@/components/marketing/ProductPreview';
import campusPhoto from '@/assets/students-campus.webp';

const features = [
  { icon: Users, number: '01', title: 'Les dossiers, bien tenus.', text: 'Élèves, classes, inscriptions et documents : retrouvez les informations d’un parcours au même endroit.', label: 'Scolarité', module: 'eleves' },
  { icon: BookOpen, number: '02', title: 'Le suivi pédagogique, lisible.', text: 'Consultez les évaluations et les emplois du temps. Chacun accède aux informations qui le concernent.', label: 'Pédagogie', module: 'notes' },
  { icon: CreditCard, number: '03', title: 'Les paiements, suivis.', text: 'Gardez une vue sur les frais demandés, les montants réglés et les échéances à venir.', label: 'Administration', module: 'paiements' },
];
const spaces = [
  ['Administration', 'Organiser les classes, tenir les dossiers et suivre l’activité de l’établissement.'],
  ['Enseignants', 'Retrouver ses cours, son planning et les évaluations de ses classes.'],
  ['Élèves et étudiants', 'Consulter son emploi du temps, ses résultats et ses documents.'],
  ['Parents', 'Suivre les informations scolaires et les paiements de ses enfants.'],
];

export default function LandingPage() {
  if (getTenantSlugFromHost() || getCustomDomainFromHost()) return isConfigured ? <LoginPage /> : <ConfigurationScreen />;
  return <MarketingLayout>
    <Helmet><title>RectorPlus — La gestion de votre établissement, au même endroit</title><meta name="description" content="RectorPlus rassemble les dossiers scolaires, les notes, le planning et le suivi des paiements. Découvrez l’interface et les espaces de chaque utilisateur." /></Helmet>
    <section className="site-hero-banner">
      <img className="site-hero-photo" src={campusPhoto} alt="" loading="eager" />
      <div className="site-hero site-container">
      <div className="site-hero-copy">
        <p className="site-eyebrow"><span /> La vie de l’établissement, simplement.</p>
        <h1>Votre établissement.<br /><em>Une équipe connectée.</em></h1>
        <p className="site-lead">Dossiers scolaires, notes, emplois du temps et paiements. Un même espace pour l’équipe administrative, les enseignants et les familles.</p>
        <div className="site-actions"><Link className="site-button" to="/preinscription">Inscrire mon établissement <ArrowRight size={17} /></Link><Link className="site-text-link" to="/apercu">Explorer la démonstration <ArrowRight size={16} /></Link></div>
        <p className="site-fine-print"><strong>14 jours d’essai gratuit après validation.</strong><br />Sans prélèvement automatique. Déjà un compte ? <Link to="/login">Accéder à mon espace</Link></p>
      </div>
      </div>
    </section>
    <div className="site-audience site-container"><p>Pensé pour les équipes<br /><strong>qui font vivre l’établissement.</strong></p><span>Écoles & collèges</span><span>Lycées</span><span>Enseignement supérieur</span></div>
    <section className="site-product-section site-container"><div className="site-section-heading"><p className="site-eyebrow">Un espace de travail commun</p><h2>Une vue claire.<br />Des équipes mieux informées.</h2><p>Retrouvez les dossiers, le planning et les échéances dans une interface pensée pour le quotidien de votre établissement.</p><Link className="site-text-link" to="/apercu">Prendre en main la démonstration <ArrowRight size={16} /></Link></div><div className="site-hero-product"><div className="site-product-caption"><span>RECTORPLUS / ESPACE ADMINISTRATION</span><span>Données de démonstration</span></div><ProductPreview /></div></section>
    <section id="fonctionnalites" className="site-features site-container">
      <div className="site-section-heading"><p className="site-eyebrow">Le quotidien, mieux organisé</p><h2>Les informations utiles.<br />Au bon endroit.</h2><p>Une organisation commune, du dossier de l’élève à son suivi pédagogique et administratif.</p></div>
      <div className="site-feature-grid">{features.map(({ icon: Icon, ...feature }) => <article key={feature.number} className="site-feature"><div className="site-feature-top"><Icon size={24} strokeWidth={1.5} /><span>{feature.number}</span></div><p className="site-feature-label">{feature.label}</p><h3>{feature.title}</h3><p>{feature.text}</p><Link to={`/apercu?module=${feature.module}`} className="site-text-link">Voir dans la démonstration <ArrowRight size={15} /></Link></article>)}</div>
    </section>
    <section id="espaces" className="site-spaces"><div className="site-container site-spaces-grid"><div><p className="site-eyebrow">À chacun son espace</p><h2>Une même plateforme.<br /><em>Des usages différents.</em></h2><p>On ne demande pas la même chose à un enseignant, à un parent ou à une équipe de direction. Les espaces et les accès suivent les responsabilités de chacun.</p><Link to="/login" className="site-text-link">Accéder à mon établissement <ArrowRight size={16} /></Link></div><div className="site-role-list">{spaces.map(([name, description], index) => <article key={name}><span>0{index + 1}</span><div><h3>{name}</h3><p>{description}</p></div></article>)}</div></div></section>
    <section className="site-workflow site-container"><div className="site-section-heading"><p className="site-eyebrow">Du bureau au téléphone</p><h2>Le même fil conducteur,<br />tout au long de la journée.</h2></div><div className="site-workflow-grid"><CalendarDays size={32} strokeWidth={1.3} /><div><h3>Préparer. Consulter. Faire le point.</h3><p>Un cours à retrouver, une note à vérifier, un dossier à compléter : accédez à l’information depuis un ordinateur ou un navigateur mobile, sans multiplier les fichiers.</p></div><Link className="site-button site-button-outline" to="/apercu?module=planning">Consulter le planning <ArrowRight size={16} /></Link></div></section>
    <section id="questions" className="site-faq site-container"><div><p className="site-eyebrow">Avant de commencer</p><h2>Quelques repères.</h2></div><div>{[
      ['Quand commence l’essai gratuit de 14 jours ?', 'Après validation du dossier de votre établissement. Aucun paiement n’est demandé au dépôt et aucun prélèvement automatique n’est prévu pendant l’essai. Un abonnement sera nécessaire pour poursuivre l’utilisation ensuite.'],
      ['Puis-je essayer sans créer de compte ?', 'Oui. La démonstration est accessible librement. Vous pouvez consulter les différents écrans, ajouter un élève fictif et modifier des notes ou des paiements. Ces essais restent dans votre navigateur.'],
      ['Comment obtenir mes accès ?', 'Les comptes réels sont fournis par votre établissement. Utilisez votre email ou le matricule qui vous a été communiqué sur la page de connexion.'],
      ['Puis-je utiliser RectorPlus sur téléphone ?', 'L’interface web s’adapte au téléphone, à la tablette et à l’ordinateur. L’application Android est disponible en téléchargement depuis RectorPlus.'],
      ['Les données de la démonstration sont-elles réelles ?', 'Non. Les noms, résultats et paiements présentés sont des exemples. La démonstration est indépendante des données des établissements.'],
    ].map(([question, answer]) => <details key={question}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}</div></section>
    <section className="site-closing site-container"><div><p className="site-eyebrow">Faites-vous une idée.</p><h2>Le plus simple,<br /><em>c’est de l’essayer.</em></h2></div><Link className="site-button" to="/apercu">Ouvrir la démonstration <ArrowRight size={17} /></Link></section>
  </MarketingLayout>;
}
