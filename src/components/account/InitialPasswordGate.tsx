import {type ReactNode} from 'react';
import {useAuth} from '@/hooks/useAuth';
import {GraduationCap,LogOut} from 'lucide-react';
import {Button} from '@/components/ui/button';
import PasswordChangeForm from './PasswordChangeForm';
export default function InitialPasswordGate({children}:{children:ReactNode}){
 const {user,signOut}=useAuth();
 if(user?.app_metadata?.must_change_password!==true)return <>{children}</>;
 return <main className="app-shell min-h-svh px-4 py-10"><div className="mx-auto max-w-xl space-y-6"><header className="flex justify-between items-center"><span className="flex gap-2 items-center font-semibold"><GraduationCap/>RectorPlus</span><Button variant="ghost" onClick={()=>void signOut()}><LogOut/>Se déconnecter</Button></header><PasswordChangeForm initial/></div></main>;
}
