
'use client';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  LayoutDashboard,
  Users,
  Network,
  Package,
  ArrowRightLeft,
  Map,
  CreditCard,
  IndianRupee,
  MessageSquareWarning,
  UserPlus,
  Megaphone,
  LogOut,
  Calculator,
  BellRing,
  Shield,
  Wallet,
  History,
  Tv,
  Store,
  ShoppingBag,
  Send,
  Gift,
  Notebook,
  GitBranch,
  Loader2,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, userRole, shopName, userStatus, loading: authLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const { isMobile, setOpenMobile } = useSidebar();
  const [isOnline, setIsOnline] = useState<boolean>(true);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsOnline(navigator.onLine);
      const handleOnline = () => {
        setIsOnline(true);
        toast({
          title: "🌐 Online Mode Restored",
          description: "Reconnected to internet. Syncing local offline updates to cloud...",
        });
      };
      const handleOffline = () => {
        setIsOnline(false);
        toast({
          variant: "destructive",
          title: "⚡ Offline Mode Active",
          description: "Working offline. Customer data & collections are stored in local offline cache.",
        });
      };

      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);
      return () => {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      };
    }
  }, [toast]);

  useEffect(() => {
    if (authLoading) return;

    // 1. Mandatory Authentication Guard: Redirect unauthenticated users
    if (!user) {
      toast({
        variant: "destructive",
        title: "Authentication Required",
        description: "Please log in to access the dashboard.",
      });
      router.push('/login');
      return;
    }

    // 2. Inactive Account Guard
    if (userStatus === 'inactive' && pathname !== '/dashboard') {
      toast({
        variant: "destructive",
        title: "Account Inactive",
        description: "Your account is inactive. Please settle your balance with Admin.",
      });
      router.push('/dashboard');
      return;
    }

    // 3. Role-Based Authorization Guard for Admin-only routes
    const adminOnlyRoutes = [
      '/dashboard/staff',
      '/dashboard/roles',
      '/dashboard/dishtv-dealers',
      '/dashboard/dishtv-retailers',
      '/dashboard/staff-wallets',
      '/dashboard/packages',
      '/dashboard/areas',
      '/dashboard/offers',
      '/dashboard/announcements',
      '/dashboard/business-directory',
      '/dashboard/mso-payments',
    ];

    const isAdminRoute = adminOnlyRoutes.some((route) =>
      pathname === route || pathname?.startsWith(route + '/')
    );

    if (isAdminRoute && userRole && userRole !== 'Admin') {
      toast({
        variant: "destructive",
        title: "Access Denied",
        description: "You do not have administrative permission to view this page.",
      });
      router.push('/dashboard');
    }
  }, [user, userRole, userStatus, authLoading, pathname, router, toast]);

  // Prevent unhandled promise rejections with Event objects from throwing [object Event] error overlay
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (
        !event.reason ||
        event.reason instanceof Event ||
        (typeof event.reason === "object" && ("type" in event.reason || "target" in event.reason))
      ) {
        console.warn("[UnhandledRejection] Intercepted non-critical event rejection:", event.reason);
        event.preventDefault();
      }
    };

    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    return () => {
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, []);

  const handleLinkClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      if (typeof window !== "undefined") {
        localStorage.removeItem("userRole");
        localStorage.removeItem("shopName");
        localStorage.removeItem("userStatus");
      }
      handleLinkClick(); // Close sidebar on logout as well
      router.push('/login');
    } catch (error) {
      console.error("Failed to log out", error);
    }
  };
  
  const isCollectionAgent = userRole ? /collection|collation/i.test(userRole) : false;
  const isNetworkServiceAgent = userRole?.toLowerCase().replace(/\s/g, "") === 'networkserviceagent';
  const isDealer = userRole === 'Dealer';
  const isRetailer = userRole === 'Retailer';

  // 🚫 If viewing Customer Passbook Ledger (/dashboard/customers/history), hide Admin Sidebar
  const isCustomerHistoryPage = pathname?.includes('/customers') && pathname?.includes('/history');

  const isLinkActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === "/dashboard";
    }
    return pathname === href || pathname?.startsWith(href + "/");
  };

  const renderNavItem = (href: string, icon: React.ReactNode, label: string, badge?: string) => {
    const active = isLinkActive(href);
    return (
      <SidebarMenuItem key={href}>
        <SidebarMenuButton
          asChild
          isActive={active}
          onClick={handleLinkClick}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all duration-200 group ${
            active
              ? "bg-gradient-to-r from-red-600/30 via-rose-600/20 to-orange-500/10 text-white font-bold border-l-4 border-red-500 shadow-sm shadow-red-950/50"
              : "text-zinc-300 hover:bg-white/[0.06] hover:text-white font-medium hover:translate-x-0.5"
          }`}
        >
          <Link href={href} className="flex items-center gap-2.5 w-full">
            <div className={`p-1.5 rounded-lg transition-all shrink-0 ${
              active
                ? "bg-gradient-to-tr from-red-600 to-amber-500 text-white shadow-md shadow-red-600/35 ring-1 ring-white/20"
                : "bg-zinc-900/90 text-zinc-400 border border-zinc-800/80 group-hover:text-rose-400 group-hover:border-rose-500/30 group-hover:bg-rose-950/20"
            }`}>
              {icon}
            </div>
            <span className="text-xs sm:text-sm tracking-tight flex-1 truncate">{label}</span>
            {badge && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-gradient-to-r from-red-500/20 to-orange-500/20 text-orange-200 font-extrabold border border-red-500/40 shadow-xs">
                {badge}
              </span>
            )}
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-slate-950 text-white font-body">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
          <p className="text-sm font-semibold text-slate-300">Verifying authentication...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-slate-950 text-white font-body">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
          <p className="text-sm font-semibold text-slate-300">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  if (isCustomerHistoryPage) {
    return <div className="min-h-screen w-full bg-background">{children}</div>;
  }

  return (
    <>
      <Sidebar className="border-r border-rose-950/40 bg-[#0d0709] text-zinc-100 shadow-2xl relative overflow-hidden select-none">
        {/* Ambient DishTV Warm Red/Amber Glow */}
        <div className="absolute top-0 left-0 right-0 h-48 bg-gradient-to-b from-red-600/15 via-orange-600/5 to-transparent pointer-events-none" />
        <div className="absolute -top-12 -left-12 w-36 h-36 rounded-full bg-red-600/20 blur-3xl pointer-events-none" />

        <SidebarHeader className="p-3 border-b border-rose-950/40 bg-[#0e0709]/80 backdrop-blur-md relative z-10">
          <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-gradient-to-r from-red-950/40 via-neutral-900/90 to-zinc-900/90 border border-red-500/25 shadow-lg shadow-black/40 backdrop-blur-md">
            <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-tr from-red-600 via-rose-500 to-amber-500 shadow-md shadow-red-600/35 text-white shrink-0 ring-1 ring-white/20">
              <Tv className="h-5 w-5 text-white" />
              <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 border-2 border-[#0e0709] animate-pulse" />
            </div>
            <div className="flex flex-col leading-tight overflow-hidden">
              <span className="text-sm font-black tracking-tight text-white truncate" title={shopName || "Navanidhi Digital"}>
                {shopName || "Navanidhi Digital"}
              </span>
              <span className="text-[10px] font-extrabold bg-gradient-to-r from-rose-400 via-orange-400 to-amber-300 bg-clip-text text-transparent flex items-center gap-1 uppercase tracking-wider">
                {userRole === "Retailer" ? "DishTV Retailer Portal" : userRole === "Dealer" ? "DishTV Dealer Portal" : "Official dish/tv Partner"}
              </span>
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent className="px-2 py-3 space-y-4 relative z-10">
          {/* GROUP 1: OVERVIEW */}
          <SidebarGroup className="p-0">
            <SidebarGroupLabel className="px-3 text-[10px] font-black uppercase tracking-widest text-rose-300/60 mb-1 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500/70" />
              Overview
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {renderNavItem("/dashboard", <LayoutDashboard className="h-4 w-4" />, "Dashboard")}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* GROUP 2: STAFF / DEALER / RETAILER OPERATIONS */}
          {!authLoading && userRole && userRole !== "Admin" && userStatus !== "inactive" && (
            <SidebarGroup className="p-0">
              <SidebarGroupLabel className="px-3 text-[10px] font-black uppercase tracking-widest text-rose-300/60 mb-1 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500/70" />
                Operations & Services
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {isRetailer ? (
                    <>
                      {renderNavItem("/dashboard/marketplace", <ShoppingBag className="h-4 w-4" />, "Marketplace")}
                    </>
                  ) : isDealer ? (
                    <>
                      {renderNavItem("/dashboard/dishtv-customers", <Tv className="h-4 w-4" />, "DishTV Customers")}
                      {renderNavItem("/dashboard/payment-collections", <CreditCard className="h-4 w-4" />, "Payment Collection")}
                      {renderNavItem("/dashboard/marketplace", <ShoppingBag className="h-4 w-4" />, "Marketplace")}
                    </>
                  ) : (
                    <>
                      {!isCollectionAgent && (
                        <>
                          {renderNavItem("/dashboard/customers-staff", <Users className="h-4 w-4" />, "Customers")}
                          {renderNavItem("/dashboard/request-recharge", <Send className="h-4 w-4" />, "Recharge Requests")}
                        </>
                      )}
                      {renderNavItem("/dashboard/payments-collections", <IndianRupee className="h-4 w-4" />, "Payments Collections")}
                      {renderNavItem("/dashboard/my-collection-history", <History className="h-4 w-4" />, "My Collection History")}
                      {renderNavItem("/dashboard/reminders-staff", <BellRing className="h-4 w-4" />, "Reminders")}
                      {renderNavItem("/dashboard/complaints-staff", <MessageSquareWarning className="h-4 w-4" />, "Complaints Management")}
                      {renderNavItem("/dashboard/marketplace", <ShoppingBag className="h-4 w-4" />, "Marketplace")}
                    </>
                  )}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}

          {/* GROUP 3: ADMIN MANAGEMENT */}
          {!authLoading && userRole === "Admin" && (
            <>
              <SidebarGroup className="p-0">
                <SidebarGroupLabel className="px-3 text-[10px] font-black uppercase tracking-widest text-rose-300/60 mb-1 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500/70" />
                  Customer Operations
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {renderNavItem("/dashboard/customers", <Users className="h-4 w-4" />, "Customers")}
                    {renderNavItem("/dashboard/dishtv-customers", <Tv className="h-4 w-4" />, "DishTV Customers")}
                    {renderNavItem("/dashboard/transactions", <History className="h-4 w-4" />, "Transactions")}
                    {renderNavItem("/dashboard/collection", <IndianRupee className="h-4 w-4" />, "Collection")}
                    {renderNavItem("/dashboard/reminders", <BellRing className="h-4 w-4" />, "Reminders")}
                    {renderNavItem("/dashboard/complaints-staff", <MessageSquareWarning className="h-4 w-4" />, "Complaints Management")}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>

              <SidebarGroup className="p-0">
                <SidebarGroupLabel className="px-3 text-[10px] font-black uppercase tracking-widest text-rose-300/60 mb-1 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500/70" />
                  Network & Management
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {renderNavItem("/dashboard/dishtv-dealers", <Store className="h-4 w-4" />, "DishTV Dealers")}
                    {renderNavItem("/dashboard/dishtv-retailers", <ShoppingBag className="h-4 w-4" />, "DishTV Retailers")}
                    {renderNavItem("/dashboard/staff", <UserPlus className="h-4 w-4" />, "Staff")}
                    {renderNavItem("/dashboard/roles", <Shield className="h-4 w-4" />, "Roles")}
                    {renderNavItem("/dashboard/staff-wallets", <Wallet className="h-4 w-4" />, "Staff Wallets")}
                    {renderNavItem("/dashboard/packages", <Package className="h-4 w-4" />, "Packages")}
                    {renderNavItem("/dashboard/areas", <Map className="h-4 w-4" />, "Areas")}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>

              <SidebarGroup className="p-0">
                <SidebarGroupLabel className="px-3 text-[10px] font-black uppercase tracking-widest text-rose-300/60 mb-1 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500/70" />
                  Offers & Directory
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {renderNavItem("/dashboard/marketplace", <ShoppingBag className="h-4 w-4" />, "Marketplace")}
                    {renderNavItem("/dashboard/offers", <Megaphone className="h-4 w-4" />, "Offers")}
                    {renderNavItem("/dashboard/announcements", <Megaphone className="h-4 w-4" />, "Announcements")}
                    {renderNavItem("/dashboard/business-directory", <Store className="h-4 w-4" />, "Local Business Directory")}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </>
          )}
        </SidebarContent>

        <SidebarFooter className="p-3 pb-20 sm:pb-12 border-t border-rose-950/40 mt-auto bg-[#0a0507]/90 backdrop-blur-md relative z-10">
          <SidebarMenu>
            <SidebarMenuItem>
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-red-950/50 to-neutral-950/70 hover:from-red-900/50 hover:to-rose-950/50 border border-red-500/30 text-rose-200 font-bold text-xs transition-all shadow-sm hover:shadow-red-950/40 group cursor-pointer active:scale-[0.98]"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-1 rounded-lg bg-red-500/20 text-red-400 group-hover:bg-red-500 group-hover:text-white transition-colors">
                    <LogOut className="h-3.5 w-3.5 group-hover:scale-110 transition-transform" />
                  </div>
                  <span className="group-hover:text-white transition-colors">Logout</span>
                </div>
                <span className="text-[10px] bg-gradient-to-r from-red-600 to-orange-600 text-white font-black px-2 py-0.5 rounded-md shadow-xs shadow-red-600/30 uppercase tracking-wider">
                  Exit
                </span>
              </button>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        {!isOnline && (
          <div className="bg-amber-500/20 border-b border-amber-500/40 text-amber-300 text-xs px-4 py-2 flex items-center justify-between font-bold backdrop-blur-md">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400 animate-ping" />
              <span>⚡ Working Offline • No Internet Connection (Data saved locally)</span>
            </div>
            <span className="text-[10px] bg-amber-500/30 px-2.5 py-0.5 rounded-md text-amber-200 border border-amber-500/40">
              Offline Cache Active
            </span>
          </div>
        )}
        <div className="flex h-14 items-center border-b p-2 md:hidden">
            <SidebarTrigger />
        </div>
        {children}
      </SidebarInset>
    </>
  );
}

export default function WithSidebarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <DashboardLayout>{children}</DashboardLayout>
    </SidebarProvider>
  );
}
