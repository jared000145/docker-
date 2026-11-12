import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BookOpen, CalendarDays, Check, ChevronRight, CreditCard, LayoutDashboard, Menu, Plus, Search, Users, X } from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import '@/styles/demo.css';

type Student = { id: string; name: string; classe: string; grade: number | null; due: number; paid: number; dossierComplete?: boolean };
const seed: Student[] = [
  { id: 'EH-001', name: 'Anaïs Morel', classe: 'Terminale A', grade: 15.5, due: 180000, paid: 180000 },
  { id: 'EH-002', name: 'Lucas Ndiaye', classe: 'Terminale A', grade: 13, due: 180000, paid: 120000 },
  { id: 'EH-003', name: 'Lina Diallo', classe: 'Première B', grade: 16, due: 150000, paid: 150000 },
  { id: 'EH-004', name: 'Gabriel Essono', classe: 'Première B', grade: 11.5, due: 150000, paid: 75000 },
  { id: 'EH-005', name: 'Sarah Laurent', classe: 'Seconde A', grade: 14, due: 120000, paid: 120000 },
  { id: 'EH-006', name: 'Noah Martin', classe: 'Seconde A', grade: null, due: 120000, paid: 60000, dossierComplete: false },
];
const classes = ['Terminale A', 'Première B', 'Seconde A'];
const storageKey = 'rectorplus-demo-v1';
const navigation = [
  { id: 'accueil', label: 'Vue d’ensemble', icon: LayoutDashboard },
  { id: 'eleves', label: 'Élèves', icon: Users },
  { id: 'notes', label: 'Notes & résultats', icon: BookOpen },
  { id: 'paiements', label: 'Paiements', icon: CreditCard },
  { id: 'planning', label: 'Emploi du temps', icon: CalendarDays },
];
const sessions = [
  { day: 'Lundi', time: '08:00 – 09:30', subject: 'Français', classe: 'Terminale A', teacher: 'Mme Bernard', room: 'Salle 102' },
  { day: 'Lundi', time: '10:00 – 11:30', subject: 'Mathématiques', classe: 'Première B', teacher: 'M. Robert', room: 'Salle 204' },
  { day: 'Mardi', time: '08:00 – 09:30', subject: 'Histoire-géographie', classe: 'Seconde A', teacher: 'Mme Petit', room: 'Salle 103' },
  { day: 'Mercredi', time: '09:00 – 10:30', subject: 'Mathématiques', classe: 'Terminale A', teacher: 'M. Robert', room: 'Salle 204' },
  { day: 'Jeudi', time: '10:00 – 11:30', subject: 'Anglais', classe: 'Première B', teacher: 'Mme Simon', room: 'Salle 105' },
  { day: 'Vendredi', time: '08:00 – 09:30', subject: 'Sciences', classe: 'Seconde A', teacher: 'M. Michel', room: 'Laboratoire' },
];
const money = (value: number) => `${new Intl.NumberFormat('fr-FR').format(value)} FCFA`;
function readStudents(): Student[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(storageKey) || 'null');
    if (Array.isArray(stored) && stored.length > 0 && stored.every(row => typeof row.id === 'string' && typeof row.name === 'string' && classes.includes(row.classe) && typeof row.due === 'number' && row.due >= 0 && typeof row.paid === 'number' && row.paid >= 0 && row.paid <= row.due && (row.grade === null || (typeof row.grade === 'number' && row.grade >= 0 && row.grade <= 20)))) return stored as Student[];
  } catch { /* Start with the sample set if storage is unavailable or invalid. */ }
  return seed;
}

export default function DemoPage() {
  const [params, setParams] = useSearchParams();
  const module = navigation.some(item => item.id === params.get('module')) ? params.get('module')! : 'accueil';
  const [students, setStudents] = useState(readStudents);
  const [query, setQuery] = useState('');
  const [classe, setClasse] = useState('all');
  const [addOpen, setAddOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [name, setName] = useState('');
  const [newClasse, setNewClasse] = useState(classes[0]);
  const [notice, setNotice] = useState('');
  const previousFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!addOpen) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setAddOpen(false); return; }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(document.querySelectorAll<HTMLElement>('.demo-modal button, .demo-modal input, .demo-modal select'));
      const first = focusable[0]; const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', trapFocus);
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', trapFocus); previousFocus.current?.focus(); };
  }, [addOpen]);
  const active = navigation.find(item => item.id === module)!;
  const filtered = students.filter(student => (classe === 'all' || student.classe === classe) && `${student.name} ${student.id}`.toLocaleLowerCase('fr').includes(query.toLocaleLowerCase('fr').trim()));
  const totalDue = students.reduce((sum, student) => sum + student.due, 0);
  const totalPaid = students.reduce((sum, student) => sum + student.paid, 0);
  const graded = students.filter(student => student.grade !== null);
  const average = graded.length ? (graded.reduce((sum, student) => sum + student.grade!, 0) / graded.length).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) : '—';
  function persist(next: Student[], message: string) {
    setStudents(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); setNotice(message); }
    catch { setNotice(`${message} Le navigateur ne permet pas la sauvegarde : vos essais restent ouverts jusqu’au rechargement.`); }
  }
  function switchModule(id: string) { setParams(id === 'accueil' ? {} : { module: id }); setQuery(''); setMenuOpen(false); setNotice(''); }
  const roster = (compact = false) => <div className="demo-table-scroll"><table className="demo-table"><thead><tr><th>Élève</th><th>Classe</th>{module === 'notes' ? <th>Note / 20</th> : module === 'paiements' ? <><th>Frais prévus</th><th>Reste à régler</th><th>Suivi</th></> : <><th>Matricule</th><th>Dossier</th></>}</tr></thead><tbody>{(compact ? filtered.slice(0, 4) : filtered).map(student => <tr key={student.id}><td><span className="demo-person"><span className="demo-avatar">{student.name.split(' ').map(part => part[0]).slice(0, 2).join('')}</span><span>{student.name}<small>{student.id}</small></span></span></td><td>{student.classe}</td>{module === 'notes' ? <td><input className="demo-grade" aria-label={`Note de ${student.name}`} type="number" min="0" max="20" step="0.5" placeholder="—" value={student.grade ?? ''} onChange={event => { const grade = event.target.value === '' ? null : Number(event.target.value); if (grade === null || (Number.isFinite(grade) && grade >= 0 && grade <= 20)) persist(students.map(row => row.id === student.id ? { ...row, grade } : row), 'Note enregistrée dans la démonstration.'); }} /></td> : module === 'paiements' ? <><td>{money(student.due)}</td><td>{money(student.due - student.paid)}</td><td>{student.paid >= student.due ? <span className="demo-tag"><Check size={12} /> À jour</span> : <button className="demo-pay" onClick={() => persist(students.map(row => row.id === student.id ? { ...row, paid: row.due } : row), `Règlement de ${student.name} simulé. Aucun paiement réel effectué.`)}>Simuler le règlement</button>}</td></> : <><td className="demo-muted">{student.id}</td><td><span className="demo-tag">{(student.dossierComplete ?? true) ? 'Complet' : 'À compléter'}</span></td></>}</tr>)}</tbody></table>{filtered.length === 0 && <div className="demo-empty"><Search size={23} /><strong>Aucun élève trouvé</strong><p>Essayez un autre nom ou sélectionnez une autre classe.</p><button onClick={() => { setQuery(''); setClasse('all'); }}>Effacer les filtres</button></div>}</div>;
  return <div className="demo-app">
    <Helmet><title>Démonstration interactive — RectorPlus</title><meta name="robots" content="noindex" /></Helmet>
    <div className="demo-banner"><span><i /> Démonstration locale <b>·</b> Données fictives, essais enregistrés dans ce navigateur.</span><Link to="/">Retour au site <ArrowRight size={13} /></Link></div>
    <div className="demo-shell"><aside className={`demo-sidebar ${menuOpen ? 'demo-sidebar-open' : ''}`}><div className="demo-brand">Rector<span>Plus</span><button aria-label="Fermer la navigation" className="demo-close-menu" onClick={() => setMenuOpen(false)}><X size={20} /></button></div><div className="demo-school"><span>EH</span><div>Établissement Horizon<small>Espace administration</small></div></div><p className="demo-nav-label">ESPACE DE TRAVAIL</p><nav aria-label="Modules de démonstration">{navigation.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => switchModule(id)} aria-current={module === id ? 'page' : undefined}><Icon size={18} strokeWidth={1.6} />{label}{id === 'eleves' && <small>{students.length}</small>}</button>)}</nav><div className="demo-sidebar-bottom"><span>Un espace à votre image.</span><p>Cette visite est indépendante des comptes et des données réelles.</p><Link to="/login">Se connecter à mon établissement <ArrowRight size={14} /></Link></div></aside>
      <div className="demo-content"><header className="demo-topbar"><div><button className="demo-mobile-menu" aria-label="Ouvrir la navigation" onClick={() => setMenuOpen(true)}><Menu size={21} /></button><span>Administration</span><ChevronRight size={13} /><strong>{active.label}</strong></div><span className="demo-year">Année scolaire <b>2026–2027</b></span><span className="demo-user">AD</span></header>
        <main className="demo-main"><div className="demo-page-heading"><div><p>ÉTABLISSEMENT HORIZON</p><h1>{active.label}</h1><span>{module === 'accueil' ? 'Les informations essentielles pour faire le point.' : module === 'notes' ? 'Modifiez une note : les indicateurs sont recalculés automatiquement.' : module === 'paiements' ? 'Testez le suivi des frais. Tous les règlements sont simulés.' : module === 'planning' ? 'Un aperçu des cours de la semaine.' : 'Consultez les dossiers ou ajoutez un élève fictif.'}</span></div>{(module === 'eleves' || module === 'accueil') && <button className="demo-primary" onClick={event => { previousFocus.current = event.currentTarget; setAddOpen(true); }}><Plus size={16} /> Ajouter un élève</button>}</div>
          <div className="demo-stat-grid"><article><p>Élèves inscrits</p><strong>{students.length.toString().padStart(2, '0')}</strong><span>{classes.length} classes dans la démonstration</span></article><article><p>Moyenne des notes saisies</p><strong>{average}<small> / 20</small></strong><span>{graded.length} évaluation{graded.length > 1 ? 's' : ''} renseignée{graded.length > 1 ? 's' : ''}</span></article><article><p>Frais réglés</p><strong>{totalDue ? Math.round(totalPaid / totalDue * 100) : 0}<small> %</small></strong><span>{money(totalPaid)} sur {money(totalDue)}</span></article></div>
          {notice && <p className="demo-notice" role="status"><Check size={15} />{notice}<button aria-label="Fermer le message" onClick={() => setNotice('')}><X size={15} /></button></p>}
          {module === 'planning' ? <section className="demo-panel"><div className="demo-panel-heading"><div><h2>Les cours de la semaine</h2><p>9 – 13 novembre 2026 · Exemple d’emploi du temps</p></div><select aria-label="Filtrer le planning par classe" value={classe} onChange={event => setClasse(event.target.value)}><option value="all">Toutes les classes</option>{classes.map(value => <option key={value}>{value}</option>)}</select></div><div className="demo-sessions">{sessions.filter(session => classe === 'all' || session.classe === classe).map((session, index) => <article key={index}><div><strong>{session.day}</strong><span>{session.time}</span></div><div><h3>{session.subject}</h3><p>{session.classe} · {session.teacher}</p></div><span>{session.room}</span></article>)}</div></section> : <section className="demo-panel"><div className="demo-panel-heading"><div><h2>{module === 'notes' ? 'Évaluations · Mathématiques' : module === 'paiements' ? 'Suivi des frais de scolarité' : module === 'accueil' ? 'Les derniers dossiers' : 'Tous les élèves'}</h2><p>{module === 'notes' ? 'Exemple de contrôle · saisie de 0 à 20' : `${filtered.length} dossier${filtered.length > 1 ? 's' : ''} disponible${filtered.length > 1 ? 's' : ''}`}</p></div>{module === 'accueil' && <button className="demo-inline-link" onClick={() => switchModule('eleves')}>Tous les élèves <ArrowRight size={14} /></button>}</div><div className="demo-filters"><label className="demo-search"><Search size={16} /><input type="search" aria-label="Rechercher un élève" placeholder="Rechercher un nom, un matricule…" value={query} onChange={event => setQuery(event.target.value)} /></label><select aria-label="Filtrer par classe" value={classe} onChange={event => setClasse(event.target.value)}><option value="all">Toutes les classes</option>{classes.map(value => <option key={value}>{value}</option>)}</select></div>{roster(module === 'accueil')}</section>}
          {module === 'accueil' && <div className="demo-overview-bottom"><section className="demo-panel"><div className="demo-panel-heading"><div><h2>Prochains cours</h2><p>Quelques repères dans la semaine</p></div><CalendarDays size={20} /></div><div className="demo-upcoming">{sessions.slice(0, 3).map(session => <div key={session.subject}><time>{session.day}<span>{session.time.split(' – ')[0]}</span></time><div><strong>{session.subject}</strong><span>{session.classe} · {session.room}</span></div></div>)}</div><button className="demo-inline-link demo-bottom-link" onClick={() => switchModule('planning')}>Tout le planning <ArrowRight size={14} /></button></section><section className="demo-panel demo-help"><span className="demo-help-icon"><BookOpen size={25} strokeWidth={1.4} /></span><h2>Faites le tour.</h2><p>Ajoutez un dossier fictif, modifiez une note ou simulez un règlement. Vos essais restent dans ce navigateur.</p><button className="demo-primary" onClick={() => switchModule('notes')}>Essayer la saisie des notes <ArrowRight size={15} /></button></section></div>}
          <footer className="demo-footnote"><span>RectorPlus · Espace de démonstration</span><Link to="/">Découvrir la plateforme <ArrowRight size={13} /></Link></footer>
        </main>
      </div>
    </div>
    {addOpen && <div className="demo-modal-backdrop" onClick={event => { if (event.target === event.currentTarget) setAddOpen(false); }}><section role="dialog" aria-modal="true" aria-labelledby="demo-add-title" className="demo-modal" onKeyDown={event => { if (event.key === 'Escape') setAddOpen(false); }}><button className="demo-modal-close" aria-label="Fermer le formulaire" onClick={() => setAddOpen(false)}><X size={20} /></button><p className="demo-nav-label">DÉMONSTRATION</p><h2 id="demo-add-title">Ajouter un élève fictif</h2><p>Ce dossier est enregistré uniquement dans votre navigateur.</p><form onSubmit={event => { event.preventDefault(); if (!name.trim()) return; const next = [...students, { id: `EH-${crypto.randomUUID().slice(0, 6).toUpperCase()}`, name: name.trim(), classe: newClasse, grade: null, due: 0, paid: 0, dossierComplete: false }]; persist(next, `Le dossier de ${name.trim()} a été ajouté à la démonstration.`); setName(''); setClasse('all'); setAddOpen(false); switchModule('eleves'); setNotice('Élève fictif ajouté. Aucun compte réel n’a été créé.'); }}><label>Nom complet<input autoFocus required maxLength={100} value={name} onChange={event => setName(event.target.value)} placeholder="Ex. Camille Dupont" /></label><label>Classe<select value={newClasse} onChange={event => setNewClasse(event.target.value)}>{classes.map(value => <option key={value}>{value}</option>)}</select></label><div className="demo-modal-actions"><button type="button" onClick={() => setAddOpen(false)}>Annuler</button><button type="submit" className="demo-primary"><Plus size={15} /> Ajouter le dossier</button></div></form></section></div>}
    <Link to="/" className="demo-accessible-back"><ArrowLeft size={14} /> Site RectorPlus</Link>
  </div>;
}
