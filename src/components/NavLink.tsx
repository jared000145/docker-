import { NavLink as RouterNavLink, NavLinkProps } from "react-router-dom";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/components/ui/sidebar";

interface NavLinkCompatProps extends Omit<NavLinkProps, "className"> {
  className?: string;
  activeClassName?: string;
  pendingClassName?: string;
}

const NavLink = forwardRef<HTMLAnchorElement, NavLinkCompatProps>(
  ({ className, activeClassName, pendingClassName, to, onClick, ...props }, ref) => {
    // Safely access sidebar context (may be absent on pages without SidebarProvider)
    let setOpenMobile: ((open: boolean) => void) | undefined;
    let isMobile = false;
    try {
      const ctx = useSidebar();
      setOpenMobile = ctx.setOpenMobile;
      isMobile = ctx.isMobile;
    } catch {
      // not inside a sidebar provider — ignore
    }

    return (
      <RouterNavLink
        ref={ref}
        to={to}
        onClick={(e) => {
          if (isMobile && setOpenMobile) setOpenMobile(false);
          onClick?.(e);
        }}
        className={({ isActive, isPending }) =>
          cn(className, isActive && activeClassName, isPending && pendingClassName)
        }
        {...props}
      />
    );
  },
);

NavLink.displayName = "NavLink";

export { NavLink };
