import { ArrowUpRight, BookOpen, FileText, GraduationCap, Wallet } from 'lucide-react';

type Metric = { label: string; value: string; detail: string; tab: string };
export default function DossierOverview({year, school=false, metrics, email, phone, onNavigate}: {
  year:string; school?:boolean; metrics:Metric[]; email?:string|null; phone?:string|null; onNavigate:(tab:string)=>void;
}) {
  const icons=[GraduationCap,BookOpen,Wallet,FileText];
  return <div className="space-y-5">
    <div><h2 className="text-lg font-semibold">Vue d’ensemble du dossier</h2><p className="text-sm text-muted-foreground">{school?'Année scolaire':'Année universitaire'} {year} · Consultez les rubriques pour accéder au détail.</p></div>
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">{metrics.map((metric,i)=>{
      const Icon=icons[i%icons.length];return <button key={metric.label} type="button" onClick={()=>onNavigate(metric.tab)} className="rounded-2xl border bg-card text-left p-4 sm:p-5 shadow-sm hover:border-blue-400 hover:shadow-md transition-all group">
        <div className="flex justify-between items-center mb-4"><span className="rounded-xl bg-blue-50 text-blue-600 p-2.5"><Icon className="size-5"/></span><ArrowUpRight className="size-4 text-muted-foreground group-hover:text-blue-600"/></div>
        <p className="text-sm text-muted-foreground">{metric.label}</p><p className="text-lg sm:text-xl font-semibold mt-1 break-words">{metric.value}</p><p className="text-xs text-muted-foreground mt-2">{metric.detail}</p>
      </button>;
    })}</div>
    <div className="grid lg:grid-cols-2 gap-4">
      <section className="rounded-2xl border bg-card p-5"><h3 className="font-semibold mb-3">Coordonnées de contact</h3><dl className="grid sm:grid-cols-2 gap-4 text-sm"><div><dt className="text-muted-foreground">Email</dt><dd className="mt-1 break-all">{email||'Non renseigné'}</dd></div><div><dt className="text-muted-foreground">Téléphone</dt><dd className="mt-1">{phone||'Non renseigné'}</dd></div></dl></section>
      <section className="rounded-2xl border bg-blue-50/50 p-5"><h3 className="font-semibold mb-2">Un dossier, plusieurs années</h3><p className="text-sm text-muted-foreground">Choisissez une année pour consulter ses notes, ses pièces et ses paiements. Le parcours conserve les anciennes inscriptions, y compris en cas de redoublement.</p><button className="text-sm text-blue-700 font-medium mt-3 inline-flex gap-2 items-center" onClick={()=>onNavigate('parcours')}>Consulter le parcours <ArrowUpRight className="size-4"/></button></section>
    </div>
  </div>;
}
