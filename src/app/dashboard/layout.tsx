
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
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

export default function WithSidebarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userRole } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      if (typeof window !== "undefined") {
        localStorage.removeItem("userRole");
      }
      router.push('/login');
    } catch (error) {
      console.error("Failed to log out", error);
    }
  };
  
  const isCollectionAgent = userRole === 'Collection Agent';

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <div className="flex items-center gap-2">
            <SidebarTrigger />
            <Network className="h-6 w-6 text-primary" />
            <span className="text-lg font-semibold">SONY CABLE</span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <Link href="/dashboard">
                  <LayoutDashboard />
                  <span>Dashboard</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
             {userRole && userRole !== 'Admin' && (
               <>
                {!isCollectionAgent && (
                    <SidebarMenuItem>
                        <SidebarMenuButton asChild>
                            <Link href="/dashboard/recharge">
                            <CreditCard />
                            <span>Recharge</span>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                )}
                <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                        <Link href="/dashboard/payments-collections">
                        <IndianRupee />
                        <span>Payments Collections</span>
                        </Link>
                    </SidebarMenuButton>
                </SidebarMenuItem>
                 <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                        <Link href="/dashboard/reminders-staff">
                        <BellRing />
                        <span>Reminders</span>
                        </Link>
                    </SidebarMenuButton>
                </SidebarMenuItem>
                 <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                        <Link href="/dashboard/complaints-staff">
                        <MessageSquareWarning />
                        <span>Complaints</span>
                        </Link>
                    </SidebarMenuButton>
                </SidebarMenuItem>
               </>
            )}
            {userRole === 'Admin' && (
              <>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <Link href="/dashboard/customers">
                      <Users />
                      <span>Customers</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <Link href="/dashboard/staff">
                      <UserPlus />
                      <span>Staff</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                 <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <Link href="/dashboard/roles">
                      <Shield />
                      <span>Roles</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                 <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <Link href="/dashboard/staff-wallets">
                      <Wallet />
                      <span>Staff Wallets</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <Link href="/dashboard/recharge">
                      <CreditCard />
                      <span>Recharge</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                 <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                        <Link href="/dashboard/collection">
                        <IndianRupee />
                        <span>Collection</span>
                        </Link>
                    </SidebarMenuButton>
                </SidebarMenuItem>
                 <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <Link href="/dashboard/packages">
                      <Package />
                      <span>Packages</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <Link href="/dashboard/areas">
                      <Map />
                      <span>Areas</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                 <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <Link href="/dashboard/commission-calculator">
                      <Calculator />
                      <span>Commission Calculator</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <Link href="/dashboard/reminders">
                      <BellRing />
                      <span>Reminders</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <Link href="/dashboard/mso-payments">
                      <ArrowRightLeft />
                      <span>MSO Payments</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                        <Link href="/dashboard/complaints">
                        <MessageSquareWarning />
                        <span>Complaints</span>
                        </Link>
                    </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                        <Link href="/dashboard/offers">
                        <Megaphone />
                        <span>Offers</span>
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
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  );
}
