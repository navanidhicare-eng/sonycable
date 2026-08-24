"use client";

import { useState, useEffect, Suspense } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useRouter, useSearchParams } from "next/navigation";
import { PlusCircle, Search, User, Loader2, ArrowLeft, Send, CheckCircle2, Phone, Clock, CalendarIcon } from "lucide-react";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, addDoc, doc, getDoc, Timestamp } from "firebase/firestore";
import Link from "next/link";
import { sendAutoSms } from "@/lib/autoSms";
import { format } from "date-fns";

interface Customer {
  id: string;
  name: string;
  stbId: string;
  mobile: string;
  customerId: string;
  area: string;
  adminId?: string;
  balanceAmount?: number;
}

interface Staff {
  adminId: string;
}

const COMPLAINT_CATEGORIES = [
  { value: "Signal Problem", label: "📶 Signal Problem (సిగ్నల్ రావట్లేదు)" },
  { value: "Channel / Package Issue", label: "📺 Channel / Package Issue (ఛానెల్స్ రావట్లేదు)" },
  { value: "Wire Cut / Cable Line Issue", label: "🔌 Wire Cut / Line Issue (కేబుల్ వైర్ తెగిపోయింది)" },
  { value: "Set-Top Box Problem", label: "📺 Set-Top Box Problem (బాక్స్ ప్రాబ్లమ్)" },
  { value: "Billing / Recharge Query", label: "💰 Billing / Recharge Query (రీఛార్జ్ / బిల్‌తో సమస్య)" },
  { value: "Other Complaint", label: "🛠️ Other Complaint (ఇతర సమస్య)" },
];

const formSchema = z.object({
  category: z.string({ required_error: "Please select a complaint category." }),
  notes: z.string().optional(),
  promisedDate: z.string().min(1, "Please select expected resolution date."),
  promisedTime: z.string().min(1, "Please select expected resolution time."),
});

type FormValues = z.infer<typeof formSchema>;

function RegisterComplaintContent() {
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramId = searchParams?.get("id") || searchParams?.get("customerId") || "";

  const [searchTerm, setSearchTerm] = useState("");
  const [foundCustomer, setFoundCustomer] = useState<Customer | null>(null);
  const [searchError, setSearchError] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [smsSentStatus, setSmsSentStatus] = useState<string | null>(null);
  const { user, loading: authLoading } = useAuth();
  const [adminId, setAdminId] = useState<string | null>(null);

  // Set default promised date to today (YYYY-MM-DD) and promised time to 05:00 PM
  const todayStr = new Date().toISOString().split("T")[0];
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      category: "Signal Problem",
      notes: "",
      promisedDate: todayStr,
      promisedTime: "17:00",
    },
  });

  // Auto-fetch customer if ID is passed in query string (?id=...)
  useEffect(() => {
    if (!paramId || !user) return;
    const fetchDirectCustomer = async () => {
      setIsSearching(true);
      try {
        const custRef = doc(db, "customers", paramId);
        const custSnap = await getDoc(custRef);
        if (custSnap.exists()) {
          const data = custSnap.data();
          setFoundCustomer({
            id: custSnap.id,
            name: data.name || "",
            stbId: data.stbId || "",
            mobile: data.mobile || "",
            customerId: data.customerId || "",
            area: data.area || "N/A",
            adminId: data.userId || "",
            balanceAmount: data.balanceAmount || 0,
          });
        }
      } catch (err) {
        console.error("Error auto-fetching customer:", err);
      } finally {
        setIsSearching(false);
      }
    };
    fetchDirectCustomer();
  }, [paramId, user]);

  const handleCustomerSearch = async () => {
    if (!user) {
      toast({ variant: "destructive", title: "Not Authenticated" });
      return;
    }
    setSearchError("");
    setFoundCustomer(null);
    if (!searchTerm.trim()) {
      setSearchError("Please enter Customer ID, STB ID, Mobile, or Name.");
      return;
    }
    setIsSearching(true);

    try {
      let currentAdminId = adminId;
      if (!currentAdminId) {
        const staffQuery = query(collection(db, "staff"), where("uid", "==", user.uid));
        const staffSnapshot = await getDocs(staffQuery);
        if (!staffSnapshot.empty) {
          const staffData = staffSnapshot.docs[0].data() as Staff;
          currentAdminId = staffData.adminId;
          setAdminId(currentAdminId);
        } else {
          // Admin logged in fallback
          currentAdminId = user.uid;
          setAdminId(currentAdminId);
        }
      }

      const searchTermLower = searchTerm.toLowerCase();
      const customerQuery = query(
        collection(db, "customers"),
        where("userId", "==", currentAdminId)
      );

      const querySnapshot = await getDocs(customerQuery);
      const allCustomers = querySnapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      } as Customer));

      const term = searchTerm.trim().toLowerCase();

      // Priority 1: Exact match on Customer ID or Firestore Doc ID
      let customer = allCustomers.find(c => 
        (c.customerId && String(c.customerId).trim().toLowerCase() === term) ||
        (c.id && c.id.toLowerCase() === term)
      );

      // Priority 2: Exact match on STB ID
      if (!customer) {
        customer = allCustomers.find(c => c.stbId && String(c.stbId).trim().toLowerCase() === term);
      }

      // Priority 3: Exact match on Mobile number
      if (!customer) {
        customer = allCustomers.find(c => c.mobile && c.mobile.trim() === term);
      }

      // Priority 4: Partial match on Customer ID or STB ID
      if (!customer) {
        customer = allCustomers.find(c => 
          (c.customerId && String(c.customerId).toLowerCase().includes(term)) ||
          (c.stbId && String(c.stbId).toLowerCase().includes(term))
        );
      }

      // Priority 5: Partial match on Customer Name
      if (!customer) {
        customer = allCustomers.find(c => c.name && c.name.toLowerCase().includes(term));
      }

      // Priority 6: Mobile number contains search term (last resort fallback)
      if (!customer) {
        customer = allCustomers.find(c => c.mobile && c.mobile.includes(term));
      }

      if (customer) {
        setFoundCustomer(customer);
        setSearchError("");
      } else {
        setSearchError("Customer not found. Please check Customer ID or Mobile number.");
      }
    } catch (error) {
      setSearchError("An error occurred while searching for the customer.");
      console.error("Customer search error:", error);
    } finally {
      setIsSearching(false);
    }
  };

  const applyPresetTime = (hoursFromNow: number) => {
    const targetDate = new Date();
    targetDate.setHours(targetDate.getHours() + hoursFromNow);
    
    const yyyy = targetDate.getFullYear();
    const mm = String(targetDate.getMonth() + 1).padStart(2, "0");
    const dd = String(targetDate.getDate()).padStart(2, "0");
    const formattedDate = `${yyyy}-${mm}-${dd}`;

    const hh = String(targetDate.getHours()).padStart(2, "0");
    const mins = String(targetDate.getMinutes()).padStart(2, "0");
    const formattedTime = `${hh}:${mins}`;

    form.setValue("promisedDate", formattedDate);
    form.setValue("promisedTime", formattedTime);
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
    setSmsSentStatus(null);

    try {
      let targetAdminId = adminId || foundCustomer.adminId || user.uid;
      if (!targetAdminId) {
        const staffQuery = query(collection(db, "staff"), where("uid", "==", user.uid));
        const staffSnapshot = await getDocs(staffQuery);
        if (!staffSnapshot.empty) {
          targetAdminId = staffSnapshot.docs[0].data().adminId;
        }
      }

      // Format promised date and time for clean display
      let formattedPromisedDateTime = `${data.promisedDate} ${data.promisedTime}`;
      try {
        const dateTimeObj = new Date(`${data.promisedDate}T${data.promisedTime}`);
        if (!isNaN(dateTimeObj.getTime())) {
          formattedPromisedDateTime = format(dateTimeObj, "dd MMM yyyy, hh:mm a");
        }
      } catch (e) {
        console.warn("Date formatting error:", e);
      }

      const fullComplaintText = data.notes
        ? `${data.category} - ${data.notes}`
        : data.category;

      const complaintDoc = await addDoc(collection(db, "complaints"), {
        customerId: foundCustomer.id,
        customerName: foundCustomer.name,
        stbId: foundCustomer.stbId || "N/A",
        mobile: foundCustomer.mobile,
        area: foundCustomer.area || "N/A",
        complaint: fullComplaintText,
        complaintCategory: data.category,
        notes: data.notes || "",
        promisedDate: data.promisedDate,
        promisedTime: data.promisedTime,
        promisedFormatted: formattedPromisedDateTime,
        status: "Pending",
        createdAt: Timestamp.now(),
        userId: targetAdminId,
        registeredBy: user.displayName || user.email || "Staff",
      });

      // Construct automated Telugu SMS Text
      const smsMessage = `ప్రియమైన ${foundCustomer.name} గారు,
మీ ఫిర్యాదు (${data.category}${data.notes ? ` - ${data.notes}` : ""}) నమోదు చేయబడింది.
పరిష్కరించే సమయం: ${formattedPromisedDateTime}.

మా టెక్నీషియన్ వీలైనంత త్వరగా వచ్చి మీ ప్రాబ్లమ్ క్లియర్ చేస్తారు. మీకు జరిగిన అసౌకర్యానికి చింతిస్తున్నాము.

హెల్ప్‌లైన్: 9010737882
- Sony Cable Network`;

      // Trigger automatic background SMS
      let isSmsSent = false;
      if (foundCustomer.mobile) {
        isSmsSent = await sendAutoSms({
          phoneNumber: foundCustomer.mobile,
          message: smsMessage,
        });
      }

      toast({
        title: "Complaint Registered Successfully 🛑",
        description: `Complaint for ${foundCustomer.name} logged. Expected by ${formattedPromisedDateTime}.`,
      });

      // WhatsApp fallback URL
      const whatsappUrl = `https://wa.me/91${foundCustomer.mobile}?text=${encodeURIComponent(smsMessage)}`;

      // Redirect or show WhatsApp share option
      setTimeout(() => {
        if (typeof window !== "undefined") {
          window.open(whatsappUrl, "_blank");
        }
        router.push("/dashboard/complaints-staff");
      }, 1500);

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
      <div className="container mx-auto flex flex-col items-center p-3 sm:p-4 py-6 md:p-12 max-w-2xl">
        <div className="w-full mb-4">
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/complaints-staff" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Complaints List</span>
            </Link>
          </Button>
        </div>

        <Card className="w-full shadow-lg border border-amber-500/20">
          <CardHeader className="p-4 sm:p-6 pb-2">
            <CardTitle className="text-xl sm:text-2xl font-black flex items-center gap-2">
              <span>🚨</span> Register New Complaint
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Enter Customer ID or Mobile, select issue details and expected completion date & time.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 space-y-6">
            
            {/* 🔍 STEP 1: CUSTOMER SEARCH / SELECTION */}
            <div className="space-y-2.5 bg-slate-50 dark:bg-slate-900/50 p-3.5 rounded-xl border border-dashed border-amber-500/30">
              <Label className="text-xs font-black uppercase text-amber-600 dark:text-amber-400">
                1. Customer ID / Mobile Search
              </Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter Customer ID, STB ID or Mobile"
                  className="h-10 text-xs sm:text-sm bg-background"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleCustomerSearch(); }}
                />
                <Button 
                  type="button" 
                  onClick={handleCustomerSearch} 
                  disabled={isSearching}
                  className="h-10 px-4 bg-amber-600 hover:bg-amber-700 text-white font-bold"
                >
                  {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4 mr-1" />}
                  Search
                </Button>
              </div>

              {searchError && (
                <p className="text-xs font-bold text-destructive bg-destructive/10 p-2 rounded-md">
                  ⚠️ {searchError}
                </p>
              )}

              {foundCustomer && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/40 gap-2 mt-2">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 shrink-0">
                      <User className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-extrabold text-sm text-foreground flex items-center gap-2">
                        {foundCustomer.name}
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded-md font-bold">
                          ID: {foundCustomer.customerId || foundCustomer.id}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground font-medium">
                        📞 {foundCustomer.mobile} | 📺 STB: {foundCustomer.stbId || "N/A"} | 📍 {foundCustomer.area}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
                      <a href={`tel:${foundCustomer.mobile}`}>
                        <Phone className="h-3.5 w-3.5 mr-1" /> Call
                      </a>
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* 📝 STEP 2: COMPLAINT DETAILS & TIMELINE FORM */}
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                
                {/* Complaint Dropdown */}
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-bold uppercase tracking-wider text-foreground">
                        2. Complaint Category (సమస్య రకం) *
                      </FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-10 text-xs sm:text-sm font-semibold">
                            <SelectValue placeholder="Select complaint type..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {COMPLAINT_CATEGORIES.map((cat) => (
                            <SelectItem key={cat.value} value={cat.value} className="text-xs sm:text-sm font-medium">
                              {cat.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Complaint Description Textbox */}
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-bold uppercase tracking-wider text-foreground">
                        3. Extra Complaint Description / Notes (వివరాలు)
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Type customer's issue details spoken on phone call..."
                          className="resize-none text-xs sm:text-sm min-h-[90px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Promised Completion Date & Time Picker */}
                <div className="bg-amber-500/10 p-3.5 rounded-xl border border-amber-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-black uppercase text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                      <Clock className="h-4 w-4" /> 4. Promised Completion Date & Time (పరిష్కరించే తేదీ & సమయం) *
                    </Label>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="promisedDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[10px] font-bold text-muted-foreground uppercase">Target Date</FormLabel>
                          <FormControl>
                            <Input type="date" className="h-9 text-xs font-semibold bg-background" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="promisedTime"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[10px] font-bold text-muted-foreground uppercase">Target Time</FormLabel>
                          <FormControl>
                            <Input type="time" className="h-9 text-xs font-semibold bg-background" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Quick Preset Buttons */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <span className="text-[10px] text-muted-foreground font-bold self-center mr-1">Quick Select:</span>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm" 
                      className="h-6 text-[10px] px-2 bg-background hover:bg-amber-500/20"
                      onClick={() => applyPresetTime(3)}
                    >
                      In 3 Hours
                    </Button>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm" 
                      className="h-6 text-[10px] px-2 bg-background hover:bg-amber-500/20"
                      onClick={() => applyPresetTime(6)}
                    >
                      In 6 Hours
                    </Button>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm" 
                      className="h-6 text-[10px] px-2 bg-background hover:bg-amber-500/20"
                      onClick={() => applyPresetTime(24)}
                    >
                      Tomorrow
                    </Button>
                  </div>
                </div>

                {/* Submit Button */}
                <Button 
                  type="submit" 
                  className="w-full h-11 text-sm font-black bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white shadow-md transition-all" 
                  disabled={!foundCustomer || isSubmitting || authLoading}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Registering & Sending SMS...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Register Complaint & Send Automatic SMS
                    </>
                  )}
                </Button>

                {!foundCustomer && (
                  <p className="text-[11px] text-center text-amber-600 font-bold">
                    ⚠️ Please search and select a customer first to enable complaint registration.
                  </p>
                )}
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

export default function StaffAddComplaintPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <RegisterComplaintContent />
    </Suspense>
  );
}
