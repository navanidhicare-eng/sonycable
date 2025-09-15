
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

// This is a placeholder interface. You will need to define the actual structure of a Channel.
interface Channel {
  id: string;
  name: string;
  url: string;
  status: "Active" | "Inactive";
}

export default function LocalTvPage() {
  const { user, userRole, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Placeholder for fetching data from Firestore
    // You will need to implement this logic
    if (!authLoading) {
      setLoading(false);
    }
  }, [user, authLoading, toast]);

  return (
    <main className="min-h-screen w-full font-body text-foreground">
      <div className="container mx-auto flex flex-col items-center p-4 py-8 md:p-12">
        <header className="mb-10 flex w-full max-w-4xl flex-col items-center text-center sm:flex-row sm:justify-between sm:text-left">
          <div>
            <h1 className="text-4xl font-bold tracking-tighter md:text-5xl">
              Local Live TV
            </h1>
            <p className="mt-4 max-w-3xl text-lg text-muted-foreground md:text-xl">
              Manage your local and live TV channels here.
            </p>
          </div>
          <Button asChild className="mt-4 sm:mt-0">
            {/* The link should point to a page for adding a new channel, which you'll need to create */}
            <Link href="#">
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Channel
            </Link>
          </Button>
        </header>
        <Card className="w-full max-w-4xl">
          <CardHeader>
            <CardTitle>Channel List</CardTitle>
          </CardHeader>
          <CardContent>
            {loading || authLoading ? (
              <div className="flex justify-center items-center h-40">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Channel Name</TableHead>
                    <TableHead>Stream URL</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {channels.length > 0 ? (
                    channels.map((channel) => (
                      <TableRow key={channel.id}>
                        <TableCell className="font-medium">{channel.name}</TableCell>
                        <TableCell>{channel.url}</TableCell>
                        <TableCell>{channel.status}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={3} className="h-24 text-center">
                        No channels found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
