
"use client";

import { useState, useMemo, useEffect } from "react";
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Search, Phone, HandCoins, Loader2, History } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { collection, onSnapshot, query, where, doc, updateDoc, addDoc, getDocs, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import Link from "next/link";
import PaymentSuccessReceiptModal, { ReceiptData } from "@/components/PaymentSuccessReceiptModal";

interface Collection {
    id: string;
    name: string;
    mobile: string;
    stbId: string;
    area: string;
    balanceAmount: number | string; // Allow both for safety
    customerId: string;
}

interface Staff {
    area: string[];
    adminId: string;
}

interface Payment {
  id: string;
  customerId: string;
  amount: number;
  collectionDate: Timestamp;
  collectedBy: string; // Staff UID
}

interface StaffMember {
    uid: string;
    name: string;
}


export default function PaymentsCollectionsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterArea, setFilterArea] = useState("all");
  const [isCollectDialogOpen, setIsCollectDialogOpen] = useState(false);
  const [currentCustomer, setCurrentCustomer] = useState<Collection | null>(null);
  const [amountCollected, setAmountCollected] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [receiptModalData, setReceiptModalData] = useState<ReceiptData | null>(null);
  const { toast } = useToast();
  
  const [allCustomers, setAllCustomers] = useState<Collection[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, userRole, loading: authLoading } = useAuth();
  const [adminId, setAdminId] = useState<string | null>(null);
  const [staffAssignedAreas, setStaffAssignedAreas] = useState<string[]>([]);
  const [areaOptions, setAreaOptions] = useState<{ value: string; label: string }[]>([
    { value: "all", label: "All Areas" },
  ]);


  useEffect(() => {
    if (authLoading || !user) {
      if (!authLoading) setLoading(false);
      return;
    }
    
    const fetchStaffAndData = async () => {
        setLoading(true);
        try {
            const staffQuery = query(collection(db, "staff"), where("uid", "==", user.uid));
            const staffSnapshot = await getDocs(staffQuery);

            if (staffSnapshot.empty) {
                console.log("No staff document found for UID:", user.uid);
                setLoading(false);
                return;
            }
            
            const staffData = staffSnapshot.docs[0].data() as Staff;
            const fetchedAdminId = staffData.adminId;
            const fetchedAreas = staffData.area || [];

            setAdminId(fetchedAdminId);
            setStaffAssignedAreas(fetchedAreas);
            
            if (fetchedAdminId) {
                const unsubscribes: (() => void)[] = [];
                
                const areasQuery = query(collection(db, "areas"), where("userId", "==", fetchedAdminId));
                unsubscribes.push(onSnapshot(areasQuery, (snapshot) => {
                    const areasData = snapshot.docs.map(doc => ({ value: doc.data().name, label: doc.data().name }));
                    setAreaOptions([{ value: "all", label: "All Areas" }, ...areasData]);
                }));
                
                const collectionsQuery = query(
                  collection(db, "customers"),
                  where("userId", "==", fetchedAdminId)
                );
                unsubscribes.push(onSnapshot(collectionsQuery, (snapshot) => {
                  const collectionsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Collection));
                  setAllCustomers(collectionsData);
                  if(!loading) setLoading(false);
                }));

                const paymentsQuery = query(collection(db, "payments"), where("adminId", "==", fetchedAdminId));
                unsubscribes.push(onSnapshot(paymentsQuery, (snapshot) => {
                    setPayments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment)))
                }));
                
                const allStaffQuery = query(collection(db, "staff"), where("adminId", "==", fetchedAdminId));
                unsubscribes.push(onSnapshot(allStaffQuery, (snapshot) => {
                    setStaffList(snapshot.docs.map(doc => ({ uid: doc.data().uid, name: doc.data().name })))
                }));

                setLoading(false);
                return () => unsubscribes.forEach(unsub => unsub());
            } else {
                setLoading(false);
            }
        } catch (error) {
            console.error("Error fetching staff details:", error);
            toast({ variant: "destructive", title: "Failed to load staff data" });
            setLoading(false);
        }
    };

    const unsubscribePromise = fetchStaffAndData();

    return () => {
      unsubscribePromise.then(unsub => {
        if(unsub) unsub();
      });
    };
  }, [user, authLoading, toast]);


  const filteredCollections = useMemo(() => {
    let customersWithBalance = allCustomers;
    
    let customersInAssignedAreas = customersWithBalance;
    if (staffAssignedAreas.length > 0) {
        customersInAssignedAreas = customersWithBalance.filter(c => staffAssignedAreas.includes(c.area));
    }
    
    let filtered;
    if (!searchTerm.trim()) {
        filtered = customersInAssignedAreas.filter(c => filterArea === 'all' || c.area === filterArea);
    } else {
        const searchTermLower = searchTerm.toLowerCase();
        const isNumericOrStringId = /^[a-zA-Z0-9]+$/.test(searchTerm);

        if (isNumericOrStringId) {
            const exactMatch = customersInAssignedAreas.find(c => 
                (c.customerId.toLowerCase() === searchTermLower) || (c.stbId.toLowerCase() === searchTermLower)
            );
            if (exactMatch && (filterArea === 'all' || exactMatch.area === filterArea)) {
                return [exactMatch];
            }
        }
        
        filtered = customersInAssignedAreas.filter((collection) => {
            const matchesSearch =
                collection.name.toLowerCase().includes(searchTermLower) ||
                collection.mobile.includes(searchTerm) ||
                (collection.stbId && collection.stbId.toLowerCase().includes(searchTermLower)) ||
                (collection.customerId && collection.customerId.toLowerCase().includes(searchTermLower));

            const matchesArea =
                filterArea === "all" || collection.area === filterArea;

            return matchesSearch && matchesArea;
        });
    }

    // Sort the final list by balanceAmount in descending order
    return filtered.sort((a, b) => parseFloat(String(b.balanceAmount)) - parseFloat(String(a.balanceAmount)));

  }, [searchTerm, filterArea, allCustomers, staffAssignedAreas]);

  const openCollectDialog = (customer: Collection) => {
    setCurrentCustomer(customer);
    setAmountCollected(String(customer.balanceAmount));
    setPaymentMethod("cash");
    setIsCollectDialogOpen(true);
  };

  const handleConfirmCollection = async () => {
    if (!amountCollected || !currentCustomer || !user || !adminId) return;
    
    const collectedAmount = parseFloat(amountCollected);
    const currentBalance = parseFloat(String(currentCustomer.balanceAmount));
    const newBalance = currentBalance - collectedAmount;

    try {
        const customerDocRef = doc(db, "customers", currentCustomer.id);
        await updateDoc(customerDocRef, {
            balanceAmount: newBalance
        });

        await addDoc(collection(db, "payments"), {
            customerId: currentCustomer.id,
            customerName: currentCustomer.name,
            amount: collectedAmount,
            method: paymentMethod,
            collectedBy: user.uid,
            collectionDate: new Date(),
            adminId: adminId,
        });

        toast({
            title: "Collection Recorded",
            description: `Collected ₹${amountCollected} from ${currentCustomer.name} via ${paymentMethod}.`,
        });

        // Trigger Instant WhatsApp & SMS Payment Receipt Modal
        setReceiptModalData({
          businessName: "Sony Cable",
          customerName: currentCustomer.name,
          customerId: currentCustomer.customerId || currentCustomer.stbId || currentCustomer.id,
          mobile: currentCustomer.mobile || '',
          paidAmount: collectedAmount,
          remainingBalance: newBalance,
          date: new Date(),
          collectedByName: user.displayName || 'Staff',
        });
        setIsReceiptModalOpen(true);

        setIsCollectDialogOpen(false);
        setCurrentCustomer(null);

    } catch (error) {
        console.error("Error recording collection:", error);
        toast({
            variant: "destructive",
            title: "Collection Failed",
            description: "An error occurred while recording the payment.",
        });
    }
  };
  
    const totalDue = useMemo(() => {
    return filteredCollections.filter(c => parseFloat(String(c.balanceAmount)) > 0).reduce((sum, customer) => sum + (parseFloat(String(customer.balanceAmount)) || 0), 0);
  }, [filteredCollections]);

  const getCustomerPaymentHistory = (customerId: string) => {
    return payments
      .filter(p => p.customerId === customerId)
      .sort((a, b) => b.collectionDate.seconds - a.collectionDate.seconds)
      .slice(0, 2);
  };

  const getStaffName = (staffUid: string) => {
    const staff = staffList.find(s => s.uid === staffUid);
    return staff ? staff.name : 'Unknown Staff';
  };
  
  const BalanceAmount = ({ amount }: { amount: number | string }) => {
    const numericAmount = parseFloat(String(amount));
    const isPositive = numericAmount > 0;
    const isNegative = numericAmount < 0;

    return (
      <span
        className={cn(
          'font-semibold',
          isPositive && 'text-destructive',
          isNegative && 'text-green-600'
        )}
      >
        {isNegative ? `-₹${Math.abs(numericAmount)}` : `₹${numericAmount}`}
      </span>
    );
  };


  return (
    <>
      <main className="min-h-screen w-full font-body text-foreground">
        <div className="container mx-auto flex flex-col items-center p-4 py-8 md:p-12">
          <header className="mb-10 flex w-full max-w-4xl flex-col items-center text-center sm:flex-row sm:justify-between sm:text-left">
            <div>
              <h1 className="text-4xl font-bold tracking-tighter md:text-5xl">
                Payments Collections
              </h1>
              <p className="mt-4 max-w-3xl text-lg text-muted-foreground md:text-xl">
                Manage and track outstanding customer payments in your assigned areas.
              </p>
            </div>
          </header>
          <Card className="w-full max-w-4xl">
            <CardHeader>
                <div className="flex justify-between items-center mb-4 p-4 rounded-lg bg-gradient-to-r from-orange-500 to-red-500 text-white">
                    <CardTitle className="text-white">Outstanding Balances</CardTitle>
                    <div className="text-right">
                        <p className="text-sm text-gray-200">Total Due</p>
                        <p className="text-2xl font-bold">₹{totalDue.toLocaleString()}</p>
                    </div>
                </div>
              <div className="mt-4 flex flex-col gap-4 sm:flex-row">
                <div className="relative w-full sm:max-w-xs">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Search by name, mobile, STB, ID..."
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
                <>
                {/* Desktop View */}
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Customer Name</TableHead>
                        <TableHead>Customer ID</TableHead>
                        <TableHead>Mobile</TableHead>
                        <TableHead>Area</TableHead>
                        <TableHead>Amount Due</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCollections.length > 0 ? (
                        filteredCollections.map((collection) => (
                          <TableRow key={collection.id}>
                            <TableCell className="font-medium">
                              {collection.name}
                            </TableCell>
                            <TableCell>{collection.customerId}</TableCell>
                            <TableCell>{collection.mobile}</TableCell>
                            <TableCell>{collection.area}</TableCell>
                            <TableCell>
                              <BalanceAmount amount={collection.balanceAmount} />
                            </TableCell>
                            <TableCell className="flex gap-2">
                               <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openCollectDialog(collection)}
                              >
                                <HandCoins className="mr-2 h-4 w-4" />
                                Collect
                              </Button>
                               <Button variant="ghost" size="icon" asChild>
                                <a href={`tel:${collection.mobile}`}>
                                  <Phone className="h-4 w-4" />
                                </a>
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={6} className="h-24 text-center">
                            No outstanding collections.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
                {/* Mobile View */}
                 <div className="md:hidden">
                    {filteredCollections.length > 0 ? (
                        <Accordion type="single" collapsible className="w-full">
                        {filteredCollections.map((collection) => {
                            const paymentHistory = getCustomerPaymentHistory(collection.id);
                            return (
                            <AccordionItem value={collection.id} key={collection.id}>
                                <AccordionTrigger>
                                    <div className="flex justify-between w-full pr-4 items-center">
                                        <div>
                                            <span className="font-medium">{collection.name}</span>
                                            <span className="text-xs text-muted-foreground ml-2">(ID: {collection.customerId})</span>
                                        </div>
                                        <BalanceAmount amount={collection.balanceAmount} />
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent>
                                    <div className="space-y-4 px-1 pt-2">
                                        <div className="text-sm text-muted-foreground">
                                            <p><span className="font-semibold text-foreground">STB ID:</span> {collection.stbId}</p>
                                            <p><span className="font-semibold text-foreground">Mobile:</span> {collection.mobile}</p>
                                            <p><span className="font-semibold text-foreground">Area:</span> {collection.area}</p>
                                        </div>
                                        <Separator />
                                         <div>
                                            <h4 className="font-semibold mb-2 text-sm text-foreground">Last Payments</h4>
                                            {paymentHistory.length > 0 ? (
                                                <div className="space-y-2 text-xs">
                                                    {paymentHistory.map(p => (
                                                        <div key={p.id} className="flex justify-between items-center">
                                                            <div>
                                                                <p className="font-medium text-foreground">₹{p.amount.toLocaleString()}</p>
                                                                <p className="text-muted-foreground">{p.collectionDate.toDate().toLocaleString()}</p>
                                                            </div>
                                                            <p className="text-muted-foreground">by {getStaffName(p.collectedBy)}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-xs text-muted-foreground">No payment history found.</p>
                                            )}
                                        </div>
                                        <div className="flex gap-2 pt-2">
                                            <Button
                                                variant="default"
                                                className="flex-1"
                                                onClick={() => openCollectDialog(collection)}
                                            >
                                                <HandCoins className="mr-2 h-4 w-4" />
                                                Collect
                                            </Button>
                                            <Button variant="secondary" size="icon" asChild>
                                                <a href={`tel:${collection.mobile}`}>
                                                <Phone className="h-4 w-4" />
                                                </a>
                                            </Button>
                                            <Button variant="outline" size="sm" asChild>
                                                <Link href={`/dashboard/customers/${collection.id}/history`}>
                                                    <History className="mr-2 h-4 w-4" />
                                                    Full History
                                                </Link>
                                            </Button>
                                        </div>
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        )})}
                        </Accordion>
                    ) : (
                         <div className="text-center py-10 text-muted-foreground">
                            No outstanding collections.
                         </div>
                    )}
                 </div>
                </>
            )}
            </CardContent>
          </Card>
        </div>
      </main>

      {currentCustomer && (
        <Dialog open={isCollectDialogOpen} onOpenChange={setIsCollectDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Collect from {currentCustomer.name}</DialogTitle>
              <DialogDescription>
                Record the payment collected from the customer. Amount due: ₹
                {currentCustomer.balanceAmount}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="amount" className="text-right">
                  Amount (₹)
                </Label>
                <Input
                  id="amount"
                  type="number"
                  value={amountCollected}
                  onChange={(e) => setAmountCollected(e.target.value)}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Method</Label>
                <RadioGroup
                  defaultValue="cash"
                  className="col-span-3 flex items-center gap-4"
                  onValueChange={setPaymentMethod}
                  value={paymentMethod}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="cash" id="r-cash" />
                    <Label htmlFor="r-cash">Cash</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="upi" id="r-upi" />
                    <Label htmlFor="r-upi">UPI</Label>
                  </div>
                </RadioGroup>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" onClick={handleConfirmCollection}>
                Confirm Collection
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Payment Success Instant WhatsApp & SMS Receipt Modal */}
      <PaymentSuccessReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        receiptData={receiptModalData}
      />
    </>
  );
}
