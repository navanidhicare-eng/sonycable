
"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Package, CircleDollarSign, UserCheck, ShieldCheck, IndianRupee, Wallet, ArrowRight, ArrowLeftRight, CheckCircle2, Loader2, Search, HandCoins } from "lucide-react";
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
import { collection, addDoc, onSnapshot, doc, updateDoc, query, where, getDocs, Timestamp } from "firebase/firestore";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface SettlementRequest {
  id: string;
  staffName: string;
  staffId: string;
  amount: number;
  commission: number;
  amountToSend: number;
  status: 'pending' | 'approved';
  createdAt: Timestamp;
}

interface DashboardStats {
    totalRevenue: number;
    activeCustomers: number;
    activePackages: number;
    collectionAgents: number;
    todaysCollection: number;
    monthlyCollection: number;
}

interface StaffData {
    name: string;
    commission: string;
    adminId: string;
    area: string[];
}

interface Customer {
  id: string;
  name: string;
  balanceAmount: number;
  mobile: string;
  customerId: string;
  area: string;
}

export default function DashboardPage() {
  const { user: currentUser, userRole, loading: authLoading } = useAuth();
  const [isSettleDialogOpen, setIsSettleDialogOpen] = useState(false);
  const { toast } = useToast();
  const [commissionReceived, setCommissionReceived] = useState(false);
  const [settlementRequests, setSettlementRequests] = useState<SettlementRequest[]>([]);
  const [firestoreLoading, setFirestoreLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
      totalRevenue: 0,
      activeCustomers: 0,
      activePackages: 0,
      collectionAgents: 0,
      todaysCollection: 0,
      monthlyCollection: 0,
  });
  const [staffWallet, setStaffWallet] = useState({ walletAmount: 0, commissionAmount: 0 });
  const [staffData, setStaffData] = useState<StaffData | null>(null);

  // States for Customer Search Dialog
  const [isCustomerSearchDialogOpen, setIsCustomerSearchDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchedCustomer, setSearchedCustomer] = useState<Customer | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  // States for Collection Dialog
  const [isCollectDialogOpen, setIsCollectDialogOpen] = useState(false);
  const [amountCollected, setAmountCollected] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");


  useEffect(() => {
    if (authLoading) return;
    if (!currentUser) {
      setFirestoreLoading(false);
      return;
    }
    
    setFirestoreLoading(true);

    const fetchAdminData = async () => {
        try {
            const customersQuery = query(collection(db, "customers"), where("userId", "==", currentUser.uid));
            const packagesQuery = query(collection(db, "packages"), where("userId", "==", currentUser.uid));
            const staffQuery = query(collection(db, "staff"), where("adminId", "==", currentUser.uid));

            const [customersSnapshot, packagesSnapshot, staffSnapshot] = await Promise.all([
                getDocs(customersQuery),
                getDocs(packagesQuery),
                getDocs(staffQuery),
            ]);

            setStats(prevStats => ({
                ...prevStats,
                activeCustomers: customersSnapshot.size,
                activePackages: packagesSnapshot.size,
                collectionAgents: staffSnapshot.size,
            }));

            const settlementsQuery = query(collection(db, "settlements"), where("adminId", "==", currentUser.uid));
            const unsubscribeSettlements = onSnapshot(settlementsQuery, (snapshot) => {
                const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SettlementRequest));
                requests.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
                setSettlementRequests(requests);
            });
            
            return [unsubscribeSettlements];

        } catch (error) {
            console.error("Error fetching admin stats:", error);
            toast({ variant: "destructive", title: "Error fetching stats" });
        } finally {
            setFirestoreLoading(false);
        }
        return [];
    };

    const fetchStaffData = async () => {
        try {
            const staffQuery = query(collection(db, "staff"), where("uid", "==", currentUser.uid));
            const staffSnapshot = await getDocs(staffQuery);
            if (staffSnapshot.empty) {
                setFirestoreLoading(false);
                return [];
            }
            
            const staffDocData = staffSnapshot.docs[0].data() as StaffData;
            setStaffData(staffDocData);
            const commissionRate = parseFloat(staffDocData.commission.replace('%', ''));

            // Fetch approved settlements to find the last settlement date
            const approvedSettlementsQuery = query(
                collection(db, "settlements"),
                where("staffId", "==", currentUser.uid),
                where("status", "==", "approved")
            );
            const approvedSettlementsSnapshot = await getDocs(approvedSettlementsQuery);
            let lastSettlementDate: Date | null = null;
            if (!approvedSettlementsSnapshot.empty) {
                const dates = approvedSettlementsSnapshot.docs.map(doc => doc.data().createdAt.toDate());
                lastSettlementDate = new Date(Math.max(...dates.map(date => date.getTime())));
            }
            
            const paymentsQuery = query(
              collection(db, "payments"),
              where("collectedBy", "==", currentUser.uid)
            );

            const unsubscribePayments = onSnapshot(paymentsQuery, (snapshot) => {
                const paymentsAfterSettlement = snapshot.docs.filter(doc => {
                    if (!lastSettlementDate) return true;
                    return doc.data().collectionDate.toDate() > lastSettlementDate;
                });
                
                const totalCollection = paymentsAfterSettlement.reduce((acc, doc) => acc + doc.data().amount, 0);
                const totalCommission = (totalCollection * commissionRate) / 100;
                setStaffWallet({ walletAmount: totalCollection, commissionAmount: totalCommission });
            });


            const allSettlementsQuery = query(collection(db, "settlements"), where("staffId", "==", currentUser.uid));
            const unsubscribeSettlements = onSnapshot(allSettlementsQuery, (snapshot) => {
                 const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SettlementRequest));
                requests.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
                setSettlementRequests(requests);
            });

            return [unsubscribePayments, unsubscribeSettlements];

        } catch(error) {
            console.error("Error fetching staff data:", error);
            toast({ variant: "destructive", title: "Error fetching staff data" });
        } finally {
             setFirestoreLoading(false);
        }
        return [];
    };

    let unsubscribes: (() => void)[] = [];
    const fetchData = async () => {
      if (userRole === "Admin") {
        unsubscribes = await fetchAdminData() || [];
      } else if (userRole === "Staff") {
        unsubscribes = await fetchStaffData() || [];
      } else {
        setFirestoreLoading(false);
      }
    };

    fetchData();
    
    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, [currentUser, userRole, authLoading, toast]);


  const getWelcomeMessage = () => {
    if (userRole === "Admin") {
      return "Welcome, Admin!";
    }
    if (userRole === "Staff") {
      return `Welcome, ${staffData?.name || 'Staff'}!`;
    }
    return "Welcome to your SONY CABLE dashboard.";
  };

  const handleSettleCollection = async () => {
    if (!currentUser || !staffData) return;
    
    const collectionAmount = staffWallet.walletAmount;
    const commissionAmount = staffWallet.commissionAmount;
    const amountToSend = commissionReceived ? collectionAmount - commissionAmount : collectionAmount;

    try {
      await addDoc(collection(db, "settlements"), {
        staffId: currentUser.uid,
        staffName: staffData.name || 'Staff Member',
        amount: collectionAmount,
        commission: commissionReceived ? commissionAmount : 0,
        amountToSend: amountToSend,
        status: 'pending',
        createdAt: new Date(),
        adminId: staffData.adminId,
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

  const handleCustomerSearch = async () => {
    if (!searchQuery.trim() || !staffData) return;
    setIsSearching(true);
    setSearchError("");
    setSearchedCustomer(null);

    try {
        const customersRef = collection(db, "customers");
        const q = query(customersRef, where("userId", "==", staffData.adminId));
        const querySnapshot = await getDocs(q);
        
        const allAdminCustomers = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));

        const trimmedSearchQuery = searchQuery.trim();
        const foundCustomer = allAdminCustomers.find(c => 
            (c.customerId && c.customerId.trim() === trimmedSearchQuery) || 
            (c.mobile && c.mobile.trim() === trimmedSearchQuery)
        );

        if (foundCustomer) {
            if (staffData.area.includes(foundCustomer.area)) {
                setSearchedCustomer(foundCustomer);
            } else {
                setSearchError("Customer found, but they are not in your assigned area.");
            }
        } else {
            setSearchError("Customer not found in your assigned areas or invalid ID/Mobile.");
        }
    } catch (error) {
        console.error("Error searching customer:", error);
        setSearchError("An error occurred while searching.");
    } finally {
        setIsSearching(false);
    }
  };

  const openCollectDialog = (customer: Customer) => {
    setAmountCollected(String(customer.balanceAmount));
    setPaymentMethod("cash");
    setIsCollectDialogOpen(true);
  };

  const handleConfirmCollection = async () => {
    if (!amountCollected || !searchedCustomer || !currentUser || !staffData) return;
    
    const collectedAmount = parseFloat(amountCollected);
    const currentBalance = parseFloat(String(searchedCustomer.balanceAmount));
    const newBalance = currentBalance - collectedAmount;

    try {
        const customerDocRef = doc(db, "customers", searchedCustomer.id);
        await updateDoc(customerDocRef, {
            balanceAmount: newBalance
        });

        await addDoc(collection(db, "payments"), {
            customerId: searchedCustomer.id,
            customerName: searchedCustomer.name,
            amount: collectedAmount,
            method: paymentMethod,
            collectedBy: currentUser.uid,
            collectionDate: new Date(),
            adminId: staffData.adminId,
        });

        toast({
            title: "Collection Recorded",
            description: `Collected ₹${amountCollected} from ${searchedCustomer.name} via ${paymentMethod}.`,
        });

        setIsCollectDialogOpen(false);
        setSearchedCustomer(null);
        setSearchQuery("");

    } catch (error) {
        console.error("Error recording collection:", error);
        toast({
            variant: "destructive",
            title: "Collection Failed",
            description: "An error occurred while recording the payment.",
        });
    }
  };

  const AdminCollectionCard = () => (
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

  const StaffCollectionCard = () => (
     <Card className="bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer" onClick={() => setIsCustomerSearchDialogOpen(true)}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
                My Collections
            </CardTitle>
            <IndianRupee className="h-4 w-4 text-primary-foreground" />
        </CardHeader>
        <CardContent>
            <p className="text-xs">
                View customers with outstanding balance
            </p>
        </CardContent>
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
    <div className="grid gap-4 md:grid-cols-2 lg:col-span-3">
        <SettlementRequestsCard />
        <AdminCollectionCard />
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
                Total Revenue
            </CardTitle>
            <CircleDollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
            <div className="text-2xl font-bold">₹{stats.totalRevenue.toLocaleString()}</div>
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
            <div className="text-2xl font-bold">{stats.activeCustomers}</div>
            </CardContent>
        </Card>
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Packages</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
            <div className="text-2xl font-bold">{stats.activePackages}</div>
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
            <div className="text-2xl font-bold">{stats.collectionAgents}</div>
            </CardContent>
        </Card>
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Collection</CardTitle>
            <CircleDollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
            <div className="text-2xl font-bold">₹{stats.todaysCollection.toLocaleString()}</div>
            </CardContent>
        </Card>
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month's Collection</CardTitle>
            <CircleDollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
            <div className="text-2xl font-bold">₹{stats.monthlyCollection.toLocaleString()}</div>
            </CardContent>
        </Card>
    </div>
  );

  const StaffDashboard = () => {
     const hasPendingRequest = settlementRequests.some(req => req.status === 'pending' && req.staffId === currentUser?.uid);
     
     const { walletAmount, commissionAmount } = staffWallet;

     return (
     <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <StaffCollectionCard />
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
                    {hasPendingRequest ? 'Approval Pending' : 'Send to Admin'}
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

    return (
        <div className="text-center">
            <p>Welcome! Your role is not fully configured.</p>
        </div>
    );
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
             {userRole && !firestoreLoading && (
                <Badge variant={userRole === "Admin" ? "default" : "secondary"} className="text-lg">
                   <ShieldCheck className="mr-2 h-5 w-5" />
                   {userRole} Role
                </Badge>
            )}
          </div>
          <p className="mt-4 max-w-3xl text-lg text-muted-foreground md:text-xl">
             { !firestoreLoading && getWelcomeMessage() }
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
                <span className="font-bold text-foreground">₹{staffWallet.walletAmount.toLocaleString()}</span> to the admin? This action cannot be undone.
            </DialogDescription>
        </DialogHeader>
        <div className="py-4">
            <div className="flex items-center space-x-2">
                <Checkbox id="commission-received" checked={commissionReceived} onCheckedChange={(checked) => setCommissionReceived(Boolean(checked))} />
                <Label htmlFor="commission-received">Commission Received (₹{staffWallet.commissionAmount.toLocaleString()})</Label>
            </div>
        </div>
        <DialogFooter>
            <Button variant="outline" onClick={() => setIsSettleDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSettleCollection}>Confirm & Send</Button>
        </DialogFooter>
        </DialogContent>
    </Dialog>

    <Dialog open={isCustomerSearchDialogOpen} onOpenChange={(isOpen) => {
        if (!isOpen) {
            setSearchedCustomer(null);
            setSearchQuery("");
            setSearchError("");
        }
        setIsCustomerSearchDialogOpen(isOpen);
    }}>
        <DialogContent className="sm:max-w-md">
            <DialogHeader>
                <DialogTitle>Find Customer Balance</DialogTitle>
                <DialogDescription>
                    Enter Customer ID or Mobile Number to find their pending balance.
                </DialogDescription>
            </DialogHeader>
            <div className="flex items-center space-x-2">
                <div className="grid flex-1 gap-2">
                    <Label htmlFor="search" className="sr-only">
                        Search
                    </Label>
                    <Input
                        id="search"
                        placeholder="Customer ID or Mobile..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <Button type="submit" size="sm" className="px-3" onClick={handleCustomerSearch} disabled={isSearching}>
                    {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    <span className="sr-only">Search</span>
                </Button>
            </div>
             <div className="mt-4 space-y-2">
                {searchError && <p className="text-sm font-medium text-destructive">{searchError}</p>}
                {searchedCustomer && (
                    <Card>
                        <CardHeader>
                            <CardTitle>{searchedCustomer.name}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-lg font-bold">
                                Pending Balance: <span className="text-primary">₹{searchedCustomer.balanceAmount.toLocaleString()}</span>
                            </p>
                            <Button className="w-full" onClick={() => openCollectDialog(searchedCustomer)}>
                                <HandCoins className="mr-2 h-4 w-4" />
                                Collect
                            </Button>
                        </CardContent>
                    </Card>
                )}
            </div>
            <DialogFooter className="sm:justify-start">
                <Button type="button" variant="secondary" onClick={() => setIsCustomerSearchDialogOpen(false)}>
                    Close
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>

    {searchedCustomer && (
        <Dialog open={isCollectDialogOpen} onOpenChange={setIsCollectDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Collect from {searchedCustomer.name}</DialogTitle>
              <DialogDescription>
                Record the payment collected from the customer. Amount due: ₹
                {searchedCustomer.balanceAmount}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="amount" className="text-right">
                  Amount (₹)
                </Label>
                <Input
                  id="amount"
                  type="number"
                  value={amountCollected}
                  onChange={(e) => setAmountCollected(e.target.value)}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Method</Label>
                <RadioGroup
                  defaultValue="cash"
                  className="col-span-3 flex items-center gap-4"
                  onValueChange={setPaymentMethod}
                  value={paymentMethod}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="cash" id="r-cash-dash" />
                    <Label htmlFor="r-cash-dash">Cash</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="upi" id="r-upi-dash" />
                    <Label htmlFor="r-upi-dash">UPI</Label>
                  </div>
                </RadioGroup>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" onClick={handleConfirmCollection}>
                Confirm Collection
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

    

    
