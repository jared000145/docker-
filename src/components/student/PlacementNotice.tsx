import {AcademicYearSelector} from '@/components/AcademicYearSelector';
export default function PlacementNotice({loading,error}:{loading?:boolean;error?:boolean}){
 return <div className="space-y-4"><AcademicYearSelector/><div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground" role={error?'alert':'status'}>{loading?'Chargement du parcours scolaire…':error?'Le parcours scolaire ne peut pas être chargé. Réessayez dans quelques instants.':'Aucune inscription ne permet d’identifier le parcours pour cette année. Contactez la scolarité.'}</div></div>;
}
