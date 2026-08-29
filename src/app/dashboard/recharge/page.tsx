
"use client";

import React, { useState, useMemo, useEffect, Suspense } from "react";
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
import { collection, query, where, onSnapshot, doc, updateDoc, addDoc, Timestamp } from "firebase/firestore";
import { useSearchParams } from "next/navigation";
import PaymentSuccessReceiptModal, { RechargeReceiptData } from "@/components/PaymentSuccessReceiptModal";

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
  packageAmount: string;         // 1 Month price
  threeMonthAmount?: string;     // 3 Month price (admin configured)
  sixMonthAmount?: string;       // 6 Month price
  twelveMonthAmount?: string;    // 12 Month price
  description?: string;
  type?: string;
}

interface Area {
  value: string;
  label: string;
}

interface RechargeOffer {
  id: string;
  months: number;
  discountPercentage: number;
}

function RechargePageContent() {
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [rechargeOffers, setRechargeOffers] = useState<RechargeOffer[]>([]);
  const [areas, setAreas] = useState<Area[]>([{ value: "all", label: "All Areas" }]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterArea, setFilterArea] = useState("all");
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentCustomer, setCurrentCustomer] = useState<Customer | null>(null);
  const [rechargeMonths, setRechargeMonths] = useState(1);
  const [receiptModalData, setReceiptModalData] = useState<RechargeReceiptData | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  
  useEffect(() => {
    const customerNameFromUrl = searchParams.get('customerName');
    if (customerNameFromUrl) {
      setSearchTerm(decodeURIComponent(customerNameFromUrl));
    }
  }, [searchParams]);


  useEffect(() => {
    if (authLoading || !user) {
        if(!authLoading) setLoading(false);
        return;
    }

    setLoading(true);

    const customersQuery = query(collection(db, "customers"), where("userId", "==", user.uid));
    const customersUnsubscribe = onSnapshot(customersQuery, (snapshot) => {
        const customersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
        setCustomers(customersData);
        setLoading(false);
    }, (error) => {
        console.error("Error fetching customers:", error);
        toast({ variant: "destructive", title: "Failed to fetch customers" });
        setLoading(false);
    });

    const packagesQuery = query(collection(db, "packages"), where("userId", "==", user.uid));
    const packagesUnsubscribe = onSnapshot(packagesQuery, (snapshot) => {
        const packagesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Package));
        setPackages(packagesData);
    }, (error) => {
        console.error("Error fetching packages:", error);
        toast({ variant: "destructive", title: "Failed to fetch packages" });
    });

    const rechargeOffersQuery = query(collection(db, "rechargeOffers"), where("userId", "==", user.uid));
    const offersUnsubscribe = onSnapshot(rechargeOffersQuery, (snapshot) => {
        const offersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RechargeOffer));
        setRechargeOffers(offersData);
    }, (error) => {
        console.error("Error fetching recharge offers:", error);
        toast({ variant: "destructive", title: "Failed to fetch offers" });
    });

    const areasQuery = query(collection(db, "areas"), where("userId", "==", user.uid));
    const areasUnsubscribe = onSnapshot(areasQuery, (snapshot) => {
        const areasData = snapshot.docs.map(doc => ({ value: doc.data().name, label: doc.data().name }));
        setAreas([{ value: "all", label: "All Areas" }, ...areasData]);
    }, (error) => {
        console.error("Error fetching areas:", error);
        toast({ variant: "destructive", title: "Failed to fetch areas" });
    });
    
    return () => {
        customersUnsubscribe();
        packagesUnsubscribe();
        areasUnsubscribe();
        offersUnsubscribe();
    }

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

  const handleRecharge = async () => {
    if (!selectedPackage || !currentCustomer || !user) return;
    
    const pkg = packages.find(p => p.id === selectedPackage);
    if (!pkg) {
      toast({ variant: "destructive", title: "Package not found" });
      return;
    }

    const baseAmount = parseFloat(pkg.packageAmount);
    const offer = rechargeOffers.find(o => o.months === rechargeMonths);
    const discount = offer ? (baseAmount * rechargeMonths * offer.discountPercentage) / 100 : 0;
    const totalRechargeAmount = baseAmount * rechargeMonths - discount;

    let description;
    const customerDocRef = doc(db, "customers", currentCustomer.id);

    try {
        const newRechargeDate = new Date();
        const newExpiryDate = new Date(newRechargeDate);
        newExpiryDate.setDate(newExpiryDate.getDate() + 30 * rechargeMonths);
        
        let updateData: any = {
            expiryDate: Timestamp.fromDate(newExpiryDate),
            lastRechargeDate: Timestamp.fromDate(newRechargeDate),
        };

        // Payment is always treated as received
        description = `${currentCustomer.name} recharged with ${pkg.packageName} for ${rechargeMonths} month(s) (₹${totalRechargeAmount}). Payment received.`;

        if (discount > 0) {
            description += ` (Discount of ₹${discount.toLocaleString()} applied).`;
        }

        await updateDoc(customerDocRef, updateData);

        await addDoc(collection(db, "recharges"), {
            customerId: currentCustomer.id,
            customerName: currentCustomer.name,
            packageId: pkg.id,
            packageName: pkg.packageName,
            amount: totalRechargeAmount,
            months: rechargeMonths,
            paymentReceived: true,
            rechargeDate: newRechargeDate,
            rechargedBy: user.uid,
            adminId: user.uid,
        });
      
        const oldDue = parseFloat(String(currentCustomer.balanceAmount || 0));
        const newDue = oldDue;

        toast({
            title: "Recharge Successful",
            description: description,
        });

        setIsDialogOpen(false);

        // Open Instant WhatsApp & SMS Recharge Receipt Modal
        setReceiptModalData({
          businessName: "Sony Cable",
          customerName: currentCustomer.name,
          customerId: currentCustomer.customerId || currentCustomer.stbId || currentCustomer.id,
          customerDocId: currentCustomer.id,
          mobile: currentCustomer.mobile || '',
          oldDue: oldDue,
          rechargeAmount: totalRechargeAmount,
          newDue: newDue,
          date: newRechargeDate,
          packageName: pkg.packageName,
          months: rechargeMonths,
          collectedByName: user.displayName || (user.email ? user.email.split('@')[0] : 'Staff'),
        });
        setIsReceiptModalOpen(true);

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
    setSelectedPackage(null);
    setRechargeMonths(1);
    setIsDialogOpen(true);
  };

  // Reset months when package changes
  const handlePackageChange = (pkgId: string) => {
    setSelectedPackage(pkgId);
    setRechargeMonths(1);
  };
  
  const selectedPackageDetails = selectedPackage ? packages.find(p => p.id === selectedPackage) : null;

  // ── Build admin-configured duration options for selected package ────────────
  const durationOptions: { months: number; label: string; price: number }[] = selectedPackageDetails
    ? [
        { months: 1,  label: "1 Month",   price: parseFloat(selectedPackageDetails.packageAmount || "0") || 0 },
        ...(selectedPackageDetails.threeMonthAmount  ? [{ months: 3,  label: "3 Months",  price: parseFloat(selectedPackageDetails.threeMonthAmount)  }] : []),
        ...(selectedPackageDetails.sixMonthAmount    ? [{ months: 6,  label: "6 Months",  price: parseFloat(selectedPackageDetails.sixMonthAmount)    }] : []),
        ...(selectedPackageDetails.twelveMonthAmount ? [{ months: 12, label: "12 Months", price: parseFloat(selectedPackageDetails.twelveMonthAmount) }] : []),
      ].filter(o => o.price > 0)
    : [];

  // Price is read directly from admin config — no custom injection possible
  const selectedDurationOption = durationOptions.find(o => o.months === rechargeMonths);
  const totalRechargeAmount = selectedDurationOption?.price ?? 0;
  const offer = rechargeOffers.find(o => o.months === rechargeMonths);
  const baseAmount = selectedPackageDetails ? parseFloat(selectedPackageDetails.packageAmount) : 0;
  const discount = offer ? (baseAmount * rechargeMonths * offer.discountPercentage) / 100 : 0;

  const newBalance = currentCustomer?.balanceAmount;


  return (
    <>
      <div className="container mx-auto flex flex-col items-center p-4 py-8 md:p-12">
        <header className="mb-10 flex w-full max-w-4xl flex-col items-center text-center sm:flex-row sm:justify-between sm:text-left">
          <div>
            <h1 className="text-4xl font-bold tracking-tighter md:text-5xl">
              Recharge
            </h1>
            <p className="mt-4 max-w-3xl text-lg text-muted-foreground md:text-xl">
              Find customers by area and recharge their accounts.
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
                <DialogDescription>Select a package to continue with the recharge.</DialogDescription>
                <div className="text-sm">
                    Current Balance: <span className="font-bold text-lg">₹{currentCustomer.balanceAmount}</span>
                </div>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="package" className="text-right">
                    Package
                  </Label>
                  <Select onValueChange={handlePackageChange}>
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
                 <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="months" className="text-right">Duration</Label>
                  <Select
                    value={String(rechargeMonths)}
                    onValueChange={val => setRechargeMonths(Number(val))}
                    disabled={!selectedPackageDetails || durationOptions.length === 0}
                  >
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder={selectedPackageDetails ? "Select duration" : "Select a package first"} />
                    </SelectTrigger>
                    <SelectContent>
                      {durationOptions.map(opt => (
                        <SelectItem key={opt.months} value={String(opt.months)}>
                          {opt.label} — ₹{opt.price.toLocaleString()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedPackageDetails && (
                    <div className="space-y-2 rounded-md bg-muted p-3 text-sm">
                        {offer && (
                            <>
                            <div className="flex justify-between text-muted-foreground">
                                <span>Original Amount:</span>
                                <span>₹{(baseAmount * rechargeMonths).toLocaleString()}</span>
                            </div>
                             <div className="flex justify-between font-semibold text-destructive">
                                <span>Discount ({offer.discountPercentage}%):</span>
                                <span>- ₹{discount.toLocaleString()}</span>
                            </div>
                            </>
                        )}
                        <div className="flex justify-between">
                            <span>Recharge Amount:</span>
                            <span className="font-bold text-base">₹{totalRechargeAmount.toLocaleString()}</span>
                        </div>
                    </div>
                )}
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  onClick={handleRecharge}
                  disabled={!selectedPackage || !selectedDurationOption}
                  className="bg-orange-500 hover:bg-orange-600 text-white"
                >
                  Confirm Recharge
                </Button>
              </DialogFooter>
            </DialogContent>
        </Dialog>
      )}

      {/* Instant WhatsApp & SMS Recharge Receipt Modal */}
      <PaymentSuccessReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        rechargeData={receiptModalData}
        type="recharge"
      />
    </>
  );
}

export default function RechargePage() {
  return (
    <main className="min-h-screen w-full font-body text-foreground">
      <Suspense fallback={<div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
        <RechargePageContent />
      </Suspense>
    </main>
  );
}
