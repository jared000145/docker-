import PasswordChangeForm from '@/components/account/PasswordChangeForm';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { ArrowLeft, GraduationCap, UserRound } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import AccountMenu from '@/components/account/AccountMenu';
import ProfilePhotoEditor from '@/components/account/ProfilePhotoEditor';
import FullScreenLoader from '@/components/loading/FullScreenLoader';
import {safeNextPath} from '@/lib/authRouting';

export default function AccountPage(){
 const {user,profile,loading}=useAuth();const location=useLocation();
 if(loading)return <FullScreenLoader />;
 if(!user)return <Navigate to="/login?next=%2Faccount&mode=email" replace />;
 const previous=safeNextPath((location.state as {returnTo?:string}|null)?.returnTo||null);
 return <div className="app-shell account-page min-h-svh"><header className="app-header flex items-center justify-between gap-4 px-5 py-3 md:px-10"><Link to="/login" className="flex items-center gap-3 font-heading text-lg font-bold"><GraduationCap className="h-8 w-8 text-primary" />RectorPlus</Link><AccountMenu role="Mon compte" /></header><main className="mx-auto max-w-5xl space-y-6 px-4 py-8 md:px-8"><Link to={previous&&previous!=='/account'?previous:'/login'} className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground"><ArrowLeft className="h-4 w-4" />Retour à mon espace</Link><div className="account-page-title"><span className="account-icon"><UserRound /></span><div><h1>Mon compte</h1><p>Personnalisez votre profil RectorPlus.</p></div></div><ProfilePhotoEditor /><PasswordChangeForm/><section className="account-panel"><h2 className="mb-5 font-heading text-lg font-semibold">Informations du compte</h2><dl className="grid gap-5 sm:grid-cols-2">{[['Prénom',profile?.first_name],['Nom',profile?.last_name],['Adresse email',profile?.email],['Téléphone',profile?.phone]].map(([label,value])=><div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 break-words text-sm font-medium">{value||'Non renseigné'}</dd></div>)}</dl><p className="mt-6 text-xs text-muted-foreground">Les informations administratives sont gérées par votre établissement.</p></section></main></div>;
}
