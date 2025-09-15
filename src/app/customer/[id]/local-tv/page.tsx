
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, getDocs } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Tv2, Youtube, X, Radio } from 'lucide-react';
import Link from 'next/link';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';

interface Channel {
  id: string;
  name: string;
  description: string;
  youtubeLink: string;
}

interface Customer {
  userId: string; // Admin's UID
}

export default function CustomerLocalTvPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);

  useEffect(() => {
    if (authLoading || !user) {
      if (!authLoading) setLoading(false);
      return;
    }

    const fetchChannels = async () => {
      setLoading(true);
      try {
        // 1. Find the customer's admin
        const customerQuery = query(collection(db, "customers"), where("uid", "==", user.uid));
        const customerSnapshot = await getDocs(customerQuery);

        if (customerSnapshot.empty) {
          toast({ variant: "destructive", title: "Customer data not found." });
          setLoading(false);
          return;
        }

        const customerData = customerSnapshot.docs[0].data() as Customer;
        const adminId = customerData.userId;

        if (!adminId) {
          setLoading(false);
          return;
        }

        // 2. Fetch channels from that admin
        const channelsQuery = query(collection(db, "localChannels"), where("userId", "==", adminId), where("type", "==", "channel"));
        const unsubscribe = onSnapshot(channelsQuery, (snapshot) => {
          const channelsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Channel));
          channelsData.sort((a,b) => (a.name > b.name) ? 1 : -1)
          setChannels(channelsData);
          setLoading(false);
        }, (error) => {
          console.error("Error fetching channels:", error);
          toast({ variant: "destructive", title: "Failed to load channels" });
          setLoading(false);
        });

        return unsubscribe;

      } catch (error) {
        console.error("Error in fetching customer/channel data:", error);
        toast({ variant: "destructive", title: "An error occurred while loading data." });
        setLoading(false);
      }
    };
    
    let unsubscribe: (() => void) | undefined;
    fetchChannels().then(unsub => {
        if(unsub) unsubscribe = unsub;
    });

    return () => {
        if(unsubscribe) unsubscribe();
    };
  }, [authLoading, user, toast]);

  const getYouTubeVideoId = (url: string) => {
    let videoId = '';
    const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const match = url.match(youtubeRegex);
    if (match) {
        videoId = match[1];
    }
    return videoId;
  };

  const handleWatchNow = (channel: Channel) => {
    setSelectedChannel(channel);
    setIsPlayerOpen(true);
  };
  
  const videoId = selectedChannel ? getYouTubeVideoId(selectedChannel.youtubeLink) : null;


  if (loading || authLoading) {
    return (
      <main className="flex min-h-[calc(100vh-theme(spacing.14))] w-full items-center justify-center bg-background p-4 md:min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </main>
    );
  }

  return (
    <>
    <main className="min-h-screen w-full font-body text-foreground bg-background">
      <div className="container mx-auto p-4 py-8 md:p-12">
        <header className="mb-10 flex w-full max-w-4xl flex-col items-start">
          <div className="flex items-center gap-3">
             <Tv2 className="h-10 w-10 text-primary"/>
             <div>
                <h1 className="text-4xl font-bold tracking-tighter md:text-5xl">
                    Local TV Channels
                </h1>
                <p className="mt-2 max-w-3xl text-lg text-muted-foreground">
                    Watch local channels and videos from your provider.
                </p>
             </div>
          </div>
        </header>

        {channels.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {channels.map((channel) => (
              <Card key={channel.id} className="flex flex-col">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Youtube className="h-6 w-6 text-red-600"/>
                    {channel.name}
                  </CardTitle>
                  <CardDescription>{channel.description}</CardDescription>
                </CardHeader>
                <CardFooter className="mt-auto">
                   <Button className="w-full" onClick={() => handleWatchNow(channel)}>
                        Watch Now
                    </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 border border-dashed rounded-lg">
            <h2 className="text-xl font-semibold">No Channels Available</h2>
            <p className="text-muted-foreground mt-2">Your provider has not added any local channels yet.</p>
          </div>
        )}
      </div>
    </main>

    <Dialog open={isPlayerOpen} onOpenChange={setIsPlayerOpen}>
        <DialogContent className="max-w-4xl p-0">
            <DialogHeader className="p-4">
                <DialogTitle className="flex items-center gap-2">
                     <Youtube className="h-6 w-6 text-red-600"/>
                     {selectedChannel?.name}
                </DialogTitle>
                 <DialogClose className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
                    <X className="h-4 w-4" />
                    <span className="sr-only">Close</span>
                </DialogClose>
            </DialogHeader>
            <div className="aspect-video">
                {videoId ? (
                    <iframe
                        width="100%"
                        height="100%"
                        src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&showinfo=0`}
                        title={selectedChannel?.name}
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                    ></iframe>
                ) : (
                    <div className="flex h-full w-full items-center justify-center bg-black text-white">
                        Invalid YouTube Link
                    </div>
                )}
            </div>
        </DialogContent>
    </Dialog>
    </>
  );
}

    