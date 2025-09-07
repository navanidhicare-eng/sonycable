
"use client";

import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Search, CreditCard, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, doc, updateDoc, addDoc, Timestamp, getDocs } from "firebase/firestore";

interface Customer {
  id: string;
  name: string;
  mobile: string;
  area: string;
  stbId: string;
  customerId: string;
  balanceAmount: number;
}

interface Package {
  id: string;
  packageName: string;
  packageAmount: string;
  description: string;
}

interface Area {
  value: string;
  label: string;
}

interface Staff {
    area: string[];
    adminId: string;
}


export default function StaffRechargePage() {
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [areas, setAreas] = useState<Area[]>([{ value: "all", label: "All Areas" }]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterArea, setFilterArea] = useState("all");
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const [paymentReceived, setPaymentReceived] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentCustomer, setCurrentCustomer] = useState<Customer | null>(null);
  const [adminId, setAdminId] = useState<string | null>(null);
  const [staffAssignedAreas, setStaffAssignedAreas] = useState<string[]>([]);

  useEffect(() => {
    if (authLoading || !user) {
        if(!authLoading) setLoading(false);
        return;
    }

    setLoading(true);
    let customerUnsubscribe: (() => void) | undefined;
    let packagesUnsubscribe: (() => void) | undefined;
    
    const fetchStaffAndData = async () => {
        try {
            const staffQuery = query(collection(db, "staff"), where("uid", "==", user.uid));
            const staffSnapshot = await getDocs(staffQuery);

            if (staffSnapshot.empty) {
                toast({ variant: "destructive", title: "Staff account not found" });
                setLoading(false);
                return;
            }

            const staffData = staffSnapshot.docs[0].data() as Staff;
            const fetchedAdminId = staffData.adminId;
            const fetchedAreas = staffData.area;

            setAdminId(fetchedAdminId);
            setStaffAssignedAreas(fetchedAreas);
            const areaOpts = fetchedAreas.map(a => ({ value: a, label: a }));
            setAreas([{ value: "all", label: "All Areas" }, ...areaOpts]);

            if (fetchedAdminId) {
                const customersQuery = query(collection(db, "customers"), where("userId", "==", fetchedAdminId));
                customerUnsubscribe = onSnapshot(customersQuery, (snapshot) => {
                    const customersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
                    setCustomers(customersData);
                    setLoading(false);
                }, (error) => {
                    console.error("Error fetching customers:", error);
                    toast({ variant: "destructive", title: "Failed to fetch customers" });
                    setLoading(false);
                });

                const packagesQuery = query(collection(db, "packages"), where("userId", "==", fetchedAdminId));
                packagesUnsubscribe = onSnapshot(packagesQuery, (snapshot) => {
                    const packagesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Package));
                    setPackages(packagesData);
                }, (error) => {
                    console.error("Error fetching packages:", error);
                    toast({ variant: "destructive", title: "Failed to fetch packages" });
                });

            } else {
                setLoading(false);
            }

        } catch (error) {
            console.error("Error fetching staff data:", error);
            toast({ variant: "destructive", title: "Failed to load required data" });
            setLoading(false);
        }
    };

    fetchStaffAndData();
    
    return () => {
        if(customerUnsubscribe) customerUnsubscribe();
        if(packagesUnsubscribe) packagesUnsubscribe();
    }

  }, [user, authLoading, toast]);


  const filteredCustomers = useMemo(() => {
    let customersInAssignedAreas = customers;
    if (staffAssignedAreas.length > 0) {
        customersInAssignedAreas = customers.filter(c => staffAssignedAreas.includes(c.area));
    }
      
    return customersInAssignedAreas.filter((customer) => {
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
  }, [searchTerm, filterArea, customers, staffAssignedAreas]);

  const handleRecharge = async () => {
    if (!selectedPackage || !currentCustomer || !user || !adminId) return;
    
    const pkg = packages.find(p => p.id === selectedPackage);
    if (!pkg) {
      toast({ variant: "destructive", title: "Package not found" });
      return;
    }

    const rechargeAmount = parseFloat(pkg.packageAmount);
    let description;
    const customerDocRef = doc(db, "customers", currentCustomer.id);

    try {
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 30);
        const expiryTimestamp = Timestamp.fromDate(expiryDate);

        if (paymentReceived) {
            await updateDoc(customerDocRef, {
                expiryDate: expiryTimestamp
            });
            description = `${currentCustomer.name} has been recharged with ${pkg.packageName} for ₹${rechargeAmount}. Payment received.`;
        } else {
            const newBalance = currentCustomer.balanceAmount + rechargeAmount;
            await updateDoc(customerDocRef, {
                balanceAmount: newBalance,
                expiryDate: expiryTimestamp,
            });
            description = `${currentCustomer.name} has been recharged with ${pkg.packageName}. ₹${rechargeAmount} added to collection balance.`;
        }

        await addDoc(collection(db, "recharges"), {
            customerId: currentCustomer.id,
            customerName: currentCustomer.name,
            packageId: pkg.id,
            packageName: pkg.packageName,
            amount: rechargeAmount,
            paymentReceived: paymentReceived,
            rechargeDate: new Date(),
            rechargedBy: user.uid, // staff uid
            adminId: adminId, // admin uid
        });
      
        toast({
            title: "Recharge Successful",
            description: description,
        });

        setIsDialogOpen(false);
        setSelectedPackage(null);
        setPaymentReceived(true);
        setCurrentCustomer(null);

    } catch (error) {
        console.error("Recharge failed:", error);
         toast({
            variant: "destructive",
            title: "Recharge Failed",
            description: "An error occurred while processing the recharge.",
        });
    }
  };

  const openDialog = (customer: Customer) => {
    setCurrentCustomer(customer);
    setIsDialogOpen(true);
  };

  return (
    <main className="min-h-screen w-full font-body text-foreground">
      <div className="container mx-auto flex flex-col items-center p-4 py-8 md:p-12">
        <header className="mb-10 flex w-full max-w-4xl flex-col items-center text-center sm:flex-row sm:justify-between sm:text-left">
          <div>
            <h1 className="text-4xl font-bold tracking-tighter md:text-5xl">
              Recharge
            </h1>
            <p className="mt-4 max-w-3xl text-lg text-muted-foreground md:text-xl">
              Find customers in your assigned areas and recharge their accounts.
            </p>
          </div>
        </header>
        <Card className="w-full max-w-4xl">
          <CardHeader>
            <CardTitle>Customer Recharge</CardTitle>
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
                  {areas.map((option) => (
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
                    <TableHead>STB ID</TableHead>
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
                        <TableCell>{customer.stbId}</TableCell>
                        <TableCell>
                            <Button variant="outline" size="sm" onClick={() => openDialog(customer)}>
                            <CreditCard className="mr-2 h-4 w-4" />
                            Recharge
                            </Button>
                        </TableCell>
                        </TableRow>
                    ))
                    ) : (
                    <TableRow>
                        <TableCell colSpan={4} className="h-24 text-center">
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

      {currentCustomer && (
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Recharge for {currentCustomer.name}</DialogTitle>
                <DialogDescription>
                  Select a package to continue with the recharge.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="package" className="text-right">
                    Package
                  </Label>
                  <Select onValueChange={setSelectedPackage}>
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Select a package" />
                    </SelectTrigger>
                    <SelectContent>
                      {packages.map((pkg) => (
                        <SelectItem key={pkg.id} value={pkg.id}>
                          {pkg.packageName} - ₹{pkg.packageAmount}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center space-x-2 justify-center">
                    <Checkbox 
                      id="payment-received" 
                      checked={paymentReceived} 
                      onCheckedChange={(checked) => setPaymentReceived(Boolean(checked))}
                    />
                    <Label htmlFor="payment-received">Payment Received</Label>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" onClick={handleRecharge}>Confirm Recharge</Button>
              </DialogFooter>
            </DialogContent>
        </Dialog>
      )}
    </main>
  );
}
