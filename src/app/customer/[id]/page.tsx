
'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
import { Loader2, Network, Send, MessageSquareWarning } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, doc, onSnapshot, query, where, addDoc } from "firebase/firestore";
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface Customer {
  id: string;
  name: string;
  mobile: string;
  area: string;
  stbId: string;
  customerId: string;
  balanceAmount: number;
  userId: string; // Admin's UID
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

interface Package {
  id: string;
  packageName: string;
  packageAmount: string;
}

export default function CustomerPublicPage() {
  const params = useParams();
  const customerId = params.id as string;
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const [rechargeHistory, setRechargeHistory] = useState<Transaction[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<Transaction[]>([]);

  const [isRechargeDialogOpen, setIsRechargeDialogOpen] = useState(false);
  const [isComplaintDialogOpen, setIsComplaintDialogOpen] = useState(false);
  const [packages, setPackages] = useState<Package[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const [complaintDetails, setComplaintDetails] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const allTransactions = useMemo(() => {
    const combined = [...paymentHistory, ...rechargeHistory];
    combined.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return combined;
  }, [paymentHistory, rechargeHistory]);

  useEffect(() => {
    if (!customerId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const customerDocRef = doc(db, "customers", customerId);

    const customerUnsubscribe = onSnapshot(customerDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const customerData = { id: docSnap.id, ...docSnap.data() } as Customer;
        setCustomer(customerData);

        if (customerData.userId) {
          const paymentsQuery = query(collection(db, "payments"), where("customerId", "==", customerId));
          const rechargesQuery = query(collection(db, "recharges"), where("customerId", "==", customerId));
          const packagesQuery = query(collection(db, "packages"), where("userId", "==", customerData.userId));

          let paymentsLoaded = false;
          let rechargesLoaded = false;
          let packagesLoaded = false;

          const checkAllLoaded = () => {
            if (paymentsLoaded && rechargesLoaded && packagesLoaded) {
              setLoading(false);
            }
          };

          const unsubscribes = [
            onSnapshot(paymentsQuery, (snapshot) => {
              const payments = snapshot.docs.map(doc => ({
                id: doc.id,
                date: doc.data().collectionDate.toDate().toISOString(),
                description: `Payment via ${doc.data().method}`,
                amount: doc.data().amount,
                method: doc.data().method,
                type: 'Payment'
              } as Transaction));
              setPaymentHistory(payments);
              paymentsLoaded = true;
              checkAllLoaded();
            }),
            onSnapshot(rechargesQuery, (snapshot) => {
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
              rechargesLoaded = true;
              checkAllLoaded();
            }),
            onSnapshot(packagesQuery, (snapshot) => {
              const packagesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Package));
              setPackages(packagesData);
              packagesLoaded = true;
              checkAllLoaded();
            })
          ];

          return () => unsubscribes.forEach(unsub => unsub());
        } else {
          setLoading(false);
        }
      } else {
        toast({ variant: "destructive", title: "Customer not found" });
        setLoading(false);
      }
    }, (error) => {
      console.error("Error fetching customer:", error);
      toast({ variant: "destructive", title: "Failed to fetch customer" });
      setLoading(false);
    });

    return () => customerUnsubscribe();
  }, [customerId, toast]);

  const handleRechargeRequest = async () => {
    if (!selectedPackage || !customer) return;
    const pkg = packages.find(p => p.id === selectedPackage);
    if (!pkg) return;

    setIsSubmitting(true);
    try {
        await addDoc(collection(db, "rechargeRequests"), {
            customerId: customer.id,
            customerName: customer.name,
            packageId: pkg.id,
            packageName: pkg.packageName,
            packageAmount: pkg.packageAmount,
            status: "Pending",
            requestDate: new Date(),
            adminId: customer.userId,
        });
        toast({
            title: "Recharge Request Sent",
            description: "Your request has been sent to the operator.",
        });
        setIsRechargeDialogOpen(false);
        setSelectedPackage(null);
    } catch (error) {
        console.error("Error sending recharge request:", error);
        toast({ variant: "destructive", title: "Failed to send request" });
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleComplaintSubmit = async () => {
    if (!complaintDetails.trim() || !customer) return;
    setIsSubmitting(true);
    try {
        await addDoc(collection(db, "complaints"), {
            customerId: customer.id,
            customerName: customer.name,
            stbId: customer.stbId,
            complaint: complaintDetails,
            status: "Pending",
            createdAt: new Date(),
            userId: customer.userId, // Admin's UID
        });
        toast({
            title: "Complaint Registered",
            description: "Your complaint has been sent to the operator.",
        });
        setIsComplaintDialogOpen(false);
        setComplaintDetails("");
    } catch (error) {
        console.error("Error submitting complaint:", error);
        toast({ variant: "destructive", title: "Failed to register complaint" });
    } finally {
        setIsSubmitting(false);
    }
  };

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
    <>
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
           <CardFooter className="flex gap-4">
              <Button onClick={() => setIsRechargeDialogOpen(true)}>
                  <Send className="mr-2 h-4 w-4" />
                  Request Recharge
              </Button>
              <Button variant="outline" onClick={() => setIsComplaintDialogOpen(true)}>
                  <MessageSquareWarning className="mr-2 h-4 w-4" />
                  Register Complaint
              </Button>
          </CardFooter>
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

    {/* Recharge Request Dialog */}
    <Dialog open={isRechargeDialogOpen} onOpenChange={setIsRechargeDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
            <DialogTitle>Request a Recharge</DialogTitle>
            <DialogDescription>
                Select a package from the list to send a recharge request.
            </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="package" className="text-right">
                        Package
                    </Label>
                    <Select onValueChange={setSelectedPackage} defaultValue={selectedPackage || undefined}>
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
            </div>
            <DialogFooter>
            <Button type="button" onClick={handleRechargeRequest} disabled={!selectedPackage || isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Submit Request
            </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
    
    {/* Complaint Dialog */}
    <Dialog open={isComplaintDialogOpen} onOpenChange={setIsComplaintDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
            <DialogTitle>Register a Complaint</DialogTitle>
            <DialogDescription>
                Please describe your issue in detail below.
            </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <Textarea 
                    placeholder="Type your complaint here..." 
                    value={complaintDetails}
                    onChange={(e) => setComplaintDetails(e.target.value)}
                    rows={5}
                />
            </div>
            <DialogFooter>
            <Button type="button" onClick={handleComplaintSubmit} disabled={!complaintDetails.trim() || isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Submit Complaint
            </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
    </>
  );
}

