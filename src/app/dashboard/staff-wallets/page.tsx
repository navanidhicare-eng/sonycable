
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
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { collection, onSnapshot, query, where, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Badge } from "@/components/ui/badge";

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
}

interface Settlement {
  id: string;
  staffId: string;
  status: "pending" | "approved";
  createdAt: Timestamp;
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
    
    // A simple way to check if all initial loads are done
    const allQueries = [staffQuery, paymentsQuery, settlementsQuery, customersQuery, rechargesQuery];
    const promises = allQueries.map(q => new Promise(res => {
        const unsub = onSnapshot(q, () => {
            res(true);
            unsub(); // Unsubscribe after first snapshot
        });
    }));

    Promise.all(promises).finally(() => setLoading(false));

    return () => {
      unsubs.forEach(unsub => unsub());
    };
  }, [user, authLoading, toast]);


  const staffWalletDetails = useMemo(() => {
    return staffList.map(staff => {
      // Find the last approved settlement date for this staff member
      const lastSettlementDate = settlements
        .filter(s => s.staffId === staff.uid && s.status === 'approved')
        .reduce((latest, s) => {
          return !latest || s.createdAt.toDate() > latest ? s.createdAt.toDate() : latest;
        }, null as Date | null);
      
      // 1. Calculate Collection Amount (Wallet)
      const paymentsAfterSettlement = payments.filter(p => {
        if (p.collectedBy !== staff.uid) return false;
        if (!lastSettlementDate) return true;
        return p.collectionDate.toDate() > lastSettlementDate;
      });
      const totalCollection = paymentsAfterSettlement.reduce((sum, p) => sum + p.amount, 0);

      // 2. Calculate Collection Commission
      const collectionCommissionRate = parseFloat(staff.commission?.replace('%','')) || 0;
      const collectionCommission = (totalCollection * collectionCommissionRate) / 100;
      
      // 3. Calculate New Customer Enrollment Commission (One-Time)
      const enrollmentCommissionPerCustomer = staff.enrollmentCommission || 0;
      const newCustomersByStaff = customers.filter(c => {
          if (c.userId !== user?.uid || c.connectionReference !== staff.id) return false;
          if (!lastSettlementDate) return true; // If never settled, all are new
          return c.createdAt.toDate() > lastSettlementDate;
      });
      const totalEnrollmentCommission = newCustomersByStaff.length * enrollmentCommissionPerCustomer;

      // 4. Calculate Monthly Commission from Recharges of Referred Customers
      const referredCustomers = customers.filter(c => c.connectionReference === staff.id);
      let monthlyRechargeCommission = 0;

      referredCustomers.forEach(cust => {
          const monthlyCommRate = parseFloat(cust.monthlyCommission || '0');
          if (monthlyCommRate > 0) {
              const customerRecharges = recharges.filter(r => {
                  if (r.customerId !== cust.id) return false;
                  if (!lastSettlementDate) return true;
                  return r.rechargeDate.toDate() > lastSettlementDate;
              });
              const totalRechargeAmount = customerRecharges.reduce((sum, r) => sum + r.amount, 0);
              monthlyRechargeCommission += (totalRechargeAmount * monthlyCommRate) / 100;
          }
      });
      
      const totalCommission = collectionCommission + totalEnrollmentCommission + monthlyRechargeCommission;

      return {
        staffId: staff.id,
        staffName: staff.name,
        role: staff.role,
        walletAmount: totalCollection,
        commissionAmount: totalCommission,
      };
    });
  }, [staffList, payments, settlements, customers, recharges, user]);

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
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center">
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
    </main>
  );
}
