
'use client';

import {
  LayoutDashboard,
  Users,
  Package,
  Map,
  IndianRupee,
  MessageSquareWarning,
  UserPlus,
  LogOut,
  BellRing,
  Shield,
  Wallet,
  History,
  Tv,
  Send,
  Loader2,
  Menu,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, userRole, shopName, userStatus, loading: authLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsOnline(navigator.onLine);
      const handleOnline = () => {
        setIsOnline(true);
        toast({ title: '🌐 Online Mode Restored', description: 'Reconnected to internet.' });
      };
      const handleOffline = () => {
        setIsOnline(false);
        toast({ variant: 'destructive', title: '⚡ Offline Mode Active', description: 'Working offline. Data saved locally.' });
      };
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }, [toast]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      toast({ variant: 'destructive', title: 'Authentication Required', description: 'Please log in.' });
      router.push('/login');
      return;
    }
    if (userStatus === 'inactive' && pathname !== '/dashboard') {
      toast({ variant: 'destructive', title: 'Account Inactive', description: 'Please settle your balance with Admin.' });
      router.push('/dashboard');
      return;
    }
    const adminOnlyRoutes = [
      '/dashboard/staff',
      '/dashboard/roles',
      '/dashboard/packages',
    ];
    const isAdminRoute = adminOnlyRoutes.some(
      (route) => pathname === route || pathname?.startsWith(route + '/')
    );
    if (isAdminRoute && userRole && userRole !== 'Admin') {
      toast({ variant: 'destructive', title: 'Access Denied', description: 'You do not have permission.' });
      router.push('/dashboard');
    }
  }, [user, userRole, userStatus, authLoading, pathname, router, toast]);

  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (!event.reason || event.reason instanceof Event ||
        (typeof event.reason === 'object' && ('type' in event.reason || 'target' in event.reason))) {
        event.preventDefault();
      }
    };
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    return () => window.removeEventListener('unhandledrejection', handleUnhandledRejection);
  }, []);

  // Close sidebar on route change (mobile)
  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('userRole');
        localStorage.removeItem('shopName');
        localStorage.removeItem('userStatus');
      }
      router.push('/login');
    } catch (error) {
      console.error('Failed to log out', error);
    }
  };

  const isCollectionAgent = userRole ? /collection|collation/i.test(userRole) : false;
  const isCustomerHistoryPage = pathname?.includes('/customers') && pathname?.includes('/history');

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname === href || pathname?.startsWith(href + '/');
  };

  const NavItem = ({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) => (
    <Link
      href={href}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
        isActive(href)
          ? 'bg-gradient-to-r from-red-600/30 via-rose-600/20 to-orange-500/10 text-white font-bold border-l-4 border-red-500 shadow-sm'
          : 'text-zinc-300 hover:bg-white/[0.06] hover:text-white border-l-4 border-transparent'
      }`}
    >
      <div className={`p-1.5 rounded-lg shrink-0 transition-all ${
        isActive(href)
          ? 'bg-gradient-to-tr from-red-600 to-amber-500 text-white shadow-md ring-1 ring-white/20'
          : 'bg-zinc-900/90 text-zinc-400 border border-zinc-800/80'
      }`}>
        {icon}
      </div>
      <span className="truncate">{label}</span>
    </Link>
  );

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-[#0d0709] text-zinc-100 overflow-hidden select-none relative">
      {/* Ambient Glow */}
      <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-red-600/15 to-transparent pointer-events-none" />
      <div className="absolute -top-8 -left-8 w-28 h-28 rounded-full bg-red-600/20 blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="p-3 border-b border-rose-950/40 bg-[#0e0709]/80 relative z-10">
        <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-gradient-to-r from-red-950/40 via-neutral-900/90 to-zinc-900/90 border border-red-500/25 shadow-lg">
          <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-tr from-red-600 via-rose-500 to-amber-500 shadow-md text-white shrink-0 ring-1 ring-white/20">
            <Tv className="h-5 w-5 text-white" />
            <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 border-2 border-[#0e0709] animate-pulse" />
          </div>
          <div className="flex flex-col leading-tight overflow-hidden">
            <span className="text-sm font-black tracking-tight text-white truncate" title={shopName || 'Navanidhi Digital'}>
              {shopName || 'Navanidhi Digital'}
            </span>
            <span className="text-[10px] font-extrabold bg-gradient-to-r from-rose-400 via-orange-400 to-amber-300 bg-clip-text text-transparent uppercase tracking-wider">
              Sony Cable Network
            </span>
          </div>
        </div>
      </div>

      {/* Nav Items */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-5 relative z-10">
        {/* Overview */}
        <div>
          <p className="px-3 text-[10px] font-black uppercase tracking-widest text-rose-300/60 mb-1 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500/70" />
            Overview
          </p>
          <NavItem href="/dashboard" icon={<LayoutDashboard className="h-4 w-4" />} label="Dashboard" />
        </div>

        {/* Staff Operations */}
        {!authLoading && userRole && userRole !== 'Admin' && userStatus !== 'inactive' && (
          <div>
            <p className="px-3 text-[10px] font-black uppercase tracking-widest text-rose-300/60 mb-1 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500/70" />
              Operations & Services
            </p>
            <div className="space-y-0.5">
              {!isCollectionAgent && (
                <NavItem href="/dashboard/customers-staff" icon={<Users className="h-4 w-4" />} label="Customers" />
              )}
              <NavItem href="/dashboard/payments-collections" icon={<IndianRupee className="h-4 w-4" />} label="Payments Collections" />
              <NavItem href="/dashboard/my-collection-history" icon={<History className="h-4 w-4" />} label="My Collection History" />
              <NavItem href="/dashboard/reminders-staff" icon={<BellRing className="h-4 w-4" />} label="Reminders" />
              <NavItem href="/dashboard/complaints-staff" icon={<MessageSquareWarning className="h-4 w-4" />} label="Complaints" />
            </div>
          </div>
        )}

        {/* Admin Operations */}
        {!authLoading && userRole === 'Admin' && (
          <>
            <div>
              <p className="px-3 text-[10px] font-black uppercase tracking-widest text-rose-300/60 mb-1 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500/70" />
                Customer Operations
              </p>
              <div className="space-y-0.5">
                <NavItem href="/dashboard/customers" icon={<Users className="h-4 w-4" />} label="Customers" />
                <NavItem href="/dashboard/transactions" icon={<History className="h-4 w-4" />} label="Transactions" />
                <NavItem href="/dashboard/collection" icon={<IndianRupee className="h-4 w-4" />} label="Collection" />
                <NavItem href="/dashboard/reminders" icon={<BellRing className="h-4 w-4" />} label="Reminders" />
                <NavItem href="/dashboard/complaints-staff" icon={<MessageSquareWarning className="h-4 w-4" />} label="Complaints" />
              </div>
            </div>
            <div>
              <p className="px-3 text-[10px] font-black uppercase tracking-widest text-rose-300/60 mb-1 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500/70" />
                Network & Management
              </p>
              <div className="space-y-0.5">
                <NavItem href="/dashboard/staff" icon={<UserPlus className="h-4 w-4" />} label="Operators" />
                <NavItem href="/dashboard/roles" icon={<Shield className="h-4 w-4" />} label="Roles" />
                <NavItem href="/dashboard/packages" icon={<Package className="h-4 w-4" />} label="Packages" />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Footer Logout */}
      <div className="p-3 pb-6 border-t border-rose-950/40 bg-[#0a0507]/90 relative z-10">
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-red-950/50 to-neutral-950/70 hover:from-red-900/50 hover:to-rose-950/50 border border-red-500/30 text-rose-200 font-bold text-xs transition-all group cursor-pointer active:scale-[0.98]"
        >
          <div className="flex items-center gap-2.5">
            <div className="p-1 rounded-lg bg-red-500/20 text-red-400 group-hover:bg-red-500 group-hover:text-white transition-colors">
              <LogOut className="h-3.5 w-3.5" />
            </div>
            <span className="group-hover:text-white transition-colors">Logout</span>
          </div>
          <span className="text-[10px] bg-gradient-to-r from-red-600 to-orange-600 text-white font-black px-2 py-0.5 rounded-md uppercase tracking-wider">
            Exit
          </span>
        </button>
      </div>
    </div>
  );

  if (authLoading) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-slate-950 text-white">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
          <p className="text-sm font-semibold text-slate-300">Verifying authentication...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-slate-950 text-white">
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
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* ── DESKTOP Sidebar (always visible on md+) ── */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-rose-950/40 overflow-hidden">
        <SidebarContent />
      </aside>

      {/* ── MOBILE Sidebar Overlay ── */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          {/* Sidebar Panel */}
          <aside className="relative z-10 w-72 h-full shadow-2xl overflow-hidden">
            <SidebarContent />
          </aside>
          {/* Close button */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="absolute top-4 right-4 z-20 p-2 rounded-full bg-zinc-900/90 text-zinc-300 border border-zinc-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* ── MAIN CONTENT ── */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        {/* Offline Banner */}
        {!isOnline && (
          <div className="bg-amber-500/20 border-b border-amber-500/40 text-amber-300 text-xs px-4 py-2 flex items-center justify-between font-bold">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400 animate-ping" />
              <span>⚡ Working Offline • No Internet Connection</span>
            </div>
            <span className="text-[10px] bg-amber-500/30 px-2.5 py-0.5 rounded-md text-amber-200 border border-amber-500/40">
              Offline Cache Active
            </span>
          </div>
        )}

        {/* Mobile Topbar with Hamburger */}
        <div className="flex h-14 items-center gap-3 border-b px-4 md:hidden bg-[#0d0709] border-rose-950/40">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg bg-zinc-800/80 text-zinc-300 border border-zinc-700/60 active:scale-95 transition-transform"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-tr from-red-600 to-amber-500 text-white">
              <Tv className="h-4 w-4" />
            </div>
            <span className="text-sm font-black text-white truncate">{shopName || 'Navanidhi Digital'}</span>
          </div>
        </div>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
