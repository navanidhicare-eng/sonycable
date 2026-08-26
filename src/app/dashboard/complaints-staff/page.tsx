"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PlusCircle, Loader2, Phone, MessageSquare, Send, CheckCircle, Clock, AlertTriangle, Search, Filter } from "lucide-react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, doc, Timestamp, getDocs, runTransaction } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { sendAutoSms } from "@/lib/autoSms";
import { format } from "date-fns";

interface Complaint {
  id: string;
  createdAt: Timestamp;
  customerName: string;
  stbId: string;
  mobile: string;
  area: string;
  complaint: string;
  complaintCategory?: string;
  notes?: string;
  promisedDate?: string;
  promisedTime?: string;
  promisedFormatted?: string;
  status: "Pending" | "In Progress" | "Resolved";
  resolutionNotes?: string;
  userId: string; // Admin's UID
  customerId: string;
  registeredBy?: string;
}

interface Staff {
  adminId: string;
}

function StaffComplaintsListContent() {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isResolveDialogOpen, setIsResolveDialogOpen] = useState(false);
  const [currentComplaint, setCurrentComplaint] = useState<Complaint | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [isSubmittingResolve, setIsSubmittingResolve] = useState(false);
  const { user, userRole, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const isCollectionAgent = useMemo(() => {
    if (!userRole) return false;
    return /collection|collation/i.test(userRole);
  }, [userRole]);

  useEffect(() => {
    if (authLoading || !user) {
      if (!authLoading) setLoading(false);
      return;
    }

    setLoading(true);

    const fetchAdminAndComplaints = async () => {
      try {
        let adminId: string | null = null;
        const staffQuery = query(collection(db, "staff"), where("uid", "==", user.uid));
        const staffSnapshot = await getDocs(staffQuery);

        if (!staffSnapshot.empty) {
          const staffData = staffSnapshot.docs[0].data() as Staff;
          adminId = staffData.adminId;
        } else {
          // Admin account fallback
          adminId = user.uid;
        }

        if (!adminId) {
          setLoading(false);
          return () => {};
        }

        const complaintsQuery = query(collection(db, "complaints"), where("userId", "==", adminId));
        const unsubscribe = onSnapshot(complaintsQuery, (snapshot) => {
          const complaintsData = snapshot.docs.map(docSnap => ({
            id: docSnap.id,
            ...docSnap.data()
          } as Complaint));
          
          complaintsData.sort((a, b) => b.createdAt.seconds - a.createdAt.seconds);
          setComplaints(complaintsData);
          setLoading(false);
        }, (error) => {
          console.error("Error fetching complaints:", error);
          toast({
            variant: "destructive",
            title: "Failed to fetch complaints",
            description: "Could not retrieve complaint data.",
          });
          setLoading(false);
        });

        return unsubscribe;

      } catch (error) {
        console.error("Error fetching staff data for complaints:", error);
        toast({ variant: "destructive", title: "Failed to load necessary data" });
        setLoading(false);
      }
    };

    let unsubscribe: (() => void) | undefined;
    fetchAdminAndComplaints().then(unsub => {
      if (unsub) unsubscribe = unsub;
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user, authLoading, toast]);

  const filteredComplaints = useMemo(() => {
    if (!searchTerm.trim()) return complaints;
    const term = searchTerm.toLowerCase();
    return complaints.filter(c =>
      c.customerName?.toLowerCase().includes(term) ||
      c.mobile?.includes(searchTerm) ||
      c.stbId?.toLowerCase().includes(term) ||
      c.complaint?.toLowerCase().includes(term) ||
      c.area?.toLowerCase().includes(term)
    );
  }, [complaints, searchTerm]);

  const { pendingComplaints, resolvedComplaints } = useMemo(() => {
    const pending = filteredComplaints.filter(c => c.status !== 'Resolved');
    const resolved = filteredComplaints.filter(c => c.status === 'Resolved');
    return { pendingComplaints: pending, resolvedComplaints: resolved };
  }, [filteredComplaints]);

  const openResolveDialog = (complaint: Complaint) => {
    setCurrentComplaint(complaint);
    setResolutionNotes("");
    setIsResolveDialogOpen(true);
  };

  const handleResolveComplaint = async () => {
    if (!currentComplaint || !user || isSubmittingResolve) return;
    setIsSubmittingResolve(true);

    try {
      let adminId = currentComplaint.userId || user.uid;
      const staffQuery = query(collection(db, "staff"), where("uid", "==", user.uid));
      const staffSnapshot = await getDocs(staffQuery);
      if (!staffSnapshot.empty) {
        adminId = staffSnapshot.docs[0].data().adminId;
      }

      await runTransaction(db, async (transaction) => {
        const complaintDocRef = doc(db, "complaints", currentComplaint.id);

        const updatePayload: any = {
          status: "Resolved",
          resolutionNotes: resolutionNotes || "Resolved by staff.",
          resolvedAt: Timestamp.now(),
          resolvedBy: user.displayName || user.email || "Staff",
        };

        transaction.update(complaintDocRef, updatePayload);
      });

      // Send resolution confirmation SMS in Telugu
      if (currentComplaint.mobile) {
        const resSmsText = `ప్రియమైన ${currentComplaint.customerName} గారు,
మీ ఫిర్యాదు (${currentComplaint.complaintCategory || 'సమస్య'}) విజయవంతంగా పరిష్కరించబడింది (RESOLVED).
మీకు జరిగిన అసౌకర్యానికి చింతిస్తున్నాము.
- Sony Cable Network`;
        const isSent = await sendAutoSms({
          phoneNumber: currentComplaint.mobile,
          message: resSmsText,
        });

        // Normal SMS fallback if automatic background SMS was not available
        if (!isSent) {
          const cleanPhone = currentComplaint.mobile.replace(/[^0-9]/g, "").slice(-10);
          const smsUrl = `sms:${cleanPhone}?body=${encodeURIComponent(resSmsText)}`;
          if (typeof window !== "undefined") {
            window.location.href = smsUrl;
          }
        }
      }

      toast({
        title: "Complaint Resolved ✅",
        description: `Marked resolved for ${currentComplaint.customerName}. SMS notification sent.`,
      });

      setIsResolveDialogOpen(false);
      setCurrentComplaint(null);
    } catch (error) {
      console.error("Error resolving complaint:", error);
      toast({
        variant: "destructive",
        title: "Failed to Resolve",
        description: "An error occurred while resolving the complaint.",
      });
    } finally {
      setIsSubmittingResolve(false);
    }
  };

  const handleResendSMS = async (complaint: Complaint) => {
    if (!complaint.mobile) return;
    const smsMessage = `ప్రియమైన ${complaint.customerName} గారు,
మీ ఫిర్యాదు నమోదు చేయబడింది (${complaint.complaint}).
పరిష్కరించే సమయం: ${complaint.promisedFormatted || `${complaint.promisedDate} ${complaint.promisedTime}`}.

మా టెక్నీషియన్ వీలైనంత త్వరగా వచ్చి మీ ప్రాబ్లమ్ క్లియర్ చేస్తారు. మీకు జరిగిన అసౌకర్యానికి చింతిస్తున్నాము.

హెల్ప్‌లైన్: 9010737882
- Sony Cable Network`;
    const isSent = await sendAutoSms({
      phoneNumber: complaint.mobile,
      message: smsMessage,
    });

    if (!isSent) {
      const cleanPhone = complaint.mobile.replace(/[^0-9]/g, "").slice(-10);
      const smsUrl = `sms:${cleanPhone}?body=${encodeURIComponent(smsMessage)}`;
      if (typeof window !== "undefined") {
        window.location.href = smsUrl;
      }
    }

    toast({
      title: "SMS Sent 📱",
      description: `Sent complaint update SMS to ${complaint.mobile}.`,
    });
  };

  const sendNormalSMS = (complaint: Complaint) => {
    const msg = `ప్రియమైన ${complaint.customerName} గారు,
మీ ఫిర్యాదు నమోదు చేయబడింది (${complaint.complaint}).
పరిష్కరించే సమయం: ${complaint.promisedFormatted || `${complaint.promisedDate} ${complaint.promisedTime}`}.

మా టెక్నీషియన్ వీలైనంత త్వరగా వచ్చి మీ ప్రాబ్లమ్ క్లియర్ చేస్తారు. మీకు జరిగిన అసౌకర్యానికి చింతిస్తున్నాము.

హెల్ప్‌లైన్: 9010737882
- Sony Cable Network`;
    const cleanPhone = complaint.mobile.replace(/[^0-9]/g, "").slice(-10);
    const smsUrl = `sms:${cleanPhone}?body=${encodeURIComponent(msg)}`;
    if (typeof window !== "undefined") {
      window.location.href = smsUrl;
    }
  };

  return (
    <>
      <main className="min-h-screen w-full font-body text-foreground">
        <div className="container mx-auto flex flex-col items-center p-3 sm:p-4 py-6 md:p-12 max-w-5xl">
          <header className="mb-6 flex w-full flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-black tracking-tight sm:text-4xl flex items-center gap-2">
                <span>🚨</span> Customer Complaints
              </h1>
              <p className="mt-1 text-xs text-muted-foreground sm:text-base">
                Track customer issues, promised resolution times, and send automatic SMS updates.
              </p>
            </div>
            {!isCollectionAgent && (
              <Button asChild className="bg-amber-600 hover:bg-amber-700 text-white font-bold h-10 px-4">
                <Link href="/dashboard/complaints-staff/add">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  + Register New Complaint
                </Link>
              </Button>
            )}
          </header>

          <Card className="w-full shadow-sm mb-6">
            <CardContent className="p-3 sm:p-4">
              <div className="relative w-full">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by customer name, mobile, STB ID, or complaint notes..."
                  className="pl-9 h-10 text-xs sm:text-sm bg-background"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="pending" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="pending" className="font-extrabold text-xs sm:text-sm">
                🚨 Active Complaints ({pendingComplaints.length})
              </TabsTrigger>
              <TabsTrigger value="resolved" className="font-extrabold text-xs sm:text-sm">
                ✅ Resolved History ({resolvedComplaints.length})
              </TabsTrigger>
            </TabsList>

            {/* 🔴 ACTIVE / PENDING COMPLAINTS TAB */}
            <TabsContent value="pending">
              <Card>
                <CardHeader className="p-4 sm:p-6 pb-2">
                  <CardTitle className="text-lg">Active & Pending Complaints</CardTitle>
                  <CardDescription className="text-xs">
                    Customer issues waiting for resolution or technician visit.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-2 sm:p-6 pt-0">
                  {loading || authLoading ? (
                    <div className="flex justify-center items-center h-40">
                      <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                  ) : (
                    <>
                      {/* 📱 MOBILE CARD VIEW (< md) */}
                      <div className="block md:hidden space-y-3 mt-2">
                        {pendingComplaints.length > 0 ? (
                          pendingComplaints.map((complaint) => (
                            <div
                              key={complaint.id}
                              className="p-3.5 rounded-xl border bg-card shadow-xs hover:border-amber-500/50 transition-all space-y-2.5"
                            >
                              <div className="flex items-start justify-between gap-2 border-b pb-2">
                                <div>
                                  <span className="font-black text-sm text-foreground block">
                                    {complaint.customerName}
                                  </span>
                                  <span className="text-xs text-muted-foreground font-semibold">
                                    📞 {complaint.mobile} | 📺 STB: {complaint.stbId || "N/A"}
                                  </span>
                                </div>
                                <Badge variant="destructive" className="shrink-0 text-[10px] font-bold">
                                  🚨 Pending
                                </Badge>
                              </div>

                              <div className="space-y-1.5 text-xs">
                                <div className="p-2 bg-amber-500/10 rounded-lg border border-amber-500/20">
                                  <span className="font-bold text-amber-700 dark:text-amber-300 block">
                                    📌 {complaint.complaintCategory || "Issue"}
                                  </span>
                                  {complaint.notes && (
                                    <p className="text-foreground text-[11px] mt-0.5 font-medium italic">
                                      "{complaint.notes}"
                                    </p>
                                  )}
                                </div>

                                <div className="flex items-center justify-between text-[11px] text-muted-foreground bg-muted/50 p-2 rounded-md font-semibold">
                                  <span>🕒 Target Completion:</span>
                                  <span className="text-amber-600 dark:text-amber-400 font-bold">
                                    {complaint.promisedFormatted || `${complaint.promisedDate} ${complaint.promisedTime}`}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 pt-1">
                                <Button variant="outline" size="sm" className="h-8 px-2 text-xs flex-1" asChild>
                                  <a href={`tel:${complaint.mobile}`}>
                                    <Phone className="h-3.5 w-3.5 mr-1" /> Call
                                  </a>
                                </Button>
                                 <Button variant="outline" size="sm" className="h-8 px-2 text-xs bg-blue-500/10 text-blue-600 border-blue-500/30" onClick={() => sendNormalSMS(complaint)}>
                                   <MessageSquare className="h-3.5 w-3.5 mr-1" /> Send SMS
                                 </Button>
                                {!isCollectionAgent && (
                                  <Button size="sm" className="h-8 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold" onClick={() => openResolveDialog(complaint)}>
                                    <CheckCircle className="h-3.5 w-3.5 mr-1" /> Resolve
                                  </Button>
                                )}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="py-10 text-center text-xs text-muted-foreground border border-dashed rounded-xl">
                            🎉 No pending complaints! All customer issues are resolved.
                          </div>
                        )}
                      </div>

                      {/* 💻 DESKTOP TABLE VIEW (>= md) */}
                      <div className="hidden md:block overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Customer</TableHead>
                              <TableHead>Issue Category & Details</TableHead>
                              <TableHead>Promised Completion</TableHead>
                              <TableHead>Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {pendingComplaints.length > 0 ? (
                              pendingComplaints.map((complaint) => (
                                <TableRow key={complaint.id}>
                                  <TableCell className="font-medium">
                                    <div className="font-bold">{complaint.customerName}</div>
                                    <div className="text-xs text-muted-foreground">📞 {complaint.mobile}</div>
                                    <div className="text-[11px] text-slate-500">STB: {complaint.stbId} | 📍 {complaint.area}</div>
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-300 font-bold mb-1">
                                      {complaint.complaintCategory || "Complaint"}
                                    </Badge>
                                    {complaint.notes && (
                                      <p className="text-xs text-slate-600 dark:text-slate-300 italic">
                                        "{complaint.notes}"
                                      </p>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-xs">
                                    <div className="font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                      <Clock className="h-3.5 w-3.5" />
                                      {complaint.promisedFormatted || `${complaint.promisedDate} ${complaint.promisedTime}`}
                                    </div>
                                    <div className="text-[10px] text-muted-foreground mt-0.5">
                                      Registered by: {complaint.registeredBy || 'Staff'}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-1">
                                      <Button variant="outline" size="sm" asChild>
                                        <a href={`tel:${complaint.mobile}`}>
                                          <Phone className="h-3.5 w-3.5 mr-1" /> Call
                                        </a>
                                      </Button>
                                       <Button variant="outline" size="sm" className="bg-blue-500/10 text-blue-600 border-blue-500/30" onClick={() => sendNormalSMS(complaint)}>
                                         <MessageSquare className="h-3.5 w-3.5 mr-1" /> Send SMS
                                       </Button>
                                      {!isCollectionAgent && (
                                        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold" onClick={() => openResolveDialog(complaint)}>
                                          <CheckCircle className="h-3.5 w-3.5 mr-1" /> Resolve
                                        </Button>
                                      )}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))
                            ) : (
                              <TableRow>
                                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                                  🎉 No pending complaints found!
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* 🟢 RESOLVED COMPLAINTS TAB */}
            <TabsContent value="resolved">
              <Card>
                <CardHeader className="p-4 sm:p-6 pb-2">
                  <CardTitle className="text-lg">Resolved Complaint History</CardTitle>
                  <CardDescription className="text-xs">
                    History of completed customer service requests and repairs.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-2 sm:p-6 pt-0">
                  {loading || authLoading ? (
                    <div className="flex justify-center items-center h-40">
                      <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Customer</TableHead>
                          <TableHead>Complaint</TableHead>
                          <TableHead>Resolution Details</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {resolvedComplaints.length > 0 ? (
                          resolvedComplaints.map((complaint) => (
                            <TableRow key={complaint.id}>
                              <TableCell className="font-medium">
                                <div className="font-bold">{complaint.customerName}</div>
                                <div className="text-xs text-muted-foreground">📞 {complaint.mobile} | STB: {complaint.stbId}</div>
                              </TableCell>
                              <TableCell className="text-xs">
                                <Badge variant="secondary" className="mb-1">
                                  {complaint.complaintCategory || "Issue"}
                                </Badge>
                                <p className="text-slate-600 dark:text-slate-300">{complaint.complaint}</p>
                              </TableCell>
                              <TableCell className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                                ✅ {complaint.resolutionNotes || "Resolved"}
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                              No resolved complaints in history.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* RESOLUTION MODAL */}
      {currentComplaint && (
        <Dialog open={isResolveDialogOpen} onOpenChange={setIsResolveDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="text-xl font-extrabold flex items-center gap-2">
                <span>✅</span> Resolve Complaint
              </DialogTitle>
              <DialogDescription className="text-xs">
                Marking issue resolved for {currentComplaint.customerName} (STB: {currentComplaint.stbId})
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-3">
              <div className="grid w-full gap-1.5">
                <Label htmlFor="resolution-notes" className="text-xs font-bold">Resolution Notes (వివరణ)</Label>
                <Textarea
                  placeholder="e.g. Wire re-connected, Signal reset, Box replaced..."
                  id="resolution-notes"
                  className="text-xs sm:text-sm min-h-[80px]"
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button 
                type="button" 
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold" 
                onClick={handleResolveComplaint}
                disabled={isSubmittingResolve}
              >
                {isSubmittingResolve ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                Mark as Resolved & Send SMS
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

export default function StaffComplaintsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <StaffComplaintsListContent />
    </Suspense>
  );
}