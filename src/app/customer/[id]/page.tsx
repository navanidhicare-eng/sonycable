
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
import { Badge } from '@/components/ui/badge';
import { Loader2, Network } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, doc, getDoc, onSnapshot, query, where } from "firebase/firestore";

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

export default function CustomerPublicPage() {
  const params = useParams();
  const customerId = params.id as string;
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const [rechargeHistory, setRechargeHistory] = useState<Transaction[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<Transaction[]>([]);

  const allTransactions = useMemo(() => {
    const combined = [...paymentHistory, ...rechargeHistory];
    combined.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return combined;
  }, [paymentHistory, rechargeHistory]);

  useEffect(() => {
    if (!customerId) {
        setLoading(false);
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

    const getTransactionData = () => {
        const paymentsQuery = query(collection(db, "payments"), where("customerId", "==", customerId));
        const rechargesQuery = query(collection(db, "recharges"), where("customerId", "==", customerId));

        const paymentsUnsubscribe = onSnapshot(paymentsQuery, (snapshot) => {
            const payments = snapshot.docs.map(doc => ({
                id: doc.id,
                date: doc.data().collectionDate.toDate().toISOString(),
                description: `Payment via ${doc.data().method}`,
                amount: doc.data().amount,
                method: doc.data().method,
                type: 'Payment'
            } as Transaction));
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
        const unsub = getTransactionData();
        setLoading(false);
        return unsub;
    }
    
    let unsubscribe: (() => void) | undefined;
    runAsync().then(unsub => unsubscribe = unsub);

    return () => {
      if(unsubscribe) unsubscribe();
    };

  }, [customerId, toast]);

  if (loading) {
    return (
        <main className="flex min-h-screen w-full items-center justify-center bg-background p-4 font-body text-foreground">
            <Loader2 className="h-8 w-8 animate-spin" />
        </main>
    )
  }

  if (!customer) {
    return (
        <main className="min-h-screen w-full font-body text-foreground bg-background p-4">
            <div className="container mx-auto p-4 py-8 md:p-12 text-center">
                 <h1 className="text-2xl font-bold">Customer Not Found</h1>
                 <p className="text-muted-foreground">The requested customer could not be found or you don't have permission to view them.</p>
            </div>
        </main>
    )
  }

  return (
    <main className="min-h-screen w-full font-body text-foreground bg-background">
       <header className="bg-card border-b">
         <div className="container mx-auto p-4 flex items-center gap-3">
             <Network className="h-8 w-8 text-primary" />
             <h1 className="text-xl font-bold">SONY CABLE NETWORK</h1>
         </div>
       </header>
      <div className="container mx-auto p-4 py-8 md:p-12">
        <Card className="mb-8">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <CardTitle className="text-2xl">{customer.name}</CardTitle>
                    <CardDescription>
                      Customer Details & Transaction History
                    </CardDescription>
                </div>
                <div>
                    <p className="text-sm text-muted-foreground mt-2 sm:mt-0">Balance Due</p>
                    <p className="text-2xl font-bold text-destructive">₹{customer.balanceAmount.toLocaleString()}</p>
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
      </div>
    </main>
  );
}
