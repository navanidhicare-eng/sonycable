
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
import { Save, Loader2, CalendarIcon } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, setDoc, updateDoc, Timestamp } from "firebase/firestore";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";

const formSchema = z.object({
  announcementText: z.string().min(1, "Announcement text cannot be empty."),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
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
          const data = doc.data();
          setAnnouncementDocId(doc.id);
          form.reset({ 
            announcementText: data.text,
            startDate: data.startDate ? data.startDate.toDate() : undefined,
            endDate: data.endDate ? data.endDate.toDate() : undefined,
          });
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
    
    const docData = {
        text: data.announcementText,
        userId: user.uid,
        updatedAt: new Date(),
        startDate: data.startDate ? Timestamp.fromDate(data.startDate) : null,
        endDate: data.endDate ? Timestamp.fromDate(data.endDate) : null,
    };

    try {
      if (announcementDocId) {
        const docRef = doc(db, "announcements", announcementDocId);
        await updateDoc(docRef, docData);
      } else {
        const docRef = doc(db, "announcements", user.uid);
        await setDoc(docRef, docData);
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
              Set the text and optional date range for the scrolling announcement at the bottom of the customer dashboard.
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="startDate"
                      render={({ field }) => (
                          <FormItem className="flex flex-col">
                          <FormLabel>Start Date</FormLabel>
                          <Popover>
                              <PopoverTrigger asChild>
                              <FormControl>
                                  <Button
                                  variant={"outline"}
                                  className={cn(
                                      "w-full pl-3 text-left font-normal",
                                      !field.value && "text-muted-foreground"
                                  )}
                                  >
                                  {field.value ? (
                                      format(field.value, "PPP")
                                  ) : (
                                      <span>Pick a start date</span>
                                  )}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                  </Button>
                              </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                  mode="single"
                                  selected={field.value}
                                  onSelect={field.onChange}
                                  initialFocus
                              />
                              </PopoverContent>
                          </Popover>
                           <FormMessage />
                          </FormItem>
                      )}
                      />
                       <FormField
                      control={form.control}
                      name="endDate"
                      render={({ field }) => (
                          <FormItem className="flex flex-col">
                          <FormLabel>End Date</FormLabel>
                          <Popover>
                              <PopoverTrigger asChild>
                              <FormControl>
                                  <Button
                                  variant={"outline"}
                                  className={cn(
                                      "w-full pl-3 text-left font-normal",
                                      !field.value && "text-muted-foreground"
                                  )}
                                  >
                                  {field.value ? (
                                      format(field.value, "PPP")
                                  ) : (
                                      <span>Pick an end date</span>
                                  )}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                  </Button>
                              </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                  mode="single"
                                  selected={field.value}
                                  onSelect={field.onChange}
                                  initialFocus
                              />
                              </PopoverContent>
                          </Popover>
                           <FormMessage />
                          </FormItem>
                      )}
                      />
                  </div>

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
