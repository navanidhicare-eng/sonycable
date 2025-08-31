
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
import { PlusCircle, Search, User } from "lucide-react";

// In a real app, you might fetch this list from your customers data
const mockCustomers = [
  { id: "cust1", name: "Suresh Kumar", stbId: "STB12345", mobile: "9876543210", customerId: "CUST9876" },
  { id: "cust2", name: "Rajesh Sharma", stbId: "STB67890", mobile: "9988776655", customerId: "CUST5432" },
  { id: "cust3", name: "Anitha Reddy", stbId: "STB54321", mobile: "9123456789", customerId: "CUST1234" },
  { id: "cust4", name: "Vijay Varma", stbId: "STB11223", mobile: "9000011111", customerId: "CUST4321" },
];

const formSchema = z.object({
  complaintDetails: z.string().min(10, "Please provide at least 10 characters for the complaint."),
});

type FormValues = z.infer<typeof formSchema>;

export default function AddComplaintPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [foundCustomer, setFoundCustomer] = useState(null);
  const [searchError, setSearchError] = useState("");

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
  });

  const handleCustomerSearch = () => {
    setSearchError("");
    setFoundCustomer(null);
    if (!searchTerm.trim()) {
      setSearchError("Please enter a search term.");
      return;
    }
    const searchTermLower = searchTerm.toLowerCase();
    const customer = mockCustomers.find(
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
  };

  function onSubmit(data: FormValues) {
    if (!foundCustomer) {
      toast({
        variant: "destructive",
        title: "No Customer Selected",
        description: "Please search for and select a customer before registering a complaint.",
      });
      return;
    }

    console.log({ customerId: foundCustomer.id, ...data });
    toast({
      title: "Complaint Registered",
      description: `Complaint for ${foundCustomer.name} has been successfully registered.`,
    });
    router.push("/dashboard/complaints");
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
            <div className="space-y-4 mb-6">
                <FormLabel>Find Customer</FormLabel>
                <div className="flex gap-2">
                    <Input
                        placeholder="Search by Name, Mobile, STB or Customer ID"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <Button type="button" onClick={handleCustomerSearch}>
                        <Search className="mr-2 h-4 w-4" />
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

            <Form {...form}>
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
                <Button type="submit" className="w-full" disabled={!foundCustomer}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Register Complaint
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
