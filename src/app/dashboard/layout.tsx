
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
  Send,
  Gift,
} from 'lucide-react';
import Link from 'next/link';
import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userRole, loading: authLoading } = useAuth();
  const router = useRouter();
  const { isMobile, setOpenMobile } = useSidebar();

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
      }
      handleLinkClick(); // Close sidebar on logout as well
      router.push('/login');
    } catch (error) {
      console.error("Failed to log out", error);
    }
  };
  
  const isCollectionAgent = userRole ? /collection|collation/i.test(userRole) : false;
  const isNetworkServiceAgent = userRole?.toLowerCase().replace(/\s/g, "") === 'networkserviceagent';


  return (
    <>
      <Sidebar>
        <SidebarHeader>
          <div className="flex items-center gap-2">
            
            <Network className="h-6 w-6 text-primary" />
            <span className="text-lg font-semibold">SONY CABLE</span>
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
             {!authLoading && userRole && userRole !== 'Admin' && (
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
                {isCollectionAgent && (
                    <SidebarMenuItem>
                        <SidebarMenuButton asChild onClick={handleLinkClick}>
                            <Link href="/dashboard/my-collection-history">
                            <History />
                            <span>My Collection History</span>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                )}
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
                        <Link href="/dashboard/complaints-staff">
                        <MessageSquareWarning />
                        <span>Complaints</span>
                        </Link>
                    </SidebarMenuButton>
                </SidebarMenuItem>
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
                    <Link href="/dashboard/commission-calculator">
                      <Calculator />
                      <span>Commission Calculator</span>
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
                    <Link href="/dashboard/mso-payments">
                      <ArrowRightLeft />
                      <span>MSO Payments</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                    <SidebarMenuButton asChild onClick={handleLinkClick}>
                        <Link href="/dashboard/complaints">
                        <MessageSquareWarning />
                        <span>Complaints</span>
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
                    <Link href="/dashboard/local-tv">
                      <Tv />
                      <span>Local Live TV</span>
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
