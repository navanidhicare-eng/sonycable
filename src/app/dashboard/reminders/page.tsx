
"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Phone } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, Timestamp } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

interface Customer {
  id: string;
  name: string;
  mobile: string;
  area: string;
  stbId: string;
  expiryDate?: Timestamp;
}

export default function RemindersPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [expiringCustomers, setExpiringCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading || !user) {
      if(!authLoading) setLoading(false);
      return;
    }

    setLoading(true);
    
    const q = query(
      collection(db, "customers"),
      where("userId", "==", user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0); 
      const threeDaysFromNow = new Date();
      threeDaysFromNow.setDate(today.getDate() + 3);
      threeDaysFromNow.setHours(23, 59, 59, 999);

      const customersData = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Customer))
        .filter(customer => {
          if (!customer.expiryDate) return false;
          const expiryDate = customer.expiryDate.toDate();
          return expiryDate >= today && expiryDate <= threeDaysFromNow;
        });

      setExpiringCustomers(customersData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching expiring customers:", error);
      toast({
        variant: "destructive",
        title: "Failed to fetch reminders",
        description: "Could not retrieve customer reminder data.",
      });
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, authLoading, toast]);

  const formatDate = (timestamp?: Timestamp) => {
    if (!timestamp) return 'N/A';
    return timestamp.toDate().toLocaleDateString('en-CA');
  }

  const daysLeft = (timestamp?: Timestamp) => {
    if (!timestamp) return 'N/A';
    const expiryDate = timestamp.toDate();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffTime = expiryDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }

  return (
    <main className="min-h-screen w-full font-body text-foreground">
      <div className="container mx-auto flex flex-col items-center p-4 py-8 md:p-12">
        <header className="mb-10 flex w-full max-w-4xl flex-col items-center text-center">
          <div>
            <h1 className="text-4xl font-bold tracking-tighter md:text-5xl">
              Recharge Reminders
            </h1>
            <p className="mt-4 max-w-3xl text-lg text-muted-foreground md:text-xl">
              Customers whose subscription is expiring in the next 3 days.
            </p>
          </div>
        </header>
        <Card className="w-full max-w-4xl">
          <CardHeader>
            <CardTitle>Upcoming Expiries</CardTitle>
          </CardHeader>
          <CardContent>
            {loading || authLoading ? (
              <div className="flex justify-center items-center h-40">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer Name</TableHead>
                    <TableHead>Mobile</TableHead>
                    <TableHead>Area</TableHead>
                    <TableHead>Expiry Date</TableHead>
                    <TableHead>Days Left</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expiringCustomers.length > 0 ? (
                    expiringCustomers.map((customer) => (
                      <TableRow key={customer.id}>
                        <TableCell className="font-medium">{customer.name}</TableCell>
                        <TableCell>{customer.mobile}</TableCell>
                        <TableCell>{customer.area}</TableCell>
                        <TableCell>{formatDate(customer.expiryDate)}</TableCell>
                        <TableCell className="font-bold">{daysLeft(customer.expiryDate)}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" asChild>
                            <a href={`tel:${customer.mobile}`}>
                              <Phone className="h-4 w-4" />
                            </a>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center">
                        No customers with upcoming expiries.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
