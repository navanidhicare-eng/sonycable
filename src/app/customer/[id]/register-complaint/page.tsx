
'use client';

import { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, getDocs, addDoc } from 'firebase/firestore';
import { Loader2, MessageSquarePlus } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface Customer {
  id: string;
  name: string;
  stbId: string;
  userId: string; // Admin's UID
}

export default function RegisterComplaintPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [complaint, setComplaint] = useState('');
  const [hasPendingComplaint, setHasPendingComplaint] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (authLoading || !user) {
      if (!authLoading) setLoading(false);
      return;
    }

    const fetchCustomerData = async () => {
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

        // Check for existing pending complaints
        const complaintsQuery = query(
          collection(db, 'complaints'),
          where('customerId', '==', customerData.id),
          where('status', '==', 'Pending')
        );

        const unsubscribe = onSnapshot(complaintsQuery, (snapshot) => {
          setHasPendingComplaint(!snapshot.empty);
          setLoading(false);
        }, (error) => {
           console.error("Error checking for pending complaints:", error);
           toast({ variant: 'destructive', title: 'Error', description: 'Could not check for existing complaints.'});
           setLoading(false);
        });

        return unsubscribe;

      } catch (error) {
        console.error("Error fetching customer data:", error);
        toast({ variant: "destructive", title: "An error occurred." });
        setLoading(false);
      }
    };
    
    let unsubscribe: (() => void) | undefined;
    fetchCustomerData().then(unsub => {
      if (unsub) unsubscribe = unsub;
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };

  }, [authLoading, user, toast]);

  const handleSubmit = async () => {
    if (!complaint.trim()) {
      toast({ variant: 'destructive', title: 'Please enter your complaint details.'});
      return;
    }
    if (!customer) {
        toast({ variant: 'destructive', title: 'Customer data not available.'});
        return;
    }

    setIsSubmitting(true);
    try {
        await addDoc(collection(db, 'complaints'), {
            customerId: customer.id,
            customerName: customer.name,
            stbId: customer.stbId,
            complaint: complaint,
            status: "Pending",
            createdAt: new Date(),
            userId: customer.userId,
        });
        toast({
            title: "Complaint Registered",
            description: "Your complaint has been sent to your cable operator. They will look into it shortly.",
        });
        setComplaint('');
    } catch (error) {
        console.error("Error registering complaint:", error);
        toast({
            variant: 'destructive',
            title: 'Registration Failed',
            description: 'Could not submit your complaint. Please try again later.',
        });
    } finally {
        setIsSubmitting(false);
    }
  }

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
            <CardTitle className="text-2xl">Register a Complaint</CardTitle>
            <CardDescription>
              Describe your issue below. Your cable operator will be notified.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
             {hasPendingComplaint ? (
                <div className="text-center p-6 bg-yellow-100/50 text-yellow-800 rounded-md border border-yellow-200">
                    <h3 className="font-semibold">You already have a pending complaint.</h3>
                    <p className="text-sm mt-1">Please wait for your operator to resolve your existing issue before creating a new one.</p>
                </div>
             ) : (
                <div className="grid w-full gap-1.5">
                    <Label htmlFor="complaint">Your Complaint</Label>
                    <Textarea 
                        placeholder="Please describe your issue in detail here..." 
                        id="complaint" 
                        rows={5}
                        value={complaint}
                        onChange={(e) => setComplaint(e.target.value)}
                    />
                </div>
             )}
          </CardContent>
          {!hasPendingComplaint && (
            <CardFooter>
                 <Button 
                    onClick={handleSubmit} 
                    disabled={isSubmitting || !complaint.trim()} 
                    className="w-full"
                >
                {isSubmitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                    <MessageSquarePlus className="mr-2 h-4 w-4" />
                )}
                {isSubmitting ? 'Submitting...' : 'Submit Complaint'}
                </Button>
            </CardFooter>
          )}
        </Card>
      </div>
    </main>
  );
}
