
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from "@/components/ui/card";
import { PlusCircle, Loader2, Pencil, Trash2 } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, doc, deleteDoc, Timestamp } from "firebase/firestore";
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

interface Announcement {
  id: string;
  text: string;
  startDate?: Timestamp;
  endDate?: Timestamp;
  createdAt: Timestamp | Date; // Allow both types
}

export default function AnnouncementsPage() {
  const { toast } = useToast();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, loading: authLoading } = useAuth();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [announcementToDelete, setAnnouncementToDelete] = useState<Announcement | null>(null);

  useEffect(() => {
    if (!user) {
        if(!authLoading) setLoading(false);
        return;
    };

    const q = query(collection(db, "announcements"), where("userId", "==", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Announcement));
      data.sort((a, b) => {
          const timeA = a.createdAt instanceof Timestamp ? a.createdAt.seconds : (a.createdAt as Date)?.getTime() / 1000;
          const timeB = b.createdAt instanceof Timestamp ? b.createdAt.seconds : (b.createdAt as Date)?.getTime() / 1000;
          if (!timeA || !timeB) return 0;
          return timeB - timeA;
      });
      setAnnouncements(data);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching announcements:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to fetch announcements." });
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, authLoading, toast]);
  
  const getStatus = (announcement: Announcement): { text: string; variant: "default" | "secondary" | "destructive" } => {
      const now = new Date();
      const start = announcement.startDate?.toDate();
      const end = announcement.endDate?.toDate();

      if (end) {
          end.setHours(23, 59, 59, 999);
          if (now > end) return { text: "Expired", variant: "destructive" };
      }
      if (start && now < start) return { text: "Upcoming", variant: "secondary" };
      
      return { text: "Active", variant: "default" };
  }

  const openDeleteDialog = (announcement: Announcement) => {
    setAnnouncementToDelete(announcement);
    setIsDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!announcementToDelete) return;
    try {
      await deleteDoc(doc(db, "announcements", announcementToDelete.id));
      toast({ title: "Announcement Deleted" });
    } catch (error) {
      toast({ variant: "destructive", title: "Deletion Failed" });
    } finally {
      setIsDeleteDialogOpen(false);
      setAnnouncementToDelete(null);
    }
  };

  const formatDate = (dateValue: Timestamp | Date | undefined) => {
    if (!dateValue) return 'N/A';
    if (dateValue instanceof Timestamp) {
      return dateValue.toDate().toLocaleDateString('en-CA');
    }
    if (dateValue instanceof Date) {
      return dateValue.toLocaleDateString('en-CA');
    }
    return 'Invalid Date';
  }

  return (
    <>
    <main className="min-h-screen w-full font-body text-foreground">
      <div className="container mx-auto flex flex-col items-center p-4 py-8 md:p-12">
        <header className="mb-10 flex w-full max-w-4xl flex-col items-center text-center sm:flex-row sm:justify-between sm:text-left">
          <div>
            <h1 className="text-4xl font-bold tracking-tighter md:text-5xl">
              Scrolling Announcements
            </h1>
            <p className="mt-4 max-w-3xl text-lg text-muted-foreground md:text-xl">
              Manage the scrolling text shown to customers.
            </p>
          </div>
          <Button asChild className="mt-4 sm:mt-0">
            <Link href="/dashboard/announcements/add">
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Announcement
            </Link>
          </Button>
        </header>

        <Card className="w-full max-w-4xl">
          <CardHeader>
            <CardTitle>All Announcements</CardTitle>
            <CardDescription>
                Here is a list of all your scheduled announcements.
            </CardDescription>
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
                    <TableHead>Announcement Text</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created On</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {announcements.length > 0 ? (
                    announcements.map((ann) => {
                      const status = getStatus(ann);
                      return (
                      <TableRow key={ann.id}>
                        <TableCell className="max-w-xs truncate">{ann.text}</TableCell>
                        <TableCell>
                            <Badge variant={status.variant}>{status.text}</Badge>
                        </TableCell>
                        <TableCell>{formatDate(ann.createdAt)}</TableCell>
                        <TableCell>
                            <Button variant="ghost" size="icon" onClick={() => openDeleteDialog(ann)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                        </TableCell>
                      </TableRow>
                    )})
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center">
                        No announcements found.
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
            This action cannot be undone. This will permanently delete this announcement.
            </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
            Delete
            </AlertDialogAction>
        </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
