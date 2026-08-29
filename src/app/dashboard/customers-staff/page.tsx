
"use client";

import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { Search, Loader2, Pencil, History, MessageSquareWarning, IndianRupee, MapPin, X, Users, Phone } from "lucide-react";
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
      unsubscribes.push(
        onSnapshot(areasQuery, (snapshot) => {
          const areasData = snapshot.docs.map((doc) => ({
            value: doc.data().name,
            label: doc.data().name,
          }));
          setAreaOptions([{ value: "all", label: "All Areas" }, ...areasData]);
        })
      );

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

      unsubscribes.push(
        onSnapshot(
          customersQuery,
          (snapshot) => {
            const customersData = snapshot.docs.map(
              (doc) => ({ id: doc.id, ...doc.data() } as Customer)
            );
            customersData.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
            setCustomers(customersData);
            setLoading(false);
          },
          (error) => {
            console.error("Error fetching customers:", error);
            toast({ variant: "destructive", title: "Failed to fetch customers" });
            setLoading(false);
          }
        )
      );

      return () => unsubscribes.forEach((unsub) => unsub());
    };

    let unsubscribeAll: (() => void) | undefined;
    fetchStaffDetails().then((staffDetails) => {
      if (staffDetails?.adminId) {
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

      const matchesArea = filterArea === "all" || customer.area === filterArea;

      return matchesSearch && matchesArea;
    });
  }, [searchTerm, filterArea, customers]);

  return (
    <main className="min-h-screen w-full font-body text-foreground bg-muted/20 pb-12">
      <div className="container mx-auto p-4 py-6 sm:py-8 max-w-6xl space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Users className="h-7 w-7 text-orange-500" />
              My Customers
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
              View customer details, recharge accounts, and log complaints in your assigned areas.
            </p>
          </div>
          <Badge variant="outline" className="w-fit px-3 py-1 text-xs font-semibold bg-background shadow-xs border-amber-300">
            Total: {filteredCustomers.length} Customer{filteredCustomers.length === 1 ? "" : "s"}
          </Badge>
        </div>

        {/* Main Card */}
        <Card className="w-full shadow-sm border-muted-foreground/15 overflow-hidden">
          <CardHeader className="p-4 sm:p-6 bg-card border-b">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
                Customer List
              </CardTitle>

              {/* Filters Row */}
              <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
                {/* Search Input */}
                <div className="relative flex-1 sm:w-64">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Search name, mobile, STB..."
                    className="pl-9 pr-8 h-9 text-xs sm:text-sm bg-background"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm("")}
                      className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {/* Area Dropdown */}
                <div className="w-full sm:w-48">
                  <Select value={filterArea} onValueChange={setFilterArea}>
                    <SelectTrigger className="h-9 text-xs sm:text-sm bg-background">
                      <MapPin className="h-3.5 w-3.5 mr-1.5 text-orange-500 shrink-0" />
                      <SelectValue placeholder="All Areas" />
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

                {/* Reset Filters button */}
                {(searchTerm || filterArea !== "all") && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSearchTerm("");
                      setFilterArea("all");
                    }}
                    className="h-9 px-2 text-xs text-muted-foreground hover:text-foreground"
                  >
                    Reset
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {loading || authLoading ? (
              <div className="flex flex-col justify-center items-center h-48 gap-2 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
                <span className="text-xs font-medium">Loading customers...</span>
              </div>
            ) : (
              <>
                {/* 📱 MOBILE CARD VIEW (< md) */}
                <div className="block md:hidden p-3 space-y-3">
                  {filteredCustomers.length > 0 ? (
                    filteredCustomers.map((customer) => (
                      <div
                        key={customer.id}
                        className="p-3.5 rounded-xl border bg-card shadow-2xs space-y-3 hover:border-orange-500/40 transition-all"
                      >
                        <div className="flex items-start justify-between gap-2 border-b pb-2">
                          <div>
                            <Link
                              href={`/dashboard/customers/history?id=${customer.id}`}
                              className="font-bold text-sm text-foreground hover:text-orange-600 transition-colors block"
                            >
                              {customer.name}
                            </Link>
                            <a
                              href={`tel:${customer.mobile}`}
                              className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5 inline-flex items-center gap-1 hover:underline"
                            >
                              <Phone className="h-3 w-3" /> {customer.mobile}
                            </a>
                          </div>
                          {customer.customerId && (
                            <Badge variant="secondary" className="font-mono text-[10px] px-1.5 py-0.5">
                              ID: {customer.customerId}
                            </Badge>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                          <div className="bg-muted/40 p-2 rounded-lg">
                            <span className="text-muted-foreground block text-[9px] uppercase font-bold tracking-wider">Area</span>
                            <span className="font-semibold text-foreground truncate block">{customer.area || "N/A"}</span>
                          </div>
                          <div className="bg-muted/40 p-2 rounded-lg">
                            <span className="text-muted-foreground block text-[9px] uppercase font-bold tracking-wider">STB VC Number</span>
                            <span className="font-mono font-semibold text-foreground truncate block">{customer.stbId || "N/A"}</span>
                          </div>
                        </div>

                        {/* Mobile Action Buttons */}
                        <div className="flex items-center justify-between gap-1.5 pt-1 border-t">
                          {!isNetworkServiceAgent && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 flex-1 text-xs border-blue-200 bg-blue-50/50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800"
                              asChild
                            >
                              <Link href={`/dashboard/customers/edit?id=${customer.id}`}>
                                <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                              </Link>
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 flex-1 text-xs border-amber-200 bg-amber-50/50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
                            asChild
                          >
                            <Link href={`/dashboard/complaints-staff/add?id=${customer.id}`}>
                              <MessageSquareWarning className="h-3.5 w-3.5 mr-1" /> Issue
                            </Link>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 flex-1 text-xs border-emerald-200 bg-emerald-50/50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                            asChild
                          >
                            <Link href={`/dashboard/customers/history?id=${customer.id}`}>
                              <History className="h-3.5 w-3.5 mr-1" /> Ledger
                            </Link>
                          </Button>
                          <Button
                            variant="default"
                            size="sm"
                            className="h-8 flex-1 text-xs bg-orange-600 hover:bg-orange-700 text-white font-semibold shadow-xs"
                            asChild
                          >
                            <Link href={`/dashboard/recharge?customerName=${encodeURIComponent(customer.name)}`}>
                              <IndianRupee className="h-3.5 w-3.5 mr-0.5" /> Recharge
                            </Link>
                          </Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-12 text-center text-xs text-muted-foreground border border-dashed rounded-xl">
                      No customers found matching your search.
                    </div>
                  )}
                </div>

                {/* 💻 DESKTOP TABLE VIEW (>= md) */}
                <div className="hidden md:block overflow-x-auto w-full">
                  <Table className="w-full">
                    <TableHeader className="bg-muted/40">
                      <TableRow>
                        <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Customer Name</TableHead>
                        <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Mobile</TableHead>
                        <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Area</TableHead>
                        <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground">STB VC ID</TableHead>
                        <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Customer ID</TableHead>
                        <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground text-right pr-6 min-w-[200px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCustomers.length > 0 ? (
                        filteredCustomers.map((customer) => (
                          <TableRow key={customer.id} className="hover:bg-muted/30 transition-colors">
                            {/* Customer Name */}
                            <TableCell className="font-bold text-sm">
                              <Link
                                href={`/dashboard/customers/history?id=${customer.id}`}
                                className="text-foreground hover:text-orange-600 transition-colors"
                              >
                                {customer.name}
                              </Link>
                            </TableCell>

                            {/* Mobile */}
                            <TableCell className="font-mono text-xs font-semibold text-foreground/80">
                              <a href={`tel:${customer.mobile}`} className="hover:underline hover:text-emerald-600">
                                {customer.mobile}
                              </a>
                            </TableCell>

                            {/* Area */}
                            <TableCell className="text-xs font-medium text-muted-foreground">
                              {customer.area || "N/A"}
                            </TableCell>

                            {/* STB ID */}
                            <TableCell className="font-mono text-xs font-semibold">
                              {customer.stbId ? (
                                <span className="bg-muted/60 px-2 py-0.5 rounded border border-muted-foreground/15">
                                  {customer.stbId}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">N/A</span>
                              )}
                            </TableCell>

                            {/* Customer ID */}
                            <TableCell className="font-mono text-xs text-muted-foreground font-semibold">
                              {customer.customerId || "N/A"}
                            </TableCell>

                            {/* Actions Column with clear, high-contrast, spaced buttons */}
                            <TableCell className="text-right pr-6 whitespace-nowrap min-w-[200px]">
                              <div className="flex items-center justify-end gap-2">
                                {/* Edit Button */}
                                {!isNetworkServiceAgent && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 px-2.5 text-xs border-blue-200 bg-blue-50/60 text-blue-700 hover:bg-blue-100 hover:text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800 transition-colors"
                                    asChild
                                    title="Edit Customer Details"
                                  >
                                    <Link href={`/dashboard/customers/edit?id=${customer.id}`}>
                                      <Pencil className="h-3.5 w-3.5 mr-1" />
                                      Edit
                                    </Link>
                                  </Button>
                                )}

                                {/* Complaint Button */}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 px-2.5 text-xs border-amber-200 bg-amber-50/60 text-amber-700 hover:bg-amber-100 hover:text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800 transition-colors"
                                  asChild
                                  title="Register Complaint / Service Request"
                                >
                                  <Link href={`/dashboard/complaints-staff/add?id=${customer.id}`}>
                                    <MessageSquareWarning className="h-3.5 w-3.5 mr-1" />
                                    Issue
                                  </Link>
                                </Button>

                                {/* Passbook Ledger Button */}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 px-2.5 text-xs border-emerald-200 bg-emerald-50/60 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800 transition-colors"
                                  asChild
                                  title="View Passbook / Ledger History"
                                >
                                  <Link href={`/dashboard/customers/history?id=${customer.id}`}>
                                    <History className="h-3.5 w-3.5 mr-1" />
                                    Ledger
                                  </Link>
                                </Button>

                                {/* Recharge Button */}
                                <Button
                                  variant="default"
                                  size="sm"
                                  className="h-8 px-2.5 text-xs bg-orange-600 hover:bg-orange-700 text-white font-semibold shadow-2xs transition-colors"
                                  asChild
                                  title="Recharge Customer Account"
                                >
                                  <Link href={`/dashboard/recharge?customerName=${encodeURIComponent(customer.name)}`}>
                                    <IndianRupee className="h-3.5 w-3.5 mr-0.5" />
                                    Recharge
                                  </Link>
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell
                            colSpan={6}
                            className="h-32 text-center text-muted-foreground text-sm"
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
  );
}

