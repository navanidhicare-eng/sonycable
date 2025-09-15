
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, getDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Gift, Copy, Users, Wallet } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';

interface Customer {
  id: string;
  name: string;
  customerId: string;
  referralBonus?: number;
}

interface ReferredCustomer {
    id: string;
    name: string;
    createdAt: any;
    status: 'Pending First Recharge' | 'Bonus Awarded';
}

const REFERRAL_BONUS_AMOUNT = 50;

export default function ReferralBonusPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [referredCustomers, setReferredCustomers] = useState<ReferredCustomer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading || !user) {
      if (!authLoading) setLoading(false);
      return;
    }

    const fetchCustomerData = async () => {
      setLoading(true);
      
      const customerQuery = query(collection(db, "customers"), where("uid", "==", user.uid));
      const unsubscribeCustomer = onSnapshot(customerQuery, (snapshot) => {
        if (!snapshot.empty) {
          const customerDoc = snapshot.docs[0];
          const customerData = { id: customerDoc.id, ...customerDoc.data() } as Customer;
          setCustomer(customerData);

          // Now fetch referred customers
          const referredQuery = query(collection(db, "customers"), where("connectionReference", "==", customerData.customerId));
          const unsubscribeReferred = onSnapshot(referredQuery, async (referredSnapshot) => {
              const referredList: ReferredCustomer[] = [];
              const batch = writeBatch(db);
              let shouldCommit = false;

              for (const doc of referredSnapshot.docs) {
                  const data = doc.data();
                  let status: ReferredCustomer['status'] = 'Pending First Recharge';

                  // Check if this referral's bonus has already been processed
                  if (!data.referralBonusAwarded) {
                      const rechargesQuery = query(collection(db, "recharges"), where("customerId", "==", doc.id));
                      const rechargesSnapshot = await getDocs(rechargesQuery);
                      
                      if (!rechargesSnapshot.empty) { // Customer has recharged
                          status = 'Bonus Awarded';
                          
                          // Award bonus to the referrer
                          const referrerDocRef = doc(db, 'customers', customerData.id);
                          const referrerDoc = await getDoc(referrerDocRef);
                          const currentBalance = referrerDoc.data()?.balanceAmount || 0;
                          
                          batch.update(referrerDocRef, {
                            balanceAmount: currentBalance - REFERRAL_BONUS_AMOUNT, // Reducing balance is like giving credit
                            referralBonus: (referrerDoc.data()?.referralBonus || 0) + REFERRAL_BONUS_AMOUNT,
                          });
                          
                          // Mark this referred customer as bonus awarded
                          batch.update(doc.ref, { referralBonusAwarded: true });
                          shouldCommit = true;
                      }
                  } else {
                    status = 'Bonus Awarded';
                  }

                  referredList.push({
                      id: doc.id,
                      name: data.name,
                      createdAt: data.createdAt.toDate().toLocaleDateString('en-CA'),
                      status: status,
                  });
              }

              if (shouldCommit) {
                  await batch.commit();
                  toast({ title: "Bonus Awarded!", description: `You've received a ₹${REFERRAL_BONUS_AMOUNT} bonus for a successful referral!`});
              }

              setReferredCustomers(referredList);
              setLoading(false);
          });
          return unsubscribeReferred;
        } else {
          setLoading(false);
        }
      });
      return unsubscribeCustomer;
    };
    
    let unsubscribe: (() => void) | undefined;
    fetchCustomerData().then(unsub => {
        if(unsub) unsubscribe = unsub;
    });

    return () => {
        if(unsubscribe) unsubscribe();
    };

  }, [authLoading, user, toast]);

  const handleCopyCode = () => {
    if (!customer?.customerId) return;
    navigator.clipboard.writeText(customer.customerId).then(() => {
        toast({ title: "Referral Code Copied!", description: "You can now share your code with friends." });
    }).catch(() => {
        toast({ variant: "destructive", title: "Copy Failed" });
    });
  }

  const totalBonus = customer?.referralBonus || 0;

  if (loading || authLoading) {
    return (
      <main className="flex min-h-[calc(100vh-theme(spacing.14))] w-full items-center justify-center bg-background p-4 md:min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </main>
    );
  }

  return (
    <main className="min-h-screen w-full font-body text-foreground">
      <div className="container mx-auto p-4 py-8 md:p-12">
        <header className="mb-10 flex w-full max-w-4xl flex-col items-start">
          <div className="flex items-center gap-3">
             <Gift className="h-10 w-10 text-primary"/>
             <div>
                <h1 className="text-4xl font-bold tracking-tighter md:text-5xl">
                    Referral Bonus
                </h1>
                <p className="mt-2 max-w-3xl text-lg text-muted-foreground">
                    Refer your friends and earn rewards when they join our network.
                </p>
             </div>
          </div>
        </header>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
            <Card>
                <CardHeader>
                    <CardTitle>Your Referral Code</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center space-x-2">
                        <p className="text-2xl font-bold tracking-widest text-primary bg-muted p-2 rounded-md">
                            {customer?.customerId || 'N/A'}
                        </p>
                        <Button variant="outline" size="icon" onClick={handleCopyCode}>
                            <Copy className="h-4 w-4"/>
                        </Button>
                    </div>
                    <CardDescription className="mt-2">
                        Share this code with your friends. When they use it during sign-up, you get a bonus!
                    </CardDescription>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Total Friends Referred</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{referredCustomers.length}</div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Total Bonus Earned</CardTitle>
                    <Wallet className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-green-600">₹{totalBonus}</div>
                </CardContent>
            </Card>
        </div>
        

        <Card>
            <CardHeader>
                <CardTitle>Your Referrals</CardTitle>
                <CardDescription>Here is a list of customers you have referred.</CardDescription>
            </CardHeader>
            <CardContent>
                 <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer Name</TableHead>
                      <TableHead>Date Joined</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {referredCustomers.length > 0 ? (
                      referredCustomers.map((ref) => (
                        <TableRow key={ref.id}>
                          <TableCell className="font-medium">{ref.name}</TableCell>
                          <TableCell>{ref.createdAt}</TableCell>
                          <TableCell>
                            <Badge variant={ref.status === 'Bonus Awarded' ? 'default' : 'secondary'}>
                                {ref.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={3} className="h-24 text-center">
                          You haven't referred any customers yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
            </CardContent>
        </Card>

      </div>
    </main>
  );
}
