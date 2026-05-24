"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, ArrowLeft, ArrowRight, History, Calendar, Wallet } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { collection, onSnapshot, query, where, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Staff {
  id: string;
  uid: string;
  name: string;
  role: string;
  commission: string;
  enrollmentCommission?: number;
}

interface Payment {
  id: string;
  collectedBy: string;
  amount: number;
  collectionDate: Timestamp;
  customerName?: string;
}

interface Settlement {
  id: string;
  staffId: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  createdAt: Timestamp;
  amount?: number;
  commission?: number;
  amountToSend?: number;
}

interface Customer {
    id: string;
    connectionReference?: string;
    monthlyCommission?: string;
    createdAt: Timestamp;
    userId: string;
}

interface Recharge {
    id: string;
    customerId: string;
    amount: number;
    rechargeDate: Timestamp;
}

interface StaffWalletInfo {
  staffId: string;
  staffUid: string;
  staffName: string;
  role: string;
  walletAmount: number;
  commissionAmount: number;
}

export default function StaffWalletsPage() {
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [recharges, setRecharges] = useState<Recharge[]>([]);
  const [loading, setLoading] = useState(true);

  // Detail View State
  const [selectedStaff, setSelectedStaff] = useState<StaffWalletInfo | null>(null);
  const [settlementPage, setSettlementPage] = useState(1);
  const [collectionPage, setCollectionPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    setSettlementPage(1);
    setCollectionPage(1);
  }, [selectedStaff]);

  useEffect(() => {
    if (authLoading || !user) {
      if (!authLoading) setLoading(false);
      return;
    }

    setLoading(true);
    
    const staffQuery = query(collection(db, "staff"), where("adminId", "==", user.uid));
    const paymentsQuery = query(collection(db, "payments"), where("adminId", "==", user.uid));
    const settlementsQuery = query(collection(db, "settlements"), where("adminId", "==", user.uid));
    const customersQuery = query(collection(db, "customers"), where("userId", "==", user.uid));
    const rechargesQuery = query(collection(db, "recharges"), where("adminId", "==", user.uid));

    const unsubs = [
        onSnapshot(staffQuery, (snapshot) => setStaffList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Staff))), (error) => {
            toast({variant: "destructive", title: "Failed to load staff"});
            console.error("Staff fetch error:", error);
        }),
        onSnapshot(paymentsQuery, (snapshot) => setPayments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment))), (error) => {
            toast({variant: "destructive", title: "Failed to load payments"});
            console.error("Payments fetch error:", error);
        }),
        onSnapshot(settlementsQuery, (snapshot) => setSettlements(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Settlement))), (error) => {
            toast({variant: "destructive", title: "Failed to load settlements"});
            console.error("Settlements fetch error:", error);
        }),
        onSnapshot(customersQuery, (snapshot) => setCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer))), (error) => {
            toast({variant: "destructive", title: "Failed to load customers"});
            console.error("Customers fetch error:", error);
        }),
        onSnapshot(rechargesQuery, (snapshot) => setRecharges(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Recharge))), (error) => {
            toast({variant: "destructive", title: "Failed to load recharges"});
            console.error("Recharges fetch error:", error);
        })
    ];
    
    const allQueries = [staffQuery, paymentsQuery, settlementsQuery, customersQuery, rechargesQuery];
    const promises = allQueries.map(q => new Promise(res => {
        const unsub = onSnapshot(q, () => {
            res(true);
            unsub();
        });
    }));

    Promise.all(promises).finally(() => setLoading(false));

    return () => {
      unsubs.forEach(unsub => unsub());
    };
  }, [user, authLoading, toast]);

  const staffWalletDetails = useMemo(() => {
    return staffList.map(staff => {
      // 1. Calculate Collection Amount (Wallet)
      const staffPayments = payments.filter(p => p.collectedBy === staff.uid);
      const totalCollectionEver = staffPayments.reduce((sum, p) => sum + p.amount, 0);

      const approvedStaffSettlements = settlements.filter(s => s.staffId === staff.uid && s.status === 'approved');
      const totalSettledEver = approvedStaffSettlements.reduce((sum, s) => sum + (s.amount || 0), 0);
      const totalSettledCommissionEver = approvedStaffSettlements.reduce((sum, s) => sum + (s.commission || 0), 0);

      const walletAmount = totalCollectionEver - totalSettledEver;

      // 2. Calculate Collection Commission
      const collectionCommissionRate = parseFloat(staff.commission?.replace('%','')) || 0;
      const collectionCommissionEver = (totalCollectionEver * collectionCommissionRate) / 100;
      
      // 3. Calculate New Customer Enrollment Commission (One-Time)
      const enrollmentCommissionPerCustomer = staff.enrollmentCommission || 0;
      const customersByStaff = customers.filter(c => {
          return c.userId === user?.uid && c.connectionReference === staff.id;
      });
      const enrollmentCommissionEver = customersByStaff.length * enrollmentCommissionPerCustomer;

      // 4. Calculate Monthly Commission from Recharges of Referred Customers
      const referredCustomers = customers.filter(c => c.connectionReference === staff.id);
      let monthlyRechargeCommissionEver = 0;

      referredCustomers.forEach(cust => {
          const monthlyCommRate = parseFloat(cust.monthlyCommission || '0');
          if (monthlyCommRate > 0) {
              const customerRecharges = recharges.filter(r => r.customerId === cust.id);
              const totalRechargeAmount = customerRecharges.reduce((sum, r) => sum + r.amount, 0);
              monthlyRechargeCommissionEver += (totalRechargeAmount * monthlyCommRate) / 100;
          }
      });
      
      const totalCommissionEver = collectionCommissionEver + enrollmentCommissionEver + monthlyRechargeCommissionEver;
      const commissionAmount = Math.max(0, totalCommissionEver - totalSettledCommissionEver);

      return {
        staffId: staff.id,
        staffUid: staff.uid,
        staffName: staff.name,
        role: staff.role,
        walletAmount: walletAmount,
        commissionAmount: commissionAmount,
      };
    });
  }, [staffList, payments, settlements, customers, recharges, user]);

  // Compute Settlement History for Selected Staff
  const selectedStaffSettlements = useMemo(() => {
    if (!selectedStaff) return [];

    const approvedSettlements = settlements
      .filter(s => s.staffId === selectedStaff.staffUid && s.status === 'approved')
      .sort((a, b) => a.createdAt.toMillis() - b.createdAt.toMillis());

    const staffPayments = payments
      .filter(p => p.collectedBy === selectedStaff.staffUid)
      .sort((a, b) => a.collectionDate.toMillis() - b.collectionDate.toMillis());

    return approvedSettlements.map((s, index) => {
      const settlementTime = s.createdAt.toDate();
      
      const collectionsUpTo = staffPayments
        .filter(p => p.collectionDate.toDate() <= settlementTime)
        .reduce((sum, p) => sum + p.amount, 0);

      const settlementsUpTo = approvedSettlements
        .slice(0, index + 1)
        .reduce((sum, item) => sum + (item.amount || 0), 0);

      const remainingBalance = collectionsUpTo - settlementsUpTo;

      return {
        id: s.id,
        date: settlementTime,
        amount: s.amount || 0,
        amountToSend: s.amountToSend || 0,
        commission: s.commission || 0,
        remainingBalance: remainingBalance,
      };
    }).sort((a, b) => b.date.getTime() - a.date.getTime()); // Newest first
  }, [selectedStaff, settlements, payments]);

  // Compute Collection Trace details
  const selectedStaffCollections = useMemo(() => {
    if (!selectedStaff) return [];

    const staffPayments = payments
      .filter(p => p.collectedBy === selectedStaff.staffUid)
      .sort((a, b) => b.collectionDate.toMillis() - a.collectionDate.toMillis()); // Newest first

    const walletAmount = selectedStaff.walletAmount;

    let runningSum = 0;
    return staffPayments.map(p => {
      const paymentAmount = p.amount;
      runningSum += paymentAmount;

      let status: 'Active (Unsettled)' | 'Partially Settled' | 'Settled' = 'Settled';
      let activeAmount = 0;

      if (runningSum <= walletAmount) {
        status = 'Active (Unsettled)';
        activeAmount = paymentAmount;
      } else if (runningSum - paymentAmount < walletAmount) {
        status = 'Partially Settled';
        activeAmount = walletAmount - (runningSum - paymentAmount);
      } else {
        status = 'Settled';
        activeAmount = 0;
      }

      return {
        id: p.id,
        date: p.collectionDate.toDate(),
        amount: paymentAmount,
        customerName: p.customerName || 'Unknown Customer',
        status,
        activeAmount,
      };
    });
  }, [selectedStaff, payments]);

  // Pagination Computations
  const paginatedSettlements = useMemo(() => {
    const start = (settlementPage - 1) * itemsPerPage;
    return selectedStaffSettlements.slice(start, start + itemsPerPage);
  }, [selectedStaffSettlements, settlementPage]);

  const totalSettlementPages = Math.ceil(selectedStaffSettlements.length / itemsPerPage) || 1;

  const paginatedCollections = useMemo(() => {
    const start = (collectionPage - 1) * itemsPerPage;
    return selectedStaffCollections.slice(start, start + itemsPerPage);
  }, [selectedStaffCollections, collectionPage]);

  const totalCollectionPages = Math.ceil(selectedStaffCollections.length / itemsPerPage) || 1;

  return (
    <main className="min-h-screen w-full font-body text-foreground">
      <div className="container mx-auto flex flex-col items-center p-4 py-8 md:p-12">
        <header className="mb-10 flex w-full max-w-4xl flex-col items-center text-center">
          <div>
            <h1 className="text-4xl font-bold tracking-tighter md:text-5xl">
              Staff Wallets
            </h1>
            <p className="mt-4 max-w-3xl text-lg text-muted-foreground md:text-xl">
              View current collection balances and total earned commissions for each staff member.
            </p>
          </div>
        </header>
        <Card className="w-full max-w-4xl">
          <CardHeader>
            <CardTitle>Wallet Balances</CardTitle>
          </CardHeader>
          <CardContent>
            {loading || authLoading ? (
              <div className="flex justify-center items-center h-40">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Staff Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Wallet Amount (₹)</TableHead>
                    <TableHead>Commission Earned (₹)</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {staffWalletDetails.length > 0 ? (
                    staffWalletDetails.map((staff) => (
                      <TableRow key={staff.staffId}>
                        <TableCell className="font-medium">{staff.staffName}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{staff.role}</Badge>
                        </TableCell>
                        <TableCell className="font-semibold">
                          ₹{staff.walletAmount.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-primary font-semibold">
                          ₹{staff.commissionAmount.toLocaleString(undefined, {maximumFractionDigits: 2})}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="outline" size="sm" onClick={() => setSelectedStaff(staff)}>
                            <History className="mr-2 h-4 w-4" /> View History
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center">
                        No staff members found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Staff Wallet Details Modal */}
      {selectedStaff && (
        <Dialog open={!!selectedStaff} onOpenChange={(open) => { if (!open) setSelectedStaff(null); }}>
          <DialogContent className="max-w-4xl w-full max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                <Wallet className="h-6 w-6 text-primary" />
                {selectedStaff.staffName}'s Wallet Details
              </DialogTitle>
              <DialogDescription>
                Role: {selectedStaff.role} | Current Wallet Balance: <span className="font-bold text-foreground">₹{selectedStaff.walletAmount.toLocaleString()}</span>
              </DialogDescription>
            </DialogHeader>

            <Tabs defaultValue="settlements" className="w-full mt-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="settlements">Settlement History</TabsTrigger>
                <TabsTrigger value="collections">Recent Collections (Trace)</TabsTrigger>
              </TabsList>

              {/* Settlements History Tab */}
              <TabsContent value="settlements" className="space-y-4 pt-2">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Settled Amount (₹)</TableHead>
                      <TableHead>Net Sent (₹)</TableHead>
                      <TableHead>Commission Paid (₹)</TableHead>
                      <TableHead className="text-right">Wallet Balance After</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedSettlements.length > 0 ? (
                      paginatedSettlements.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                            {item.date.toLocaleDateString("en-CA")}
                          </TableCell>
                          <TableCell className="font-semibold">₹{item.amount.toLocaleString()}</TableCell>
                          <TableCell>₹{item.amountToSend.toLocaleString()}</TableCell>
                          <TableCell className="text-green-600 font-medium">₹{item.commission.toLocaleString()}</TableCell>
                          <TableCell className="text-right font-bold text-primary">₹{item.remainingBalance.toLocaleString()}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="h-24 text-center">
                          No settlements recorded.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>

                {selectedStaffSettlements.length > itemsPerPage && (
                  <div className="flex items-center justify-between mt-4 border-t pt-4">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setSettlementPage(p => Math.max(1, p - 1))} 
                      disabled={settlementPage === 1}
                    >
                      <ArrowLeft className="mr-2 h-4 w-4" /> Previous
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Page {settlementPage} of {totalSettlementPages} (Total {selectedStaffSettlements.length} settlements)
                    </span>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setSettlementPage(p => Math.min(totalSettlementPages, p + 1))} 
                      disabled={settlementPage === totalSettlementPages}
                    >
                      Next <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                )}
              </TabsContent>

              {/* Collections Trace Tab */}
              <TabsContent value="collections" className="space-y-4 pt-2">
                <div className="text-xs text-muted-foreground bg-muted p-3 rounded-md">
                  💡 Collections are highlighted to show which payments currently compose the unsettled wallet balance (₹{selectedStaff.walletAmount.toLocaleString()}).
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Customer Name</TableHead>
                      <TableHead>Amount (₹)</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Active in Wallet (₹)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedCollections.length > 0 ? (
                      paginatedCollections.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                            {item.date.toLocaleDateString("en-CA")}
                          </TableCell>
                          <TableCell className="font-semibold">{item.customerName}</TableCell>
                          <TableCell>₹{item.amount.toLocaleString()}</TableCell>
                          <TableCell>
                            {item.status === "Active (Unsettled)" && (
                              <Badge variant="destructive">Active (Unsettled)</Badge>
                            )}
                            {item.status === "Partially Settled" && (
                              <Badge className="bg-amber-500 text-white hover:bg-amber-600">Partially Settled</Badge>
                            )}
                            {item.status === "Settled" && (
                              <Badge variant="secondary">Settled</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-bold text-primary">
                            ₹{item.activeAmount.toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="h-24 text-center">
                          No collections recorded.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>

                {selectedStaffCollections.length > itemsPerPage && (
                  <div className="flex items-center justify-between mt-4 border-t pt-4">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setCollectionPage(p => Math.max(1, p - 1))} 
                      disabled={collectionPage === 1}
                    >
                      <ArrowLeft className="mr-2 h-4 w-4" /> Previous
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Page {collectionPage} of {totalCollectionPages} (Total {selectedStaffCollections.length} collections)
                    </span>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setCollectionPage(p => Math.min(totalCollectionPages, p + 1))} 
                      disabled={collectionPage === totalCollectionPages}
                    >
                      Next <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      )}
    </main>
  );
}
