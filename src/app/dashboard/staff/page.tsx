"use client";

import { useEffect, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle, Loader2, Trash2, Pencil, ShieldAlert, HandCoins, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, doc, deleteDoc, updateDoc, addDoc, Timestamp } from "firebase/firestore";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface Staff {
  id: string;
  uid: string;
  name: string;
  mobile: string;
  area: string | string[];
  role: string;
  email: string;
  commission: string;
  enrollmentCommission?: number;
  collectionLimit?: number;
  status?: "active" | "inactive";
  createdAt: {
    seconds: number;
    nanoseconds: number;
  };
}

export default function StaffPage() {
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [settlements, setSettlements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  
  // Delete Dialog State
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [staffToDelete, setStaffToDelete] = useState<Staff | null>(null);

  // Settle Cash Modal State
  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);
  const [selectedStaffForSettle, setSelectedStaffForSettle] = useState<Staff | null>(null);
  const [settleAmount, setSettleAmount] = useState("");
  const [isSubmittingSettle, setIsSubmittingSettle] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const staffQuery = query(collection(db, "staff"), where("adminId", "==", user.uid));
    const paymentsQuery = query(collection(db, "payments"), where("adminId", "==", user.uid));
    const settlementsQuery = query(collection(db, "settlements"), where("adminId", "==", user.uid));

    const unsubs = [
      onSnapshot(staffQuery, (snapshot) => {
        const staffData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Staff));
        staffData.sort((a, b) => b.createdAt.seconds - a.createdAt.seconds);
        setStaffList(staffData);
        setLoading(false);
      }, (error) => {
        console.error("Error fetching staff:", error);
        toast({ variant: "destructive", title: "Failed to fetch staff" });
        setLoading(false);
      }),
      onSnapshot(paymentsQuery, (snapshot) => {
        setPayments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }),
      onSnapshot(settlementsQuery, (snapshot) => {
        setSettlements(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      })
    ];

    return () => unsubs.forEach(unsub => unsub());
  }, [user, authLoading, toast]);

  // Compute live wallet cash in hand balance for each staff member
  const staffWalletsMap = useMemo(() => {
    const map: Record<string, number> = {};
    staffList.forEach((staff) => {
      const staffPayments = payments.filter((p) => p.collectedBy === staff.uid);
      const totalCollected = staffPayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

      const staffSettlements = settlements.filter((s) => s.staffId === staff.uid && s.status === "approved");
      const totalSettled = staffSettlements.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);

      map[staff.uid] = Math.max(0, totalCollected - totalSettled);
    });
    return map;
  }, [staffList, payments, settlements]);

  // Auto-sync staff status in Firestore to inactive if collection limit is reached or exceeded
  useEffect(() => {
    if (!staffList.length) return;
    staffList.forEach((staff) => {
      const cashInHand = staffWalletsMap[staff.uid] || 0;
      const limit = staff.collectionLimit ?? 10000;
      if (limit > 0 && cashInHand >= limit && staff.status !== "inactive") {
        updateDoc(doc(db, "staff", staff.id), { status: "inactive" }).catch((err) =>
          console.error("Error auto-locking staff doc:", err)
        );
      }
    });
  }, [staffList, staffWalletsMap]);

  const handleToggleStatus = async (staff: Staff, isActive: boolean) => {
    const newStatus = isActive ? "active" : "inactive";
    try {
      await updateDoc(doc(db, "staff", staff.id), { status: newStatus });
      toast({
        title: "Staff Status Updated",
        description: `${staff.name} is now marked as ${newStatus.toUpperCase()}.`,
      });
    } catch (error) {
      console.error("Error updating status:", error);
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: "Could not update staff status in database.",
      });
    }
  };

  const openSettleModal = (staff: Staff) => {
    setSelectedStaffForSettle(staff);
    const currentBalance = staffWalletsMap[staff.uid] || 0;
    setSettleAmount(String(currentBalance));
    setIsSettleModalOpen(true);
  };

  const handleConfirmAdminSettle = async () => {
    if (!selectedStaffForSettle || !settleAmount || !user) return;
    const amountToSettle = parseFloat(settleAmount);
    if (isNaN(amountToSettle) || amountToSettle <= 0) {
      toast({
        variant: "destructive",
        title: "Invalid Amount",
        description: "Please enter a valid positive settlement amount.",
      });
      return;
    }

    setIsSubmittingSettle(true);
    try {
      // 1. Record approved settlement in settlements collection
      await addDoc(collection(db, "settlements"), {
        staffId: selectedStaffForSettle.uid,
        amount: amountToSettle,
        status: "approved",
        createdAt: Timestamp.now(),
        adminId: user.uid,
        notes: "Admin Direct Cash Settlement",
      });

      // 2. Compute remaining balance after settlement
      const currentWallet = staffWalletsMap[selectedStaffForSettle.uid] || 0;
      const newWallet = Math.max(0, currentWallet - amountToSettle);
      const limit = selectedStaffForSettle.collectionLimit ?? 10000;

      // 3. Auto-Activation check: If new balance < limit and staff status is inactive, activate!
      let isAutoActivated = false;
      if (newWallet < limit && selectedStaffForSettle.status === "inactive") {
        await updateDoc(doc(db, "staff", selectedStaffForSettle.id), { status: "active" });
        isAutoActivated = true;
      }

      toast({
        title: "Cash Settled Successfully! 💰",
        description: `Received ₹${amountToSettle.toLocaleString()} from ${selectedStaffForSettle.name}.${
          isAutoActivated ? " Account status automatically set to ACTIVE!" : ""
        }`,
      });

      setIsSettleModalOpen(false);
      setSelectedStaffForSettle(null);
      setSettleAmount("");
    } catch (error) {
      console.error("Error recording settlement: ", error);
      toast({
        variant: "destructive",
        title: "Settlement Failed",
        description: "An error occurred while settling staff cash balance.",
      });
    } finally {
      setIsSubmittingSettle(false);
    }
  };

  const openDeleteDialog = (staff: Staff) => {
    setStaffToDelete(staff);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteStaff = async () => {
    if (!staffToDelete) return;

    try {
      await deleteDoc(doc(db, "staff", staffToDelete.id));
      toast({
        title: "Staff Deleted",
        description: `${staffToDelete.name} has been removed from Firestore.`,
      });
    } catch (error) {
      console.error("Error deleting staff: ", error);
      toast({
        variant: "destructive",
        title: "Deletion Failed",
        description: "An error occurred while deleting the staff member.",
      });
    } finally {
      setIsDeleteDialogOpen(false);
      setStaffToDelete(null);
    }
  };

  return (
    <>
      <main className="min-h-screen w-full font-body text-foreground">
        <div className="container mx-auto flex flex-col items-center p-4 py-8 md:p-12">
          <header className="mb-10 flex w-full max-w-6xl flex-col items-center text-center sm:flex-row sm:justify-between sm:text-left">
            <div>
              <h1 className="text-4xl font-bold tracking-tighter md:text-5xl">
                Staff Management
              </h1>
              <p className="mt-4 max-w-3xl text-lg text-muted-foreground md:text-xl">
                Manage your collection agents, auto-lock collection limits, and cash settlements.
              </p>
            </div>
            <Button asChild className="mt-4 sm:mt-0">
              <Link href="/dashboard/staff/add">
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Staff
              </Link>
            </Button>
          </header>

          <Card className="w-full max-w-6xl">
            <CardHeader>
              <CardTitle>Staff List & Collection Limits</CardTitle>
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
                      <TableHead>Staff Name</TableHead>
                      <TableHead>Mobile</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Cash in Hand (Pending)</TableHead>
                      <TableHead>Collection Limit</TableHead>
                      <TableHead>Commission</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {staffList.length > 0 ? (
                      staffList.map((staff) => {
                        const cashInHand = staffWalletsMap[staff.uid] || 0;
                        const limit = staff.collectionLimit ?? 10000;
                        const isLimitReached = cashInHand >= limit && limit > 0;
                        const isActive = !isLimitReached && (staff.status || "active") === "active";

                        return (
                          <TableRow key={staff.id}>
                            <TableCell className="font-medium">
                              <Link
                                href={`/dashboard/staff/${staff.id}/edit`}
                                className="hover:underline text-primary"
                              >
                                {staff.name}
                              </Link>
                            </TableCell>
                            <TableCell>{staff.mobile}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{staff.role}</Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className={`font-bold ${isLimitReached ? "text-rose-600 font-extrabold" : "text-emerald-600"}`}>
                                  ₹{cashInHand.toLocaleString()}
                                </span>
                                {isLimitReached && (
                                  <span className="text-[10px] text-rose-500 font-bold uppercase tracking-wider">
                                    Limit Reached
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="font-medium text-slate-700">
                              ₹{limit.toLocaleString()}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">{staff.commission}</Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Switch
                                  checked={isActive}
                                  onCheckedChange={(checked) => handleToggleStatus(staff, checked)}
                                />
                                <Badge variant={isActive ? "default" : "destructive"}>
                                  {isActive ? "Active" : "Inactive"}
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell className="text-right flex items-center justify-end gap-1.5">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openSettleModal(staff)}
                                className="border-emerald-600/40 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 text-xs font-semibold"
                              >
                                <HandCoins className="mr-1 h-3.5 w-3.5 text-emerald-600" />
                                Settle Cash
                              </Button>
                              <Button variant="ghost" size="icon" asChild>
                                <Link href={`/dashboard/staff/${staff.id}/edit`}>
                                  <Pencil className="h-4 w-4" />
                                </Link>
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => openDeleteDialog(staff)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={8} className="h-24 text-center">
                          No staff found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Admin Settle Cash Modal */}
      {selectedStaffForSettle && (
        <Dialog open={isSettleModalOpen} onOpenChange={setIsSettleModalOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <HandCoins className="h-5 w-5 text-emerald-600" />
                Settle Cash from {selectedStaffForSettle.name}
              </DialogTitle>
              <DialogDescription>
                Record cash received from this staff member.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-3 text-sm">
              <div className="p-3 rounded-lg bg-muted space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Collected Cash in Hand:</span>
                  <strong className="text-rose-600 font-bold">
                    ₹{(staffWalletsMap[selectedStaffForSettle.uid] || 0).toLocaleString()}
                  </strong>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Collection Limit:</span>
                  <span className="font-medium text-foreground">
                    ₹{(selectedStaffForSettle.collectionLimit ?? 10000).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Current Account Status:</span>
                  <Badge variant={selectedStaffForSettle.status === "active" ? "default" : "destructive"}>
                    {selectedStaffForSettle.status === "active" ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="settle-amount">Amount Received (₹)</Label>
                <Input
                  id="settle-amount"
                  type="number"
                  placeholder="Enter cash amount received"
                  value={settleAmount}
                  onChange={(e) => setSettleAmount(e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground">
                  💡 If remaining balance drops below ₹{(selectedStaffForSettle.collectionLimit ?? 10000).toLocaleString()}, status will automatically change to ACTIVE.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsSettleModalOpen(false)}
                disabled={isSubmittingSettle}
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmAdminSettle}
                disabled={isSubmittingSettle}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
              >
                {isSubmittingSettle ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                )}
                Confirm Settlement
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Staff Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete staff member
              <span className="font-bold"> {staffToDelete?.name}</span>'s account.
            </AlertDialogDescription>
            <div className="mt-4 p-3 bg-destructive/10 border-l-4 border-destructive text-destructive-foreground rounded-r-lg">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5" />
                <div className="font-semibold">Security Warning</div>
              </div>
              <p className="text-xs mt-1">
                Deleting from Firestore will remove their record. Backend auth deletion must be configured.
              </p>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteStaff} className="bg-destructive hover:bg-destructive/90">
              Delete Staff Member
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
