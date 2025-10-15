
"use client";

import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Loader2, Phone, Pencil, Send, CreditCard } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, Timestamp, getDocs } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Customer {
  id: string;
  name: string;
  mobile: string;
  area: string;
  stbId: string;
  expiryDate?: Timestamp;
  balanceAmount: number;
}

interface Staff {
    area: string[];
    adminId: string;
}

export default function StaffRemindersPage() {
  const { user, userRole, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [expiringCustomers, setExpiringCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  const isCollectionAgent = useMemo(() => {
    if (!userRole) return false;
    return /collection|collation/i.test(userRole);
  }, [userRole]);

  const isNetworkServiceAgent = userRole === "Network Service Agent";

  useEffect(() => {
    if (authLoading || !user) {
      if(!authLoading) setLoading(false);
      return;
    }

    const fetchReminders = async () => {
        setLoading(true);
        try {
            // 1. Get Staff's adminId and assigned areas
            const staffQuery = query(collection(db, "staff"), where("uid", "==", user.uid));
            const staffSnapshot = await getDocs(staffQuery);

            if (staffSnapshot.empty) {
                toast({ variant: "destructive", title: "Staff data not found" });
                setLoading(false);
                return;
            }

            const staffData = staffSnapshot.docs[0].data() as Staff;
            const adminId = staffData.adminId;
            const staffAreas = staffData.area || [];

            if (!adminId) {
                setLoading(false);
                return;
            }

            // 2. Get all customers for that admin
            const customersQuery = query(
                collection(db, "customers"),
                where("userId", "==", adminId)
            );

            const unsubscribe = onSnapshot(customersQuery, (snapshot) => {
                const today = new Date();
                today.setHours(0, 0, 0, 0); 
                const threeDaysFromNow = new Date();
                threeDaysFromNow.setDate(today.getDate() + 3);
                threeDaysFromNow.setHours(23, 59, 59, 999);

                const customersData = snapshot.docs
                    .map(doc => ({ id: doc.id, ...doc.data() } as Customer))
                    .filter(customer => {
                        // Filter by staff's assigned area
                        if (!staffAreas.includes(customer.area)) {
                            return false;
                        }
                        // Filter by expiry date
                        if (!customer.expiryDate) return false;
                        const expiryDate = customer.expiryDate.toDate();
                        // Show customers expired or expiring in next 3 days.
                        return expiryDate <= threeDaysFromNow;
                    });
                
                customersData.sort((a, b) => (a.expiryDate?.seconds ?? 0) - (b.expiryDate?.seconds ?? 0));
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

        } catch (error) {
            console.error("Error in fetchReminders:", error);
            toast({ variant: "destructive", title: "An error occurred" });
            setLoading(false);
        }
    };
    
    const unsubscribePromise = fetchReminders();

    return () => {
      unsubscribePromise.then(unsub => {
        if (unsub) unsub();
      });
    };

  }, [user, authLoading, toast]);

  const formatDate = (timestamp?: Timestamp) => {
    if (!timestamp) return 'N/A';
    return timestamp.toDate().toLocaleDateString('en-CA');
  }

  const daysLeft = (timestamp?: Timestamp): number | string => {
    if (!timestamp) return 'N/A';
    const expiryDate = new Date(timestamp.toDate().setHours(0, 0, 0, 0));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffTime = expiryDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }
  
  const getExpiryStatus = (timestamp?: Timestamp) => {
      const days = daysLeft(timestamp);
      if (typeof days !== 'number') return { text: 'N/A', isExpired: false, isToday: false, isUpcoming: false };

      if (days < 0) {
          return { text: `Expired ${Math.abs(days)} days ago`, isExpired: true, isToday: false, isUpcoming: false };
      }
      if (days === 0) {
          return { text: 'Today', isExpired: false, isToday: true, isUpcoming: false };
      }
      return { text: `in ${days} days`, isExpired: false, isToday: false, isUpcoming: true };
  };

  const BalanceAmount = ({ amount }: { amount: number }) => {
    const numericAmount = amount || 0;
    const isPositive = numericAmount > 0;
    const isNegative = numericAmount < 0;

    return (
      <span
        className={cn(
          'font-semibold',
          isPositive && 'text-destructive',
          isNegative && 'text-green-600'
        )}
      >
        {isNegative ? `-₹${Math.abs(numericAmount)}` : `₹${numericAmount}`}
      </span>
    );
  };


  return (
    <main className="min-h-screen w-full font-body text-foreground">
      <div className="container mx-auto flex flex-col items-center p-4 py-8 md:p-12">
        <header className="mb-10 flex w-full max-w-4xl flex-col items-center text-center">
          <div>
            <h1 className="text-4xl font-bold tracking-tighter md:text-5xl">
              Recharge Reminders
            </h1>
            <p className="mt-4 max-w-3xl text-lg text-muted-foreground md:text-xl">
              Customers whose subscription is expiring in the next 3 days or has already expired.
            </p>
          </div>
        </header>
        <Card className="w-full max-w-4xl">
          <CardHeader>
            <CardTitle>Upcoming & Recent Expiries</CardTitle>
          </CardHeader>
          <CardContent>
            {loading || authLoading ? (
              <div className="flex justify-center items-center h-40">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : (
              <>
              {/* Desktop View */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer Name</TableHead>
                      <TableHead>Mobile</TableHead>
                      <TableHead>Area</TableHead>
                      <TableHead>Expiry Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Balance</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expiringCustomers.length > 0 ? (
                      expiringCustomers.map((customer) => {
                        const status = getExpiryStatus(customer.expiryDate);
                        const isExpired = status.isExpired;
                        return (
                          <TableRow key={customer.id}>
                            <TableCell className="font-medium">{customer.name}</TableCell>
                            <TableCell>{customer.mobile}</TableCell>
                            <TableCell>{customer.area}</TableCell>
                            <TableCell>{formatDate(customer.expiryDate)}</TableCell>
                            <TableCell className={`font-bold ${status.isExpired ? 'text-destructive' : ''}`}>
                                {status.text}
                            </TableCell>
                            <TableCell>
                                <BalanceAmount amount={customer.balanceAmount} />
                            </TableCell>
                            <TableCell className="flex gap-1">
                              <Button variant="ghost" size="icon" asChild>
                                <a href={`tel:${customer.mobile}`}>
                                  <Phone className="h-4 w-4" />
                                </a>
                              </Button>
                              {!isNetworkServiceAgent && (
                                <Button variant="ghost" size="icon" asChild>
                                    <Link href={`/dashboard/customers/${customer.id}/edit`}>
                                        <Pencil className="h-4 w-4" />
                                    </Link>
                                </Button>
                              )}
                                <Button variant={isExpired ? "destructive" : "default"} size="sm" asChild>
                                  <Link href={`/dashboard/request-recharge/${customer.id}`}>
                                    <Send className="mr-2 h-4 w-4" />
                                    {isExpired ? 'Request Recharge' : 'Renewal'}
                                  </Link>
                                </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={7} className="h-24 text-center">
                          No customers with upcoming or recent expiries in your areas.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              {/* Mobile View */}
              <div className="md:hidden">
                {expiringCustomers.length > 0 ? (
                    <Accordion type="single" collapsible className="w-full">
                    {expiringCustomers.map((customer) => {
                        const status = getExpiryStatus(customer.expiryDate);
                        let badgeVariant: "destructive" | "secondary" | "default" = "secondary";
                        if (status.isExpired) badgeVariant = "destructive";
                        if (status.isToday) badgeVariant = "default";
                        const isExpired = status.isExpired;
                        
                        return (
                        <AccordionItem value={customer.id} key={customer.id}>
                            <AccordionTrigger>
                                <div className="flex justify-between w-full pr-4 items-center">
                                    <span className="font-medium">{customer.name}</span>
                                    <Badge variant={badgeVariant}>
                                      {status.text}
                                    </Badge>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent>
                                <div className="space-y-4 px-1 pt-2">
                                    <div className="text-sm text-muted-foreground">
                                        <p><span className="font-semibold text-foreground">Mobile:</span> {customer.mobile}</p>
                                        <p><span className="font-semibold text-foreground">Area:</span> {customer.area}</p>
                                        <p><span className="font-semibold text-foreground">Expiry Date:</span> {formatDate(customer.expiryDate)}</p>
                                        <p><span className="font-semibold text-foreground">Balance:</span> <BalanceAmount amount={customer.balanceAmount} /></p>
                                    </div>
                                    <div className="flex gap-2 pt-2">
                                        <Button variant="secondary" size="icon" asChild>
                                          <a href={`tel:${customer.mobile}`}>
                                            <Phone className="h-4 w-4" />
                                          </a>
                                        </Button>
                                        {!isNetworkServiceAgent && (
                                          <Button variant="secondary" size="icon" asChild>
                                            <Link href={`/dashboard/customers/${customer.id}/edit`}>
                                                  <Pencil className="h-4 w-4" />
                                            </Link>
                                          </Button>
                                        )}
                                        <Button className="flex-1" variant={isExpired ? "destructive" : "default"} asChild>
                                          <Link href={`/dashboard/request-recharge/${customer.id}`}>
                                            <Send className="mr-2 h-4 w-4" />
                                            {isExpired ? 'Request Recharge' : 'Renewal'}
                                          </Link>
                                        </Button>
                                    </div>
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    )})}
                    </Accordion>
                ) : (
                     <div className="text-center py-10 text-muted-foreground">
                        No customers with upcoming or recent expiries.
                     </div>
                )}
              </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
