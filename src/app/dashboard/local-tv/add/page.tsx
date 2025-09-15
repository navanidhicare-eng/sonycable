
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
import { useRouter } from "next/navigation";
import { PlusCircle, Loader2 } from "lucide-react";
import { useState } from "react";
import { db } from "@/lib/firebase";
import { addDoc, collection } from "firebase/firestore";
import { useAuth } from "@/hooks/useAuth";

const formSchema = z.object({
  channelName: z.string().min(1, "Channel name is required."),
  description: z.string().optional(),
  youtubeLink: z.string().url("Please enter a valid YouTube URL."),
});

type FormValues = z.infer<typeof formSchema>;

export default function AddLocalTvChannelPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user, loading: authLoading } = useAuth();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      channelName: "",
      description: "",
      youtubeLink: "",
    },
  });

  async function onSubmit(data: FormValues) {
    if (!user) {
        toast({
            variant: "destructive",
            title: "Authentication Error",
            description: "You must be logged in to add a channel.",
        });
        return;
    }
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "localChannels"), {
        name: data.channelName,
        description: data.description || "",
        youtubeLink: data.youtubeLink,
        createdAt: new Date(),
        userId: user.uid,
      });
      toast({
        title: "Channel Added",
        description: `${data.channelName} has been successfully added.`,
      });
      router.push("/dashboard/local-tv");
    } catch (error) {
      console.error("Error adding channel: ", error);
      toast({
        variant: "destructive",
        title: "Failed to add channel",
        description: "An error occurred while saving the channel data.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const isLoading = authLoading || isSubmitting;

  return (
    <main className="min-h-screen w-full font-body text-foreground">
      <div className="container mx-auto flex flex-col items-center p-4 py-8 md:p-12">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle className="text-2xl">Add New Live TV Channel</CardTitle>
            <CardDescription>
              Fill in the details below to add a new channel.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="channelName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Channel Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter channel name" {...field} />
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
                          placeholder="Tell us a little bit about the channel"
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
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <PlusCircle className="mr-2 h-4 w-4" />
                  )}
                  {isSubmitting ? "Adding Channel..." : "Add Channel"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
