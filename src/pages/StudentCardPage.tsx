import {useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import {useQuery} from '@tanstack/react-query';
import QRCode from 'qrcode';
import {GraduationCap,ShieldCheck,Camera,ExternalLink,Building2,ScanLine} from 'lucide-react';
import {useAuth} from '@/hooks/useAuth';
import {useInstitution} from '@/hooks/useInstitution';
import {useAcademicYear} from '@/hooks/useAcademicYear';
import {useStudentPlacement} from '@/hooks/useStudentPlacement';
import {useProfilePhoto} from '@/hooks/useProfilePhoto';
import {supabase} from '@/integrations/supabase/client';
import {AcademicYearSelector} from '@/components/AcademicYearSelector';
import {Button} from '@/components/ui/button';
import {verificationUrl} from '@/lib/documentVerification';
export default function StudentCardPage(){
 const{profile,user}=useAuth(),{institution}=useInstitution(),{selectedYear,currentYear}=useAcademicYear(),{placement,isSchool}=useStudentPlacement(undefined,selectedYear);
 const photo=useProfilePhoto(profile?.avatar_url),[qr,setQr]=useState('');
 const card=useQuery({queryKey:['student-card',user?.id,selectedYear],enabled:!!user&&!!selectedYear,queryFn:async()=>{const{data,error}=await(supabase as any).rpc('issue_student_card',{_year:selectedYear});if(error)throw error;return data as string;}});
 useEffect(()=>{let alive=true;setQr('');if(card.data)void QRCode.toDataURL(verificationUrl(card.data,'card'),{width:256,margin:2,errorCorrectionLevel:'M'}).then(url=>{if(alive)setQr(url);});return()=>{alive=false;};},[card.data]);
 const name=[profile?.first_name,profile?.last_name].filter(Boolean).join(' '),className=placement?.classes?.nom||placement?.niveau||profile?.level;
 return <div className="identity-workspace"><header className="flex flex-wrap items-center justify-between gap-4"><div><span className="workspace-eyebrow">Identité numérique</span><h1>Ma carte {isSchool?'scolaire':'étudiante'}</h1><p>Votre identité et votre inscription, réunies dans une carte vérifiable.</p></div><AcademicYearSelector/></header><div className="identity-layout"><section><article className="digital-student-card" aria-label="Carte scolaire virtuelle"><div className="identity-card-grid"/><header><div className="flex gap-3 items-center">{institution?.logo_url?<img src={institution.logo_url} alt="Logo"/>:<GraduationCap/>}<div><strong>{institution?.name||'RectorPlus'}</strong><span>Carte {isSchool?'scolaire':'étudiante'}</span></div></div><span className="identity-card-year">{selectedYear}</span></header><main><div className="identity-photo">{photo?<img src={photo} alt={`Photo de profil de ${name}`}/>:<div><Camera/><span>Photo à ajouter</span></div>}</div><div className="identity-card-person"><span>{isSchool?'Élève':'Étudiant'}</span><h2>{name}</h2><p>{profile?.student_number||'Matricule non renseigné'}</p><strong>{className||'Classe à renseigner'}</strong></div></main><footer><div><span>Inscription {selectedYear===currentYear?'de l’année en cours':'archivée'}</span><strong><ShieldCheck/>Contrôle par QR code</strong></div><div className="identity-qr">{qr?<img src={qr} alt="QR code de vérification de la carte"/>:<ScanLine/>}</div></footer></article><p className="text-xs text-muted-foreground mt-4">Le statut est contrôlé en ligne lors du scan. Cette carte ne présente pas vos notes ni votre situation financière.</p></section><aside className="identity-card-information"><span className="workspace-icon"><ShieldCheck/></span><h2>Une carte reliée à votre inscription</h2><p>Le QR code ouvre une page de confirmation avec votre établissement, votre identité, votre classe et l’année concernée.</p><dl><div><dt><Building2/>Établissement</dt><dd>{institution?.name}</dd></div><div><dt>Année</dt><dd>{selectedYear}</dd></div><div><dt>Classe / niveau</dt><dd>{className||'Non renseigné'}</dd></div></dl>{!photo&&<Button variant="outline" asChild><Link to="/settings"><Camera/>Ajouter ma photo</Link></Button>}{card.data&&<Button variant="outline" asChild><a href={verificationUrl(card.data,'card')} target="_blank" rel="noreferrer"><ExternalLink/>Vérifier ma carte</a></Button>}{card.isError&&<p role="alert" className="text-sm text-destructive">La référence de carte n’est pas disponible. Vérifiez votre inscription auprès de la scolarité.</p>}</aside></div></div>;
}
