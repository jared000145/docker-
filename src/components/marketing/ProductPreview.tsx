import { ArrowUpRight, Bell, BookOpen, CalendarDays, LayoutDashboard, Users } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function ProductPreview() {
  return <Link to="/apercu" className="product-preview" aria-label="Ouvrir la démonstration du tableau de bord RectorPlus">
    <div className="product-window"><span /><span /><span /><p>Établissement Horizon <span>/</span> Administration</p></div>
    <div className="product-body"><aside className="product-sidebar"><strong>R<span>+</span></strong>{[LayoutDashboard, Users, BookOpen, CalendarDays].map((Icon, index) => <span className={index === 0 ? 'is-active' : ''} key={index}><Icon size={17} /></span>)}</aside><div className="product-main">
      <div className="product-heading"><div><p>Année scolaire 2026–2027</p><h3>Vue d’ensemble</h3></div><Bell size={17} /></div>
      <div className="product-metrics"><div><p>Élèves inscrits</p><strong>248</strong><span>12 classes</span></div><div><p>Présences du jour</p><strong>96<span>%</span></strong><span>Pointage du matin</span></div><div><p>Dossiers à compléter</p><strong>08</strong><span>À suivre cette semaine</span></div></div>
      <div className="product-sheet"><div className="product-sheet-title"><strong>À l’ordre du jour</strong><span>Lundi 9 novembre</span></div>{[['08:00', 'Conseil pédagogique', 'Salle de réunion', 'Réunion'], ['10:30', 'Mathématiques · Terminale A', 'Salle 204', 'Cours'], ['14:00', 'Accueil des familles', 'Administration', 'Rendez-vous']].map(([time, title, subtitle, type]) => <div className="product-agenda" key={time}><time>{time}</time><div><strong>{title}</strong><span>{subtitle}</span></div><small>{type}</small></div>)}</div>
      <div className="product-bottom"><span><i /> Données de démonstration</span><ArrowUpRight size={16} /></div>
    </div></div>
  </Link>;
}
