
'use client';

import { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { db, auth } from '@/lib/firebase';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { Loader2 } from 'lucide-react';
import { useParams } from 'next/navigation';

interface Customer {
  id: string;
  autoSubscriptionEnabled?: boolean;
}

export default function AutoSubscriptionPage() {
  const [user, authLoading] = useAuthState(auth);
  const { toast } = useToast();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const params = useParams();

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
        setLoading(false);
        return;
    }
    
    // In a real app, you would likely derive the customer document ID
    // from the logged-in user's UID. For this example, we assume there's a
    // direct mapping or a single customer for simplicity. A better approach
    // would be to have the customer ID in the URL params.
    const customerDocRef = doc(db, 'customers', user.uid);

    const unsubscribe = onSnapshot(customerDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setCustomer({ id: docSnap.id, ...docSnap.data() } as Customer);
      } else {
        // This case needs to be handled based on your app's logic.
        // Maybe the customer doc ID is not the UID.
        console.log("Customer document not found. The mapping might be incorrect.");
        toast({
            variant: "destructive",
            title: "Customer data not found."
        })
      }
      setLoading(false);
    }, (error) => {
        console.error("Error fetching customer data:", error);
        toast({ variant: "destructive", title: "Failed to load data" });
        setLoading(false);
    });

    return () => unsubscribe();
  }, [user, authLoading, toast]);
  
  const handleToggleAutoSubscription = async (enabled: boolean) => {
    if (!customer) return;

    setIsSubmitting(true);
    try {
      const customerDocRef = doc(db, 'customers', customer.id);
      await updateDoc(customerDocRef, {
        autoSubscriptionEnabled: enabled,
      });
      toast({
        title: 'Settings Updated',
        description: `Auto-subscription has been ${enabled ? 'enabled' : 'disabled'}.`,
      });
    } catch (error) {
      console.error('Error updating auto-subscription:', error);
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: 'Could not save your changes.',
      });
    } finally {
        setIsSubmitting(false);
    }
  };


  if (loading) {
    return (
      <main className="flex min-h-[calc(100vh-theme(spacing.14))] w-full items-center justify-center bg-background p-4 md:min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100vh-theme(spacing.14))] w-full font-body text-foreground md:min-h-screen">
      <div className="container mx-auto p-4 py-8 md:p-12">
        <Card className="w-full max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="text-2xl">Automatic Subscription</CardTitle>
            <CardDescription>
              Manage your automatic monthly subscription settings here. If enabled,
              your account will be automatically recharged every 30 days using your
              available balance.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-4 rounded-md border p-4">
                <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium leading-none">
                    Enable Auto-Subscription
                    </p>
                    <p className="text-sm text-muted-foreground">
                    Automatically renew your package every month.
                    </p>
                </div>
                 <Switch
                    id="auto-subscription-switch"
                    checked={customer?.autoSubscriptionEnabled || false}
                    onCheckedChange={handleToggleAutoSubscription}
                    disabled={isSubmitting}
                />
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
