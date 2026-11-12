import AccountMenu from '@/components/account/AccountMenu';
import PageTransition from "@/components/PageTransition";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { ParentSidebar } from "@/components/ParentSidebar";
import { useParent } from "@/hooks/useParent";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEffect, useState, createContext, useContext } from "react";
import { useSubscription } from "@/hooks/useSubscription";
import { SubscriptionExpiredScreen } from "@/components/admin/SubscriptionExpiredScreen";

type Ctx = { selectedChildId: string | null; setSelectedChildId: (v: string) => void; children: any[] };
const ParentCtx = createContext<Ctx>({ selectedChildId: null, setSelectedChildId: () => {}, children: [] });
export const useParentContext = () => useContext(ParentCtx);

const ParentLayout = () => {

  const { children } = useParent();
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const { isExpired, isLoading: subLoading } = useSubscription();

  useEffect(() => {
    if (!children.some((child: any) => child.user_id === selectedChildId)) {
      setSelectedChildId(children[0]?.user_id || null);
    }
  }, [children, selectedChildId]);

  if (!subLoading && isExpired) return <SubscriptionExpiredScreen />;


  return (
    <ParentCtx.Provider value={{ selectedChildId, setSelectedChildId, children }}>
      <SidebarProvider>
        <div className="app-shell min-h-svh flex w-full overflow-x-hidden">
          <ParentSidebar />
          <div className="flex-1 flex flex-col min-w-0">
            <header className="app-header min-h-16 flex items-center justify-between gap-2 px-3 py-2 sm:px-4 lg:px-6 sticky top-0 z-10">
              <div className="flex min-w-0 items-center gap-3 flex-1">
                <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
                {children.length > 1 && (
                  <Select value={selectedChildId ?? ""} onValueChange={setSelectedChildId}>
                    <SelectTrigger className="w-[220px]"><SelectValue placeholder="Choisir un enfant" /></SelectTrigger>
                    <SelectContent>
                      {children.map((c: any) => (
                        <SelectItem key={c.user_id} value={c.user_id}>
                          {c.first_name} {c.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {children.length === 1 && (
                  <span className="text-sm font-medium text-muted-foreground truncate">
                    Suivi de {(children[0] as any).first_name} {(children[0] as any).last_name}
                  </span>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <AccountMenu role="Parent" />
              </div>
            </header>
            <main className="app-surface flex-1 min-w-0 overflow-x-hidden overflow-y-auto p-3 sm:p-4 lg:p-6">
              <PageTransition />
            </main>
          </div>
        </div>
      </SidebarProvider>
    </ParentCtx.Provider>
  );
};

export default ParentLayout;
