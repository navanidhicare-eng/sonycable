"use client";

import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Search, HandCoins, Loader2, IndianRupee, Calendar, CheckCircle2, History, Receipt, Phone, Store, Share2, MessageCircle, MessageSquare, Wrench, CreditCard, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { collection, onSnapshot, query, where, doc, updateDoc, addDoc, getDocs, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { generateReceiptText, openWhatsAppReceipt, openSmsReceipt } from "@/components/PaymentSuccessReceiptModal";

interface DishTvCustomer {
  id: string;
  name: string;
  mobile: string;
  vcNumber?: string;
  subscriberId?: string;
  packagePlan: string;
  monthlyAmount: number;
  balanceAmount?: number;
  status: "Active" | "Expired" | "Suspended";
  expiryDate?: Timestamp | null;
  village?: string;
  mandal?: string;
  district?: string;
  area?: string;
  userId?: string;
  dealerId?: string;
  dealerName?: string;
}

interface DishTvPaymentRecord {
  id: string;
  customerId: string;
  customerName: string;
  mobile: string;
  vcNumber?: string;
  packagePlan?: string;
  amount: number;
  remainingBalance?: number;
  paymentMethod: string;
  collectedByUid: string;
  collectedByName?: string;
  dealerName?: string;
  collectedAt: Timestamp;
  notes?: string;
}

export interface CustomerTransaction {
  id: string;
  type: "Payment" | "Recharge" | "Service";
  title: string;
  details: string;
  amount: number;
  date: Timestamp;
  isCredit: boolean;
  paymentMethod?: string;
  rawPayDoc?: DishTvPaymentRecord;
}

export default function PaymentCollectionsPage() {
  const { user, userRole, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [customers, setCustomers] = useState<DishTvCustomer[]>([]);
  const [payments, setPayments] = useState<DishTvPaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  // Dialog State
  const [isCollectDialogOpen, setIsCollectDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<DishTvCustomer | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [collectionNotes, setCollectionNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Receipt Modal State
  const [selectedReceipt, setSelectedReceipt] = useState<DishTvPaymentRecord | null>(null);
  const [dealerBusinessName, setDealerBusinessName] = useState<string>("");

  // Customer History & Ledger Modal State
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyCustomer, setHistoryCustomer] = useState<DishTvCustomer | null>(null);
  const [customerServices, setCustomerServices] = useState<any[]>([]);
  const [customerPayments, setCustomerPayments] = useState<any[]>([]);
  const [customerRecharges, setCustomerRecharges] = useState<any[]>([]);
  const [allTransactions, setAllTransactions] = useState<CustomerTransaction[]>([]);
  const [historyFilter, setHistoryFilter] = useState<"all" | "Payment" | "Recharge" | "Service">("all");
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Open Customer History Modal
  const handleOpenHistory = async (customer: DishTvCustomer) => {
    setHistoryCustomer(customer);
    setIsHistoryModalOpen(true);
    setLoadingHistory(true);
    setHistoryFilter("all");

    try {
      // 1. Fetch payments for this customer
      const qPay = query(collection(db, "dishtv_payments"), where("customerId", "==", customer.id));
      const paySnap = await getDocs(qPay);
      const pays = paySnap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as DishTvPaymentRecord[];
      setCustomerPayments(pays);

      // 2. Fetch services for this customer
      const qSvc = query(collection(db, "dishtv_services"), where("customerId", "==", customer.id));
      const svcSnap = await getDocs(qSvc);
      const svcs = svcSnap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
      setCustomerServices(svcs);

      // 3. Fetch recharges for this customer
      const qRch = query(collection(db, "dishtv_recharges"), where("customerId", "==", customer.id));
      const rchSnap = await getDocs(qRch);
      const rchs = rchSnap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
      setCustomerRecharges(rchs);

      // Combine into unified transaction list sorted by Date & Time (latest first)
      const txns: CustomerTransaction[] = [];

      pays.forEach((p: any) => {
        txns.push({
          id: p.id,
          type: "Payment",
          title: "Payment Collected",
          details: `Paid via ${p.paymentMethod || 'Cash'}${p.notes ? ' • ' + p.notes : ''}`,
          amount: p.amount || 0,
          date: p.collectedAt || Timestamp.now(),
          isCredit: true,
          paymentMethod: p.paymentMethod,
          rawPayDoc: p,
        });
      });

      rchs.forEach((r: any) => {
        txns.push({
          id: r.id,
          type: "Recharge",
          title: `Recharge (${r.months || 1} Month${(r.months || 1) > 1 ? 's' : ''})`,
          details: `Plan: ${r.packagePlan || 'DishTV Package'}`,
          amount: r.amount || 0,
          date: r.rechargedAt || r.createdAt || Timestamp.now(),
          isCredit: false,
        });
      });

      svcs.forEach((s: any) => {
        txns.push({
          id: s.id,
          type: "Service",
          title: `Service: ${s.serviceType || 'Service Charge'}`,
          details: s.notes || 'Service / Maintenance',
          amount: s.amount || 0,
          date: s.createdAt || Timestamp.now(),
          isCredit: false,
        });
      });

      // Sort ALL transactions together chronologically (Latest Date & Time first)
      txns.sort((a, b) => (b.date?.seconds || 0) - (a.date?.seconds || 0));

      setAllTransactions(txns);
    } catch (err) {
      console.error("Error fetching customer history:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Fetch Dealer Customers & Payment Records
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }

    // Fetch Dealer Business Name
    const fetchDealerName = async () => {
      try {
        const qDlr = query(collection(db, "dishtv_dealers"), where("uid", "==", user.uid));
        const snap = await getDocs(qDlr);
        if (!snap.empty) {
          const dData = snap.docs[0].data();
          if (dData.dealerName) {
            setDealerBusinessName(dData.dealerName);
            return;
          }
        }
        if (user.email) {
          const qEmail = query(collection(db, "dishtv_dealers"), where("formattedEmail", "==", user.email));
          const snapEmail = await getDocs(qEmail);
          if (!snapEmail.empty) {
            const dData2 = snapEmail.docs[0].data();
            if (dData2.dealerName) {
              setDealerBusinessName(dData2.dealerName);
              return;
            }
          }
        }
      } catch (err) {
        console.error("Error fetching dealer business name:", err);
      }
    };
    fetchDealerName();

    const storedRole = typeof window !== "undefined" ? localStorage.getItem("userRole") : null;
    const isAdmin = user.email === "psdgandepalli@gmail.com" || userRole === "Admin" || storedRole === "Admin";

    // Query customers: Admin gets all, Dealer gets their own customers
    const qCust = isAdmin
      ? query(collection(db, "dishtv_customers"))
      : query(collection(db, "dishtv_customers"), where("userId", "==", user.uid));

    const unsubCust = onSnapshot(
      qCust,
      (snapshot) => {
        const custData = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        })) as DishTvCustomer[];

        custData.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        setCustomers(custData);
        setLoading(false);
      },
      (err) => {
        console.error("Error loading DishTV customers:", err);
        setLoading(false);
      }
    );

    // Query Payment Collections Log: Admin gets all, Dealer gets their own payments
    const qPay = isAdmin
      ? query(collection(db, "dishtv_payments"))
      : query(collection(db, "dishtv_payments"), where("collectedByUid", "==", user.uid));

    const unsubPay = onSnapshot(
      qPay,
      (snapshot) => {
        const payData = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        })) as DishTvPaymentRecord[];

        payData.sort((a, b) => {
          const aTime = a.collectedAt?.seconds || 0;
          const bTime = b.collectedAt?.seconds || 0;
          return bTime - aTime;
        });

        setPayments(payData);
      },
      (err) => {
        console.error("Error loading payment collections:", err);
      }
    );

    return () => {
      unsubCust();
      unsubPay();
    };
  }, [user, userRole, authLoading]);

  // Statistics calculation
  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    let todaysTotal = 0;
    let monthlyTotal = 0;

    payments.forEach((p) => {
      if (p.collectedAt?.toDate) {
        const pDate = p.collectedAt.toDate();
        if (pDate >= today) {
          todaysTotal += p.amount || 0;
        }
        if (pDate >= startOfMonth) {
          monthlyTotal += p.amount || 0;
        }
      }
    });

    const pendingCount = customers.filter((c) => c.status === "Expired").length;

    return {
      todaysTotal,
      monthlyTotal,
      totalPaymentsCount: payments.length,
      pendingCount,
    };
  }, [payments, customers]);

  // Filtered customer directory for collection
  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      const term = searchTerm.toLowerCase().trim();
      const matchesSearch =
        !term ||
        c.name.toLowerCase().includes(term) ||
        (c.mobile && c.mobile.includes(term)) ||
        (c.vcNumber && c.vcNumber.toLowerCase().includes(term)) ||
        (c.subscriberId && c.subscriberId.toLowerCase().includes(term)) ||
        (c.village && c.village.toLowerCase().includes(term)) ||
        (c.mandal && c.mandal.toLowerCase().includes(term)) ||
        (c.district && c.district.toLowerCase().includes(term)) ||
        (c.area && c.area.toLowerCase().includes(term));

      const matchesStatus = filterStatus === "all" || c.status === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [customers, searchTerm, filterStatus]);

  // Open Collection Dialog
  const handleOpenCollect = (customer: DishTvCustomer) => {
    setSelectedCustomer(customer);
    const currentBal = customer.balanceAmount !== undefined ? customer.balanceAmount : (customer.monthlyAmount || 350);
    setCustomAmount(String(currentBal));
    setPaymentMethod("Cash");
    setCollectionNotes("");
    setIsCollectDialogOpen(true);
  };

  // Share Receipt via WhatsApp
  const handleShareWhatsApp = (receipt: DishTvPaymentRecord | null) => {
    if (!receipt) return;
    const receiptText = generateReceiptText({
      businessName: "Sony Cable",
      customerName: receipt.customerName,
      customerId: receipt.customerId || receipt.vcNumber || receipt.id,
      mobile: receipt.mobile,
      paidAmount: receipt.amount,
      remainingBalance: receipt.remainingBalance !== undefined ? receipt.remainingBalance : 0,
      date: formatDate(receipt.collectedAt),
      collectedByName: receipt.collectedByName || "Staff",
    });
    openWhatsAppReceipt(receipt.mobile, receiptText);
  };

  // Handle Payment Collection Submission
  const handleConfirmCollection = async () => {
    if (!selectedCustomer || !user) return;
    setIsSubmitting(true);

    try {
      const amt = parseFloat(customAmount) || 0;
      const currentBal = selectedCustomer.balanceAmount !== undefined ? selectedCustomer.balanceAmount : (selectedCustomer.monthlyAmount || 350);
      const newBal = currentBal - amt;
      const nowTs = Timestamp.now();
      const dlrName = dealerBusinessName || selectedCustomer.dealerName || "Navanidhi Digital System (DishTV Official Partner)";

      // 1. Record in dishtv_payments collection
      const docRef = await addDoc(collection(db, "dishtv_payments"), {
        customerId: selectedCustomer.id,
        customerName: selectedCustomer.name,
        mobile: selectedCustomer.mobile,
        vcNumber: selectedCustomer.vcNumber || "",
        packagePlan: selectedCustomer.packagePlan || "",
        amount: amt,
        paymentMethod: paymentMethod,
        collectedByUid: user.uid,
        collectedByName: user.displayName || user.email || "Dealer",
        dealerName: dlrName,
        collectedAt: nowTs,
        notes: collectionNotes.trim(),
      });

      // 2. Update DishTV Customer balanceAmount & status
      await updateDoc(doc(db, "dishtv_customers", selectedCustomer.id), {
        balanceAmount: newBal,
        status: newBal <= 0 ? "Active" : selectedCustomer.status,
        lastRechargeDate: nowTs,
      });

      const newReceipt: DishTvPaymentRecord = {
        id: docRef.id,
        customerId: selectedCustomer.id,
        customerName: selectedCustomer.name,
        mobile: selectedCustomer.mobile,
        vcNumber: selectedCustomer.vcNumber || "",
        packagePlan: selectedCustomer.packagePlan || "",
        amount: amt,
        remainingBalance: newBal,
        paymentMethod: paymentMethod,
        collectedByUid: user.uid,
        collectedByName: user.displayName || user.email || "Dealer",
        dealerName: dlrName,
        collectedAt: nowTs,
        notes: collectionNotes.trim(),
      };

      toast({
        title: "Payment Collected Successfully! 🎉",
        description: `Collected ₹${amt} from ${selectedCustomer.name} via ${paymentMethod}.`,
      });

      setIsCollectDialogOpen(false);
      setSelectedCustomer(null);

      // Auto-open Receipt modal immediately so dealer can share on WhatsApp or print!
      setSelectedReceipt(newReceipt);
    } catch (err) {
      console.error("Error recording payment collection:", err);
      toast({
        variant: "destructive",
        title: "Collection Failed",
        description: "An error occurred while saving the payment collection.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (ts?: Timestamp | null) => {
    if (!ts) return "N/A";
    try {
      return ts.toDate().toLocaleDateString("en-IN", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "N/A";
    }
  };

  return (
    <main className="min-h-screen w-full font-body text-foreground bg-muted/20">
      <div className="container mx-auto p-4 py-8 md:p-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary/10 rounded-xl text-primary">
                <HandCoins className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Payment Collections</h1>
                <p className="text-muted-foreground mt-1">
                  Collect balance payments from customers and view collection history.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-emerald-500 bg-card">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Today's Collection (నేటి కలెక్షన్)</p>
                <h3 className="text-2xl font-bold mt-1 text-emerald-600">₹{stats.todaysTotal.toLocaleString()}</h3>
              </div>
              <div className="p-2.5 bg-emerald-500/10 rounded-lg text-emerald-600">
                <IndianRupee className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-blue-500 bg-card">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">This Month Total (ఈ నెల కలెక్షన్)</p>
                <h3 className="text-2xl font-bold mt-1 text-blue-600">₹{stats.monthlyTotal.toLocaleString()}</h3>
              </div>
              <div className="p-2.5 bg-blue-500/10 rounded-lg text-blue-600">
                <Calendar className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-amber-500 bg-card">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Expired / Due Connections</p>
                <h3 className="text-2xl font-bold mt-1 text-amber-600">{stats.pendingCount}</h3>
              </div>
              <div className="p-2.5 bg-amber-500/10 rounded-lg text-amber-600">
                <HandCoins className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-purple-500 bg-card">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Transactions</p>
                <h3 className="text-2xl font-bold mt-1 text-purple-600">{stats.totalPaymentsCount}</h3>
              </div>
              <div className="p-2.5 bg-purple-500/10 rounded-lg text-purple-600">
                <Receipt className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Customer Directory for Collect Payment */}
        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <HandCoins className="h-5 w-5 text-primary" />
                  Customer Payment Collections
                </CardTitle>
                <CardDescription className="mt-1">
                  Search customer by VC Number, Mobile, Name, or Location to collect balance payments.
                </CardDescription>
              </div>

              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative w-full sm:w-80">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Search by VC No, Mobile, Name, Location..."
                    className="pl-9"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-full sm:w-36">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Expired">Expired / Due</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {loading || authLoading ? (
              <div className="flex justify-center items-center py-16 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin mr-3 text-primary" />
                <span>Loading customer directory...</span>
              </div>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead>Customer Info</TableHead>
                      <TableHead>Location (Village / Mandal)</TableHead>
                      <TableHead>Monthly Fee / Balance</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Collect Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCustomers.length > 0 ? (
                      filteredCustomers.map((cust) => (
                        <TableRow key={cust.id} className="hover:bg-muted/40 transition-colors">
                          <TableCell>
                            <div>
                              <div className="font-semibold text-foreground">{cust.name}</div>
                              <div className="text-xs text-muted-foreground mt-0.5">{cust.mobile}</div>
                              {cust.vcNumber && (
                                <div className="text-[11px] font-mono text-purple-600 dark:text-purple-400 mt-0.5 font-medium">
                                  VC: {cust.vcNumber}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="text-sm font-medium text-foreground">{cust.village || cust.area || "N/A"}</div>
                              <div className="text-[11px] text-muted-foreground">{[cust.mandal, cust.district].filter(Boolean).join(", ")}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="font-semibold text-emerald-600 text-base">
                              ₹{(cust.balanceAmount !== undefined ? cust.balanceAmount : (cust.monthlyAmount || 350)).toLocaleString()}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={cust.status === "Active" ? "default" : "destructive"}
                              className={cust.status === "Active" ? "bg-emerald-600" : "bg-amber-600"}
                            >
                              {cust.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenHistory(cust)}
                                className="h-9 px-3 border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950 font-medium"
                              >
                                <History className="h-4 w-4 mr-1.5" />
                                History
                              </Button>
                              <Button
                                onClick={() => handleOpenCollect(cust)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white h-9 px-3 font-medium"
                              >
                                <HandCoins className="h-4 w-4 mr-1.5" />
                                Collect Payment
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="h-28 text-center text-muted-foreground">
                          No customer records match your search.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Collection History Log */}
        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5 text-primary" />
                  Recent Payment Collections History
                </CardTitle>
                <CardDescription className="mt-1">
                  Log of all balance payments collected from customers.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Amount Collected</TableHead>
                    <TableHead>Payment Mode</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="text-right">Receipt</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.length > 0 ? (
                    payments.map((pay) => (
                      <TableRow key={pay.id} className="hover:bg-muted/40 transition-colors">
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDate(pay.collectedAt)}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-semibold text-foreground">{pay.customerName}</div>
                            <div className="text-xs text-muted-foreground">{pay.mobile}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-bold text-emerald-600 text-base">₹{pay.amount?.toLocaleString()}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize bg-muted/50">
                            {pay.paymentMethod || "Cash"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {pay.notes || "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleShareWhatsApp(pay)}
                              className="h-8 px-2 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 font-medium"
                              title="Share Receipt on WhatsApp"
                            >
                              <Share2 className="h-3.5 w-3.5 mr-1" />
                              WhatsApp
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedReceipt(pay)}
                              className="h-8 px-2 text-xs text-primary"
                            >
                              <Receipt className="h-3.5 w-3.5 mr-1" />
                              View
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                        No payment collections recorded yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Collect Payment Modal */}
      {selectedCustomer && (
        <Dialog open={isCollectDialogOpen} onOpenChange={setIsCollectDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl">
                <HandCoins className="h-6 w-6 text-emerald-600" />
                Collect Payment: {selectedCustomer.name}
              </DialogTitle>
              <DialogDescription>
                Record payment collected from customer towards their balance.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="p-3.5 bg-emerald-500/10 rounded-lg border border-emerald-200/50 flex justify-between items-center">
                <div>
                  <div className="font-semibold text-emerald-950 dark:text-emerald-200 text-base">{selectedCustomer.name}</div>
                  <div className="text-xs text-emerald-800 dark:text-emerald-300">{selectedCustomer.mobile}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">Monthly Fee</div>
                  <div className="font-bold text-emerald-600 text-lg">₹{selectedCustomer.monthlyAmount || 350}</div>
                </div>
              </div>

              {/* Amount Entry */}
              <div className="space-y-2">
                <Label htmlFor="amountInput" className="text-sm font-medium">Collected Amount (₹) *</Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-muted-foreground font-bold">₹</span>
                  <Input
                    id="amountInput"
                    type="number"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    className="pl-8 text-lg font-bold text-emerald-600 bg-background"
                  />
                </div>
              </div>

              {/* Payment Mode */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Payment Method *</Label>
                <RadioGroup
                  value={paymentMethod}
                  onValueChange={setPaymentMethod}
                  className="flex items-center gap-6 p-3 bg-muted/20 rounded-lg border"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="Cash" id="pm-cash" />
                    <Label htmlFor="pm-cash" className="cursor-pointer font-medium">💵 Cash</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="UPI" id="pm-upi" />
                    <Label htmlFor="pm-upi" className="cursor-pointer font-medium">📱 UPI / QR</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="Bank" id="pm-bank" />
                    <Label htmlFor="pm-bank" className="cursor-pointer font-medium">🏦 Bank</Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Optional Notes */}
              <div className="space-y-2">
                <Label htmlFor="notesInput" className="text-sm font-medium">Notes / Reference No</Label>
                <Input
                  id="notesInput"
                  placeholder="e.g. UPI Ref #12345 or internal note"
                  value={collectionNotes}
                  onChange={(e) => setCollectionNotes(e.target.value)}
                  className="bg-background"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setIsCollectDialogOpen(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button
                onClick={handleConfirmCollection}
                disabled={isSubmitting || !customAmount}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                Confirm Collection
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Receipt View Modal */}
      {selectedReceipt && (
        <Dialog open={!!selectedReceipt} onOpenChange={() => setSelectedReceipt(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl text-primary">
                <Receipt className="h-6 w-6" />
                Payment Collection Receipt
              </DialogTitle>
              <DialogDescription>
                Customer Balance Payment Voucher
              </DialogDescription>
            </DialogHeader>

            <div className="p-4 bg-muted/30 border rounded-xl space-y-3 font-body">
              <div className="text-center border-b pb-3">
                <h4 className="font-bold text-lg tracking-wide text-foreground uppercase">
                  {selectedReceipt.dealerName || dealerBusinessName || selectedCustomer?.dealerName || "Navanidhi Digital System (DishTV Official Partner)"}
                </h4>
                <p className="text-xs text-muted-foreground">Payment Collection Receipt</p>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Customer Name:</span>
                  <span className="font-semibold text-foreground">{selectedReceipt.customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Mobile:</span>
                  <span className="font-mono">{selectedReceipt.mobile}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Payment Mode:</span>
                  <span className="font-medium">{selectedReceipt.paymentMethod}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Collection Date:</span>
                  <span>{formatDate(selectedReceipt.collectedAt)}</span>
                </div>
                {selectedReceipt.notes && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Notes:</span>
                    <span className="font-medium">{selectedReceipt.notes}</span>
                  </div>
                )}
              </div>

              <div className="border-t pt-3 flex justify-between items-center text-lg font-bold">
                <span>Amount Paid:</span>
                <span className="text-emerald-600">₹{selectedReceipt.amount?.toLocaleString()}</span>
              </div>
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-2">
              <Button
                onClick={() => handleShareWhatsApp(selectedReceipt)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm w-full sm:w-auto"
              >
                <Share2 className="h-4 w-4 mr-2" />
                Send WhatsApp Receipt
              </Button>
              <Button
                onClick={() => {
                  if (!selectedReceipt) return;
                  const receiptText = generateReceiptText({
                    businessName: "Sony Cable",
                    customerName: selectedReceipt.customerName,
                    customerId: selectedReceipt.customerId || selectedReceipt.vcNumber || selectedReceipt.id,
                    mobile: selectedReceipt.mobile,
                    paidAmount: selectedReceipt.amount,
                    remainingBalance: selectedReceipt.remainingBalance !== undefined ? selectedReceipt.remainingBalance : 0,
                    date: formatDate(selectedReceipt.collectedAt),
                    collectedByName: selectedReceipt.collectedByName || "Staff",
                  });
                  openSmsReceipt(selectedReceipt.mobile, receiptText);
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm w-full sm:w-auto"
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Send SMS Receipt
              </Button>
              <Button onClick={() => window.print()} variant="outline" className="w-full sm:w-auto">
                Print Receipt
              </Button>
              <Button onClick={() => setSelectedReceipt(null)} variant="secondary" className="w-full sm:w-auto">
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Customer History & Ledger Modal */}
      {historyCustomer && (
        <Dialog open={isHistoryModalOpen} onOpenChange={setIsHistoryModalOpen}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl text-amber-600">
                <History className="h-6 w-6" />
                Customer History & Ledger: {historyCustomer.name}
              </DialogTitle>
              <DialogDescription>
                Log of payment collections and service charges for {historyCustomer.name} ({historyCustomer.mobile}).
              </DialogDescription>
            </DialogHeader>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 my-2">
              <div className="p-3 bg-emerald-500/10 border border-emerald-200/50 rounded-lg">
                <div className="text-[11px] text-emerald-800 dark:text-emerald-300 font-medium">Total Paid</div>
                <div className="text-base sm:text-lg font-bold text-emerald-600">
                  ₹{customerPayments.reduce((sum, p) => sum + (p.amount || 0), 0).toLocaleString()}
                </div>
                <div className="text-[10px] text-muted-foreground">{customerPayments.length} Payments</div>
              </div>

              <div className="p-3 bg-purple-500/10 border border-purple-200/50 rounded-lg">
                <div className="text-[11px] text-purple-800 dark:text-purple-300 font-medium">Recharges</div>
                <div className="text-base sm:text-lg font-bold text-purple-600">
                  ₹{customerRecharges.reduce((sum, r) => sum + (r.amount || 0), 0).toLocaleString()}
                </div>
                <div className="text-[10px] text-muted-foreground">{customerRecharges.length} Renewals</div>
              </div>

              <div className="p-3 bg-amber-500/10 border border-amber-200/50 rounded-lg">
                <div className="text-[11px] text-amber-800 dark:text-amber-300 font-medium">Services</div>
                <div className="text-base sm:text-lg font-bold text-amber-600">
                  ₹{customerServices.reduce((sum, s) => sum + (s.amount || 0), 0).toLocaleString()}
                </div>
                <div className="text-[10px] text-muted-foreground">{customerServices.length} Services</div>
              </div>

              <div className="p-3 bg-blue-500/10 border border-blue-200/50 rounded-lg">
                <div className="text-[11px] text-blue-800 dark:text-blue-300 font-medium">Balance Due</div>
                <div className="text-base sm:text-lg font-bold text-blue-600">
                  ₹{(historyCustomer.balanceAmount !== undefined ? historyCustomer.balanceAmount : (historyCustomer.monthlyAmount || 350)).toLocaleString()}
                </div>
                <div className="text-[10px] text-muted-foreground">Outstanding</div>
              </div>
            </div>

            {/* Filter Bar Chips */}
            <div className="flex flex-wrap items-center gap-1.5 border-b border-muted pb-2 my-2">
              <span className="text-xs text-muted-foreground font-medium mr-1">Filter:</span>
              <Button
                variant={historyFilter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setHistoryFilter("all")}
                className={`h-7 px-2.5 text-xs ${historyFilter === "all" ? "bg-primary text-white" : ""}`}
              >
                All History ({allTransactions.length})
              </Button>
              <Button
                variant={historyFilter === "Payment" ? "default" : "outline"}
                size="sm"
                onClick={() => setHistoryFilter("Payment")}
                className={`h-7 px-2.5 text-xs ${historyFilter === "Payment" ? "bg-emerald-600 text-white" : ""}`}
              >
                <HandCoins className="h-3 w-3 mr-1" />
                Payments ({customerPayments.length})
              </Button>
              <Button
                variant={historyFilter === "Recharge" ? "default" : "outline"}
                size="sm"
                onClick={() => setHistoryFilter("Recharge")}
                className={`h-7 px-2.5 text-xs ${historyFilter === "Recharge" ? "bg-purple-600 text-white" : ""}`}
              >
                <Zap className="h-3 w-3 mr-1" />
                Recharges ({customerRecharges.length})
              </Button>
              <Button
                variant={historyFilter === "Service" ? "default" : "outline"}
                size="sm"
                onClick={() => setHistoryFilter("Service")}
                className={`h-7 px-2.5 text-xs ${historyFilter === "Service" ? "bg-amber-600 text-white" : ""}`}
              >
                <Wrench className="h-3 w-3 mr-1" />
                Services ({customerServices.length})
              </Button>
            </div>

            {/* Single Chronological History Table */}
            {loadingHistory ? (
              <div className="flex justify-center items-center py-12 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin mr-2 text-primary" />
                <span>Loading complete transaction history...</span>
              </div>
            ) : (
              <div className="rounded-md border overflow-x-auto max-h-[350px] overflow-y-auto">
                <Table>
                  <TableHeader className="bg-muted/60 sticky top-0 z-10">
                    <TableRow>
                      <TableHead>Date & Time</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Title & Description</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allTransactions.filter(t => historyFilter === "all" || t.type === historyFilter).length > 0 ? (
                      allTransactions
                        .filter(t => historyFilter === "all" || t.type === historyFilter)
                        .map((txn) => (
                          <TableRow key={txn.id} className="hover:bg-muted/40 transition-colors">
                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap font-medium">
                              {formatDate(txn.date)}
                            </TableCell>
                            <TableCell>
                              <Badge
                                className={
                                  txn.type === "Payment"
                                    ? "bg-emerald-600 hover:bg-emerald-700"
                                    : txn.type === "Recharge"
                                    ? "bg-purple-600 hover:bg-purple-700 text-white"
                                    : "bg-amber-600 hover:bg-amber-700 text-white"
                                }
                              >
                                {txn.type === "Payment" ? "Payment Received" : txn.type}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div>
                                <div className="font-semibold text-xs text-foreground">{txn.title}</div>
                                <div className="text-[11px] text-muted-foreground">{txn.details}</div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span
                                className={`font-bold text-sm ${
                                  txn.isCredit ? "text-emerald-600" : "text-amber-600 dark:text-amber-400"
                                }`}
                              >
                                {txn.isCredit ? "-" : "+"}₹{txn.amount?.toLocaleString()}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              {txn.type === "Payment" && txn.rawPayDoc ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleShareWhatsApp(txn.rawPayDoc || null)}
                                  className="h-7 px-2 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                  title="Share Receipt on WhatsApp"
                                >
                                  <Share2 className="h-3.5 w-3.5 mr-1" />
                                  WhatsApp
                                </Button>
                              ) : (
                                <span className="text-xs text-muted-foreground">-</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                          No history records found for this filter.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}

            <DialogFooter>
              <Button onClick={() => setIsHistoryModalOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </main>
  );
}
