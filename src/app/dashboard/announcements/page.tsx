
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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Save, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, setDoc, updateDoc } from "firebase/firestore";

const formSchema = z.object({
  announcementText: z.string().min(1, "Announcement text cannot be empty."),
});

type FormValues = z.infer<typeof formSchema>;

export default function AnnouncementsPage() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const { user, loading: authLoading } = useAuth();
  const [announcementDocId, setAnnouncementDocId] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      announcementText: "",
    },
  });

  useEffect(() => {
    if (!user) return;

    const fetchAnnouncement = async () => {
      setPageLoading(true);
      const q = query(collection(db, "announcements"), where("userId", "==", user.uid));
      try {
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const doc = querySnapshot.docs[0];
          setAnnouncementDocId(doc.id);
          form.reset({ announcementText: doc.data().text });
        }
      } catch (error) {
        toast({ variant: "destructive", title: "Error", description: "Failed to fetch announcement." });
      } finally {
        setPageLoading(false);
      }
    };

    fetchAnnouncement();
  }, [user, form, toast]);

  async function onSubmit(data: FormValues) {
    if (!user) return;
    setIsSubmitting(true);

    try {
      if (announcementDocId) {
        const docRef = doc(db, "announcements", announcementDocId);
        await updateDoc(docRef, { text: data.announcementText });
      } else {
        // Since we assume one announcement doc per user, we can set a predictable ID
        const docRef = doc(db, "announcements", user.uid);
        await setDoc(docRef, {
          text: data.announcementText,
          userId: user.uid,
          updatedAt: new Date(),
        });
        setAnnouncementDocId(user.uid);
      }
      toast({
        title: "Announcement Updated",
        description: "The scrolling text has been successfully updated for all customers.",
      });
    } catch (error) {
      toast({ variant: "destructive", title: "Update Failed", description: "Could not save the announcement." });
    } finally {
      setIsSubmitting(false);
    }
  }

  const isLoading = authLoading || pageLoading || isSubmitting;

  return (
    <main className="min-h-screen w-full font-body text-foreground">
      <div className="container mx-auto flex flex-col items-center p-4 py-8 md:p-12">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle className="text-2xl">Scrolling Announcement</CardTitle>
            <CardDescription>
              Set the text that scrolls at the bottom of the customer dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {pageLoading || authLoading ? (
              <div className="flex justify-center items-center h-40">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="announcementText"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Announcement Text</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Enter the text you want to scroll for customers..."
                            className="resize-none"
                            rows={4}
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
                    {isSubmitting ? "Updating..." : "Update Announcement"}
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
