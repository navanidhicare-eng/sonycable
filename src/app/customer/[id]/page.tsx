
'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
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
import { Loader2, Network, Send, MessageSquareWarning, Eye, EyeOff, Megaphone, LogOut } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { db, auth } from '@/lib/firebase';
import { collection, doc, onSnapshot, query, where, addDoc, updateDoc, getDocs, Timestamp } from "firebase/firestore";
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
import { updatePassword, getAuth, signOut } from 'firebase/auth';
import { Input } from '@/components/ui/input';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import Autoplay from "embla-carousel-autoplay"
import { useAuth } from '@/hooks/useAuth';


interface Customer {
  id: string;
  name: string;
  mobile: string;
  area: string;
  stbId: string;
  customerId: string;
  balanceAmount: number;
  userId: string; // Admin's UID
  passwordChangeRequired?: boolean;
  autoSubscriptionEnabled?: boolean;
  expiryDate?: Timestamp;
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

interface Offer {
    id: string;
    name: string;
    description: string;
    status: string;
}

export default function CustomerPublicPage() {
  const params = useParams();
  const router = useRouter();
  const customerIdFromUrl = params.id as string;
  const { user, loading: authLoading } = useAuth();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const [rechargeHistory, setRechargeHistory] = useState<Transaction[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<Transaction[]>([]);
  const [activeOffers, setActiveOffers] = useState<Offer[]>([]);

  // States for password change dialog
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);


  const allTransactions = useMemo(() => {
    const combined = [...paymentHistory, ...rechargeHistory];
    combined.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return combined;
  }, [paymentHistory, rechargeHistory]);

  const latestRecharge = useMemo(() => {
    if (rechargeHistory.length === 0) return null;
    return rechargeHistory.reduce((latest, current) => 
        new Date(current.date) > new Date(latest.date) ? current : latest
    );
  }, [rechargeHistory]);


  useEffect(() => {
    if (authLoading || !user) {
        if (!authLoading) setLoading(false);
        return;
    }

    setLoading(true);

    const customerQuery = query(collection(db, "customers"), where("uid", "==", user.uid));

    const customerUnsubscribe = onSnapshot(customerQuery, (snapshot) => {
      if (!snapshot.empty) {
        const customerDoc = snapshot.docs[0];
        const customerData = { id: customerDoc.id, ...customerDoc.data() } as Customer;
        setCustomer(customerData);

        if (customerData.passwordChangeRequired) {
            setIsPasswordDialogOpen(true);
        }

        const customerId = customerDoc.id;

        // Now fetch related data using the fetched customerId
        const paymentsQuery = query(collection(db, "payments"), where("customerId", "==", customerId));
        const rechargesQuery = query(collection(db, "recharges"), where("customerId", "==", customerId));
        const offersQuery = query(collection(db, "offers"), where("userId", "==", customerData.userId), where("status", "==", "Active"));

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
          }),
           onSnapshot(offersQuery, (snapshot) => {
            const offersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Offer));
            setActiveOffers(offersData);
          })
        ];
        
        setLoading(false);
        // We will return a function that unsubscribes from all these listeners
        return () => unsubscribes.forEach(unsub => unsub());

      } else {
        toast({ variant: "destructive", title: "Customer not found" });
        setCustomer(null);
        setLoading(false);
      }
    }, (error) => {
      console.error("Error fetching customer:", error);
      toast({ variant: "destructive", title: "Failed to fetch customer" });
      setLoading(false);
    });

    return () => customerUnsubscribe();
  }, [user, authLoading, toast]);
  
  useEffect(() => {
    const createAutoRechargeRequest = async () => {
        if (!customer || !customer.autoSubscriptionEnabled || !customer.expiryDate || !latestRecharge) {
            return;
        }

        const expiry = customer.expiryDate.toDate();
        const today = new Date();
        const threeDaysFromNow = new Date();
        threeDaysFromNow.setDate(today.getDate() + 3);

        if (expiry > today && expiry <= threeDaysFromNow) {
            // Check if a request already exists
            const requestsQuery = query(
                collection(db, 'rechargeRequests'),
                where('customerId', '==', customer.id),
                where('status', '==', 'Pending')
            );
            const existingRequests = await getDocs(requestsQuery);

            if (existingRequests.empty) {
                // Create a new request
                await addDoc(collection(db, 'rechargeRequests'), {
                    customerId: customer.id,
                    customerName: customer.name,
                    adminId: customer.userId,
                    packageName: latestRecharge.packageName,
                    packageAmount: latestRecharge.amount,
                    requestDate: new Date(),
                    status: 'Pending',
                    type: 'Auto'
                });
                 toast({
                    title: "Auto-Recharge Request Sent",
                    description: `Your request for ${latestRecharge.packageName} has been sent for admin approval.`
                });
            }
        }
    };
    createAutoRechargeRequest();
  }, [customer, latestRecharge, toast]);

  const handlePasswordChange = async () => {
    setPasswordError("");
    if (newPassword.length < 6) {
        setPasswordError("Password must be at least 6 characters long.");
        return;
    }
    if (newPassword !== confirmPassword) {
        setPasswordError("Passwords do not match.");
        return;
    }
    const currentUser = getAuth().currentUser;
    if (!currentUser || !customer) {
        setPasswordError("Not logged in or customer data not found.");
        return;
    }

    setIsSubmitting(true);
    try {
        await updatePassword(currentUser, newPassword);
        
        const customerDocRef = doc(db, "customers", customer.id);
        await updateDoc(customerDocRef, {
            passwordChangeRequired: false
        });

        toast({
            title: "Password Updated",
            description: "Your password has been successfully updated.",
        });
        setIsPasswordDialogOpen(false);
        setNewPassword("");
        setConfirmPassword("");
    } catch (error) {
        console.error("Error updating password:", error);
        toast({ variant: "destructive", title: "Password Update Failed", description: "Please log out and log in again to change your password."});
        setPasswordError("An error occurred. Please try again.");
    } finally {
        setIsSubmitting(false);
    }
  };

  if (loading || authLoading) {
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
      <div className="container mx-auto p-4 py-8 md:p-12">
        {activeOffers.length > 0 && (
          <Carousel 
            plugins={[Autoplay({ delay: 5000 })]}
            className="w-full mb-8"
          >
            <CarouselContent>
              {activeOffers.map((offer) => (
                <CarouselItem key={offer.id}>
                  <div className="p-1">
                    <Card className="bg-gradient-to-r from-primary to-orange-400 text-primary-foreground">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Megaphone />
                                {offer.name}
                            </CardTitle>
                            <CardDescription className="text-primary-foreground/90">{offer.description}</CardDescription>
                        </CardHeader>
                    </Card>
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="hidden sm:flex" />
            <CarouselNext className="hidden sm:flex" />
          </Carousel>
        )}

        <Card className="mb-8 bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 text-white">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <CardTitle className="text-2xl">{customer.name}</CardTitle>
                    <CardDescription className="text-gray-200">
                      Customer Details & Transaction History
                    </CardDescription>
                </div>
                <div>
                    <p className="text-sm text-gray-200 mt-2 sm:mt-0">Balance Due</p>
                    <p className="text-2xl font-bold text-white">₹{customer.balanceAmount.toLocaleString()}</p>
                </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
              <div>
                <p className="font-medium text-gray-200">Mobile</p>
                <p>{customer.mobile}</p>
              </div>
              <div>
                <p className="font-medium text-gray-200">Area</p>
                <p>{customer.area}</p>
              </div>
              <div>
                <p className="font-medium text-gray-200">STB ID</p>
                <p>{customer.stbId}</p>
              </div>
              <div>
                <p className="font-medium text-gray-200">Customer ID</p>
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

    {/* Force Password Change Dialog */}
    <Dialog open={isPasswordDialogOpen} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()} hideCloseButton={true}>
            <DialogHeader>
                <DialogTitle>Change Your Password</DialogTitle>
                <DialogDescription>
                    For your security, you must change your default password before continuing.
                </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
                <div className="space-y-2">
                    <Label htmlFor="new-password">New Password</Label>
                    <div className="relative">
                        <Input
                            id="new-password"
                            type={showPassword ? "text" : "password"}
                            placeholder="Enter new password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                        />
                        <Button variant="ghost" size="icon" type="button" className="absolute top-1/2 right-2 -translate-y-1/2 h-7 w-7" onClick={() => setShowPassword(!showPassword)}>
                            {showPassword ? <EyeOff /> : <Eye />}
                        </Button>
                    </div>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirm New Password</Label>
                    <Input
                        id="confirm-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Confirm new password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                </div>
                {passwordError && <p className="text-sm font-medium text-destructive">{passwordError}</p>}
            </div>
            <DialogFooter>
                <Button onClick={handlePasswordChange} disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Update Password
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
    </>
  );
}
