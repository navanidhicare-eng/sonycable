
"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, History } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { collection, onSnapshot, query, where, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface CollectionHistoryItem {
    id: string;
    customerName: string;
    amount: number;
    method: string;
    collectionDate: Timestamp;
}

export default function MyCollectionHistoryPage() {
  const [history, setHistory] = useState<CollectionHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const [totalCollected, setTotalCollected] = useState(0);

  useEffect(() => {
    if (authLoading || !user) {
        if (!authLoading) setLoading(false);
        return;
    }

    setLoading(true);
    const collectionsQuery = query(
        collection(db, "payments"), 
        where("collectedBy", "==", user.uid)
    );
    
    const unsubscribe = onSnapshot(collectionsQuery, (snapshot) => {
        const historyData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CollectionHistoryItem));
        historyData.sort((a, b) => b.collectionDate.seconds - a.collectionDate.seconds);
        setHistory(historyData);

        const total = historyData.reduce((sum, item) => sum + item.amount, 0);
        setTotalCollected(total);

        setLoading(false);
    }, (error) => {
        console.error("Error fetching collection history:", error);
        toast({ variant: "destructive", title: "Failed to fetch history" });
        setLoading(false);
    });

    return () => unsubscribe();
  }, [user, authLoading, toast]);


  return (
    <>
      <main className="min-h-screen w-full font-body text-foreground">
        <div className="container mx-auto flex flex-col items-center p-4 py-8 md:p-12">
          <header className="mb-10 flex w-full max-w-4xl flex-col items-center text-center sm:flex-row sm:justify-between sm:text-left">
            <div>
              <h1 className="text-4xl font-bold tracking-tighter md:text-5xl">
                My Collection History
              </h1>
              <p className="mt-4 max-w-3xl text-lg text-muted-foreground md:text-xl">
                View all the payments you have collected.
              </p>
            </div>
          </header>
          <Card className="w-full max-w-4xl">
            <CardHeader>
                <div className="flex justify-between items-center mb-4">
                    <CardTitle>All Collections</CardTitle>
                    <div className="text-right">
                        <p className="text-sm text-muted-foreground">Total Collected</p>
                        <p className="text-2xl font-bold">₹{totalCollected.toLocaleString()}</p>
                    </div>
                </div>
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
                    <TableHead>Date</TableHead>
                    <TableHead>Customer Name</TableHead>
                    <TableHead>Amount (₹)</TableHead>
                    <TableHead>Method</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.length > 0 ? (
                    history.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.collectionDate.toDate().toLocaleDateString('en-CA')}</TableCell>
                        <TableCell className="font-medium">
                          {item.customerName}
                        </TableCell>
                        <TableCell>₹{item.amount.toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{item.method}</Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center">
                        No collections found.
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
    </>
  );
}
