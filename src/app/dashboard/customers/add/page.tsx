
"use client";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { PlusCircle, Loader2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, addDoc, query, where, onSnapshot } from "firebase/firestore";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";


const formSchema = z.object({
  customerName: z.string().min(1, "Customer name is required."),
  mobileNumber: z.string().min(10, "Please enter a valid mobile number."),
  area: z.string({ required_error: "Please select an area." }),
  stbId: z.string().min(1, "STB ID is required."),
  customerId: z.string().min(1, "Customer ID is required."),
});

type FormValues = z.infer<typeof formSchema>;

export default function AddCustomerPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user, loading: authLoading } = useAuth();
  const [areas, setAreas] = useState<{ value: string; label: string }[]>([]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      customerName: "",
      mobileNumber: "",
      stbId: "",
      customerId: "",
    },
  });

  useEffect(() => {
    if (authLoading || !user) return;

    const areasQuery = query(collection(db, "areas"), where("userId", "==", user.uid));
    const unsubscribe = onSnapshot(areasQuery, (snapshot) => {
        const areasData = snapshot.docs.map(doc => ({ value: doc.data().name, label: doc.data().name }));
        setAreas(areasData);
    }, (error) => {
        console.error("Error fetching areas: ", error);
        toast({
            variant: "destructive",
            title: "Failed to fetch areas",
            description: "Could not load areas for selection.",
        });
    });

    return () => unsubscribe();
  }, [user, authLoading, toast]);


  async function onSubmit(data: FormValues) {
     if (!user) {
        toast({
            variant: "destructive",
            title: "Authentication Error",
            description: "You must be logged in to add a customer.",
        });
        return;
    }
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "customers"), {
        name: data.customerName,
        mobile: data.mobileNumber,
        area: data.area,
        stbId: data.stbId,
        customerId: data.customerId,
        createdAt: new Date(),
        userId: user.uid,
      });
      toast({
        title: "Customer Added",
        description: `${data.customerName} has been successfully added.`,
      });
      router.push("/dashboard/customers");
    } catch (error) {
      console.error("Error adding customer: ", error);
      toast({
        variant: "destructive",
        title: "Failed to add customer",
        description: "An error occurred while saving the customer data.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }
  
  const isLoading = authLoading || isSubmitting;

  return (
    <main className="min-h-screen w-full font-body text-foreground">
      <div className="container mx-auto flex flex-col items-center p-4 py-8 md:p-12">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle className="text-2xl">Add New Customer</CardTitle>
            <CardDescription>
              Fill in the details below to add a new customer to the system.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="customerName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter customer's full name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="mobileNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mobile Number</FormLabel>
                      <FormControl>
                        <Input type="tel" placeholder="Enter mobile number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="area"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Area</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select an area" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {areas.map(area => (
                            <SelectItem key={area.value} value={area.value}>
                              {area.label}
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
                  name="stbId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>STB ID Number</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter Set-Top Box ID" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="customerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer ID Number</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter Customer ID" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={isLoading}>
                   {isLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <PlusCircle className="mr-2 h-4 w-4" />
                  )}
                  {isSubmitting ? "Adding..." : "Add Customer"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
