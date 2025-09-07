
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { collection, query, where, onSnapshot, doc, updateDoc, Timestamp, getDocs } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";

interface Complaint {
  id: string;
  createdAt: Timestamp;
  customerName: string;
  stbId: string;
  complaint: string;
  status: "Pending" | "Resolved";
  resolutionNotes?: string;
  userId: string; // Admin's UID
}

interface Staff {
    adminId: string;
}

export default function StaffComplaintsPage() {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, userRole, loading: authLoading } = useAuth();
  const { toast } = useToast();

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
            <Button asChild className="mt-4 sm:mt-0">
              <Link href="/dashboard/complaints-staff/add">
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Complaint
              </Link>
            </Button>
          </header>
          <Card className="w-full max-w-4xl">
            <CardHeader>
              <CardTitle>Complaint List</CardTitle>
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
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {complaints.length > 0 ? (
                        complaints.map((complaint) => (
                        <TableRow key={complaint.id}>
                            <TableCell>{complaint.createdAt.toDate().toLocaleDateString('en-CA')}</TableCell>
                            <TableCell className="font-medium">
                            <div>{complaint.customerName}</div>
                            <div className="text-xs text-muted-foreground">{complaint.stbId}</div>
                            </TableCell>
                            <TableCell>{complaint.complaint}</TableCell>
                            <TableCell>
                            <Badge
                                variant={
                                complaint.status === "Pending"
                                    ? "destructive"
                                    : "default"
                                }
                            >
                                {complaint.status}
                            </Badge>
                            </TableCell>
                        </TableRow>
                        ))
                    ) : (
                        <TableRow>
                            <TableCell colSpan={4} className="h-24 text-center">
                                No complaints found.
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
    </>
  );
}
