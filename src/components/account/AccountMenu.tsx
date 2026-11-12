import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, LogOut, UserRound } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

export default function AccountMenu({role='Mon espace', sidebar=false}: {role?:string;sidebar?:boolean}) {
  const {profile,signOut}=useAuth();
  const location=useLocation();const navigate=useNavigate();
  const name=[profile?.first_name,profile?.last_name].filter(Boolean).join(' ')||'Mon compte';
  const initials=(profile?.first_name?.[0]||'')+(profile?.last_name?.[0]||'');
  return <DropdownMenu><DropdownMenuTrigger asChild><button type="button" className={sidebar?'account-menu account-menu-sidebar':'account-menu'} aria-label={`Ouvrir le compte de ${name}`}>
    <Avatar className="h-10 w-10 border-2 border-white/80 shadow-sm"><AvatarImage src={profile?.avatar_url||undefined} alt={name} /><AvatarFallback className="bg-blue-100 text-blue-700 font-semibold">{initials.toUpperCase()||'U'}</AvatarFallback></Avatar>
    <span className={sidebar?'min-w-0 flex-1 text-left':'hidden min-w-0 max-w-44 text-left md:block'}><strong className="block truncate text-sm">{name}</strong><span className="block truncate text-xs opacity-70">{role}</span></span><ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
  </button></DropdownMenuTrigger><DropdownMenuContent align={sidebar?'start':'end'} className="account-dropdown w-64">
    <DropdownMenuLabel><span className="block truncate">{name}</span><span className="block truncate text-xs font-normal text-muted-foreground">{role}</span></DropdownMenuLabel><DropdownMenuSeparator />
    <DropdownMenuItem asChild><Link to="/account" state={{returnTo:location.pathname+location.search}}><UserRound className="mr-2 h-4 w-4" />Mon compte et ma photo</Link></DropdownMenuItem>
    <DropdownMenuSeparator /><DropdownMenuItem onSelect={()=>void signOut().then(()=>navigate('/login',{replace:true})).catch(()=>toast.error('Déconnexion impossible. Réessayez.'))}><LogOut className="mr-2 h-4 w-4" />Se déconnecter</DropdownMenuItem>
  </DropdownMenuContent></DropdownMenu>;
}
