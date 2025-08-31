
"use client";

import { useState, useMemo } from "react";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Search, CreditCard } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

const mockCustomers = [
  {
    id: "cust1",
    name: "Suresh Kumar",
    mobile: "9876543210",
    area: "KPHB",
    stbId: "STB12345",
    customerId: "CUST9876",
  },
  {
    id: "cust2",
    name: "Rajesh Sharma",
    mobile: "9988776655",
    area: "Nizampet",
    stbId: "STB67890",
    customerId: "CUST5432",
  },
  {
    id: "cust3",
    name: "Anitha Reddy",
    mobile: "9123456789",
    area: "Pragathi Nagar",
    stbId: "STB54321",
    customerId: "CUST1234",
  },
  {
    id: "cust4",
    name: "Vijay Varma",
    mobile: "9000011111",
    area: "KPHB",
    stbId: "STB11223",
    customerId: "CUST4321",
  },
];

const mockPackages = [
  {
    id: "pkg1",
    name: "SONY BASIC",
    amount: "250",
    description: "Basic channels for family entertainment.",
  },
  {
    id: "pkg2",
    name: "SONY PREMIUM",
    amount: "450",
    description: "Includes all basic channels plus premium sports and movie channels.",
  },
  {
    id: "pkg3",
    name: "SONY HD+ PACK",
    amount: "550",
    description: "All channels in HD quality for the best viewing experience.",
  },
];


const areaOptions = [
  { value: "all", label: "All Areas" },
  { value: "KPHB", label: "KPHB" },
  { value: "Nizampet", label: "Nizampet" },
  { value: "Pragathi Nagar", label: "Pragathi Nagar" },
  { value: "Bachupally", label: "Bachupally" },
];

export default function RechargePage() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterArea, setFilterArea] = useState("all");
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const [paymentReceived, setPaymentReceived] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentCustomer, setCurrentCustomer] = useState<any>(null);

  const filteredCustomers = useMemo(() => {
    return mockCustomers.filter((customer) => {
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
  }, [searchTerm, filterArea]);

  const handleRecharge = () => {
    if (selectedPackage && currentCustomer) {
      const pkg = mockPackages.find(p => p.id === selectedPackage);
      let description;
      if (paymentReceived) {
        description = `${currentCustomer.name} has been recharged with ${pkg?.name} for ₹${pkg?.amount}. Payment received.`;
      } else {
        description = `${currentCustomer.name} has been recharged with ${pkg?.name}. ₹${pkg?.amount} added to collection balance.`;
      }
      
      toast({
        title: "Recharge Successful",
        description: description,
      });

      setIsDialogOpen(false);
      setSelectedPackage(null);
      setPaymentReceived(true);
      setCurrentCustomer(null);
    } else {
       toast({
        variant: "destructive",
        title: "Recharge Failed",
        description: "Please select a package before confirming.",
      });
    }
  };

  const openDialog = (customer: any) => {
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
                      {mockPackages.map((pkg) => (
                        <SelectItem key={pkg.id} value={pkg.id}>
                          {pkg.name} - ₹{pkg.amount}
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

