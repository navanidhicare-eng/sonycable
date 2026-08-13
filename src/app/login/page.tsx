"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Image from "next/image";
import Link from "next/link";
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
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import {
  Tv,
  LogIn,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  Radio,
  Receipt,
  Users,
  HandCoins,
  MessageSquare,
  Eye,
  EyeOff,
  Lock,
  User,
  ArrowRight,
  Headphones,
  Globe,
  CreditCard,
  PackageCheck,
  Search,
  X,
  AlertCircle,
  MapPin,
} from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { collection, query, where, getDocs, onSnapshot } from "firebase/firestore";

const formSchema = z.object({
  email: z.string().min(1, { message: "Email or Mobile Number is required." }),
  password: z.string().min(1, { message: "Password is required." }),
});

type FormValues = z.infer<typeof formSchema>;

interface PublicCustomerResult {
  id: string;
  name: string;
  mobile: string;
  vcNumber?: string;
  packagePlan?: string;
  monthlyAmount?: number;
  threeMonthAmount?: number;
  sixMonthAmount?: number;
  twelveMonthAmount?: number;
  status: "Active" | "Expired" | "Suspended";
  address?: string;
  village?: string;
  mandal?: string;
  district?: string;
  dealerName?: string;
}

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Public Home Search State (Requires BOTH Mobile & VC Number for security)
  const [homeMobileTerm, setHomeMobileTerm] = useState("");
  const [homeVcTerm, setHomeVcTerm] = useState("");
  const [publicSearchResult, setPublicSearchResult] = useState<PublicCustomerResult[]>([]);
  const [isSearchingPublic, setIsSearchingPublic] = useState(false);
  const [publicSearchPerformed, setPublicSearchPerformed] = useState(false);
  const [publicSearchError, setPublicSearchError] = useState<string | null>(null);
  const [publicPackagesMap, setPublicPackagesMap] = useState<Record<string, { m: number; t3: number; t6: number; t12: number }>>({});

  useEffect(() => {
    const qPkgs = collection(db, "packages");
    const unsub = onSnapshot(qPkgs, (snap) => {
      const pMap: Record<string, { m: number; t3: number; t6: number; t12: number }> = {};
      snap.docs.forEach((dDoc) => {
        const d = dDoc.data();
        const pName = d.packageName;
        const m = parseFloat(d.packageAmount || "350") || 350;
        const t3 = d.threeMonthAmount ? parseFloat(d.threeMonthAmount) : m * 3;
        const t6 = d.sixMonthAmount ? parseFloat(d.sixMonthAmount) : m * 6;
        const t12 = d.twelveMonthAmount ? parseFloat(d.twelveMonthAmount) : m * 12;
        if (pName) {
          pMap[pName.toLowerCase()] = { m, t3, t6, t12 };
        }
      });
      setPublicPackagesMap(pMap);
    }, () => {});

    return () => unsub();
  }, []);

  const handlePublicSearch = async () => {
    const mob = homeMobileTerm.trim();
    const vc = homeVcTerm.trim();

    if (!mob || !vc) {
      setPublicSearchError("ఖాతా వివరాల భద్రత కొరకు మొబైల్ నంబర్ మరియు VC నంబర్ రెండూ తప్పనిసరిగా ఎంటర్ చేయాలి. (Please enter BOTH Mobile Number AND VC Number).");
      setPublicSearchPerformed(true);
      setPublicSearchResult([]);
      return;
    }

    setPublicSearchError(null);
    setIsSearchingPublic(true);
    setPublicSearchPerformed(true);

    try {
      const custSnap = await getDocs(collection(db, "dishtv_customers"));
      const allCusts: PublicCustomerResult[] = custSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as PublicCustomerResult[];

      const cleanEnteredMob = mob.replace(/\D/g, "");
      const cleanVc = vc.toLowerCase();

      const filtered = allCusts.filter((c) => {
        const cleanCustMob = (c.mobile || "").replace(/\D/g, "");
        const custVc = (c.vcNumber || "").trim().toLowerCase();

        // Exact dual validation: Both Mobile and VC Number must match
        const mobMatch = cleanCustMob.length > 0 && (cleanCustMob === cleanEnteredMob || cleanCustMob.endsWith(cleanEnteredMob) || cleanEnteredMob.endsWith(cleanCustMob));
        const vcMatch = custVc.length > 0 && (custVc === cleanVc);

        return mobMatch && vcMatch;
      });

      setPublicSearchResult(filtered);
    } catch (err) {
      console.error("Public Search Error:", err);
    } finally {
      setIsSearchingPublic(false);
    }
  };

  const getPublicPackagePrices = (cust: PublicCustomerResult) => {
    const monthly = cust.monthlyAmount || 350;
    const pkgKey = (cust.packagePlan || "").toLowerCase();
    const pkgData = publicPackagesMap[pkgKey];

    const t3 = cust.threeMonthAmount || pkgData?.t3 || (monthly * 3);
    const t6 = cust.sixMonthAmount || pkgData?.t6 || (monthly * 6);
    const t12 = cust.twelveMonthAmount || pkgData?.t12 || (monthly * 12);

    return {
      m1: monthly,
      m3: t3,
      m6: t6,
      m12: t12,
    };
  };

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function handleLogin(loginEmail: string, data: FormValues) {
    const userCredential = await signInWithEmailAndPassword(auth, loginEmail, data.password);
    const user = userCredential.user;

    let userRole: string | null = null;
    let destination: string | null = null;

    // 1. Check for Admin
    if (user.email === "psdgandepalli@gmail.com") {
      userRole = "Admin";
      destination = "/dashboard";
    } else {
      // 2. Check for Staff
      const staffQuery = query(collection(db, "staff"), where("uid", "==", user.uid));
      const staffSnapshot = await getDocs(staffQuery);
      if (!staffSnapshot.empty) {
        const staffData = staffSnapshot.docs[0].data();
        userRole = staffData.role || "Staff";
        destination = "/dashboard";
      } else {
        // 3. Check for DishTV Dealer
        const dealerQueryByUid = query(collection(db, "dishtv_dealers"), where("uid", "==", user.uid));
        let dealerSnapshot = await getDocs(dealerQueryByUid);

        if (dealerSnapshot.empty && user.email) {
          const dealerQueryByEmail = query(collection(db, "dishtv_dealers"), where("formattedEmail", "==", user.email));
          dealerSnapshot = await getDocs(dealerQueryByEmail);
        }

        if (!dealerSnapshot.empty) {
          const dealerData = dealerSnapshot.docs[0].data();
          if (dealerData.status === "Inactive") {
            await auth.signOut();
            throw new Error("auth/account-inactive");
          }
          userRole = "Dealer";
          destination = "/dashboard";
        } else {
          // 4. Check for DishTV Retailer
          const retailerQueryByUid = query(collection(db, "dishtv_retailers"), where("uid", "==", user.uid));
          let retailerSnapshot = await getDocs(retailerQueryByUid);

          if (retailerSnapshot.empty && user.email) {
            const retailerQueryByEmail = query(collection(db, "dishtv_retailers"), where("formattedEmail", "==", user.email));
            retailerSnapshot = await getDocs(retailerQueryByEmail);
          }

          if (!retailerSnapshot.empty) {
            const retailerData = retailerSnapshot.docs[0].data();
            if (retailerData.status === "Inactive") {
              await auth.signOut();
              throw new Error("auth/account-inactive");
            }
            userRole = "Retailer";
            destination = "/dashboard";
          }
        }
      }
    }

    if (userRole && destination) {
      if (typeof window !== "undefined") {
        localStorage.setItem("userRole", userRole);
      }
      toast({
        title: "Login Successful",
        description: `Welcome back! Redirecting to ${userRole} Dashboard...`,
      });
      router.push(destination);
    } else {
      await auth.signOut();
      if (typeof window !== "undefined") {
        localStorage.removeItem("userRole");
      }
      throw new Error("auth/unauthorized-user");
    }
  }

  async function onSubmit(data: FormValues) {
    setIsSubmitting(true);

    const trimmedInput = data.email.trim();
    const isEmail = trimmedInput.includes("@");
    const loginEmail = isEmail ? trimmedInput : `${trimmedInput}@sonycable.local`;

    try {
      await handleLogin(loginEmail, data);
    } catch (error: any) {
      console.error("Firebase Auth Error:", error);
      let errorMessage = "An error occurred during login.";
      if (
        error.code === "auth/user-not-found" ||
        error.message === "auth/unauthorized-user" ||
        error.code === "auth/invalid-credential" ||
        error.code === "auth/invalid-email"
      ) {
        errorMessage = "Invalid email, username, or password. Please check your credentials.";
      } else if (error.code === "auth/wrong-password") {
        errorMessage = "Incorrect password. Please try again.";
      } else if (error.message === "auth/account-inactive") {
        errorMessage = "Your dealer account is currently inactive. Please contact Admin.";
      }

      toast({
        variant: "destructive",
        title: "Login Failed",
        description: errorMessage,
      });
    } finally {
      setIsSubmitting(false);
    }
  }



  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 selection:bg-orange-500 selection:text-white relative overflow-hidden font-sans">
      {/* Background Ambient Glow Gradients */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-orange-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Top Header / Navigation Bar */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-slate-950/80 border-b border-slate-800/80 px-4 lg:px-12 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-600 via-orange-500 to-red-600 shadow-xl shadow-orange-500/30">
              <Tv className="w-7 h-7 text-white" />
              <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-red-500"></span>
              </span>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-xl font-black tracking-tight text-white">
                  Navanidhi Digital System
                </span>
              </div>
              <div className="flex items-center gap-1 text-[11px] font-bold tracking-wider">
                <span className="text-slate-400">Official</span>
                <span className="text-orange-400 font-extrabold text-xs">dish<span className="text-red-500">tv</span></span>
                <span className="text-amber-400 font-extrabold">Partner</span>
                <span className="text-slate-500">• Portal</span>
              </div>
            </div>
          </div>

          {/* Right Header Status Pill & Helpline */}
          <div className="hidden md:flex items-center gap-4 text-xs font-semibold">
            <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-800 px-3 py-1.5 rounded-full text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>DishTV Official Systems Active</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300 bg-slate-900/60 px-3.5 py-1.5 rounded-full border border-slate-800">
              <Headphones className="w-3.5 h-3.5 text-orange-400" />
              <span>Helpdesk: +91 90107 37882</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Hero & Login Section */}
      <main className="max-w-7xl mx-auto px-4 lg:px-12 py-12 lg:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Column: Hero Content & Graphic Banner */}
          <div className="lg:col-span-7 space-y-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/30 text-orange-400 text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-4 h-4 text-orange-400" />
              <span>Navanidhi Digital System — Official DishTV Partner</span>
            </div>

            <div className="space-y-4">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-tight">
                NAVANIDHI DIGITAL <br />
                <span className="bg-gradient-to-r from-orange-400 via-amber-400 to-red-500 bg-clip-text text-transparent">
                  OFFICIAL DISHTV PARTNER
                </span>
              </h1>
              <p className="text-base sm:text-lg text-slate-300 max-w-2xl font-medium leading-relaxed">
                నవనిధి డిజిటల్ సిస్టమ్ ద్వారా అధికారిక డీలర్ మరియు కస్టమర్ మేనేజ్‌మెంట్ పోర్టల్. Instant DishTV VC Search, 1-3-6-12 Months Pack Offers.
              </p>
            </div>

            {/* Public DishTV Customer Quick Search Box (Dual Input Security) */}
            <div className="bg-gradient-to-br from-slate-900/95 via-slate-900 to-slate-950 p-5 sm:p-6 rounded-3xl border border-orange-500/40 shadow-2xl space-y-4 backdrop-blur-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 rounded-xl bg-orange-500/20 text-orange-400 border border-orange-500/30">
                    <ShieldCheck className="w-5 h-5 text-orange-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      DishTV Customer Account Search <span className="text-xs text-amber-400 font-normal">(ఖాతా వెతుకులాట)</span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      కస్టమర్ భద్రత కోసం Registered Mobile Number మరియు VC Number రెండు ఎంటర్ చేయాలి.
                    </p>
                  </div>
                </div>
                <Badge className="self-start sm:self-center bg-orange-500/20 border-orange-500/40 text-orange-400 text-[11px] px-2.5 py-1 font-semibold">
                  🔒 Secure Account Verification
                </Badge>
              </div>

              {/* 2-Column Input Grid: Mobile No & VC No */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                    📱 Registered Mobile Number
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                    <Input
                      value={homeMobileTerm}
                      onChange={(e) => { setHomeMobileTerm(e.target.value); setPublicSearchError(null); }}
                      onKeyDown={(e) => e.key === "Enter" && handlePublicSearch()}
                      placeholder="e.g. 9848006463"
                      className="bg-slate-950 border-slate-800 text-white pl-10 pr-4 py-5 text-sm rounded-xl focus-visible:ring-2 focus-visible:ring-orange-500"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                    💳 DishTV VC Number
                  </label>
                  <div className="relative">
                    <CreditCard className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                    <Input
                      value={homeVcTerm}
                      onChange={(e) => { setHomeVcTerm(e.target.value); setPublicSearchError(null); }}
                      onKeyDown={(e) => e.key === "Enter" && handlePublicSearch()}
                      placeholder="e.g. 123456789"
                      className="bg-slate-950 border-slate-800 text-white pl-10 pr-4 py-5 text-sm rounded-xl focus-visible:ring-2 focus-visible:ring-orange-500"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-1">
                {(homeMobileTerm || homeVcTerm) ? (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setHomeMobileTerm("");
                      setHomeVcTerm("");
                      setPublicSearchResult([]);
                      setPublicSearchPerformed(false);
                      setPublicSearchError(null);
                    }}
                    className="text-xs text-slate-400 hover:text-white hover:bg-slate-900 rounded-xl px-3"
                  >
                    <X className="w-3.5 h-3.5 mr-1" /> Clear Inputs
                  </Button>
                ) : <div />}

                <Button
                  onClick={handlePublicSearch}
                  disabled={isSearchingPublic || !homeMobileTerm.trim() || !homeVcTerm.trim()}
                  className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-bold px-6 py-5 rounded-xl shadow-lg shadow-orange-500/20 text-sm ml-auto"
                >
                  {isSearchingPublic ? "Verifying Account..." : "Search Account"}
                </Button>
              </div>

              {/* Public Search Results or Error Display */}
              {publicSearchPerformed && (
                <div className="pt-2">
                  {publicSearchError ? (
                    <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>{publicSearchError}</span>
                    </div>
                  ) : publicSearchResult.length === 0 ? (
                    <div className="p-4 rounded-xl bg-slate-950/90 border border-slate-800 text-slate-300 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>
                        సరైన ఖాతా కనుగొనబడలేదు. నమోదు చేసిన మొబైల్ (<strong className="text-white">{homeMobileTerm}</strong>) మరియు VC నంబర్ (<strong className="text-white">{homeVcTerm}</strong>) సరిగ్గా ఉన్నాయో లేదో సరిచూసుకోండి.
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-4 max-h-[450px] overflow-y-auto pr-1">
                      {publicSearchResult.map((cust) => {
                        const prices = getPublicPackagePrices(cust);
                        return (
                          <div key={cust.id} className="p-4 sm:p-5 rounded-2xl bg-slate-950 border border-amber-500/40 text-slate-100 shadow-xl space-y-4">
                            {/* Header: Customer Name, Status & Mobile */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                              <div>
                                <div className="flex items-center gap-2">
                                  <h4 className="text-xl font-black text-white">{cust.name}</h4>
                                  <Badge className={cust.status === "Active" ? "bg-emerald-500 text-white font-bold" : "bg-amber-500 text-white font-bold"}>
                                    {cust.status}
                                  </Badge>
                                </div>
                                <p className="text-xs text-slate-400 mt-1 flex items-center gap-1 font-medium">
                                  <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                  <span>{[cust.address || cust.village, cust.mandal, cust.district].filter(Boolean).join(", ") || "Location Registered"}</span>
                                </p>
                              </div>
                              <div className="text-left sm:text-right">
                                <span className="text-[11px] text-slate-400 block font-medium">Registered Mobile</span>
                                <span className="text-base font-bold text-emerald-400">📱 {cust.mobile}</span>
                              </div>
                            </div>

                            {/* Info Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                              <div>
                                <span className="text-slate-400 block font-medium">💳 VC Number</span>
                                <span className="text-sm font-mono font-bold text-purple-300">{cust.vcNumber || "Not Set"}</span>
                              </div>
                              <div>
                                <span className="text-slate-400 block font-medium">📺 Current Package</span>
                                <span className="text-sm font-bold text-blue-300">{cust.packagePlan || "Standard Plan"}</span>
                              </div>
                              <div>
                                <span className="text-slate-400 block font-medium">🏬 Dealer Name</span>
                                <span className="text-sm font-bold text-amber-300">{cust.dealerName || "Navanidhi Digital System"}</span>
                              </div>
                            </div>

                            {/* 1, 3, 6, 12 Month Pack Price Breakdown */}
                            <div className="bg-slate-900/90 p-3.5 rounded-xl border border-orange-500/30">
                              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider block mb-2.5 flex items-center gap-1.5">
                                <PackageCheck className="w-4 h-4 text-orange-400" />
                                Package Price List (ప్యాక్ ధరల పట్టిక - 1, 3, 6, 12 నెలలు):
                              </span>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                                <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                                  <span className="text-[10px] text-slate-400 block font-medium">1 Month</span>
                                  <span className="text-sm font-black text-emerald-400">₹{prices.m1.toLocaleString()}</span>
                                </div>
                                <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                                  <span className="text-[10px] text-slate-400 block font-medium">3 Months</span>
                                  <span className="text-sm font-black text-blue-400">₹{prices.m3.toLocaleString()}</span>
                                </div>
                                <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                                  <span className="text-[10px] text-slate-400 block font-medium">6 Months</span>
                                  <span className="text-sm font-black text-purple-400">₹{prices.m6.toLocaleString()}</span>
                                </div>
                                <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                                  <span className="text-[10px] text-slate-400 block font-medium">12 Months (1 Year)</span>
                                  <span className="text-sm font-black text-amber-400">₹{prices.m12.toLocaleString()}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Banner Graphic Image */}
            <div className="relative rounded-2xl overflow-hidden border border-slate-800/80 shadow-2xl group">
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent z-10" />
              <Image
                src="/dishtv_sony_cable_banner.png"
                alt="Navanidhi Digital DishTV Banner"
                width={700}
                height={350}
                className="w-full h-auto object-cover transform group-hover:scale-105 transition-transform duration-700"
                priority
              />
              <div className="absolute bottom-4 left-6 z-20 flex items-center gap-2 text-xs font-bold text-amber-300">
                <Radio className="w-4 h-4 text-orange-400 animate-pulse" />
                <span>Navanidhi Digital System — Official DishTV Partner Network</span>
              </div>
            </div>

            {/* Highlights Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 flex items-center gap-3">
                <Search className="w-8 h-8 text-orange-400 shrink-0" />
                <div>
                  <h4 className="text-xs font-bold text-white uppercase">Instant VC Lookup</h4>
                  <p className="text-[11px] text-slate-400">Mobile & VC search in seconds</p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 flex items-center gap-3">
                <PackageCheck className="w-8 h-8 text-emerald-400 shrink-0" />
                <div>
                  <h4 className="text-xs font-bold text-white uppercase">1,3,6,12 Mo Offers</h4>
                  <p className="text-[11px] text-slate-400">Multi-month pack price list</p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 flex items-center gap-3">
                <MessageSquare className="w-8 h-8 text-blue-400 shrink-0" />
                <div>
                  <h4 className="text-xs font-bold text-white uppercase">WhatsApp Bills</h4>
                  <p className="text-[11px] text-slate-400">Direct customer receipts</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: DishTV STB Showcase & Glassmorphic Login Portal Card */}
          <div className="lg:col-span-5 space-y-6">
            {/* DishTV SMRT Hub STB & Satellite Dish Display Card */}
            <div className="relative rounded-3xl overflow-hidden border border-orange-500/40 bg-gradient-to-br from-slate-900/95 via-slate-950 to-slate-900 p-5 shadow-2xl backdrop-blur-xl group">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Badge className="bg-gradient-to-r from-orange-500 to-amber-500 text-white font-black text-[10px] px-2.5 py-0.5 uppercase tracking-wider shadow-md shadow-orange-500/20">
                    Dish SMRT Hub
                  </Badge>
                  <span className="text-xs font-bold text-slate-300">Official Hardware</span>
                </div>
                <span className="text-[11px] font-bold text-amber-400">Powered by WATCHO</span>
              </div>

              {/* DishTV STB, Dish & Remote Control Image */}
              <div className="relative w-full h-52 sm:h-60 flex items-center justify-center p-2 my-1">
                <Image
                  src="/dishtv_stb_remote.png"
                  alt="DishTV SMRT Hub Set-Top Box, Dish Antenna & Remote"
                  width={500}
                  height={300}
                  className="w-auto max-h-full object-contain filter drop-shadow-[0_15px_30px_rgba(249,115,22,0.3)] transform group-hover:scale-105 transition-transform duration-500"
                  priority
                />
              </div>

              <div className="bg-slate-950/80 p-3 rounded-2xl border border-slate-800/80 flex items-center justify-between text-xs">
                <span className="text-slate-300 font-medium">⚡ DishTV Smart HD Connection</span>
                <span className="text-orange-400 font-bold">Navanidhi Digital</span>
              </div>
            </div>

            {/* Portal Login Card */}
            <Card className="bg-slate-900/90 border-slate-800 backdrop-blur-2xl shadow-2xl text-slate-100 rounded-3xl overflow-hidden">
              <CardHeader className="space-y-3 pb-4 text-center border-b border-slate-800/80 bg-slate-950/40 p-6">
                <div className="mx-auto flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-600 via-orange-500 to-red-600 text-white shadow-xl shadow-orange-500/20">
                  <ShieldCheck className="w-7 h-7" />
                </div>
                <div>
                  <CardTitle className="text-2xl font-black tracking-tight text-white">
                    Portal Login
                  </CardTitle>
                  <CardDescription className="text-slate-400 text-xs mt-1">
                    Enter your Email / Mobile Number & Password
                  </CardDescription>
                </div>


              </CardHeader>

              <CardContent className="p-6">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                    {/* Email or Mobile Field */}
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-300 font-semibold text-xs flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-orange-400" />
                            Email / Mobile Number
                          </FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input
                                placeholder="Enter email or mobile number"
                                className="bg-slate-950/80 border-slate-800 text-white placeholder:text-slate-500 py-5 rounded-xl text-sm focus-visible:ring-2 focus-visible:ring-orange-500"
                                {...field}
                              />
                            </div>
                          </FormControl>
                          <FormMessage className="text-red-400 text-xs" />
                        </FormItem>
                      )}
                    />

                    {/* Password Field */}
                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-300 font-semibold text-xs flex items-center gap-1.5">
                            <Lock className="w-3.5 h-3.5 text-orange-400" />
                            Password
                          </FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input
                                type={showPassword ? "text" : "password"}
                                placeholder="••••••••"
                                className="bg-slate-950/80 border-slate-800 text-white placeholder:text-slate-500 py-5 pr-10 rounded-xl text-sm focus-visible:ring-2 focus-visible:ring-orange-500"
                                {...field}
                              />
                              <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-3 text-slate-400 hover:text-white"
                              >
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                            </div>
                          </FormControl>
                          <FormMessage className="text-red-400 text-xs" />
                        </FormItem>
                      )}
                    />

                    {/* Login Submit Button */}
                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-6 rounded-xl bg-gradient-to-r from-orange-500 via-amber-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-bold text-base shadow-lg shadow-orange-500/25 transition-all transform hover:scale-[1.01]"
                    >
                      {isSubmitting ? (
                        <span className="flex items-center gap-2">
                          <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                          Authenticating...
                        </span>
                      ) : (
                        <span className="flex items-center justify-center gap-2">
                          <LogIn className="w-5 h-5" /> Sign In to Portal
                        </span>
                      )}
                    </Button>
                  </form>
                </Form>
              </CardContent>

              <CardFooter className="bg-slate-950/60 p-4 text-center border-t border-slate-800/80">
                <p className="text-[11px] text-slate-400 w-full flex items-center justify-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>256-bit Encrypted Secure DishTV Portal Session</span>
                </p>
              </CardFooter>
            </Card>
          </div>
        </div>

        {/* Feature Showcase Grid Section */}
        <section className="mt-20 pt-12 border-t border-slate-800/80">
          <div className="text-center max-w-2xl mx-auto mb-12 space-y-2">
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Powerful DishTV Operator Capabilities
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Built specifically for Navanidhi Digital System — Official DishTV Partner operations
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="bg-slate-900/60 border-slate-800 text-slate-100 hover:border-orange-500/50 transition-colors">
              <CardContent className="p-6 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-400">
                  <Tv className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-white">DishTV VC Management</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Manage DishTV customer accounts, STB numbers, VC details, and active status in one central hub.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-slate-900/60 border-slate-800 text-slate-100 hover:border-emerald-500/50 transition-colors">
              <CardContent className="p-6 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <HandCoins className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-white">Collections & Wallets</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Record daily cash/online collections, manage dealer wallets, and settle requests with Admin seamlessly.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-slate-900/60 border-slate-800 text-slate-100 hover:border-blue-500/50 transition-colors">
              <CardContent className="p-6 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <CreditCard className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-white">Multi-Month Offer Rates</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Instant calculation of 1, 3, 6, and 12-month recharge pricing and discount plans.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-slate-900/60 border-slate-800 text-slate-100 hover:border-purple-500/50 transition-colors">
              <CardContent className="p-6 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                  <Receipt className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-white">WhatsApp Bills & History</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Generate digital invoices, send direct customer WhatsApp receipts, and view full transaction history.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-8 px-4 lg:px-12 text-slate-400 text-xs mt-16">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white">Navanidhi Digital System</span>
            <span className="text-orange-400 font-semibold">• Official DishTV Partner</span>
            <span>&copy; {new Date().getFullYear()} All rights reserved.</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="hover:text-white transition-colors cursor-pointer">DishTV Operations</span>
            <span>•</span>
            <span className="hover:text-white transition-colors cursor-pointer">Dealer Care</span>
            <span>•</span>
            <span className="hover:text-white transition-colors cursor-pointer">Terms & Privacy</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
