
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
  FormDescription,
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
import { PlusCircle, Loader2, CalendarIcon } from "lucide-react";
import { db, auth } from "@/lib/firebase";
import { collection, addDoc, query, where, onSnapshot, getDocs, Timestamp } from "firebase/firestore";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { createUserWithEmailAndPassword } from "firebase/auth";


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
  connectionReference: z.string().optional(),
  monthlyCommission: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface Customer {
  id: string;
  name: string;
  mobile: string;
  balanceAmount: number;
  area: string;
  stbId: string;
  customerId: string;
  lastRechargeDate?: Timestamp;
  connectionReference?: string;
  monthlyCommission?: string;
  uid?: string;
}
interface Area {
    value: string;
    label: string;
}
interface Staff {
    id: string;
    name: string;
}

export default function AddCustomerPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user, loading: authLoading } = useAuth();
  const [areas, setAreas] = useState<Area[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      customerName: "",
      mobileNumber: "",
      balanceAmount: 0,
      stbId: "",
      customerId: "",
      connectionReference: "",
      monthlyCommission: "",
    },
  });

  const mobileNumberValue = form.watch("mobileNumber");

  useEffect(() => {
    if (mobileNumberValue && mobileNumberValue.length >= 10) {
      const existingCustomer = allCustomers.find(c => c.mobile === mobileNumberValue);
      if (existingCustomer) {
        form.reset({
            mobileNumber: existingCustomer.mobile,
            customerName: existingCustomer.name,
            area: existingCustomer.area,
            stbId: existingCustomer.stbId,
            customerId: existingCustomer.customerId,
            balanceAmount: existingCustomer.balanceAmount || 0,
            lastRechargeDate: existingCustomer.lastRechargeDate ? existingCustomer.lastRechargeDate.toDate() : undefined,
            connectionReference: existingCustomer.connectionReference || "",
            monthlyCommission: existingCustomer.monthlyCommission || "",
        });
        toast({
            title: "Customer Found",
            description: "Existing customer details have been filled in.",
        });
      }
    }
  }, [mobileNumberValue, allCustomers, form, toast]);


  useEffect(() => {
    if (authLoading || !user) return;

    const customersQuery = query(collection(db, "customers"), where("userId", "==", user.uid));
    const unsubscribeCustomers = onSnapshot(customersQuery, (snapshot) => {
        const customersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
        setAllCustomers(customersData);
    });

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

    const staffQuery = query(collection(db, "staff"), where("adminId", "==", user.uid));
    const unsubscribeStaff = onSnapshot(staffQuery, (snapshot) => {
        const staffData = snapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name }));
        setStaff(staffData);
    }, (error) => {
        console.error("Error fetching staff: ", error);
        toast({
            variant: "destructive",
            title: "Failed to fetch staff",
            description: "Could not load staff for selection.",
        });
    });

    return () => {
      unsubscribeCustomers();
      unsubscribeAreas();
      unsubscribeStaff();
    };
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
      // Check if customer ID already exists for this user
      const q = query(
        collection(db, "customers"),
        where("userId", "==", user.uid),
        where("customerId", "==", data.customerId)
      );
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const existingCustomer = querySnapshot.docs[0].data() as Customer;
        if (!existingCustomer.uid) { // If customer exists but has no auth UID, create one.
             // This case is for existing customers without login.
        } else {
            toast({
              variant: "destructive",
              title: "Duplicate Customer ID",
              description: "This Customer ID is already in use. Please choose another one.",
            });
            setIsSubmitting(false);
            return;
        }
      }
      
      let expiryDate = null;
      if (data.lastRechargeDate) {
        expiryDate = new Date(data.lastRechargeDate);
        expiryDate.setDate(expiryDate.getDate() + 30);
      }

      // Create Firebase Auth user for the customer
      const customerEmail = `${data.mobileNumber}@sonycable.local`;
      const customerPassword = "12345678";
      let customerAuthUid;

      try {
        const userCredential = await createUserWithEmailAndPassword(auth, customerEmail, customerPassword);
        customerAuthUid = userCredential.user.uid;
      } catch (authError: any) {
        if (authError.code === 'auth/email-already-in-use') {
            toast({
                variant: "destructive",
                title: "Login Exists",
                description: "A login account with this mobile number already exists.",
            });
            setIsSubmitting(false);
            return;
        }
        throw authError; // Re-throw other auth errors
      }

      await addDoc(collection(db, "customers"), {
        uid: customerAuthUid,
        name: data.customerName,
        mobile: data.mobileNumber,
        balanceAmount: data.balanceAmount || 0,
        area: data.area,
        stbId: data.stbId,
        customerId: data.customerId,
        createdAt: new Date(),
        userId: user.uid,
        lastRechargeDate: data.lastRechargeDate ? Timestamp.fromDate(data.lastRechargeDate) : null,
        expiryDate: expiryDate ? Timestamp.fromDate(expiryDate) : null,
        connectionReference: data.connectionReference || null,
        monthlyCommission: data.monthlyCommission || null,
        passwordChangeRequired: true, // Flag for first login
      });

      toast({
        title: "Customer Added & Login Created",
        description: `${data.customerName} has been successfully added. They can now log in.`,
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
                  name="mobileNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mobile Number</FormLabel>
                      <FormControl>
                        <Input type="tel" placeholder="Enter mobile number to auto-fill" {...field} />
                      </FormControl>
                      <FormDescription>
                        If the customer exists, their details will be auto-filled.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
                  name="balanceAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Opening Balance Amount (₹)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="Enter opening balance" {...field} />
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

                <FormField
                  control={form.control}
                  name="connectionReference"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Connection Reference</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select staff member" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {staff.map(s => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                       <FormDescription>
                        Select the staff member who referred this new connection.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="monthlyCommission"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Monthly Commission (%)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="e.g., 5" {...field} />
                      </FormControl>
                       <FormDescription>
                        Commission percentage for the referring staff member.
                      </FormDescription>
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

    