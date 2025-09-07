
"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle, Loader2, Trash2, Pencil, ShieldAlert } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { db, auth } from "@/lib/firebase";
import { collection, query, where, onSnapshot, doc, deleteDoc } from "firebase/firestore";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
// Note: Deleting users requires Admin SDK on a backend. The client-side delete is not recommended.
// For this implementation, we will only delete from Firestore. A backend function is needed for full cleanup.

interface Staff {
  id: string;
  uid: string;
  name: string;
  mobile: string;
  area: string | string[];
  role: string;
  email: string;
  commission: string;
  createdAt: {
    seconds: number;
    nanoseconds: number;
  };
}

export default function StaffPage() {
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [staffToDelete, setStaffToDelete] = useState<Staff | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }

    const q = query(collection(db, "staff"), where("adminId", "==", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const staffData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Staff));
      staffData.sort((a, b) => b.createdAt.seconds - a.createdAt.seconds);
      setStaffList(staffData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching staff:", error);
      toast({
        variant: "destructive",
        title: "Failed to fetch staff",
        description: "Could not retrieve staff data. Check permissions.",
      });
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, authLoading, toast]);

  const openDeleteDialog = (staff: Staff) => {
    setStaffToDelete(staff);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteStaff = async () => {
    if (!staffToDelete) return;

    try {
      // Delete from Firestore
      await deleteDoc(doc(db, "staff", staffToDelete.id));

      // IMPORTANT: Deleting from Firebase Auth requires a backend function (e.g., Cloud Function)
      // with the Admin SDK for security reasons. Client-side deletion is not secure.
      // This part is mocked.
      console.log(`Deletion requested for user UID: ${staffToDelete.uid}. Implement backend function to complete.`);

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
        <header className="mb-10 flex w-full max-w-4xl flex-col items-center text-center sm:flex-row sm:justify-between sm:text-left">
          <div>
            <h1 className="text-4xl font-bold tracking-tighter md:text-5xl">
              Staff Management
            </h1>
            <p className="mt-4 max-w-3xl text-lg text-muted-foreground md:text-xl">
              Manage your collection agents and other staff here.
            </p>
          </div>
          <Button asChild className="mt-4 sm:mt-0">
            <Link href="/dashboard/staff/add">
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Staff
            </Link>
          </Button>
        </header>
        <Card className="w-full max-w-4xl">
          <CardHeader>
            <CardTitle>Staff List</CardTitle>
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
                  <TableHead>Assigned Area</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Commission</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staffList.length > 0 ? (
                  staffList.map((staff) => (
                    <TableRow key={staff.id}>
                       <TableCell className="font-medium">
                        <Link href={`/dashboard/staff/${staff.id}/edit`} className="hover:underline text-primary">
                          {staff.name}
                        </Link>
                      </TableCell>
                      <TableCell>{staff.mobile}</TableCell>
                      <TableCell>{Array.isArray(staff.area) ? staff.area.join(', ') : staff.area}</TableCell>
                      <TableCell><Badge variant="outline">{staff.role}</Badge></TableCell>
                      <TableCell>
                        <Badge variant="secondary">{staff.commission}</Badge>
                      </TableCell>
                      <TableCell>{staff.email}</TableCell>
                      <TableCell className="flex gap-2">
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
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">
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

    <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the staff member
            <span className="font-bold"> {staffToDelete?.name}</span>'s account and remove their data from our servers.
            <div className="mt-4 p-3 bg-destructive/10 border-l-4 border-destructive text-destructive-foreground rounded-r-lg">
                <div className="flex items-center gap-2">
                    <ShieldAlert className="h-5 w-5" />
                    <h3 className="font-semibold">Security Warning</h3>
                </div>
                <p className="text-xs mt-1">
                    Deleting the user from Firebase Authentication requires backend logic and is not performed from the client. The user will be deleted from the Staff list, but their login credentials might remain active.
                </p>
            </div>
          </AlertDialogDescription>
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
