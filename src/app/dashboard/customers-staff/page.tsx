
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
import { Search, Loader2, Pencil, History } from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, where, Timestamp, getDocs } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface Customer {
  id: string;
  name: string;
  mobile: string;
  area: string;
  stbId: string;
  customerId: string;
  userId: string; // Admin's UID
  createdAt: Timestamp;
  lastRechargeDate?: Timestamp;
}

interface Staff {
    area: string[];
    adminId: string;
}

export default function StaffCustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterArea, setFilterArea] = useState("all");
  const [areaOptions, setAreaOptions] = useState<{ value: string; label: string }[]>([
    { value: "all", label: "All Areas" },
  ]);
  const { toast } = useToast();
  const { user, userRole, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [staffAssignedAreas, setStaffAssignedAreas] = useState<string[]>([]);
  const [adminId, setAdminId] = useState<string | null>(null);

  const isNetworkServiceAgent = userRole === "Network Service Agent";

  useEffect(() => {
    if (authLoading || !user) {
      if (!authLoading) setLoading(false);
      return;
    }

    const fetchStaffDetails = async () => {
        try {
            const staffQuery = query(collection(db, "staff"), where("uid", "==", user.uid));
            const staffSnapshot = await getDocs(staffQuery);

            if (staffSnapshot.empty) {
                toast({ variant: "destructive", title: "Staff details not found." });
                setLoading(false);
                return null;
            }

            const staffData = staffSnapshot.docs[0].data() as Staff;
            setAdminId(staffData.adminId);
            setStaffAssignedAreas(staffData.area || []);
            return { adminId: staffData.adminId, assignedAreas: staffData.area || [] };
        } catch (error) {
            console.error("Error fetching staff data:", error);
            toast({ variant: "destructive", title: "An error occurred fetching your details." });
            setLoading(false);
            return null;
        }
    };

    const setupListeners = (adminId: string, assignedAreas: string[]) => {
        const unsubscribes: (() => void)[] = [];

        const areasQuery = query(collection(db, "areas"), where("userId", "==", adminId));
        unsubscribes.push(onSnapshot(areasQuery, (snapshot) => {
            const areasData = snapshot.docs.map(doc => ({ value: doc.data().name, label: doc.data().name }));
            setAreaOptions([{ value: "all", label: "All Areas" }, ...areasData]);
        }));

        let customersQuery;
        if (assignedAreas.length > 0) {
            customersQuery = query(
                collection(db, "customers"), 
                where("userId", "==", adminId),
                where("area", "in", assignedAreas)
            );
        } else {
             // If no areas assigned, fetch no customers
            customersQuery = query(collection(db, "customers"), where("userId", "==", "nonexistent"));
        }

        unsubscribes.push(onSnapshot(customersQuery, (snapshot) => {
            const customersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
            customersData.sort((a, b) => b.createdAt.seconds - a.createdAt.seconds);
            setCustomers(customersData);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching customers:", error);
            toast({ variant: "destructive", title: "Failed to fetch customers" });
            setLoading(false);
        }));

        return () => unsubscribes.forEach(unsub => unsub());
    };
    
    let unsubscribeAll: (() => void) | undefined;
    fetchStaffDetails().then(staffDetails => {
        if(staffDetails?.adminId) {
             unsubscribeAll = setupListeners(staffDetails.adminId, staffDetails.assignedAreas);
        } else {
            setLoading(false);
        }
    });

    return () => {
      if (unsubscribeAll) unsubscribeAll();
    };

  }, [user, authLoading, toast]);

  const filteredCustomers = useMemo(() => {
    return customers.filter((customer) => {
      const searchTermLower = searchTerm.toLowerCase();
      const matchesSearch =
        customer.name.toLowerCase().includes(searchTermLower) ||
        customer.mobile.includes(searchTerm) ||
        (customer.stbId && customer.stbId.toLowerCase().includes(searchTermLower)) ||
        (customer.customerId && customer.customerId.toLowerCase().includes(searchTermLower));

      const matchesArea =
        filterArea === "all" || customer.area === filterArea;

      return matchesSearch && matchesArea;
    });
  }, [searchTerm, filterArea, customers]);

  return (
    <>
    <main className="min-h-screen w-full font-body text-foreground">
      <div className="container mx-auto flex flex-col items-center p-4 py-8 md:p-12">
        <header className="mb-10 flex w-full max-w-4xl flex-col items-center text-center sm:flex-row sm:justify-between sm:text-left">
          <div>
            <h1 className="text-4xl font-bold tracking-tighter md:text-5xl">
              My Customers
            </h1>
            <p className="mt-4 max-w-3xl text-lg text-muted-foreground md:text-xl">
              View customer information in your assigned areas.
            </p>
          </div>
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
                    <TableHead>Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {filteredCustomers.length > 0 ? (
                    filteredCustomers.map((customer) => (
                        <TableRow key={customer.id}>
                        <TableCell className="font-medium">
                            {customer.name}
                        </TableCell>
                        <TableCell>{customer.mobile}</TableCell>
                        <TableCell>{customer.area}</TableCell>
                        <TableCell>{customer.stbId}</TableCell>
                        <TableCell>{customer.customerId}</TableCell>
                        <TableCell className="flex gap-1">
                            {!isNetworkServiceAgent && (
                                <Button variant="ghost" size="icon" asChild>
                                    <Link href={`/dashboard/customers/${customer.id}/edit`}>
                                        <Pencil className="h-4 w-4" />
                                    </Link>
                                </Button>
                            )}
                             <Button variant="ghost" size="icon" asChild>
                                <Link href={`/dashboard/customers/${customer.id}/history`}>
                                    <History className="h-4 w-4" />
                                </Link>
                            </Button>
                        </TableCell>
                        </TableRow>
                    ))
                    ) : (
                    <TableRow>
                        <TableCell
                        colSpan={6}
                        className="h-24 text-center"
                        >
                        No customers found in your assigned areas.
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
    </>
  );
}
