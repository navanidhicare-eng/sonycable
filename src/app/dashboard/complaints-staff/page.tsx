
"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PlusCircle, Loader2 } from "lucide-react";
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
import { collection, query, where, onSnapshot, doc, updateDoc, Timestamp, getDocs, runTransaction, addDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";


interface Complaint {
  id: string;
  createdAt: Timestamp;
  customerName: string;
  stbId: string;
  complaint: string;
  status: "Pending" | "Resolved";
  resolutionNotes?: string;
  userId: string; // Admin's UID
  customerId: string;
}

interface Staff {
    adminId: string;
}

export default function StaffComplaintsPage() {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [isResolveDialogOpen, setIsResolveDialogOpen] = useState(false);
  const [currentComplaint, setCurrentComplaint] = useState<Complaint | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [resolutionAmount, setResolutionAmount] = useState("");
  const [paymentCollected, setPaymentCollected] = useState(true);
  const { user, userRole, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const isCollectionAgent = useMemo(() => {
    if (!userRole) return false;
    return /collection|collation/i.test(userRole);
  }, [userRole]);

  useEffect(() => {
    if (authLoading || !user) {
      if(!authLoading) setLoading(false);
      return;
    }
    
    setLoading(true);

    const fetchAdminAndComplaints = async () => {
        try {
            const staffQuery = query(collection(db, "staff"), where("uid", "==", user.uid));
            const staffSnapshot = await getDocs(staffQuery);

            if (staffSnapshot.empty) {
                toast({ variant: "destructive", title: "Staff data not found" });
                setLoading(false);
                return () => {};
            }

            const staffData = staffSnapshot.docs[0].data() as Staff;
            const adminId = staffData.adminId;

            if (!adminId) {
                setLoading(false);
                return () => {};
            }

            const complaintsQuery = query(collection(db, "complaints"), where("userId", "==", adminId));
            const unsubscribe = onSnapshot(complaintsQuery, (snapshot) => {
                const complaintsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Complaint));
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
    }

    let unsubscribe: (() => void) | undefined;
    fetchAdminAndComplaints().then(unsub => {
        if(unsub) unsubscribe = unsub;
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [user, authLoading, toast]);
  
  const openResolveDialog = (complaint: Complaint) => {
    setCurrentComplaint(complaint);
    setResolutionNotes("");
    setResolutionAmount("");
    setPaymentCollected(true);
    setIsResolveDialogOpen(true);
  };

  const handleResolveComplaint = async () => {
    if (!currentComplaint || !user) return;
  
    try {
      const staffQuery = query(collection(db, "staff"), where("uid", "==", user.uid));
      const staffSnapshot = await getDocs(staffQuery);
      if (staffSnapshot.empty) {
        throw new Error("Staff details not found");
      }
      const staffData = staffSnapshot.docs[0].data() as Staff;
      
      await runTransaction(db, async (transaction) => {
        const complaintDocRef = doc(db, "complaints", currentComplaint.id);
        const amountValue = parseFloat(resolutionAmount);
  
        const updatePayload: any = {
          status: "Resolved",
          resolutionNotes: resolutionNotes,
        };
  
        if (!isNaN(amountValue) && amountValue > 0) {
          updatePayload.resolutionAmount = amountValue;
          updatePayload.paymentCollected = paymentCollected;
  
          if (paymentCollected) {
            // Add to staff's collection wallet by creating a payment record
            const paymentRef = doc(collection(db, "payments"));
            transaction.set(paymentRef, {
              customerId: currentComplaint.customerId,
              customerName: currentComplaint.customerName,
              amount: amountValue,
              method: "cash", // Assuming cash for service calls
              description: `Complaint Service Charge: ${resolutionNotes || 'N/A'}`,
              collectedBy: user.uid,
              collectionDate: new Date(),
              adminId: staffData.adminId,
            });
          } else {
            // Add to customer's outstanding balance
            const customerDocRef = doc(db, "customers", currentComplaint.customerId);
            const customerDoc = await transaction.get(customerDocRef);
            if (!customerDoc.exists()) {
              throw new Error("Customer not found");
            }
            const currentBalance = customerDoc.data().balanceAmount || 0;
            const newBalance = currentBalance + amountValue;
            transaction.update(customerDocRef, { balanceAmount: newBalance });
          }
        }
  
        transaction.update(complaintDocRef, updatePayload);
      });
  
      toast({
        title: "Complaint Resolved",
        description: "The complaint has been marked as resolved.",
      });
  
      setIsResolveDialogOpen(false);
      setCurrentComplaint(null);
    } catch(error) {
      console.error("Error resolving complaint:", error);
      toast({
        variant: "destructive",
        title: "Resolution Failed",
        description: "Could not update the complaint status.",
      });
    }
  };

  const { pendingComplaints, resolvedComplaints } = useMemo(() => {
    const pending = complaints.filter(c => c.status === 'Pending');
    const resolved = complaints.filter(c => c.status === 'Resolved');
    return { pendingComplaints: pending, resolvedComplaints: resolved };
  }, [complaints]);


  return (
    <>
      <main className="min-h-screen w-full font-body text-foreground">
        <div className="container mx-auto flex flex-col items-center p-4 py-8 md:p-12">
          <header className="mb-10 flex w-full max-w-4xl flex-col items-center text-center sm:flex-row sm:justify-between sm:text-left">
            <div>
              <h1 className="text-4xl font-bold tracking-tighter md:text-5xl">
                Customer Complaints
              </h1>
              <p className="mt-4 max-w-3xl text-lg text-muted-foreground md:text-xl">
                Track and manage customer complaints here.
              </p>
            </div>
            {!isCollectionAgent && (
                <Button asChild className="mt-4 sm:mt-0">
                <Link href="/dashboard/complaints-staff/add">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add Complaint
                </Link>
                </Button>
            )}
          </header>
          
          <Tabs defaultValue="pending" className="w-full max-w-4xl">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="pending">Pending</TabsTrigger>
                <TabsTrigger value="resolved">Resolved</TabsTrigger>
            </TabsList>
            <TabsContent value="pending">
                <Card>
                    <CardHeader>
                        <CardTitle>Pending Complaints</CardTitle>
                        <CardDescription>These are active complaints that need attention.</CardDescription>
                    </CardHeader>
                    <CardContent>
                    {loading || authLoading ? (
                        <div className="flex justify-center items-center h-40">
                            <Loader2 className="h-8 w-8 animate-spin" />
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Customer</TableHead>
                                <TableHead>Complaint</TableHead>
                                <TableHead>Status</TableHead>
                                {!isCollectionAgent && <TableHead>Actions</TableHead>}
                            </TableRow>
                            </TableHeader>
                            <TableBody>
                            {pendingComplaints.length > 0 ? (
                                pendingComplaints.map((complaint) => (
                                <TableRow key={complaint.id}>
                                    <TableCell>{complaint.createdAt.toDate().toLocaleDateString('en-CA')}</TableCell>
                                    <TableCell className="font-medium">
                                    <div>{complaint.customerName}</div>
                                    <div className="text-xs text-muted-foreground">{complaint.stbId}</div>
                                    </TableCell>
                                    <TableCell>{complaint.complaint}</TableCell>
                                    <TableCell>
                                    <Badge
                                        variant="destructive"
                                    >
                                        {complaint.status}
                                    </Badge>
                                    </TableCell>
                                    {!isCollectionAgent && (
                                        <TableCell>
                                            <Button variant="outline" size="sm" onClick={() => openResolveDialog(complaint)}>
                                            Resolve
                                            </Button>
                                        </TableCell>
                                    )}
                                </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={isCollectionAgent ? 4 : 5} className="h-24 text-center">
                                        No pending complaints found.
                                    </TableCell>
                                </TableRow>
                            )}
                            </TableBody>
                        </Table>
                    )}
                    </CardContent>
                </Card>
            </TabsContent>
            <TabsContent value="resolved">
                 <Card>
                    <CardHeader>
                        <CardTitle>Resolved Complaints</CardTitle>
                         <CardDescription>These are complaints that have been closed.</CardDescription>
                    </CardHeader>
                    <CardContent>
                    {loading || authLoading ? (
                        <div className="flex justify-center items-center h-40">
                            <Loader2 className="h-8 w-8 animate-spin" />
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Customer</TableHead>
                                <TableHead>Complaint</TableHead>
                                <TableHead>Resolution</TableHead>
                            </TableRow>
                            </TableHeader>
                            <TableBody>
                            {resolvedComplaints.length > 0 ? (
                                resolvedComplaints.map((complaint) => (
                                <TableRow key={complaint.id}>
                                    <TableCell>{complaint.createdAt.toDate().toLocaleDateString('en-CA')}</TableCell>
                                    <TableCell className="font-medium">
                                    <div>{complaint.customerName}</div>
                                    <div className="text-xs text-muted-foreground">{complaint.stbId}</div>
                                    </TableCell>
                                    <TableCell>{complaint.complaint}</TableCell>
                                    <TableCell>{complaint.resolutionNotes || "N/A"}</TableCell>
                                </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center">
                                        No resolved complaints found.
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
      
      {currentComplaint && (
        <Dialog open={isResolveDialogOpen} onOpenChange={setIsResolveDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Resolve Complaint</DialogTitle>
              <DialogDescription>
                Add notes and any amount related to the complaint resolution.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid w-full gap-1.5">
                <Label htmlFor="resolution-notes">Resolution Notes</Label>
                <Textarea 
                  placeholder="Type your resolution notes here." 
                  id="resolution-notes"
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  />
              </div>
              <div className="grid w-full gap-1.5">
                  <Label htmlFor="resolution-amount">Resolution Amount (₹)</Label>
                  <Input 
                    type="number"
                    id="resolution-amount"
                    placeholder="Enter amount if any"
                    value={resolutionAmount}
                    onChange={(e) => setResolutionAmount(e.target.value)}
                  />
              </div>
              {resolutionAmount && (
                <div className="flex items-center space-x-2">
                    <Checkbox
                        id="payment-collected"
                        checked={paymentCollected}
                        onCheckedChange={(checked) => setPaymentCollected(Boolean(checked))}
                    />
                    <Label htmlFor="payment-collected">Payment Collected</Label>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="button" onClick={handleResolveComplaint}>
                Mark as Resolved
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

    