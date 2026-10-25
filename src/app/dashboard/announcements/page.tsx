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
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { PlusCircle, Loader2, Pencil, Trash2, ArrowUp, ArrowDown, Sparkles, MessageSquare, Save } from "lucide-react";
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
import { collection, query, where, onSnapshot, doc, deleteDoc, Timestamp, writeBatch, getDoc, setDoc } from "firebase/firestore";
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
  order?: number;
}

export default function AnnouncementsPage() {
  const { toast } = useToast();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, loading: authLoading } = useAuth();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [announcementToDelete, setAnnouncementToDelete] = useState<Announcement | null>(null);

  // Receipt Custom / Festival Message State
  const [customReceiptMsg, setCustomReceiptMsg] = useState("");
  const [msgEnabled, setMsgEnabled] = useState(true);
  const [savingReceiptMsg, setSavingReceiptMsg] = useState(false);
  const [loadingReceiptConfig, setLoadingReceiptConfig] = useState(true);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const docRef = doc(db, "settings", "receipt_config");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const d = docSnap.data();
          setCustomReceiptMsg(d.customMessage || "");
          setMsgEnabled(d.enabled !== false);
        }
      } catch (err) {
        console.error("Error fetching receipt config:", err);
      } finally {
        setLoadingReceiptConfig(false);
      }
    };
    fetchConfig();
  }, []);

  const handleSaveReceiptMsg = async () => {
    setSavingReceiptMsg(true);
    try {
      const docRef = doc(db, "settings", "receipt_config");
      const msgToSave = customReceiptMsg.trim();
      await setDoc(
        docRef,
        {
          customMessage: msgToSave,
          enabled: msgEnabled,
          updatedAt: Timestamp.now(),
          updatedBy: user?.email || "Admin",
        },
        { merge: true }
      );

      if (typeof window !== "undefined") {
        localStorage.setItem("receipt_custom_message", msgEnabled ? msgToSave : "");
      }

      toast({
        title: "Receipt Message Saved! 🎉",
        description: msgEnabled && msgToSave
          ? "This greeting/festival note will now be included on all WhatsApp & SMS receipts."
          : "Receipt custom greeting updated.",
      });
    } catch (err) {
      console.error("Error saving receipt custom message:", err);
      toast({
        variant: "destructive",
        title: "Save Failed",
        description: "An error occurred while saving the receipt custom message.",
      });
    } finally {
      setSavingReceiptMsg(false);
    }
  };

  useEffect(() => {
    if (!user) {
        if(!authLoading) setLoading(false);
        return;
    };

    const q = query(collection(db, "announcements"), where("userId", "==", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Announcement));
      // Sort by order field, ascending
      data.sort((a, b) => (a.order || 0) - (b.order || 0));
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

  const formatDate = (dateValue?: Timestamp | Date) => {
    if (!dateValue) return 'N/A';
    // Handle both Timestamp and Date objects
    const date = dateValue instanceof Timestamp ? dateValue.toDate() : dateValue;
    return date.toLocaleDateString('en-CA');
  };
  
  const handleMove = async (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= announcements.length) return;

    const newAnnouncements = [...announcements];
    const [movedItem] = newAnnouncements.splice(index, 1);
    newAnnouncements.splice(newIndex, 0, movedItem);

    const batch = writeBatch(db);

    newAnnouncements.forEach((ann, idx) => {
      const docRef = doc(db, 'announcements', ann.id);
      batch.update(docRef, { order: idx + 1 });
    });

    try {
      await batch.commit();
      setAnnouncements(newAnnouncements); // Optimistically update UI
      toast({ title: "Order Updated" });
    } catch (error) {
      console.error("Error updating order:", error);
      toast({ variant: "destructive", title: "Failed to update order" });
    }
  };


  return (
    <>
    <main className="min-h-screen w-full font-body text-foreground">
      <div className="container mx-auto flex flex-col items-center p-4 py-8 md:p-12">
        <header className="mb-10 flex w-full max-w-5xl flex-col items-center text-center sm:flex-row sm:justify-between sm:text-left">
          <div>
            <h1 className="text-4xl font-bold tracking-tighter md:text-5xl">
              Announcements & Receipts
            </h1>
            <p className="mt-4 max-w-3xl text-lg text-muted-foreground md:text-xl">
              Manage scrolling announcements and configure festival greetings for customer receipts.
            </p>
          </div>
          <Button asChild className="mt-4 sm:mt-0">
            <Link href="/dashboard/announcements/add">
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Announcement
            </Link>
          </Button>
        </header>

        {/* Receipt Custom / Festival Message Card */}
        <Card className="w-full max-w-5xl mb-8 border-2 border-amber-500/20 bg-card shadow-sm">
          <CardHeader className="bg-amber-500/5 border-b border-amber-500/10">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-lg">
                  <Sparkles className="h-6 w-6" />
                </div>
                <div>
                  <CardTitle className="text-xl font-bold">
                    Receipt Custom Message / Festival Wish
                  </CardTitle>
                  <CardDescription className="mt-0.5 text-xs">
                    Configure a custom message (e.g. Festival Greetings, Offers, Special Note) to be appended at the bottom of WhatsApp & SMS receipts.
                  </CardDescription>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch
                  id="receipt-msg-switch"
                  checked={msgEnabled}
                  onCheckedChange={setMsgEnabled}
                />
                <Label htmlFor="receipt-msg-switch" className="text-xs font-semibold cursor-pointer">
                  {msgEnabled ? "Enabled" : "Disabled"}
                </Label>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-6 space-y-4">
            {loadingReceiptConfig ? (
              <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Loading receipt configuration...
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Label htmlFor="customMsgInput" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Custom / Festival Message Text
                  </Label>
                  <Textarea
                    id="customMsgInput"
                    rows={4}
                    placeholder="e.g. 🎉 Happy Sankranti / Best Wishes from Sony Cable!"
                    value={customReceiptMsg}
                    onChange={(e) => setCustomReceiptMsg(e.target.value)}
                    className="font-medium text-sm leading-relaxed"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    💡 Tip: Add festival greetings, seasonal wishes, or promo notes. Leave empty to omit custom message.
                  </p>

                  <Button
                    onClick={handleSaveReceiptMsg}
                    disabled={savingReceiptMsg}
                    className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs h-10 px-5 shadow-sm flex items-center gap-2"
                  >
                    {savingReceiptMsg ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save Receipt Message
                  </Button>
                </div>

                {/* Live Preview Card */}
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <MessageSquare className="h-3.5 w-3.5 text-emerald-500" />
                    Receipt Preview
                  </Label>
                  <div className="p-3.5 bg-slate-900 text-slate-100 rounded-lg font-mono text-[11px] leading-tight border border-slate-800 space-y-1">
                    <div className="text-slate-400">---------------------------------</div>
                    <div className="font-bold text-amber-400">*Sony Cable*</div>
                    <div className="font-bold text-emerald-400">*చెల్లింపు రశీదు (Payment Receipt)*</div>
                    <div className="text-slate-400">---------------------------------</div>
                    <div>కస్టమర్ పేరు: K. Ramesh</div>
                    <div>చెల్లించిన మొత్తం: ₹350</div>
                    <div>మిగిలిన బాకీ: ₹0</div>
                    <div>తేదీ: 23/08/2026, 08:00 PM</div>
                    <div>వసూలు చేసినవారు: Staff</div>
                    <br />
                    <div>Sony Cable సేవలను పొందుతున్నందుకు ధన్యవాదాలు!</div>
                    <div>హెల్ప్లైన్ నెంబర్: 9010737882</div>
                    {msgEnabled && customReceiptMsg.trim() ? (
                      <>
                        <br />
                        <div className="text-amber-300 font-bold bg-amber-950/60 p-1.5 rounded border border-amber-800/60 whitespace-pre-wrap">
                          {customReceiptMsg.trim()}
                        </div>
                      </>
                    ) : (
                      <div className="text-slate-500 italic mt-1">(No custom message set)</div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="w-full max-w-5xl">
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
                    <TableHead>Order</TableHead>
                    <TableHead>Announcement Text</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>End Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {announcements.length > 0 ? (
                    announcements.map((ann, index) => {
                      const status = getStatus(ann);
                      return (
                      <TableRow key={ann.id}>
                         <TableCell className="flex gap-1 items-center">
                           <Button variant="ghost" size="icon" onClick={() => handleMove(index, 'up')} disabled={index === 0}>
                                <ArrowUp className="h-4 w-4" />
                            </Button>
                             <Button variant="ghost" size="icon" onClick={() => handleMove(index, 'down')} disabled={index === announcements.length - 1}>
                                <ArrowDown className="h-4 w-4" />
                            </Button>
                        </TableCell>
                        <TableCell className="max-w-xs truncate">{ann.text}</TableCell>
                        <TableCell>
                            <Badge variant={status.variant}>{status.text}</Badge>
                        </TableCell>
                        <TableCell>{formatDate(ann.startDate)}</TableCell>
                        <TableCell>{formatDate(ann.endDate)}</TableCell>
                        <TableCell className="flex gap-1">
                            <Button variant="ghost" size="icon" asChild>
                                <Link href={`/dashboard/announcements/${ann.id}/edit`}>
                                    <Pencil className="h-4 w-4" />
                                </Link>
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => openDeleteDialog(ann)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                        </TableCell>
                      </TableRow>
                    )})
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center">
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
