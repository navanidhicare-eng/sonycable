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
import { Save, Loader2, ArrowLeft, CalendarIcon } from "lucide-react";
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc, Timestamp } from "firebase/firestore";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { format, isValid } from "date-fns";

const formSchema = z.object({
  channelName: z.string().min(1, "Channel name is required."),
  description: z.string().optional(),
  youtubeLink: z.string().url("Please enter a valid YouTube URL."),
  type: z.enum(["channel", "livestream"], {
    required_error: "You need to select a type.",
  }),
  startTime: z.date().optional(),
  endTime: z.date().optional(),
}).refine(data => {
    if (data.type === 'livestream') {
        return !!data.startTime && !!data.endTime;
    }
    return true;
}, {
    message: "Start and end time are required for a live stream.",
    path: ["startTime"], 
});

type FormValues = z.infer<typeof formSchema>;

export default function EditLocalTvChannelClient() {
  const { toast } = useToast();
  const router = useRouter();
  const params = useParams();
  const channelId = params.channelId as string;
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const { user, loading: authLoading } = useAuth();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
  });

  const channelType = form.watch("type");

  useEffect(() => {
    if (!channelId || !user) return;

    const fetchChannelData = async () => {
        setPageLoading(true);
        try {
            const channelDocRef = doc(db, "localChannels", channelId);
            const channelDocSnap = await getDoc(channelDocRef);

            if (channelDocSnap.exists()) {
                const data = channelDocSnap.data();
                form.reset({
                    channelName: data.name,
                    description: data.description,
                    youtubeLink: data.youtubeLink,
                    type: data.type,
                    startTime: data.startTime ? data.startTime.toDate() : undefined,
                    endTime: data.endTime ? data.endTime.toDate() : undefined,
                });
            } else {
                toast({ variant: "destructive", title: "Not Found", description: "Content not found."});
                router.push("/dashboard/local-tv");
            }
        } catch (error) {
            console.error("Error fetching content data: ", error);
            toast({ variant: "destructive", title: "Error", description: "Failed to fetch content data."});
        } finally {
            setPageLoading(false);
        }
    };
    
    fetchChannelData();
  }, [channelId, user, form, router, toast]);

  async function onSubmit(data: FormValues) {
    setIsSubmitting(true);
    try {
      const channelDocRef = doc(db, "localChannels", channelId);
      
      const docData: any = {
        name: data.channelName,
        description: data.description || "",
        youtubeLink: data.youtubeLink,
        type: data.type,
      };

      if (data.type === 'livestream') {
        docData.startTime = Timestamp.fromDate(data.startTime!);
        docData.endTime = Timestamp.fromDate(data.endTime!);
      } else {
        docData.startTime = null;
        docData.endTime = null;
      }

      await updateDoc(channelDocRef, docData);

      toast({
        title: "Content Updated",
        description: `${data.channelName} has been successfully updated.`,
      });
      router.push("/dashboard/local-tv");

    } catch (error: any) {
        console.error("Error updating content: ", error);
        toast({
            variant: "destructive",
            title: "Update Failed",
            description: "An error occurred while updating the content.",
        });
    } finally {
        setIsSubmitting(false);
    }
  }

  const isLoading = authLoading || isSubmitting || pageLoading;

  const handleTimeChange = (timeValue: string, field: any) => {
    if (!timeValue) return;
    const [hours, minutes] = timeValue.split(':').map(Number);
    const existingDate = field.value && isValid(new Date(field.value)) ? new Date(field.value) : new Date();
    existingDate.setHours(hours);
    existingDate.setMinutes(minutes);
    field.onChange(existingDate);
  };

  return (
    <main className="min-h-screen w-full font-body text-foreground">
      <div className="container mx-auto flex flex-col items-center p-4 py-8 md:p-12">
         <div className="w-full max-w-2xl mb-4">
             <Button asChild variant="outline" size="sm">
                <Link href="/dashboard/local-tv" className="flex items-center gap-2">
                    <ArrowLeft className="h-4 w-4" />
                    <span>Back to List</span>
                </Link>
            </Button>
        </div>
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle className="text-2xl">Edit Content</CardTitle>
            <CardDescription>
              Update the details for this YouTube Channel or Live Stream.
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
                    name="type"
                    render={({ field }) => (
                        <FormItem className="space-y-3">
                        <FormLabel>Type</FormLabel>
                        <FormControl>
                            <RadioGroup
                            onValueChange={field.onChange}
                            value={field.value}
                            className="flex flex-col space-y-1"
                            >
                            <FormItem className="flex items-center space-x-3 space-y-0">
                                <FormControl>
                                <RadioGroupItem value="channel" />
                                </FormControl>
                                <FormLabel className="font-normal">
                                Channel (Always available)
                                </FormLabel>
                            </FormItem>
                            <FormItem className="flex items-center space-x-3 space-y-0">
                                <FormControl>
                                <RadioGroupItem value="livestream" />
                                </FormControl>
                                <FormLabel className="font-normal">
                                Live Stream (Time-based event)
                                </FormLabel>
                            </FormItem>
                            </RadioGroup>
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />

                    <FormField
                    control={form.control}
                    name="channelName"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                            <Input placeholder="Enter name for channel or live stream" {...field} />
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
                            placeholder="Tell us a little bit about it"
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
                    name="youtubeLink"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>YouTube Link</FormLabel>
                        <FormControl>
                            <Input type="url" placeholder="https://www.youtube.com/watch?v=..." {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />

                    {channelType === 'livestream' && (
                    <div className="space-y-6 rounded-md border p-4">
                        <FormField
                        control={form.control}
                        name="startTime"
                        render={({ field }) => (
                            <FormItem className="flex flex-col">
                            <FormLabel>Live Start Time</FormLabel>
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
                                    {field.value && isValid(new Date(field.value)) ? (
                                        format(new Date(field.value), "PPP HH:mm")
                                      ) : (
                                        <span>Pick a date and time</span>
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
                                <Input
                                    type="time"
                                    className="mt-2"
                                    value={field.value && isValid(new Date(field.value)) ? format(new Date(field.value), "HH:mm") : ""}
                                    onChange={(e) => handleTimeChange(e.target.value, field)}
                                    />
                                </PopoverContent>
                            </Popover>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                        <FormField
                        control={form.control}
                        name="endTime"
                        render={({ field }) => (
                            <FormItem className="flex flex-col">
                            <FormLabel>Live End Time</FormLabel>
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
                                     {field.value && isValid(new Date(field.value)) ? (
                                        format(new Date(field.value), "PPP HH:mm")
                                      ) : (
                                        <span>Pick a date and time</span>
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
                                <Input
                                    type="time"
                                    className="mt-2"
                                    value={field.value && isValid(new Date(field.value)) ? format(new Date(field.value), "HH:mm") : ""}
                                    onChange={(e) => handleTimeChange(e.target.value, field)}
                                    />
                                </PopoverContent>
                            </Popover>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                    </div>
                    )}
                    <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <Save className="mr-2 h-4 w-4" />
                    )}
                    {isSubmitting ? "Updating..." : "Update Content"}
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
