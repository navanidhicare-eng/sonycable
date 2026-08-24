"use client";

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
  FormDescription as FormDescriptionComponent,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useRouter, useParams } from "next/navigation";
import { Save, Loader2, ArrowLeft } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import Link from "next/link";

const formSchema = z.object({
  offerName: z.string().min(1, "Offer name is required."),
  description: z.string().min(1, "Description is required."),
  commission: z.string().min(1, "Commission is required."),
  status: z.string({ required_error: "Please select a status." }),
});

type FormValues = z.infer<typeof formSchema>;

export default function EditOfferClient() {
  const { toast } = useToast();
  const router = useRouter();
  const params = useParams();
  const offerId = params.offerId as string;
  
  const { user, loading: authLoading } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
  });

  useEffect(() => {
    if (!offerId || !user) return;

    const fetchOfferData = async () => {
        setPageLoading(true);
        try {
            const offerDocRef = doc(db, "offers", offerId);
            const offerDocSnap = await getDoc(offerDocRef);

            if (offerDocSnap.exists()) {
                const offerData = offerDocSnap.data();
                form.reset({
                    offerName: offerData.name,
                    description: offerData.description,
                    commission: offerData.commission,
                    status: offerData.status,
                });
            } else {
                toast({ variant: "destructive", title: "Not Found", description: "Offer not found."});
                router.push("/dashboard/offers");
            }
        } catch (error) {
            console.error("Error fetching offer data: ", error);
            toast({ variant: "destructive", title: "Error", description: "Failed to fetch offer data."});
        } finally {
            setPageLoading(false);
        }
    };
    
    fetchOfferData();
  }, [offerId, user, form, router, toast]);

  async function onSubmit(data: FormValues) {
    if (!user) {
        toast({ variant: "destructive", title: "Not Authenticated", description: "You must be logged in to update an offer."});
        return;
    }
    setIsSubmitting(true);
    try {
        const offerDocRef = doc(db, "offers", offerId);
        await updateDoc(offerDocRef, {
            name: data.offerName,
            description: data.description,
            commission: data.commission,
            status: data.status,
        });
        toast({
            title: "Offer Updated",
            description: `${data.offerName} has been successfully updated.`,
        });
        router.push("/dashboard/offers");
    } catch(error) {
        console.error("Error updating offer:", error);
        toast({ variant: "destructive", title: "Failed to update offer." });
    } finally {
        setIsSubmitting(false);
    }
  }

  const isLoading = authLoading || isSubmitting || pageLoading;

  return (
    <main className="min-h-screen w-full font-body text-foreground">
      <div className="container mx-auto flex flex-col items-center p-4 py-8 md:p-12">
        <div className="w-full max-w-2xl mb-4">
             <Button asChild variant="outline" size="sm">
                <Link href="/dashboard/offers" className="flex items-center gap-2">
                    <ArrowLeft className="h-4 w-4" />
                    <span>Back to Offers</span>
                </Link>
            </Button>
        </div>
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle className="text-2xl">Edit Offer</CardTitle>
            <CardDescription>
              Update the details for this promotional offer.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {pageLoading ? (
                <div className="flex justify-center items-center h-40">
                    <Loader2 className="h-8 w-8 animate-spin" />
                </div>
            ) : (
                <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <FormField
                    control={form.control}
                    name="offerName"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Offer Name</FormLabel>
                        <FormControl>
                            <Input placeholder="Enter offer name" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                            <Textarea
                            placeholder="Describe the offer details"
                            className="resize-none"
                            {...field}
                            />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    <FormField
                    control={form.control}
                    name="commission"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Commission</FormLabel>
                        <FormControl>
                            <Input placeholder="e.g., 5% or ₹20" {...field} />
                        </FormControl>
                        <FormMessage />
                        <FormDescriptionComponent>
                            Enter as a percentage (e.g. 5%) or a fixed amount (e.g. ₹20).
                        </FormDescriptionComponent>
                        </FormItem>
                    )}
                    />
                    <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="Set offer status" />
                            </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                            <SelectItem value="Active">Active</SelectItem>
                            <SelectItem value="Expired">Expired</SelectItem>
                            </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    <Button type="submit" className="w-full" disabled={isLoading}>
                        {isLoading ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Save className="mr-2 h-4 w-4" />
                        )}
                    {isSubmitting ? "Updating..." : "Update Offer"}
                    </Button>
                </form>
                </Form>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
