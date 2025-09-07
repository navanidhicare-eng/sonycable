
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
import { PlusCircle, Search, Loader2, Upload } from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, where, Timestamp, writeBatch, doc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import Papa from "papaparse";

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

  return (
    <>
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
          <div className="flex gap-2 mt-4 sm:mt-0">
             <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Upload className="mr-2 h-4 w-4" />
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
            <Button asChild>
              <Link href="/dashboard/customers/add">
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Customer
              </Link>
            </Button>
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
                    <TableHead>Last Recharge</TableHead>
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
                        </TableRow>
                    ))
                    ) : (
                    <TableRow>
                        <TableCell
                        colSpan={6}
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
    </>
  );
}

    