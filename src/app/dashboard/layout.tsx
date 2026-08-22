
'use client';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
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
import { useEffect } from 'react';
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

  return (
    <>
      <Sidebar>
        <SidebarHeader>
          <div className="flex items-center gap-2.5 px-2 py-1">
            <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-600 via-orange-500 to-red-600 shadow-md text-white shrink-0">
              <Tv className="h-4 w-4 text-white" />
            </div>
            <div className="flex flex-col leading-tight overflow-hidden">
              <span className="text-sm font-black tracking-tight text-slate-100 dark:text-white truncate" title={shopName || "Navanidhi Digital"}>
                {shopName || "Navanidhi Digital"}
              </span>
              <span className="text-[10px] font-bold text-orange-500 flex items-center gap-1">
                {userRole === "Retailer" ? "DishTV Retailer Portal" : userRole === "Dealer" ? "DishTV Dealer Portal" : "Official dish/tv Partner"}
              </span>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild onClick={handleLinkClick}>
                <Link href="/dashboard">
                  <LayoutDashboard />
                  <span>Dashboard</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
              {!authLoading && userRole && userRole !== 'Admin' && userStatus !== 'inactive' && (
                <>
                 {isRetailer ? (
                   <>
                     <SidebarMenuItem>
                       <SidebarMenuButton asChild onClick={handleLinkClick}>
                         <Link href="/dashboard/recharge-offers">
                           <Gift />
                           <span>Recharge Offers</span>
                         </Link>
                       </SidebarMenuButton>
                     </SidebarMenuItem>

                     <SidebarMenuItem>
                       <SidebarMenuButton asChild onClick={handleLinkClick}>
                         <Link href="/dashboard/new-connection-offers">
                           <Tv />
                           <span>New Connection Offers</span>
                         </Link>
                       </SidebarMenuButton>
                     </SidebarMenuItem>

                     <SidebarMenuItem>
                       <SidebarMenuButton asChild onClick={handleLinkClick}>
                         <Link href="/dashboard/retailer-commission">
                           <IndianRupee />
                           <span>Retailer Commission</span>
                         </Link>
                       </SidebarMenuButton>
                     </SidebarMenuItem>

                     <SidebarMenuItem>
                       <SidebarMenuButton asChild onClick={handleLinkClick}>
                         <Link href="/dashboard/marketplace">
                           <ShoppingBag />
                           <span>Marketplace</span>
                         </Link>
                       </SidebarMenuButton>
                     </SidebarMenuItem>
                   </>
                 ) : isDealer ? (
                   <>
                     <SidebarMenuItem>
                       <SidebarMenuButton asChild onClick={handleLinkClick}>
                         <Link href="/dashboard/dishtv-customers">
                           <Tv />
                           <span>DishTV Customers</span>
                         </Link>
                       </SidebarMenuButton>
                     </SidebarMenuItem>

                     <SidebarMenuItem>
                       <SidebarMenuButton asChild onClick={handleLinkClick}>
                         <Link href="/dashboard/payment-collections">
                           <CreditCard />
                           <span>Payment Collection</span>
                         </Link>
                       </SidebarMenuButton>
                     </SidebarMenuItem>

                     <SidebarMenuItem>
                       <SidebarMenuButton asChild onClick={handleLinkClick}>
                         <Link href="/dashboard/marketplace">
                           <ShoppingBag />
                           <span>Marketplace</span>
                         </Link>
                       </SidebarMenuButton>
                     </SidebarMenuItem>
                   </>
                 ) : (
                   <>
                     {!isCollectionAgent && (
                       <>
                          <SidebarMenuItem>
                             <SidebarMenuButton asChild onClick={handleLinkClick}>
                                 <Link href="/dashboard/customers-staff">
                                 <Users />
                                 <span>Customers</span>
                                 </Link>
                             </SidebarMenuButton>
                         </SidebarMenuItem>
                         {!isNetworkServiceAgent && (
                             <SidebarMenuItem>
                                 <SidebarMenuButton asChild onClick={handleLinkClick}>
                                     <Link href="/dashboard/recharge">
                                     <CreditCard />
                                     <span>Recharge</span>
                                     </Link>
                                 </SidebarMenuButton>
                             </SidebarMenuItem>
                         )}
                          <SidebarMenuItem>
                             <SidebarMenuButton asChild onClick={handleLinkClick}>
                                 <Link href="/dashboard/request-recharge">
                                     <Send />
                                     <span>Recharge Requests</span>
                                 </Link>
                             </SidebarMenuButton>
                         </SidebarMenuItem>
                       </>
                     )}
                     <SidebarMenuItem>
                         <SidebarMenuButton asChild onClick={handleLinkClick}>
                             <Link href="/dashboard/payments-collections">
                             <IndianRupee />
                             <span>Payments Collections</span>
                             </Link>
                         </SidebarMenuButton>
                     </SidebarMenuItem>
                     <SidebarMenuItem>
                         <SidebarMenuButton asChild onClick={handleLinkClick}>
                             <Link href="/dashboard/my-collection-history">
                             <History />
                             <span>My Collection History</span>
                             </Link>
                         </SidebarMenuButton>
                     </SidebarMenuItem>
                      <SidebarMenuItem>
                         <SidebarMenuButton asChild onClick={handleLinkClick}>
                             <Link href="/dashboard/reminders-staff">
                             <BellRing />
                             <span>Reminders</span>
                             </Link>
                         </SidebarMenuButton>
                     </SidebarMenuItem>

                     <SidebarMenuItem>
                       <SidebarMenuButton asChild onClick={handleLinkClick}>
                         <Link href="/dashboard/recharge-offers">
                           <Gift />
                           <span>Recharge Offers</span>
                         </Link>
                       </SidebarMenuButton>
                     </SidebarMenuItem>

                     <SidebarMenuItem>
                       <SidebarMenuButton asChild onClick={handleLinkClick}>
                         <Link href="/dashboard/new-connection-offers">
                           <Tv />
                           <span>New Connection Offers</span>
                         </Link>
                       </SidebarMenuButton>
                     </SidebarMenuItem>

                     <SidebarMenuItem>
                       <SidebarMenuButton asChild onClick={handleLinkClick}>
                         <Link href="/dashboard/retailer-commission">
                           <IndianRupee />
                           <span>Retailer Commission</span>
                         </Link>
                       </SidebarMenuButton>
                     </SidebarMenuItem>

                     <SidebarMenuItem>
                       <SidebarMenuButton asChild onClick={handleLinkClick}>
                         <Link href="/dashboard/marketplace">
                           <ShoppingBag />
                           <span>Marketplace</span>
                         </Link>
                       </SidebarMenuButton>
                     </SidebarMenuItem>
                   </>
                 )}
                </>
             )}
             {!authLoading && userRole === 'Admin' && (
               <>
                 <SidebarMenuItem>
                   <SidebarMenuButton asChild onClick={handleLinkClick}>
                     <Link href="/dashboard/customers">
                       <Users />
                       <span>Customers</span>
                     </Link>
                   </SidebarMenuButton>
                 </SidebarMenuItem>
                 <SidebarMenuItem>
                   <SidebarMenuButton asChild onClick={handleLinkClick}>
                     <Link href="/dashboard/dishtv-customers">
                       <Tv />
                       <span>DishTV Customers</span>
                     </Link>
                   </SidebarMenuButton>
                 </SidebarMenuItem>
                 <SidebarMenuItem>
                   <SidebarMenuButton asChild onClick={handleLinkClick}>
                     <Link href="/dashboard/dishtv-dealers">
                       <Store />
                       <span>DishTV Dealers</span>
                     </Link>
                   </SidebarMenuButton>
                 </SidebarMenuItem>
                 <SidebarMenuItem>
                   <SidebarMenuButton asChild onClick={handleLinkClick}>
                     <Link href="/dashboard/dishtv-retailers">
                       <ShoppingBag />
                       <span>DishTV Retailers</span>
                     </Link>
                   </SidebarMenuButton>
                 </SidebarMenuItem>
                 <SidebarMenuItem>
                   <SidebarMenuButton asChild onClick={handleLinkClick}>
                     <Link href="/dashboard/staff">
                       <UserPlus />
                       <span>Staff</span>
                     </Link>
                   </SidebarMenuButton>
                 </SidebarMenuItem>
                  <SidebarMenuItem>
                   <SidebarMenuButton asChild onClick={handleLinkClick}>
                     <Link href="/dashboard/roles">
                       <Shield />
                       <span>Roles</span>
                     </Link>
                   </SidebarMenuButton>
                 </SidebarMenuItem>
                  <SidebarMenuItem>
                   <SidebarMenuButton asChild onClick={handleLinkClick}>
                     <Link href="/dashboard/staff-wallets">
                       <Wallet />
                       <span>Staff Wallets</span>
                     </Link>
                   </SidebarMenuButton>
                 </SidebarMenuItem>

                 <SidebarMenuItem>
                   <SidebarMenuButton asChild onClick={handleLinkClick}>
                     <Link href="/dashboard/recharge">
                       <CreditCard />
                       <span>Recharge</span>
                     </Link>
                   </SidebarMenuButton>
                 </SidebarMenuItem>
                  <SidebarMenuItem>
                   <SidebarMenuButton asChild onClick={handleLinkClick}>
                     <Link href="/dashboard/transactions">
                       <History />
                       <span>Transactions</span>
                     </Link>
                   </SidebarMenuButton>
                 </SidebarMenuItem>
                  <SidebarMenuItem>
                     <SidebarMenuButton asChild onClick={handleLinkClick}>
                         <Link href="/dashboard/collection">
                         <IndianRupee />
                         <span>Collection</span>
                         </Link>
                     </SidebarMenuButton>
                 </SidebarMenuItem>
                  <SidebarMenuItem>
                   <SidebarMenuButton asChild onClick={handleLinkClick}>
                     <Link href="/dashboard/packages">
                       <Package />
                       <span>Packages</span>
                     </Link>
                   </SidebarMenuButton>
                 </SidebarMenuItem>
                 <SidebarMenuItem>
                   <SidebarMenuButton asChild onClick={handleLinkClick}>
                     <Link href="/dashboard/areas">
                       <Map />
                       <span>Areas</span>
                     </Link>
                   </SidebarMenuButton>
                 </SidebarMenuItem>

                 <SidebarMenuItem>
                   <SidebarMenuButton asChild onClick={handleLinkClick}>
                     <Link href="/dashboard/reminders">
                       <BellRing />
                       <span>Reminders</span>
                     </Link>
                   </SidebarMenuButton>
                 </SidebarMenuItem>

                 <SidebarMenuItem>
                     <SidebarMenuButton asChild onClick={handleLinkClick}>
                         <Link href="/dashboard/recharge-offers">
                         <Gift />
                         <span>Recharge Offers</span>
                         </Link>
                     </SidebarMenuButton>
                 </SidebarMenuItem>

                 <SidebarMenuItem>
                     <SidebarMenuButton asChild onClick={handleLinkClick}>
                         <Link href="/dashboard/new-connection-offers">
                         <Tv />
                         <span>New Connection Offers</span>
                         </Link>
                     </SidebarMenuButton>
                 </SidebarMenuItem>

                 <SidebarMenuItem>
                     <SidebarMenuButton asChild onClick={handleLinkClick}>
                         <Link href="/dashboard/retailer-commission">
                         <IndianRupee />
                         <span>Retailer Commission</span>
                         </Link>
                     </SidebarMenuButton>
                 </SidebarMenuItem>

                 <SidebarMenuItem>
                     <SidebarMenuButton asChild onClick={handleLinkClick}>
                         <Link href="/dashboard/marketplace">
                         <ShoppingBag />
                         <span>Marketplace</span>
                         </Link>
                     </SidebarMenuButton>
                 </SidebarMenuItem>

                 <SidebarMenuItem>
                     <SidebarMenuButton asChild onClick={handleLinkClick}>
                         <Link href="/dashboard/offers">
                         <Megaphone />
                         <span>Offers</span>
                         </Link>
                     </SidebarMenuButton>
                 </SidebarMenuItem>
                  <SidebarMenuItem>
                     <SidebarMenuButton asChild onClick={handleLinkClick}>
                         <Link href="/dashboard/announcements">
                         <Megaphone />
                         <span>Announcements</span>
                         </Link>
                     </SidebarMenuButton>
                 </SidebarMenuItem>

                 <SidebarMenuItem>
                   <SidebarMenuButton asChild onClick={handleLinkClick}>
                     <Link href="/dashboard/business-directory">
                       <Store />
                       <span>Local Business Directory</span>
                     </Link>
                   </SidebarMenuButton>
                 </SidebarMenuItem>
               </>
             )}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={handleLogout}>
                  <LogOut />
                  <span>Logout</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
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
