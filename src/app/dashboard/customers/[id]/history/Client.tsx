'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, doc, getDoc, onSnapshot, query, where } from "firebase/firestore";
import { useAuth } from '@/hooks/useAuth';

interface Customer {
  id: string;
  name: string;
  mobile: string;
  area: string;
  stbId: string;
  customerId: string;
  balanceAmount: number;
}

interface Transaction {
    id: string;
    date: string;
    description: string;
    amount: string;
    status?: string;
    type: 'Recharge' | 'Payment';
    packageName?: string;
    method?: string;
}

export default function CustomerHistoryClient() {
  const params = useParams();
  const customerId = params.id as string;
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user, userRole, loading: authLoading } = useAuth();
  const [rechargeHistory, setRechargeHistory] = useState<Transaction[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<Transaction[]>([]);

  const allTransactions = useMemo(() => {
    const combined = [...paymentHistory, ...rechargeHistory];
    combined.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return combined;
  }, [paymentHistory, rechargeHistory]);
  
  useEffect(() => {
    if (authLoading || !customerId) {
        if(!authLoading) setLoading(false);
        return;
    };
    
    setLoading(true);
    const getCustomerData = async () => {
        const docRef = doc(db, "customers", customerId);
        try {
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                setCustomer({ id: docSnap.id, ...docSnap.data() } as Customer);
            } else {
                toast({
                    variant: "destructive",
                    title: "Customer not found",
                });
            }
        } catch(error) {
             toast({
                variant: "destructive",
                title: "Failed to fetch customer",
            });
        }
    };

    const getTransactionData = async () => {
        const paymentsQuery = query(collection(db, "payments"), where("customerId", "==", customerId));
        const rechargesQuery = query(collection(db, "recharges"), where("customerId", "==", customerId));

        const paymentsUnsubscribe = onSnapshot(paymentsQuery, (snapshot) => {
            const payments = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    date: data.collectionDate.toDate().toISOString(),
                    description: data.description || `Payment via ${data.method}`,
                    amount: data.amount,
                    method: data.method,
                    type: 'Payment'
                } as Transaction;
            });
            setPaymentHistory(payments);
        });

        const rechargesUnsubscribe = onSnapshot(rechargesQuery, (snapshot) => {
            const recharges = snapshot.docs.map(doc => ({
                id: doc.id,
                date: doc.data().rechargeDate.toDate().toISOString(),
                description: `Recharge - ${doc.data().packageName}`,
                amount: doc.data().amount,
                packageName: doc.data().packageName,
                status: doc.data().paymentReceived ? 'Paid' : 'Unpaid',
                type: 'Recharge'
            } as Transaction));
            setRechargeHistory(recharges);
        });
        
        return () => {
            paymentsUnsubscribe();
            rechargesUnsubscribe();
        }
    }

    const runAsync = async () => {
        await getCustomerData();
        const unsub = await getTransactionData();
        setLoading(false);
        return unsub;
    }
    
    let unsubscribe: (() => void) | undefined;
    runAsync().then(unsub => unsubscribe = unsub);

    return () => {
      if(unsubscribe) unsubscribe();
    };

  }, [customerId, toast, user, authLoading]);

  const BackButton = () => {
    if (authLoading) {
      return null;
    }

    if (userRole === 'Admin') {
      return (
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard/customers" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Customers</span>
          </Link>
        </Button>
      );
    }

    if (userRole && userRole !== 'Admin') {
       return (
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard/payments-collections" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Collections</span>
          </Link>
        </Button>
      );
    }

    return null;
  };

  if (loading || authLoading) {
    return (
        <main className="flex min-h-screen w-full items-center justify-center font-body text-foreground">
            <Loader2 className="h-8 w-8 animate-spin" />
        </main>
    )
  }

  if (!customer) {
    return (
        <main className="min-h-screen w-full font-body text-foreground">
            <div className="container mx-auto p-4 py-8 md:p-12 text-center">
                 <h1 className="text-2xl font-bold">Customer Not Found</h1>
                 <p className="text-muted-foreground">The requested customer could not be found.</p>
                 <BackButton />
            </div>
        </main>
    )
  }

  return (
    <main className="min-h-screen w-full font-body text-foreground">
      <div className="container mx-auto p-4 py-8 md:p-12">
        <div className="mb-8">
            <BackButton />
        </div>
        <Card className="mb-8">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <CardTitle className="text-2xl">{customer.name}</CardTitle>
                    <CardDescription>
                      View recharge and payment history for this customer.
                    </CardDescription>
                </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
              <div>
                <p className="font-medium text-muted-foreground">Mobile</p>
                <p>{customer.mobile}</p>
              </div>
              <div>
                <p className="font-medium text-muted-foreground">Area</p>
                <p>{customer.area}</p>
              </div>
              <div>
                <p className="font-medium text-muted-foreground">STB ID</p>
                <p>{customer.stbId}</p>
              </div>
              <div>
                <p className="font-medium text-muted-foreground">Customer ID</p>
                <p>{customer.customerId}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="all">
          <TabsList className="grid w-full grid-cols-3 md:w-[600px]">
            <TabsTrigger value="all">All Transactions</TabsTrigger>
            <TabsTrigger value="recharge">Recharge History</TabsTrigger>
            <TabsTrigger value="payment">Payment History</TabsTrigger>
          </TabsList>
          <TabsContent value="all">
            <Card>
              <CardHeader>
                <CardTitle>All Transactions</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Amount (₹)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allTransactions.length > 0 ? (
                      allTransactions.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{new Date(item.date).toLocaleDateString('en-CA')}</TableCell>
                          <TableCell>
                            <Badge variant={item.type === 'Recharge' ? 'default' : 'secondary'}>
                              {item.type}
                            </Badge>
                          </TableCell>
                          <TableCell>{item.description}</TableCell>
                          <TableCell>₹{item.amount}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="h-24 text-center">
                          No transactions found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="recharge">
            <Card>
              <CardHeader>
                <CardTitle>Recharge History</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Package</TableHead>
                      <TableHead>Amount (₹)</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rechargeHistory.length > 0 ? (
                      rechargeHistory.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{new Date(item.date).toLocaleDateString('en-CA')}</TableCell>
                          <TableCell>{item.packageName}</TableCell>
                          <TableCell>₹{item.amount}</TableCell>
                          <TableCell>
                            <Badge variant={item.status === 'Paid' ? 'default' : 'destructive'}>
                              {item.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="h-24 text-center">
                          No recharge history found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="payment">
            <Card>
              <CardHeader>
                <CardTitle>Payment History</CardTitle>
              </CardHeader>
              <CardContent>
                 <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Amount (₹)</TableHead>
                      <TableHead>Method</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paymentHistory.length > 0 ? (
                      paymentHistory.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{new Date(item.date).toLocaleDateString('en-CA')}</TableCell>
                          <TableCell>₹{item.amount}</TableCell>
                          <TableCell>
                             <Badge variant="secondary">{item.method}</Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={3} className="h-24 text-center">
                          No payment history found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
