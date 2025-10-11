
"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
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
import { useToast } from "@/hooks/use-toast";
import { PlusCircle, Loader2, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, addDoc, deleteDoc, doc, query, where } from "firebase/firestore";

const formSchema = z.object({
  months: z.preprocess(
    (a) => parseInt(z.string().parse(a), 10),
    z.number().min(2, "Months must be 2 or more.")
  ),
  discountPercentage: z.preprocess(
    (a) => parseFloat(z.string().parse(a)),
    z.number().min(1, "Discount must be at least 1%.").max(100, "Discount cannot exceed 100%.")
  ),
});

type FormValues = z.infer<typeof formSchema>;

interface Offer {
  id: string;
  months: number;
  discountPercentage: number;
}

export default function RechargeOffersPage() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user, loading: authLoading } = useAuth();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [offerToDelete, setOfferToDelete] = useState<Offer | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      months: undefined,
      discountPercentage: undefined,
    },
  });

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const q = query(collection(db, "rechargeOffers"), where("userId", "==", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const offersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Offer));
      offersData.sort((a, b) => a.months - b.months);
      setOffers(offersData);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  async function onSubmit(data: FormValues) {
    if (!user) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "rechargeOffers"), {
        ...data,
        userId: user.uid,
      });
      toast({
        title: "Offer Added",
        description: `A ${data.discountPercentage}% discount for ${data.months} months has been created.`,
      });
      form.reset();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create offer.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }
  
  const openDeleteDialog = (offer: Offer) => {
    setOfferToDelete(offer);
    setIsDeleteDialogOpen(true);
  };
  
  const handleDelete = async () => {
    if (!offerToDelete) return;
    try {
      await deleteDoc(doc(db, "rechargeOffers", offerToDelete.id));
      toast({ title: "Offer Deleted" });
    } catch (error) {
      toast({ variant: "destructive", title: "Deletion Failed" });
    } finally {
      setIsDeleteDialogOpen(false);
      setOfferToDelete(null);
    }
  };


  return (
    <>
      <main className="min-h-screen w-full font-body text-foreground">
        <div className="container mx-auto flex flex-col items-center p-4 py-8 md:p-12">
          <header className="mb-10 flex w-full max-w-4xl flex-col items-center text-center">
              <h1 className="text-4xl font-bold tracking-tighter md:text-5xl">
                Multi-Month Recharge Offers
              </h1>
              <p className="mt-4 max-w-3xl text-lg text-muted-foreground md:text-xl">
                Create and manage discounts for customers who recharge for multiple months at once.
              </p>
          </header>

          <div className="grid w-full max-w-4xl gap-8 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Add New Offer</CardTitle>
                  <CardDescription>
                    Define a new discount for a specific number of months.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                      <FormField
                        control={form.control}
                        name="months"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Number of Months</FormLabel>
                            <FormControl>
                              <Input type="number" placeholder="e.g., 3" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="discountPercentage"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Discount Percentage (%)</FormLabel>
                            <FormControl>
                              <Input type="number" placeholder="e.g., 10" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button type="submit" className="w-full" disabled={isSubmitting || authLoading}>
                        {isSubmitting ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <PlusCircle className="mr-2 h-4 w-4" />
                        )}
                        Add Offer
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </div>
            <div className="lg:col-span-3">
               <Card>
                  <CardHeader>
                      <CardTitle>Active Offers</CardTitle>
                  </CardHeader>
                  <CardContent>
                      {loading ? (
                          <div className="flex justify-center items-center h-40">
                              <Loader2 className="h-8 w-8 animate-spin" />
                          </div>
                      ) : (
                          <Table>
                              <TableHeader>
                                  <TableRow>
                                  <TableHead>Months</TableHead>
                                  <TableHead>Discount</TableHead>
                                  <TableHead>Actions</TableHead>
                                  </TableRow>
                              </TableHeader>
                              <TableBody>
                                  {offers.length > 0 ? (
                                  offers.map((offer) => (
                                      <TableRow key={offer.id}>
                                      <TableCell className="font-medium">{offer.months} Months</TableCell>
                                      <TableCell className="font-semibold text-primary">{offer.discountPercentage}% OFF</TableCell>
                                      <TableCell>
                                          <Button variant="ghost" size="icon" onClick={() => openDeleteDialog(offer)}>
                                              <Trash2 className="h-4 w-4 text-destructive" />
                                          </Button>
                                      </TableCell>
                                      </TableRow>
                                  ))
                                  ) : (
                                  <TableRow>
                                      <TableCell colSpan={3} className="h-24 text-center">
                                      No offers found.
                                      </TableCell>
                                  </TableRow>
                                  )}
                              </TableBody>
                          </Table>
                      )}
                  </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
          <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this recharge offer.
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
