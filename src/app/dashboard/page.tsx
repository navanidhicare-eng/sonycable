
"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Package, CircleDollarSign, UserCheck, ShieldCheck, IndianRupee, Wallet, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function DashboardPage() {
  const [userRole, setUserRole] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const role = localStorage.getItem("userRole");
      setUserRole(role || "");
    }
  }, []);

  const getWelcomeMessage = () => {
    if (userRole === "Admin") {
      return "Welcome, Admin!";
    }
    if (userRole === "Staff") {
      return "Welcome, Staff!";
    }
    return "Welcome to your SONY CABLE dashboard.";
  };

  const CollectionCard = () => (
    <Card className="bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
        <Link href="/dashboard/collection" className="block h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                    Payment Collection
                </CardTitle>
                <IndianRupee className="h-4 w-4 text-primary-foreground" />
            </CardHeader>
            <CardContent>
                <div className="flex items-center justify-between">
                    <p className="text-xs">
                        Go to collection page
                    </p>
                    <ArrowRight className="h-5 w-5" />
                </div>
            </CardContent>
        </Link>
    </Card>
  );

  const AdminDashboard = () => (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <CollectionCard />
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
                Total Revenue
            </CardTitle>
            <CircleDollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
            <div className="text-2xl font-bold">₹45,231.89</div>
            <p className="text-xs text-muted-foreground">
                +20.1% from last month
            </p>
            </CardContent>
        </Card>
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
                Active Customers
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
            <div className="text-2xl font-bold">+2350</div>
            <p className="text-xs text-muted-foreground">
                +180.1% from last month
            </p>
            </CardContent>
        </Card>
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Packages</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
            <div className="text-2xl font-bold">+12</div>
            <p className="text-xs text-muted-foreground">
                +1 from last month
            </p>
            </CardContent>
        </Card>
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
                All Collection Agents
            </CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
            <div className="text-2xl font-bold">5</div>
            <p className="text-xs text-muted-foreground">
                Total active agents
            </p>
            </CardContent>
        </Card>
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Collection</CardTitle>
            <CircleDollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
            <div className="text-2xl font-bold">₹5,250</div>
            <p className="text-xs text-muted-foreground">
                Collection as of now
            </p>
            </CardContent>
        </Card>
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month's Collection</CardTitle>
            <CircleDollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
            <div className="text-2xl font-bold">₹1,20,500</div>
            <p className="text-xs text-muted-foreground">
                Total for this month
            </p>
            </CardContent>
        </Card>
    </div>
  );

  const StaffDashboard = () => (
     <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <CollectionCard />
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
                Collection Wallet
            </CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
            <div className="text-2xl font-bold">₹12,550</div>
            <p className="text-xs text-muted-foreground">
                Your total collection this month
            </p>
            </CardContent>
        </Card>
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
                Commission Wallet
            </CardTitle>
            <IndianRupee className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
            <div className="text-2xl font-bold">₹1,255</div>
            <p className="text-xs text-muted-foreground">
                Your total commission this month
            </p>
            </CardContent>
        </Card>
     </div>
  );

  return (
    <main className="min-h-screen w-full font-body text-foreground">
      <div className="container mx-auto p-4 py-8 md:p-12">
        <header className="mb-10">
          <div className="flex items-center gap-4">
             <h1 className="text-4xl font-bold tracking-tighter md:text-5xl">
                Dashboard
             </h1>
             {userRole && (
                <Badge variant={userRole === "Admin" ? "default" : "secondary"} className="text-lg">
                   <ShieldCheck className="mr-2 h-5 w-5" />
                   {userRole} Role
                </Badge>
            )}
          </div>
          <p className="mt-4 max-w-3xl text-lg text-muted-foreground md:text-xl">
            {getWelcomeMessage()}
          </p>
        </header>

        {userRole === 'Admin' && <AdminDashboard />}
        {userRole === 'Staff' && <StaffDashboard />}

      </div>
    </main>
  );
}
