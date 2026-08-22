
"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Users, Package, CircleDollarSign, UserCheck, ShieldCheck, IndianRupee, Wallet, ArrowRight, ArrowLeftRight, CheckCircle2, Loader2, Search, HandCoins, CreditCard, Gift, Send, XCircle, Tv, MapPin, History, Phone, Building2, Wrench, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { db } from "@/lib/firebase";
import { collection, addDoc, onSnapshot, doc, getDoc, updateDoc, query, where, getDocs, Timestamp, writeBatch, deleteDoc, runTransaction } from "firebase/firestore";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { AP_LOCATIONS } from "@/lib/apLocations";
import PaymentSuccessReceiptModal, { ReceiptData } from "@/components/PaymentSuccessReceiptModal";

interface SettlementRequest {
  id: string;
  staffName: string;
  staffId: string;
  amount: number;
  commission: number;
  amountToSend: number;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  createdAt: Timestamp;
}

interface RechargeRequest {
    id: string;
    customerName: string;
    packageName: string;
    packageAmount: number;
    months?: number;
    status: 'Pending' | 'Completed';
    requestDate: Timestamp;
    customerId: string;
    adminId: string;
    type: 'Auto' | 'Manual' | 'Staff';
    requestSubtype?: 'Renewal' | 'Recharge';
    customerDetails?: {
        mobile: string;
        customerId: string;
        balanceAmount: number;
    }
}

interface DashboardStats {
    totalRevenue: number;
    activeCustomers: number;
    activePackages: number;
    collectionAgents: number;
    todaysCollection: number;
    monthlyCollection: number;
    totalPending: number;
}

interface StaffData {
    id: string;
    name: string;
    commission: string;
    enrollmentCommission?: number;
    collectionLimit?: number;
    adminId: string;
    area: string[];
    role: string;
    status?: 'active' | 'inactive';
}

interface Customer {
  id: string;
  name: string;
  balanceAmount: number;
  mobile: string;
  customerId: string;
  area: string;
  stbId: string;
  expiryDate?: Timestamp;
  lastRechargeDate?: Timestamp;
  connectionReference?: string;
  monthlyCommission?: string;
  createdAt: Timestamp;
  userId: string;
}

interface RechargePackage {
  id: string;
  packageName: string;
  packageAmount: string;
}

interface RechargeOffer {
  id: string;
  months: number;
  discountPercentage: number;
}

interface Recharge {
    id: string;
    customerId: string;
    amount: number;
    rechargeDate: Timestamp;
}

interface Complaint {
  id: string;
  customerName: string;
  stbId: string;
  complaint: string;
}

interface DishTvCustomer {
  id: string;
  name: string;
  mobile: string;
  vcNumber?: string;
  subscriberId?: string;
  packagePlan?: string;
  monthlyAmount?: number;
  threeMonthAmount?: number;
  sixMonthAmount?: number;
  twelveMonthAmount?: number;
  balanceAmount?: number;
  status: "Active" | "Expired" | "Suspended";
  expiryDate?: Timestamp | null;
  address?: string;
  village?: string;
  mandal?: string;
  district?: string;
  area?: string;
  userId?: string;
  dealerId?: string;
  dealerName?: string;
}

const notificationSound = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";

export default function DashboardPage() {
  const { user: currentUser, userRole, shopName, userStatus, loading: authLoading } = useAuth();
  const [isSettleDialogOpen, setIsSettleDialogOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [receiptModalData, setReceiptModalData] = useState<ReceiptData | null>(null);
  const { toast } = useToast();
  const [commissionReceived, setCommissionReceived] = useState(false);
  const [settlementAmount, setSettlementAmount] = useState("");
  const [settlementRequests, setSettlementRequests] = useState<SettlementRequest[]>([]);
  const [rechargeRequests, setRechargeRequests] = useState<RechargeRequest[]>([]);
  const [firestoreLoading, setFirestoreLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
      totalRevenue: 0,
      activeCustomers: 0,
      activePackages: 0,
      collectionAgents: 0,
      todaysCollection: 0,
      monthlyCollection: 0,
      totalPending: 0,
  });
  const [staffWallet, setStaffWallet] = useState({ walletAmount: 0, commissionAmount: 0 });
  const [allPayments, setAllPayments] = useState<any[]>([]);
  const [staffData, setStaffData] = useState<StaffData | null>(null);
  const [dealerName, setDealerName] = useState("");
  const [dealerStats, setDealerStats] = useState({ total: 0, active: 0, expired: 0, monthlyRev: 0, totalOutstanding: 0 });
  const [totalPendingForStaff, setTotalPendingForStaff] = useState(0);
  const [todaysCollectionForStaff, setTodaysCollectionForStaff] = useState(0);
  const [pendingComplaints, setPendingComplaints] = useState<Complaint[]>([]);

  // Top Universal Customer Search State
  const [topSearchTerm, setTopSearchTerm] = useState("");
  const [activeSearchQuery, setActiveSearchQuery] = useState("");
  const [allDishTvCustomers, setAllDishTvCustomers] = useState<DishTvCustomer[]>([]);
  const [dbPackageMap, setDbPackageMap] = useState<Record<string, { m: number; t3: number; t6: number; t12: number }>>({});


  // States for Customer Search Dialog (Collections)
  const [isCustomerSearchDialogOpen, setIsCustomerSearchDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchedCustomer, setSearchedCustomer] = useState<Customer | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  // States for Collection Dialog
  const [isCollectDialogOpen, setIsCollectDialogOpen] = useState(false);
  const [amountCollected, setAmountCollected] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");

  // States for Recharge Dialog
  const [isRechargeSearchDialogOpen, setIsRechargeSearchDialogOpen] = useState(false);
  const [isRechargeDialogOpen, setIsRechargeDialogOpen] = useState(false);
  const [packages, setPackages] = useState<RechargePackage[]>([]);
  const [rechargeOffers, setRechargeOffers] = useState<RechargeOffer[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const [paymentReceivedForRecharge, setPaymentReceivedForRecharge] = useState(false);
  const [rechargeMonths, setRechargeMonths] = useState(1);

  // States for Add Extra Service Charge Dialog
  const [isServiceDialogOpen, setIsServiceDialogOpen] = useState(false);
  const [serviceCustomer, setServiceCustomer] = useState<DishTvCustomer | null>(null);
  const [serviceType, setServiceType] = useState("Cable Shift / Relocation");
  const [serviceAmount, setServiceAmount] = useState("250");
  const [serviceNotes, setServiceNotes] = useState("");
  const [isSavingService, setIsSavingService] = useState(false);

  // States for Service Request Dialog Modal
  const [isServiceRequestOpen, setIsServiceRequestOpen] = useState(false);
  const [srCustomerName, setSrCustomerName] = useState("");
  const [srMobile, setSrMobile] = useState("");
  const [srDistrict, setSrDistrict] = useState("");
  const [srMandal, setSrMandal] = useState("");
  const [srVillage, setSrVillage] = useState("");
  const [srDthCompany, setSrDthCompany] = useState("DishTV");
  const [srComplaintType, setSrComplaintType] = useState("Signal Issue");
  const [srScheduledDate, setSrScheduledDate] = useState("");
  const [srScheduledTime, setSrScheduledTime] = useState("Morning (9 AM - 12 PM)");
  const [srNotes, setSrNotes] = useState("");
  const [isSubmittingSR, setIsSubmittingSR] = useState(false);

  // States for New Connection Booking Dialog
  const [isNewConnOpen, setIsNewConnOpen] = useState(false);
  const [ncCustomerName, setNcCustomerName] = useState("");
  const [ncMobile, setNcMobile] = useState("");
  const [ncDistrict, setNcDistrict] = useState("");
  const [ncMandal, setNcMandal] = useState("");
  const [ncVillage, setNcVillage] = useState("");
  const [ncLandmark, setNcLandmark] = useState("");
  const [ncScheduledDate, setNcScheduledDate] = useState("");
  const [ncScheduledTime, setNcScheduledTime] = useState("Morning (9 AM - 12 PM)");
  const [isSubmittingNC, setIsSubmittingNC] = useState(false);

  const [liveServiceRequests, setLiveServiceRequests] = useState<any[]>([]);
  const [liveNewConnections, setLiveNewConnections] = useState<any[]>([]);
  const [liveRechargeRequests, setLiveRechargeRequests] = useState<any[]>([]);
  const [retailersList, setRetailersList] = useState<any[]>([]);
  const [processingRechargeId, setProcessingRechargeId] = useState<string | null>(null);

  // States for Customer Offer Recharge Request Dialog Modal
  const [isOfferRechargeModalOpen, setIsOfferRechargeModalOpen] = useState(false);
  const [rechargeModalCustomer, setRechargeModalCustomer] = useState<DishTvCustomer | null>(null);
  const [selectedOfferMonths, setSelectedOfferMonths] = useState<number>(1);
  const [selectedOfferAmount, setSelectedOfferAmount] = useState<number>(0);
  const [rechargeUtrNumber, setRechargeUtrNumber] = useState<string>("");
  const [isSubmittingRechargeReq, setIsSubmittingRechargeReq] = useState<boolean>(false);
  const [rechargeUtrError, setRechargeUtrError] = useState<string>("");

  const handleOpenOfferRecharge = (cust: DishTvCustomer, months: number, amount: number) => {
    setRechargeModalCustomer(cust);
    setSelectedOfferMonths(months);
    setSelectedOfferAmount(amount);
    setRechargeUtrNumber("");
    setRechargeUtrError("");
    setIsOfferRechargeModalOpen(true);
  };

  const handleSubmitOfferRechargeRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rechargeModalCustomer || !currentUser) return;

    const trimmedUtr = rechargeUtrNumber.trim();
    if (!trimmedUtr) {
      setRechargeUtrError("దయచేసి 12 అంకెల UPI UTR నంబర్‌ను ఎంటర్ చేయండి. (Please enter UTR Number)");
      return;
    }

    setIsSubmittingRechargeReq(true);
    setRechargeUtrError("");

    try {
      // 1. Check if UTR is ALREADY used in recharge_requests collection
      const q1 = query(collection(db, "recharge_requests"), where("utrNumber", "==", trimmedUtr));
      const snap1 = await getDocs(q1);

      // 2. Check if UTR is ALREADY used in commission_transactions collection
      const q2 = query(collection(db, "commission_transactions"), where("utrReference", "==", trimmedUtr));
      const snap2 = await getDocs(q2);

      // 3. Check if UTR is ALREADY used in dishtv_recharges collection
      const q3 = query(collection(db, "dishtv_recharges"), where("utrNumber", "==", trimmedUtr));
      const snap3 = await getDocs(q3);

      if (!snap1.empty || !snap2.empty || !snap3.empty) {
        setRechargeUtrError("❌ ఈ UTR నంబర్ ఇప్పటికే ఉపయోగించబడింది! ఒకసారి వాడిన UTR మరలా ఎంటర్ చేయడం అనుమతించబడదు. (This UTR Number has already been used! UTRs must be unique)");
        setIsSubmittingRechargeReq(false);
        return;
      }

      const fullAddr = getFullCustomerAddress(rechargeModalCustomer);

      // 4. Create document in recharge_requests collection
      await addDoc(collection(db, "recharge_requests"), {
        customerId: rechargeModalCustomer.id,
        customerName: rechargeModalCustomer.name,
        vcNumber: rechargeModalCustomer.vcNumber || "",
        mobile: rechargeModalCustomer.mobile || "",
        village: rechargeModalCustomer.village || "",
        mandal: rechargeModalCustomer.mandal || "",
        district: rechargeModalCustomer.district || "",
        fullAddress: fullAddr,
        packagePlan: rechargeModalCustomer.packagePlan || "Standard Plan",
        durationMonths: selectedOfferMonths,
        amount: selectedOfferAmount,
        utrNumber: trimmedUtr,
        paymentMethod: "UPI",
        status: "Pending",
        requestedByUid: currentUser.uid,
        requestedByName: currentUser.displayName || currentUser.email || shopName || "Retailer Partner",
        requestedByRole: userRole || "Retailer",
        createdAt: Timestamp.now(),
      });

      toast({
        title: "✅ Recharge Request Sent to Admin! 🚀",
        description: `Request for ${rechargeModalCustomer.name} (${selectedOfferMonths} Month - ₹${selectedOfferAmount}) submitted with UTR: ${trimmedUtr}.`,
      });

      setIsOfferRechargeModalOpen(false);
      setRechargeUtrNumber("");
    } catch (err) {
      console.error("Failed to submit recharge request:", err);
      toast({
        variant: "destructive",
        title: "Submission Failed",
        description: "Could not submit recharge request. Please try again.",
      });
    } finally {
      setIsSubmittingRechargeReq(false);
    }
  };

  // 24-hour auto-prune filter for completed Service Requests and New Connections
  const visibleNewConnections = useMemo(() => {
    const now = Date.now();
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
    return liveNewConnections.filter((nc: any) => {
      if (nc.status === "Completed" || nc.status === "Installed") {
        const timeMs = nc.completedAt?.toMillis
          ? nc.completedAt.toMillis()
          : nc.updatedAt?.toMillis
          ? nc.updatedAt.toMillis()
          : nc.createdAt?.toMillis
          ? nc.createdAt.toMillis()
          : null;
        if (timeMs && (now - timeMs > TWENTY_FOUR_HOURS)) {
          return false;
        }
      }
      return true;
    });
  }, [liveNewConnections]);

  const visibleServiceRequests = useMemo(() => {
    const now = Date.now();
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
    return liveServiceRequests.filter((req: any) => {
      if (req.status === "Resolved" || req.status === "Completed") {
        const timeMs = req.completedAt?.toMillis
          ? req.completedAt.toMillis()
          : req.resolvedAt?.toMillis
          ? req.resolvedAt.toMillis()
          : req.updatedAt?.toMillis
          ? req.updatedAt.toMillis()
          : req.createdAt?.toMillis
          ? req.createdAt.toMillis()
          : null;
        if (timeMs && (now - timeMs > TWENTY_FOUR_HOURS)) {
          return false;
        }
      }
      return true;
    });
  }, [liveServiceRequests]);

  const visibleRechargeRequests = useMemo(() => {
    const now = Date.now();
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
    return liveRechargeRequests.filter((req: any) => {
      if (req.status === "Completed" || req.status === "Approved" || req.status === "Rejected") {
        const timeMs = req.completedAt?.toMillis
          ? req.completedAt.toMillis()
          : req.updatedAt?.toMillis
          ? req.updatedAt.toMillis()
          : req.createdAt?.toMillis
          ? req.createdAt.toMillis()
          : null;
        if (timeMs && (now - timeMs > TWENTY_FOUR_HOURS)) {
          return false;
        }
      }
      return true;
    });
  }, [liveRechargeRequests]);

  // Admin Approve & Complete DishTV Recharge Request Logic
  const handleApproveDishTvRecharge = async (reqItem: any) => {
    if (!currentUser) return;
    setProcessingRechargeId(reqItem.id);

    try {
      // 1. Get Retailer Commission Rate from settings/retailer_commissions
      let commRate = 5.0; // default fallback 5%
      try {
        const commSnap = await getDoc(doc(db, "settings", "retailer_commissions"));
        if (commSnap.exists()) {
          const commData = commSnap.data();
          if (commData.rechargeCommissionRate !== undefined) {
            commRate = Number(commData.rechargeCommissionRate);
          }
        }
      } catch (e) {
        console.warn("Could not read retailer_commissions settings, using default 5%:", e);
      }

      // 2. Calculate Retailer Commission
      const rechargeAmount = Number(reqItem.amount) || 0;
      const commissionEarned = Math.round((rechargeAmount * commRate) / 100 * 100) / 100; // 2 decimal places

      // 3. Find retailer in dishtv_retailers
      let matchedRetailerDocId: string | null = null;
      let matchedRetailerData: any = null;

      const rSnap = await getDocs(collection(db, "dishtv_retailers"));
      rSnap.forEach((d) => {
        const data = d.data();
        if (data.userId === reqItem.requestedByUid || data.uid === reqItem.requestedByUid || data.email === reqItem.requestedByEmail) {
          matchedRetailerDocId = d.id;
          matchedRetailerData = data;
        }
      });

      // 4. Update Retailer's Wallet if retailer found
      if (matchedRetailerDocId && matchedRetailerData) {
        const currentBal = Number(matchedRetailerData.walletBalance) || 0;
        const currentTotal = Number(matchedRetailerData.totalEarned) || 0;
        const newBal = currentBal + commissionEarned;
        const newTotal = currentTotal + commissionEarned;

        await updateDoc(doc(db, "dishtv_retailers", matchedRetailerDocId), {
          walletBalance: newBal,
          totalEarned: newTotal,
          updatedAt: Timestamp.now(),
        });
      }

      // 5. Create Commission Transaction Record (+ CREDIT)
      await addDoc(collection(db, "commission_transactions"), {
        retailerId: reqItem.requestedByUid || "",
        retailerUid: reqItem.requestedByUid || "",
        retailerName: reqItem.requestedByName || "Retailer Partner",
        type: "Credit",
        category: "Recharge",
        amount: commissionEarned,
        rechargeAmount: rechargeAmount,
        rechargeCommissionRate: commRate,
        utrReference: reqItem.utrNumber || "",
        customerId: reqItem.customerId || "",
        customerName: reqItem.customerName || "",
        vcNumber: reqItem.vcNumber || "",
        customerMobile: reqItem.mobile || "",
        customerAddress: reqItem.fullAddress || reqItem.village || "",
        description: `DishTV Recharge Completed: ${reqItem.customerName} (VC: ${reqItem.vcNumber}) - ${reqItem.durationMonths || 1} Month(s) [${commRate}% Commission Margin]`,
        createdAt: Timestamp.now(),
      });

      // 6. Update recharge_requests document to Completed
      await updateDoc(doc(db, "recharge_requests", reqItem.id), {
        status: "Completed",
        commissionEarned: commissionEarned,
        commissionRate: commRate,
        approvedByUid: currentUser.uid,
        approvedByName: currentUser.displayName || currentUser.email || "Admin",
        completedAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      // 7. Update customer balance in dishtv_customers if available
      if (reqItem.customerId) {
        try {
          const custRef = doc(db, "dishtv_customers", reqItem.customerId);
          const custSnap = await getDoc(custRef);
          if (custSnap.exists()) {
            const cData = custSnap.data();
            const currBal = Number(cData.balanceAmount) || 0;
            const newBal = Math.max(0, currBal - rechargeAmount);
            await updateDoc(custRef, {
              balanceAmount: newBal,
              status: "Active",
              lastRechargeAmount: rechargeAmount,
              lastRechargeDate: Timestamp.now(),
            });
          }
        } catch (errCust) {
          console.warn("Could not update customer balance:", errCust);
        }
      }

      toast({
        title: "✅ Recharge Completed & Commission Credited! 💰",
        description: `Recharge for ${reqItem.customerName} (₹${rechargeAmount}) approved. Credited ₹${commissionEarned} (${commRate}%) to ${reqItem.requestedByName}'s wallet.`,
      });
    } catch (err) {
      console.error("Failed to approve recharge request:", err);
      toast({
        variant: "destructive",
        title: "Approval Failed",
        description: "Could not approve recharge request.",
      });
    } finally {
      setProcessingRechargeId(null);
    }
  };

  const handleRejectDishTvRecharge = async (reqId: string) => {
    if (!currentUser) return;
    setProcessingRechargeId(reqId);
    try {
      await updateDoc(doc(db, "recharge_requests", reqId), {
        status: "Rejected",
        rejectedByUid: currentUser.uid,
        updatedAt: Timestamp.now(),
      });
      toast({
        title: "Recharge Request Rejected",
        description: "The recharge request has been marked as rejected.",
      });
    } catch (err) {
      console.error("Failed to reject recharge request:", err);
    } finally {
      setProcessingRechargeId(null);
    }
  };

  // For notification sound
  const audioRef = useRef<HTMLAudioElement>(null);
  const prevRequestCount = useRef(0);
  const isInitialMount = useRef(true);
  const [highlightNewRequest, setHighlightNewRequest] = useState(false);
  const hasInteracted = useRef(false);


  useEffect(() => {
    if (authLoading) return;
    if (!currentUser) {
      setFirestoreLoading(false);
      return;
    }
    
    setFirestoreLoading(true);
    let allUnsubscribes: (() => void)[] = [];

    const fetchAdminData = async () => {
        try {
            const customersQuery = query(collection(db, "customers"), where("userId", "==", currentUser.uid));
            const packagesQuery = query(collection(db, "packages"), where("userId", "==", currentUser.uid));
            const staffQuery = query(collection(db, "staff"), where("adminId", "==", currentUser.uid));
            const rechargeOffersQuery = query(collection(db, "rechargeOffers"), where("userId", "==", currentUser.uid));

            const [customersSnapshot, packagesSnapshot, staffSnapshot] = await Promise.all([
                getDocs(customersQuery),
                getDocs(packagesQuery),
                getDocs(staffQuery),
            ]);
            
            const customersData = customersSnapshot.docs.map(doc => ({id: doc.id, ...doc.data() as Omit<Customer, 'id'>}));
            const customerMap = new Map(customersData.map(c => [c.id, c]));

            const totalPending = customersSnapshot.docs.reduce((sum, doc) => sum + (doc.data().balanceAmount || 0), 0);

            setStats(prevStats => ({
                ...prevStats,
                activeCustomers: customersSnapshot.size,
                activePackages: packagesSnapshot.size,
                collectionAgents: staffSnapshot.size,
                totalPending: totalPending,
            }));

            const settlementsQuery = query(collection(db, "settlements"), where("adminId", "==", currentUser.uid));
            const rechargeRequestQuery = query(collection(db, "rechargeRequests"), where("adminId", "==", currentUser.uid), where("status", "==", "Pending"));
            const paymentsQuery = query(collection(db, "payments"), where("adminId", "==", currentUser.uid));
            
            const unsubscribeSettlements = onSnapshot(settlementsQuery, (snapshot) => {
                const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SettlementRequest));
                requests.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
                setSettlementRequests(requests);
            });
            const unsubscribeRechargeRequests = onSnapshot(rechargeRequestQuery, (snapshot) => {
                const requests = snapshot.docs.map(doc => {
                    const reqData = doc.data() as Omit<RechargeRequest, 'id' | 'customerDetails'>;
                    const customer = customerMap.get(reqData.customerId);
                    return {
                        id: doc.id,
                        ...reqData,
                        customerDetails: customer ? { mobile: customer.mobile, customerId: customer.customerId, balanceAmount: customer.balanceAmount } : undefined
                    };
                });
                requests.sort((a,b) => b.requestDate.toMillis() - a.requestDate.toMillis());
                setRechargeRequests(requests);
            });
             const unsubscribePayments = onSnapshot(paymentsQuery, (snapshot) => {
                 const now = new Date();
                 const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                 const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
 
                 let todaysCollection = 0;
                 let monthlyCollection = 0;
 
                 const paymentsList = snapshot.docs.map(doc => doc.data());
                 setAllPayments(paymentsList);
 
                 paymentsList.forEach(payment => {
                     const paymentDate = payment.collectionDate.toDate();
 
                     if (paymentDate >= monthStart) {
                         monthlyCollection += payment.amount;
                     }
                     if (paymentDate >= todayStart) {
                         todaysCollection += payment.amount;
                     }
                 });
                 
                 setStats(prevStats => ({
                     ...prevStats,
                     todaysCollection,
                     monthlyCollection,
                 }));
             });

            const unsubscribeRechargeOffers = onSnapshot(rechargeOffersQuery, (snapshot) => {
                const offers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RechargeOffer));
                setRechargeOffers(offers);
            });
            
            allUnsubscribes.push(unsubscribeSettlements, unsubscribeRechargeRequests, unsubscribePayments, unsubscribeRechargeOffers);

        } catch (error) {
            console.error("Error fetching admin stats:", error);
            toast({ variant: "destructive", title: "Error fetching stats" });
        } finally {
            setFirestoreLoading(false);
        }
    };

    const fetchStaffData = async () => {
        try {
            const staffQuery = query(collection(db, "staff"), where("uid", "==", currentUser.uid));
            const staffSnapshot = await getDocs(staffQuery);
            if (staffSnapshot.empty) {
                setFirestoreLoading(false);
                return;
            }
            
            const staffDocData = {id: staffSnapshot.docs[0].id, ...staffSnapshot.docs[0].data()} as StaffData;
            setStaffData(staffDocData);
            const commissionRate = parseFloat(staffDocData.commission.replace('%', '')) || 0;
            const isCollectionAgent = userRole ? /collection|collation/i.test(userRole) : false;

            const allCustomersQuery = query(collection(db, "customers"), where("userId", "==", staffDocData.adminId));
            const allCustomersSnapshot = await getDocs(allCustomersQuery);
            const allAdminCustomers = allCustomersSnapshot.docs.map(doc => ({id: doc.id, ...doc.data() as Omit<Customer, 'id'>}));
            const customerMap = new Map(allAdminCustomers.map(c => [c.id, c]));
            
            const allRechargesQuery = query(collection(db, "recharges"), where("adminId", "==", staffDocData.adminId));
            const allRechargesSnapshot = await getDocs(allRechargesQuery);
            const allAdminRecharges = allRechargesSnapshot.docs.map(doc => doc.data() as Recharge);

            
            allUnsubscribes.push(onSnapshot(allCustomersQuery, (snapshot) => {
                const totalPending = snapshot.docs.reduce((sum, doc) => sum + (doc.data().balanceAmount || 0), 0);
                setTotalPendingForStaff(totalPending);
            }));

            const rechargeRequestQuery = query(collection(db, "rechargeRequests"), where("adminId", "==", staffDocData.adminId), where("status", "==", "Pending"));
            allUnsubscribes.push(onSnapshot(rechargeRequestQuery, (snapshot) => {
                 const requests = snapshot.docs.map(doc => {
                    const reqData = doc.data() as Omit<RechargeRequest, 'id' | 'customerDetails'>;
                    const customer = customerMap.get(reqData.customerId);
                    return {
                        id: doc.id,
                        ...reqData,
                        customerDetails: customer ? { mobile: customer.mobile, customerId: customer.customerId, balanceAmount: customer.balanceAmount } : undefined
                    };
                });
                requests.sort((a,b) => b.requestDate.toMillis() - a.requestDate.toMillis());
                setRechargeRequests(requests);
            }));
            
            const complaintsQuery = query(collection(db, "complaints"), where("userId", "==", staffDocData.adminId), where("status", "==", "Pending"));
            allUnsubscribes.push(onSnapshot(complaintsQuery, (snapshot) => {
                 const complaintsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Complaint));
                 setPendingComplaints(complaintsData);
            }));

            if (!isCollectionAgent) {
                const packagesQuery = query(collection(db, "packages"), where("userId", "==", staffDocData.adminId));
                allUnsubscribes.push(onSnapshot(packagesQuery, (snapshot) => {
                    const packagesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RechargePackage));
                    setPackages(packagesData);
                }));
            }
            

            // Fetch approved settlements to find the last settlement date
            const approvedSettlementsQuery = query(
                collection(db, "settlements"),
                where("staffId", "==", currentUser.uid),
                where("status", "==", "approved")
            );
            
            const paymentsQuery = query(
              collection(db, "payments"),
              where("collectedBy", "==", currentUser.uid)
            );

            allUnsubscribes.push(onSnapshot(approvedSettlementsQuery, (approvedSettlementsSnapshot) => {
                const approvedSettlements = approvedSettlementsSnapshot.docs.map(doc => doc.data());
                const totalSettledEver = approvedSettlements.reduce((sum, doc) => sum + (doc.amount || 0), 0);
                const totalSettledCommissionEver = approvedSettlements.reduce((sum, doc) => sum + (doc.commission || 0), 0);

                allUnsubscribes.push(onSnapshot(paymentsQuery, (paymentsSnapshot) => {
                    const now = new Date();
                    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    let todaysCollection = 0;

                    const allPayments = paymentsSnapshot.docs.map(doc => {
                        const data = doc.data();
                        const paymentDate = data.collectionDate.toDate();
                        if (paymentDate >= todayStart) {
                            todaysCollection += data.amount;
                        }
                        return data;
                    });
                    
                    setTodaysCollectionForStaff(todaysCollection);
                    const totalCollectionEver = allPayments.reduce((acc, p) => acc + p.amount, 0);
                    const walletAmount = totalCollectionEver - totalSettledEver;
                    const collectionCommissionEver = (totalCollectionEver * commissionRate) / 100;
                    
                    // Enrollment Commission
                    const enrollmentCommissionPerCustomer = staffDocData.enrollmentCommission || 0;
                    const customersByStaff = allAdminCustomers.filter(c => {
                        return c.userId === staffDocData.adminId && c.connectionReference === staffDocData.id;
                    });
                    const totalEnrollmentCommission = customersByStaff.length * enrollmentCommissionPerCustomer;
                    
                    // Monthly Recharge Commission
                    const referredCustomers = allAdminCustomers.filter(c => c.connectionReference === staffDocData.id);
                    let monthlyRechargeCommissionEver = 0;
                    referredCustomers.forEach(cust => {
                        const monthlyCommRate = parseFloat(cust.monthlyCommission || '0');
                        if (monthlyCommRate > 0) {
                            const customerRecharges = allAdminRecharges.filter(r => r.customerId === cust.id);
                            const totalRechargeAmount = customerRecharges.reduce((sum, r) => sum + r.amount, 0);
                            monthlyRechargeCommissionEver += (totalRechargeAmount * monthlyCommRate) / 100;
                        }
                    });

                    const totalCommissionEver = collectionCommissionEver + totalEnrollmentCommission + monthlyRechargeCommissionEver;
                    const commissionAmount = Math.max(0, totalCommissionEver - totalSettledCommissionEver);
                    setStaffWallet({ walletAmount: walletAmount, commissionAmount: commissionAmount });
                }));
            }));


            const allSettlementsQuery = query(collection(db, "settlements"), where("staffId", "==", currentUser.uid));
            allUnsubscribes.push(onSnapshot(allSettlementsQuery, (snapshot) => {
                 const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SettlementRequest));
                requests.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
                setSettlementRequests(requests);
            }));

        } catch(error) {
            console.error("Error fetching staff data:", error);
            toast({ variant: "destructive", title: "Error fetching staff data" });
        } finally {
             setFirestoreLoading(false);
        }
    };

    const fetchDealerData = async () => {
      try {
        let name = "";
        const dealerQueryByUid = query(collection(db, "dishtv_dealers"), where("uid", "==", currentUser.uid));
        let dealerSnapshot = await getDocs(dealerQueryByUid);
        if (dealerSnapshot.empty && currentUser.email) {
          const dealerQueryByEmail = query(collection(db, "dishtv_dealers"), where("formattedEmail", "==", currentUser.email));
          dealerSnapshot = await getDocs(dealerQueryByEmail);
        }
        if (!dealerSnapshot.empty) {
          const dData = dealerSnapshot.docs[0].data();
          name = dData.dealerName || "Dealer";
        } else {
          // Check retailers
          const retailerQueryByUid = query(collection(db, "dishtv_retailers"), where("uid", "==", currentUser.uid));
          let retailerSnapshot = await getDocs(retailerQueryByUid);
          if (retailerSnapshot.empty && currentUser.email) {
            const retailerQueryByEmail = query(collection(db, "dishtv_retailers"), where("formattedEmail", "==", currentUser.email));
            retailerSnapshot = await getDocs(retailerQueryByEmail);
          }
          if (!retailerSnapshot.empty) {
            const rData = retailerSnapshot.docs[0].data();
            name = rData.retailerName || rData.contactPerson || "Retailer";
          }
        }
        setDealerName(name || shopName || "Partner");

        const qCust = query(collection(db, "dishtv_customers"), where("userId", "==", currentUser.uid));
        const custSnapshot = await getDocs(qCust);
        const custs = custSnapshot.docs.map(doc => doc.data());
        
        const total = custs.length;
        const active = custs.filter((c: any) => c.status === "Active").length;
        const expired = custs.filter((c: any) => c.status === "Expired").length;
        const monthlyRev = custs.reduce((sum: number, c: any) => sum + (c.monthlyAmount || 0), 0);
        const totalOutstanding = custs.reduce((sum: number, c: any) => sum + (c.balanceAmount ?? c.pendingAmount ?? c.monthlyAmount ?? 0), 0);

        setDealerStats({ total, active, expired, monthlyRev, totalOutstanding });
      } catch (error) {
        console.error("Error fetching dealer/retailer data:", error);
      } finally {
        setFirestoreLoading(false);
      }
    };

    const isDealerRole = userRole ? /dealer|retailer/i.test(userRole) : false;

    // Real-time listener for recharge_requests collection
    const unsubRechargeRequestsGlobal = onSnapshot(
      collection(db, "recharge_requests"),
      (snapshot) => {
        const list = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        list.sort((a: any, b: any) => {
          const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
          const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
          return tB - tA;
        });
        setLiveRechargeRequests(list);
      },
      (err) => {
        console.error("Error listening to recharge_requests:", err);
      }
    );
    allUnsubscribes.push(unsubRechargeRequestsGlobal);

    if (userRole === "Admin") {
      fetchAdminData();
    } else if (isDealerRole) {
      fetchDealerData();
    } else if (userRole) {
      fetchStaffData();
    } else {
      setFirestoreLoading(false);
    }
    
    return () => {
      allUnsubscribes.forEach(unsub => unsub());
    };
  }, [currentUser, userRole, authLoading, toast]);

    useEffect(() => {
        const primeAudio = () => {
            if (audioRef.current && !hasInteracted.current) {
                audioRef.current.volume = 0;
                audioRef.current.play().catch(() => {});
                hasInteracted.current = true;
                window.removeEventListener('click', primeAudio);
                window.removeEventListener('touchstart', primeAudio);
            }
        };
        window.addEventListener('click', primeAudio);
        window.addEventListener('touchstart', primeAudio);
        return () => {
            window.removeEventListener('click', primeAudio);
            window.removeEventListener('touchstart', primeAudio);
        };
    }, []);

    useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false;
            prevRequestCount.current = rechargeRequests.length;
            return;
        }

        if (userRole && userRole !== 'Admin') {
            if (rechargeRequests.length > prevRequestCount.current) {
                setHighlightNewRequest(true);
                if (audioRef.current) {
                    audioRef.current.volume = 1;
                    audioRef.current.play().catch(e => console.error("Audio play failed:", e));
                }
                setTimeout(() => setHighlightNewRequest(false), 2000); 
            }
        }
        prevRequestCount.current = rechargeRequests.length;
    }, [rechargeRequests.length, userRole]);

  // Subscribe to DishTV Customers for Top Universal Search
  useEffect(() => {
    if (authLoading || !currentUser) return;
    const qCust = (userRole === "Admin" || userRole === "Retailer")
      ? query(collection(db, "dishtv_customers"))
      : query(collection(db, "dishtv_customers"), where("userId", "==", currentUser.uid));

    const unsubDishTv = onSnapshot(qCust, (snapshot) => {
      const custs = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as DishTvCustomer[];
      setAllDishTvCustomers(custs);
    });

    // Subscribe to serviceRequests collection for Admin & Retailer visibility
    const qSR = query(collection(db, "serviceRequests"));
    const unsubSR = onSnapshot(qSR, (snapshot) => {
      const requests = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
      requests.sort((a: any, b: any) => {
        const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return tB - tA;
      });
      setLiveServiceRequests(requests);
    });

    // Subscribe to newConnectionRequests
    const qNC = query(collection(db, "newConnectionRequests"));
    const unsubNC = onSnapshot(qNC, (snapshot) => {
      const ncs = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
      ncs.sort((a: any, b: any) => {
        const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return tB - tA;
      });
      setLiveNewConnections(ncs);
    });

    // Subscribe to dishtv_retailers collection to match retailer contact numbers
    const unsubRetailers = onSnapshot(collection(db, "dishtv_retailers"), (snapshot) => {
      const rList = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
      setRetailersList(rList);
    });

    return () => {
      unsubDishTv();
      unsubSR();
      unsubNC();
      unsubRetailers();
    };
  }, [currentUser, userRole, authLoading]);

  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setActiveSearchQuery(topSearchTerm.trim());
  };

  // Filter top search results based on activeSearchQuery (triggered on Search button click)
  const topSearchResults = useMemo(() => {
    const rawTerm = activeSearchQuery.trim().toLowerCase();
    if (!rawTerm) return [];

    const cleanTerm = rawTerm.replace(/[^a-zA-Z0-9]/g, "");

    return allDishTvCustomers.filter((c) => {
      const cleanVc = (c.vcNumber || "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
      const cleanSubId = (c.subscriberId || "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
      const cleanMob = (c.mobile || "").replace(/\D/g, "");

      if (userRole === "Retailer") {
        // Retailers require EXACT full match for VC Number, Mobile Number, or Subscriber ID
        return (
          (cleanVc && cleanVc === cleanTerm) ||
          (cleanMob && cleanMob === cleanTerm) ||
          (cleanSubId && cleanSubId === cleanTerm)
        );
      } else {
        // Admin / Dealer: exact or partial match
        const cleanName = (c.name || "").trim().toLowerCase();
        return (
          (cleanVc && (cleanVc === cleanTerm || cleanVc.includes(cleanTerm))) ||
          (cleanMob && (cleanMob === cleanTerm || cleanMob.includes(cleanTerm))) ||
          (cleanSubId && (cleanSubId === cleanTerm || cleanSubId.includes(cleanTerm))) ||
          (cleanName && cleanName.includes(rawTerm))
        );
      }
    });
  }, [activeSearchQuery, allDishTvCustomers, userRole]);

  // Subscribe to packages collection to map package names to 1,3,6,12 month rates
  useEffect(() => {
    if (!currentUser) return;
    const qPkgs = query(collection(db, "packages"));
    const unsubPkgs = onSnapshot(qPkgs, (snap) => {
      const pMap: Record<string, { m: number; t3: number; t6: number; t12: number }> = {};
      snap.docs.forEach((docSnap) => {
        const d = docSnap.data();
        const pName = d.packageName;
        const m = parseFloat(d.packageAmount || "350") || 350;
        const t3 = d.threeMonthAmount ? parseFloat(d.threeMonthAmount) : m * 3;
        const t6 = d.sixMonthAmount ? parseFloat(d.sixMonthAmount) : m * 6;
        const t12 = d.twelveMonthAmount ? parseFloat(d.twelveMonthAmount) : m * 12;
        if (pName) {
          pMap[pName.toLowerCase()] = { m, t3, t6, t12 };
        }
      });
      setDbPackageMap(pMap);
    });

    return () => unsubPkgs();
  }, [currentUser]);

  // Helper to compute 1, 3, 6, 12 month prices for a customer
  const getPackagePriceList = (cust: DishTvCustomer) => {
    const monthly = cust.monthlyAmount || 350;
    const pkgNameKey = (cust.packagePlan || "").toLowerCase();
    const pkgData = dbPackageMap[pkgNameKey];

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

  // Helper to format full address
  const getFullCustomerAddress = (cust: DishTvCustomer) => {
    const parts = [];
    if (cust.address) parts.push(cust.address);
    if (cust.village) parts.push(cust.village);
    if (cust.area && cust.area !== cust.village) parts.push(cust.area);
    if (cust.mandal) parts.push(cust.mandal);
    if (cust.district) parts.push(cust.district);
    return parts.length > 0 ? parts.join(", ") : "Address Not Specified";
  };


  const getWelcomeMessage = () => {
    if (userRole === "Admin") {
      return "Welcome, Admin!";
    }
    const isDealerRole = userRole ? /dealer|retailer/i.test(userRole) : false;
    if (isDealerRole) {
      return `Welcome, ${dealerName || shopName || 'Partner'}! (${userRole === 'Retailer' ? 'Retailer Portal' : 'Dealer Portal'})`;
    }
    if (userRole) {
      return `Welcome, ${staffData?.name || 'Staff'}!`;
    }
    return `Welcome to ${shopName || 'Navanidhi Digital System - DishTV Official Partner Portal.'}`;
  };

  const handleSettleCollection = async () => {
    if (!currentUser || !staffData) return;
    
    const requestedAmount = parseFloat(settlementAmount);
    if (isNaN(requestedAmount) || requestedAmount <= 0 || requestedAmount > staffWallet.walletAmount) {
      toast({
        variant: "destructive",
        title: "Invalid Amount",
        description: `Please enter an amount between ₹1 and ₹${staffWallet.walletAmount.toLocaleString()}.`,
      });
      return;
    }

    const commissionAmount = staffWallet.commissionAmount;
    const commissionDeduction = commissionReceived ? Math.min(commissionAmount, requestedAmount) : 0;
    const amountToSend = requestedAmount - commissionDeduction;

    try {
      await addDoc(collection(db, "settlements"), {
        staffId: currentUser.uid,
        staffName: staffData.name || 'Staff Member',
        amount: requestedAmount,
        commission: commissionDeduction,
        amountToSend: amountToSend,
        status: 'pending',
        createdAt: new Date(),
        adminId: staffData.adminId,
      });

      toast({
          title: "Request Sent",
          description: `Your settlement request for ₹${amountToSend.toLocaleString()} has been sent to the admin for approval.`,
      });
      
      setIsSettleDialogOpen(false);
      setCommissionReceived(false);
      setSettlementAmount("");
    } catch (error) {
      console.error("Error sending settlement request: ", error);
      toast({
        variant: "destructive",
        title: "Request Failed",
        description: "Could not send your settlement request. Please try again.",
      });
    }
  };

  const handleApproveSettlement = async (requestId: string) => {
    try {
      const requestDocRef = doc(db, "settlements", requestId);
      await updateDoc(requestDocRef, {
        status: 'approved'
      });
      toast({
          title: "Settlement Approved",
          description: "The staff member's wallet has been marked as cleared.",
      })
    } catch (error) {
        console.error("Error approving settlement: ", error);
        toast({
            variant: "destructive",
            title: "Approval Failed",
            description: "Could not approve the settlement. Please try again.",
        });
    }
  };

  const handleRejectSettlement = async (requestId: string) => {
    try {
      const requestDocRef = doc(db, "settlements", requestId);
      await updateDoc(requestDocRef, {
        status: 'rejected'
      });
      toast({
          title: "Settlement Rejected",
          description: "The settlement request has been rejected.",
      });
    } catch (error) {
        console.error("Error rejecting settlement: ", error);
        toast({
            variant: "destructive",
            title: "Rejection Failed",
            description: "Could not reject the settlement request.",
        });
    }
  };

  const handleCancelSettlement = async () => {
    if (!currentUser) return;
    try {
      const pendingRequest = settlementRequests.find(req => req.status === 'pending' && req.staffId === currentUser.uid);
      if (!pendingRequest) return;
      
      const requestDocRef = doc(db, "settlements", pendingRequest.id);
      await updateDoc(requestDocRef, {
        status: 'cancelled'
      });
      
      toast({
          title: "Settlement Cancelled",
          description: "Your settlement request has been cancelled.",
      });
    } catch (error) {
        console.error("Error cancelling settlement: ", error);
        toast({
            variant: "destructive",
            title: "Cancellation Failed",
            description: "Could not cancel the settlement request.",
        });
    }
  };

  const handleApproveRechargeRequest = async (request: RechargeRequest) => {
    if (!currentUser) return;
    try {
      await runTransaction(db, async (transaction) => {
        const customerDocRef = doc(db, "customers", request.customerId);
        const customerDoc = await transaction.get(customerDocRef);

        if (!customerDoc.exists()) {
          throw new Error("Customer not found");
        }

        const customerData = customerDoc.data() as Customer;
        
        let newRechargeDate = new Date();
        const months = request.months || 1;

        if (request.requestSubtype === 'Renewal' && customerData.lastRechargeDate) {
            const lastRecharge = customerData.lastRechargeDate.toDate();
            newRechargeDate = new Date(lastRecharge.setMonth(lastRecharge.getMonth() + months));
        } else if (request.requestSubtype === 'Renewal' && !customerData.lastRechargeDate) {
             newRechargeDate = (customerData.expiryDate && customerData.expiryDate.toDate() > new Date()) 
            ? customerData.expiryDate.toDate() 
            : new Date();
        }

        const newExpiryDate = new Date(newRechargeDate);
        newExpiryDate.setDate(newExpiryDate.getDate() + 30 * months);
        
        const currentBalance = customerData.balanceAmount || 0;
        const newBalance = currentBalance + request.packageAmount;

        transaction.update(customerDocRef, { 
            lastRechargeDate: Timestamp.fromDate(newRechargeDate),
            expiryDate: Timestamp.fromDate(newExpiryDate),
            balanceAmount: newBalance,
        });
        
        const rechargesColRef = collection(db, "recharges");
        const newRechargeRef = doc(rechargesColRef);
        transaction.set(newRechargeRef, {
            customerId: request.customerId,
            customerName: request.customerName,
            packageName: request.packageName,
            amount: request.packageAmount,
            months: months,
            paymentReceived: false,
            rechargeDate: Timestamp.fromDate(newRechargeDate),
            rechargedBy: 'SYSTEM_AUTO', 
            adminId: currentUser.uid,
        });

        const requestDocRef = doc(db, "rechargeRequests", request.id);
        transaction.update(requestDocRef, { status: "Completed" });
      });

      toast({
        title: "Recharge Approved",
        description: `${request.customerName} has been automatically recharged with ${request.packageName}.`
      });

    } catch (error) {
        console.error("Error approving recharge request:", error);
        toast({
            variant: "destructive",
            title: "Approval Failed",
            description: "Could not approve the recharge request.",
        });
    }
  };
  
  const handleRejectRechargeRequest = async (requestId: string) => {
    try {
        const requestDocRef = doc(db, "rechargeRequests", requestId);
        await deleteDoc(requestDocRef);
        toast({
            title: "Request Rejected",
            description: "The recharge request has been rejected and removed.",
        });
    } catch (error) {
         console.error("Error rejecting recharge request:", error);
        toast({
            variant: "destructive",
            title: "Rejection Failed",
            description: "Could not reject the recharge request.",
        });
    }
  };


  const handleCustomerSearch = async (type: 'collection' | 'recharge') => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    setSearchError("");
    setSearchedCustomer(null);

    try {
        let currentStaffData = staffData;
        if (!currentStaffData && currentUser) {
            const staffQuery = query(collection(db, "staff"), where("uid", "==", currentUser.uid));
            const staffSnapshot = await getDocs(staffQuery);
            if (!staffSnapshot.empty) {
                currentStaffData = staffSnapshot.docs[0].data() as StaffData;
                setStaffData(currentStaffData);
            } else {
                 setSearchError("Could not find your staff profile.");
                 setIsSearching(false);
                 return;
            }
        }

        if (!currentStaffData) {
            setSearchError("Could not verify your staff details.");
            setIsSearching(false);
            return;
        }

        const customersRef = collection(db, "customers");
        const q = query(customersRef, where("userId", "==", currentStaffData.adminId));
        const querySnapshot = await getDocs(q);
        
        const allAdminCustomers = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));

        const trimmedSearchQuery = searchQuery.trim().toLowerCase();
        
        const foundCustomer = allAdminCustomers.find(c => {
            const matchesSearchTerm = 
                (c.customerId && c.customerId.trim().toLowerCase() === trimmedSearchQuery) || 
                (c.mobile && c.mobile.trim() === searchQuery.trim()) ||
                (c.stbId && c.stbId.trim().toLowerCase() === trimmedSearchQuery) ||
                (c.name && c.name.trim().toLowerCase().includes(trimmedSearchQuery));
            
            const isInAssignedArea = currentStaffData!.area.includes(c.area);

            return matchesSearchTerm && isInAssignedArea;
        });


        if (foundCustomer) {
            setSearchedCustomer(foundCustomer);
            if (type === 'recharge') {
                openRechargeDialog(foundCustomer);
            }
        } else {
            setSearchError("Customer not found in your assigned areas or invalid ID/Mobile/Name.");
        }
    } catch (error) {
        console.error("Error searching customer:", error);
        setSearchError("An error occurred while searching.");
    } finally {
        setIsSearching(false);
    }
  };

  const openCollectDialog = (customer: Customer) => {
    setAmountCollected(String(customer.balanceAmount));
    setPaymentMethod("cash");
    setIsCollectDialogOpen(true);
  };
  
  const openRechargeDialog = (customer: Customer) => {
    setSearchedCustomer(customer);
    setSelectedPackage(null);
    setRechargeMonths(1);
    setPaymentReceivedForRecharge(false);
    setIsRechargeDialogOpen(true);
    setIsRechargeSearchDialogOpen(false);
  };


  const handleConfirmCollection = async () => {
    if (!amountCollected || !searchedCustomer || !currentUser || !staffData) return;
    
    if (userStatus === 'inactive' || staffData.status === 'inactive') {
      toast({
        variant: "destructive",
        title: "Collection Blocked 🔒",
        description: "Your account is currently INACTIVE because you reached your collection limit. Please deposit cash with Admin to reactivate.",
      });
      return;
    }

    const collectedAmount = parseFloat(amountCollected);
    const currentBalance = parseFloat(String(searchedCustomer.balanceAmount));
    const newBalance = currentBalance - collectedAmount;

    try {
        const customerDocRef = doc(db, "customers", searchedCustomer.id);
        await updateDoc(customerDocRef, {
            balanceAmount: newBalance
        });

        await addDoc(collection(db, "payments"), {
            customerId: searchedCustomer.id,
            customerName: searchedCustomer.name,
            amount: collectedAmount,
            method: paymentMethod,
            collectedBy: currentUser.uid,
            collectionDate: new Date(),
            adminId: staffData.adminId,
        });

        // Compute new wallet balance after this collection
        const newWalletAmount = (staffWallet?.walletAmount || 0) + collectedAmount;
        const limit = staffData.collectionLimit ?? 10000;

        // Auto-Deactivation check: Lock account if limit is reached or exceeded
        let isAutoLocked = false;
        if (limit > 0 && newWalletAmount >= limit) {
          isAutoLocked = true;
          await updateDoc(doc(db, "staff", staffData.id), { status: "inactive" });
          if (typeof window !== 'undefined') {
            localStorage.setItem('userStatus', 'inactive');
          }
          setStaffData(prev => prev ? { ...prev, status: 'inactive' } : null);
        }

        if (isAutoLocked) {
          toast({
            variant: "destructive",
            title: "Collection Limit Reached! 🔒",
            description: `Limit reached (Limit: ₹${limit.toLocaleString()}). Account auto-locked! Please deposit collected cash with Admin to reactivate.`,
          });
        } else {
          toast({
            title: "Collection Recorded",
            description: `Collected ₹${amountCollected} from ${searchedCustomer.name} via ${paymentMethod}.`,
          });
        }

        // Trigger Instant WhatsApp & SMS Payment Receipt Modal
        setReceiptModalData({
          businessName: shopName || "SonyCable / Navanidhi Digital",
          customerName: searchedCustomer.name,
          customerId: searchedCustomer.stbId || searchedCustomer.customerId || searchedCustomer.id,
          mobile: searchedCustomer.mobile || '',
          paidAmount: collectedAmount,
          remainingBalance: Math.max(0, newBalance),
          date: new Date(),
          collectedByName: staffData?.name || currentUser.displayName || 'Staff',
        });
        setIsReceiptModalOpen(true);

        setIsCollectDialogOpen(false);
        setIsCustomerSearchDialogOpen(false);
        setSearchedCustomer(null);
        setSearchQuery("");

    } catch (error) {
        console.error("Error recording collection:", error);
        toast({
            variant: "destructive",
            title: "Collection Failed",
            description: "An error occurred while recording the payment.",
        });
    }
  };
  
    const handleRecharge = async () => {
    if (!selectedPackage || !searchedCustomer || !currentUser || !staffData) return;
    
    const pkg = packages.find(p => p.id === selectedPackage);
    if (!pkg) {
      toast({ variant: "destructive", title: "Package not found" });
      return;
    }

    const baseAmount = parseFloat(pkg.packageAmount);
    const offer = rechargeOffers.find(o => o.months === rechargeMonths);
    const discount = offer ? (baseAmount * rechargeMonths * offer.discountPercentage) / 100 : 0;
    const totalRechargeAmount = baseAmount * rechargeMonths - discount;

    let description;
    const customerDocRef = doc(db, "customers", searchedCustomer.id);

    try {
        const newRechargeDate = new Date();
        const newExpiryDate = new Date(newRechargeDate);
        newExpiryDate.setDate(newExpiryDate.getDate() + 30 * rechargeMonths);

        let updateData: any = {
            expiryDate: Timestamp.fromDate(newExpiryDate),
            lastRechargeDate: Timestamp.fromDate(newRechargeDate),
        };

        if (paymentReceivedForRecharge) {
            description = `${searchedCustomer.name} has been recharged with ${pkg.packageName} for ${rechargeMonths} month(s) (₹${totalRechargeAmount}). Payment received.`;
        } else {
            const currentBalance = parseFloat(String(searchedCustomer.balanceAmount));
            const newBalance = currentBalance + totalRechargeAmount;
            updateData.balanceAmount = newBalance;
            description = `${searchedCustomer.name} has been recharged with ${pkg.packageName} for ${rechargeMonths} month(s). ₹${totalRechargeAmount} added to collection balance.`;
        }
        
        if (discount > 0) {
            description += ` (Discount of ₹${discount} applied).`;
        }

        await updateDoc(customerDocRef, updateData);

        await addDoc(collection(db, "recharges"), {
            customerId: searchedCustomer.id,
            customerName: searchedCustomer.name,
            packageId: pkg.id,
            packageName: pkg.packageName,
            amount: totalRechargeAmount,
            months: rechargeMonths,
            paymentReceived: paymentReceivedForRecharge,
            rechargeDate: newRechargeDate,
            rechargedBy: currentUser.uid, // staff uid
            adminId: staffData.adminId, // admin uid
        });
      
        toast({
            title: "Recharge Successful",
            description: description,
        });

        setIsRechargeDialogOpen(false);
        setSelectedPackage(null);
        setPaymentReceivedForRecharge(false);
        setSearchedCustomer(null);

    } catch (error) {
        console.error("Recharge failed:", error);
         toast({
            variant: "destructive",
            title: "Recharge Failed",
            description: "An error occurred while processing the recharge.",
        });
    }
  };


  const AdminCollectionCard = () => (
    <Card className="bg-primary text-primary-foreground hover:bg-primary/90 transition-colors animate-slide-in-fade-in">
        <Link href="/dashboard/collection" className="block h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                    Payment Collection
                </CardTitle>
                <IndianRupee className="h-4 w-4 text-primary-foreground" />
            </CardHeader>
            <CardContent>
                <div className="flex items-center justify-between">
                    <p className="text-xs">
                        Go to collection page
                    </p>
                    <ArrowRight className="h-5 w-5" />
                </div>
            </CardContent>
        </Link>
    </Card>
  );

  const StaffCollectionCard = () => (
     <Card className="bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer" onClick={() => setIsCustomerSearchDialogOpen(true)}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
                My Collections
            </CardTitle>
            <IndianRupee className="h-4 w-4 text-primary-foreground" />
        </CardHeader>
        <CardContent>
            <p className="text-xs">
                View customers with outstanding balance
            </p>
        </CardContent>
    </Card>
  );
  
  const StaffRechargeCard = () => {
    const isNetworkServiceAgent = userRole?.toLowerCase().replace(/\s/g, "") === 'networkserviceagent';
    
    if(isNetworkServiceAgent) {
       return (
        <Card className="bg-blue-600 text-white hover:bg-blue-700 transition-colors">
            <Link href="/dashboard/request-recharge" className="block h-full">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                        Request Recharge
                    </CardTitle>
                    <Send className="h-4 w-4 text-white" />
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between">
                        <p className="text-xs">
                            Request a customer recharge from admin
                        </p>
                        <ArrowRight className="h-5 w-5" />
                    </div>
                </CardContent>
            </Link>
        </Card>
       );
    }

    return (
        <Card className="bg-green-600 text-white hover:bg-green-700 transition-colors cursor-pointer" onClick={() => setIsRechargeSearchDialogOpen(true)}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                    Recharge
                </CardTitle>
                <CreditCard className="h-4 w-4 text-white" />
            </CardHeader>
            <CardContent>
                <div className="flex items-center justify-between">
                    <p className="text-xs">
                        Recharge a customer account
                    </p>
                    <ArrowRight className="h-5 w-5" />
                </div>
            </CardContent>
        </Card>
    );
  };


   const RechargeRequestsCard = ({ canApprove }: { canApprove: boolean }) => {
    if (rechargeRequests.length === 0) return null;

    return (
        <Card className={cn(
            "md:col-span-2 lg:col-span-3",
            highlightNewRequest && "animate-pulse"
        )}>
            <CardHeader>
                <CardTitle>Recharge Requests</CardTitle>
                 <CardDescription>The following requests were generated by customers or staff.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {rechargeRequests.map(req => (
                    <div key={req.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between rounded-lg border p-3 gap-2">
                        <div>
                            <p className="font-semibold">{req.customerName}</p>
                            <p className="text-sm text-muted-foreground">
                                ID: {req.customerDetails?.customerId} | Mobile: {req.customerDetails?.mobile}
                            </p>
                            {req.customerDetails?.balanceAmount && req.customerDetails.balanceAmount > 0 && (
                                <p className="text-sm text-destructive font-semibold">
                                    Current Balance: ₹{req.customerDetails.balanceAmount}
                                </p>
                            )}
                            <p className="text-sm text-muted-foreground mt-1">
                                Requested <span className="font-bold text-foreground">{req.packageName} (₹{req.packageAmount})</span> {req.months && ` for ${req.months} month(s)`}
                            </p>
                            <Badge variant="outline" className="mt-1">{req.type} Request</Badge>
                        </div>
                         {canApprove ? (
                            <div className="flex gap-2 self-end sm:self-center">
                                <Button size="sm" onClick={() => handleApproveRechargeRequest(req)}>
                                    Approve
                                </Button>
                                <Button size="sm" variant="destructive" onClick={() => handleRejectRechargeRequest(req.id)}>
                                    Reject
                                </Button>
                            </div>
                        ) : (
                             <Badge>Pending</Badge>
                        )}
                    </div>
                ))}
            </CardContent>
        </Card>
    );
   };
   
    const getStaffWalletAmount = (staffId: string) => {
      const staffPayments = allPayments.filter(p => p.collectedBy === staffId);
      const totalCollection = staffPayments.reduce((sum, p) => sum + p.amount, 0);

      const approvedSettlements = settlementRequests.filter(s => s.staffId === staffId && s.status === 'approved');
      const totalSettled = approvedSettlements.reduce((sum, s) => sum + (s.amount || 0), 0);

      return totalCollection - totalSettled;
    };

    const SettlementRequestsCard = () => {
     const pendingRequests = settlementRequests.filter(r => r.status === 'pending');
     if(pendingRequests.length === 0) return null;
 
     return (
          <Card className="md:col-span-2 lg:col-span-3 animate-slide-in-fade-in">
             <CardHeader>
                 <CardTitle>Settlement Requests</CardTitle>
             </CardHeader>
             <CardContent className="space-y-4">
                 {pendingRequests.map(req => {
                     const currentWallet = getStaffWalletAmount(req.staffId);
                     const remainingWalletIfApproved = Math.max(0, currentWallet - req.amount);
                     return (
                         <div key={req.id} className="flex flex-col sm:flex-row sm:items-center justify-between rounded-lg border p-3 gap-3">
                             <div>
                                 <p className="font-semibold">{req.staffName}</p>
                                 <p className="text-sm text-muted-foreground">
                                     Requesting to settle <span className="font-bold text-foreground">₹{req.amountToSend.toLocaleString()}</span> (Gross: ₹{req.amount.toLocaleString()})
                                 </p>
                                 <p className="text-xs text-muted-foreground mt-1">
                                     Current Wallet: ₹{currentWallet.toLocaleString()} | Remaining if approved: <span className="font-semibold text-primary">₹{remainingWalletIfApproved.toLocaleString()}</span>
                                 </p>
                             </div>
                             <div className="flex gap-2">
                                 <Button onClick={() => handleApproveSettlement(req.id)} size="sm">
                                     <CheckCircle2 className="mr-2 h-4 w-4" />
                                     Approve
                                 </Button>
                                 <Button onClick={() => handleRejectSettlement(req.id)} variant="destructive" size="sm">
                                     <XCircle className="mr-2 h-4 w-4" />
                                     Reject
                                 </Button>
                             </div>
                         </div>
                     );
                 })}
             </CardContent>
         </Card>
     );
    };
   
    const ComplaintsCard = () => {
        if (pendingComplaints.length === 0) return null;
        return (
            <Card className="md:col-span-2 lg:col-span-3">
                <CardHeader>
                    <CardTitle>Pending Complaints</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {pendingComplaints.slice(0, 3).map(complaint => (
                         <div key={complaint.id} className="flex items-start justify-between rounded-lg border p-3">
                             <div>
                                 <p className="font-semibold">{complaint.customerName}</p>
                                 <p className="text-sm text-muted-foreground">{complaint.complaint}</p>
                             </div>
                             <Button asChild variant="secondary" size="sm">
                                <Link href="/dashboard/complaints-staff">View</Link>
                             </Button>
                         </div>
                    ))}
                    {pendingComplaints.length > 3 && (
                        <Button asChild variant="outline" className="w-full">
                            <Link href="/dashboard/complaints-staff">View all {pendingComplaints.length} complaints</Link>
                        </Button>
                    )}
                </CardContent>
            </Card>
        );
    };


  const handleCreateServiceRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!srCustomerName || !srMobile || !srDistrict || !srMandal) {
      toast({
        variant: "destructive",
        title: "Incomplete Details",
        description: "Please fill Customer Name, Mobile Number, District & Mandal.",
      });
      return;
    }

    setIsSubmittingSR(true);
    try {
      const matchedRetailerDoc = retailersList.find(
        (r) => r.uid === currentUser?.uid || r.formattedEmail === currentUser?.email
      );
      const currentMobile = matchedRetailerDoc?.mobile || (currentUser as any)?.phoneNumber || (currentUser as any)?.mobile || "";

      await addDoc(collection(db, "serviceRequests"), {
        customerName: srCustomerName.trim(),
        mobile: srMobile.trim(),
        district: srDistrict,
        mandal: srMandal,
        village: srVillage.trim() || srMandal,
        dthCompany: srDthCompany,
        complaintType: srComplaintType,
        scheduledDate: srScheduledDate || new Date().toISOString().split("T")[0],
        scheduledTime: srScheduledTime,
        notes: srNotes.trim(),
        requestedByUid: currentUser?.uid || "guest",
        requestedByName: shopName || currentUser?.displayName || currentUser?.email || "Retailer/Customer",
        requestedByMobile: currentMobile,
        userRole: userRole || "Retailer",
        status: "Pending",
        createdAt: Timestamp.now(),
      });

      toast({
        title: "Service Request Created! 🛠️",
        description: `Service complaint for ${srCustomerName} (${srDthCompany}) submitted to Admin dashboard.`,
      });

      setIsServiceRequestOpen(false);
      setSrCustomerName("");
      setSrMobile("");
      setSrDistrict("");
      setSrMandal("");
      setSrVillage("");
      setSrNotes("");
    } catch (err) {
      console.error("Service request error:", err);
      toast({
        variant: "destructive",
        title: "Submission Failed",
        description: "Could not submit service request.",
      });
    } finally {
      setIsSubmittingSR(false);
    }
  };

  const handleCreateNewConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ncCustomerName || !ncMobile || !ncDistrict || !ncMandal) {
      toast({ variant: "destructive", title: "Incomplete Details", description: "Please fill Customer Name, Mobile, District & Mandal." });
      return;
    }
    setIsSubmittingNC(true);
    try {
      const matchedRetailer = retailersList.find(
        (r: any) => r.uid === currentUser?.uid || r.formattedEmail === currentUser?.email
      );
      await addDoc(collection(db, "newConnectionRequests"), {
        customerName: ncCustomerName.trim(),
        mobile: ncMobile.trim(),
        district: ncDistrict,
        mandal: ncMandal,
        village: ncVillage.trim() || ncMandal,
        landmark: ncLandmark.trim(),
        scheduledDate: ncScheduledDate || new Date().toISOString().split("T")[0],
        scheduledTime: ncScheduledTime,
        requestedByUid: currentUser?.uid || "guest",
        requestedByName: shopName || currentUser?.displayName || currentUser?.email || "Retailer",
        requestedByMobile: matchedRetailer?.mobile || "",
        status: "Pending",
        createdAt: Timestamp.now(),
      });
      toast({ title: "New Connection Booked! 📡", description: `Connection request for ${ncCustomerName} submitted to Admin.` });
      setIsNewConnOpen(false);
      setNcCustomerName(""); setNcMobile(""); setNcDistrict(""); setNcMandal(""); setNcVillage(""); setNcLandmark(""); setNcScheduledDate("");
    } catch (err) {
      toast({ variant: "destructive", title: "Submission Failed", description: "Could not submit new connection request." });
    } finally {
      setIsSubmittingNC(false);
    }
  };

  const AdminNewConnectionsCard = () => {
    const visibleNewConnections = liveNewConnections.filter(item => 
        item.status === 'Pending' || (item.completedAt && (Date.now() - item.completedAt.toMillis() < 86400000))
    );
    if (visibleNewConnections.length === 0) return null;

    const handleCompleteNC = async (ncItem: any) => {
      if (ncItem.status === "Completed") return;
      try {
        await updateDoc(doc(db, "newConnectionRequests", ncItem.id), { status: "Completed", completedAt: Timestamp.now() });
        // Credit retailerMargin from the offer — NOT serviceRequestCommission
        try {
          // Use the retailerMargin stored in the NC document (from the offer)
          // Fallback: check connectionOrders for same customer, else use 0
          const marginToCredit = Number(ncItem.retailerMargin) || 0;
          const matchedRetailer = retailersList.find(
            (r: any) => (r.uid && r.uid === ncItem.requestedByUid) ||
              (r.retailerName?.toLowerCase() === ncItem.requestedByName?.toLowerCase()) ||
              (r.formattedEmail === ncItem.requestedByName)
          );
          if (matchedRetailer && marginToCredit > 0) {
            await updateDoc(doc(db, "dishtv_retailers", matchedRetailer.id), {
              walletBalance: (Number(matchedRetailer.walletBalance) || 0) + marginToCredit,
              totalEarned: (Number(matchedRetailer.totalEarned) || 0) + marginToCredit,
            });
            await addDoc(collection(db, "commission_transactions"), {
              retailerId: matchedRetailer.id,
              retailerUid: matchedRetailer.uid || ncItem.requestedByUid || "",
              retailerName: matchedRetailer.retailerName || ncItem.requestedByName || "Retailer",
              retailerMobile: matchedRetailer.mobile || ncItem.requestedByMobile || "",
              customerName: ncItem.customerName || "",
              customerMobile: ncItem.mobile || ncItem.customerPhone || "",
              customerAddress: [ncItem.village, ncItem.mandal, ncItem.district].filter(Boolean).join(", "),
              village: ncItem.village || "",
              mandal: ncItem.mandal || "",
              district: ncItem.district || "",
              vcNumber: ncItem.vcNumber || "",
              amount: marginToCredit,
              type: "Credit",
              category: "New Connection",
              description: `New Connection Completed: ${ncItem.offerTitle || ncItem.customerName} (${ncItem.district}) - Retailer Margin`,
              referenceId: ncItem.id,
              createdAt: Timestamp.now(),
            });
            toast({ title: `✅ New Connection Done! ₹${marginToCredit} Credited to Wallet 💰`, description: `Retailer margin credited to ${matchedRetailer.retailerName}'s wallet.` });
          } else if (matchedRetailer && marginToCredit === 0) {
            toast({ title: "New Connection Marked Complete", description: "No retailer margin set for this offer." });
          } else {
            toast({ title: "New Connection Marked Complete" });
          }
        } catch (we) {
          toast({ title: "New Connection Marked Complete", description: "Wallet credit had an issue." });
        }
      } catch (err) {
        toast({ variant: "destructive", title: "Update Failed" });
      }
    };

    return (
      <Card className="md:col-span-2 lg:col-span-3 bg-slate-900 border-emerald-500/50 text-slate-100 shadow-2xl overflow-hidden mb-2">
        <CardHeader className="bg-gradient-to-r from-slate-900 via-emerald-950/40 to-slate-900 border-b border-slate-800 p-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-bold text-emerald-400 flex items-center gap-2">
              <Package className="h-5 w-5 text-emerald-400" />
              New Connection Requests (కొత్త కనెక్షన్ రిక్వెస్ట్‌లు)
            </CardTitle>
            <Badge className="bg-emerald-500 text-slate-950 font-black">
              {visibleNewConnections.filter((r) => r.status === "Pending").length} Pending
            </Badge>
          </div>
          <CardDescription className="text-slate-400 text-xs mt-1">Booking requests submitted by Retailers. Mark complete to auto-credit commission.</CardDescription>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          {visibleNewConnections.map((nc) => (
            <div key={nc.id} className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 rounded-xl bg-slate-950 border border-slate-800 gap-4 hover:border-emerald-500/40 transition-all">
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-base text-white">{nc.customerName}</span>
                  <Badge className={nc.status === "Completed" ? "bg-emerald-950 text-emerald-300 border-emerald-800" : "bg-amber-950 text-amber-300 border-amber-800"}>{nc.status || "Pending"}</Badge>
                  {nc.retailerMargin > 0 && (
                    <Badge className="bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 text-xs font-bold px-2">
                      Margin: ₹{nc.retailerMargin}
                    </Badge>
                  )}
                  <Badge className="bg-purple-950/90 text-purple-200 border border-purple-600/60 text-xs font-bold flex items-center gap-1 px-2">
                    <Building2 className="h-3 w-3 text-purple-400" />
                    {nc.requestedByName} {nc.requestedByMobile ? `(📱 ${nc.requestedByMobile})` : ""}
                  </Badge>
                </div>
                {nc.offerTitle && <p className="text-xs text-amber-300 font-semibold">📦 {nc.offerTitle}</p>}
                <p className="text-xs text-slate-300 flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 text-emerald-400" /> <strong className="text-white">{nc.mobile || nc.customerPhone}</strong>
                  <span className="text-slate-500">|</span>
                  <MapPin className="h-3.5 w-3.5 text-amber-400" /> {nc.village}, {nc.mandal}, {nc.district}
                </p>
                {nc.landmark && <p className="text-xs text-slate-400">📍 Landmark: {nc.landmark}</p>}
                <p className="text-[11px] text-cyan-400 font-medium">🗓️ Scheduled: <strong>{nc.scheduledDate}</strong> ({nc.scheduledTime})</p>
              </div>
              <div className="flex flex-col items-end gap-2 self-end md:self-center shrink-0">
                {nc.retailerMargin > 0 && nc.status !== "Completed" && (
                  <p className="text-[11px] text-emerald-400 font-bold">Complete చేస్తే +₹{nc.retailerMargin} credit అవుతుంది</p>
                )}
                {nc.status !== "Completed" && (
                  <Button size="sm" onClick={() => handleCompleteNC(nc)} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs">
                    Mark Complete ✅
                  </Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  };

  const AdminServiceRequestsCard = () => {
    const visibleServiceRequests = liveServiceRequests.filter(item => 
        item.status === 'Pending' || item.status === 'In Progress' || (item.resolvedAt && (Date.now() - item.resolvedAt.toMillis() < 86400000))
    );
    if (visibleServiceRequests.length === 0) return null;

    const handleUpdateSRStatus = async (reqItem: any, newStatus: string) => {
      try {
        const oldStatus = reqItem.status;
        await updateDoc(doc(db, "serviceRequests", reqItem.id), { 
            status: newStatus,
            completedAt: Timestamp.now(),
            resolvedAt: Timestamp.now()
        });

        // Credit commission to Retailer's wallet if marking as Resolved for the first time
        if (newStatus === "Resolved" && oldStatus !== "Resolved") {
          try {
            const commSnap = await getDoc(doc(db, "settings", "retailer_commissions"));
            const commRate = commSnap.exists()
              ? Number(commSnap.data()?.serviceRequestCommission) || 50
              : 50;

            const matchedRetailer = retailersList.find(
              (r) =>
                (r.uid && r.uid === reqItem.requestedByUid) ||
                (r.retailerName && r.retailerName?.toLowerCase() === reqItem.requestedByName?.toLowerCase()) ||
                (r.contactPerson && r.contactPerson?.toLowerCase() === reqItem.requestedByName?.toLowerCase()) ||
                (r.formattedEmail === reqItem.requestedByName)
            );

            if (matchedRetailer) {
              const currentBal = Number(matchedRetailer.walletBalance) || 0;
              const currentTotal = Number(matchedRetailer.totalEarned) || 0;

              await updateDoc(doc(db, "dishtv_retailers", matchedRetailer.id), {
                walletBalance: currentBal + commRate,
                totalEarned: currentTotal + commRate,
              });

              await addDoc(collection(db, "commission_transactions"), {
                retailerId: matchedRetailer.id,
                retailerUid: matchedRetailer.uid || reqItem.requestedByUid || "",
                retailerName: matchedRetailer.retailerName || reqItem.requestedByName || "Retailer Partner",
                retailerMobile: matchedRetailer.mobile || reqItem.requestedByMobile || "",
                customerName: reqItem.customerName || "",
                customerMobile: reqItem.mobile || "",
                customerAddress: [reqItem.village, reqItem.mandal, reqItem.district].filter(Boolean).join(", "),
                village: reqItem.village || "",
                mandal: reqItem.mandal || "",
                district: reqItem.district || "",
                vcNumber: reqItem.vcNumber || reqItem.stbId || "",
                amount: commRate,
                type: "Credit",
                category: "Service Request",
                description: `Service Request Resolved: ${reqItem.customerName} (${reqItem.dthCompany})`,
                referenceId: reqItem.id,
                createdAt: Timestamp.now(),
              });

              toast({
                title: `Service Request Resolved & Wallet Credited! 💰`,
                description: `₹${commRate} commission credited to ${matchedRetailer.retailerName}'s wallet balance.`,
              });
            } else {
              toast({
                title: `Service Request Marked as '${newStatus}'`,
                description: `Could not auto-credit wallet (Retailer record not matched).`,
              });
            }
          } catch (walletErr) {
            console.error("Wallet credit error:", walletErr);
            toast({
              title: `Service Request Marked as '${newStatus}'`,
              description: `Status updated, but wallet credit encountered an issue.`,
            });
          }
        } else {
          toast({ title: `Service Request Marked as '${newStatus}'` });
        }
      } catch (err) {
        console.error(err);
        toast({ variant: "destructive", title: "Update Failed" });
      }
    };

    return (
      <Card className="md:col-span-2 lg:col-span-3 bg-slate-900 border-amber-500/50 text-slate-100 shadow-2xl overflow-hidden mb-2">
        <CardHeader className="bg-gradient-to-r from-slate-900 via-amber-950/40 to-slate-900 border-b border-slate-800 p-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-bold text-amber-400 flex items-center gap-2">
              <Wrench className="h-5 w-5 text-amber-400" />
              Live Service Requests & Complaints (సర్వీస్ రిక్వెస్ట్‌లు)
            </CardTitle>
            <Badge className="bg-amber-500 text-slate-950 font-black">
              {visibleServiceRequests.filter((r) => r.status === "Pending").length} Pending
            </Badge>
          </div>
          <CardDescription className="text-slate-400 text-xs mt-1">
            Complaints submitted by Retailers & Customers. Select status to dispatch technicians.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          {visibleServiceRequests.map((req) => (
            <div
              key={req.id}
              className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 rounded-xl bg-slate-950 border border-slate-800 gap-4 hover:border-amber-500/40 transition-all"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-base text-white">{req.customerName}</span>
                  <Badge variant="outline" className="border-amber-500/60 text-amber-400 font-semibold text-xs">
                    {req.dthCompany}
                  </Badge>
                  <Badge
                    className={
                      req.status === "Resolved"
                        ? "bg-emerald-950 text-emerald-300 border-emerald-800"
                        : req.status === "In Progress"
                        ? "bg-blue-950 text-blue-300 border-blue-800"
                        : "bg-amber-950 text-amber-300 border-amber-800"
                    }
                  >
                    {req.status || "Pending"}
                  </Badge>

                  {/* Retailer / Sender Badge with Mobile Number */}
                  {(() => {
                    const matchedRetailer = retailersList.find(
                      (r) =>
                        (r.uid && r.uid === req.requestedByUid) ||
                        (r.retailerName && r.retailerName?.toLowerCase() === req.requestedByName?.toLowerCase()) ||
                        (r.contactPerson && r.contactPerson?.toLowerCase() === req.requestedByName?.toLowerCase()) ||
                        (r.formattedEmail && r.formattedEmail === req.requestedByName)
                    );
                    const retailerMobile =
                      req.requestedByMobile ||
                      matchedRetailer?.mobile ||
                      matchedRetailer?.contactPersonPhone ||
                      "";

                    return (
                      <Badge className="bg-purple-950/90 text-purple-200 border border-purple-600/60 text-xs font-bold flex items-center gap-1.5 px-2.5 py-1 shadow-sm">
                        <Building2 className="h-3.5 w-3.5 text-purple-400 shrink-0" />
                        <span>
                          Retailer: <strong className="text-amber-300">{req.requestedByName || "Retailer Partner"}</strong>
                          {retailerMobile ? (
                            <span className="ml-1.5 text-emerald-300 font-mono font-bold">
                              (📱 {retailerMobile})
                            </span>
                          ) : null}
                        </span>
                      </Badge>
                    );
                  })()}
                </div>
                <p className="text-xs text-slate-300 flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 text-emerald-400" /> <strong className="text-white">{req.mobile}</strong>
                  <span className="text-slate-500">|</span>
                  <MapPin className="h-3.5 w-3.5 text-amber-400" /> {req.village}, {req.mandal}, {req.district}
                </p>
                <p className="text-xs text-slate-400">
                  <strong className="text-slate-300">Issue:</strong> {req.complaintType} {req.notes && `(${req.notes})`}
                </p>
                <p className="text-[11px] text-cyan-400 font-medium">
                  🗓️ Scheduled Visit: <strong>{req.scheduledDate}</strong> ({req.scheduledTime})
                </p>
              </div>

              <div className="flex items-center gap-2 self-end md:self-center">
                {req.status !== "Resolved" && (
                  <Button
                    size="sm"
                    onClick={() => handleUpdateSRStatus(req, "Resolved")}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
                  >
                    Mark Resolved
                  </Button>
                )}
                {req.status === "Pending" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleUpdateSRStatus(req, "In Progress")}
                    className="border-blue-600 text-blue-400 hover:bg-blue-950 text-xs font-bold"
                  >
                    In Progress
                  </Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  };

  const AdminDashboard = () => (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <AdminNewConnectionsCard />
        <AdminServiceRequestsCard />
        <RechargeRequestsCard canApprove={true} />
        <SettlementRequestsCard />
        <AdminCollectionCard />
        <Card className="bg-red-100 text-red-800 animate-slide-in-fade-in">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Outstanding</CardTitle>
            <CircleDollarSign className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
            <div className="text-2xl font-bold">₹{stats.totalPending.toLocaleString()}</div>
            </CardContent>
        </Card>
        <Card className="bg-green-100 text-green-800 animate-slide-in-fade-in">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
                Active Customers
            </CardTitle>
            <Users className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
            <div className="text-2xl font-bold">{stats.activeCustomers}</div>
            </CardContent>
        </Card>
        <Card className="bg-blue-100 text-blue-800 animate-slide-in-fade-in">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Packages</CardTitle>
            <Package className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
            <div className="text-2xl font-bold">{stats.activePackages}</div>
            </CardContent>
        </Card>
        <Card className="bg-yellow-100 text-yellow-800 animate-slide-in-fade-in">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
                All Collection Agents
            </CardTitle>
            <UserCheck className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
            <div className="text-2xl font-bold">{stats.collectionAgents}</div>
            </CardContent>
        </Card>
        <Card className="bg-indigo-100 text-indigo-800 animate-slide-in-fade-in">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Collection</CardTitle>
            <CircleDollarSign className="h-4 w-4 text-indigo-500" />
            </CardHeader>
            <CardContent>
            <div className="text-2xl font-bold">₹{stats.todaysCollection.toLocaleString()}</div>
            </CardContent>
        </Card>
        <Card className="bg-purple-100 text-purple-800 animate-slide-in-fade-in">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month's Collection</CardTitle>
            <CircleDollarSign className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
            <div className="text-2xl font-bold">₹{stats.monthlyCollection.toLocaleString()}</div>
            </CardContent>
        </Card>
    </div>
  );

  const StaffDashboard = () => {
     const hasPendingRequest = settlementRequests.some(req => req.status === 'pending' && req.staffId === currentUser?.uid);
     const { walletAmount, commissionAmount } = staffWallet;
     const isNetworkServiceAgent = userRole?.toLowerCase().replace(/\s/g, "") === 'networkserviceagent';
     const canApproveRecharge = !isNetworkServiceAgent && !/collection|collation/i.test(userRole || '');

     return (
       <div className="space-y-6 animate-slide-in-fade-in">

         {/* Quick Action Cards */}
         <div className="grid gap-4 md:grid-cols-3">
           {/* Recharge / Request Recharge */}
           {isNetworkServiceAgent ? (
             <Link href="/dashboard/request-recharge" className="block">
               <Card className="bg-blue-600 text-white hover:bg-blue-500 transition-all hover:shadow-lg hover:-translate-y-0.5 cursor-pointer h-full">
                 <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                   <CardTitle className="text-sm font-semibold">Request Recharge</CardTitle>
                   <Send className="h-5 w-5" />
                 </CardHeader>
                 <CardContent>
                   <p className="text-xs text-blue-100">Request a customer recharge from admin</p>
                   <div className="flex items-center gap-1 mt-3 text-xs font-bold">
                     Go to Requests <ArrowRight className="h-3 w-3" />
                   </div>
                 </CardContent>
               </Card>
             </Link>
           ) : (
             <Card
               className="bg-emerald-600 text-white hover:bg-emerald-500 transition-all hover:shadow-lg hover:-translate-y-0.5 cursor-pointer"
               onClick={() => setIsRechargeSearchDialogOpen(true)}
             >
               <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                 <CardTitle className="text-sm font-semibold">Recharge Customer</CardTitle>
                 <CreditCard className="h-5 w-5" />
               </CardHeader>
               <CardContent>
                 <p className="text-xs text-emerald-100">Recharge a customer account quickly</p>
                 <div className="flex items-center gap-1 mt-3 text-xs font-bold">
                   Click to Search <ArrowRight className="h-3 w-3" />
                 </div>
               </CardContent>
             </Card>
           )}

           {/* Collect Payment */}
           <Card
             className="bg-orange-500 text-white hover:bg-orange-400 transition-all hover:shadow-lg hover:-translate-y-0.5 cursor-pointer"
             onClick={() => setIsCustomerSearchDialogOpen(true)}
           >
             <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
               <CardTitle className="text-sm font-semibold">Collect Payment</CardTitle>
               <IndianRupee className="h-5 w-5" />
             </CardHeader>
             <CardContent>
               <p className="text-xs text-orange-100">Collect payment from a customer</p>
               <div className="flex items-center gap-1 mt-3 text-xs font-bold">
                 Click to Search <ArrowRight className="h-3 w-3" />
               </div>
             </CardContent>
           </Card>

           {/* Recharge Requests */}
           <Link href="/dashboard/request-recharge" className="block">
             <Card className="bg-purple-600 text-white hover:bg-purple-500 transition-all hover:shadow-lg hover:-translate-y-0.5 cursor-pointer h-full">
               <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                 <CardTitle className="text-sm font-semibold">Recharge Requests</CardTitle>
                 <Gift className="h-5 w-5" />
               </CardHeader>
               <CardContent>
                 <p className="text-xs text-purple-100">View pending recharge requests</p>
                 <div className="flex items-center gap-1 mt-3 text-xs font-bold">
                   View All <ArrowRight className="h-3 w-3" />
                 </div>
               </CardContent>
             </Card>
           </Link>
         </div>

         {/* Stats Row */}
         <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
           <Card className="border-l-4 border-l-red-500 bg-red-50 dark:bg-red-950/30">
             <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
               <CardTitle className="text-sm font-medium text-red-700 dark:text-red-400">Total Outstanding</CardTitle>
               <CircleDollarSign className="h-4 w-4 text-red-500" />
             </CardHeader>
             <CardContent>
               <div className="text-2xl font-bold text-red-700 dark:text-red-400">₹{totalPendingForStaff.toLocaleString()}</div>
               <p className="text-xs text-muted-foreground mt-1">మొత్తం బకాయి</p>
             </CardContent>
           </Card>

           <Card className="border-l-4 border-l-blue-500 bg-blue-50 dark:bg-blue-950/30">
             <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
               <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-400">Today's Collection</CardTitle>
               <IndianRupee className="h-4 w-4 text-blue-500" />
             </CardHeader>
             <CardContent>
               <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">₹{todaysCollectionForStaff.toLocaleString()}</div>
               <p className="text-xs text-muted-foreground mt-1">ఈ రోజు వసూళ్ళు</p>
             </CardContent>
           </Card>

           <Card className="border-l-4 border-l-emerald-500 bg-emerald-50 dark:bg-emerald-950/30">
             <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
               <CardTitle className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Collection Wallet</CardTitle>
               <Wallet className="h-4 w-4 text-emerald-500" />
             </CardHeader>
             <CardContent>
               <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">₹{walletAmount.toLocaleString()}</div>
               <p className="text-xs text-muted-foreground mt-1">Last settlement నుండి మొత్తం</p>
             </CardContent>
           </Card>

           <Card className="border-l-4 border-l-amber-500 bg-amber-50 dark:bg-amber-950/30">
             <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
               <CardTitle className="text-sm font-medium text-amber-700 dark:text-amber-400">Commission Wallet</CardTitle>
               <IndianRupee className="h-4 w-4 text-amber-500" />
             </CardHeader>
             <CardContent>
               <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">₹{commissionAmount.toLocaleString()}</div>
               <p className="text-xs text-muted-foreground mt-1">ఈ నెల మొత్తం కమీషన్</p>
             </CardContent>
           </Card>
         </div>

         {/* Bottom Row: Settle Collection + Recharge Requests Card */}
         <div className="grid gap-4 md:grid-cols-2">
           {/* Settle Collection */}
           <Card>
             <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
               <CardTitle className="text-base font-semibold flex items-center gap-2">
                 <ArrowLeftRight className="h-5 w-5 text-primary" />
                 Settle Collection (అడ్మిన్‌కు పంపించండి)
               </CardTitle>
             </CardHeader>
             <CardContent className="space-y-3">
               <div className="flex items-center justify-between rounded-lg bg-muted p-3">
                 <span className="text-sm text-muted-foreground">Amount to Settle</span>
                 <span className="text-xl font-bold">₹{walletAmount.toLocaleString()}</span>
               </div>
               {hasPendingRequest ? (
                 <div className="space-y-2">
                   <Button className="w-full" disabled variant="outline">
                     <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Approval Pending...
                   </Button>
                   <Button className="w-full" variant="ghost" onClick={handleCancelSettlement}>
                     Cancel Request
                   </Button>
                   <p className="text-xs text-muted-foreground text-center">మీ అభ్యర్థన అడ్మిన్ అప్రూవల్ కోసం వేచి ఉంది.</p>
                 </div>
               ) : (
                 <div className="space-y-2">
                   <Button
                     className="w-full bg-primary hover:bg-primary/90"
                     onClick={() => { setSettlementAmount(String(walletAmount)); setIsSettleDialogOpen(true); }}
                     disabled={walletAmount === 0}
                   >
                     <Send className="mr-2 h-4 w-4" /> Send to Admin
                   </Button>
                   <p className="text-xs text-muted-foreground text-center">వసూల్ చేసిన మొత్తాన్ని అడ్మిన్‌కు పంపండి.</p>
                 </div>
               )}
             </CardContent>
           </Card>

           {/* Commission Info */}
           <Card>
             <CardHeader className="pb-2">
               <CardTitle className="text-base font-semibold flex items-center gap-2">
                 <Gift className="h-5 w-5 text-amber-500" />
                 మీ కమీషన్ వివరాలు
               </CardTitle>
             </CardHeader>
             <CardContent className="space-y-3 text-sm">
               <div className="flex items-center justify-between rounded-lg bg-muted p-2.5">
                 <div>
                   <p className="font-semibold">కలెక్షన్ కమీషన్</p>
                   <p className="text-xs text-muted-foreground">వసూలు చేసే మొత్తంపై కమీషన్</p>
                 </div>
                 <span className="text-base font-bold text-primary">{staffData?.commission || 'N/A'}</span>
               </div>
               <div className="flex items-center justify-between rounded-lg bg-muted p-2.5">
                 <div>
                   <p className="font-semibold">కొత్త కస్టమర్ కమీషన్</p>
                   <p className="text-xs text-muted-foreground">ప్రతి నూతన కస్టమర్‌కు</p>
                 </div>
                 <span className="text-base font-bold text-primary">₹{staffData?.enrollmentCommission?.toLocaleString() || 'N/A'}</span>
               </div>
             </CardContent>
           </Card>
         </div>

         {/* Recharge Requests section */}
         <RechargeRequestsCard canApprove={canApproveRecharge} />
       </div>
     );
  };

  const DealerDashboard = () => (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 animate-slide-in-fade-in">
      <Card className="bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
        <Link href="/dashboard/dishtv-customers" className="block h-full">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Manage DishTV Customers</CardTitle>
            <Tv className="h-5 w-5 text-primary-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{dealerStats.total}</div>
            <div className="flex items-center justify-between mt-2 text-xs opacity-90">
              <span>View & Manage Customers</span>
              <ArrowRight className="h-4 w-4" />
            </div>
          </CardContent>
        </Link>
      </Card>

      <Card className="bg-emerald-600 text-white">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Active Customers</CardTitle>
          <Users className="h-5 w-5 text-white" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{dealerStats.active}</div>
          <p className="text-xs mt-1 text-emerald-100">Currently active DishTV plans</p>
        </CardContent>
      </Card>

      <Card className="bg-amber-600 text-white">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Expired Connections</CardTitle>
          <XCircle className="h-5 w-5 text-white" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{dealerStats.expired}</div>
          <p className="text-xs mt-1 text-amber-100">Requires recharge extension</p>
        </CardContent>
      </Card>

      <Card className="bg-blue-600 text-white">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Outstanding Balance</CardTitle>
          <IndianRupee className="h-5 w-5 text-white" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">₹{dealerStats.totalOutstanding.toLocaleString()}</div>
          <p className="text-xs mt-1 text-blue-100">Total collection pending amount (మొత్తం బకాయి)</p>
        </CardContent>
      </Card>
    </div>
  );

  const RetailerDashboardView = () => {
    const [activeTab, setActiveTab] = useState<"recharges" | "new_connections" | "service">("recharges");

    const myRecharges = visibleRechargeRequests.filter(
      (r) => r.requestedByUid === currentUser?.uid || !r.requestedByUid
    );
    const myNCs = visibleNewConnections.filter(
      (r) => r.requestedByUid === currentUser?.uid
    );
    const myService = visibleServiceRequests.filter(
      (r) => r.requestedByUid === currentUser?.uid || !r.requestedByUid
    );

    const pendingServiceCount = myService.filter((r) => r.status === "Pending").length;
    const inProgressServiceCount = myService.filter((r) => r.status === "In Progress").length;
    const resolvedServiceCount = myService.filter((r) => r.status === "Resolved").length;

    return (
      <div className="space-y-4 max-w-full overflow-hidden">
        {/* Mobile-Optimized Pill Selector Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-900/90 border border-slate-800 rounded-xl overflow-x-auto no-scrollbar scrollbar-none">
          <button
            onClick={() => setActiveTab("recharges")}
            className={cn(
              "flex-1 min-w-[120px] px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 shrink-0",
              activeTab === "recharges"
                ? "bg-indigo-600 text-white shadow-md"
                : "text-slate-400 hover:text-white hover:bg-slate-800/60"
            )}
          >
            <Tv className="h-3.5 w-3.5 text-cyan-300" />
            <span>రిచార్జ్ స్థితి</span>
            {myRecharges.length > 0 && (
              <span className="bg-indigo-950 text-cyan-300 border border-indigo-500/40 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                {myRecharges.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("new_connections")}
            className={cn(
              "flex-1 min-w-[130px] px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 shrink-0",
              activeTab === "new_connections"
                ? "bg-emerald-600 text-white shadow-md"
                : "text-slate-400 hover:text-white hover:bg-slate-800/60"
            )}
          >
            <Package className="h-3.5 w-3.5 text-emerald-300" />
            <span>కొత్త కనెక్షన్స్</span>
            {myNCs.length > 0 && (
              <span className="bg-emerald-950 text-emerald-300 border border-emerald-500/40 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                {myNCs.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("service")}
            className={cn(
              "flex-1 min-w-[130px] px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 shrink-0",
              activeTab === "service"
                ? "bg-amber-600 text-white shadow-md"
                : "text-slate-400 hover:text-white hover:bg-slate-800/60"
            )}
          >
            <Wrench className="h-3.5 w-3.5 text-amber-300" />
            <span>సర్వీస్ రిక్వెస్ట్స్</span>
            {myService.length > 0 && (
              <span className="bg-amber-950 text-amber-300 border border-amber-500/40 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                {myService.length}
              </span>
            )}
          </button>
        </div>

        {/* Tab 1: DishTV Recharge Requests */}
        {activeTab === "recharges" && (
          <Card className="bg-slate-900 border-indigo-700/50 text-white shadow-xl">
            <CardHeader className="p-4 border-b border-slate-800 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-cyan-300 flex items-center gap-2">
                  <Tv className="h-4 w-4 text-cyan-300" />
                  My DishTV Recharge Requests (రిచార్జ్ స్థితి)
                </CardTitle>
                <CardDescription className="text-xs text-slate-400 mt-0.5">
                  అడ్మిన్ అప్రూవ్ చేయగానే మీ వాలెట్‌కు కమీషన్ ఆటోమేటిక్‌గా క్రెడిట్ అవుతుంది.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 space-y-3">
              {myRecharges.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-slate-800 rounded-xl bg-slate-950/50 p-4 space-y-2">
                  <Tv className="h-8 w-8 text-slate-600 mx-auto" />
                  <p className="text-xs text-slate-400">ప్రస్తుతానికి ఏ రిచార్జ్ రిక్వెస్ట్‌లు లేవు.</p>
                  <p className="text-[11px] text-slate-500">పై సెర్చ్ బార్‌లో కస్టమర్ VC నంబర్ టైప్ చేసి ఆఫర్ ప్యాకేజ్ ఎంచుకోండి.</p>
                </div>
              ) : (
                myRecharges.map((req: any) => {
                  const isCompleted = req.status === "Completed" || req.status === "Approved";
                  const isRejected = req.status === "Rejected";

                  return (
                    <div
                      key={req.id}
                      className={cn(
                        "p-3.5 rounded-xl border transition-all space-y-2",
                        isCompleted
                          ? "bg-emerald-950/30 border-emerald-700/40"
                          : isRejected
                          ? "bg-rose-950/30 border-rose-700/40"
                          : "bg-slate-950 border-slate-800"
                      )}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 border-b border-slate-800/80 pb-2">
                        <div className="flex items-center justify-between sm:justify-start gap-2 w-full sm:w-auto">
                          <h4 className="font-bold text-white text-sm truncate max-w-[180px] sm:max-w-none">{req.customerName}</h4>
                          <span className="font-mono text-purple-300 text-[11px] font-bold bg-purple-950/80 border border-purple-800 px-2 py-0.5 rounded">
                            VC: {req.vcNumber}
                          </span>
                        </div>
                        <Badge
                          className={cn(
                            "w-fit text-[11px] px-2.5 py-0.5 font-bold",
                            isCompleted
                              ? "bg-emerald-500 text-white"
                              : isRejected
                              ? "bg-rose-600 text-white"
                              : "bg-amber-500 text-white animate-pulse"
                          )}
                        >
                          {isCompleted ? "✅ Completed (రిచార్జ్ అయింది)" : isRejected ? "❌ Rejected" : "⏳ Pending Approval"}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300">
                        <div>
                          <span className="text-slate-400 block">Mobile:</span>
                          <strong className="text-emerald-400 font-mono">{req.mobile}</strong>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Package & Months:</span>
                          <strong className="text-cyan-300">{req.packagePlan} ({req.durationMonths}M)</strong>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Amount:</span>
                          <strong className="text-emerald-300 font-bold">₹{req.amount}</strong>
                        </div>
                        <div>
                          <span className="text-slate-400 block">UTR Number:</span>
                          <strong className="text-amber-300 font-mono text-[11px] truncate block">{req.utrNumber}</strong>
                        </div>
                      </div>

                      {isCompleted && req.commissionEarned > 0 && (
                        <div className="p-2 rounded-lg bg-emerald-900/40 border border-emerald-700/50 text-[11px] text-emerald-200 flex items-center justify-between font-bold">
                          <span>💰 Margin Credited ({req.commissionRate || 5}%):</span>
                          <span className="text-emerald-300 font-mono">+₹{req.commissionEarned} Wallet Credited</span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        )}

        {/* Tab 2: New Connections */}
        {activeTab === "new_connections" && (
          <Card className="bg-slate-900 border-emerald-500/40 text-slate-100 shadow-xl">
            <CardHeader className="p-4 border-b border-slate-800 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-emerald-400 flex items-center gap-2">
                  <Package className="h-4 w-4 text-emerald-400" />
                  My New Connection Requests (కొత్త కనెక్షన్లు)
                </CardTitle>
                <CardDescription className="text-xs text-slate-400 mt-0.5">
                  ఇన్‌స్టాలేషన్ పూర్తయిన తర్వాత కమీషన్ మీ వాలెట్‌కు చేరుతుంది.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 space-y-3">
              {myNCs.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-slate-800 rounded-xl bg-slate-950/50 p-4 space-y-2">
                  <Package className="h-8 w-8 text-slate-600 mx-auto" />
                  <p className="text-xs text-slate-400">ప్రస్తుతానికి ఏ కొత్త కనెక్షన్ రిక్వెస్ట్‌లు లేవు.</p>
                </div>
              ) : (
                myNCs.map((nc: any) => {
                  const status = nc.status || "Pending";
                  return (
                    <div key={nc.id} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 border-b border-slate-800 pb-2">
                        <div>
                          <h4 className="font-bold text-white text-sm">{nc.customerName}</h4>
                          <p className="text-[11px] text-slate-300 flex items-center gap-1.5 mt-0.5">
                            <Phone className="h-3 w-3 text-emerald-400" /> <strong className="text-white">{nc.mobile}</strong>
                            <span className="text-slate-600">|</span>
                            <MapPin className="h-3 w-3 text-amber-400" /> {nc.village}
                          </p>
                        </div>
                        <Badge className={cn("w-fit text-[11px] px-2 py-0.5 font-bold", status === "Pending" ? "bg-amber-500 text-white animate-pulse" : "bg-emerald-500 text-white")}>
                          {status === "Pending" ? "⏳ Pending" : "✅ Installed"}
                        </Badge>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        <span>📅 Scheduled: <strong className="text-cyan-300">{nc.scheduledDate} ({nc.scheduledTime})</strong></span>
                      </div>
                      <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden p-0.5 border border-slate-800">
                        <div className={cn("h-full rounded-full transition-all duration-500", status === "Pending" ? "w-1/2 bg-amber-500" : "w-full bg-emerald-500")} />
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        )}

        {/* Tab 3: Service Complaints */}
        {activeTab === "service" && (
          <Card className="bg-slate-900 border-amber-500/40 text-slate-100 shadow-xl">
            <CardHeader className="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base font-bold text-amber-400 flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-amber-400" />
                  My Service Complaints (సర్వీస్ ఫిర్యాదులు)
                </CardTitle>
                <CardDescription className="text-xs text-slate-400 mt-0.5">
                  మీరు పంపిన సర్వీస్ కాంప్లైంట్ల ప్రస్తుత స్థితి.
                </CardDescription>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <Badge variant="outline" className="border-amber-500/60 text-amber-400 bg-amber-950/40 px-2 py-0.5 text-[11px] font-bold">
                  ⏳ {pendingServiceCount}
                </Badge>
                <Badge variant="outline" className="border-blue-500/60 text-blue-400 bg-blue-950/40 px-2 py-0.5 text-[11px] font-bold">
                  🔄 {inProgressServiceCount}
                </Badge>
                <Badge variant="outline" className="border-emerald-500/60 text-emerald-400 bg-emerald-950/40 px-2 py-0.5 text-[11px] font-bold">
                  ✅ {resolvedServiceCount}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="p-3 sm:p-4 space-y-3">
              {myService.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-slate-800 rounded-xl bg-slate-950/50 p-4 space-y-2">
                  <Wrench className="h-8 w-8 text-slate-600 mx-auto" />
                  <p className="text-xs text-slate-400">ప్రస్తుతానికి ఏ సర్వీస్ రిక్వెస్ట్‌లు లేవు.</p>
                  <Button
                    onClick={() => setIsServiceRequestOpen(true)}
                    className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-3 py-1.5 h-auto"
                  >
                    <Wrench className="h-3.5 w-3.5 mr-1" /> + Service Request సబ్మిట్ చేయండి
                  </Button>
                </div>
              ) : (
                myService.map((req: any) => {
                  const status = req.status || "Pending";
                  return (
                    <div key={req.id} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 border-b border-slate-800 pb-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-white">{req.customerName}</h4>
                            <Badge className="bg-amber-500/20 text-amber-300 border border-amber-500/50 text-[10px] px-1.5 py-0.2">
                              {req.dthCompany}
                            </Badge>
                          </div>
                          <p className="text-[11px] text-slate-300 flex items-center gap-1.5 mt-0.5">
                            <Phone className="h-3 w-3 text-emerald-400" /> <strong>{req.mobile}</strong>
                            <span className="text-slate-600">|</span>
                            <MapPin className="h-3 w-3 text-amber-400" /> {req.village}
                          </p>
                        </div>
                        <Badge
                          className={cn(
                            "w-fit text-[11px] px-2 py-0.5 font-bold",
                            status === "Pending"
                              ? "bg-amber-500/20 text-amber-400 border border-amber-500 animate-pulse"
                              : status === "In Progress"
                              ? "bg-blue-500/20 text-blue-300 border border-blue-500 animate-pulse"
                              : "bg-emerald-500/20 text-emerald-400 border border-emerald-500"
                          )}
                        >
                          {status === "Pending" ? "⏳ Pending" : status === "In Progress" ? "🔄 In Progress" : "✅ Resolved"}
                        </Badge>
                      </div>

                      <div className="text-[11px] bg-slate-900 p-2.5 rounded-lg border border-slate-800 space-y-1">
                        <div>
                          <span className="text-slate-400">Issue: </span>
                          <strong className="text-slate-200">{req.complaintType} {req.notes && `(${req.notes})`}</strong>
                        </div>
                        <div>
                          <span className="text-slate-400">Visit: </span>
                          <strong className="text-cyan-300">📅 {req.scheduledDate} ({req.scheduledTime})</strong>
                        </div>
                      </div>

                      <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden p-0.5 border border-slate-800">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-500",
                            status === "Pending" ? "w-1/3 bg-amber-500" : status === "In Progress" ? "w-2/3 bg-blue-500" : "w-full bg-emerald-500"
                          )}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  const AdminRechargeRequestsCard = () => {
    const pendingRecharges = liveRechargeRequests.filter((r) => r.status === "Pending");

    if (pendingRecharges.length === 0) return null;

    return (
      <Card className="bg-slate-900 border-amber-500/50 text-white shadow-2xl mb-6">
        <CardHeader className="pb-3 border-b border-slate-800 flex flex-row items-center justify-between bg-amber-950/30">
          <div>
            <CardTitle className="text-base font-bold text-amber-400 flex items-center gap-2">
              <Tv className="h-5 w-5 text-amber-400" />
              Pending DishTV Recharge Requests (రిటైలర్ డిష్‌టీవీ రిచార్జ్ రిక్వెస్ట్‌లు)
            </CardTitle>
            <CardDescription className="text-xs text-slate-300">
              రిటైలర్ పంపిన UTR నంబర్ ధృవీకరించి అప్రూవ్ చేయండి. రిటైలర్ వాలెట్‌కు కమీషన్ అమౌంట్ క్రెడిట్ అవుతుంది.
            </CardDescription>
          </div>
          <Badge className="bg-amber-500 text-slate-950 border-none text-xs px-3 py-1 font-extrabold animate-bounce">
            {pendingRecharges.length} PENDING
          </Badge>
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          {pendingRecharges.map((req: any) => (
            <div
              key={req.id}
              className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3 hover:border-amber-500/50 transition-all shadow-md"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-white text-base">{req.customerName}</h4>
                    <span className="font-mono text-purple-300 text-xs font-bold bg-purple-950 border border-purple-800 px-2 py-0.5 rounded">
                      VC: {req.vcNumber}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    <strong className="text-slate-300">Requested By:</strong> {req.requestedByName} ({req.requestedByRole || "Retailer"})
                  </p>
                </div>
                <Badge className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs px-2.5 py-1 font-bold">
                  Pending Verification
                </Badge>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-slate-900 p-3 rounded-lg border border-slate-800">
                <div>
                  <span className="text-slate-400 block text-[11px]">Contact Mobile:</span>
                  <strong className="text-emerald-400 font-mono">{req.mobile}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Location / Address:</span>
                  <strong className="text-slate-200">{req.fullAddress || req.village || "N/A"}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Package & Duration:</span>
                  <strong className="text-cyan-300">{req.packagePlan} ({req.durationMonths} Month{req.durationMonths > 1 ? 's' : ''})</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Amount & UTR:</span>
                  <strong className="text-emerald-400 text-sm font-bold block">₹{req.amount}</strong>
                  <span className="text-amber-300 font-mono text-xs block">UTR: {req.utrNumber}</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={processingRechargeId === req.id}
                  onClick={() => handleRejectDishTvRecharge(req.id)}
                  className="border-rose-800/80 text-rose-400 hover:bg-rose-950 hover:text-rose-200 text-xs font-bold"
                >
                  <XCircle className="w-4 h-4 mr-1" /> Reject
                </Button>
                <Button
                  size="sm"
                  disabled={processingRechargeId === req.id}
                  onClick={() => handleApproveDishTvRecharge(req)}
                  className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg"
                >
                  {processingRechargeId === req.id ? (
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 mr-1" />
                  )}
                  Approve & Complete Recharge (కమీషన్ క్రెడిట్ చేయండి)
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  };

  const renderDashboard = () => {
    if (authLoading || firestoreLoading) {
      return (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      );
    }
    
    if (userRole === 'Admin') return (
      <div className="space-y-6">
        <AdminRechargeRequestsCard />
        <AdminDashboard />
      </div>
    );
    if (userRole === 'Retailer') return <RetailerDashboardView />;
    if (userRole === 'Dealer') return <DealerDashboard />;
    if (userRole) return <StaffDashboard />;

    return (
        <div className="text-center">
            <p>Welcome! Your role is not fully configured.</p>
        </div>
    );
  };
  
    const cleanupSearchDialog = (setDialogOpen: (val: boolean) => void) => {
        setDialogOpen(false);
        setSearchedCustomer(null);
        setSearchQuery("");
        setSearchError("");
    };

    const selectedPackageDetails = selectedPackage ? packages.find(p => p.id === selectedPackage) : null;
    
    const baseAmount = selectedPackageDetails ? parseFloat(selectedPackageDetails.packageAmount) : 0;
    const offer = rechargeOffers.find(o => o.months === rechargeMonths);
    const discount = offer ? (baseAmount * rechargeMonths * offer.discountPercentage) / 100 : 0;
    const totalRechargeAmount = baseAmount * rechargeMonths - discount;

    const newBalance = searchedCustomer && selectedPackageDetails && !paymentReceivedForRecharge
        ? parseFloat(String(searchedCustomer.balanceAmount)) + totalRechargeAmount
        : searchedCustomer?.balanceAmount;
    const handleOpenService = (cust: DishTvCustomer) => {
      setServiceCustomer(cust);
      setServiceType("Cable Shift / Relocation");
      setServiceAmount("250");
      setServiceNotes("");
      setIsServiceDialogOpen(true);
    };

    const handleConfirmService = async () => {
      if (!serviceCustomer || !currentUser) return;
      setIsSavingService(true);

      try {
        const addedAmt = parseFloat(serviceAmount) || 0;
        const currentBal = serviceCustomer.balanceAmount !== undefined
          ? serviceCustomer.balanceAmount
          : (serviceCustomer.monthlyAmount || 350);
        const newBal = currentBal + addedAmt;

        // 1. Log service record in dishtv_services
        await addDoc(collection(db, "dishtv_services"), {
          customerId: serviceCustomer.id,
          customerName: serviceCustomer.name,
          mobile: serviceCustomer.mobile,
          serviceType: serviceType,
          amount: addedAmt,
          notes: serviceNotes.trim(),
          addedByUid: currentUser.uid,
          addedByName: currentUser.displayName || currentUser.email || "Dealer",
          createdAt: Timestamp.now(),
        });

        // 2. Update customer balanceAmount in dishtv_customers
        await updateDoc(doc(db, "dishtv_customers", serviceCustomer.id), {
          balanceAmount: newBal,
        });

        // 3. Update state in topSearchResults if present
        setAllDishTvCustomers((prev) =>
          prev.map((c) => (c.id === serviceCustomer.id ? { ...c, balanceAmount: newBal } : c))
        );

        toast({
          title: "Service Charge Added! 🛠️",
          description: `Added ₹${addedAmt} for ${serviceType} to ${serviceCustomer.name}'s balance. New Balance: ₹${newBal}.`,
        });

        setIsServiceDialogOpen(false);
      } catch (err) {
        console.error("Service charge error:", err);
        toast({
          variant: "destructive",
          title: "Service Charge Failed",
          description: "Failed to add service charge.",
        });
      } finally {
        setIsSavingService(false);
      }
    };

  const isLimitBreached = (staffData?.collectionLimit ?? 10000) > 0 && (staffWallet?.walletAmount || 0) >= (staffData?.collectionLimit ?? 10000);
  const isInactiveStaff = !authLoading && userRole && userRole !== 'Admin' && userRole !== 'Dealer' && userRole !== 'Retailer' && (userStatus === 'inactive' || staffData?.status === 'inactive' || isLimitBreached);

  if (isInactiveStaff) {
    const hasPendingRequest = settlementRequests.some(req => req.status === 'pending' && req.staffId === currentUser?.uid);
    
    return (
      <>
        <main className="min-h-screen w-full font-body text-foreground">
          <div className="container mx-auto flex flex-col items-center p-4 py-8 md:p-12 max-w-2xl space-y-6">
            <div className="w-full text-center sm:text-left">
              <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
                Staff Dashboard
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Welcome, <span className="font-semibold text-foreground">{staffData?.name || shopName || currentUser?.email}</span> ({userRole})
              </p>
            </div>

            <div className="w-full rounded-2xl border border-destructive/40 bg-destructive/10 p-5 text-destructive flex items-start gap-4 shadow-sm">
              <AlertCircle className="h-6 w-6 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-base md:text-lg">Account Status: Inactive (ఖాతా ఇన్యాక్టివ్‌లో ఉంది)</h3>
                <p className="text-xs md:text-sm mt-1 text-destructive/90">
                  Your account is currently marked as inactive. Please settle your balance with Admin to activate your account and regain full system access.
                </p>
              </div>
            </div>

            <Card className="w-full shadow-xl border-2 border-orange-500/30 bg-card overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-orange-500/10 via-amber-500/5 to-transparent border-b border-orange-500/10 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-orange-500/20 text-orange-600 dark:text-orange-400">
                    <Wallet className="h-7 w-7" />
                  </div>
                  <div>
                    <CardTitle className="text-xl md:text-2xl font-bold">
                      Pending / Collected Balance Amount
                    </CardTitle>
                    <CardDescription className="text-xs md:text-sm mt-0.5">
                      Total Cash in Hand / Pending Balance
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 md:p-8 space-y-6">
                <div className="bg-gradient-to-br from-orange-500/10 via-amber-500/10 to-orange-500/5 border-2 border-orange-500/20 rounded-2xl p-6 text-center shadow-inner">
                  <span className="text-sm font-semibold text-muted-foreground block mb-2 uppercase tracking-wide">
                    Total Cash in Hand / Pending Balance
                  </span>
                  <span className="text-4xl md:text-5xl font-black text-orange-600 dark:text-orange-400 tracking-tight">
                    ₹{staffWallet.walletAmount.toLocaleString('en-IN')}
                  </span>
                </div>

                <div className="space-y-3 pt-2">
                  {hasPendingRequest ? (
                    <div className="space-y-2 text-center">
                      <Button className="w-full py-6 text-base font-bold" disabled variant="outline">
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Settlement Request Pending with Admin...
                      </Button>
                      <Button className="w-full" variant="ghost" onClick={handleCancelSettlement}>
                        Cancel Request
                      </Button>
                    </div>
                  ) : (
                    <Button
                      className="w-full py-6 text-base font-bold bg-orange-600 hover:bg-orange-700 text-white shadow-lg transition-all"
                      onClick={() => { setSettlementAmount(String(staffWallet.walletAmount)); setIsSettleDialogOpen(true); }}
                      disabled={staffWallet.walletAmount === 0}
                    >
                      <Send className="mr-2 h-5 w-5" /> Request Settlement with Admin (₹{staffWallet.walletAmount.toLocaleString()})
                    </Button>
                  )}
                  <p className="text-xs text-muted-foreground text-center">
                    Once Admin approves your settlement, your cash balance will be cleared.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>

        <Dialog open={isSettleDialogOpen} onOpenChange={setIsSettleDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Settle Collection</DialogTitle>
              <DialogDescription>
                Request to settle your collected funds with the admin.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="settlement-amount" className="text-right">
                  Amount
                </Label>
                <Input
                  id="settlement-amount"
                  type="number"
                  value={settlementAmount}
                  onChange={(e) => setSettlementAmount(e.target.value)}
                  className="col-span-3"
                  max={staffWallet.walletAmount}
                />
              </div>
              <div className="space-y-1 rounded-md bg-muted p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Requested Amount:</span>
                  <span className="font-bold">₹{(parseFloat(settlementAmount) || 0).toLocaleString()}</span>
                </div>
                {commissionReceived && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Commission Deduction:</span>
                      <span className="font-bold text-green-600">- ₹{Math.min(staffWallet.commissionAmount, parseFloat(settlementAmount) || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between border-t mt-2 pt-2">
                      <span className="text-muted-foreground">Net Amount to Send:</span>
                      <span className="font-bold text-lg">₹{((parseFloat(settlementAmount) || 0) - Math.min(staffWallet.commissionAmount, parseFloat(settlementAmount) || 0)).toLocaleString()}</span>
                    </div>
                  </>
                )}
                {!commissionReceived && (
                  <div className="flex justify-between border-t mt-2 pt-2">
                    <span className="text-muted-foreground">Amount to Send to Admin:</span>
                    <span className="font-bold text-lg">₹{(parseFloat(settlementAmount) || 0).toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-dashed mt-2 pt-2 text-muted-foreground">
                  <span>Remaining Wallet Balance:</span>
                  <span className="font-semibold text-foreground">₹{Math.max(0, staffWallet.walletAmount - (parseFloat(settlementAmount) || 0)).toLocaleString()}</span>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="commission-received-inactive" checked={commissionReceived} onCheckedChange={(checked) => setCommissionReceived(Boolean(checked))} />
                <Label htmlFor="commission-received-inactive">I have received my commission from the admin.</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setIsSettleDialogOpen(false); setCommissionReceived(false); setSettlementAmount(""); }}>Cancel</Button>
              <Button onClick={handleSettleCollection} disabled={!settlementAmount || parseFloat(settlementAmount) <= 0 || parseFloat(settlementAmount) > staffWallet.walletAmount}>Send Request</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <>
    <main className="min-h-screen w-full font-body text-foreground">
      <div className="container mx-auto p-4 py-8 md:p-12">
        <header className="mb-10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
               <h1 className="text-4xl font-bold tracking-tighter md:text-5xl">
                  Dashboard
               </h1>
               {userRole && !authLoading && !firestoreLoading && (
                  <Badge variant={userRole === "Admin" ? "default" : "secondary"} className="text-lg">
                     <ShieldCheck className="mr-2 h-5 w-5" />
                     {userRole}
                  </Badge>
              )}
            </div>
            
            <Button
              onClick={() => setIsServiceRequestOpen(true)}
              className="bg-gradient-to-r from-amber-500 via-orange-500 to-red-600 hover:from-amber-600 hover:to-red-700 text-white font-bold text-sm px-5 py-5 rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all hover:scale-105"
            >
              <Wrench className="h-5 w-5" />
              <span>+ Service Request (సర్వీస్ రిక్వెస్ట్)</span>
            </Button>
          </div>
          <p className="mt-2 max-w-3xl text-lg text-muted-foreground md:text-xl">
             { !authLoading && !firestoreLoading && getWelcomeMessage() }
          </p>

          {/* Top Universal Customer Quick Search Bar (Admin, Dealer & Retailer) */}
          {!authLoading && !firestoreLoading && (userRole === "Admin" || /dealer|retailer/i.test(userRole || "")) && (
            <div className="mt-8 p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shadow-xl border border-indigo-700/40">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-xl font-bold flex items-center gap-2 text-amber-400">
                    <Search className="h-5 w-5 text-amber-400" />
                    DishTV Customer VC Search (డిష్‌టీవీ VC నంబర్ వెతుకులాట)
                  </h2>
                  <p className="text-xs text-slate-300 mt-1">
                    Enter Customer VC Number or Mobile Number and click Search button to view details & 1, 3, 6, 12 Month package prices.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3 items-stretch w-full max-w-3xl">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
                  <Input
                    type="text"
                    placeholder="Enter VC Number or Mobile (e.g. 015... or 98480...)..."
                    className="pl-12 pr-10 py-6 text-base bg-slate-900/90 border-slate-700 text-white placeholder:text-slate-400 rounded-xl focus-visible:ring-2 focus-visible:ring-amber-400"
                    value={topSearchTerm}
                    onChange={(e) => setTopSearchTerm(e.target.value)}
                  />
                  {topSearchTerm && (
                    <button
                      type="button"
                      onClick={() => { setTopSearchTerm(""); setActiveSearchQuery(""); }}
                      className="absolute right-3 top-3.5 text-slate-400 hover:text-white"
                    >
                      <XCircle className="h-5 w-5" />
                    </button>
                  )}
                </div>
                <Button
                  type="submit"
                  className="bg-gradient-to-r from-amber-500 via-orange-500 to-red-600 hover:from-amber-600 hover:to-red-700 text-white font-bold px-6 py-6 rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all shrink-0"
                >
                  <Search className="h-5 w-5" />
                  <span>Search Customer (వెతకండి)</span>
                </Button>
              </form>

              {/* Search Results Container - Displayed ONLY after clicking Search button */}
              {activeSearchQuery.length > 0 && (
                <div className="mt-6 space-y-4">
                  {topSearchResults.length === 0 ? (
                    <div className="p-4 rounded-xl bg-red-950/90 border border-red-700/60 text-red-100 text-sm flex items-center justify-between shadow-xl">
                      <div className="flex items-center gap-3">
                        <XCircle className="h-6 w-6 text-red-400 shrink-0" />
                        <div>
                          <p className="font-bold text-base text-red-200">
                            Wrong VC Number or Mobile Number! (తప్పు VC నంబర్ లేదా మొబైల్ నంబర్)
                          </p>
                          <p className="text-xs text-red-300 mt-0.5">
                            "{activeSearchQuery}" కి సంబంధించిన కస్టమర్ వివరాలు లభించలేదు. దయచేసి పూర్తి VC నంబర్ లేదా 10 అంకెల మొబైల్ నంబర్‌ను సరిగా ఎంటర్ చేయండి.
                          </p>
                        </div>
                      </div>
                      <Button size="sm" variant="ghost" className="text-red-300 hover:text-white hover:bg-red-900/60 shrink-0" onClick={() => setActiveSearchQuery("")}>Clear</Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-amber-300 uppercase tracking-wider">
                          Found {topSearchResults.length} Matching Customer(s) for "{activeSearchQuery}":
                        </p>
                        <Button size="sm" variant="ghost" className="text-xs text-slate-400 hover:text-white" onClick={() => { setTopSearchTerm(""); setActiveSearchQuery(""); }}>Clear Results</Button>
                      </div>
                      {topSearchResults.map((cust) => (
                        <Card key={cust.id} className="bg-slate-900/95 border-amber-500/50 text-white shadow-xl overflow-hidden">
                          <CardContent className="p-5">
                            {/* Header Section: Customer Name, Status, Full Address, Balance */}
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4 mb-4">
                              <div>
                                <div className="flex items-center gap-3">
                                  <h3 className="text-2xl font-bold text-white">{cust.name}</h3>
                                  <Badge className={cust.status === "Active" ? "bg-emerald-500 text-white font-bold" : "bg-amber-500 text-white font-bold"}>
                                    {cust.status}
                                  </Badge>
                                </div>
                                {/* Full Customer Address */}
                                <p className="text-xs text-slate-300 mt-1 flex items-start gap-1 font-medium">
                                  <MapPin className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                                  <span><strong className="text-slate-200">Full Address (చిరునామా):</strong> {getFullCustomerAddress(cust)}</span>
                                </p>
                              </div>

                              <div className="text-left md:text-right bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
                                <span className="text-xs text-slate-400 block font-medium">Balance Due / నిల్వ బాకీ</span>
                                <span className="text-2xl font-black text-amber-400">
                                  ₹{(cust.balanceAmount !== undefined ? cust.balanceAmount : (cust.monthlyAmount || 350)).toLocaleString()}
                                </span>
                              </div>
                            </div>

                            {/* Customer Basic Info Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-sm bg-slate-800/60 p-4 rounded-xl border border-slate-800 mb-4">
                              {/* VC Number */}
                              <div>
                                <span className="text-xs text-slate-400 block font-medium flex items-center gap-1">
                                  💳 VC Number (VC No)
                                </span>
                                <span className="font-mono font-bold text-purple-300 text-base">
                                  {cust.vcNumber || "Not Set"}
                                </span>
                              </div>

                              {/* Contact Person Mobile Number */}
                              <div>
                                <span className="text-xs text-slate-400 block font-medium flex items-center gap-1">
                                  📱 Contact Mobile
                                </span>
                                <span className="font-bold text-emerald-400 text-base">
                                  {cust.mobile}
                                </span>
                              </div>

                              {/* Current Package */}
                              <div>
                                <span className="text-xs text-slate-400 block font-medium flex items-center gap-1">
                                  📺 Current Package Plan
                                </span>
                                <span className="font-bold text-blue-300 text-base">
                                  {cust.packagePlan || "Standard Plan"}
                                </span>
                              </div>

                              {/* Assigned Dealer Name */}
                              <div>
                                <span className="text-xs text-slate-400 block font-medium flex items-center gap-1">
                                  🏬 Dealer Name (డీలర్ పేరు)
                                </span>
                                <span className="font-bold text-amber-300 text-base">
                                  {cust.dealerName || dealerName || "Navanidhi Digital System"}
                                </span>
                              </div>
                            </div>

                            {/* Multi-Month Package Price Breakdown List (1, 3, 6, 12 Months) */}
                            {(() => {
                              const prices = getPackagePriceList(cust);
                              return (
                                <div className="bg-slate-950/80 p-4 rounded-xl border border-indigo-900/60 mb-4">
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                                    <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                                      <Package className="h-4 w-4 text-amber-400" />
                                      Package Price List (ప్యాక్ ధరల పట్టిక - 1, 3, 6, 12 నెలలు):
                                    </h4>
                                    <span className="text-[11px] text-cyan-300 font-semibold bg-cyan-950/80 border border-cyan-800/80 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                                      ⚡ ఆఫర్ కార్డ్‌పై క్లిక్ చేసి అడ్మిన్‌కు రిచార్జ్ రిక్వెస్ట్ పంపండి
                                    </span>
                                  </div>

                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                                    <button
                                      type="button"
                                      onClick={() => handleOpenOfferRecharge(cust, 1, prices.m1)}
                                      className="bg-slate-900 hover:bg-slate-850 p-3 rounded-xl border border-slate-800 hover:border-emerald-500/80 hover:scale-[1.03] transition-all text-left group shadow-lg cursor-pointer"
                                    >
                                      <div className="flex items-center justify-between">
                                        <span className="text-[11px] text-slate-300 font-bold">1 Month</span>
                                        <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[9px] px-1.5 py-0 group-hover:bg-emerald-600 group-hover:text-white transition-colors">Select</Badge>
                                      </div>
                                      <span className="text-lg font-black text-emerald-400 block mt-1">₹{prices.m1.toLocaleString()}</span>
                                      <span className="text-[10px] text-emerald-300/80 block mt-1 font-semibold flex items-center gap-0.5">
                                        <Send className="w-3 h-3" /> Click to Request
                                      </span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handleOpenOfferRecharge(cust, 3, prices.m3)}
                                      className="bg-slate-900 hover:bg-slate-850 p-3 rounded-xl border border-slate-800 hover:border-blue-500/80 hover:scale-[1.03] transition-all text-left group shadow-lg cursor-pointer"
                                    >
                                      <div className="flex items-center justify-between">
                                        <span className="text-[11px] text-slate-300 font-bold">3 Months</span>
                                        <Badge className="bg-blue-500/20 text-blue-300 border border-blue-500/40 text-[9px] px-1.5 py-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">Select</Badge>
                                      </div>
                                      <span className="text-lg font-black text-blue-400 block mt-1">₹{prices.m3.toLocaleString()}</span>
                                      <span className="text-[10px] text-blue-300/80 block mt-1 font-semibold flex items-center gap-0.5">
                                        <Send className="w-3 h-3" /> Click to Request
                                      </span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handleOpenOfferRecharge(cust, 6, prices.m6)}
                                      className="bg-slate-900 hover:bg-slate-850 p-3 rounded-xl border border-slate-800 hover:border-purple-500/80 hover:scale-[1.03] transition-all text-left group shadow-lg cursor-pointer"
                                    >
                                      <div className="flex items-center justify-between">
                                        <span className="text-[11px] text-slate-300 font-bold">6 Months</span>
                                        <Badge className="bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[9px] px-1.5 py-0 group-hover:bg-purple-600 group-hover:text-white transition-colors">Select</Badge>
                                      </div>
                                      <span className="text-lg font-black text-purple-400 block mt-1">₹{prices.m6.toLocaleString()}</span>
                                      <span className="text-[10px] text-purple-300/80 block mt-1 font-semibold flex items-center gap-0.5">
                                        <Send className="w-3 h-3" /> Click to Request
                                      </span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handleOpenOfferRecharge(cust, 12, prices.m12)}
                                      className="bg-slate-900 hover:bg-slate-850 p-3 rounded-xl border border-slate-800 hover:border-amber-500/80 hover:scale-[1.03] transition-all text-left group shadow-lg cursor-pointer"
                                    >
                                      <div className="flex items-center justify-between">
                                        <span className="text-[11px] text-slate-300 font-bold">12 Months (1 Yr)</span>
                                        <Badge className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] px-1.5 py-0 group-hover:bg-amber-600 group-hover:text-white transition-colors">Select</Badge>
                                      </div>
                                      <span className="text-lg font-black text-amber-400 block mt-1">₹{prices.m12.toLocaleString()}</span>
                                      <span className="text-[10px] text-amber-300/80 block mt-1 font-semibold flex items-center gap-0.5">
                                        <Send className="w-3 h-3" /> Click to Request
                                      </span>
                                    </button>
                                  </div>
                                </div>
                              );
                            })()}

                            {/* Action Buttons (Admin & Dealer Only - Hidden for Retailers) */}
                            {userRole !== "Retailer" && (
                              <div className="flex flex-wrap items-center gap-3 pt-1">
                                <Button asChild size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold">
                                  <Link href={`/dashboard/payment-collections?search=${encodeURIComponent(cust.mobile)}`}>
                                    <HandCoins className="h-4 w-4 mr-1.5" /> Collect Payment
                                  </Link>
                                </Button>
                                <Button asChild size="sm" className="bg-blue-600 hover:bg-blue-700 text-white font-semibold">
                                  <Link href={`/dashboard/dishtv-customers?search=${encodeURIComponent(cust.mobile)}`}>
                                    <CreditCard className="h-4 w-4 mr-1.5" /> Recharge
                                  </Link>
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => handleOpenService(cust)}
                                  className="bg-amber-600 hover:bg-amber-700 text-white font-semibold flex items-center gap-1.5"
                                >
                                  <Wrench className="h-4 w-4" /> Service Charge
                                </Button>
                                <Button asChild size="sm" variant="outline" className="border-purple-500/60 text-purple-300 hover:bg-purple-950 hover:text-white font-semibold">
                                  <Link href={`/dashboard/payment-collections?search=${encodeURIComponent(cust.mobile)}`}>
                                    <History className="h-4 w-4 mr-1.5" /> View Ledger & History
                                  </Link>
                                </Button>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </header>
        <audio ref={audioRef} src={notificationSound} />

        {renderDashboard()}

        {/* Dialog for Settle Collection */}

        <Dialog open={isSettleDialogOpen} onOpenChange={(open) => { if (!open) { setIsSettleDialogOpen(false); setCommissionReceived(false); setSettlementAmount(""); } }}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Request Settlement</DialogTitle>
                    <DialogDescription>
                        Enter the amount you want to settle with the admin. Your total wallet balance is ₹{staffWallet.walletAmount.toLocaleString()}.
                    </DialogDescription>
                </DialogHeader>
                 <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="settlement-amount">Settlement Amount (₹)</Label>
                        <Input
                            id="settlement-amount"
                            type="number"
                            placeholder="Enter amount to settle"
                            value={settlementAmount}
                            onChange={(e) => setSettlementAmount(e.target.value)}
                            max={staffWallet.walletAmount}
                            min={1}
                        />
                        <p className="text-xs text-muted-foreground">Max: ₹{staffWallet.walletAmount.toLocaleString()}</p>
                    </div>
                    <div className="rounded-md bg-muted p-4 text-sm space-y-2">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Settlement Amount:</span>
                            <span className="font-bold">₹{(parseFloat(settlementAmount) || 0).toLocaleString()}</span>
                        </div>
                        {commissionReceived && (
                            <>
                             <div className="flex justify-between">
                                <span className="text-muted-foreground">Commission Deduction:</span>
                                <span className="font-bold text-green-600">- ₹{Math.min(staffWallet.commissionAmount, parseFloat(settlementAmount) || 0).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between border-t mt-2 pt-2">
                                <span className="text-muted-foreground">Net Amount to Send:</span>
                                <span className="font-bold text-lg">₹{((parseFloat(settlementAmount) || 0) - Math.min(staffWallet.commissionAmount, parseFloat(settlementAmount) || 0)).toLocaleString()}</span>
                            </div>
                            </>
                        )}
                         {!commissionReceived && (
                            <div className="flex justify-between border-t mt-2 pt-2">
                                 <span className="text-muted-foreground">Amount to Send to Admin:</span>
                                <span className="font-bold text-lg">₹{(parseFloat(settlementAmount) || 0).toLocaleString()}</span>
                            </div>
                        )}
                        <div className="flex justify-between border-t border-dashed mt-2 pt-2 text-muted-foreground">
                            <span>Remaining Wallet Balance:</span>
                            <span className="font-semibold text-foreground">₹{Math.max(0, staffWallet.walletAmount - (parseFloat(settlementAmount) || 0)).toLocaleString()}</span>
                        </div>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Checkbox id="commission-received" checked={commissionReceived} onCheckedChange={(checked) => setCommissionReceived(Boolean(checked))} />
                        <Label htmlFor="commission-received">I have received my commission from the admin.</Label>
                    </div>
                 </div>
                 <DialogFooter>
                    <Button variant="outline" onClick={() => { setIsSettleDialogOpen(false); setCommissionReceived(false); setSettlementAmount(""); }}>Cancel</Button>
                    <Button onClick={handleSettleCollection} disabled={!settlementAmount || parseFloat(settlementAmount) <= 0 || parseFloat(settlementAmount) > staffWallet.walletAmount}>Send Request</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
        
        {/* Dialog for Customer Search (Collections) */}
        <Dialog open={isCustomerSearchDialogOpen} onOpenChange={(open) => !open && cleanupSearchDialog(setIsCustomerSearchDialogOpen)}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Find Customer for Collection</DialogTitle>
                    <DialogDescription>Search for a customer by their Name, Mobile, STB ID, or Customer ID.</DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <div className="flex gap-2">
                        <Input 
                            placeholder="Enter search term..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        <Button onClick={() => handleCustomerSearch('collection')} disabled={isSearching}>
                            {isSearching ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Search className="mr-2 h-4 w-4" />}
                            Search
                        </Button>
                    </div>
                    {searchError && <p className="text-sm text-destructive">{searchError}</p>}
                    {searchedCustomer && (
                        <Card>
                            <CardHeader>
                                <CardTitle>{searchedCustomer.name}</CardTitle>
                                <CardDescription>STB: {searchedCustomer.stbId} | Balance: ₹{searchedCustomer.balanceAmount}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Button className="w-full" onClick={() => openCollectDialog(searchedCustomer)}>
                                    <HandCoins className="mr-2 h-4 w-4" />
                                    Proceed to Collect
                                </Button>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </DialogContent>
        </Dialog>
        
         {/* Dialog for Customer Search (Recharge) */}
        <Dialog open={isRechargeSearchDialogOpen} onOpenChange={(open) => !open && cleanupSearchDialog(setIsRechargeSearchDialogOpen)}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Find Customer to Recharge</DialogTitle>
                    <DialogDescription>Search for a customer to recharge their account.</DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <div className="flex gap-2">
                        <Input 
                            placeholder="Enter search term..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        <Button onClick={() => handleCustomerSearch('recharge')} disabled={isSearching}>
                             {isSearching ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Search className="mr-2 h-4 w-4" />}
                            Search
                        </Button>
                    </div>
                    {searchError && <p className="text-sm text-destructive">{searchError}</p>}
                </div>
            </DialogContent>
        </Dialog>

        {/* Dialog for Collection */}
        {searchedCustomer && (
            <Dialog open={isCollectDialogOpen} onOpenChange={setIsCollectDialogOpen}>
                <DialogContent>
                     <DialogHeader>
                        <DialogTitle>Collect from {searchedCustomer.name}</DialogTitle>
                        <DialogDescription>Amount due: ₹{searchedCustomer.balanceAmount}</DialogDescription>
                    </DialogHeader>
                     <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="amount" className="text-right">Amount (₹)</Label>
                            <Input id="amount" type="number" value={amountCollected} onChange={(e) => setAmountCollected(e.target.value)} className="col-span-3"/>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-right">Method</Label>
                            <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="col-span-3 flex items-center gap-4">
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="cash" id="r-cash" />
                                    <Label htmlFor="r-cash">Cash</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="upi" id="r-upi" />
                                    <Label htmlFor="r-upi">UPI</Label>
                                </div>
                            </RadioGroup>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={handleConfirmCollection}>Confirm Collection</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        )}

        {/* Dialog for Recharge */}
        {searchedCustomer && (
            <Dialog open={isRechargeDialogOpen} onOpenChange={setIsRechargeDialogOpen}>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Recharge for {searchedCustomer.name}</DialogTitle>
                    <DialogDescription>Select a package to continue with the recharge.</DialogDescription>
                    <div className="text-sm">
                        Current Balance: <span className="font-bold text-lg">₹{searchedCustomer.balanceAmount}</span>
                    </div>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="package" className="text-right">
                        Package
                      </Label>
                      <Select onValueChange={setSelectedPackage}>
                        <SelectTrigger className="col-span-3">
                          <SelectValue placeholder="Select a package" />
                        </SelectTrigger>
                        <SelectContent>
                          {packages.map((pkg) => (
                            <SelectItem key={pkg.id} value={pkg.id}>
                              {pkg.packageName} - ₹{pkg.packageAmount}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                     <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="months" className="text-right">
                        Months
                      </Label>
                       <Select value={String(rechargeMonths)} onValueChange={(val) => setRechargeMonths(Number(val))}>
                        <SelectTrigger className="col-span-3">
                          <SelectValue placeholder="Select number of months" />
                        </SelectTrigger>
                        <SelectContent>
                          {[...Array(12)].map((_, i) => (
                            <SelectItem key={i + 1} value={String(i + 1)}>
                              {i + 1} Month(s)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {selectedPackageDetails && (
                        <div className="space-y-2 rounded-md bg-muted p-3 text-sm">
                            {offer && (
                                <>
                                <div className="flex justify-between text-muted-foreground">
                                    <span>Original Amount:</span>
                                    <span>₹{(baseAmount * rechargeMonths).toLocaleString()}</span>
                                </div>
                                 <div className="flex justify-between font-semibold text-destructive">
                                    <span>Discount ({offer.discountPercentage}%):</span>
                                    <span>- ₹{discount.toLocaleString()}</span>
                                </div>
                                </>
                            )}
                            <div className="flex justify-between">
                                <span>Recharge Amount:</span>
                                <span className="font-bold text-base">₹{totalRechargeAmount.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>New Balance After Recharge:</span>
                                <span className="font-bold text-base">₹{newBalance?.toLocaleString()}</span>
                            </div>
                                {paymentReceivedForRecharge && (
                                <p className="text-xs text-muted-foreground">Amount will not be added to balance.</p>
                            )}
                        </div>
                    )}

                    <div className="flex items-center space-x-2 justify-center pt-2">
                        <Checkbox 
                          id="payment-received-recharge" 
                          checked={paymentReceivedForRecharge} 
                          onCheckedChange={(checked) => setPaymentReceivedForRecharge(Boolean(checked))}
                        />
                        <Label htmlFor="payment-received-recharge" className="text-xs">Payment Received (amount will not be added to balance)</Label>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" onClick={handleRecharge} disabled={!selectedPackage}>Confirm Recharge</Button>
                  </DialogFooter>
                </DialogContent>
            </Dialog>
        )}

        {/* Add Extra Service Charge Dialog */}
        <Dialog open={isServiceDialogOpen} onOpenChange={setIsServiceDialogOpen}>
          <DialogContent className="sm:max-w-md bg-slate-900 text-white border-slate-800">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-amber-400">
                <Wrench className="h-5 w-5 text-amber-400" />
                Add Extra Service Charge (సర్వీస్ ఛార్జీలు)
              </DialogTitle>
              <DialogDescription className="text-slate-300">
                Add service charges for <strong className="text-amber-300">{serviceCustomer?.name}</strong> (Mobile: {serviceCustomer?.mobile}).
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-3">
              <div className="space-y-2">
                <Label htmlFor="serviceTypeSelect" className="text-sm font-medium text-slate-200">Select Service Type *</Label>
                <Select
                  value={serviceType}
                  onValueChange={(val) => {
                    setServiceType(val);
                    if (val === "Cable Shift / Relocation") setServiceAmount("250");
                    else if (val === "Wire / Cable Replacement") setServiceAmount("200");
                    else if (val === "New Connection Charge") setServiceAmount("500");
                    else if (val === "STB Repair / Replacement") setServiceAmount("300");
                    else if (val === "Remote Replacement") setServiceAmount("150");
                    else if (val === "Dish Tuning & Alignment") setServiceAmount("150");
                    else setServiceAmount("200");
                  }}
                >
                  <SelectTrigger id="serviceTypeSelect" className="bg-slate-950 border-slate-800 text-white">
                    <SelectValue placeholder="Select Service" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-white">
                    <SelectItem value="Cable Shift / Relocation">🔌 Cable Shift / Relocation (₹250)</SelectItem>
                    <SelectItem value="Wire / Cable Replacement">🔌 Wire / Cable Replacement (₹200)</SelectItem>
                    <SelectItem value="New Connection Charge">📡 New Connection Charge (₹500)</SelectItem>
                    <SelectItem value="STB Repair / Replacement">📦 STB Repair / Replacement (₹300)</SelectItem>
                    <SelectItem value="Remote Replacement">🎮 Remote Replacement (₹150)</SelectItem>
                    <SelectItem value="Dish Tuning & Alignment">🛰️ Dish Tuning & Alignment (₹150)</SelectItem>
                    <SelectItem value="Other Service Charge">🛠️ Other Service Charge</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="serviceAmountInput" className="text-sm font-medium text-slate-200">Service Amount (₹) *</Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-amber-400 font-bold">₹</span>
                  <Input
                    id="serviceAmountInput"
                    type="number"
                    value={serviceAmount}
                    onChange={(e) => setServiceAmount(e.target.value)}
                    className="pl-8 text-lg font-bold text-amber-400 bg-slate-950 border-slate-800"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="serviceNotesInput" className="text-sm font-medium text-slate-200">Notes / Description (Optional)</Label>
                <Input
                  id="serviceNotesInput"
                  placeholder="e.g. Changed 10 meters wire or replaced remote"
                  value={serviceNotes}
                  onChange={(e) => setServiceNotes(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-white"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setIsServiceDialogOpen(false)} className="border-slate-700 text-slate-300 hover:bg-slate-800">
                Cancel
              </Button>
              <Button
                onClick={handleConfirmService}
                disabled={isSavingService || !serviceAmount}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold"
              >
                {isSavingService && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add Service Charge (₹{parseFloat(serviceAmount || "0").toLocaleString()})
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Service Request Dialog Modal */}
        <Dialog open={isServiceRequestOpen} onOpenChange={setIsServiceRequestOpen}>
          <DialogContent className="sm:max-w-lg bg-slate-900 text-slate-100 border-slate-800 max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl font-bold text-amber-400">
                <Wrench className="h-5 w-5 text-amber-400" />
                Create Service Request (సర్వీస్ రిక్వెస్ట్)
              </DialogTitle>
              <DialogDescription className="text-slate-400 text-xs">
                Submit customer complaint or service visit request. Admin will receive this on their dashboard.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCreateServiceRequest} className="space-y-4 py-2">
              {/* Customer Name & Mobile */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-300">Customer Name (కస్టమర్ పేరు) *</Label>
                  <Input
                    placeholder="Enter customer name"
                    value={srCustomerName}
                    onChange={(e) => setSrCustomerName(e.target.value)}
                    className="bg-slate-950 border-slate-800 text-slate-100 text-sm"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-300">Mobile Number (మొబైల్ నంబర్) *</Label>
                  <Input
                    type="tel"
                    placeholder="10-digit Mobile No"
                    value={srMobile}
                    onChange={(e) => setSrMobile(e.target.value)}
                    className="bg-slate-950 border-slate-800 text-slate-100 text-sm"
                    required
                  />
                </div>
              </div>

              {/* District & Mandal Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-300">District (జిల్లా) *</Label>
                  <Select
                    value={srDistrict}
                    onValueChange={(val) => {
                      setSrDistrict(val);
                      setSrMandal("");
                      setSrVillage("");
                    }}
                  >
                    <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-100 text-sm">
                      <SelectValue placeholder="Select District" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-slate-100 max-h-48">
                      {AP_LOCATIONS.map((loc) => (
                        <SelectItem key={loc.district} value={loc.district}>
                          {loc.district}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-300">Mandal (మండలం) *</Label>
                  <Select
                    value={srMandal}
                    disabled={!srDistrict}
                    onValueChange={(val) => {
                      setSrMandal(val);
                      setSrVillage("");
                    }}
                  >
                    <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-100 text-sm">
                      <SelectValue placeholder={srDistrict ? "Select Mandal" : "First pick District"} />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-slate-100 max-h-48">
                      {AP_LOCATIONS.find((d) => d.district === srDistrict)?.mandals.map((m) => (
                        <SelectItem key={m.mandal} value={m.mandal}>
                          {m.mandal}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Village & DTH Company */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-300">Village / Area (గ్రామం / వీధి)</Label>
                  <Input
                    placeholder="Enter Village or Street"
                    value={srVillage}
                    onChange={(e) => setSrVillage(e.target.value)}
                    className="bg-slate-950 border-slate-800 text-slate-100 text-sm"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-300">DTH Company (డిలే కంపెనీ) *</Label>
                  <Select value={srDthCompany} onValueChange={setSrDthCompany}>
                    <SelectTrigger className="bg-slate-950 border-slate-800 text-amber-400 font-bold text-sm">
                      <SelectValue placeholder="Select DTH Provider" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-slate-100">
                      <SelectItem value="DishTV">📡 DishTV</SelectItem>
                      <SelectItem value="Sun Direct">☀️ Sun Direct</SelectItem>
                      <SelectItem value="Airtel Digital TV">🔴 Airtel Digital TV</SelectItem>
                      <SelectItem value="Tata Play">🔵 Tata Play</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Issue Type */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-300">Complaint / Issue Type (సమస్య రకం)</Label>
                <Select value={srComplaintType} onValueChange={setSrComplaintType}>
                  <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-100 text-sm">
                    <SelectValue placeholder="Select Complaint Type" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-slate-100">
                    <SelectItem value="Signal Issue">📡 No Signal / Low Signal</SelectItem>
                    <SelectItem value="STB Error / No Display">📺 Set-Top Box Error / No Display</SelectItem>
                    <SelectItem value="Remote Control Problem">🎮 Remote Control Not Working</SelectItem>
                    <SelectItem value="Cable Wire Damage">🔌 Cable Wire Damage / Cut</SelectItem>
                    <SelectItem value="New Relocation / Shifting">🚚 Relocation / Shifting Request</SelectItem>
                    <SelectItem value="General Service / Repair">🛠️ General Repair / Service Visit</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Scheduled Date & Time Slot */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-300">Scheduled Visit Date (తేదీ)</Label>
                  <Input
                    type="date"
                    value={srScheduledDate}
                    onChange={(e) => setSrScheduledDate(e.target.value)}
                    className="bg-slate-950 border-slate-800 text-slate-100 text-sm"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-300">Preferred Time Slot (సమయం)</Label>
                  <Select value={srScheduledTime} onValueChange={setSrScheduledTime}>
                    <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-100 text-sm">
                      <SelectValue placeholder="Select Time Slot" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-slate-100">
                      <SelectItem value="Morning (9 AM - 12 PM)">🌅 Morning (9 AM - 12 PM)</SelectItem>
                      <SelectItem value="Afternoon (12 PM - 4 PM)">☀️ Afternoon (12 PM - 4 PM)</SelectItem>
                      <SelectItem value="Evening (4 PM - 8 PM)">🌆 Evening (4 PM - 8 PM)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Additional Notes */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-300">Additional Notes / Remarks</Label>
                <Input
                  placeholder="e.g. Please bring 15 meters wire & DishTV remote"
                  value={srNotes}
                  onChange={(e) => setSrNotes(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-slate-100 text-sm"
                />
              </div>

              <DialogFooter className="pt-2 gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsServiceRequestOpen(false)}
                  className="border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-bold"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmittingSR}
                  className="bg-gradient-to-r from-amber-500 to-red-600 hover:from-amber-600 hover:to-red-700 text-white font-bold text-xs"
                >
                  {isSubmittingSR && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Submit Service Request
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* New Connection Booking Dialog */}
        <Dialog open={isNewConnOpen} onOpenChange={setIsNewConnOpen}>
          <DialogContent className="sm:max-w-lg bg-slate-900 text-slate-100 border-slate-800 max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl font-bold text-emerald-400">
                <Package className="h-5 w-5 text-emerald-400" />
                Book New Connection (కొత్త కనెక్షన్ బుక్ చేయండి)
              </DialogTitle>
              <DialogDescription className="text-slate-400 text-xs">
                Fill customer details. Admin will receive this request on their dashboard.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCreateNewConnection} className="space-y-4 py-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-300">Customer Name *</Label>
                  <Input placeholder="Enter customer name" value={ncCustomerName} onChange={(e) => setNcCustomerName(e.target.value)} className="bg-slate-950 border-slate-800 text-slate-100 text-sm" required />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-300">Mobile No *</Label>
                  <Input placeholder="10-digit mobile number" value={ncMobile} onChange={(e) => setNcMobile(e.target.value)} maxLength={10} className="bg-slate-950 border-slate-800 text-slate-100 text-sm" required />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-300">District *</Label>
                  <Select value={ncDistrict} onValueChange={(val) => { setNcDistrict(val); setNcMandal(""); setNcVillage(""); }}>
                    <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-100 text-sm"><SelectValue placeholder="Select District" /></SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-slate-100 max-h-48 overflow-y-auto">
                      {AP_LOCATIONS.map((loc) => <SelectItem key={loc.district} value={loc.district}>{loc.district}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-300">Mandal *</Label>
                  <Select value={ncMandal} onValueChange={(val) => { setNcMandal(val); setNcVillage(""); }} disabled={!ncDistrict}>
                    <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-100 text-sm"><SelectValue placeholder="Select Mandal" /></SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-slate-100 max-h-48 overflow-y-auto">
                      {ncDistrict && AP_LOCATIONS.find((l) => l.district === ncDistrict)?.mandals.map((m) => <SelectItem key={m.mandal} value={m.mandal}>{m.mandal}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-300">Village</Label>
                  <Select value={ncVillage} onValueChange={setNcVillage} disabled={!ncMandal}>
                    <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-100 text-sm"><SelectValue placeholder="Select Village" /></SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-slate-100 max-h-48 overflow-y-auto">
                      {ncMandal && AP_LOCATIONS.find((l) => l.district === ncDistrict)?.mandals.find((m) => m.mandal === ncMandal)?.villages.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-300">Landmark / Address (గుర్తు)</Label>
                <Input placeholder="e.g. Near Govt School, Opposite temple..." value={ncLandmark} onChange={(e) => setNcLandmark(e.target.value)} className="bg-slate-950 border-slate-800 text-slate-100 text-sm" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-300">Scheduled Date (తేదీ)</Label>
                  <Input type="date" value={ncScheduledDate} onChange={(e) => setNcScheduledDate(e.target.value)} className="bg-slate-950 border-slate-800 text-slate-100 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-300">Preferred Time Slot (సమయం)</Label>
                  <Select value={ncScheduledTime} onValueChange={setNcScheduledTime}>
                    <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-100 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-slate-100">
                      <SelectItem value="Morning (9 AM - 12 PM)">🌅 Morning (9 AM - 12 PM)</SelectItem>
                      <SelectItem value="Afternoon (12 PM - 4 PM)">☀️ Afternoon (12 PM - 4 PM)</SelectItem>
                      <SelectItem value="Evening (4 PM - 8 PM)">🌆 Evening (4 PM - 8 PM)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <DialogFooter className="pt-2 gap-2 sm:gap-0">
                <Button type="button" variant="outline" onClick={() => setIsNewConnOpen(false)} className="border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-bold">Cancel</Button>
                <Button type="submit" disabled={isSubmittingNC} className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-xs">
                  {isSubmittingNC && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Submit New Connection Request 📡
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Customer Offer Recharge Request Dialog Modal */}
        <Dialog open={isOfferRechargeModalOpen} onOpenChange={setIsOfferRechargeModalOpen}>
          <DialogContent className="bg-slate-900 text-slate-100 border-slate-800 max-w-lg overflow-hidden">
            <DialogHeader className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-4 border-b border-slate-800 -mx-6 -mt-6">
              <DialogTitle className="text-lg font-bold text-amber-400 flex items-center gap-2">
                <Tv className="w-5 h-5 text-amber-400" />
                DishTV Recharge Request (అడ్మిన్‌కు రిచార్జ్ రిక్వెస్ట్)
              </DialogTitle>
              <DialogDescription className="text-slate-400 text-xs mt-0.5">
                Pay via UPI and enter unique 12-digit UTR Number to send recharge request to Admin.
              </DialogDescription>
            </DialogHeader>

            {rechargeModalCustomer && (
              <form onSubmit={handleSubmitOfferRechargeRequest} className="space-y-4 pt-2">
                {/* Customer Details Summary Card */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">Customer Details (కస్టమర్ వివరాలు)</span>
                    <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold">
                      {rechargeModalCustomer.status || "Active"}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[11px]">Customer Name:</span>
                      <strong className="text-white text-sm block">{rechargeModalCustomer.name}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">VC Number (VC No):</span>
                      <strong className="text-purple-300 font-mono text-sm block">{rechargeModalCustomer.vcNumber || "N/A"}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Mobile Number:</span>
                      <strong className="text-emerald-400 font-mono text-sm block">{rechargeModalCustomer.mobile}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Village / Address:</span>
                      <strong className="text-amber-300 block text-xs">{rechargeModalCustomer.village || rechargeModalCustomer.mandal || "N/A"}</strong>
                    </div>
                  </div>

                  <div className="text-xs bg-slate-900 p-3 rounded-lg border border-slate-800 flex items-center justify-between mt-2">
                    <div>
                      <span className="text-slate-400 text-[11px] block font-medium">Selected Package & Duration:</span>
                      <strong className="text-cyan-300 text-sm font-semibold">{rechargeModalCustomer.packagePlan || "Standard Plan"} ({selectedOfferMonths} Month{selectedOfferMonths > 1 ? 's' : ''})</strong>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-400 text-[11px] block font-medium">Total Amount:</span>
                      <span className="text-xl font-black text-emerald-400">₹{selectedOfferAmount.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Admin UPI Payment Details & QR Code */}
                <div className="p-3.5 rounded-xl bg-gradient-to-r from-indigo-950/80 to-purple-950/80 border border-indigo-700/50 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-amber-300 flex items-center gap-1.5">
                      <IndianRupee className="w-4 h-4 text-emerald-400" />
                      UPI Payment Details (అడ్మిన్ UPI కి పేమెంట్ చేయండి):
                    </span>
                  </div>
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-950/80 p-3 rounded-lg border border-slate-800">
                    <div className="space-y-1 text-center sm:text-left">
                      <span className="text-[11px] text-slate-400 block font-medium">Admin UPI ID:</span>
                      <strong className="text-emerald-400 font-mono text-sm block select-all">navanidhidigital@upi</strong>
                      <p className="text-[10px] text-slate-300">
                        PhonePe / GPay / Paytm ద్వారా <strong>₹{selectedOfferAmount}</strong> పేమెంట్ చేయండి.
                      </p>
                    </div>
                    <Badge className="bg-emerald-950 text-emerald-300 border border-emerald-800 font-mono text-xs px-3 py-1 shrink-0">
                      Pay ₹{selectedOfferAmount}
                    </Badge>
                  </div>
                </div>

                {/* UTR Entry Field */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-200 flex items-center justify-between">
                    <span>Enter UPI UTR / Transaction Ref Number *</span>
                    <span className="text-[10px] text-amber-400 font-normal">(ఒకసారి వాడిన UTR అనుమతించబడదు)</span>
                  </label>
                  <Input
                    type="text"
                    placeholder="e.g. 123456789012 (12-digit UTR Number)"
                    value={rechargeUtrNumber}
                    onChange={(e) => {
                      setRechargeUtrNumber(e.target.value);
                      if (rechargeUtrError) setRechargeUtrError("");
                    }}
                    className="bg-slate-950 border-slate-700 text-emerald-400 font-mono font-bold text-base h-11 focus-visible:ring-2 focus-visible:ring-emerald-400"
                    required
                  />

                  {rechargeUtrError && (
                    <div className="p-3 rounded-lg bg-rose-950/90 border border-rose-700/80 text-rose-200 text-xs font-medium flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>{rechargeUtrError}</span>
                    </div>
                  )}
                </div>

                <DialogFooter className="pt-2">
                  <Button
                    type="submit"
                    disabled={isSubmittingRechargeReq}
                    className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm h-11 shadow-lg"
                  >
                    {isSubmittingRechargeReq ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Verifying UTR & Submitting...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" /> Submit Recharge Request to Admin
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>

        {/* Payment Success Instant WhatsApp & SMS Receipt Modal */}
        <PaymentSuccessReceiptModal
          isOpen={isReceiptModalOpen}
          onClose={() => setIsReceiptModalOpen(false)}
          receiptData={receiptModalData}
        />

      </div>
    </main>
    </>
  );
}
