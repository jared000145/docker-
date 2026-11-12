import {useSubscription} from '@/hooks/useSubscription';
import {SubscriptionExpiredScreen} from '@/components/admin/SubscriptionExpiredScreen';
import {useSuperAdmin} from '@/hooks/useSuperAdmin';
import {CampusProvider} from '@/hooks/useCampus';
import PageTransition from '@/components/PageTransition';
import {SidebarProvider,SidebarInset} from '@/components/ui/sidebar';
import {DirectorSidebar} from '@/components/DirectorSidebar';
import {AcademicYearProvider} from '@/hooks/useAcademicYear';
import DirectorHeader from '@/components/director-header';
import '@/styles/director.css';
export default function DirectorLayout(){const{isExpired,isLoading}=useSubscription(),{isSuperAdmin}=useSuperAdmin();if(!isLoading&&isExpired&&!isSuperAdmin)return <SubscriptionExpiredScreen/>;return <AcademicYearProvider><CampusProvider><SidebarProvider><div className="director-workspace app-shell min-h-svh flex w-full overflow-x-hidden"><DirectorSidebar/><SidebarInset className="director-inset flex-1"><DirectorHeader/><main className="director-main flex-1 min-w-0"><PageTransition/></main></SidebarInset></div></SidebarProvider></CampusProvider></AcademicYearProvider>;}
