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
import { useRouter, useParams } from "next/navigation";
import { Save, Loader2, CalendarIcon, ArrowLeft } from "lucide-react";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc, collection, query, where, onSnapshot, Timestamp } from "firebase/firestore";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import Link from "next/link";

const formSchema = z.object({
  customerName: z.string().min(1, "Customer name is required."),
  mobileNumber: z.string().min(10, "Please enter a valid mobile number."),
  balanceAmount: z.preprocess(
    (val) => (val === "" ? "0" : val),
    z.string().transform(v => parseFloat(v)).refine(v => !isNaN(v), "Please enter a valid number.")
  ),
  lastRechargeDate: z.date().optional(),
  area: z.string({ required_error: "Please select an area." }),
  stbId: z.string().min(1, "STB ID is required."),
  customerId: z.string().min(1, "Customer ID is required."),
});

type FormValues = z.infer<typeof formSchema>;

interface Area {
    value: string;
    label: string;
}

export default function EditCustomerClient() {
  const { toast } = useToast();
  const router = useRouter();
  const params = useParams();
  const customerId = params.id as string;
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const { user, userRole, loading: authLoading } = useAuth();
  const [areas, setAreas] = useState<Area[]>([]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
        customerName: "",
        mobileNumber: "",
        balanceAmount: 0,
        area: undefined,
        stbId: "",
        customerId: "",
    },
  });

  useEffect(() => {
    if (!customerId || !user) return;

    const fetchCustomerData = async () => {
        setPageLoading(true);
        try {
            const customerDocRef = doc(db, "customers", customerId);
            const customerDocSnap = await getDoc(customerDocRef);

            if (customerDocSnap.exists()) {
                const customerData = customerDocSnap.data();
                form.reset({
                    customerName: customerData.name,
                    mobileNumber: customerData.mobile,
                    balanceAmount: customerData.balanceAmount || 0,
                    area: customerData.area,
                    stbId: customerData.stbId,
                    customerId: customerData.customerId,
                    lastRechargeDate: customerData.lastRechargeDate ? customerData.lastRechargeDate.toDate() : undefined,
                });
            } else {
                toast({ variant: "destructive", title: "Not Found", description: "Customer not found."});
                router.push("/dashboard/customers");
            }
        } catch (error) {
            console.error("Error fetching customer data: ", error);
            toast({ variant: "destructive", title: "Error", description: "Failed to fetch customer data."});
        } finally {
            setPageLoading(false);
        }
    };
    
    fetchCustomerData();
  }, [customerId, user, form, router, toast]);

  useEffect(() => {
    if (authLoading || !user) return;

    const areasQuery = query(collection(db, "areas"), where("userId", "==", user.uid));
    const unsubscribeAreas = onSnapshot(areasQuery, (snapshot) => {
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

    return () => {
      unsubscribeAreas();
    };
  }, [user, authLoading, toast]);

  async function onSubmit(data: FormValues) {
    setIsSubmitting(true);
    try {
      const customerDocRef = doc(db, "customers", customerId);
      
      let expiryDate = null;
      if (data.lastRechargeDate) {
        expiryDate = new Date(data.lastRechargeDate);
        expiryDate.setDate(expiryDate.getDate() + 30);
      }

      await updateDoc(customerDocRef, {
        name: data.customerName,
        mobile: data.mobileNumber,
        balanceAmount: data.balanceAmount || 0,
        area: data.area,
        stbId: data.stbId,
        customerId: data.customerId,
        lastRechargeDate: data.lastRechargeDate ? Timestamp.fromDate(data.lastRechargeDate) : null,
        expiryDate: expiryDate ? Timestamp.fromDate(expiryDate) : null,
      });

      toast({
        title: "Customer Updated",
        description: `${data.customerName}'s details have been successfully updated.`,
      });
      const targetBackPath = (userRole === "Admin" || userRole === "Network Service Agent")
        ? "/dashboard/customers"
        : (userRole === "Dealer" ? "/dashboard/dishtv-customers" : "/dashboard/customers-staff");
      router.push(targetBackPath);

    } catch (error: any) {
        console.error("Error updating customer: ", error);
        toast({
            variant: "destructive",
            title: "Update Failed",
            description: "An error occurred while updating the customer details.",
        });
    } finally {
        setIsSubmitting(false);
    }
  }

  const isNetworkServiceAgent = userRole === "Network Service Agent";
  const isLoading = authLoading || isSubmitting || pageLoading;
  const targetBackPath = (userRole === "Admin" || userRole === "Network Service Agent")
    ? "/dashboard/customers"
    : (userRole === "Dealer" ? "/dashboard/dishtv-customers" : "/dashboard/customers-staff");

  return (
    <main className="min-h-screen w-full font-body text-foreground">
      <div className="container mx-auto flex flex-col items-center p-4 py-8 md:p-12">
        <div className="w-full max-w-2xl mb-4">
             <Button asChild variant="outline" size="sm">
                <Link href={targetBackPath} className="flex items-center gap-2">
                    <ArrowLeft className="h-4 w-4" />
                    <span>Back to Customer List</span>
                </Link>
            </Button>
        </div>
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle className="text-2xl">Edit Customer</CardTitle>
            <CardDescription>
              Update the details for this customer.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {pageLoading ? (
                <div className="flex justify-center items-center h-40">
                    <Loader2 className="h-8 w-8 animate-spin" />
                </div>
            ) : (
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
                    name="balanceAmount"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Balance Amount (₹)</FormLabel>
                        <FormControl>
                            <Input type="number" placeholder="Enter opening balance" {...field} disabled={isNetworkServiceAgent} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    <FormField
                    control={form.control}
                    name="lastRechargeDate"
                    render={({ field }) => (
                        <FormItem className="flex flex-col">
                        <FormLabel>Last Recharge Date</FormLabel>
                        <Popover>
                            <PopoverTrigger asChild>
                            <FormControl>
                                <Button
                                variant={"outline"}
                                className={cn(
                                    "w-full pl-3 text-left font-normal",
                                    !field.value && "text-muted-foreground"
                                )}
                                >
                                {field.value ? (
                                    format(field.value, "PPP")
                                ) : (
                                    <span>Pick a date</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                            </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                disabled={(date) =>
                                date > new Date() || date < new Date("1900-01-01")
                                }
                                initialFocus
                            />
                            </PopoverContent>
                        </Popover>
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
                        <Select onValueChange={field.onChange} value={field.value}>
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
                        <Save className="mr-2 h-4 w-4" />
                    )}
                    {isSubmitting ? "Updating..." : "Update Customer"}
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
