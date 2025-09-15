
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
import { db } from '@/lib/firebase';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Customer {
  id: string;
  autoSubscriptionEnabled?: boolean;
}

export default function AutoSubscriptionPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const params = useParams();
  const customerId = params.id as string;

  useEffect(() => {
    if (authLoading) return;
    if (!user || !customerId) {
        setLoading(false);
        return;
    }
    
    setLoading(true);
    const customerDocRef = doc(db, 'customers', customerId);

    const unsubscribe = onSnapshot(customerDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setCustomer({ id: docSnap.id, ...docSnap.data() } as Customer);
      } else {
        console.log("Customer document not found for ID:", customerId);
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
  }, [customerId, authLoading, user, toast]);
  
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


  if (loading || authLoading) {
    return (
      <main className="flex min-h-[calc(100vh-theme(spacing.14))] w-full items-center justify-center bg-background p-4 md:min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100vh-theme(spacing.14))] w-full font-body text-foreground md:min-h-screen">
      <div className="container mx-auto p-4 py-8 md:p-12">
        <div className="mb-4">
            <Button asChild variant="outline" size="sm">
                <Link href={`/customer/${customerId}`} className="flex items-center gap-2">
                    <ArrowLeft className="h-4 w-4" />
                    <span>Back to Dashboard</span>
                </Link>
            </Button>
        </div>
        <Card className="w-full max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="text-2xl">Automatic Subscription</CardTitle>
            <CardDescription>
              If enabled, a recharge request will be automatically sent to the admin 3 days before your package expires. The admin must approve the request to complete the recharge.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-4 rounded-md border p-4">
                <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium leading-none">
                    Enable Auto-Subscription
                    </p>
                    <p className="text-sm text-muted-foreground">
                    Automatically send a renewal request before your package expires.
                    </p>
                </div>
                 <Switch
                    id="auto-subscription-switch"
                    checked={customer?.autoSubscriptionEnabled || false}
                    onCheckedChange={handleToggleAutoSubscription}
                    disabled={isSubmitting || !customer}
                />
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
