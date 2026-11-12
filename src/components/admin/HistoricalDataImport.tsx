import StudentSpreadsheetImport from './StudentSpreadsheetImport';
import {downloadInstitutionTemplate} from '@/lib/institutionData';
import {Button} from '@/components/ui/button';
import {Download} from 'lucide-react';
export default function HistoricalDataImport({institutionId,onImportComplete}:{institutionId:string;onImportComplete:()=>void}){
 return <div className="space-y-6"><StudentSpreadsheetImport institutionId={institutionId} onImportComplete={onImportComplete}/><div className="rounded-xl border p-5 space-y-3"><h2 className="font-semibold">Reprise des données d’un établissement</h2><p className="text-sm text-muted-foreground">Pour les matières, notes, paiements et présences, remplissez les feuilles utiles du modèle puis transmettez-le au super administrateur. L’import est analysé et appliqué dans l’espace de migration de l’établissement.</p><Button variant="outline" onClick={downloadInstitutionTemplate}><Download className="h-4 w-4 mr-2"/>Télécharger le modèle de données</Button></div></div>;
}
