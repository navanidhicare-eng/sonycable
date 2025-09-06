
"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Package, CircleDollarSign, UserCheck, ShieldCheck, IndianRupee, Wallet, ArrowRight, ArrowLeftRight, CheckCircle2, Loader2 } from "lucide-react";
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
import { db } from "@/lib/firebase";
import { collection, addDoc, onSnapshot, doc, updateDoc, query, where } from "firebase/firestore";
import { useAuth } from "@/hooks/useAuth";

interface SettlementRequest {
  id: string;
  staffName: string;
  staffId: string;
  amount: number;
  commission: number;
  amountToSend: number;
  status: 'pending' | 'approved';
  createdAt: Date;
}

export default function DashboardPage() {
  const { user: currentUser, userRole, loading: authLoading } = useAuth();
  const [isSettleDialogOpen, setIsSettleDialogOpen] = useState(false);
  const { toast } = useToast();
  const [commissionReceived, setCommissionReceived] = useState(false);
  const [settlementRequests, setSettlementRequests] = useState<SettlementRequest[]>([]);
  const [firestoreLoading, setFirestoreLoading] = useState(true);

  useEffect(() => {
    if (authLoading) {
      setFirestoreLoading(true);
      return;
    }
    if (!currentUser || !userRole) {
      setFirestoreLoading(false);
      return;
    }
    
    setFirestoreLoading(true);
    const settlementsRef = collection(db, "settlements");
    let q;

    if (userRole === "Admin") {
      q = query(settlementsRef);
    } else if (userRole === "Staff") {
      q = query(settlementsRef, where("staffId", "==", currentUser.uid));
    } else {
      setFirestoreLoading(false);
      return;
    }

    const unsubscribeFirestore = onSnapshot(q, (snapshot) => {
      const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SettlementRequest));
      requests.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setSettlementRequests(requests);
      setFirestoreLoading(false);
    }, (error) => {
        console.error("Firestore snapshot error:", error);
        toast({
            variant: "destructive",
            title: "Error fetching data",
            description: "Could not fetch settlement requests. Check permissions.",
        });
        setFirestoreLoading(false);
    });

    return () => unsubscribeFirestore();
  }, [currentUser, userRole, authLoading, toast]);


  const getWelcomeMessage = () => {
    if (userRole === "Admin") {
      return "Welcome, Admin!";
    }
    if (userRole === "Staff") {
      return `Welcome, ${currentUser?.displayName || 'Staff'}!`;
    }
    return "Welcome to your SONY CABLE dashboard.";
  };

  const handleSettleCollection = async () => {
    if (!currentUser) return;
    
    const collectionAmount = 12550; // Replace with actual dynamic amount
    const commissionAmount = 1255; // Replace with actual dynamic amount
    const amountToSend = commissionReceived ? collectionAmount - commissionAmount : collectionAmount;

    try {
      await addDoc(collection(db, "settlements"), {
        staffId: currentUser.uid,
        staffName: currentUser.displayName || 'Staff Member',
        amount: collectionAmount,
        commission: commissionReceived ? commissionAmount : 0,
        amountToSend: amountToSend,
        status: 'pending',
        createdAt: new Date(),
      });

      toast({
          title: "Request Sent",
          description: `Your settlement request for ₹${amountToSend.toLocaleString()} has been sent to the admin for approval.`,
      });
      
      setIsSettleDialogOpen(false);
      setCommissionReceived(false);
    } catch (error) {
      console.error("Error sending settlement request: ", error);
      toast({
        variant: "destructive",
        title: "Request Failed",
        description: "Could not send your settlement request. Please try again.",
      });
    }
  }

  const handleApproveSettlement = async (requestId: string) => {
    try {
      const requestDocRef = doc(db, "settlements", requestId);
      await updateDoc(requestDocRef, {
        status: 'approved'
      });
      toast({
          title: "Settlement Approved",
          description: "The staff member's wallet has been marked as cleared.",
      })
    } catch (error) {
        console.error("Error approving settlement: ", error);
        toast({
            variant: "destructive",
            title: "Approval Failed",
            description: "Could not approve the settlement. Please try again.",
        });
    }
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
     const hasPendingRequest = settlementRequests.some(req => req.status === 'pending' && req.staffId === currentUser?.uid);
     const isWalletCleared = !settlementRequests.some(req => req.status === 'pending' && req.staffId === currentUser?.uid) && settlementRequests.length > 0;

     const walletAmount = isWalletCleared ? 0 : 12550; // Replace with actual dynamic amount
     const commissionAmount = isWalletCleared ? 0 : 1255; // Replace with actual dynamic amount

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
                <Button className="w-full" onClick={() => setIsSettleDialogOpen(true)} disabled={hasPendingRequest || walletAmount === 0}>
                    {hasPendingRequest ? 'Approval Pending' : (walletAmount === 0 ? 'Settled' : 'Send to Admin')}
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                   {hasPendingRequest ? 'Your previous request is awaiting admin approval.' : 'Send your collected amount to the admin for settlement.'}
                </p>
            </CardContent>
        </Card>
     </div>
     )
  };

  const renderDashboard = () => {
    if (authLoading || firestoreLoading) {
      return (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      );
    }
    
    if (userRole === 'Admin') return <AdminDashboard />;
    if (userRole === 'Staff') return <StaffDashboard />;

    return null;
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

        {renderDashboard()}

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
