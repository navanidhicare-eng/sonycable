
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
  const { userRole, shopName, userStatus, loading: authLoading } = useAuth();
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
    if (!authLoading && userStatus === 'inactive' && pathname !== '/dashboard') {
      toast({
        variant: "destructive",
        title: "Account Inactive",
        description: "Your account is inactive. Please settle your balance with Admin.",
      });
      router.push('/dashboard');
    }
  }, [authLoading, userStatus, pathname, router, toast]);

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
          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all duration-200 ${
            active
              ? "bg-gradient-to-r from-orange-500/25 via-amber-500/15 to-orange-500/5 text-orange-400 font-extrabold border-l-4 border-orange-500 shadow-xs"
              : "text-slate-300 hover:bg-slate-800/60 hover:text-white font-medium"
          }`}
        >
          <Link href={href} className="flex items-center gap-2.5 w-full">
            <div className={`p-1.5 rounded-lg transition-colors shrink-0 ${
              active
                ? "bg-orange-500/20 text-orange-400"
                : "bg-slate-800/80 text-slate-400 group-hover:text-white"
            }`}>
              {icon}
            </div>
            <span className="text-xs sm:text-sm tracking-tight flex-1 truncate">{label}</span>
            {badge && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-orange-500/20 text-orange-300 font-bold border border-orange-500/30">
                {badge}
              </span>
            )}
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  if (isCustomerHistoryPage) {
    return <div className="min-h-screen w-full bg-background">{children}</div>;
  }

  return (
    <>
      <Sidebar className="border-r border-slate-800/80 bg-slate-950 text-slate-100">
        <SidebarHeader className="p-3 border-b border-slate-800/80">
          <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-slate-900/90 border border-slate-800/80 shadow-md">
            <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-600 via-orange-500 to-red-600 shadow-md text-white shrink-0">
              <Tv className="h-5 w-5 text-white" />
              <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 border-2 border-slate-900 animate-pulse" />
            </div>
            <div className="flex flex-col leading-tight overflow-hidden">
              <span className="text-sm font-black tracking-tight text-slate-100 dark:text-white truncate" title={shopName || "Navanidhi Digital"}>
                {shopName || "Navanidhi Digital"}
              </span>
              <span className="text-[10px] font-extrabold text-orange-400 flex items-center gap-1">
                {userRole === "Retailer" ? "DishTV Retailer Portal" : userRole === "Dealer" ? "DishTV Dealer Portal" : "Official dish/tv Partner"}
              </span>
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent className="px-2 py-3 space-y-4">
          {/* GROUP 1: OVERVIEW */}
          <SidebarGroup className="p-0">
            <SidebarGroupLabel className="px-3 text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
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
              <SidebarGroupLabel className="px-3 text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                Operations & Services
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {isRetailer ? (
                    <>
                      {renderNavItem("/dashboard/recharge-offers", <Gift className="h-4 w-4" />, "Recharge Offers")}
                      {renderNavItem("/dashboard/new-connection-offers", <Tv className="h-4 w-4" />, "New Connection Offers")}
                      {renderNavItem("/dashboard/retailer-commission", <IndianRupee className="h-4 w-4" />, "Retailer Commission")}
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
                          {!isNetworkServiceAgent && renderNavItem("/dashboard/recharge", <CreditCard className="h-4 w-4" />, "Recharge")}
                          {renderNavItem("/dashboard/request-recharge", <Send className="h-4 w-4" />, "Recharge Requests")}
                        </>
                      )}
                      {renderNavItem("/dashboard/payments-collections", <IndianRupee className="h-4 w-4" />, "Payments Collections")}
                      {renderNavItem("/dashboard/my-collection-history", <History className="h-4 w-4" />, "My Collection History")}
                      {renderNavItem("/dashboard/reminders-staff", <BellRing className="h-4 w-4" />, "Reminders")}
                      {renderNavItem("/dashboard/recharge-offers", <Gift className="h-4 w-4" />, "Recharge Offers")}
                      {renderNavItem("/dashboard/new-connection-offers", <Tv className="h-4 w-4" />, "New Connection Offers")}
                      {renderNavItem("/dashboard/retailer-commission", <IndianRupee className="h-4 w-4" />, "Retailer Commission")}
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
                <SidebarGroupLabel className="px-3 text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                  Customer Operations
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {renderNavItem("/dashboard/customers", <Users className="h-4 w-4" />, "Customers")}
                    {renderNavItem("/dashboard/dishtv-customers", <Tv className="h-4 w-4" />, "DishTV Customers")}
                    {renderNavItem("/dashboard/recharge", <CreditCard className="h-4 w-4" />, "Recharge")}
                    {renderNavItem("/dashboard/transactions", <History className="h-4 w-4" />, "Transactions")}
                    {renderNavItem("/dashboard/collection", <IndianRupee className="h-4 w-4" />, "Collection")}
                    {renderNavItem("/dashboard/reminders", <BellRing className="h-4 w-4" />, "Reminders")}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>

              <SidebarGroup className="p-0">
                <SidebarGroupLabel className="px-3 text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
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
                <SidebarGroupLabel className="px-3 text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                  Offers & Directory
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {renderNavItem("/dashboard/recharge-offers", <Gift className="h-4 w-4" />, "Recharge Offers")}
                    {renderNavItem("/dashboard/new-connection-offers", <Tv className="h-4 w-4" />, "New Connection Offers")}
                    {renderNavItem("/dashboard/retailer-commission", <IndianRupee className="h-4 w-4" />, "Retailer Commission")}
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

        <SidebarFooter className="p-3 pb-20 sm:pb-12 border-t border-slate-800/80 mt-auto bg-slate-950">
          <SidebarMenu>
            <SidebarMenuItem>
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 font-extrabold text-xs transition-all shadow-xs group cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <LogOut className="h-4 w-4 text-red-400 group-hover:scale-110 transition-transform" />
                  <span>Logout</span>
                </div>
                <span className="text-[10px] bg-red-500/20 px-2 py-0.5 rounded-md text-red-300 uppercase tracking-wider font-bold">
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
              <span>⚡ Working Offline • ఇంటర్నెట్ లేదు (డేటా లోకల్ గా సేవ్ అవుతుంది)</span>
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
