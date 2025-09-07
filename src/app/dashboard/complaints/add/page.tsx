
"use client";

import { useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { PlusCircle, Search, User, Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, addDoc } from "firebase/firestore";

interface Customer {
  id: string;
  name: string;
  stbId: string;
  mobile: string;
  customerId: string;
  adminId: string;
}

const formSchema = z.object({
  complaintDetails: z.string().min(10, "Please provide at least 10 characters for the complaint."),
});

type FormValues = z.infer<typeof formSchema>;

export default function AddComplaintPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [foundCustomer, setFoundCustomer] = useState<Customer | null>(null);
  const [searchError, setSearchError] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user, loading: authLoading } = useAuth();


  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
  });

  const handleCustomerSearch = async () => {
    if (!user) {
        toast({ variant: "destructive", title: "Not Authenticated" });
        return;
    }
    setSearchError("");
    setFoundCustomer(null);
    if (!searchTerm.trim()) {
      setSearchError("Please enter a search term.");
      return;
    }
    setIsSearching(true);
    
    const searchTermLower = searchTerm.toLowerCase();
    const customerQuery = query(
      collection(db, "customers"),
      where("userId", "==", user.uid)
    );

    try {
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
        } else {
            setSearchError("Customer not found. Please check the details and try again.");
        }
    } catch(error) {
         setSearchError("An error occurred while searching for the customer.");
         console.error("Customer search error:", error);
    } finally {
        setIsSearching(false);
    }
  };

  async function onSubmit(data: FormValues) {
    if (!foundCustomer || !user) {
      toast({
        variant: "destructive",
        title: "No Customer Selected",
        description: "Please search for and select a customer before registering a complaint.",
      });
      return;
    }
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "complaints"), {
        customerId: foundCustomer.id,
        customerName: foundCustomer.name,
        stbId: foundCustomer.stbId,
        complaint: data.complaintDetails,
        status: "Pending",
        createdAt: new Date(),
        userId: user.uid,
      });

      toast({
        title: "Complaint Registered",
        description: `Complaint for ${foundCustomer.name} has been successfully registered.`,
      });
      router.push("/dashboard/complaints");

    } catch (error) {
       console.error("Error registering complaint:", error);
       toast({
        variant: "destructive",
        title: "Failed to Register",
        description: "An error occurred while registering the complaint.",
      });
    } finally {
        setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen w-full font-body text-foreground">
      <div className="container mx-auto flex flex-col items-center p-4 py-8 md:p-12">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle className="text-2xl">Register New Complaint</CardTitle>
            <CardDescription>
              Search for the customer and describe the issue below.
            </CardDescription>
          </CardHeader>
          <CardContent>
             <Form {...form}>
                <div className="space-y-4 mb-6">
                    <Label>Find Customer</Label>
                    <div className="flex gap-2">
                        <Input
                            placeholder="Search by Name, Mobile, STB or Customer ID"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        <Button type="button" onClick={handleCustomerSearch} disabled={isSearching}>
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

                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <FormField
                    control={form.control}
                    name="complaintDetails"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Complaint Details</FormLabel>
                        <FormControl>
                            <Textarea
                            placeholder="Describe the customer's complaint in detail..."
                            className="resize-none"
                            rows={4}
                            {...field}
                            />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    <Button type="submit" className="w-full" disabled={!foundCustomer || isSubmitting || authLoading}>
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                        {isSubmitting ? "Registering..." : "Register Complaint"}
                    </Button>
                </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
