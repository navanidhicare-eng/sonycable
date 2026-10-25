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
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import {
  Save,
  Loader2,
  CalendarIcon,
  ArrowLeft,
  User,
  Phone,
  MapPin,
  Tv,
  Hash,
  IndianRupee,
  Layers,
  UserCog,
} from "lucide-react";
import { db } from "@/lib/firebase";
import {
  doc,
  getDoc,
  getDocs,
  updateDoc,
  collection,
  query,
  where,
  onSnapshot,
  Timestamp,
} from "firebase/firestore";
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
    (val) => (val === "" || val === undefined || val === null ? "0" : val),
    z.string().transform((v) => parseFloat(v)).refine((v) => !isNaN(v), "Please enter a valid number.")
  ),
  lastRechargeDate: z.date().optional(),
  area: z.string().optional(),
  stbId: z.string().min(1, "STB ID is required."),
  customerId: z.string().min(1, "Customer ID is required."),
  gtplId: z.string().optional(),
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
  const searchParams = useSearchParams();
  const rawParamId = params?.id as string;
  const customerId = (rawParamId && rawParamId !== "placeholder" ? rawParamId : searchParams?.get("id")) || "";

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [activeCollection, setActiveCollection] = useState<"customers" | "dishtv_customers">("customers");
  const { user, userRole, loading: authLoading } = useAuth();
  const [areas, setAreas] = useState<Area[]>([]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      customerName: "",
      mobileNumber: "",
      balanceAmount: 0,
      area: "",
      stbId: "",
      customerId: "",
      gtplId: "",
    },
  });

  useEffect(() => {
    if (!customerId || customerId === "placeholder" || !user) return;

    const fetchCustomerData = async () => {
      setPageLoading(true);
      try {
        let coll: "customers" | "dishtv_customers" = "customers";
        let customerDocRef = doc(db, coll, customerId);
        let customerDocSnap = await getDoc(customerDocRef);

        if (!customerDocSnap.exists()) {
          coll = "dishtv_customers";
          customerDocRef = doc(db, coll, customerId);
          customerDocSnap = await getDoc(customerDocRef);
        }

        if (customerDocSnap.exists()) {
          setActiveCollection(coll);
          const customerData = customerDocSnap.data();

          if (customerData.area) {
            setAreas((prev) => {
              if (prev.some((a) => a.value === customerData.area)) return prev;
              return [{ value: customerData.area, label: customerData.area }, ...prev];
            });
          }

          form.reset({
            customerName: customerData.name || "",
            mobileNumber: customerData.mobile || "",
            balanceAmount: customerData.balanceAmount || 0,
            area: customerData.area || "",
            stbId: customerData.stbId || customerData.vcNumber || "",
            customerId: customerData.customerId || "",
            gtplId: customerData.gtplId || customerData.gtpl || "",
            lastRechargeDate: customerData.lastRechargeDate
              ? customerData.lastRechargeDate.toDate()
              : undefined,
          });
        } else {
          toast({ variant: "destructive", title: "Not Found", description: "Customer not found." });
          const targetList = userRole === "Admin" ? "/dashboard/customers" : "/dashboard/customers-staff";
          router.push(targetList);
        }
      } catch (error) {
        console.error("Error fetching customer data: ", error);
        toast({ variant: "destructive", title: "Error", description: "Failed to fetch customer data." });
      } finally {
        setPageLoading(false);
      }
    };

    fetchCustomerData();
  }, [customerId, user, userRole, form, router, toast]);

  useEffect(() => {
    if (authLoading || !user) return;

    const fetchAreas = async () => {
      let targetUserId = user.uid;
      if (userRole !== "Admin") {
        try {
          const staffQuery = query(collection(db, "staff"), where("uid", "==", user.uid));
          const staffSnap = await getDocs(staffQuery);
          if (!staffSnap.empty && staffSnap.docs[0].data().adminId) {
            targetUserId = staffSnap.docs[0].data().adminId;
          }
        } catch (e) {
          console.warn("Could not fetch staff adminId for areas:", e);
        }
      }

      const areasQuery = query(collection(db, "areas"), where("userId", "==", targetUserId));
      const unsubscribeAreas = onSnapshot(
        areasQuery,
        (snapshot) => {
          const areasData = snapshot.docs.map((doc) => ({
            value: doc.data().name,
            label: doc.data().name,
          }));
          setAreas((prev) => {
            const combined = [...areasData];
            prev.forEach((p) => {
              if (!combined.some((c) => c.value === p.value)) {
                combined.push(p);
              }
            });
            return combined;
          });
        },
        (error) => {
          console.error("Error fetching areas: ", error);
        }
      );
      return unsubscribeAreas;
    };

    let unsub: (() => void) | undefined;
    fetchAreas().then((u) => {
      unsub = u;
    });
    return () => {
      if (unsub) unsub();
    };
  }, [user, userRole, authLoading, toast]);

  async function onSubmit(data: FormValues) {
    setIsSubmitting(true);
    try {
      const customerDocRef = doc(db, activeCollection, customerId);

      let expiryDate = null;
      if (data.lastRechargeDate) {
        expiryDate = new Date(data.lastRechargeDate);
        expiryDate.setDate(expiryDate.getDate() + 30);
      }

      await updateDoc(customerDocRef, {
        name: data.customerName,
        mobile: data.mobileNumber,
        balanceAmount: data.balanceAmount || 0,
        area: data.area || "",
        stbId: data.stbId,
        customerId: data.customerId,
        gtplId: data.gtplId ? data.gtplId.trim() : "",
        lastRechargeDate: data.lastRechargeDate ? Timestamp.fromDate(data.lastRechargeDate) : null,
        expiryDate: expiryDate ? Timestamp.fromDate(expiryDate) : null,
      });

      toast({
        title: "Customer Updated Successfully",
        description: `${data.customerName}'s details have been updated.`,
      });
      const targetBackPath =
        userRole === "Admin" || userRole === "Network Service Agent"
          ? "/dashboard/customers"
          : userRole === "Dealer"
          ? "/dashboard/dishtv-customers"
          : "/dashboard/customers-staff";
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
  const targetBackPath =
    userRole === "Admin" || userRole === "Network Service Agent"
      ? "/dashboard/customers"
      : userRole === "Dealer"
      ? "/dashboard/dishtv-customers"
      : "/dashboard/customers-staff";

  return (
    <main className="min-h-screen w-full font-body text-foreground pb-12">
      <div className="container mx-auto flex flex-col items-center p-4 py-6 md:p-8">
        <div className="w-full max-w-2xl space-y-4">
          {/* Top Bar with Back Button and Quick Info */}
          <div className="flex items-center justify-between">
            <Button asChild variant="outline" size="sm" className="rounded-xl shadow-xs">
              <Link href={targetBackPath} className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                <span>Back to Customer List</span>
              </Link>
            </Button>
            {form.watch("customerId") && (
              <Badge variant="secondary" className="font-mono text-xs px-2.5 py-1 rounded-lg">
                ID: {form.watch("customerId")}
              </Badge>
            )}
          </div>

          <Card className="border border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl overflow-hidden bg-card">
            <CardHeader className="border-b bg-muted/30 px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
                  <UserCog className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-xl font-bold tracking-tight">Edit Customer</CardTitle>
                  <CardDescription className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                    Update the connection, hardware, and account details for this customer.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-6">
              {pageLoading ? (
                <div className="flex flex-col justify-center items-center h-52 space-y-3">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-xs text-muted-foreground">Loading customer details...</p>
                </div>
              ) : (
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    {/* ── Section 1: Customer Info ── */}
                    <div className="space-y-3.5">
                      <div className="flex items-center gap-2 pb-1.5 border-b border-border/60">
                        <User className="w-4 h-4 text-primary" />
                        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Customer Information
                        </h3>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Customer Name */}
                        <FormField
                          control={form.control}
                          name="customerName"
                          render={({ field }) => (
                            <FormItem className="sm:col-span-2">
                              <FormLabel className="text-xs font-semibold">
                                Customer Name <span className="text-destructive">*</span>
                              </FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/70" />
                                  <Input className="pl-9 h-10 rounded-xl" placeholder="Enter customer's full name" {...field} />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* Mobile Number */}
                        <FormField
                          control={form.control}
                          name="mobileNumber"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs font-semibold">
                                Mobile Number <span className="text-destructive">*</span>
                              </FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/70" />
                                  <Input className="pl-9 h-10 rounded-xl" type="tel" placeholder="10-digit mobile number" {...field} />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* Area */}
                        <FormField
                          control={form.control}
                          name="area"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs font-semibold">Area / Village</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value || ""}>
                                <FormControl>
                                  <SelectTrigger className="h-10 rounded-xl">
                                    <div className="flex items-center gap-2 truncate">
                                      <MapPin className="h-4 w-4 text-muted-foreground/70 shrink-0" />
                                      <SelectValue placeholder="Select an area" />
                                    </div>
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent className="max-h-60">
                                  {areas.map((area) => (
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
                      </div>
                    </div>

                    {/* ── Section 2: Connection & IDs ── */}
                    <div className="space-y-3.5 pt-1">
                      <div className="flex items-center gap-2 pb-1.5 border-b border-border/60">
                        <Tv className="w-4 h-4 text-primary" />
                        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Connection & Hardware IDs
                        </h3>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Customer ID */}
                        <FormField
                          control={form.control}
                          name="customerId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs font-semibold">
                                Customer ID Number <span className="text-destructive">*</span>
                              </FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <Hash className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/70" />
                                  <Input className="pl-9 h-10 rounded-xl font-mono" placeholder="Enter Customer ID" {...field} />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* STB ID */}
                        <FormField
                          control={form.control}
                          name="stbId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs font-semibold">
                                STB / VC Number <span className="text-destructive">*</span>
                              </FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <Tv className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/70" />
                                  <Input className="pl-9 h-10 rounded-xl font-mono" placeholder="Enter Set-Top Box ID" {...field} />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* GTPL ID Column (Added as requested) */}
                        <FormField
                          control={form.control}
                          name="gtplId"
                          render={({ field }) => (
                            <FormItem className="sm:col-span-2">
                              <div className="flex items-center justify-between">
                                <FormLabel className="text-xs font-semibold flex items-center gap-2">
                                  <span>GTPL ID</span>
                                  <span className="text-[10px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400 px-2 py-0.5 rounded-full border border-amber-300 dark:border-amber-800">
                                    GTPL Number
                                  </span>
                                </FormLabel>
                                <span className="text-[11px] text-muted-foreground">Optional</span>
                              </div>
                              <FormControl>
                                <div className="relative">
                                  <Layers className="absolute left-3 top-2.5 h-4 w-4 text-amber-600 dark:text-amber-400" />
                                  <Input
                                    className="pl-9 h-10 rounded-xl font-mono border-amber-200 dark:border-amber-900/60 focus-visible:ring-amber-500"
                                    placeholder="Enter GTPL Subscriber / Account ID (e.g., GTPL12345)"
                                    {...field}
                                  />
                                </div>
                              </FormControl>
                              <FormDescription className="text-[11px] text-muted-foreground">
                                Enter the subscriber's GTPL ID or account number if applicable.
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    {/* ── Section 3: Balance & Recharge ── */}
                    <div className="space-y-3.5 pt-1">
                      <div className="flex items-center gap-2 pb-1.5 border-b border-border/60">
                        <IndianRupee className="w-4 h-4 text-primary" />
                        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Billing & Recharge
                        </h3>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Balance Amount */}
                        <FormField
                          control={form.control}
                          name="balanceAmount"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs font-semibold">Balance Amount (₹)</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <IndianRupee className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/70" />
                                  <Input
                                    type="number"
                                    step="any"
                                    placeholder="0"
                                    className="pl-9 h-10 rounded-xl"
                                    {...field}
                                    disabled={isNetworkServiceAgent}
                                  />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* Last Recharge Date */}
                        <FormField
                          control={form.control}
                          name="lastRechargeDate"
                          render={({ field }) => (
                            <FormItem className="flex flex-col justify-end">
                              <FormLabel className="text-xs font-semibold mb-2">Last Recharge Date</FormLabel>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <FormControl>
                                    <Button
                                      variant={"outline"}
                                      className={cn(
                                        "w-full pl-3 h-10 text-left font-normal rounded-xl",
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
                      </div>
                    </div>

                    {/* ── Form Actions ── */}
                    <div className="pt-4 border-t flex flex-col-reverse sm:flex-row items-center justify-end gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        asChild
                        className="w-full sm:w-auto rounded-xl"
                        disabled={isLoading}
                      >
                        <Link href={targetBackPath}>Cancel</Link>
                      </Button>
                      <Button
                        type="submit"
                        className="w-full sm:w-auto min-w-[170px] rounded-xl shadow-xs"
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="mr-2 h-4 w-4" />
                        )}
                        {isSubmitting ? "Updating..." : "Update Customer"}
                      </Button>
                    </div>
                  </form>
                </Form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
