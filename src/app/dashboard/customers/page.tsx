
"use client";

import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { PlusCircle, Search, Loader2 } from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface Customer {
  id: string;
  name: string;
  mobile: string;
  area: string;
  stbId: string;
  customerId: string;
  userId: string;
  createdAt: {
    seconds: number;
    nanoseconds: number;
  };
}

const areaOptions = [
  { value: "all", label: "All Areas" },
  { value: "KPHB", label: "KPHB" },
  { value: "Nizampet", label: "Nizampet" },
  { value: "Pragathi Nagar", label: "Pragathi Nagar" },
  { value: "Bachupally", label: "Bachupally" },
];

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterArea, setFilterArea] = useState("all");
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
        setLoading(false);
        return;
    };

    const q = query(collection(db, "customers"), where("userId", "==", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const customersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
      customersData.sort((a, b) => b.createdAt.seconds - a.createdAt.seconds);
      setCustomers(customersData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching customers: ", error);
      toast({
        variant: "destructive",
        title: "Failed to fetch customers",
        description: "Could not retrieve customer data. Check permissions.",
      });
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, authLoading, toast]);

  const filteredCustomers = useMemo(() => {
    return customers.filter((customer) => {
      const searchTermLower = searchTerm.toLowerCase();
      const matchesSearch =
        customer.name.toLowerCase().includes(searchTermLower) ||
        customer.mobile.includes(searchTerm) ||
        customer.stbId.toLowerCase().includes(searchTermLower) ||
        customer.customerId.toLowerCase().includes(searchTermLower);

      const matchesArea =
        filterArea === "all" || customer.area === filterArea;

      return matchesSearch && matchesArea;
    });
  }, [searchTerm, filterArea, customers]);

  return (
    <main className="min-h-screen w-full font-body text-foreground">
      <div className="container mx-auto flex flex-col items-center p-4 py-8 md:p-12">
        <header className="mb-10 flex w-full max-w-4xl flex-col items-center text-center sm:flex-row sm:justify-between sm:text-left">
          <div>
            <h1 className="text-4xl font-bold tracking-tighter md:text-5xl">
              Customers
            </h1>
            <p className="mt-4 max-w-3xl text-lg text-muted-foreground md:text-xl">
              Manage your customer information here.
            </p>
          </div>
          <Button asChild className="mt-4 sm:mt-0">
            <Link href="/dashboard/customers/add">
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Customer
            </Link>
          </Button>
        </header>
        <Card className="w-full max-w-4xl">
          <CardHeader>
            <CardTitle>Customer List</CardTitle>
            <div className="mt-4 flex flex-col gap-4 sm:flex-row">
              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search customers..."
                  className="pl-9"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select value={filterArea} onValueChange={setFilterArea}>
                <SelectTrigger className="w-full sm:w-[180px]">
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
                    <TableHead>Customer Name</TableHead>
                    <TableHead>Mobile</TableHead>
                    <TableHead>Area</TableHead>
                    <TableHead>STB ID</TableHead>
                    <TableHead>Customer ID</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {filteredCustomers.length > 0 ? (
                    filteredCustomers.map((customer) => (
                        <TableRow key={customer.id}>
                        <TableCell className="font-medium">
                            <Link href={`/dashboard/customers/${customer.id}/history`} className="hover:underline text-primary">
                            {customer.name}
                            </Link>
                        </TableCell>
                        <TableCell>{customer.mobile}</TableCell>
                        <TableCell>{customer.area}</TableCell>
                        <TableCell>{customer.stbId}</TableCell>
                        <TableCell>{customer.customerId}</TableCell>
                        </TableRow>
                    ))
                    ) : (
                    <TableRow>
                        <TableCell
                        colSpan={5}
                        className="h-24 text-center"
                        >
                        No results found.
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
