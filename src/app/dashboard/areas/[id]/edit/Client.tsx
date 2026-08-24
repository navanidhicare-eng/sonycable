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
  areaName: z.string().min(1, "Area name is required."),
  description: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function EditAreaClient() {
  const { toast } = useToast();
  const router = useRouter();
  const params = useParams();
  const areaId = params.id as string;
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const { user, loading: authLoading } = useAuth();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
  });

  useEffect(() => {
    if (!areaId || !user) return;

    const fetchAreaData = async () => {
        setPageLoading(true);
        try {
            const areaDocRef = doc(db, "areas", areaId);
            const areaDocSnap = await getDoc(areaDocRef);

            if (areaDocSnap.exists()) {
                const areaData = areaDocSnap.data();
                form.reset({
                    areaName: areaData.name,
                    description: areaData.description,
                });
            } else {
                toast({ variant: "destructive", title: "Not Found", description: "Area not found."});
                router.push("/dashboard/areas");
            }
        } catch (error) {
            console.error("Error fetching area data: ", error);
            toast({ variant: "destructive", title: "Error", description: "Failed to fetch area data."});
        } finally {
            setPageLoading(false);
        }
    };
    
    fetchAreaData();
  }, [areaId, user, form, router, toast]);

  async function onSubmit(data: FormValues) {
    setIsSubmitting(true);
    try {
      const areaDocRef = doc(db, "areas", areaId);
      await updateDoc(areaDocRef, {
        name: data.areaName,
        description: data.description || "",
      });

      toast({
        title: "Area Updated",
        description: `${data.areaName} has been successfully updated.`,
      });
      router.push("/dashboard/areas");

    } catch (error: any) {
        console.error("Error updating area: ", error);
        toast({
            variant: "destructive",
            title: "Update Failed",
            description: "An error occurred while updating the area details.",
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
                <Link href="/dashboard/areas" className="flex items-center gap-2">
                    <ArrowLeft className="h-4 w-4" />
                    <span>Back to Area List</span>
                </Link>
            </Button>
        </div>
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle className="text-2xl">Edit Area</CardTitle>
            <CardDescription>
              Update the details for this operational area.
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
                    name="areaName"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Area Name</FormLabel>
                        <FormControl>
                            <Input placeholder="Enter area name" {...field} />
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
                            placeholder="Tell us a little bit about the area"
                            className="resize-none"
                            {...field}
                            />
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
                    {isSubmitting ? "Updating..." : "Update Area"}
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
