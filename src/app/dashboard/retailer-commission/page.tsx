"use client";

import { useState, useEffect, useMemo } from "react";
import { 
  IndianRupee, 
  Percent, 
  Wrench, 
  Package, 
  Calculator, 
  Award, 
  CheckCircle, 
  Save,
  Loader2,
  Sparkles,
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  Building2,
  History,
  Send,
  Phone,
  Search,
  CheckCircle2,
  MapPin,
  User
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import { 
  doc, 
  onSnapshot, 
  setDoc, 
  collection, 
  addDoc, 
  updateDoc, 
  Timestamp, 
  query, 
  orderBy 
} from "firebase/firestore";

interface CommissionSettings {
  rechargeCommissionRate: number; // e.g. 5.0%
  serviceRequestCommission: number; // e.g. 50 (₹ per service request)
  newConnectionCommission: number; // e.g. 250 (₹ per box)
  notes?: string;
  updatedAt?: any;
}

interface DishTvRetailer {
  id: string;
  uid?: string;
  retailerName: string;
  contactPerson?: string;
  mobile: string;
  address?: string;
  district?: string;
  mandal?: string;
  village?: string;
  formattedEmail?: string;
  walletBalance?: number;
  totalEarned?: number;
  totalPaid?: number;
}

interface CommissionTransaction {
  id: string;
  retailerId: string;
  retailerUid?: string;
  retailerName: string;
  retailerMobile?: string;
  customerName?: string;
  customerMobile?: string;
  customerAddress?: string;
  village?: string;
  mandal?: string;
  district?: string;
  vcNumber?: string;
  amount: number;
  type: "Credit" | "Payout Debit";
  category: "Service Request" | "New Connection" | "Recharge" | "Bank Transfer Payout" | "Manual Adjustment";
  description: string;
  payoutMethod?: string;
  utrReference?: string;
  createdAt: any;
}

const DEFAULT_COMMISSIONS: CommissionSettings = {
  rechargeCommissionRate: 5.0,
  serviceRequestCommission: 50,
  newConnectionCommission: 250,
  notes: "Recharge commission is credited to wallet instantly. Service request and New Connection commissions are credited upon status verification."
};

export default function RetailerCommissionPage() {
  const { toast } = useToast();
  const { user, userRole, shopName } = useAuth();
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);

  // Firestore commission settings
  const [commissions, setCommissions] = useState<CommissionSettings>(DEFAULT_COMMISSIONS);

  // Admin edit form state
  const [editRechargeRate, setEditRechargeRate] = useState<number>(5.0);
  const [editServiceComm, setEditServiceComm] = useState<number>(50);
  const [editNewConnComm, setEditNewConnComm] = useState<number>(250);
  const [editNotes, setEditNotes] = useState<string>("");

  // Live Retailers List & Transactions
  const [retailers, setRetailers] = useState<DishTvRetailer[]>([]);
  const [transactions, setTransactions] = useState<CommissionTransaction[]>([]);
  const [historySearch, setHistorySearch] = useState("");

  // Retailer Live Calculator Inputs
  const [calcRechargeVol, setCalcRechargeVol] = useState<number>(10000);
  const [calcServiceCount, setCalcServiceCount] = useState<number>(5);
  const [calcNewConnCount, setCalcNewConnCount] = useState<number>(3);

  // Admin Payout Settlement Modal State
  const [isPayoutModalOpen, setIsPayoutModalOpen] = useState(false);
  const [selectedRetailer, setSelectedRetailer] = useState<DishTvRetailer | null>(null);
  const [payoutAmount, setPayoutAmount] = useState<number>(0);
  const [payoutMethod, setPayoutMethod] = useState<string>("Bank Account Deposit");
  const [utrReference, setUtrReference] = useState<string>("");
  const [payoutNotes, setPayoutNotes] = useState<string>("");
  const [isProcessingPayout, setIsProcessingPayout] = useState(false);

  // 1. Subscribe to Commission Settings
  useEffect(() => {
    setLoading(true);
    const docRef = doc(db, "settings", "retailer_commissions");
    const unsubSettings = onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as CommissionSettings;
          setCommissions(data);
          setEditRechargeRate(data.rechargeCommissionRate ?? 5.0);
          setEditServiceComm(data.serviceRequestCommission ?? 50);
          setEditNewConnComm(data.newConnectionCommission ?? 250);
          setEditNotes(data.notes ?? DEFAULT_COMMISSIONS.notes!);
        } else {
          setCommissions(DEFAULT_COMMISSIONS);
          setEditRechargeRate(DEFAULT_COMMISSIONS.rechargeCommissionRate);
          setEditServiceComm(DEFAULT_COMMISSIONS.serviceRequestCommission);
          setEditNewConnComm(DEFAULT_COMMISSIONS.newConnectionCommission);
          setEditNotes(DEFAULT_COMMISSIONS.notes!);
        }
        setLoading(false);
      },
      (err) => {
        console.error("Error fetching commissions settings:", err);
        setCommissions(DEFAULT_COMMISSIONS);
        setLoading(false);
      }
    );

    // 2. Subscribe to DishTV Retailers for Wallet balances
    const unsubRetailers = onSnapshot(collection(db, "dishtv_retailers"), (snapshot) => {
      const rList = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as DishTvRetailer[];
      setRetailers(rList);
    });

    // 3. Subscribe to Commission Transactions
    const qTx = query(collection(db, "commission_transactions"), orderBy("createdAt", "desc"));
    const unsubTx = onSnapshot(qTx, (snapshot) => {
      const txList = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as CommissionTransaction[];
      setTransactions(txList);
    });

    return () => {
      unsubSettings();
      unsubRetailers();
      unsubTx();
    };
  }, []);

  // Save Commission Settings (Admin)
  const handleSaveCommissions = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const payload: CommissionSettings = {
        rechargeCommissionRate: Number(editRechargeRate) || 0,
        serviceRequestCommission: Number(editServiceComm) || 0,
        newConnectionCommission: Number(editNewConnComm) || 0,
        notes: editNotes.trim(),
        updatedAt: Timestamp.now(),
      };
      await setDoc(doc(db, "settings", "retailer_commissions"), payload);
      toast({
        title: "Commission Rates Saved & Published! 🚀",
        description: "Retailers will now see updated commission rates on their portal.",
      });
    } catch (err) {
      console.error("Failed to save commissions:", err);
      toast({
        variant: "destructive",
        title: "Save Failed",
        description: "Could not update commission rates in Firestore.",
      });
    } finally {
      setSavingSettings(false);
    }
  };

  // Open Payout Modal for specific retailer
  const handleOpenPayout = (retailer: DishTvRetailer) => {
    setSelectedRetailer(retailer);
    setPayoutAmount(retailer.walletBalance || 0);
    setPayoutMethod("Bank Account Deposit");
    setUtrReference("");
    setPayoutNotes(`Monthly commission payout (15th/30th cycle) for ${retailer.retailerName}`);
    setIsPayoutModalOpen(true);
  };

  // Submit Payout Settlement (Admin)
  const handleConfirmPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRetailer) return;

    if (payoutAmount <= 0) {
      toast({
        variant: "destructive",
        title: "Invalid Amount",
        description: "Please enter a valid payout amount greater than zero.",
      });
      return;
    }

    const currentBal = selectedRetailer.walletBalance || 0;
    const currentPaid = selectedRetailer.totalPaid || 0;

    setIsProcessingPayout(true);
    try {
      // 1. Update Retailer's wallet balance & total paid in dishtv_retailers
      await updateDoc(doc(db, "dishtv_retailers", selectedRetailer.id), {
        walletBalance: Math.max(0, currentBal - payoutAmount),
        totalPaid: currentPaid + payoutAmount,
      });

      // 2. Log Payout Debit Transaction
      await addDoc(collection(db, "commission_transactions"), {
        retailerId: selectedRetailer.id,
        retailerUid: selectedRetailer.uid || "",
        retailerName: selectedRetailer.retailerName,
        retailerMobile: selectedRetailer.mobile || "",
        amount: payoutAmount,
        type: "Payout Debit",
        category: "Bank Transfer Payout",
        description: payoutNotes.trim() || `Bank transfer deposit payout to ${selectedRetailer.retailerName}`,
        payoutMethod: payoutMethod,
        utrReference: utrReference.trim() || "N/A",
        createdAt: Timestamp.now(),
      });

      toast({
        title: "Payout Settled & Deducted! 🏦",
        description: `₹${payoutAmount.toLocaleString()} deposited to ${selectedRetailer.retailerName}'s account and deducted from wallet balance.`,
      });

      setIsPayoutModalOpen(false);
      setSelectedRetailer(null);
    } catch (err) {
      console.error("Payout settlement error:", err);
      toast({
        variant: "destructive",
        title: "Payout Failed",
        description: "An error occurred while settling payout.",
      });
    } finally {
      setIsProcessingPayout(false);
    }
  };

  // Find Current Retailer record for Retailer view
  const currentRetailerRecord = useMemo(() => {
    if (!user) return null;
    return (
      retailers.find(
        (r) =>
          r.uid === user.uid ||
          (r.formattedEmail && r.formattedEmail === user.email) ||
          (r.retailerName && shopName && r.retailerName?.toLowerCase() === shopName?.toLowerCase())
      ) || null
    );
  }, [user, retailers, shopName]);

  // Filtered transactions for Retailer OR Admin search
  const filteredTransactions = useMemo(() => {
    let list = transactions;

    if (userRole !== "Admin") {
      if (!user) return [];

      list = list.filter((tx) => {
        const matchesUserUid = (tx.retailerUid && tx.retailerUid === user.uid) || (tx.retailerId && tx.retailerId === user.uid);
        const matchesUserEmail = Boolean(user.email && tx.retailerEmail && tx.retailerEmail.toLowerCase() === user.email.toLowerCase());
        
        let matchesRetailerRecord = false;
        if (currentRetailerRecord) {
          matchesRetailerRecord =
            tx.retailerId === currentRetailerRecord.id ||
            tx.retailerUid === currentRetailerRecord.uid ||
            Boolean(tx.retailerName && shopName && tx.retailerName.toLowerCase() === shopName.toLowerCase());
        }

        return matchesUserUid || matchesUserEmail || matchesRetailerRecord;
      });
    }

    if (historySearch.trim()) {
      const q = historySearch.toLowerCase();
      list = list.filter(
        (tx) =>
          tx.retailerName?.toLowerCase().includes(q) ||
          tx.description?.toLowerCase().includes(q) ||
          tx.category?.toLowerCase().includes(q) ||
          tx.utrReference?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [transactions, userRole, user, currentRetailerRecord, shopName, historySearch]);

  // Calculator calculations based on published commission rates
  const calculatedRechargeEarnings = (calcRechargeVol * commissions.rechargeCommissionRate) / 100;
  const calculatedServiceEarnings = calcServiceCount * commissions.serviceRequestCommission;
  const calculatedNewConnEarnings = calcNewConnCount * commissions.newConnectionCommission;
  const totalEstimatedEarnings = calculatedRechargeEarnings + calculatedServiceEarnings + calculatedNewConnEarnings;

  return (
    <main className="min-h-screen w-full bg-slate-950 text-slate-100 p-3 sm:p-6 md:p-8 font-sans pb-16">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-8">
        
        {/* Header */}
        <div className="relative overflow-hidden rounded-xl sm:rounded-2xl bg-gradient-to-r from-emerald-700 via-teal-700 to-indigo-900 p-4 sm:p-6 md:p-8 shadow-2xl border border-emerald-500/30">
          <div className="relative z-10 max-w-3xl space-y-2 sm:space-y-3">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-black/40 backdrop-blur-md text-emerald-300 text-[10px] sm:text-xs font-bold uppercase tracking-wider border border-emerald-500/40">
              <Award className="w-3.5 h-3.5 text-emerald-400" />
              {userRole === 'Admin' ? "Admin Commission & Payout Management" : "Retailer Commission Wallet & Earnings"}
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-white tracking-tight">
              Retailer Commission Wallet
            </h1>
            <p className="text-emerald-100 text-xs sm:text-sm leading-relaxed">
              {userRole === 'Admin'
                ? "Manage retailer wallet balances, auto-credited commissions for resolved service requests/new connections, and process bank transfer payouts on 15th & 30th of every month."
                : "Track your live commission wallet balance, view auto-credited earnings from service requests & recharges, and check monthly bank account payout history."}
            </p>
          </div>
          <div className="absolute right-0 bottom-0 top-0 w-1/3 opacity-10 pointer-events-none hidden sm:flex items-center justify-center">
            <IndianRupee className="w-72 h-72 text-white" />
          </div>
        </div>

        {/* Retailer Wallet Summary Cards (Shown to Retailer OR Admin overview) */}
        {userRole !== "Admin" && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-6">
            {/* Wallet Balance Card */}
            <Card className="bg-slate-900 border-emerald-500/50 text-slate-100 shadow-2xl relative overflow-hidden">
              <div className="h-1.5 bg-gradient-to-r from-emerald-500 to-teal-400" />
              <CardContent className="p-4 sm:p-5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="p-2 sm:p-3 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
                    <Wallet className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold text-[10px] sm:text-xs">
                    Available Balance
                  </Badge>
                </div>
                <p className="text-[11px] sm:text-xs text-slate-400 font-semibold uppercase tracking-wider">
                  Commission Wallet (బాకీ కమీషన్)
                </p>
                <p className="text-2xl sm:text-3xl font-black text-emerald-400">
                  ₹{(currentRetailerRecord?.walletBalance || 0).toLocaleString()}
                </p>
                <p className="text-[11px] text-slate-400 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Next Payout Transfer: <strong>15th & 30th</strong></span>
                </p>
              </CardContent>
            </Card>

            {/* Total Earned Card */}
            <Card className="bg-slate-900 border-amber-500/40 text-slate-100 shadow-xl relative overflow-hidden">
              <div className="h-1.5 bg-gradient-to-r from-amber-500 to-orange-500" />
              <CardContent className="p-4 sm:p-5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="p-2 sm:p-3 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
                    <ArrowUpRight className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  <Badge className="bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold text-[10px] sm:text-xs">
                    Lifetime Earned
                  </Badge>
                </div>
                <p className="text-[11px] sm:text-xs text-slate-400 font-semibold uppercase tracking-wider">
                  Total Commission Earned (మొత్తం గెలుచుకున్నది)
                </p>
                <p className="text-2xl sm:text-3xl font-black text-amber-400">
                  ₹{(currentRetailerRecord?.totalEarned || 0).toLocaleString()}
                </p>
                <p className="text-[11px] text-slate-400">
                  Total credits from Recharges, Service Complaints & New Connections.
                </p>
              </CardContent>
            </Card>

            {/* Total Paid Out Card */}
            <Card className="bg-slate-900 border-blue-500/40 text-slate-100 shadow-xl relative overflow-hidden">
              <div className="h-1.5 bg-gradient-to-r from-blue-500 to-indigo-500" />
              <CardContent className="p-4 sm:p-5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="p-2 sm:p-3 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20">
                    <ArrowDownLeft className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  <Badge className="bg-blue-500/20 text-blue-300 border border-blue-500/40 font-bold text-[10px] sm:text-xs">
                    Bank Deposited
                  </Badge>
                </div>
                <p className="text-[11px] sm:text-xs text-slate-400 font-semibold uppercase tracking-wider">
                  Total Payout Received (బ్యాంక్‌కి జమ అయినది)
                </p>
                <p className="text-2xl sm:text-3xl font-black text-blue-400">
                  ₹{(currentRetailerRecord?.totalPaid || 0).toLocaleString()}
                </p>
                <p className="text-[11px] text-slate-400">
                  Settled and transferred directly into your bank account by Admin.
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Active Published Commission Rates Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6">
          {/* Card 1: Recharge Commission */}
          <Card className="bg-slate-900 border-amber-500/40 text-slate-100 shadow-xl relative overflow-hidden">
            <div className="h-1.5 bg-gradient-to-r from-amber-500 to-orange-500" />
            <CardContent className="p-4 sm:p-5 space-y-2">
              <div className="flex items-center justify-between">
                <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
                  <Percent className="w-5 h-5" />
                </div>
                <Badge className="bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold text-[11px]">
                  Recharges
                </Badge>
              </div>
              <div>
                <p className="text-[11px] sm:text-xs text-slate-400 font-semibold uppercase">Recharge Margin (రిచార్జ్ కమీషన్)</p>
                <p className="text-xl sm:text-2xl font-black text-amber-400 mt-0.5">
                  {commissions.rechargeCommissionRate}%
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Service Request Commission */}
          <Card className="bg-slate-900 border-blue-500/40 text-slate-100 shadow-xl relative overflow-hidden">
            <div className="h-1.5 bg-gradient-to-r from-blue-500 to-cyan-500" />
            <CardContent className="p-4 sm:p-5 space-y-2">
              <div className="flex items-center justify-between">
                <div className="p-2 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20">
                  <Wrench className="w-5 h-5" />
                </div>
                <Badge className="bg-blue-500/20 text-blue-300 border border-blue-500/40 font-bold text-[11px]">
                  Service Visit
                </Badge>
              </div>
              <div>
                <p className="text-[11px] sm:text-xs text-slate-400 font-semibold uppercase">Service Request (సర్వీస్ కమీషన్)</p>
                <p className="text-xl sm:text-2xl font-black text-blue-400 mt-0.5">
                  ₹{commissions.serviceRequestCommission.toLocaleString()} <span className="text-xs text-slate-400 font-normal">/ request</span>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ADMIN PAYOUT SETTLEMENT MANAGER SECTION (Admin Only) */}
        {userRole === 'Admin' && (
          <Card className="bg-slate-900 border-emerald-500/40 text-slate-100 shadow-2xl">
            <CardHeader className="bg-gradient-to-r from-slate-900 via-emerald-950/40 to-slate-900 border-b border-slate-800 p-4 sm:p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-lg sm:text-xl font-bold text-emerald-400 flex items-center gap-2">
                    <Send className="w-5 h-5 text-emerald-400" />
                    Retailer Wallet Balances & Monthly Payouts
                  </CardTitle>
                  <CardDescription className="text-slate-400 text-xs mt-0.5">
                    Process monthly bank transfers (15th & 30th). Deducts amount from Retailer wallet.
                  </CardDescription>
                </div>
                <Badge className="bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold text-[11px] py-1 px-2.5 w-fit">
                  🗓️ Payout Cycle: 15th & 30th
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="p-3 sm:p-0">
              {/* Mobile View: Cards */}
              <div className="block sm:hidden space-y-3">
                {retailers.length > 0 ? (
                  retailers.map((rtl) => {
                    const bal = rtl.walletBalance || 0;
                    return (
                      <div key={rtl.id} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-purple-400 shrink-0" />
                            <div>
                              <span className="font-bold text-white text-sm">{rtl.retailerName}</span>
                              {rtl.contactPerson && (
                                <span className="block text-[11px] text-slate-400">Contact: {rtl.contactPerson}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-slate-400 block text-[10px]">Mobile & Area:</span>
                            <span className="font-mono font-bold text-emerald-400 text-xs">{rtl.mobile}</span>
                            <span className="block text-[11px] text-slate-400 truncate">
                              {[rtl.village, rtl.mandal].filter(Boolean).join(", ")}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-slate-400 block text-[10px]">Wallet Balance:</span>
                            <span className="font-mono font-black text-emerald-400 text-base">₹{bal.toLocaleString()}</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-[11px]">
                          <div className="text-slate-400">
                            Earned: <strong className="text-amber-400 font-mono">₹{(rtl.totalEarned || 0).toLocaleString()}</strong> | Paid: <strong className="text-blue-400 font-mono">₹{(rtl.totalPaid || 0).toLocaleString()}</strong>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => handleOpenPayout(rtl)}
                            disabled={bal <= 0}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs h-7 px-2.5"
                          >
                            <Send className="w-3 h-3 mr-1" /> Pay & Settle
                          </Button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-center py-6 text-xs text-slate-400">No DishTV retailers registered yet.</p>
                )}
              </div>

              {/* Desktop View: Table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="p-4">Retailer Name / Shop</th>
                      <th className="p-4">Mobile & Location</th>
                      <th className="p-4 text-right">Available Wallet Balance</th>
                      <th className="p-4 text-right">Lifetime Earned</th>
                      <th className="p-4 text-right">Total Deposited</th>
                      <th className="p-4 text-center">Payout Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {retailers.length > 0 ? (
                      retailers.map((rtl) => {
                        const bal = rtl.walletBalance || 0;
                        return (
                          <tr key={rtl.id} className="hover:bg-slate-800/40 transition-colors">
                            <td className="p-4 font-bold text-slate-100">
                              <div className="flex items-center gap-2">
                                <Building2 className="w-4 h-4 text-purple-400 shrink-0" />
                                <div>
                                  <span>{rtl.retailerName}</span>
                                  {rtl.contactPerson && (
                                    <span className="block text-[11px] font-normal text-slate-400">
                                      Contact: {rtl.contactPerson}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="p-4 text-slate-300">
                              <div className="flex items-center gap-1 font-mono font-bold text-emerald-400">
                                <Phone className="w-3.5 h-3.5 text-slate-400" />
                                {rtl.mobile}
                              </div>
                              <div className="text-[11px] text-slate-400">
                                {[rtl.village, rtl.mandal, rtl.district].filter(Boolean).join(", ")}
                              </div>
                            </td>
                            <td className="p-4 text-right font-mono font-black text-emerald-400 text-base">
                              ₹{bal.toLocaleString()}
                            </td>
                            <td className="p-4 text-right font-mono font-bold text-amber-400">
                              ₹{(rtl.totalEarned || 0).toLocaleString()}
                            </td>
                            <td className="p-4 text-right font-mono font-bold text-blue-400">
                              ₹{(rtl.totalPaid || 0).toLocaleString()}
                            </td>
                            <td className="p-4 text-center">
                              <Button
                                size="sm"
                                onClick={() => handleOpenPayout(rtl)}
                                disabled={bal <= 0}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs h-8 shadow"
                              >
                                <Send className="w-3.5 h-3.5 mr-1.5" /> Pay & Settle
                              </Button>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-400">
                          No DishTV retailers registered yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Content Grid: Admin Settings Form OR Retailer Guidelines + Calculator */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-8">
          
          {/* Left Column: Admin Rate Settings Form */}
          <div className="lg:col-span-3 space-y-4 sm:space-y-6">
            {userRole === 'Admin' ? (
              <Card className="bg-slate-900 border-emerald-500/50 text-slate-100 shadow-2xl">
                <CardHeader className="bg-gradient-to-r from-slate-900 via-emerald-950/40 to-slate-900 border-b border-slate-800 p-4 sm:p-5">
                  <CardTitle className="text-lg sm:text-xl font-bold text-emerald-400 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-emerald-400" />
                    Admin Control: Set & Publish Commission Rates
                  </CardTitle>
                  <CardDescription className="text-slate-400 text-xs mt-0.5">
                    Enter the exact commission values below. Updates instantly sync across all retailer logins.
                  </CardDescription>
                </CardHeader>

                <CardContent className="p-4 sm:p-6">
                  <form onSubmit={handleSaveCommissions} className="space-y-4 sm:space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      
                      {/* Recharge Rate */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                          <Percent className="w-3.5 h-3.5 text-amber-400" />
                          Recharge Margin (%)
                        </label>
                        <Input
                          type="number"
                          step="0.1"
                          placeholder="e.g. 5.0"
                          value={editRechargeRate}
                          onChange={(e) => setEditRechargeRate(Number(e.target.value))}
                          className="bg-slate-950 border-slate-700 text-amber-400 font-bold text-base h-11"
                          required
                        />
                        <p className="text-[11px] text-slate-400">Percentage per recharge</p>
                      </div>

                      {/* Service Request Rate */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                          <Wrench className="w-3.5 h-3.5 text-blue-400" />
                          Service Request (₹)
                        </label>
                        <Input
                          type="number"
                          placeholder="e.g. 50"
                          value={editServiceComm}
                          onChange={(e) => setEditServiceComm(Number(e.target.value))}
                          className="bg-slate-950 border-slate-700 text-blue-400 font-bold text-base h-11"
                          required
                        />
                        <p className="text-[11px] text-slate-400">Rupees per service request</p>
                      </div>

                    </div>

                    {/* Notes / Terms */}
                    <div className="space-y-1.5 pt-2 border-t border-slate-800">
                      <label className="text-xs font-bold text-slate-300">
                        Commission Guidelines & Terms (రిటైలర్ రూల్స్ / నిబంధనలు)
                      </label>
                      <Input
                        placeholder="e.g. Recharge commission credited instantly. Service request commissions credited upon status resolution."
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                        className="bg-slate-950 border-slate-700 text-slate-200 text-xs h-10"
                      />
                    </div>

                    <Button
                      type="submit"
                      disabled={savingSettings}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm h-11 shadow-lg"
                    >
                      {savingSettings ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving Rates...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2" /> Save & Publish Commission Rates
                        </>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            ) : (
              <Card className="bg-slate-900 border-slate-800 text-slate-100 shadow-xl">
                <CardHeader className="border-b border-slate-800 p-4 sm:p-5">
                  <CardTitle className="text-base sm:text-lg font-bold text-slate-200 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-emerald-400" />
                    Official Retailer Policy & Payout Guidelines
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 sm:p-5 space-y-3 sm:space-y-4 text-xs text-slate-300">
                  <div className="p-3.5 sm:p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                    <h4 className="font-bold text-amber-400 text-xs sm:text-sm flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-amber-400" />
                      Monthly Payout Cycle (15th & 30th)
                    </h4>
                    <p className="text-slate-300 leading-relaxed text-[11px] sm:text-xs">
                      {commissions.notes || DEFAULT_COMMISSIONS.notes}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column: Live Recharge Commission & Net Admin Payment Calculator */}
          <div className="lg:col-span-2">
            <Card className="bg-slate-900 border-amber-500/40 text-slate-100 shadow-2xl sticky top-6">
              <CardHeader className="bg-slate-950 border-b border-slate-800 p-4">
                <CardTitle className="text-base sm:text-lg font-bold text-amber-400 flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-amber-400" />
                  Recharge Commission Calculator
                </CardTitle>
                <CardDescription className="text-slate-400 text-xs mt-0.5">
                  Enter recharge amount to calculate instant commission margin and net payable amount to Admin.
                </CardDescription>
              </CardHeader>

              <CardContent className="p-4 sm:p-5 space-y-4">
                {/* Recharge Volume Input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">
                    Enter Recharge Amount / Value (రిచార్జ్ అమౌంట్ ₹)
                  </label>
                  <Input
                    type="number"
                    placeholder="e.g. 1000"
                    value={calcRechargeVol || ""}
                    onChange={(e) => setCalcRechargeVol(Number(e.target.value) || 0)}
                    className="bg-slate-950 border-slate-700 text-amber-400 font-bold text-lg h-12"
                  />
                </div>

                {/* Calculated Breakdown Box */}
                <div className="bg-slate-950 p-3.5 sm:p-4 rounded-xl border border-slate-800 space-y-2.5 text-xs mt-2">
                  <div className="flex justify-between items-center text-slate-400 text-[11px] sm:text-xs">
                    <span>Commission Margin Rate:</span>
                    <Badge className="bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold text-[10px] sm:text-xs">
                      {commissions.rechargeCommissionRate}%
                    </Badge>
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t border-slate-800/80 text-slate-300 text-[11px] sm:text-xs">
                    <span>Retailer Commission Earned (మీ కమీషన్):</span>
                    <span className="font-bold text-emerald-400 text-xs sm:text-sm">
                      + ₹{((calcRechargeVol * commissions.rechargeCommissionRate) / 100).toLocaleString()}
                    </span>
                  </div>

                  <div className="flex flex-col pt-2.5 border-t border-slate-800 text-xs sm:text-sm font-bold bg-slate-900/60 p-3 rounded-lg border border-amber-500/30">
                    <span className="text-amber-400 text-[10px] sm:text-xs font-semibold uppercase tracking-wider">
                      Net Amount Payable to Admin (అడ్మిన్‌కు పంపించాల్సిన అమౌంట్):
                    </span>
                    <span className="text-cyan-400 text-lg sm:text-xl font-black mt-0.5">
                      ₹{Math.max(0, calcRechargeVol - (calcRechargeVol * commissions.rechargeCommissionRate) / 100).toLocaleString()}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

        </div>

        {/* COMMISSION TRANSACTIONS HISTORY TABLE SECTION */}
        <Card className="bg-slate-900 border-slate-800 text-slate-100 shadow-2xl">
          <CardHeader className="bg-slate-950 border-b border-slate-800 p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-lg sm:text-xl font-bold text-amber-400 flex items-center gap-2">
                  <History className="w-5 h-5 text-amber-400" />
                  Commission Credits & Payout History
                </CardTitle>
                <CardDescription className="text-slate-400 text-xs mt-0.5">
                  Live audit log of all auto-credited service request commissions and bank transfer payouts.
                </CardDescription>
              </div>

              {/* Search Bar */}
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <Input
                  placeholder="Search retailer, category, UTR..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  className="pl-9 bg-slate-900 border-slate-700 h-9 text-xs"
                />
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-3 sm:p-0">
            {/* Mobile View: Cards */}
            <div className="block sm:hidden space-y-3">
              {filteredTransactions.length > 0 ? (
                filteredTransactions.map((tx) => {
                  const isCredit = tx.type === "Credit" || (tx.type !== "Payout Debit" && !tx.type?.includes("Debit"));
                  const dateStr = tx.createdAt?.seconds
                    ? new Date(tx.createdAt.seconds * 1000).toLocaleString("en-IN", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })
                    : "Just now";

                  return (
                    <div key={tx.id} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between text-[11px] border-b border-slate-800 pb-2">
                        <span className="font-mono text-slate-400">{dateStr}</span>
                        <div className="flex items-center gap-1.5">
                          {isCredit ? (
                            <Badge className="bg-emerald-950 text-emerald-300 border-emerald-800 font-bold text-[10px]">
                              + CREDIT
                            </Badge>
                          ) : (
                            <Badge className="bg-rose-950 text-rose-300 border-rose-800 font-bold text-[10px]">
                              - PAYOUT DEBIT
                            </Badge>
                          )}
                          <span className={`font-bold font-mono text-xs text-right ${isCredit ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {isCredit ? `+₹${tx.amount.toLocaleString()}` : `-₹${tx.amount.toLocaleString()}`}
                          </span>
                        </div>
                      </div>

                      {userRole === "Admin" && (
                        <p className="text-xs font-bold text-white">Retailer: {tx.retailerName} {tx.retailerMobile && `(${tx.retailerMobile})`}</p>
                      )}

                      <p className="text-xs font-semibold text-slate-200">{tx.description}</p>

                      {/* Customer Details Display with Fallback */}
                      {(() => {
                        let name = tx.customerName || "";
                        let mobile = tx.customerMobile || "";
                        let address = tx.customerAddress || "";
                        let vc = tx.vcNumber || "";

                        if (!name && tx.description) {
                          if (tx.description.includes("Service Request Resolved:")) {
                            const m = tx.description.match(/Service Request Resolved:\s*([^(]+)/);
                            if (m) name = m[1].trim();
                          } else if (tx.description.includes("New Connection Installed:")) {
                            const m = tx.description.match(/for\s+(.+)$/);
                            if (m) name = m[1].trim();
                          } else if (tx.description.includes("New Connection Completed:")) {
                            const m = tx.description.match(/New Connection Completed:\s*([^(]+)/);
                            if (m) name = m[1].trim();
                          }
                        }

                        if (!address && tx.description) {
                          const locMatch = tx.description.match(/\(([^)]+)\)/);
                          if (locMatch && !locMatch[1].includes("STB") && !locMatch[1].includes("DishTV") && !locMatch[1].includes("Retailer Margin")) {
                            address = locMatch[1].trim();
                          }
                        }

                        if (!name && !mobile && !address && !vc) return null;

                        return (
                          <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 space-y-1 text-[11px]">
                            <div className="flex items-center gap-1.5 text-emerald-400 font-bold flex-wrap">
                              {name && <span>👤 {name}</span>}
                              {mobile && <span className="text-slate-300 font-mono">📱 {mobile}</span>}
                              {vc && (
                                <Badge className="bg-amber-950/80 text-amber-300 border-amber-800 text-[10px] py-0 px-1 font-mono">
                                  VC: {vc}
                                </Badge>
                              )}
                            </div>
                            {address && (
                              <div className="text-slate-400 flex items-center gap-1 text-[10px]">
                                <MapPin className="w-3 h-3 text-amber-400 shrink-0" />
                                <span>{address}</span>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {tx.utrReference && tx.utrReference !== "N/A" && (
                        <div className="text-[10px] font-mono text-cyan-400">
                          UTR/Ref: <strong>{tx.utrReference}</strong> ({tx.payoutMethod || "Bank Transfer"})
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <p className="text-center py-6 text-xs text-slate-400">No transactions found.</p>
              )}
            </div>

            {/* Desktop View: Table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="p-4">Date & Time</th>
                    {userRole === "Admin" && <th className="p-4">Retailer Name</th>}
                    <th className="p-4">Type & Category</th>
                    <th className="p-4">Description & Ref</th>
                    <th className="p-4 text-right">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredTransactions.length > 0 ? (
                    filteredTransactions.map((tx) => {
                      const isCredit = tx.type === "Credit" || (tx.type !== "Payout Debit" && !tx.type?.includes("Debit"));
                      const dateStr = tx.createdAt?.seconds
                        ? new Date(tx.createdAt.seconds * 1000).toLocaleString("en-IN", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })
                        : "Just now";

                      return (
                        <tr key={tx.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="p-4 text-slate-300 font-mono text-[11px]">
                            {dateStr}
                          </td>
                          {userRole === "Admin" && (
                            <td className="p-4 font-bold text-slate-100">
                              {tx.retailerName}
                              {tx.retailerMobile && (
                                <span className="block text-[11px] font-mono text-emerald-400 font-normal">
                                  📱 {tx.retailerMobile}
                                </span>
                              )}
                            </td>
                          )}
                          <td className="p-4">
                            <div className="flex items-center gap-1.5">
                              {isCredit ? (
                                <Badge className="bg-emerald-950 text-emerald-300 border-emerald-800 font-bold text-[10px]">
                                  + CREDIT
                                </Badge>
                              ) : (
                                <Badge className="bg-rose-950 text-rose-300 border-rose-800 font-bold text-[10px]">
                                  - PAYOUT DEBIT
                                </Badge>
                              )}
                              <span className="text-slate-300 font-medium text-[11px]">{tx.category}</span>
                            </div>
                          </td>
                          <td className="p-4 text-slate-300 max-w-md">
                            <div className="font-semibold text-slate-100">{tx.description}</div>

                            {/* Customer Details Display with Fallback */}
                            {(() => {
                              let name = tx.customerName || "";
                              let mobile = tx.customerMobile || "";
                              let address = tx.customerAddress || "";
                              let vc = tx.vcNumber || "";

                              if (!name && tx.description) {
                                if (tx.description.includes("Service Request Resolved:")) {
                                  const m = tx.description.match(/Service Request Resolved:\s*([^(]+)/);
                                  if (m) name = m[1].trim();
                                } else if (tx.description.includes("New Connection Installed:")) {
                                  const m = tx.description.match(/for\s+(.+)$/);
                                  if (m) name = m[1].trim();
                                } else if (tx.description.includes("New Connection Completed:")) {
                                  const m = tx.description.match(/New Connection Completed:\s*([^(]+)/);
                                  if (m) name = m[1].trim();
                                }
                              }

                              if (!address && tx.description) {
                                const locMatch = tx.description.match(/\(([^)]+)\)/);
                                if (locMatch && !locMatch[1].includes("STB") && !locMatch[1].includes("DishTV") && !locMatch[1].includes("Retailer Margin")) {
                                  address = locMatch[1].trim();
                                }
                              }

                              if (!name && !mobile && !address && !vc) return null;

                              return (
                                <div className="mt-1.5 p-2.5 rounded-xl bg-slate-950/90 border border-slate-800 space-y-1 text-xs">
                                  <div className="flex items-center gap-2 text-emerald-400 font-bold flex-wrap">
                                    {name && <span>👤 Customer: {name}</span>}
                                    {mobile && (
                                      <span className="text-slate-300 font-mono font-medium">📱 {mobile}</span>
                                    )}
                                    {vc && (
                                      <Badge className="bg-amber-950/80 text-amber-300 border-amber-800 text-[10px] py-0 px-1.5 font-mono">
                                        VC: {vc}
                                      </Badge>
                                    )}
                                  </div>
                                  {address && (
                                    <div className="text-slate-400 flex items-center gap-1 text-[11px]">
                                      <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                      <span>{address}</span>
                                    </div>
                                  )}
                                </div>
                              );
                            })()}

                            {tx.utrReference && tx.utrReference !== "N/A" && (
                              <div className="text-[11px] font-mono text-cyan-400 mt-1">
                                UTR/Ref: <strong>{tx.utrReference}</strong> ({tx.payoutMethod || "Bank Transfer"})
                              </div>
                            )}
                          </td>
                          <td className={`p-4 text-right font-mono font-black text-sm ${isCredit ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {isCredit ? `+₹${tx.amount.toLocaleString()}` : `-₹${tx.amount.toLocaleString()}`}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={userRole === "Admin" ? 5 : 4} className="p-8 text-center text-slate-400">
                        No commission credit or payout transactions found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* Admin Payout Settlement Modal Dialog */}
      {userRole === 'Admin' && (
        <Dialog open={isPayoutModalOpen} onOpenChange={setIsPayoutModalOpen}>
          <DialogContent className="bg-slate-900 text-slate-100 border-slate-800 max-w-md">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-emerald-400 flex items-center gap-2">
                <Send className="w-5 h-5 text-emerald-400" />
                Settle Payout & Deduct Wallet
              </DialogTitle>
              <DialogDescription className="text-slate-400 text-xs">
                Process monthly bank transfer for {selectedRetailer?.retailerName}.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleConfirmPayout} className="space-y-4 py-2">
              {/* Selected Retailer Preview */}
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex justify-between items-center text-xs">
                <div>
                  <span className="text-slate-400 block">Retailer Partner:</span>
                  <strong className="text-slate-100 text-sm">{selectedRetailer?.retailerName}</strong>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 block">Available Balance:</span>
                  <strong className="text-emerald-400 font-mono text-base font-black">
                    ₹{(selectedRetailer?.walletBalance || 0).toLocaleString()}
                  </strong>
                </div>
              </div>

              {/* Payout Amount */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">
                  Payout Deposit Amount (₹) *
                </label>
                <Input
                  type="number"
                  placeholder="e.g. 500"
                  value={payoutAmount}
                  onChange={(e) => setPayoutAmount(Number(e.target.value))}
                  className="bg-slate-950 border-slate-700 text-emerald-400 font-bold text-base h-11"
                  required
                />
              </div>

              {/* Payment Method */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Deposit Payment Method</label>
                <Select value={payoutMethod} onValueChange={setPayoutMethod}>
                  <SelectTrigger className="bg-slate-950 border-slate-700 text-slate-200 h-10 text-xs">
                    <SelectValue placeholder="Select Method" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                    <SelectItem value="Bank Account Deposit">Bank Account Transfer (NEFT/IMPS)</SelectItem>
                    <SelectItem value="UPI Transfer">UPI / GPay / PhonePe</SelectItem>
                    <SelectItem value="Cash">Direct Cash Handover</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Bank UTR / Reference */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Bank UTR / Transaction Reference ID</label>
                <Input
                  placeholder="e.g. UTR19827364523"
                  value={utrReference}
                  onChange={(e) => setUtrReference(e.target.value)}
                  className="bg-slate-950 border-slate-700 text-slate-200 text-xs h-10 font-mono"
                />
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Payout Notes / Remarks</label>
                <Input
                  placeholder="e.g. Monthly payout cycle 15th/30th deposit"
                  value={payoutNotes}
                  onChange={(e) => setPayoutNotes(e.target.value)}
                  className="bg-slate-950 border-slate-700 text-slate-200 text-xs h-10"
                />
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="submit"
                  disabled={isProcessingPayout}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm h-11"
                >
                  {isProcessingPayout ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing Payout...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-2" /> Confirm Deposit & Deduct Wallet
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

    </main>
  );
}
