
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
import { PlusCircle, Search, Loader2, Upload, RefreshCw, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, where, Timestamp, writeBatch, doc, getDocs, addDoc, deleteDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import Papa from "papaparse";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  lastRechargeDate?: Timestamp;
}

interface Area {
  id: string;
  name: string;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterArea, setFilterArea] = useState("all");
  const [areaOptions, setAreaOptions] = useState<{ value: string; label: string }[]>([
    { value: "all", label: "All Areas" },
  ]);
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
        setLoading(false);
        return;
    };

    const customersQuery = query(collection(db, "customers"), where("userId", "==", user.uid));
    const customersUnsubscribe = onSnapshot(customersQuery, (snapshot) => {
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

    const areasQuery = query(collection(db, "areas"), where("userId", "==", user.uid));
    const areasUnsubscribe = onSnapshot(areasQuery, (snapshot) => {
        const areasData = snapshot.docs.map(doc => ({ value: doc.data().name, label: doc.data().name }));
        setAreaOptions([{ value: "all", label: "All Areas" }, ...areasData]);
    }, (error) => {
        console.error("Error fetching areas: ", error);
        toast({
            variant: "destructive",
            title: "Failed to fetch areas",
            description: "Could not load areas for filtering.",
        });
    });


    return () => {
      customersUnsubscribe();
      areasUnsubscribe();
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

  const formatDate = (timestamp?: Timestamp) => {
    if (!timestamp) return 'N/A';
    return timestamp.toDate().toLocaleDateString('en-CA');
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    setIsUploading(true);
    
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const requiredFields = ["customerName", "mobileNumber", "area", "stbId", "customerId"];
        const headers = results.meta.fields || [];
        const missingHeaders = requiredFields.filter(h => !headers.includes(h));

        if (missingHeaders.length > 0) {
          toast({
            variant: "destructive",
            title: "Invalid CSV format",
            description: `Missing required columns: ${missingHeaders.join(", ")}`
          });
          setIsUploading(false);
          return;
        }

        const newCustomers = results.data as any[];

        try {
          const batch = writeBatch(db);
          newCustomers.forEach(cust => {
            const customerRef = doc(collection(db, "customers"));

            const lastRechargeDate = cust.lastRechargeDate ? new Date(cust.lastRechargeDate) : null;
            let expiryDate = null;
            if (lastRechargeDate) {
              expiryDate = new Date(lastRechargeDate);
              expiryDate.setDate(expiryDate.getDate() + 30);
            }
            
            batch.set(customerRef, {
              name: cust.customerName,
              mobile: cust.mobileNumber,
              area: cust.area,
              stbId: cust.stbId,
              customerId: cust.customerId,
              balanceAmount: parseFloat(cust.balanceAmount) || 0,
              lastRechargeDate: lastRechargeDate ? Timestamp.fromDate(lastRechargeDate) : null,
              expiryDate: expiryDate ? Timestamp.fromDate(expiryDate) : null,
              createdAt: new Date(),
              userId: user.uid,
            });
          });

          await batch.commit();

          toast({
            title: "Upload Successful",
            description: `${newCustomers.length} customers have been added.`
          });

        } catch (error) {
            console.error("Error bulk adding customers:", error);
            toast({
              variant: "destructive",
              title: "Upload Failed",
              description: "An error occurred while saving the customer data."
            });
        } finally {
          setIsUploading(false);
          setIsUploadDialogOpen(false);
        }
      },
      error: (error: any) => {
        toast({
          variant: "destructive",
          title: "File Read Error",
          description: error.message
        });
        setIsUploading(false);
      }
    });
  };

  const generateCsvTemplate = () => {
    const headers = "customerName,mobileNumber,area,stbId,customerId,balanceAmount,lastRechargeDate\n";
    const exampleRow = "John Doe,9876543210,Main Area,123456789,CUST001,50,2023-01-15";
    const content = headers + exampleRow;
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    if (link.href) {
      URL.revokeObjectURL(link.href);
    }
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.setAttribute("download", "customer_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const handleSyncAreas = async () => {
    if (!user) return;
    setIsSyncing(true);
    try {
      // 1. Get all unique area names from customers
      const uniqueCustomerAreas = new Set(customers.map(c => c.area.trim()).filter(Boolean));

      // 2. Get all existing area names from the areas collection
      const areasQuery = query(collection(db, "areas"), where("userId", "==", user.uid));
      const areasSnapshot = await getDocs(areasQuery);
      const existingAreas = new Set(areasSnapshot.docs.map(doc => doc.data().name.trim()));

      // 3. Find which areas are new
      const newAreas = [...uniqueCustomerAreas].filter(area => !existingAreas.has(area));

      if (newAreas.length === 0) {
        toast({ title: "Areas Synced", description: "All customer areas are already up to date." });
        return;
      }

      // 4. Add new areas to the 'areas' collection
      const batch = writeBatch(db);
      newAreas.forEach(areaName => {
        const newAreaRef = doc(collection(db, "areas"));
        batch.set(newAreaRef, {
          name: areaName,
          description: "Auto-synced from customers",
          createdAt: new Date(),
          userId: user.uid,
        });
      });
      await batch.commit();
      
      toast({
        title: "Sync Successful",
        description: `${newAreas.length} new area(s) have been added.`
      });

    } catch (error) {
       console.error("Error syncing areas:", error);
       toast({
         variant: "destructive",
         title: "Sync Failed",
         description: "An error occurred while syncing areas.",
       });
    } finally {
        setIsSyncing(false);
    }
  };
  
  const openDeleteDialog = (customer: Customer) => {
    setCustomerToDelete(customer);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteCustomer = async () => {
    if (!customerToDelete) return;

    try {
      await deleteDoc(doc(db, "customers", customerToDelete.id));
      toast({
        title: "Customer Deleted",
        description: `${customerToDelete.name} has been removed successfully.`,
      });
    } catch (error) {
      console.error("Error deleting customer: ", error);
      toast({
        variant: "destructive",
        title: "Deletion Failed",
        description: "An error occurred while deleting the customer.",
      });
    } finally {
      setIsDeleteDialogOpen(false);
      setCustomerToDelete(null);
    }
  };


  return (
    <>
    <main className="min-h-screen w-full font-body text-foreground">
      <div className="container mx-auto flex flex-col items-center p-2.5 sm:p-4 py-4 sm:py-8 md:p-12 max-w-4xl">
        <header className="mb-4 flex w-full flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-4xl">
              Customers
            </h1>
            <p className="mt-1 text-xs text-muted-foreground sm:text-base">
              Manage your customer information here.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5 w-full sm:w-auto">
             <Button variant="outline" size="sm" onClick={handleSyncAreas} disabled={isSyncing} className="h-8 text-xs flex-1 sm:flex-none">
                {isSyncing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
                Sync Areas
              </Button>
             <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-xs flex-1 sm:flex-none">
                  <Upload className="mr-1.5 h-3.5 w-3.5" />
                  Bulk Upload
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Bulk Upload Customers</DialogTitle>
                  <DialogDescription>
                    Upload a CSV file with customer data. Please ensure it follows the correct format.
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                  <p className="text-sm text-muted-foreground mb-2">
                    Required columns: `customerName`, `mobileNumber`, `area`, `stbId`, `customerId`.
                  </p>
                   <p className="text-sm text-muted-foreground mb-4">
                    Optional columns: `balanceAmount`, `lastRechargeDate` (in YYYY-MM-DD format).
                  </p>
                  <Button variant="link" onClick={generateCsvTemplate} className="p-0 h-auto mb-4">
                    Download CSV Template
                  </Button>
                  <Input type="file" accept=".csv" onChange={handleFileUpload} disabled={isUploading} />
                  {isUploading && (
                    <div className="flex items-center mt-4 text-muted-foreground">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      <span>Processing file, please wait...</span>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
            <Button size="sm" className="h-8 text-xs flex-1 sm:flex-none" asChild>
              <Link href="/dashboard/customers/add">
                <PlusCircle className="mr-1.5 h-3.5 w-3.5" />
                Add Customer
              </Link>
            </Button>
          </div>
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
                              href={`/dashboard/customers/${customer.id}/history`}
                              className="font-bold text-sm text-primary hover:underline flex items-center gap-1.5"
                            >
                              {customer.name}
                            </Link>
                            <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">
                              📞 {customer.mobile}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button variant="outline" size="sm" className="h-7 px-2 text-xs" asChild>
                              <Link href={`/dashboard/customers/${customer.id}/edit`}>
                                <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                              </Link>
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => openDeleteDialog(customer)}>
                              <Trash2 className="h-3.5 w-3.5" />
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
                      No results found.
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
                      <TableHead>Last Recharge</TableHead>
                      <TableHead>Actions</TableHead>
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
                          <TableCell>{formatDate(customer.lastRechargeDate)}</TableCell>
                          <TableCell className="flex gap-1">
                              <Button variant="ghost" size="icon" asChild>
                                  <Link href={`/dashboard/customers/${customer.id}/edit`}>
                                      <Pencil className="h-4 w-4" />
                                  </Link>
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => openDeleteDialog(customer)}>
                                  <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                          </TableCell>
                          </TableRow>
                      ))
                      ) : (
                      <TableRow>
                          <TableCell
                          colSpan={7}
                          className="h-24 text-center"
                          >
                          No results found.
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

    <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the customer 
            <span className="font-bold"> {customerToDelete?.name}</span>'s data.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDeleteCustomer} className="bg-destructive hover:bg-destructive/90">
            Delete Customer
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
