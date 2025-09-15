
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle, Loader2, Trash2, Pencil } from "lucide-react";
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
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, deleteDoc, doc } from "firebase/firestore";

interface Business {
  id: string;
  businessName: string;
  category: string;
  phone: string;
  createdAt: {
    seconds: number;
    nanoseconds: number;
  };
}

export default function BusinessDirectoryPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [businessToDelete, setBusinessToDelete] = useState<Business | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }

    const q = query(collection(db, "businesses"), where("userId", "==", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const businessData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Business));
      businessData.sort((a, b) => b.createdAt.seconds - a.createdAt.seconds);
      setBusinesses(businessData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching businesses: ", error);
      toast({
        variant: "destructive",
        title: "Failed to fetch businesses",
      });
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, authLoading, toast]);

  const openDeleteDialog = (business: Business) => {
    setBusinessToDelete(business);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteBusiness = async () => {
    if (!businessToDelete) return;
    try {
      await deleteDoc(doc(db, "businesses", businessToDelete.id));
      toast({
        title: "Business Deleted",
        description: `${businessToDelete.businessName} has been removed.`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Deletion Failed",
        description: "Could not delete the business.",
      });
    } finally {
      setIsDeleteDialogOpen(false);
      setBusinessToDelete(null);
    }
  };

  return (
    <>
      <main className="min-h-screen w-full font-body text-foreground">
        <div className="container mx-auto flex flex-col items-center p-4 py-8 md:p-12">
          <header className="mb-10 flex w-full max-w-4xl flex-col items-center text-center sm:flex-row sm:justify-between sm:text-left">
            <div>
              <h1 className="text-4xl font-bold tracking-tighter md:text-5xl">
                Local Business Directory
              </h1>
              <p className="mt-4 max-w-3xl text-lg text-muted-foreground md:text-xl">
                Manage your local business listings here.
              </p>
            </div>
            <Button asChild>
              <Link href="/dashboard/business-directory/add">
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Business
              </Link>
            </Button>
          </header>
          <Card className="w-full max-w-4xl">
            <CardHeader>
              <CardTitle>Business List</CardTitle>
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
                      <TableHead>Business Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {businesses.length > 0 ? (
                      businesses.map((business) => (
                        <TableRow key={business.id}>
                          <TableCell className="font-medium">{business.businessName}</TableCell>
                          <TableCell>{business.category}</TableCell>
                          <TableCell>{business.phone}</TableCell>
                          <TableCell className="flex gap-1">
                             <Button variant="ghost" size="icon" asChild>
                                <Link href={`/dashboard/business-directory/${business.id}/edit`}>
                                    <Pencil className="h-4 w-4" />
                                </Link>
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => openDeleteDialog(business)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="h-24 text-center">
                          No businesses found. Click "Add Business" to get started.
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
              This action cannot be undone. This will permanently delete the business 
              <span className="font-bold"> {businessToDelete?.businessName}</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteBusiness} className="bg-destructive hover:bg-destructive/90">
              Delete Business
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
