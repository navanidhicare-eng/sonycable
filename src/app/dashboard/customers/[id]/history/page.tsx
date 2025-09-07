
'use client';

import { useEffect, useState } from 'react';
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
import { ArrowLeft, QrCode, Share2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, doc, getDoc, onSnapshot, query, where } from "firebase/firestore";
import { useAuth } from '@/hooks/useAuth';
import jsPDF from 'jspdf';
import QRCode from 'qrcode';


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

export default function CustomerHistoryPage() {
  const params = useParams();
  const customerId = params.id as string;
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [rechargeHistory, setRechargeHistory] = useState<Transaction[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<Transaction[]>([]);
  
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

  useEffect(() => {
    const combined = [...paymentHistory, ...rechargeHistory];
    combined.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setAllTransactions(combined);
  }, [paymentHistory, rechargeHistory]);


  const handleShare = async () => {
    if (!customer) return;

    const qrContent = `Customer Name: ${customer.name}\nCustomer ID: ${customer.customerId}\nBalance: ${customer.balanceAmount}`;
    
    try {
        const qrCodeDataUrl = await QRCode.toDataURL(qrContent, { errorCorrectionLevel: 'H' });
        const response = await fetch(qrCodeDataUrl);
        const blob = await response.blob();
        const file = new File([blob], `${customer.name}-QR.png`, { type: 'image/png' });

        if (navigator.share && navigator.canShare({ files: [file] })) {
            await navigator.share({
                files: [file],
                title: `QR Code for ${customer.name}`,
                text: `Here is the QR code for ${customer.name} (ID: ${customer.customerId}).`,
            });
        } else {
             toast({
                variant: "destructive",
                title: "Sharing Not Supported",
                description: "Your browser does not support sharing files.",
            });
        }
    } catch (error) {
      console.error("Error sharing QR code:", error)
      toast({
        variant: "destructive",
        title: "Sharing Failed",
        description: "Could not share the QR code.",
      });
    }
  };

  const handleDownloadQR = async () => {
    if (!customer) return;

    const qrContent = `Customer Name: ${customer.name}\nCustomer ID: ${customer.customerId}\nBalance: ${customer.balanceAmount}`;
    try {
      const qrCodeDataUrl = await QRCode.toDataURL(qrContent, { errorCorrectionLevel: 'H' });
      
      const pdf = new jsPDF();
      
      pdf.setFontSize(20);
      pdf.text("SONY CABLE NETWORK", 105, 20, { align: 'center' });

      pdf.setFontSize(12);
      pdf.text(`Customer Name: ${customer.name}`, 20, 40);
      pdf.text(`Customer ID: ${customer.customerId}`, 20, 50);
      pdf.text(`Balance Amount: Rs. ${customer.balanceAmount}`, 20, 60);

      pdf.addImage(qrCodeDataUrl, 'PNG', 65, 80, 80, 80);
      
      pdf.save(`${customer.name}-Details.pdf`);

    } catch (err) {
      console.error(err)
      toast({
        variant: "destructive",
        title: "QR Generation Failed",
        description: "Could not generate the QR code.",
      });
    }
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
                 <Button asChild variant="outline" size="sm" className="mt-4">
                    <Link href="/dashboard/customers" className="flex items-center gap-2">
                        <ArrowLeft className="h-4 w-4" />
                        <span>Back to Customers</span>
                    </Link>
                </Button>
            </div>
        </main>
    )
  }

  return (
    <main className="min-h-screen w-full font-body text-foreground">
      <div className="container mx-auto p-4 py-8 md:p-12">
        <div className="mb-8">
            <Button asChild variant="outline" size="sm">
                <Link href="/dashboard/customers" className="flex items-center gap-2">
                    <ArrowLeft className="h-4 w-4" />
                    <span>Back to Customers</span>
                </Link>
            </Button>
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
                <div className="mt-4 flex gap-2 sm:mt-0">
                    <Button variant="outline" onClick={handleDownloadQR}>
                        <QrCode className="mr-2 h-4 w-4" />
                        Download QR
                    </Button>
                    <Button variant="outline" onClick={handleShare}>
                        <Share2 className="mr-2 h-4 w-4" />
                        Share QR
                    </Button>
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
