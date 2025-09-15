
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, getDocs } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Store, Phone } from 'lucide-react';
import Link from 'next/link';

interface Business {
  id: string;
  businessName: string;
  category: string;
  description: string;
  address: string;
  phone: string;
}

interface Customer {
  userId: string; // Admin's UID
}

export default function CustomerBusinessDirectoryPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading || !user) {
      if (!authLoading) setLoading(false);
      return;
    }

    const fetchBusinesses = async () => {
      setLoading(true);
      try {
        const customerQuery = query(collection(db, "customers"), where("uid", "==", user.uid));
        const customerSnapshot = await getDocs(customerQuery);

        if (customerSnapshot.empty) {
          toast({ variant: "destructive", title: "Customer data not found." });
          setLoading(false);
          return;
        }

        const customerData = customerSnapshot.docs[0].data() as Customer;
        const adminId = customerData.userId;

        if (!adminId) {
          toast({ variant: "destructive", title: "Could not identify the service provider." });
          setLoading(false);
          return;
        }

        const businessesQuery = query(collection(db, "businesses"), where("userId", "==", adminId));
        const unsubscribe = onSnapshot(businessesQuery, (snapshot) => {
          const businessData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Business));
          businessData.sort((a,b) => (a.businessName > b.businessName) ? 1 : -1)
          setBusinesses(businessData);
          setLoading(false);
        }, (error) => {
          console.error("Error fetching businesses:", error);
          toast({ variant: "destructive", title: "Failed to load businesses" });
          setLoading(false);
        });

        return unsubscribe;

      } catch (error) {
        console.error("Error in fetching customer/business data:", error);
        toast({ variant: "destructive", title: "An error occurred while loading data." });
        setLoading(false);
      }
    };
    
    let unsubscribe: (() => void) | undefined;
    fetchBusinesses().then(unsub => {
        if(unsub) unsubscribe = unsub;
    });

    return () => {
        if(unsubscribe) unsubscribe();
    };
  }, [authLoading, user, toast]);

  if (loading || authLoading) {
    return (
      <main className="flex min-h-screen w-full items-center justify-center bg-background p-4">
        <Loader2 className="h-8 w-8 animate-spin" />
      </main>
    );
  }

  return (
    <main className="min-h-screen w-full font-body text-foreground bg-background">
      <div className="container mx-auto p-4 py-8 md:p-12">
        <header className="mb-10 flex w-full max-w-4xl flex-col items-start">
          <div className="flex items-center gap-3">
             <Store className="h-10 w-10 text-primary"/>
             <div>
                <h1 className="text-4xl font-bold tracking-tighter md:text-5xl">
                    Local Business Directory
                </h1>
                <p className="mt-2 max-w-3xl text-lg text-muted-foreground">
                    Discover local businesses and services in your area.
                </p>
             </div>
          </div>
        </header>

        {businesses.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {businesses.map((biz) => (
              <Card key={biz.id} className="flex flex-col">
                <CardHeader>
                  <CardTitle>{biz.businessName}</CardTitle>
                  <CardDescription>{biz.category}</CardDescription>
                </CardHeader>
                <CardContent className="flex-grow space-y-4">
                    <p className="text-sm text-muted-foreground">{biz.description}</p>
                    <div className="text-sm">
                        <p className="font-semibold">Address:</p>
                        <p>{biz.address}</p>
                    </div>
                </CardContent>
                <CardFooter>
                   <Button className="w-full" asChild>
                        <a href={`tel:${biz.phone}`}>
                            <Phone className="mr-2 h-4 w-4" />
                            Call Now
                        </a>
                    </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 border border-dashed rounded-lg">
            <h2 className="text-xl font-semibold">No Businesses Available</h2>
            <p className="text-muted-foreground mt-2">Your provider has not added any local businesses yet.</p>
          </div>
        )}
      </div>
    </main>
  );
}
