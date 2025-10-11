
'use client';

import { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, getDocs, addDoc } from 'firebase/firestore';
import { Loader2, Send } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

interface Package {
  id: string;
  packageName: string;
  packageAmount: string;
}

interface Customer {
  id: string;
  name: string;
  userId: string; // Admin's UID
}

export default function RequestRechargePage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [packages, setPackages] = useState<Package[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [rechargeMonths, setRechargeMonths] = useState(1);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const params = useParams();
  const customerId = params.id as string;

  useEffect(() => {
    if (authLoading || !user) {
      if (!authLoading) setLoading(false);
      return;
    }

    const fetchInitialData = async () => {
      setLoading(true);
      try {
        const customerQuery = query(collection(db, "customers"), where("uid", "==", user.uid));
        const customerSnapshot = await getDocs(customerQuery);

        if (customerSnapshot.empty) {
          toast({ variant: "destructive", title: "Customer data not found." });
          setLoading(false);
          return;
        }

        const customerDoc = customerSnapshot.docs[0];
        const customerData = { id: customerDoc.id, ...customerDoc.data() } as Customer;
        setCustomer(customerData);

        if (customerData.userId) {
          const packagesQuery = query(collection(db, "packages"), where("userId", "==", customerData.userId));
          const unsubscribe = onSnapshot(packagesQuery, (snapshot) => {
            const packagesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Package));
            setPackages(packagesData);
            setLoading(false);
          }, (error) => {
            console.error("Error fetching packages:", error);
            toast({ variant: "destructive", title: "Failed to load packages." });
            setLoading(false);
          });
          return unsubscribe;
        } else {
          setLoading(false);
        }
      } catch (error) {
        console.error("Error fetching customer data:", error);
        toast({ variant: "destructive", title: "An error occurred." });
        setLoading(false);
      }
    };

    let unsubscribe: (() => void) | undefined;
    fetchInitialData().then(unsub => {
      if (unsub) unsubscribe = unsub;
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [authLoading, user, toast]);

  const handleSendRequest = async () => {
    if (!selectedPackage || !customer) {
      toast({ variant: "destructive", title: "Please select a package." });
      return;
    }

    setIsSubmitting(true);
    try {
       // Check if a pending request already exists
      const requestsQuery = query(
        collection(db, 'rechargeRequests'),
        where('customerId', '==', customer.id),
        where('status', '==', 'Pending')
      );
      const existingRequests = await getDocs(requestsQuery);

      if (!existingRequests.empty) {
        toast({
          variant: "destructive",
          title: "Request Already Pending",
          description: "You already have a pending recharge request. Please wait for the admin to approve it.",
        });
        setIsSubmitting(false);
        return;
      }
      
      const totalAmount = parseFloat(selectedPackage.packageAmount) * rechargeMonths;

      await addDoc(collection(db, 'rechargeRequests'), {
        customerId: customer.id,
        customerName: customer.name,
        adminId: customer.userId,
        packageName: selectedPackage.packageName,
        packageAmount: totalAmount,
        months: rechargeMonths,
        requestDate: new Date(),
        status: 'Pending',
        type: 'Manual',
      });

      toast({
        title: "Request Sent",
        description: `Your request for ${selectedPackage.packageName} for ${rechargeMonths} month(s) has been sent to the admin for approval.`,
      });
      setSelectedPackage(null);

    } catch (error) {
      console.error('Error sending recharge request:', error);
      toast({
        variant: 'destructive',
        title: 'Request Failed',
        description: 'Could not send your request. Please try again later.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePackageChange = (packageId: string) => {
    const pkg = packages.find(p => p.id === packageId);
    setSelectedPackage(pkg || null);
    setRechargeMonths(1);
  };
  
  const totalAmount = selectedPackage ? parseFloat(selectedPackage.packageAmount) * rechargeMonths : 0;

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
        <Card className="w-full max-w-lg mx-auto">
          <CardHeader>
            <CardTitle className="text-2xl">Request a Recharge</CardTitle>
            <CardDescription>
              Select a package and send a request to your cable operator for a recharge.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="package-select">Select Package</Label>
                <Select onValueChange={handlePackageChange}>
                    <SelectTrigger id="package-select">
                        <SelectValue placeholder="Choose a package..." />
                    </SelectTrigger>
                    <SelectContent>
                        {packages.map(pkg => (
                            <SelectItem key={pkg.id} value={pkg.id}>
                                {pkg.packageName} - ₹{pkg.packageAmount}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            {selectedPackage && (
              <>
                <div className="space-y-2">
                    <Label htmlFor="months-select">Number of Months</Label>
                    <Select value={String(rechargeMonths)} onValueChange={(val) => setRechargeMonths(Number(val))}>
                        <SelectTrigger id="months-select">
                            <SelectValue placeholder="Select number of months" />
                        </SelectTrigger>
                        <SelectContent>
                            {[...Array(12)].map((_, i) => (
                                <SelectItem key={i + 1} value={String(i + 1)}>
                                {i + 1} Month(s)
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="text-center text-sm text-muted-foreground p-3 bg-muted rounded-md">
                  You are requesting <span className="font-bold text-foreground">{selectedPackage.packageName}</span> for <span className="font-bold text-foreground">{rechargeMonths} month(s)</span>.
                  <br/>
                  Total Amount: <span className="font-bold text-foreground text-base">₹{totalAmount.toLocaleString()}</span>
                </div>
              </>
            )}
            <Button 
                onClick={handleSendRequest} 
                disabled={isSubmitting || !selectedPackage} 
                className="w-full"
            >
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              {isSubmitting ? 'Sending...' : 'Send Request'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
