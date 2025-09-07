
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
import { collection, onSnapshot, query, where, doc, updateDoc, addDoc, getDoc, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface Collection {
    id: string;
    name: string;
    mobile: string;
    stbId: string;
    area: string;
    balanceAmount: number;
    customerId: string;
}

interface Staff {
    area: string[];
    adminId: string;
}

export default function CollectionPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterArea, setFilterArea] = useState("all");
  const [isCollectDialogOpen, setIsCollectDialogOpen] = useState(false);
  const [currentCustomer, setCurrentCustomer] = useState<Collection | null>(null);
  const [amountCollected, setAmountCollected] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const { toast } = useToast();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [areaOptions, setAreaOptions] = useState<{ value: string; label: string }[]>([
    { value: "all", label: "All Areas" },
  ]);
  const { user, userRole, loading: authLoading } = useAuth();

  useEffect(() => {
    if (authLoading || !user) {
        if(!authLoading){
            setLoading(false);
        }
        return;
    }

    const fetchCollections = async () => {
        setLoading(true);
        let collectionsQuery;
        let areasQuery;
        let adminIdForAreas = user.uid;

        if (userRole === 'Staff') {
            const staffDocRef = doc(db, "staff", user.uid);
            const staffDocSnap = await getDoc(staffDocRef);
            if (staffDocSnap.exists()) {
                const staffData = staffDocSnap.data() as Staff;
                const assignedAreas = staffData.area;
                adminIdForAreas = staffData.adminId;
                if (assignedAreas.length > 0) {
                    collectionsQuery = query(
                        collection(db, "customers"),
                        where("userId", "==", staffData.adminId),
                        where("area", "in", assignedAreas)
                    );
                } else {
                    setCollections([]);
                    setLoading(false);
                    return;
                }
            } else {
                 setLoading(false);
                 return;
            }
        } else { // Admin role
            collectionsQuery = query(
                collection(db, "customers"),
                where("userId", "==", user.uid)
            );
        }
        
        areasQuery = query(collection(db, "areas"), where("userId", "==", adminIdForAreas));

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

        const collectionsUnsubscribe = onSnapshot(collectionsQuery, (snapshot) => {
            const collectionsData = snapshot.docs
              .map(doc => ({ id: doc.id, ...doc.data() } as Collection))
              .filter(customer => customer.balanceAmount > 0);
            setCollections(collectionsData);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching collections:", error);
            toast({
                variant: "destructive",
                title: "Failed to fetch collections",
                description: "Could not retrieve outstanding balances.",
            });
            setLoading(false);
        });

        return () => {
            areasUnsubscribe();
            collectionsUnsubscribe();
        }
    };

    fetchCollections();

  }, [user, userRole, authLoading, toast]);


  const filteredCollections = useMemo(() => {
    return collections.filter((collection) => {
      const searchTermLower = searchTerm.toLowerCase();
      const matchesSearch =
        collection.name.toLowerCase().includes(searchTermLower) ||
        collection.mobile.includes(searchTerm) ||
        collection.stbId.toLowerCase().includes(searchTermLower);

      const matchesArea =
        filterArea === "all" || collection.area === filterArea;

      return matchesSearch && matchesArea;
    });
  }, [searchTerm, filterArea, collections]);

  const openCollectDialog = (customer: Collection) => {
    setCurrentCustomer(customer);
    setAmountCollected(customer.balanceAmount.toString());
    setPaymentMethod("cash");
    setIsCollectDialogOpen(true);
  };

  const handleConfirmCollection = async () => {
    if (!amountCollected || !currentCustomer || !user) return;
    
    const collectedAmount = parseFloat(amountCollected);
    const newBalance = currentCustomer.balanceAmount - collectedAmount;

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

  return (
    <>
      <main className="min-h-screen w-full font-body text-foreground">
        <div className="container mx-auto flex flex-col items-center p-4 py-8 md:p-12">
          <header className="mb-10 flex w-full max-w-4xl flex-col items-center text-center sm:flex-row sm:justify-between sm:text-left">
            <div>
              <h1 className="text-4xl font-bold tracking-tighter md:text-5xl">
                Collection
              </h1>
              <p className="mt-4 max-w-3xl text-lg text-muted-foreground md:text-xl">
                Manage and track outstanding customer payments.
              </p>
            </div>
          </header>
          <Card className="w-full max-w-4xl">
            <CardHeader>
              <CardTitle>Outstanding Balances</CardTitle>
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
