'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import {
  ArrowLeft,
  Loader2,
  Receipt,
  HandCoins,
  Wallet,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownLeft,
  Printer,
  Calendar,
  FileSpreadsheet,
  Wrench,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, doc, getDoc, onSnapshot, query, where } from "firebase/firestore";
import { useAuth } from '@/hooks/useAuth';

interface Customer {
  id: string;
  name: string;
  mobile: string;
  area: string;
  stbId: string;
  customerId: string;
  balanceAmount: number;
}

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: string;
  status?: string;
  type: 'Recharge' | 'Payment';
  packageName?: string;
  method?: string;
  isExtraDue?: boolean;
}

interface PassbookTransaction extends Transaction {
  numericAmount: number;
  runningBalance: number;
}

export default function CustomerHistoryClient() {
  const params = useParams();
  const searchParams = useSearchParams();
  const customerId = (params?.id as string) || searchParams?.get('id') || '';
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user, userRole, loading: authLoading } = useAuth();
  const [rechargeHistory, setRechargeHistory] = useState<Transaction[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<Transaction[]>([]);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const day = String(d.getDate()).padStart(2, "0");
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const month = monthNames[d.getMonth()];
      const year = d.getFullYear();
      return `${day}-${month}-${year}`;
    } catch (e) {
      return dateStr;
    }
  };

  // Passbook Ledger Computation & Running Balance Calculation
  const { passbookTransactions, totalBilled, totalPaid, currentNetDue } = useMemo(() => {
    const sumRecharges = rechargeHistory.reduce((sum, item) => sum + (parseFloat(String(item.amount)) || 0), 0);
    const sumPayments = paymentHistory.reduce((sum, item) => sum + (parseFloat(String(item.amount)) || 0), 0);

    const combined = [...rechargeHistory, ...paymentHistory];
    
    // Sort ascending chronologically (oldest first) to accurately compute cumulative running balance
    combined.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const netFromTxns = sumRecharges - sumPayments;
    const targetBal = customer?.balanceAmount !== undefined ? parseFloat(String(customer.balanceAmount)) : netFromTxns;
    const initialBalance = targetBal - netFromTxns;

    let currentBal = initialBalance;
    const listWithBalance: PassbookTransaction[] = [];

    // Optional opening balance entry if customer had previous debt prior to recorded transactions
    if (initialBalance !== 0 && combined.length > 0) {
      const oldestDate = new Date(combined[0].date);
      const openingDate = new Date(oldestDate.getTime() - 86400000);
      listWithBalance.push({
        id: 'opening-balance',
        date: openingDate.toISOString(),
        description: initialBalance > 0 ? 'Opening Balance (Previous Due)' : 'Opening Balance (Previous Advance)',
        amount: String(Math.abs(initialBalance)),
        numericAmount: Math.abs(initialBalance),
        type: initialBalance > 0 ? 'Recharge' : 'Payment',
        runningBalance: currentBal,
      });
    }

    combined.forEach((tx) => {
      const amt = parseFloat(String(tx.amount)) || 0;
      if (tx.type === 'Recharge') {
        currentBal += amt;
      } else {
        currentBal -= amt;
      }

      listWithBalance.push({
        ...tx,
        numericAmount: amt,
        runningBalance: currentBal,
      });
    });

    // Sort strictly descending chronologically (latest transactions on top)
    listWithBalance.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return {
      passbookTransactions: listWithBalance,
      totalBilled: sumRecharges + (initialBalance > 0 ? initialBalance : 0),
      totalPaid: sumPayments + (initialBalance < 0 ? Math.abs(initialBalance) : 0),
      currentNetDue: targetBal,
    };
  }, [rechargeHistory, paymentHistory, customer?.balanceAmount]);

  useEffect(() => {
    if (authLoading || !customerId || customerId === 'placeholder') {
      if (!authLoading && (!customerId || customerId === 'placeholder')) setLoading(false);
      return;
    }

    setLoading(true);
    const getCustomerData = async () => {
      const docRef = doc(db, "customers", customerId);
      try {
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setCustomer({ id: docSnap.id, ...docSnap.data() } as Customer);
        } else {
          toast({
            variant: "destructive",
            title: "Customer not found",
          });
        }
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Failed to fetch customer",
        });
      }
    };

    const getTransactionData = async () => {
      const paymentsQuery = query(collection(db, "payments"), where("customerId", "==", customerId));
      const rechargesQuery = query(collection(db, "recharges"), where("customerId", "==", customerId));

      const paymentsUnsubscribe = onSnapshot(paymentsQuery, (snapshot) => {
        const payments = snapshot.docs.map(docSnap => {
          const data = docSnap.data();
          let dateStr = new Date().toISOString();
          if (data.collectionDate) {
            dateStr = typeof data.collectionDate.toDate === 'function' 
              ? data.collectionDate.toDate().toISOString()
              : new Date(data.collectionDate).toISOString();
          }
          return {
            id: docSnap.id,
            date: dateStr,
            description: data.description || `Payment via ${data.method || 'cash'}`,
            amount: data.amount,
            method: data.method,
            type: 'Payment'
          } as Transaction;
        });
        setPaymentHistory(payments);
      });

      const rechargesUnsubscribe = onSnapshot(rechargesQuery, (snapshot) => {
        const recharges = snapshot.docs.map(docSnap => {
          const data = docSnap.data();
          let dateStr = new Date().toISOString();
          if (data.rechargeDate) {
            dateStr = typeof data.rechargeDate.toDate === 'function'
              ? data.rechargeDate.toDate().toISOString()
              : new Date(data.rechargeDate).toISOString();
          }

          const isExtra = Boolean(data.isExtraDue) || (data.packageName && data.packageName.toLowerCase().includes("service charge"));
          const descriptionText = isExtra
            ? (data.packageName || "Extra Service Charge")
            : (data.packageName && data.packageName.startsWith("Recharge") ? data.packageName : `Recharge - ${data.packageName || 'Package'}`);

          return {
            id: docSnap.id,
            date: dateStr,
            description: descriptionText,
            amount: data.amount,
            packageName: data.packageName,
            status: data.paymentReceived ? 'Paid' : 'Unpaid',
            type: 'Recharge',
            isExtraDue: isExtra,
          } as Transaction;
        });
        setRechargeHistory(recharges);
      });

      return () => {
        paymentsUnsubscribe();
        rechargesUnsubscribe();
      };
    };

    const runAsync = async () => {
      await getCustomerData();
      const unsub = await getTransactionData();
      setLoading(false);
      return unsub;
    };

    let unsubscribe: (() => void) | undefined;
    runAsync().then(unsub => unsubscribe = unsub);

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [customerId, toast, user, authLoading]);

  const BackButton = () => {
    if (authLoading) return null;

    const targetBackPath = (userRole === "Admin" || userRole === "Network Service Agent")
      ? "/dashboard/customers"
      : (userRole === "Dealer" ? "/dashboard/dishtv-customers" : "/dashboard/customers-staff");

    return (
      <Button asChild variant="outline" size="sm">
        <Link href={targetBackPath} className="flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Customer List</span>
        </Link>
      </Button>
    );
  };

  if (loading || authLoading) {
    return (
      <main className="flex min-h-screen w-full items-center justify-center font-body text-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
      </main>
    );
  }

  if (!customer) {
    return (
      <main className="min-h-screen w-full font-body text-foreground">
        <div className="container mx-auto p-4 py-8 md:p-12 text-center">
          <h1 className="text-2xl font-bold">Customer Not Found</h1>
          <p className="text-muted-foreground">The requested customer could not be found.</p>
          <div className="mt-4">
            <BackButton />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen w-full font-body text-foreground">
      <div className="container mx-auto p-2 sm:p-4 py-4 md:p-12">
        <div className="mb-4 sm:mb-6 flex items-center justify-between gap-2">
          <BackButton />
          <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-2 print:hidden text-xs sm:text-sm">
            <Printer className="h-4 w-4" />
            <span className="hidden sm:inline">Print Passbook Ledger</span>
            <span className="sm:hidden">Print</span>
          </Button>
        </div>

        {/* Customer Detail Header Card */}
        <Card className="mb-4 sm:mb-6 border-l-4 border-l-primary shadow-sm">
          <CardHeader className="p-3.5 sm:p-6 pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
              <div>
                <CardTitle className="text-xl sm:text-2xl flex flex-wrap items-center gap-2">
                  <span>{customer.name}</span>
                  <Badge variant="outline" className="text-xs font-mono">
                    ID: {customer.customerId || customer.id}
                  </Badge>
                </CardTitle>
                <CardDescription className="mt-1 text-xs sm:text-sm">
                  Debit / Credit Passbook Ledger & Complete Transaction History
                </CardDescription>
              </div>

              {/* 💳 Single Balance Amount Highlight Card */}
              <div className={`w-full sm:w-auto p-3 sm:px-4 sm:py-3 rounded-xl border flex items-center gap-3 shrink-0 shadow-sm ${
                currentNetDue > 0
                  ? "bg-amber-500/10 border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300"
                  : currentNetDue === 0
                  ? "bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                  : "bg-emerald-500/10 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300"
              }`}>
                <div className={`p-2 sm:p-2.5 rounded-full shrink-0 ${
                  currentNetDue > 0
                    ? "bg-amber-500/20 text-amber-700 dark:text-amber-300"
                    : currentNetDue === 0
                    ? "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                    : "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                }`}>
                  <Wallet className="h-4 w-4 sm:h-5 sm:w-5" />
                </div>
                <div>
                  <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider opacity-90">
                    Net Outstanding Balance (మొత్తం బాకీ)
                  </p>
                  <div className="text-lg sm:text-xl font-extrabold tracking-tight">
                    {currentNetDue > 0 && `₹${currentNetDue.toLocaleString()} (Due)`}
                    {currentNetDue === 0 && `₹0 (Settled)`}
                    {currentNetDue < 0 && `-₹${Math.abs(currentNetDue).toLocaleString()} (Advance)`}
                  </div>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-3.5 sm:p-6 pt-0 sm:pt-0">
            <div className="grid grid-cols-2 gap-3 text-xs sm:text-sm md:grid-cols-4 pt-3 border-t">
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider">Mobile</p>
                <p className="font-bold truncate">{customer.mobile}</p>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider">Area</p>
                <p className="font-bold truncate" title={customer.area}>{customer.area}</p>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider">STB ID</p>
                <p className="font-bold truncate">{customer.stbId || "N/A"}</p>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider">Customer ID</p>
                <p className="font-bold truncate">{customer.customerId}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Transaction Passbook Tabs */}
        <Tabs defaultValue="all">
          <TabsList className="grid w-full grid-cols-3 md:w-[600px] mb-4 h-auto p-1 text-xs sm:text-sm">
            <TabsTrigger value="all" className="font-semibold px-1.5 sm:px-3 py-1.5 text-xs sm:text-sm">
              <FileSpreadsheet className="h-3.5 w-3.5 mr-1 hidden sm:inline" />
              Passbook
            </TabsTrigger>
            <TabsTrigger value="recharge" className="font-semibold px-1.5 sm:px-3 py-1.5 text-xs sm:text-sm">
              <Receipt className="h-3.5 w-3.5 mr-1 hidden sm:inline" />
              Recharges ({rechargeHistory.length})
            </TabsTrigger>
            <TabsTrigger value="payment" className="font-semibold px-1.5 sm:px-3 py-1.5 text-xs sm:text-sm">
              <HandCoins className="h-3.5 w-3.5 mr-1 hidden sm:inline" />
              Payments ({paymentHistory.length})
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: Passbook Ledger */}
          <TabsContent value="all">
            <Card className="shadow-sm">
              <CardHeader className="p-3.5 sm:p-6 pb-2 sm:pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <CardTitle className="text-lg sm:text-xl">Debit / Credit Passbook Ledger</CardTitle>
                  <Badge variant="outline" className="text-[10px] sm:text-xs font-normal w-fit">
                    Latest Transactions First
                  </Badge>
                </div>
                <CardDescription className="text-xs sm:text-sm">
                  Date-wise passbook showing when dues were added (Recharges) and reduced (Payments).
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 sm:p-6">
                {/* 📱 MOBILE CARD VIEW (No horizontal scrolling required!) */}
                <div className="block sm:hidden space-y-3 p-3">
                  {passbookTransactions.length > 0 ? (
                    passbookTransactions.map((item) => (
                      <div key={item.id} className="p-3.5 rounded-xl border bg-card shadow-sm space-y-2.5">
                        {/* Row 1: Date & Type Badge */}
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-muted-foreground">{formatDate(item.date)}</span>
                          {item.type === 'Recharge' ? (
                            <Badge className="bg-red-500/10 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900 text-[11px] px-2 py-0.5 flex items-center shrink-0">
                              <ArrowUpRight className="h-3 w-3 mr-1 text-red-600" />
                              Billed (బాకీ పెరిగినది)
                            </Badge>
                          ) : (
                            <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900 text-[11px] px-2 py-0.5 flex items-center shrink-0">
                              <ArrowDownLeft className="h-3 w-3 mr-1 text-emerald-600" />
                              Paid (చెల్లించినది)
                            </Badge>
                          )}
                        </div>

                        {/* Row 2: Description */}
                        <div className="text-sm font-bold text-foreground">
                          {item.description}
                        </div>

                        {/* Row 3: Financial Breakdown (Amount & Running Balance) */}
                        <div className="flex items-center justify-between pt-2 border-t text-xs">
                          <div>
                            <span className="text-[10px] text-muted-foreground block font-medium uppercase tracking-wider">
                              {item.type === 'Recharge' ? 'బాకీ పెరిగిన మొత్తం:' : 'చెల్లించిన మొత్తం:'}
                            </span>
                            {item.type === 'Recharge' ? (
                              <span className="text-base font-extrabold text-red-600 dark:text-red-400">
                                +₹{item.numericAmount.toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">
                                -₹{item.numericAmount.toLocaleString()}
                              </span>
                            )}
                          </div>

                          <div className="text-right">
                            <span className="text-[10px] text-muted-foreground block font-medium uppercase tracking-wider">మొత్తం బాకీ:</span>
                            {item.runningBalance > 0 && (
                              <span className="text-amber-700 dark:text-amber-300 font-bold bg-amber-500/10 border border-amber-300/50 dark:border-amber-800 px-2 py-0.5 rounded text-xs inline-block mt-0.5">
                                ₹{item.runningBalance.toLocaleString()} (Due)
                              </span>
                            )}
                            {item.runningBalance === 0 && (
                              <span className="text-slate-600 dark:text-slate-400 font-bold bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-xs inline-block mt-0.5">
                                ₹0 (Settled)
                              </span>
                            )}
                            {item.runningBalance < 0 && (
                              <span className="text-emerald-700 dark:text-emerald-300 font-bold bg-emerald-500/10 border border-emerald-300/50 dark:border-emerald-800 px-2 py-0.5 rounded text-xs inline-block mt-0.5">
                                -₹{Math.abs(item.runningBalance).toLocaleString()} (Advance)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-6 text-center text-xs text-muted-foreground">
                      No transactions recorded for this customer.
                    </div>
                  )}
                </div>

                {/* 💻 DESKTOP TABLE VIEW */}
                <div className="hidden sm:block overflow-x-auto w-full">
                  <Table className="w-full border-collapse">
                    <TableHeader className="bg-muted/70">
                      <TableRow>
                        <TableHead className="w-[130px] p-4 text-sm font-bold text-foreground whitespace-nowrap">
                          Date (తేదీ)
                        </TableHead>
                        <TableHead className="p-4 text-sm font-bold text-foreground min-w-[140px]">
                          Description / Activity (వివరాలు)
                        </TableHead>
                        <TableHead className="p-4 text-sm text-right font-bold text-red-600 dark:text-red-400 min-w-[160px] whitespace-nowrap">
                          Billed / Due Added (బాకీ పెరిగినది)
                        </TableHead>
                        <TableHead className="p-4 text-sm text-right font-bold text-emerald-600 dark:text-emerald-400 min-w-[160px] whitespace-nowrap">
                          Paid / Due Reduced (చెల్లించినది)
                        </TableHead>
                        <TableHead className="p-4 text-sm text-right font-bold text-foreground min-w-[190px] whitespace-nowrap">
                          Running Balance / Net Due (మొత్తం బాకీ)
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {passbookTransactions.length > 0 ? (
                        passbookTransactions.map((item) => (
                          <TableRow key={item.id} className="hover:bg-muted/40 transition-colors">
                            {/* 1. Date */}
                            <TableCell className="p-4 text-sm font-medium whitespace-nowrap text-foreground">
                              {formatDate(item.date)}
                            </TableCell>

                            {/* 2. Description / Activity */}
                            <TableCell className="p-4 text-sm">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {item.type === 'Recharge' ? (
                                  item.isExtraDue ? (
                                    <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900 hover:bg-amber-500/20 text-xs px-2 py-0.5 flex items-center shrink-0 font-medium">
                                      <Wrench className="h-3 w-3 mr-1 text-amber-600" />
                                      Service Due
                                    </Badge>
                                  ) : (
                                    <Badge className="bg-red-500/10 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900 hover:bg-red-500/20 text-xs px-2 py-0.5 flex items-center shrink-0">
                                      <ArrowUpRight className="h-3 w-3 mr-0.5 text-red-600" />
                                      Recharge
                                    </Badge>
                                  )
                                ) : (
                                  <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900 hover:bg-emerald-500/20 text-xs px-2 py-0.5 flex items-center shrink-0">
                                    <ArrowDownLeft className="h-3 w-3 mr-0.5 text-emerald-600" />
                                    Payment
                                  </Badge>
                                )}
                                <span className="font-semibold text-foreground text-sm">{item.description}</span>
                              </div>
                            </TableCell>

                            {/* 3. Billed / Due Added */}
                            <TableCell className="p-4 text-sm text-right font-bold whitespace-nowrap">
                              {item.type === 'Recharge' ? (
                                <span className="text-red-600 dark:text-red-400">
                                  +₹{item.numericAmount.toLocaleString()}
                                </span>
                              ) : (
                                <span className="text-muted-foreground font-normal">-</span>
                              )}
                            </TableCell>

                            {/* 4. Paid / Due Reduced */}
                            <TableCell className="p-4 text-sm text-right font-bold whitespace-nowrap">
                              {item.type === 'Payment' ? (
                                <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                                  -₹{item.numericAmount.toLocaleString()}
                                </span>
                              ) : (
                                <span className="text-muted-foreground font-normal">-</span>
                              )}
                            </TableCell>

                            {/* 5. Running Balance / Net Due */}
                            <TableCell className="p-4 text-sm text-right whitespace-nowrap font-bold">
                              {item.runningBalance > 0 && (
                                <span className="text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-300/50 dark:border-amber-800 px-2 py-0.5 rounded text-xs">
                                  ₹{item.runningBalance.toLocaleString()} (Due)
                                </span>
                              )}
                              {item.runningBalance === 0 && (
                                <span className="text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-xs font-medium">
                                  ₹0 (Settled)
                                </span>
                              )}
                              {item.runningBalance < 0 && (
                                <span className="text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border border-emerald-300/50 dark:border-emerald-800 px-2 py-0.5 rounded text-xs">
                                  -₹{Math.abs(item.runningBalance).toLocaleString()} (Advance)
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                            No transactions recorded for this customer.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 2: Recharge History */}
          <TabsContent value="recharge">
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-xl">Recharge & Billing History</CardTitle>
                <CardDescription>All recharges and monthly plan activations recorded for this customer.</CardDescription>
              </CardHeader>
              <CardContent className="p-0 sm:p-6">
                <div className="overflow-x-auto">
                  <Table className="w-full">
                    <TableHeader className="bg-muted/70">
                      <TableRow>
                        <TableHead className="font-bold">Date</TableHead>
                        <TableHead className="font-bold">Package Name</TableHead>
                        <TableHead className="font-bold text-right">Billed Amount (₹)</TableHead>
                        <TableHead className="font-bold text-center">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rechargeHistory.length > 0 ? (
                        [...rechargeHistory]
                          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                          .map((item) => (
                            <TableRow key={item.id} className="hover:bg-muted/40">
                              <TableCell className="font-medium whitespace-nowrap">{formatDate(item.date)}</TableCell>
                              <TableCell className="font-semibold">{item.packageName || item.description}</TableCell>
                              <TableCell className="text-right font-bold text-red-600 dark:text-red-400">
                                +₹{(parseFloat(String(item.amount)) || 0).toLocaleString()}
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge variant={item.status === 'Paid' ? 'default' : 'destructive'} className="text-xs">
                                  {item.status || 'Active'}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                            No recharge history found.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 3: Payment History */}
          <TabsContent value="payment">
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-xl">Payment Collection History</CardTitle>
                <CardDescription>All payments received from this customer via Cash, UPI, or Bank.</CardDescription>
              </CardHeader>
              <CardContent className="p-0 sm:p-6">
                <div className="overflow-x-auto">
                  <Table className="w-full">
                    <TableHeader className="bg-muted/70">
                      <TableRow>
                        <TableHead className="font-bold">Date</TableHead>
                        <TableHead className="font-bold text-right">Paid Amount (₹)</TableHead>
                        <TableHead className="font-bold">Payment Method</TableHead>
                        <TableHead className="font-bold">Description / Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paymentHistory.length > 0 ? (
                        [...paymentHistory]
                          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                          .map((item) => (
                            <TableRow key={item.id} className="hover:bg-muted/40">
                              <TableCell className="font-medium whitespace-nowrap">{formatDate(item.date)}</TableCell>
                              <TableCell className="text-right font-bold text-emerald-600 dark:text-emerald-400">
                                <span className="inline-flex items-center gap-1">
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  -₹{(parseFloat(String(item.amount)) || 0).toLocaleString()}
                                </span>
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary" className="uppercase text-xs font-bold">
                                  {item.method || 'Cash'}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-muted-foreground">{item.description}</TableCell>
                            </TableRow>
                          ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                            No payment history found.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
