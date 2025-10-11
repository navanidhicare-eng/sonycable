
"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { Search, User, Loader2, Send } from "lucide-react";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, addDoc } from "firebase/firestore";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";


interface Customer {
  id: string;
  name: string;
  stbId: string;
  mobile: string;
  customerId: string;
  userId: string; // Admin's UID
}

interface Staff {
    adminId: string;
}

interface Package {
  id: string;
  packageName: string;
  packageAmount: string;
}

const formSchema = z.object({
  selectedPackage: z.string().min(1, "Please select a package."),
  rechargeMonths: z.number().min(1).max(12),
});

type FormValues = z.infer<typeof formSchema>;

export default function StaffRequestRechargePage() {
  const { toast } = useToast();
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [foundCustomer, setFoundCustomer] = useState<Customer | null>(null);
  const [searchError, setSearchError] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user, loading: authLoading } = useAuth();
  const [adminId, setAdminId] = useState<string | null>(null);
  const [packages, setPackages] = useState<Package[]>([]);


  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      rechargeMonths: 1,
    }
  });

  const handleCustomerSearch = async () => {
    if (!user) {
        toast({ variant: "destructive", title: "Not Authenticated" });
        return;
    }
    setSearchError("");
    setFoundCustomer(null);
    form.reset();
    if (!searchTerm.trim()) {
      setSearchError("Please enter a search term.");
      return;
    }
    setIsSearching(true);
    
    try {
        let currentAdminId = adminId;
        if (!currentAdminId) {
            const staffQuery = query(collection(db, "staff"), where("uid", "==", user.uid));
            const staffSnapshot = await getDocs(staffQuery);
            if (staffSnapshot.empty) {
                setSearchError("Could not verify your staff account.");
                setIsSearching(false);
                return;
            }
            const staffData = staffSnapshot.docs[0].data() as Staff;
            currentAdminId = staffData.adminId;
            setAdminId(currentAdminId);
        }
        
        const searchTermLower = searchTerm.toLowerCase();
        const customerQuery = query(
            collection(db, "customers"),
            where("userId", "==", currentAdminId)
        );
        
        const querySnapshot = await getDocs(customerQuery);
        const allCustomers = querySnapshot.docs.map(doc => ({id: doc.id, ...doc.data()} as Customer));
        
        const customer = allCustomers.find(
             (c) =>
                c.name.toLowerCase().includes(searchTermLower) ||
                c.mobile.includes(searchTerm) ||
                c.stbId.toLowerCase().includes(searchTermLower) ||
                c.customerId.toLowerCase().includes(searchTermLower)
        );

        if (customer) {
            setFoundCustomer(customer);
            // Fetch packages for the found customer's admin
            const packagesQuery = query(collection(db, "packages"), where("userId", "==", customer.userId));
            const packagesSnapshot = await getDocs(packagesQuery);
            const packagesData = packagesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Package));
            setPackages(packagesData);

        } else {
            setSearchError("Customer not found. Please check the details and try again.");
            setPackages([]);
        }
    } catch(error) {
         setSearchError("An error occurred while searching for the customer.");
         console.error("Customer search error:", error);
         setPackages([]);
    } finally {
        setIsSearching(false);
    }
  };

  async function onSubmit(data: FormValues) {
    if (!foundCustomer || !user) {
      toast({
        variant: "destructive",
        title: "No Customer Selected",
        description: "Please search for and select a customer before sending a request.",
      });
      return;
    }
    const selectedPkg = packages.find(p => p.id === data.selectedPackage);
    if (!selectedPkg) {
        toast({ variant: 'destructive', title: 'Package not found' });
        return;
    }
    
    setIsSubmitting(true);
    try {
        const requestsQuery = query(
            collection(db, 'rechargeRequests'),
            where('customerId', '==', foundCustomer.id),
            where('status', '==', 'Pending')
        );
        const existingRequests = await getDocs(requestsQuery);

        if (!existingRequests.empty) {
            toast({
            variant: "destructive",
            title: "Request Already Pending",
            description: "This customer already has a pending recharge request. Please wait for the admin to approve it.",
            });
            setIsSubmitting(false);
            return;
        }

        const totalAmount = parseFloat(selectedPkg.packageAmount) * data.rechargeMonths;

      await addDoc(collection(db, "rechargeRequests"), {
        customerId: foundCustomer.id,
        customerName: foundCustomer.name,
        adminId: foundCustomer.userId,
        packageName: selectedPkg.packageName,
        packageAmount: totalAmount,
        months: data.rechargeMonths,
        requestDate: new Date(),
        status: 'Pending',
        type: 'Staff',
      });

      toast({
        title: "Recharge Request Sent",
        description: `Request for ${foundCustomer.name} has been successfully sent to the admin.`,
      });
      setFoundCustomer(null);
      setSearchTerm("");
      form.reset({ rechargeMonths: 1 });

    } catch (error) {
       console.error("Error sending request:", error);
       toast({
        variant: "destructive",
        title: "Failed to Send Request",
        description: "An error occurred while sending the recharge request.",
      });
    } finally {
        setIsSubmitting(false);
    }
  }
  
  const selectedPackageId = form.watch("selectedPackage");
  const rechargeMonths = form.watch("rechargeMonths");
  const selectedPackageDetails = selectedPackageId ? packages.find(p => p.id === selectedPackageId) : null;
  const totalAmount = selectedPackageDetails ? parseFloat(selectedPackageDetails.packageAmount) * rechargeMonths : 0;

  return (
    <main className="min-h-screen w-full font-body text-foreground">
      <div className="container mx-auto flex flex-col items-center p-4 py-8 md:p-12">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle className="text-2xl">Request Customer Recharge</CardTitle>
            <CardDescription>
              Search for a customer, select a package, and send a recharge request to the admin.
            </CardDescription>
          </CardHeader>
          <CardContent>
                <div className="space-y-4 mb-6">
                    <Label>Find Customer</Label>
                    <div className="flex gap-2">
                        <Input
                            placeholder="Search by Name, Mobile, STB or Customer ID"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        <Button type="button" onClick={handleCustomerSearch} disabled={isSearching || authLoading}>
                            {isSearching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                            Search
                        </Button>
                    </div>
                    {searchError && <p className="text-sm font-medium text-destructive">{searchError}</p>}
                    {foundCustomer && (
                        <div className="flex items-center rounded-md border border-dashed p-3">
                            <User className="mr-3 h-6 w-6 text-muted-foreground" />
                            <div>
                                <p className="font-semibold">{foundCustomer.name}</p>
                                <p className="text-sm text-muted-foreground">STB ID: {foundCustomer.stbId} | Mobile: {foundCustomer.mobile}</p>
                            </div>
                        </div>
                    )}
                </div>

                {foundCustomer && (
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 mt-6 border-t pt-6">
                       <FormField
                        control={form.control}
                        name="selectedPackage"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Select Package</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                <SelectTrigger>
                                    <SelectValue placeholder="Choose a package to request" />
                                </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                {packages.map(pkg => (
                                    <SelectItem key={pkg.id} value={pkg.id}>
                                    {pkg.packageName} - ₹{pkg.packageAmount}
                                    </SelectItem>
                                ))}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                        
                        <FormField
                            control={form.control}
                            name="rechargeMonths"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Number of Months</FormLabel>
                                <Select onValueChange={(val) => field.onChange(Number(val))} value={String(field.value)}>
                                    <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select number of months" />
                                    </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                    {[...Array(12)].map((_, i) => (
                                        <SelectItem key={i + 1} value={String(i + 1)}>
                                        {i + 1} Month(s)
                                        </SelectItem>
                                    ))}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                                </FormItem>
                            )}
                        />

                        {selectedPackageDetails && (
                            <div className="text-center text-sm text-muted-foreground p-3 bg-muted rounded-md">
                                You are requesting <span className="font-bold text-foreground">{selectedPackageDetails.packageName}</span> for <span className="font-bold text-foreground">{rechargeMonths} month(s)</span>.
                                <br/>
                                Total Amount: <span className="font-bold text-foreground text-base">₹{totalAmount.toLocaleString()}</span>
                            </div>
                        )}
                        
                        <Button type="submit" className="w-full" disabled={!foundCustomer || isSubmitting || authLoading || !selectedPackageId}>
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                            {isSubmitting ? "Sending Request..." : "Send Request to Admin"}
                        </Button>
                    </form>
                </Form>
                )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
