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
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";

interface Offer {
  id: string;
  name: string;
  description: string;
  commission: string;
  status: "Active" | "Expired";
  createdAt: {
    seconds: number;
    nanoseconds: number;
  };
}

export default function OffersPage() {
  const { user, userRole, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }

    const q = query(collection(db, "offers"), where("userId", "==", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const offersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Offer));
      offersData.sort((a,b) => b.createdAt.seconds - a.createdAt.seconds);
      setOffers(offersData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching offers: ", error);
      toast({
        variant: "destructive",
        title: "Failed to fetch offers",
      });
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, authLoading, toast]);

  return (
    <main className="min-h-screen w-full font-body text-foreground">
      <div className="container mx-auto flex flex-col items-center p-4 py-8 md:p-12">
        <header className="mb-10 flex w-full max-w-4xl flex-col items-center text-center sm:flex-row sm:justify-between sm:text-left">
          <div>
            <h1 className="text-4xl font-bold tracking-tighter md:text-5xl">
              Offers & Promotions
            </h1>
            <p className="mt-4 max-w-3xl text-lg text-muted-foreground md:text-xl">
              Manage your promotional offers and campaigns.
            </p>
          </div>
          {userRole === 'Admin' && (
            <Button asChild className="mt-4 sm:mt-0">
              <Link href="/dashboard/offers/add">
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Offer
              </Link>
            </Button>
          )}
        </header>
        <Card className="w-full max-w-4xl">
          <CardHeader>
            <CardTitle>Offer List</CardTitle>
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
                  <TableHead>Offer Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Commission</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {offers.length > 0 ? (
                  offers.map((offer) => (
                  <TableRow key={offer.id}>
                    <TableCell className="font-medium">{offer.name}</TableCell>
                    <TableCell>{offer.description}</TableCell>
                    <TableCell className="font-medium text-primary">{offer.commission}</TableCell>
                    <TableCell>
                      <Badge variant={offer.status === 'Active' ? 'default' : 'destructive'}>
                        {offer.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                  ))
                ) : (
                   <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center">
                      No offers found.
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
