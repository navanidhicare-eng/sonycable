
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
import { Search, Phone, HandCoins, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { collection, onSnapshot, query, where, doc, updateDoc, addDoc, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

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

export default function PaymentsCollectionsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterArea, setFilterArea] = useState("all");
  const [isCollectDialogOpen, setIsCollectDialogOpen] = useState(false);
  const [currentCustomer, setCurrentCustomer] = useState<Collection | null>(null);
  const [amountCollected, setAmountCollected] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const { toast } = useToast();
  
  const [allCustomers, setAllCustomers] = useState<Collection[]>([]);
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
    
    let customerUnsubscribe: (() => void) | undefined;
    
    const fetchStaffAndCustomers = async () => {
      setLoading(true);
      try {
        const staffQuery = query(collection(db, "staff"), where("uid", "==", user.uid));
        const staffSnapshot = await getDocs(staffQuery);

        if (!staffSnapshot.empty) {
          const staffData = staffSnapshot.docs[0].data() as Staff;
          const fetchedAdminId = staffData.adminId;
          const fetchedAreas = staffData.area;

          setAdminId(fetchedAdminId);
          setStaffAssignedAreas(fetchedAreas);
          const areaOpts = fetchedAreas.map(a => ({ value: a, label: a }));
          setAreaOptions([{ value: "all", label: "All Areas" }, ...areaOpts]);

          if (fetchedAdminId) {
            const collectionsQuery = query(
              collection(db, "customers"),
              where("userId", "==", fetchedAdminId)
            );

            customerUnsubscribe = onSnapshot(collectionsQuery, (snapshot) => {
              const collectionsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Collection));
              setAllCustomers(collectionsData);
              setLoading(false);
            }, (error) => {
              console.error("Error fetching collections:", error);
              toast({ variant: "destructive", title: "Failed to fetch collections" });
              setLoading(false);
            });
          } else {
             setLoading(false);
          }
        } else {
             console.log("No staff document found for UID:", user.uid);
             setLoading(false);
        }
      } catch (error) {
        console.error("Error fetching staff details:", error);
        toast({ variant: "destructive", title: "Failed to load staff data" });
        setLoading(false);
      }
    };

    fetchStaffAndCustomers();

    return () => {
      if (customerUnsubscribe) {
        customerUnsubscribe();
      }
    };
  }, [user, authLoading, toast]);


  const filteredCollections = useMemo(() => {
    // 1. Filter customers with a positive balance, converting amount to number for safety.
    let customersWithBalance = allCustomers.filter(c => parseFloat(String(c.balanceAmount)) > 0);

    // 2. Filter by staff's assigned areas.
    let customersInAssignedAreas = customersWithBalance;
    if (staffAssignedAreas.length > 0) {
        customersInAssignedAreas = customersWithBalance.filter(c => staffAssignedAreas.includes(c.area));
    }
    
    // 3. Filter by search term and selected area dropdown.
    return customersInAssignedAreas.filter((collection) => {
      const searchTermLower = searchTerm.toLowerCase();
      const matchesSearch =
        collection.name.toLowerCase().includes(searchTermLower) ||
        collection.mobile.includes(searchTerm) ||
        (collection.stbId && collection.stbId.toLowerCase().includes(searchTermLower));

      const matchesArea =
        filterArea === "all" || collection.area === filterArea;

      return matchesSearch && matchesArea;
    });
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
            collectedBy: user?.uid,
            collectionDate: new Date(),
            adminId: adminId,
        });

        toast({
            title: "Collection Recorded",
            description: `Collected ₹${amountCollected} from ${currentCustomer.name} via ${paymentMethod}.`,
        });

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
    return filteredCollections.reduce((sum, customer) => sum + (parseFloat(String(customer.balanceAmount)) || 0), 0);
  }, [filteredCollections]);

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
                <div className="flex justify-between items-center mb-4">
                    <CardTitle>Outstanding Balances</CardTitle>
                    <div className="text-right">
                        <p className="text-sm text-muted-foreground">Total Due</p>
                        <p className="text-2xl font-bold">₹{totalDue.toLocaleString()}</p>
                    </div>
                </div>
              <div className="mt-4 flex flex-col gap-4 sm:flex-row">
                <div className="relative w-full sm:max-w-xs">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Search by name, mobile, STB..."
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
                        <TableHead>Mobile</TableHead>
                        <TableHead>Area</TableHead>
                        <TableHead>Amount Due (₹)</TableHead>
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
                            <TableCell>{collection.mobile}</TableCell>
                            <TableCell>{collection.area}</TableCell>
                            <TableCell>
                              <Badge variant="destructive">
                                ₹{collection.balanceAmount}
                              </Badge>
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
                          <TableCell colSpan={5} className="h-24 text-center">
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
                        {filteredCollections.map((collection) => (
                            <AccordionItem value={collection.id} key={collection.id}>
                                <AccordionTrigger>
                                    <div className="flex justify-between w-full pr-4">
                                        <span className="font-medium">{collection.name}</span>
                                        <Badge variant="destructive">
                                            ₹{collection.balanceAmount}
                                        </Badge>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent>
                                    <div className="space-y-4 px-1 pt-2">
                                        <div className="text-sm text-muted-foreground">
                                            <p><span className="font-semibold text-foreground">Customer ID:</span> {collection.customerId}</p>
                                            <p><span className="font-semibold text-foreground">STB ID:</span> {collection.stbId}</p>
                                            <p><span className="font-semibold text-foreground">Mobile:</span> {collection.mobile}</p>
                                            <p><span className="font-semibold text-foreground">Area:</span> {collection.area}</p>
                                        </div>
                                        <div className="flex gap-2 pt-2">
                                            <Button
                                                variant="outline"
                                                className="flex-1"
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
                                        </div>
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        ))}
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
    </>
  );
}

    