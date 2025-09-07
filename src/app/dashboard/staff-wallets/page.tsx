
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

    const unsubStaff = onSnapshot(staffQuery, (snapshot) => {
      setStaffList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Staff)));
    }, (error) => {
        toast({variant: "destructive", title: "Failed to load staff"});
        console.error("Staff fetch error:", error);
    });

    const unsubPayments = onSnapshot(paymentsQuery, (snapshot) => {
      setPayments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment)));
    }, (error) => {
        toast({variant: "destructive", title: "Failed to load payments"});
        console.error("Payments fetch error:", error);
    });

    const unsubSettlements = onSnapshot(settlementsQuery, (snapshot) => {
      setSettlements(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Settlement)));
    }, (error) => {
        toast({variant: "destructive", title: "Failed to load settlements"});
        console.error("Settlements fetch error:", error);
    });

    // We can set loading to false once staff is loaded, as calculations depend on it.
    Promise.all([new Promise(res => onSnapshot(staffQuery, res))])
        .then(() => setLoading(false))
        .catch(() => setLoading(false));

    return () => {
      unsubStaff();
      unsubPayments();
      unsubSettlements();
    };
  }, [user, authLoading, toast]);


  const staffWalletDetails = useMemo(() => {
    return staffList.map(staff => {
      const commissionRate = parseFloat(staff.commission.replace('%','')) || 0;

      // Find the last approved settlement date for this staff member
      const lastSettlementDate = settlements
        .filter(s => s.staffId === staff.uid && s.status === 'approved')
        .reduce((latest, s) => {
          return !latest || s.createdAt.toDate() > latest ? s.createdAt.toDate() : latest;
        }, null as Date | null);
      
      // Filter payments made by this staff after their last settlement
      const paymentsAfterSettlement = payments.filter(p => {
        if (p.collectedBy !== staff.uid) return false;
        if (!lastSettlementDate) return true; // Include all if never settled
        return p.collectionDate.toDate() > lastSettlementDate;
      });

      // Calculate total collection and commission
      const totalCollection = paymentsAfterSettlement.reduce((sum, p) => sum + p.amount, 0);
      const totalCommission = (totalCollection * commissionRate) / 100;

      return {
        staffId: staff.id,
        staffName: staff.name,
        role: staff.role,
        walletAmount: totalCollection,
        commissionAmount: totalCommission,
      };
    });
  }, [staffList, payments, settlements]);

  return (
    <main className="min-h-screen w-full font-body text-foreground">
      <div className="container mx-auto flex flex-col items-center p-4 py-8 md:p-12">
        <header className="mb-10 flex w-full max-w-4xl flex-col items-center text-center">
          <div>
            <h1 className="text-4xl font-bold tracking-tighter md:text-5xl">
              Staff Wallets
            </h1>
            <p className="mt-4 max-w-3xl text-lg text-muted-foreground md:text-xl">
              View current collection balances for each staff member.
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
