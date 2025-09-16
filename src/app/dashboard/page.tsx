
"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Users, Package, CircleDollarSign, UserCheck, ShieldCheck, IndianRupee, Wallet, ArrowRight, ArrowLeftRight, CheckCircle2, Loader2, Search, HandCoins, CreditCard, Gift } from "lucide-react";
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
import { collection, addDoc, onSnapshot, doc, updateDoc, query, where, getDocs, Timestamp, writeBatch, deleteDoc, runTransaction } from "firebase/firestore";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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

interface RechargeRequest {
    id: string;
    customerName: string;
    packageName: string;
    packageAmount: string;
    status: 'Pending' | 'Completed';
    requestDate: Timestamp;
    customerId: string;
    adminId: string;
}

interface DashboardStats {
    totalRevenue: number;
    activeCustomers: number;
    activePackages: number;
    collectionAgents: number;
    todaysCollection: number;
    monthlyCollection: number;
    totalPending: number;
}

interface StaffData {
    name: string;
    commission: string;
    enrollmentCommission?: number;
    adminId: string;
    area: string[];
    role: string;
}

interface Customer {
  id: string;
  name: string;
  balanceAmount: number;
  mobile: string;
  customerId: string;
  area: string;
  stbId: string;
  expiryDate?: Timestamp;
}

interface RechargePackage {
  id: string;
  packageName: string;
  packageAmount: string;
}

export default function DashboardPage() {
  const { user: currentUser, userRole, loading: authLoading } = useAuth();
  const [isSettleDialogOpen, setIsSettleDialogOpen] = useState(false);
  const { toast } = useToast();
  const [commissionReceived, setCommissionReceived] = useState(false);
  const [settlementRequests, setSettlementRequests] = useState<SettlementRequest[]>([]);
  const [rechargeRequests, setRechargeRequests] = useState<RechargeRequest[]>([]);
  const [firestoreLoading, setFirestoreLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
      totalRevenue: 0,
      activeCustomers: 0,
      activePackages: 0,
      collectionAgents: 0,
      todaysCollection: 0,
      monthlyCollection: 0,
      totalPending: 0,
  });
  const [staffWallet, setStaffWallet] = useState({ walletAmount: 0, commissionAmount: 0 });
  const [staffData, setStaffData] = useState<StaffData | null>(null);
  const [totalPendingForStaff, setTotalPendingForStaff] = useState(0);


  // States for Customer Search Dialog (Collections)
  const [isCustomerSearchDialogOpen, setIsCustomerSearchDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchedCustomer, setSearchedCustomer] = useState<Customer | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  // States for Collection Dialog
  const [isCollectDialogOpen, setIsCollectDialogOpen] = useState(false);
  const [amountCollected, setAmountCollected] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");

  // States for Recharge Dialog
  const [isRechargeSearchDialogOpen, setIsRechargeSearchDialogOpen] = useState(false);
  const [isRechargeDialogOpen, setIsRechargeDialogOpen] = useState(false);
  const [packages, setPackages] = useState<RechargePackage[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const [paymentReceivedForRecharge, setPaymentReceivedForRecharge] = useState(false);


  useEffect(() => {
    if (authLoading) return;
    if (!currentUser) {
      setFirestoreLoading(false);
      return;
    }
    
    setFirestoreLoading(true);

    const fetchAdminData = async () => {
        let unsubscribes: (() => void)[] = [];
        try {
            const customersQuery = query(collection(db, "customers"), where("userId", "==", currentUser.uid));
            const packagesQuery = query(collection(db, "packages"), where("userId", "==", currentUser.uid));
            const staffQuery = query(collection(db, "staff"), where("adminId", "==", currentUser.uid));

            const [customersSnapshot, packagesSnapshot, staffSnapshot] = await Promise.all([
                getDocs(customersQuery),
                getDocs(packagesQuery),
                getDocs(staffQuery),
            ]);

            const totalPending = customersSnapshot.docs.reduce((sum, doc) => sum + (doc.data().balanceAmount || 0), 0);

            setStats(prevStats => ({
                ...prevStats,
                activeCustomers: customersSnapshot.size,
                activePackages: packagesSnapshot.size,
                collectionAgents: staffSnapshot.size,
                totalPending: totalPending,
            }));

            const settlementsQuery = query(collection(db, "settlements"), where("adminId", "==", currentUser.uid));
            const rechargeRequestQuery = query(collection(db, "rechargeRequests"), where("adminId", "==", currentUser.uid), where("status", "==", "Pending"));
            
            const unsubscribeSettlements = onSnapshot(settlementsQuery, (snapshot) => {
                const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SettlementRequest));
                requests.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
                setSettlementRequests(requests);
            });
            const unsubscribeRechargeRequests = onSnapshot(rechargeRequestQuery, (snapshot) => {
                const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RechargeRequest));
                requests.sort((a,b) => b.requestDate.toMillis() - a.requestDate.toMillis());
                setRechargeRequests(requests);
            });
            
            unsubscribes.push(unsubscribeSettlements, unsubscribeRechargeRequests);

        } catch (error) {
            console.error("Error fetching admin stats:", error);
            toast({ variant: "destructive", title: "Error fetching stats" });
        } finally {
            setFirestoreLoading(false);
        }
        return unsubscribes;
    };

    const fetchStaffData = async () => {
        let unsubscribes: (() => void)[] = [];
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
            const isCollectionAgent = userRole ? /collection|collation/i.test(userRole) : false;

            const allCustomersQuery = query(collection(db, "customers"), where("userId", "==", staffDocData.adminId));
            const unsubscribeAllCustomers = onSnapshot(allCustomersQuery, (snapshot) => {
                const totalPending = snapshot.docs.reduce((sum, doc) => sum + (doc.data().balanceAmount || 0), 0);
                setTotalPendingForStaff(totalPending);
            });
            unsubscribes.push(unsubscribeAllCustomers);


            if (!isCollectionAgent) {
                const packagesQuery = query(collection(db, "packages"), where("userId", "==", staffDocData.adminId));
                const unsubscribePackages = onSnapshot(packagesQuery, (snapshot) => {
                    const packagesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RechargePackage));
                    setPackages(packagesData);
                });
                unsubscribes.push(unsubscribePackages);
            }
            

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

            unsubscribes.push(unsubscribePayments, unsubscribeSettlements);

        } catch(error) {
            console.error("Error fetching staff data:", error);
            toast({ variant: "destructive", title: "Error fetching staff data" });
        } finally {
             setFirestoreLoading(false);
        }
        return unsubscribes;
    };

    let allUnsubscribes: (() => void)[] = [];
    const fetchData = async () => {
      if (userRole === "Admin") {
        allUnsubscribes = (await fetchAdminData()) || [];
      } else if (userRole) { // Check if userRole is not null/empty
        allUnsubscribes = (await fetchStaffData()) || [];
      } else {
        setFirestoreLoading(false);
      }
    };

    fetchData();
    
    return () => {
      allUnsubscribes.forEach(unsub => unsub());
    };
  }, [currentUser, userRole, authLoading, toast]);


  const getWelcomeMessage = () => {
    if (userRole === "Admin") {
      return "Welcome, Admin!";
    }
    if (userRole) {
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
  };

  const handleApproveRechargeRequest = async (request: RechargeRequest) => {
    if (!currentUser) return;
    try {
      await runTransaction(db, async (transaction) => {
        const customerDocRef = doc(db, "customers", request.customerId);
        const customerDoc = await transaction.get(customerDocRef);

        if (!customerDoc.exists()) {
          throw new Error("Customer not found");
        }

        const customerData = customerDoc.data() as Customer;
        
        // If current plan hasn't expired, start new one from expiry date. Otherwise, start from today.
        const newRechargeDate = (customerData.expiryDate && customerData.expiryDate.toDate() > new Date()) 
            ? customerData.expiryDate.toDate() 
            : new Date();

        const newExpiryDate = new Date(newRechargeDate);
        newExpiryDate.setDate(newExpiryDate.getDate() + 30);
        
        transaction.update(customerDocRef, { 
            lastRechargeDate: Timestamp.fromDate(newRechargeDate),
            expiryDate: Timestamp.fromDate(newExpiryDate)
        });
        
        const rechargesColRef = collection(db, "recharges");
        const newRechargeRef = doc(rechargesColRef);
        transaction.set(newRechargeRef, {
            customerId: request.customerId,
            customerName: request.customerName,
            packageName: request.packageName,
            amount: parseFloat(request.packageAmount),
            paymentReceived: true, 
            rechargeDate: Timestamp.fromDate(newRechargeDate),
            rechargedBy: 'SYSTEM_AUTO', 
            adminId: currentUser.uid,
        });

        const requestDocRef = doc(db, "rechargeRequests", request.id);
        transaction.update(requestDocRef, { status: "Completed" });
      });

      toast({
        title: "Recharge Approved",
        description: `${request.customerName} has been automatically recharged with ${request.packageName}.`
      });

    } catch (error) {
        console.error("Error approving recharge request:", error);
        toast({
            variant: "destructive",
            title: "Approval Failed",
            description: "Could not approve the recharge request.",
        });
    }
  };
  
  const handleRejectRechargeRequest = async (requestId: string) => {
    try {
        const requestDocRef = doc(db, "rechargeRequests", requestId);
        await deleteDoc(requestDocRef);
        toast({
            title: "Request Rejected",
            description: "The recharge request has been rejected and removed.",
        });
    } catch (error) {
         console.error("Error rejecting recharge request:", error);
        toast({
            variant: "destructive",
            title: "Rejection Failed",
            description: "Could not reject the recharge request.",
        });
    }
  };


  const handleCustomerSearch = async (type: 'collection' | 'recharge') => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    setSearchError("");
    setSearchedCustomer(null);

    try {
        let currentStaffData = staffData;
        if (!currentStaffData && currentUser) {
            const staffQuery = query(collection(db, "staff"), where("uid", "==", currentUser.uid));
            const staffSnapshot = await getDocs(staffQuery);
            if (!staffSnapshot.empty) {
                currentStaffData = staffSnapshot.docs[0].data() as StaffData;
                setStaffData(currentStaffData);
            } else {
                 setSearchError("Could not find your staff profile.");
                 setIsSearching(false);
                 return;
            }
        }

        if (!currentStaffData) {
            setSearchError("Could not verify your staff details.");
            setIsSearching(false);
            return;
        }

        const customersRef = collection(db, "customers");
        const q = query(customersRef, where("userId", "==", currentStaffData.adminId));
        const querySnapshot = await getDocs(q);
        
        const allAdminCustomers = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));

        const trimmedSearchQuery = searchQuery.trim().toLowerCase();
        
        const foundCustomer = allAdminCustomers.find(c => {
            const matchesSearchTerm = 
                (c.customerId && c.customerId.trim().toLowerCase() === trimmedSearchQuery) || 
                (c.mobile && c.mobile.trim() === searchQuery.trim()) ||
                (c.stbId && c.stbId.trim().toLowerCase() === trimmedSearchQuery) ||
                (c.name && c.name.trim().toLowerCase().includes(trimmedSearchQuery));
            
            const isInAssignedArea = currentStaffData!.area.includes(c.area);

            return matchesSearchTerm && isInAssignedArea;
        });


        if (foundCustomer) {
            setSearchedCustomer(foundCustomer);
            if (type === 'recharge') {
                openRechargeDialog(foundCustomer);
            }
        } else {
            setSearchError("Customer not found in your assigned areas or invalid ID/Mobile/Name.");
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
  
  const openRechargeDialog = (customer: Customer) => {
    setSearchedCustomer(customer);
    setSelectedPackage(null);
    setPaymentReceivedForRecharge(false);
    setIsRechargeDialogOpen(true);
    setIsRechargeSearchDialogOpen(false);
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
        setIsCustomerSearchDialogOpen(false);
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
  
    const handleRecharge = async () => {
    if (!selectedPackage || !searchedCustomer || !currentUser || !staffData) return;
    
    const pkg = packages.find(p => p.id === selectedPackage);
    if (!pkg) {
      toast({ variant: "destructive", title: "Package not found" });
      return;
    }

    const rechargeAmount = parseFloat(pkg.packageAmount);
    let description;
    const customerDocRef = doc(db, "customers", searchedCustomer.id);

    try {
        const newRechargeDate = new Date();
        const newExpiryDate = new Date(newRechargeDate);
        newExpiryDate.setDate(newExpiryDate.getDate() + 30);

        let updateData: any = {
            expiryDate: Timestamp.fromDate(newExpiryDate),
            lastRechargeDate: Timestamp.fromDate(newRechargeDate),
        };

        if (paymentReceivedForRecharge) {
            description = `${searchedCustomer.name} has been recharged with ${pkg.packageName} for ₹${rechargeAmount}. Payment received.`;
        } else {
            const currentBalance = parseFloat(String(searchedCustomer.balanceAmount));
            const newBalance = currentBalance + rechargeAmount;
            updateData.balanceAmount = newBalance;
            description = `${searchedCustomer.name} has been recharged with ${pkg.packageName}. ₹${rechargeAmount} added to collection balance.`;
        }

        await updateDoc(customerDocRef, updateData);

        await addDoc(collection(db, "recharges"), {
            customerId: searchedCustomer.id,
            customerName: searchedCustomer.name,
            packageId: pkg.id,
            packageName: pkg.packageName,
            amount: rechargeAmount,
            paymentReceived: paymentReceivedForRecharge,
            rechargeDate: newRechargeDate,
            rechargedBy: currentUser.uid, // staff uid
            adminId: staffData.adminId, // admin uid
        });
      
        toast({
            title: "Recharge Successful",
            description: description,
        });

        setIsRechargeDialogOpen(false);
        setSelectedPackage(null);
        setPaymentReceivedForRecharge(false);
        setSearchedCustomer(null);

    } catch (error) {
        console.error("Recharge failed:", error);
         toast({
            variant: "destructive",
            title: "Recharge Failed",
            description: "An error occurred while processing the recharge.",
        });
    }
  };


  const AdminCollectionCard = () => (
    <Card className="bg-primary text-primary-foreground hover:bg-primary/90 transition-colors animate-slide-in-fade-in">
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
  
  const StaffRechargeCard = () => (
    <Card className="bg-green-600 text-white hover:bg-green-700 transition-colors cursor-pointer" onClick={() => setIsRechargeSearchDialogOpen(true)}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
                Recharge
            </CardTitle>
            <CreditCard className="h-4 w-4 text-white" />
        </CardHeader>
        <CardContent>
            <div className="flex items-center justify-between">
                <p className="text-xs">
                    Recharge a customer account
                </p>
                <ArrowRight className="h-5 w-5" />
            </div>
        </CardContent>
    </Card>
  );


   const RechargeRequestsCard = () => {
    if (rechargeRequests.length === 0) return null;

    return (
        <Card className="md:col-span-2 lg:col-span-3 animate-slide-in-fade-in">
            <CardHeader>
                <CardTitle>Recharge Requests</CardTitle>
                 <CardDescription>The following requests were automatically generated by customers with auto-subscription enabled.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {rechargeRequests.map(req => (
                    <div key={req.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between rounded-lg border p-3 gap-2">
                        <div>
                            <p className="font-semibold">{req.customerName}</p>
                            <p className="text-sm text-muted-foreground">
                                Requested <span className="font-bold text-foreground">{req.packageName} (₹{req.packageAmount})</span>
                            </p>
                        </div>
                        <div className="flex gap-2 self-end sm:self-center">
                            <Button size="sm" onClick={() => handleApproveRechargeRequest(req)}>
                                Approve
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => handleRejectRechargeRequest(req.id)}>
                                Reject
                            </Button>
                        </div>
                    </div>
                ))}
            </CardContent>
        </Card>
    );
   };
   
   const SettlementRequestsCard = () => {
    const pendingRequests = settlementRequests.filter(r => r.status === 'pending');
    if(pendingRequests.length === 0) return null;

    return (
         <Card className="md:col-span-2 lg:col-span-3 animate-slide-in-fade-in">
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
        <RechargeRequestsCard />
        <SettlementRequestsCard />
        <AdminCollectionCard />
        <Card className="bg-red-100 text-red-800 animate-slide-in-fade-in">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Outstanding</CardTitle>
            <CircleDollarSign className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
            <div className="text-2xl font-bold">₹{stats.totalPending.toLocaleString()}</div>
            </CardContent>
        </Card>
        <Card className="bg-green-100 text-green-800 animate-slide-in-fade-in">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
                Active Customers
            </CardTitle>
            <Users className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
            <div className="text-2xl font-bold">{stats.activeCustomers}</div>
            </CardContent>
        </Card>
        <Card className="bg-blue-100 text-blue-800 animate-slide-in-fade-in">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Packages</CardTitle>
            <Package className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
            <div className="text-2xl font-bold">{stats.activePackages}</div>
            </CardContent>
        </Card>
        <Card className="bg-yellow-100 text-yellow-800 animate-slide-in-fade-in">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
                All Collection Agents
            </CardTitle>
            <UserCheck className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
            <div className="text-2xl font-bold">{stats.collectionAgents}</div>
            </CardContent>
        </Card>
        <Card className="bg-indigo-100 text-indigo-800 animate-slide-in-fade-in">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Collection</CardTitle>
            <CircleDollarSign className="h-4 w-4 text-indigo-500" />
            </CardHeader>
            <CardContent>
            <div className="text-2xl font-bold">₹{stats.todaysCollection.toLocaleString()}</div>
            </CardContent>
        </Card>
        <Card className="bg-purple-100 text-purple-800 animate-slide-in-fade-in">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month's Collection</CardTitle>
            <CircleDollarSign className="h-4 w-4 text-purple-500" />
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
     const isCollectionAgent = userRole ? /collection|collation/i.test(userRole) : false;

     return (
     <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        { !isCollectionAgent && (
            <>
                <StaffRechargeCard />
                <Card className="bg-red-100 text-red-800">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Outstanding Balance</CardTitle>
                        <CircleDollarSign className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">₹{totalPendingForStaff.toLocaleString()}</div>
                    </CardContent>
                </Card>
            </>
        )}
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
                ఈ నెల మీ మొత్తం కమీషన్ (కలెక్షన్ + కొత్త కస్టమర్ల కమీషన్)
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
        <Card className="md:col-span-2 lg:col-span-3">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Gift className="h-5 w-5 text-primary" />
                    మీ కమీషన్ ప్రయోజనాలు
                </CardTitle>
                <CardDescription>మీరు సంపాదించడానికి ఇక్కడ కొన్ని మార్గాలు ఉన్నాయి:</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
                <div>
                    <h4 className="font-semibold">కలెక్షన్ కమీషన్</h4>
                    <p className="text-muted-foreground">మీరు కస్టమర్ల నుండి వసూలు చేసే మొత్తం డబ్బుపై మీకు {staffData?.commission || 'N/A'} కమీషన్ వస్తుంది.</p>
                </div>
                <div>
                    <h4 className="font-semibold">కొత్త కస్టమర్ కమీషన్</h4>
                    <p className="text-muted-foreground">మీరు చేర్పించే ప్రతి కొత్త కస్టమర్‌కు, మీకు ఒకేసారి ₹{staffData?.enrollmentCommission?.toLocaleString() || 'N/A'} స్థిరమైన కమీషన్ లభిస్తుంది.</p>
                </div>
                <div>
                    <h4 className="font-semibold">నెలవారీ రీఛార్జ్ కమీషన్</h4>
                    <p className="text-muted-foreground">మీరు రిఫర్ చేసిన కస్టమర్లు చేసే ప్రతి నెలవారీ రీఛార్జ్‌పై మీకు ముందుగా నిర్ణయించిన శాతం ప్రకారం కమీషన్ వస్తుంది.</p>
                </div>
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
    if (userRole) return <StaffDashboard />;

    return (
        <div className="text-center">
            <p>Welcome! Your role is not fully configured.</p>
        </div>
    );
  };
  
    const cleanupSearchDialog = (setDialogOpen: (val: boolean) => void) => {
        setDialogOpen(false);
        setSearchedCustomer(null);
        setSearchQuery("");
        setSearchError("");
    };

    const selectedPackageDetails = selectedPackage ? packages.find(p => p.id === selectedPackage) : null;
    const newBalance = searchedCustomer && selectedPackageDetails && !paymentReceivedForRecharge
        ? parseFloat(String(searchedCustomer.balanceAmount)) + parseFloat(selectedPackageDetails.packageAmount)
        : searchedCustomer?.balanceAmount;


  return (
    <>
    <main className="min-h-screen w-full font-body text-foreground">
      <div className="container mx-auto p-4 py-8 md:p-12">
        <header className="mb-10">
          <div className="flex items-center gap-4">
             <h1 className="text-4xl font-bold tracking-tighter md:text-5xl">
                Dashboard
             </h1>
             {userRole && !authLoading && !firestoreLoading && (
                <Badge variant={userRole === "Admin" ? "default" : "secondary"} className="text-lg">
                   <ShieldCheck className="mr-2 h-5 w-5" />
                   {userRole}
                </Badge>
            )}
          </div>
          <p className="mt-4 max-w-3xl text-lg text-muted-foreground md:text-xl">
             { !authLoading && !firestoreLoading && getWelcomeMessage() }
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
        if (!isOpen) cleanupSearchDialog(setIsCustomerSearchDialogOpen);
        else setIsCustomerSearchDialogOpen(true);
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
                        placeholder="Customer ID, Mobile, Name..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <Button type="submit" size="sm" className="px-3" onClick={() => handleCustomerSearch('collection')} disabled={isSearching}>
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
                             <p className="text-sm text-muted-foreground">Area: {searchedCustomer.area}</p>
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
                <Button type="button" variant="secondary" onClick={() => cleanupSearchDialog(setIsCustomerSearchDialogOpen)}>
                    Close
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
    
    <Dialog open={isRechargeSearchDialogOpen} onOpenChange={(isOpen) => {
        if (!isOpen) cleanupSearchDialog(setIsRechargeSearchDialogOpen);
        else setIsRechargeSearchDialogOpen(true);
    }}>
        <DialogContent className="sm:max-w-md">
            <DialogHeader>
                <DialogTitle>Recharge Customer</DialogTitle>
                <DialogDescription>
                    Enter Customer ID, Mobile, STB ID or Name to find a customer to recharge.
                </DialogDescription>
            </DialogHeader>
            <div className="flex items-center space-x-2">
                <div className="grid flex-1 gap-2">
                    <Label htmlFor="recharge-search" className="sr-only">
                        Search
                    </Label>
                    <Input
                        id="recharge-search"
                        placeholder="Customer ID, Mobile, Name..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <Button type="submit" size="sm" className="px-3" onClick={() => handleCustomerSearch('recharge')} disabled={isSearching}>
                    {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    <span className="sr-only">Search</span>
                </Button>
            </div>
             <div className="mt-4 space-y-2">
                {searchError && <p className="text-sm font-medium text-destructive">{searchError}</p>}
            </div>
            <DialogFooter className="sm:justify-start">
                <Button type="button" variant="secondary" onClick={() => cleanupSearchDialog(setIsRechargeSearchDialogOpen)}>
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
      
       {searchedCustomer && userRole?.toLowerCase().replace(/\s/g, '') !== 'collectionagent' && (
         <Dialog open={isRechargeDialogOpen} onOpenChange={(isOpen) => {
            if(!isOpen) setSearchedCustomer(null);
            setIsRechargeDialogOpen(isOpen);
         }}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Recharge for {searchedCustomer.name}</DialogTitle>
                    <DialogDescription>Select a package to continue with the recharge.</DialogDescription>
                    <div className="text-sm">
                        Current Balance: <span className="font-bold text-lg">₹{searchedCustomer.balanceAmount}</span>
                    </div>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="package" className="text-right">Package</Label>
                        <Select onValueChange={setSelectedPackage}>
                            <SelectTrigger className="col-span-3">
                                <SelectValue placeholder="Select a package" />
                            </SelectTrigger>
                            <SelectContent>
                                {packages.map((pkg) => (
                                    <SelectItem key={pkg.id} value={pkg.id}>
                                        {pkg.packageName} - ₹{pkg.packageAmount}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {selectedPackageDetails && (
                        <div className="space-y-2 rounded-md bg-muted p-3 text-sm">
                            <div className="flex justify-between">
                                <span>New Balance After Recharge:</span>
                                <span className="font-bold text-base">₹{newBalance?.toLocaleString()}</span>
                            </div>
                             {paymentReceivedForRecharge && (
                                <p className="text-xs text-muted-foreground">Amount will not be added to balance.</p>
                            )}
                        </div>
                    )}
                    
                    <div className="flex items-center space-x-2 justify-center pt-2">
                        <Checkbox 
                        id="payment-received-recharge" 
                        checked={paymentReceivedForRecharge} 
                        onCheckedChange={(checked) => setPaymentReceivedForRecharge(Boolean(checked))}
                        />
                        <Label htmlFor="payment-received-recharge" className="text-xs">Payment Received (amount will not be added to balance)</Label>
                    </div>
                </div>
                <DialogFooter>
                    <Button type="button" onClick={handleRecharge} disabled={!selectedPackage}>Confirm Recharge</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
       )}
    </>
  );
}
