
"use client";

import { usePathname } from 'next/navigation';
import { BillComparisonForm } from '@/components/bill-comparison-form';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { LayoutDashboard, Users, Network } from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
    const pathname = usePathname();

  return (
    <main className="min-h-screen w-full font-body text-foreground">
      <div className="container mx-auto flex flex-col items-center p-4 py-8 md:p-12">
        <header className="mb-10 flex flex-col items-center text-center">
          <h1 className="text-4xl font-bold tracking-tighter md:text-5xl">
            Dashboard
          </h1>
          <p className="mt-4 max-w-3xl text-lg text-muted-foreground md:text-xl">
            Upload your cable bills, tell us what you want, and let our AI find the perfect plan for you. Save money and get the features you love.
          </p>
        </header>
        <BillComparisonForm />
      </div>
    </main>
  );
}

function WithSidebarLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
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
              <SidebarMenuButton
                asChild
                isActive={pathname === '/dashboard'}
              >
                <Link href="/dashboard">
                  <LayoutDashboard />
                  <span>Dashboard</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={pathname === '/dashboard/customers'}
              >
                <Link href="/dashboard/customers">
                  <Users />
                  <span>Customers</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarContent>
      </Sidebar>
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  );
}
