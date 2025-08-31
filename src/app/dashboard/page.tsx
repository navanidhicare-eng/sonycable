
"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Package, CircleDollarSign, UserCheck, ShieldCheck, IndianRupee, Wallet, ArrowRight, ArrowLeftRight, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";


interface SettlementRequest {
  id: string;
  staffName: string;
  amount: number;
  commission: number;
  amountToSend: number;
  status: 'pending' | 'approved';
}

export default function DashboardPage() {
  const [userRole, setUserRole] = useState("");
  const [isSettleDialogOpen, setIsSettleDialogOpen] = useState(false);
  const { toast } = useToast();
  const [commissionReceived, setCommissionReceived] = useState(false);
  
  // Simulate a shared state for settlement requests using localStorage
  const [settlementRequests, setSettlementRequests] = useState<SettlementRequest[]>([]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const role = localStorage.getItem("userRole");
      setUserRole(role || "");

      const storedRequests = localStorage.getItem("settlementRequests");
      if (storedRequests) {
        setSettlementRequests(JSON.parse(storedRequests));
      }
    }
  }, []);

  const updateAndStoreRequests = (newRequests: SettlementRequest[]) => {
    setSettlementRequests(newRequests);
    if (typeof window !== "undefined") {
      localStorage.setItem("settlementRequests", JSON.stringify(newRequests));
    }
  };

  const getWelcomeMessage = () => {
    if (userRole === "Admin") {
      return "Welcome, Admin!";
    }
    if (userRole === "Staff") {
      return "Welcome, Staff!";
    }
    return "Welcome to your SONY CABLE dashboard.";
  };

  const handleSettleCollection = () => {
    const collectionAmount = 12550;
    const commissionAmount = 1255;
    const amountToSend = commissionReceived ? collectionAmount - commissionAmount : collectionAmount;

    const newRequest: SettlementRequest = {
        id: `settle_${new Date().getTime()}`,
        staffName: 'Staff Member', // In a real app, this would be dynamic
        amount: collectionAmount,
        commission: commissionReceived ? commissionAmount : 0,
        amountToSend: amountToSend,
        status: 'pending',
    };

    updateAndStoreRequests([...settlementRequests, newRequest]);
    
    toast({
        title: "Request Sent",
        description: `Your settlement request for ₹${amountToSend.toLocaleString()} has been sent to the admin for approval.`,
    });
    
    setIsSettleDialogOpen(false);
    setCommissionReceived(false); // Reset checkbox state after action
  }

  const handleApproveSettlement = (requestId: string) => {
    const updatedRequests = settlementRequests.map(req => 
        req.id === requestId ? { ...req, status: 'approved' } : req
    );
    updateAndStoreRequests(updatedRequests);
    toast({
        title: "Settlement Approved",
        description: "The staff member's wallet has been marked as cleared.",
    })
  }

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

   const SettlementRequestsCard = () => {
    const pendingRequests = settlementRequests.filter(r => r.status === 'pending');
    if(pendingRequests.length === 0) return null;

    return (
         <Card className="md:col-span-2 lg:col-span-3">
            <CardHeader>
                <CardTitle>Settlement Requests</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {pendingRequests.map(req => (
                    <div key={req.id} className="flex items-center justify-between rounded-lg border p-3">
                        <div>
                            <p className="font-semibold">{req.staffName}</p>
                            <p className="text-sm text-muted-foreground">
                                Requesting to settle <span className="font-bold text-foreground">₹{req.amountToSend.toLocaleString()}</span>
                            </p>
                        </div>
                        <Button onClick={() => handleApproveSettlement(req.id)}>
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            Approve
                        </Button>
                    </div>
                ))}
            </CardContent>
        </Card>
    );
   };

  const AdminDashboard = () => (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <SettlementRequestsCard />
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

  const StaffDashboard = () => {
     const hasPendingRequest = settlementRequests.some(req => req.status === 'pending');
     const isWalletCleared = settlementRequests.every(req => req.status === 'approved');

     const walletAmount = isWalletCleared ? 0 : 12550;
     const commissionAmount = isWalletCleared ? 0 : 1255;

     return (
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
            <div className="text-2xl font-bold">₹{walletAmount.toLocaleString()}</div>
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
            <div className="text-2xl font-bold">₹{commissionAmount.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
                Your total commission this month
            </p>
            </CardContent>
        </Card>
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
                Settle Collection
            </CardTitle>
            <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <Button className="w-full" onClick={() => setIsSettleDialogOpen(true)} disabled={hasPendingRequest || isWalletCleared}>
                    {hasPendingRequest ? 'Approval Pending' : (isWalletCleared ? 'Settled' : 'Send to Admin')}
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                   {hasPendingRequest ? 'Your previous request is awaiting admin approval.' : 'Send your collected amount to the admin for settlement.'}
                </p>
            </CardContent>
        </Card>
     </div>
     )
  };

  return (
    <>
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
    <Dialog open={isSettleDialogOpen} onOpenChange={setIsSettleDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
            <DialogTitle>Confirm Settlement</DialogTitle>
            <DialogDescription>
                Are you sure you want to send the collected amount of{" "}
                <span className="font-bold text-foreground">₹12,550</span> to the admin? This action cannot be undone.
            </DialogDescription>
        </DialogHeader>
        <div className="py-4">
            <div className="flex items-center space-x-2">
                <Checkbox id="commission-received" checked={commissionReceived} onCheckedChange={(checked) => setCommissionReceived(Boolean(checked))} />
                <Label htmlFor="commission-received">Commission Received (₹1,255)</Label>
            </div>
        </div>
        <DialogFooter>
            <Button variant="outline" onClick={() => setIsSettleDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSettleCollection}>Confirm & Send</Button>
        </DialogFooter>
        </DialogContent>
    </Dialog>
    </>
  );
}
    