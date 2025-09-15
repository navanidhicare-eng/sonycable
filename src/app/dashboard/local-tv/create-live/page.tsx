
"use client";

import { useState, useRef, useEffect } from "react";
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
import { Loader2, Video, AlertTriangle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import { addDoc, collection } from "firebase/firestore";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const formSchema = z.object({
  title: z.string().min(1, "Live stream title is required."),
  description: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function CreateLiveStreamPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user, loading: authLoading } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
    },
  });

  useEffect(() => {
    const getCameraPermission = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        setHasCameraPermission(true);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error('Error accessing camera:', error);
        setHasCameraPermission(false);
        toast({
          variant: 'destructive',
          title: 'Camera Access Denied',
          description: 'Please enable camera permissions in your browser settings to use this app.',
        });
      }
    };

    getCameraPermission();
    
    // Cleanup function to stop the camera stream when the component unmounts
    return () => {
        if (videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach(track => track.stop());
        }
    };
  }, [toast]);


  async function onSubmit(data: FormValues) {
    if (!user) {
        toast({ variant: "destructive", title: "Authentication Error" });
        return;
    }
    if (!hasCameraPermission) {
        toast({ variant: "destructive", title: "Camera Required", description: "Camera permission is needed to start a live stream." });
        return;
    }

    setIsSubmitting(true);
    try {
      // For now, we'll just save the metadata.
      // A real implementation would require WebRTC or a similar streaming service.
      await addDoc(collection(db, "liveStreams"), {
        title: data.title,
        description: data.description || "",
        status: 'Live', // or 'Pending'
        createdAt: new Date(),
        userId: user.uid,
      });

      toast({
        title: "Live Stream Created!",
        description: `Your stream "${data.title}" is now live. (Simulation)`,
      });
      // In a real app, you would navigate to a streaming control page.
      // For now, we'll go back to the local-tv list.
      router.push("/dashboard/local-tv");

    } catch (error) {
      console.error("Error creating live stream: ", error);
      toast({ variant: "destructive", title: "Failed to Start Stream" });
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
            <CardTitle className="text-2xl">Create Live Stream</CardTitle>
            <CardDescription>
              Start a new live broadcast using your webcam.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-6 bg-black rounded-lg overflow-hidden">
                <video ref={videoRef} className="w-full aspect-video" autoPlay muted playsInline />
            </div>

            {hasCameraPermission === false && (
                <Alert variant="destructive" className="mb-6">
                    <AlertTriangle className="h-4 w-4"/>
                    <AlertTitle>Camera Access Required</AlertTitle>
                    <AlertDescription>
                        Please allow camera access in your browser settings to use this feature.
                    </AlertDescription>
                </Alert>
            )}

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Stream Title</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter a title for your stream" {...field} />
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
                          placeholder="Tell us a little bit about your live stream"
                          className="resize-none"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={isLoading || hasCameraPermission === false}>
                  {isLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Video className="mr-2 h-4 w-4" />
                  )}
                  {isSubmitting ? "Starting Stream..." : "Go Live"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

