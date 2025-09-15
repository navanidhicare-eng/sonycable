
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
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";

const formSchema = z.object({
  businessName: z.string().min(1, "Business name is required."),
  category: z.string().min(1, "Category is required."),
  description: z.string().optional(),
  address: z.string().min(1, "Address is required."),
  phone: z.string().min(10, "A valid phone number is required."),
});

type FormValues = z.infer<typeof formSchema>;

export default function EditBusinessPage() {
  const { toast } = useToast();
  const router = useRouter();
  const params = useParams();
  const businessId = params.businessId as string;
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const { user, loading: authLoading } = useAuth();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
  });

  useEffect(() => {
    if (!businessId || !user) return;

    const fetchBusinessData = async () => {
        setPageLoading(true);
        try {
            const businessDocRef = doc(db, "businesses", businessId);
            const businessDocSnap = await getDoc(businessDocRef);

            if (businessDocSnap.exists()) {
                const businessData = businessDocSnap.data();
                form.reset(businessData);
            } else {
                toast({ variant: "destructive", title: "Not Found", description: "Business not found."});
                router.push("/dashboard/business-directory");
            }
        } catch (error) {
            console.error("Error fetching business data: ", error);
            toast({ variant: "destructive", title: "Error", description: "Failed to fetch business data."});
        } finally {
            setPageLoading(false);
        }
    };
    
    fetchBusinessData();
  }, [businessId, user, form, router, toast]);

  async function onSubmit(data: FormValues) {
    setIsSubmitting(true);
    try {
      const businessDocRef = doc(db, "businesses", businessId);
      await updateDoc(businessDocRef, data);

      toast({
        title: "Business Updated",
        description: `${data.businessName} has been successfully updated.`,
      });
      router.push("/dashboard/business-directory");

    } catch (error: any) {
        console.error("Error updating business: ", error);
        toast({
            variant: "destructive",
            title: "Update Failed",
            description: "An error occurred while updating the business details.",
        });
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
                <Link href="/dashboard/business-directory" className="flex items-center gap-2">
                    <ArrowLeft className="h-4 w-4" />
                    <span>Back to Directory</span>
                </Link>
            </Button>
        </div>
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle className="text-2xl">Edit Business</CardTitle>
            <CardDescription>
              Update the details for this business listing.
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
                    name="businessName"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Business Name</FormLabel>
                        <FormControl>
                            <Input placeholder="Enter the business name" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Category</FormLabel>
                        <FormControl>
                            <Input placeholder="e.g., Restaurant, Clinic, Store" {...field} />
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
                            placeholder="A brief description of the business and services offered"
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
                    name="address"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Address</FormLabel>
                        <FormControl>
                            <Input placeholder="Enter the full address" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Phone Number</FormLabel>
                        <FormControl>
                            <Input type="tel" placeholder="Enter contact number" {...field} />
                        </FormControl>
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
                    {isSubmitting ? "Updating..." : "Update Business"}
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
