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
  CardFooter,
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Gift, 
  PlusCircle, 
  Loader2, 
  Trash2, 
  Sparkles, 
  Tv, 
  Search, 
  Copy, 
  CheckCircle2, 
  Zap, 
  Calendar,
  Pencil,
  ArrowRight
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc } from "firebase/firestore";
import Link from "next/link";

const formSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters."),
  months: z.preprocess(
    (a) => parseInt(z.string().parse(a), 10),
    z.number().min(1, "Months must be at least 1.")
  ),
  discountPercentage: z.preprocess(
    (a) => parseFloat(z.string().parse(a)),
    z.number().min(0, "Discount cannot be negative.").max(100, "Discount cannot exceed 100%.")
  ),
  cashbackText: z.string().optional(),
  description: z.string().min(3, "Description is required."),
  promoCode: z.string().min(2, "Promo code is required."),
  badge: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface Offer {
  id: string;
  title: string;
  months: number;
  discountPercentage: number;
  cashbackText?: string;
  description: string;
  promoCode: string;
  badge?: string;
  createdAt?: any;
}

const DEFAULT_OFFERS: Offer[] = [
  {
    id: "def-1",
    title: "DishTV 3-Month Super Saver HD Pack",
    months: 3,
    discountPercentage: 10,
    cashbackText: "₹50 Instant Cashback in Retailer Wallet",
    description: "Recharge for 3 months together and get flat 10% discount on total pack price.",
    promoCode: "DISHTV3M10",
    badge: "POPULAR"
  },
  {
    id: "def-2",
    title: "DishTV 6-Month Festive Dhamaka Pack",
    months: 6,
    discountPercentage: 15,
    cashbackText: "1 Month Extra Free Subscription",
    description: "Pay for 5 months & get 6 months (30 Days Extra FREE validity). Includes all HD channels.",
    promoCode: "DISHTV6M1EXTRA",
    badge: "BEST VALUE"
  },
  {
    id: "def-3",
    title: "DishTV Annual HD Mega Saver (12 Months)",
    months: 12,
    discountPercentage: 25,
    cashbackText: "Free HD Set-Top Box Replacement Warranty",
    description: "Maximum savings! 25% Flat Discount + 2 Months Free subscription + 1 Year Hardware Warranty.",
    promoCode: "DISHTV12M25",
    badge: "MAX DISCOUNT"
  }
];

export default function RechargeOffersPage() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user, userRole, loading: authLoading } = useAuth();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [offerToDelete, setOfferToDelete] = useState<Offer | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMonth, setSelectedMonth] = useState<string>("All");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      months: "" as any,
      discountPercentage: "" as any,
      cashbackText: "",
      description: "",
      promoCode: "",
      badge: "HOT OFFER",
    },
  });

  useEffect(() => {
    setLoading(true);
    const q = collection(db, "rechargeOffers");
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const offersData = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            title: data.title || data.name || "DishTV Special Offer",
            months: Number(data.months) || 3,
            discountPercentage: Number(data.discountPercentage) || 10,
            cashbackText: data.cashbackText || (data.commission ? `Bonus: ${data.commission}` : undefined),
            description: data.description || "DishTV multi-month discount pack.",
            promoCode: data.promoCode || `DISHTV${data.months || 3}M`,
            badge: data.badge || data.status || "ACTIVE OFFER",
            createdAt: data.createdAt
          } as Offer;
        });
        offersData.sort((a, b) => (a.months || 0) - (b.months || 0));
        setOffers(offersData);
      } else {
        setOffers(DEFAULT_OFFERS);
      }
      setLoading(false);
    }, (err) => {
      setOffers(DEFAULT_OFFERS);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  async function onSubmit(data: FormValues) {
    if (!user) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "rechargeOffers"), {
        ...data,
        createdAt: new Date(),
        createdBy: user.uid,
      });
      toast({
        title: "Offer Added by Admin",
        description: `'${data.title}' is now live for all retailers.`,
      });
      form.reset({
        title: "",
        months: "" as any,
        discountPercentage: "" as any,
        cashbackText: "",
        description: "",
        promoCode: "",
        badge: "HOT OFFER",
      });
      setIsAddDialogOpen(false);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error Creating Offer",
        description: "Failed to save offer to database.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleDelete = async () => {
    if (!offerToDelete) return;
    try {
      await deleteDoc(doc(db, "rechargeOffers", offerToDelete.id));
      toast({ title: "Offer Deleted Successfully" });
    } catch (error) {
      toast({ variant: "destructive", title: "Deletion Failed" });
    } finally {
      setIsDeleteDialogOpen(false);
      setOfferToDelete(null);
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast({
      title: "Promo Code Copied!",
      description: `Code '${code}' copied. Apply during customer recharge.`,
    });
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const filteredOffers = offers.filter((offer) => {
    const title = offer.title || "";
    const description = offer.description || "";
    const promoCode = offer.promoCode || "";

    const matchesSearch = title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          promoCode.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesMonth = selectedMonth === "All" || offer.months === Number(selectedMonth);
    return matchesSearch && matchesMonth;
  });

  return (
    <main className="min-h-screen w-full bg-slate-950 text-slate-100 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* Header Banner */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-600 via-orange-600 to-red-600 p-6 md:p-10 shadow-2xl">
          <div className="relative z-10 max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/30 backdrop-blur-md text-amber-300 text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-4 h-4 text-amber-400" />
              {userRole === 'Admin' ? "Admin Management Portal" : "Retailer Offers Portal"}
            </div>
            <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight">
              DishTV Recharge Offers
            </h1>
            <p className="text-amber-100 text-sm md:text-base leading-relaxed">
              {userRole === 'Admin' 
                ? "Admin Control: Add, update, and manage official DishTV multi-month recharge offers for all retailers." 
                : "Retailer Portal: View active DishTV offers added by Admin, copy promo codes, and apply discounts for customers."}
            </p>
          </div>
          <div className="absolute right-0 bottom-0 top-0 w-1/3 opacity-10 pointer-events-none flex items-center justify-center">
            <Tv className="w-96 h-96 text-white" />
          </div>
        </div>

        {/* Search & Action Bar */}
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-slate-900/80 p-4 rounded-xl border border-slate-800 backdrop-blur">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search offers or promo code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-slate-950 border-slate-700 text-slate-200 placeholder:text-slate-500 focus-visible:ring-amber-500"
            />
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
            <div className="flex gap-1.5 overflow-x-auto">
              {["All", "3", "6", "12"].map((m) => (
                <Button
                  key={m}
                  variant={selectedMonth === m ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedMonth(m)}
                  className={selectedMonth === m 
                    ? "bg-amber-500 text-black hover:bg-amber-400 font-bold" 
                    : "border-slate-700 text-slate-300 hover:bg-slate-800"}
                >
                  {m === "All" ? "All" : `${m}M`}
                </Button>
              ))}
            </div>

            {/* Admin Add Offer Action Button */}
            {userRole === 'Admin' && (
              <Button
                onClick={() => setIsAddDialogOpen(true)}
                className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold shrink-0 shadow-lg gap-2"
              >
                <PlusCircle className="w-4 h-4" /> Add Offer (Admin)
              </Button>
            )}
          </div>
        </div>

        {/* Admin Add Dialog */}
        {userRole === 'Admin' && (
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 max-w-2xl">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold text-amber-400 flex items-center gap-2">
                  <PlusCircle className="w-5 h-5 text-amber-500" />
                  Add New DishTV Recharge Offer (Admin Only)
                </DialogTitle>
                <DialogDescription className="text-slate-400 text-xs">
                  This offer will be added to the live database and instantly displayed on all Retailer portals.
                </DialogDescription>
              </DialogHeader>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel className="text-xs text-slate-300">Offer Title</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. DishTV 6-Month Festive Dhamaka" {...field} className="bg-slate-950 border-slate-700 text-slate-200" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="months"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs text-slate-300">Duration (Months)</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="e.g. 6" {...field} className="bg-slate-950 border-slate-700 text-slate-200" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="discountPercentage"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs text-slate-300">Discount (%)</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="e.g. 15" {...field} className="bg-slate-950 border-slate-700 text-slate-200" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="promoCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs text-slate-300">Promo Code</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. DISHTV6M15" {...field} className="bg-slate-950 border-slate-700 font-mono text-amber-400 font-bold" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="badge"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs text-slate-300">Badge Label</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. HOT OFFER" {...field} className="bg-slate-950 border-slate-700 text-slate-200" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="cashbackText"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel className="text-xs text-slate-300">Retailer Cashback / Bonus Benefit</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. 1 Month Extra Subscription + ₹50 Retailer Wallet Cash" {...field} className="bg-slate-950 border-slate-700 text-slate-200" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel className="text-xs text-slate-300">Detailed Description</FormLabel>
                          <FormControl>
                            <Input placeholder="Describe terms, eligibility..." {...field} className="bg-slate-950 border-slate-700 text-slate-200" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <Button type="submit" disabled={isSubmitting} className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold mt-2">
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <PlusCircle className="w-4 h-4 mr-2" />}
                    Publish DishTV Offer to Database
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        )}

        {/* Offers Showcase Grid */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-200 flex items-center gap-2">
              <Gift className="w-5 h-5 text-amber-500" />
              Active DishTV Offers ({filteredOffers.length})
            </h2>
            <span className="text-xs text-slate-400">
              {userRole === 'Admin' ? "Admin Controls Active" : "Published by Admin"}
            </span>
          </div>

          {loading ? (
            <div className="flex justify-center items-center h-48">
              <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredOffers.map((offer) => (
                <Card 
                  key={offer.id} 
                  className="bg-slate-900 border-slate-800 text-slate-100 flex flex-col justify-between overflow-hidden hover:border-amber-500/50 transition-all hover:shadow-lg hover:shadow-amber-500/10"
                >
                  <CardHeader className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[10px] uppercase font-bold">
                        {offer.badge || "SPECIAL OFFER"}
                      </Badge>
                      <span className="text-xs font-semibold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/40">
                        {offer.discountPercentage}% OFF
                      </span>
                    </div>

                    <CardTitle className="text-lg font-bold text-white leading-snug">
                      {offer.title}
                    </CardTitle>

                    <div className="flex items-center gap-2 text-xs text-amber-300/90 font-medium">
                      <Calendar className="w-3.5 h-3.5 text-amber-400" />
                      <span>{offer.months} Months Duration</span>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3 flex-1">
                    <p className="text-slate-300 text-xs leading-relaxed">
                      {offer.description}
                    </p>

                    {offer.cashbackText && (
                      <div className="bg-emerald-950/40 p-2.5 rounded-lg border border-emerald-800/50 flex items-center gap-2 text-xs text-emerald-300">
                        <Zap className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span className="font-semibold">{offer.cashbackText}</span>
                      </div>
                    )}
                  </CardContent>

                  <CardFooter className="pt-2 flex-col gap-2">
                    {/* Promo Code Box */}
                    <div className="w-full bg-slate-950 p-2.5 rounded-lg border border-slate-800 flex items-center justify-between">
                      <div className="space-y-0.5">
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">Promo Code</span>
                        <span className="font-mono text-sm font-bold text-amber-400">{offer.promoCode}</span>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleCopyCode(offer.promoCode)}
                        className="text-xs text-slate-300 hover:text-amber-400 hover:bg-slate-900 gap-1.5"
                      >
                        {copiedCode === offer.promoCode ? (
                          <>
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            <span className="text-emerald-400">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4" />
                            <span>Copy Code</span>
                          </>
                        )}
                      </Button>
                    </div>

                    {/* Differentiated Actions for Admin vs Retailer */}
                    {userRole === 'Admin' ? (
                      <div className="w-full flex gap-2">
                        {offer.id && !offer.id.startsWith("def-") && (
                          <Button 
                            variant="destructive" 
                            size="sm" 
                            onClick={() => { setOfferToDelete(offer); setIsDeleteDialogOpen(true); }}
                            className="w-full text-xs font-bold gap-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Admin Delete
                          </Button>
                        )}
                      </div>
                    ) : (
                      <Button 
                        asChild
                        className="w-full bg-slate-800 hover:bg-amber-500 hover:text-black text-slate-200 text-xs font-bold gap-1 transition-colors"
                      >
                        <Link href="/dashboard/recharge">
                          Apply Offer in Recharge <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </div>

      </div>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="bg-slate-900 border-slate-800 text-slate-100">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-amber-400">Admin Action: Delete Offer?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              This action will permanently delete <span className="font-bold text-slate-200">{offerToDelete?.title}</span> from the database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-slate-700 text-slate-300 bg-slate-950">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-500 text-white font-bold">
              Delete Offer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
