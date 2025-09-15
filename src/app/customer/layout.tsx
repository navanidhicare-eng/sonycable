
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
  Network,
  LogOut,
  History,
  Send,
  MessageSquareWarning,
} from 'lucide-react';
import Link from 'next/link';
import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';

function CustomerDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
      handleLinkClick(); 
      router.push('/login');
    } catch (error) {
      console.error("Failed to log out", error);
    }
  };

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
                <Link href="#">
                  <LayoutDashboard />
                  <span>Dashboard</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild onClick={handleLinkClick}>
                 <Link href="#">
                    <History />
                    <span>Transaction History</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild onClick={handleLinkClick}>
                <Link href="#">
                    <Send />
                    <span>Request Recharge</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild onClick={handleLinkClick}>
                <Link href="#">
                    <MessageSquareWarning />
                    <span>Register Complaint</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
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
      <CustomerDashboardLayout>{children}</CustomerDashboardLayout>
    </SidebarProvider>
  );
}
