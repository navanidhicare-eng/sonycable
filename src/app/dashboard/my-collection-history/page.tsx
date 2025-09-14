
"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Calendar as CalendarIcon, IndianRupee, Wallet, ArrowRightLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { collection, onSnapshot, query, where, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { DateRange } from "react-day-picker";
import { addDays, format } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";


interface CollectionHistoryItem {
    id: string;
    customerName: string;
    amount: number;
    method: string;
    collectionDate: Timestamp;
}

interface Settlement {
  id: string;
  amountToSend: number;
  status: 'pending' | 'approved';
  createdAt: Timestamp;
}


export default function MyCollectionHistoryPage() {
  const [collections, setCollections] = useState<CollectionHistoryItem[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();

  const [date, setDate] = useState<DateRange | undefined>({
    from: addDays(new Date(), -30),
    to: new Date(),
  });

  useEffect(() => {
    if (authLoading || !user) {
        if (!authLoading) setLoading(false);
        return;
    }

    setLoading(true);
    const collectionsQuery = query(
        collection(db, "payments"), 
        where("collectedBy", "==", user.uid)
    );
    const settlementsQuery = query(
        collection(db, "settlements"),
        where("staffId", "==", user.uid)
    );
    
    const unsubscribeCollections = onSnapshot(collectionsQuery, (snapshot) => {
        const historyData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CollectionHistoryItem));
        setCollections(historyData);
    }, (error) => {
        console.error("Error fetching collection history:", error);
        toast({ variant: "destructive", title: "Failed to fetch collection history" });
    });

    const unsubscribeSettlements = onSnapshot(settlementsQuery, (snapshot) => {
        const settlementData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Settlement));
        setSettlements(settlementData);
    }, (error) => {
        console.error("Error fetching settlement history:", error);
        toast({ variant: "destructive", title: "Failed to fetch settlement history" });
    });
    
    // Combine loading states
    const checkLoading = () => {
        if (collections.length > 0 || settlements.length > 0 || !authLoading) {
            setLoading(false);
        }
    }
    // A simple timeout to prevent infinite loading state if collections are empty
    const timer = setTimeout(checkLoading, 2000);


    return () => {
        unsubscribeCollections();
        unsubscribeSettlements();
        clearTimeout(timer);
    };
  }, [user, authLoading, toast]);
  
  const { 
    filteredCollections, 
    filteredSettlements, 
    totalCollected, 
    totalSettled, 
    remainingBalance 
  } = useMemo(() => {
    const from = date?.from;
    const to = date?.to;

    const filteredCollections = collections.filter(c => {
      const collectionDate = c.collectionDate.toDate();
      if (from && collectionDate < from) return false;
      if (to && collectionDate > to) return false;
      return true;
    });

    const filteredSettlements = settlements.filter(s => {
      const settlementDate = s.createdAt.toDate();
      if (from && settlementDate < from) return false;
      if (to && settlementDate > to) return false;
      return true;
    });

    const totalCollected = filteredCollections.reduce((sum, item) => sum + item.amount, 0);
    const totalSettled = filteredSettlements
        .filter(s => s.status === 'approved')
        .reduce((sum, item) => sum + item.amountToSend, 0);
    
    const remainingBalance = totalCollected - totalSettled;

    filteredCollections.sort((a,b) => b.collectionDate.seconds - a.collectionDate.seconds);
    filteredSettlements.sort((a,b) => b.createdAt.seconds - a.createdAt.seconds);
    
    return { filteredCollections, filteredSettlements, totalCollected, totalSettled, remainingBalance };

  }, [collections, settlements, date]);


  return (
    <>
      <main className="min-h-screen w-full font-body text-foreground">
        <div className="container mx-auto flex flex-col items-center p-4 py-8 md:p-12">
          <header className="mb-10 flex w-full max-w-4xl flex-col items-center text-center sm:flex-row sm:justify-between sm:text-left">
            <div>
              <h1 className="text-4xl font-bold tracking-tighter md:text-5xl">
                My Collection History
              </h1>
              <p className="mt-4 max-w-3xl text-lg text-muted-foreground md:text-xl">
                View all the payments you have collected.
              </p>
            </div>
             <div className="mt-4 sm:mt-0">
               <Popover>
                    <PopoverTrigger asChild>
                        <Button
                        id="date"
                        variant={"outline"}
                        className={cn(
                            "w-[300px] justify-start text-left font-normal",
                            !date && "text-muted-foreground"
                        )}
                        >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {date?.from ? (
                            date.to ? (
                            <>
                                {format(date.from, "LLL dd, y")} -{" "}
                                {format(date.to, "LLL dd, y")}
                            </>
                            ) : (
                            format(date.from, "LLL dd, y")
                            )
                        ) : (
                            <span>Pick a date</span>
                        )}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                        <Calendar
                        initialFocus
                        mode="range"
                        defaultMonth={date?.from}
                        selected={date}
                        onSelect={setDate}
                        numberOfMonths={2}
                        />
                    </PopoverContent>
                </Popover>
            </div>
          </header>
          
           <div className="grid gap-4 md:grid-cols-3 w-full max-w-4xl mb-8">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Collected</CardTitle>
                    <IndianRupee className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">₹{totalCollected.toLocaleString()}</div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Settled</CardTitle>
                    <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">₹{totalSettled.toLocaleString()}</div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Remaining Balance</CardTitle>
                    <Wallet className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-primary">₹{remainingBalance.toLocaleString()}</div>
                </CardContent>
            </Card>
          </div>
          
          <Tabs defaultValue="collections" className="w-full max-w-4xl">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="collections">Collection History</TabsTrigger>
                <TabsTrigger value="settlements">Settlement History</TabsTrigger>
            </TabsList>
            <TabsContent value="collections">
                <Card>
                    <CardHeader>
                        <CardTitle>All Collections</CardTitle>
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
                            <TableHead>Date</TableHead>
                            <TableHead>Customer Name</TableHead>
                            <TableHead>Amount (₹)</TableHead>
                            <TableHead>Method</TableHead>
                        </TableRow>
                        </TableHeader>
                        <TableBody>
                        {filteredCollections.length > 0 ? (
                            filteredCollections.map((item) => (
                            <TableRow key={item.id}>
                                <TableCell>{item.collectionDate.toDate().toLocaleDateString('en-CA')}</TableCell>
                                <TableCell className="font-medium">
                                {item.customerName}
                                </TableCell>
                                <TableCell>₹{item.amount.toLocaleString()}</TableCell>
                                <TableCell>
                                <Badge variant="secondary">{item.method}</Badge>
                                </TableCell>
                            </TableRow>
                            ))
                        ) : (
                            <TableRow>
                            <TableCell colSpan={4} className="h-24 text-center">
                                No collections found in this date range.
                            </TableCell>
                            </TableRow>
                        )}
                        </TableBody>
                    </Table>
                    )}
                    </CardContent>
                </Card>
            </TabsContent>
            <TabsContent value="settlements">
                 <Card>
                    <CardHeader>
                        <CardTitle>All Settlements</CardTitle>
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
                            <TableHead>Date</TableHead>
                            <TableHead>Amount (₹)</TableHead>
                            <TableHead>Status</TableHead>
                        </TableRow>
                        </TableHeader>
                        <TableBody>
                        {filteredSettlements.length > 0 ? (
                            filteredSettlements.map((item) => (
                            <TableRow key={item.id}>
                                <TableCell>{item.createdAt.toDate().toLocaleDateString('en-CA')}</TableCell>
                                <TableCell>₹{item.amountToSend.toLocaleString()}</TableCell>
                                <TableCell>
                                 <Badge variant={item.status === 'approved' ? 'default' : 'destructive'}>{item.status}</Badge>
                                </TableCell>
                            </TableRow>
                            ))
                        ) : (
                            <TableRow>
                            <TableCell colSpan={3} className="h-24 text-center">
                                No settlements found in this date range.
                            </TableCell>
                            </TableRow>
                        )}
                        </TableBody>
                    </Table>
                    )}
                    </CardContent>
                </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </>
  );
}
