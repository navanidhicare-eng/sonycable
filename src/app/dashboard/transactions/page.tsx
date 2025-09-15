
"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2, Calendar as CalendarIcon } from "lucide-react";
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

interface Transaction {
  id: string;
  customerName: string;
  amount: number;
  date: Timestamp;
  type: 'Recharge' | 'Payment';
  description: string;
  area: string;
}

interface Customer {
  id: string;
  area: string;
}

export default function TransactionsPage() {
  const [recharges, setRecharges] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [customers, setCustomers] = useState<Map<string, Customer>>(new Map());
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [filterArea, setFilterArea] = useState("all");
  const [filterType, setFilterType] = useState<"all" | "recharge" | "payment">("all");
  const [areaOptions, setAreaOptions] = useState<{ value: string; label: string }[]>([
    { value: "all", label: "All Areas" },
  ]);

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

    const customersQuery = query(collection(db, "customers"), where("userId", "==", user.uid));
    const rechargesQuery = query(collection(db, "recharges"), where("adminId", "==", user.uid));
    const paymentsQuery = query(collection(db, "payments"), where("adminId", "==", user.uid));
    const areasQuery = query(collection(db, "areas"), where("userId", "==", user.uid));
    
    const unsubs = [
      onSnapshot(customersQuery, (snapshot) => {
        const customerMap = new Map<string, Customer>();
        snapshot.forEach(doc => customerMap.set(doc.id, { id: doc.id, ...doc.data() } as Customer));
        setCustomers(customerMap);
      }),
      onSnapshot(rechargesQuery, (snapshot) => setRecharges(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })))),
      onSnapshot(paymentsQuery, (snapshot) => setPayments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })))),
      onSnapshot(areasQuery, (snapshot) => {
        const areasData = snapshot.docs.map(doc => ({ value: doc.data().name, label: doc.data().name }));
        setAreaOptions([{ value: "all", label: "All Areas" }, ...areasData]);
      }),
    ];

    const allQueries = [customersQuery, rechargesQuery, paymentsQuery, areasQuery];
    Promise.all(allQueries.map(q => new Promise(res => {
        const unsub = onSnapshot(q, () => { res(true); unsub(); });
    }))).finally(() => setLoading(false));

    return () => unsubs.forEach(unsub => unsub());

  }, [user, authLoading, toast]);
  
  const allTransactions = useMemo(() => {
    const combined: Transaction[] = [];
    
    recharges.forEach(r => {
        const customer = customers.get(r.customerId);
        combined.push({
            id: r.id,
            customerName: r.customerName,
            amount: r.amount,
            date: r.rechargeDate,
            type: 'Recharge',
            description: r.packageName,
            area: customer?.area || 'N/A',
        });
    });
    
    payments.forEach(p => {
        const customer = customers.get(p.customerId);
        combined.push({
            id: p.id,
            customerName: p.customerName,
            amount: p.amount,
            date: p.collectionDate,
            type: 'Payment',
            description: `Payment via ${p.method}`,
            area: customer?.area || 'N/A',
        });
    });

    return combined.sort((a,b) => b.date.seconds - a.date.seconds);
  }, [recharges, payments, customers]);


  const filteredTransactions = useMemo(() => {
    const from = date?.from;
    const to = date?.to;
    
    return allTransactions.filter(t => {
        const transactionDate = t.date.toDate();
        if(from && transactionDate < from) return false;
        if(to && transactionDate > to) return false;

        const searchTermLower = searchTerm.toLowerCase();
        const matchesSearch = t.customerName.toLowerCase().includes(searchTermLower) || t.description.toLowerCase().includes(searchTermLower);

        const matchesArea = filterArea === "all" || t.area === filterArea;
        
        const matchesType = filterType === "all" || (filterType === 'recharge' && t.type === 'Recharge') || (filterType === 'payment' && t.type === 'Payment');

        return matchesSearch && matchesArea && matchesType;
    });
  }, [allTransactions, searchTerm, filterArea, filterType, date]);


  return (
    <main className="min-h-screen w-full font-body text-foreground">
      <div className="container mx-auto flex flex-col items-center p-4 py-8 md:p-12">
        <header className="mb-10 flex w-full max-w-5xl flex-col items-center text-center">
          <h1 className="text-4xl font-bold tracking-tighter md:text-5xl">
            All Transactions
          </h1>
          <p className="mt-4 max-w-3xl text-lg text-muted-foreground md:text-xl">
            View and filter all recharges and payments across your network.
          </p>
        </header>

        <Card className="w-full max-w-5xl">
          <CardHeader>
            <CardTitle>Transaction History</CardTitle>
             <CardDescription>
                A unified log of all financial activities. Use the filters below to narrow down your results.
            </CardDescription>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="relative w-full">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="search"
                        placeholder="Search by customer, package..."
                        className="pl-9"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <Select value={filterArea} onValueChange={setFilterArea}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by area" />
                  </SelectTrigger>
                  <SelectContent>
                    {areaOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Select value={filterType} onValueChange={(val) => setFilterType(val as any)}>
                    <SelectTrigger>
                        <SelectValue placeholder="Filter by type" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="recharge">Recharge</SelectItem>
                        <SelectItem value="payment">Payment</SelectItem>
                    </SelectContent>
                </Select>

                <Popover>
                    <PopoverTrigger asChild>
                        <Button
                        id="date"
                        variant={"outline"}
                        className={cn(
                            "justify-start text-left font-normal",
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
                            <span>Pick a date range</span>
                        )}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
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
                    <TableHead>Customer</TableHead>
                    <TableHead>Area</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount (₹)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions.length > 0 ? (
                    filteredTransactions.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell>{t.date.toDate().toLocaleDateString('en-CA')}</TableCell>
                        <TableCell className="font-medium">{t.customerName}</TableCell>
                        <TableCell>{t.area}</TableCell>
                        <TableCell>
                            <Badge variant={t.type === 'Recharge' ? 'default' : 'secondary'}>{t.type}</Badge>
                        </TableCell>
                        <TableCell>{t.description}</TableCell>
                        <TableCell className="text-right font-medium">₹{t.amount.toLocaleString()}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center">
                        No transactions found for the selected filters.
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
