
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
import { Search, Loader2, Pencil, History, MessageSquareWarning } from "lucide-react";
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

  const isNetworkServiceAgent = useMemo(() => {
    if (!userRole) return false;
    return userRole.toLowerCase().replace(/\s/g, '') === 'networkserviceagent';
  }, [userRole]);


  useEffect(() => {
    if (authLoading || !user) {
      if (!authLoading) setLoading(false);
      return;
    }

    const fetchStaffDetails = async () => {
        setLoading(true);
        try {
            const staffQuery = query(collection(db, "staff"), where("uid", "==", user.uid));
            const staffSnapshot = await getDocs(staffQuery);

            if (staffSnapshot.empty) {
                toast({ variant: "destructive", title: "Staff details not found." });
                setLoading(false);
                return null;
            }

            const staffData = staffSnapshot.docs[0].data() as Staff;
            const fetchedAdminId = staffData.adminId;
            const fetchedAreas = staffData.area || [];
            
            setAdminId(fetchedAdminId);
            setStaffAssignedAreas(fetchedAreas);
            return { adminId: fetchedAdminId, assignedAreas: fetchedAreas };
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
      <div className="container mx-auto flex flex-col items-center p-2.5 sm:p-4 py-4 sm:py-8 md:p-12 max-w-4xl">
        <header className="mb-4 flex w-full flex-col items-start text-left">
          <h1 className="text-2xl font-bold tracking-tight sm:text-4xl">
            My Customers
          </h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-base">
            View customer information in your assigned areas.
          </p>
        </header>

        <Card className="w-full shadow-sm">
          <CardHeader className="p-3 sm:p-6 pb-2 sm:pb-4">
            <CardTitle className="text-base sm:text-xl">Customer List</CardTitle>
            <div className="mt-3 flex flex-col gap-2.5 sm:flex-row">
              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search customers..."
                  className="pl-9 h-9 text-xs sm:text-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select value={filterArea} onValueChange={setFilterArea}>
                <SelectTrigger className="w-full sm:w-[180px] h-9 text-xs sm:text-sm">
                  <SelectValue placeholder="Filter by area" />
                </SelectTrigger>
                <SelectContent>
                  {areaOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value} className="text-xs sm:text-sm">
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-2.5 sm:p-6 pt-0 sm:pt-0">
            {loading || authLoading ? (
                <div className="flex justify-center items-center h-40">
                    <Loader2 className="h-8 w-8 animate-spin" />
                </div>
            ) : (
                <>
                {/* 📱 MOBILE CARD VIEW (< md) - No horizontal scroll! */}
                <div className="block md:hidden space-y-2">
                  {filteredCustomers.length > 0 ? (
                    filteredCustomers.map((customer) => (
                      <div
                        key={customer.id}
                        className="p-3 rounded-xl border bg-card dark:bg-slate-900/60 shadow-xs hover:border-amber-500/50 transition-all space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2 border-b pb-2">
                          <div>
                            <Link
                              href={`/dashboard/customers/history?id=${customer.id}`}
                              className="font-bold text-sm text-primary hover:underline flex items-center gap-1.5"
                            >
                              {customer.name}
                            </Link>
                            <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">
                              📞 {customer.mobile}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {!isNetworkServiceAgent && (
                              <Button variant="outline" size="sm" className="h-7 px-2 text-xs" asChild>
                                <Link href={`/dashboard/customers/edit?id=${customer.id}`}>
                                  <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                                </Link>
                              </Button>
                            )}
                            <Button variant="default" size="sm" className="h-7 px-2 text-xs bg-amber-600 hover:bg-amber-700 text-white" asChild>
                              <Link href={`/dashboard/customers/history?id=${customer.id}`}>
                                <History className="h-3.5 w-3.5 mr-1" /> Passbook
                              </Link>
                            </Button>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-1.5 text-[11px] pt-0.5">
                          <div className="bg-muted/50 p-1.5 rounded-md">
                            <span className="text-muted-foreground block text-[9px] uppercase font-bold">Area</span>
                            <span className="font-semibold text-foreground truncate block">{customer.area || "N/A"}</span>
                          </div>
                          <div className="bg-muted/50 p-1.5 rounded-md">
                            <span className="text-muted-foreground block text-[9px] uppercase font-bold">STB ID</span>
                            <span className="font-semibold text-foreground truncate block">{customer.stbId || "N/A"}</span>
                          </div>
                          <div className="bg-muted/50 p-1.5 rounded-md">
                            <span className="text-muted-foreground block text-[9px] uppercase font-bold">Cust ID</span>
                            <span className="font-semibold text-foreground truncate block">{customer.customerId || "N/A"}</span>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-8 text-center text-xs text-muted-foreground border border-dashed rounded-xl">
                      No customers found in your assigned areas.
                    </div>
                  )}
                </div>

                {/* 💻 DESKTOP TABLE VIEW (>= md) */}
                <div className="hidden md:block overflow-x-auto w-full">
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
                                <Link href={`/dashboard/customers/history?id=${customer.id}`} className="hover:underline text-primary">
                                  {customer.name}
                                </Link>
                            </TableCell>
                            <TableCell>{customer.mobile}</TableCell>
                            <TableCell>{customer.area}</TableCell>
                            <TableCell>{customer.stbId}</TableCell>
                            <TableCell>{customer.customerId}</TableCell>
                            <TableCell className="flex gap-1">
                                {!isNetworkServiceAgent && (
                                    <Button variant="ghost" size="icon" asChild>
                                        <Link href={`/dashboard/customers/edit?id=${customer.id}`}>
                                            <Pencil className="h-4 w-4" />
                                        </Link>
                                    </Button>
                                )}
                                 <Button variant="ghost" size="icon" asChild title="Register Complaint">
                                    <Link href={`/dashboard/complaints-staff/add?id=${customer.id}`}>
                                        <MessageSquareWarning className="h-4 w-4 text-amber-600" />
                                    </Link>
                                </Button>
                                 <Button variant="ghost" size="icon" asChild title="View History">
                                    <Link href={`/dashboard/customers/history?id=${customer.id}`}>
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
                </div>
                </>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
    </>
  );
}
