"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
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
import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { AP_LOCATIONS } from "@/lib/apLocations";

// ── Schema ─────────────────────────────────────────────────────────────────────
const formSchema = z.object({
  customerType: z.enum(["CABLE", "DTH"], { required_error: "Please select a customer type." }),
  customerName: z.string().min(1, "Customer name is required."),
  mobileNumber: z.string().min(10, "Please enter a valid mobile number."),
  balanceAmount: z.preprocess(
    (val) => (val === "" ? "0" : val),
    z.string().transform(v => parseFloat(v)).refine(v => !isNaN(v), "Please enter a valid number.")
  ),
  lastRechargeDate: z.date().optional(),
  district: z.string({ required_error: "Please select a district." }).min(1, "Please select a district."),
  mandal: z.string({ required_error: "Please select a mandal." }).min(1, "Please select a mandal."),
  village: z.string().optional(),
  stbId: z.string().min(1, "STB VC Number is required."),
  stbSerialNumber: z.string().optional(),
  customerId: z.string().min(1, "Customer ID is required."),
  gtplId: z.string().optional(),
  connectionReference: z.string().optional(),
  monthlyCommission: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

// ── Interfaces ─────────────────────────────────────────────────────────────────
interface Customer {
  id: string;
  name: string;
  mobile: string;
  balanceAmount: number;
  area?: string;
  district?: string;
  mandal?: string;
  village?: string;
  stbId: string;
  stbSerialNumber?: string;
  customerId: string;
  gtplId?: string;
  customerType?: "CABLE" | "DTH";
  lastRechargeDate?: Timestamp;
  connectionReference?: string;
  monthlyCommission?: string;
  uid?: string;
}
interface Staff { id: string; name: string; }

// ── Component ──────────────────────────────────────────────────────────────────
export default function AddCustomerPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user, loading: authLoading } = useAuth();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      customerType: "CABLE",
      customerName: "",
      mobileNumber: "",
      balanceAmount: 0,
      district: "",
      mandal: "",
      village: "",
      stbId: "",
      stbSerialNumber: "",
      customerId: "",
      gtplId: "",
      connectionReference: "",
      monthlyCommission: "",
    },
  });

  const mobileNumberValue = form.watch("mobileNumber");
  const selectedDistrict = form.watch("district");
  const selectedMandal = form.watch("mandal");

  // Cascading dropdown data
  const districtList = useMemo(() => AP_LOCATIONS.map(d => d.district), []);
  const mandalList = useMemo(() => {
    if (!selectedDistrict) return [];
    return AP_LOCATIONS.find(d => d.district === selectedDistrict)?.mandals.map(m => m.mandal) ?? [];
  }, [selectedDistrict]);
  const villageList = useMemo(() => {
    if (!selectedDistrict || !selectedMandal) return [];
    const dist = AP_LOCATIONS.find(d => d.district === selectedDistrict);
    return dist?.mandals.find(m => m.mandal === selectedMandal)?.villages ?? [];
  }, [selectedDistrict, selectedMandal]);

  // Reset downstream on change
  useEffect(() => { form.setValue("mandal", ""); form.setValue("village", ""); }, [selectedDistrict, form]);
  useEffect(() => { form.setValue("village", ""); }, [selectedMandal, form]);

  // Mobile autofill
  useEffect(() => {
    if (mobileNumberValue && mobileNumberValue.length >= 10) {
      const existing = allCustomers.find(c => c.mobile === mobileNumberValue);
      if (existing) {
        form.reset({
          customerType: existing.customerType || "CABLE",
          mobileNumber: existing.mobile,
          customerName: existing.name,
          district: existing.district || "",
          mandal: existing.mandal || "",
          village: existing.village || "",
          stbId: existing.stbId,
          stbSerialNumber: existing.stbSerialNumber || "",
          customerId: existing.customerId,
          balanceAmount: existing.balanceAmount || 0,
          lastRechargeDate: existing.lastRechargeDate ? existing.lastRechargeDate.toDate() : undefined,
          connectionReference: existing.connectionReference || "",
          monthlyCommission: existing.monthlyCommission || "",
        });
        toast({ title: "Customer Found", description: "Existing customer details have been filled in." });
      }
    }
  }, [mobileNumberValue, allCustomers, form, toast]);

  // Firestore listeners
  useEffect(() => {
    if (authLoading || !user) return;
    const unsubCustomers = onSnapshot(
      query(collection(db, "customers"), where("userId", "==", user.uid)),
      snap => setAllCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Customer)))
    );
    const unsubStaff = onSnapshot(
      query(collection(db, "staff"), where("adminId", "==", user.uid)),
      snap => setStaff(snap.docs.map(d => ({ id: d.id, name: d.data().name }))),
      err => { console.error(err); toast({ variant: "destructive", title: "Failed to fetch staff" }); }
    );
    return () => { unsubCustomers(); unsubStaff(); };
  }, [user, authLoading, toast]);

  // Submit
  async function onSubmit(data: FormValues) {
    if (!user) {
      toast({ variant: "destructive", title: "Authentication Error", description: "You must be logged in." });
      return;
    }
    setIsSubmitting(true);
    try {
      const dup = await getDocs(query(
        collection(db, "customers"),
        where("userId", "==", user.uid),
        where("customerId", "==", data.customerId)
      ));
      if (!dup.empty && (dup.docs[0].data() as Customer).uid) {
        toast({ variant: "destructive", title: "Duplicate Customer ID", description: "This ID is already in use." });
        setIsSubmitting(false);
        return;
      }

      let expiryDate: Date | null = null;
      if (data.lastRechargeDate) {
        expiryDate = new Date(data.lastRechargeDate);
        expiryDate.setDate(expiryDate.getDate() + 30);
      }

      let customerAuthUid: string | undefined;
      try {
        const cred = await createUserWithEmailAndPassword(auth, `${data.mobileNumber}@sonycable.local`, "12345678");
        customerAuthUid = cred.user.uid;
      } catch (authError: any) {
        if (authError.code === "auth/email-already-in-use") {
          toast({ variant: "destructive", title: "Login Exists", description: "A login with this mobile number already exists." });
          setIsSubmitting(false);
          return;
        }
        throw authError;
      }

      await addDoc(collection(db, "customers"), {
        uid: customerAuthUid,
        customerType: data.customerType,
        name: data.customerName,
        mobile: data.mobileNumber,
        balanceAmount: data.balanceAmount || 0,
        district: data.district,
        mandal: data.mandal,
        village: data.village || null,
        area: [data.village, data.mandal, data.district].filter(Boolean).join(", "),
        stbId: data.stbId,
        stbSerialNumber: data.stbSerialNumber || null,
        customerId: data.customerId,
        gtplId: data.gtplId ? data.gtplId.trim() : null,
        createdAt: Timestamp.fromDate(new Date()),
        userId: user.uid,
        lastRechargeDate: data.lastRechargeDate ? Timestamp.fromDate(data.lastRechargeDate) : null,
        expiryDate: expiryDate ? Timestamp.fromDate(expiryDate) : null,
        connectionReference: data.connectionReference || null,
        monthlyCommission: data.monthlyCommission || null,
        passwordChangeRequired: true,
      });

      toast({ title: "Customer Added & Login Created", description: `${data.customerName} has been successfully added.` });
      router.push("/dashboard/customers");
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Failed to add customer", description: "An error occurred while saving." });
    } finally {
      setIsSubmitting(false);
    }
  }

  const isLoading = authLoading || isSubmitting;

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen w-full font-body text-foreground bg-muted/30">
      <div className="container mx-auto flex flex-col items-center px-4 py-8 md:py-12">
        <div className="w-full max-w-4xl">

          {/* Page Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight">Add New Customer</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Fill in the details below to register a new customer to the system.
            </p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

              {/* ══ Section 1 · General Info ══ */}
              <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
                <div className="border-b bg-muted/40 px-5 py-3">
                  <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    General Info
                  </h2>
                </div>
                <div className="p-5 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Customer Type */}
                    <FormField control={form.control} name="customerType" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Customer Type <span className="text-destructive">*</span></FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger><SelectValue placeholder="Select customer type" /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="CABLE">Cable Customer</SelectItem>
                            <SelectItem value="DTH">DTH Customer</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                    {/* Mobile Number */}
                    <FormField control={form.control} name="mobileNumber" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Mobile Number <span className="text-destructive">*</span></FormLabel>
                        <FormControl>
                          <Input type="tel" placeholder="Enter mobile number to auto-fill" {...field} />
                        </FormControl>
                        <FormDescription className="text-xs">Existing customer details will auto-fill.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Customer Name */}
                    <FormField control={form.control} name="customerName" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Customer Name <span className="text-destructive">*</span></FormLabel>
                        <FormControl><Input placeholder="Enter customer's full name" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    {/* Customer ID */}
                    <FormField control={form.control} name="customerId" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Customer ID Number <span className="text-destructive">*</span></FormLabel>
                        <FormControl><Input placeholder="Enter Customer ID" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                </div>
              </div>

              {/* ══ Section 2 · Location Details ══ */}
              <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
                <div className="border-b bg-muted/40 px-5 py-3">
                  <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Location Details
                  </h2>
                </div>
                <div className="p-5">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* District */}
                    <FormField control={form.control} name="district" render={({ field }) => (
                      <FormItem>
                        <FormLabel>District <span className="text-destructive">*</span></FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger><SelectValue placeholder="Select District" /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {districtList.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                    {/* Mandal */}
                    <FormField control={form.control} name="mandal" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Mandal <span className="text-destructive">*</span></FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} disabled={!selectedDistrict}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={selectedDistrict ? "Select Mandal" : "Select District first"} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {mandalList.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                    {/* Village */}
                    <FormField control={form.control} name="village" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Village / Area</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} disabled={!selectedMandal}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={selectedMandal ? "Select Village / Area" : "Select Mandal first"} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {villageList.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                </div>
              </div>

              {/* ══ Section 3 · STB & Connection Details ══ */}
              <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
                <div className="border-b bg-muted/40 px-5 py-3">
                  <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    STB & Connection Details
                  </h2>
                </div>
                <div className="p-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* STB VC Number */}
                    <FormField control={form.control} name="stbId" render={({ field }) => (
                      <FormItem>
                        <FormLabel>STB VC Number <span className="text-destructive">*</span></FormLabel>
                        <FormControl>
                          <Input placeholder="Enter STB VC Number (e.g., 015...)" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    {/* STB Serial Number */}
                    <FormField control={form.control} name="stbSerialNumber" render={({ field }) => (
                      <FormItem>
                        <FormLabel>STB Serial Number</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter Set-Top Box Serial Number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    {/* GTPL ID */}
                    <FormField control={form.control} name="gtplId" render={({ field }) => (
                      <FormItem className="sm:col-span-2">
                        <FormLabel>GTPL ID <span className="text-xs text-muted-foreground font-normal">(Optional)</span></FormLabel>
                        <FormControl>
                          <Input placeholder="Enter GTPL Subscriber / Account ID (e.g. GTPL12345)" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                </div>
              </div>

              {/* ══ Section 4 · Billing & Commission ══ */}
              <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
                <div className="border-b bg-muted/40 px-5 py-3">
                  <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Billing & Commission
                  </h2>
                </div>
                <div className="p-5 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Opening Balance */}
                    <FormField control={form.control} name="balanceAmount" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Opening Balance (₹)</FormLabel>
                        <FormControl><Input type="number" placeholder="0" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    {/* Last Recharge Date */}
                    <FormField control={form.control} name="lastRechargeDate" render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Last Recharge Date</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                              >
                                {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Connection Reference */}
                    <FormField control={form.control} name="connectionReference" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Connection Reference</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger><SelectValue placeholder="Select referring staff" /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {staff.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <FormDescription className="text-xs">Staff who referred this connection.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )} />
                    {/* Monthly Commission */}
                    <FormField control={form.control} name="monthlyCommission" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Monthly Commission (%)</FormLabel>
                        <FormControl><Input type="number" placeholder="e.g., 5" {...field} /></FormControl>
                        <FormDescription className="text-xs">Commission % for the referring staff.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                </div>
              </div>

              {/* Submit */}
              <div className="flex justify-end pb-4">
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full sm:w-auto min-w-[200px] bg-orange-500 hover:bg-orange-600 text-white font-semibold shadow-md transition-all"
                >
                  {isLoading
                    ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Adding...</>
                    : <><PlusCircle className="mr-2 h-4 w-4" />Add Customer</>
                  }
                </Button>
              </div>

            </form>
          </Form>
        </div>
      </div>
    </main>
  );
}
