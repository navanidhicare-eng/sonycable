
"use client";

import { useState, useEffect, useMemo } from "react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { PlusCircle, Loader2, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, addDoc, deleteDoc, doc, query, where } from "firebase/firestore";

const formSchema = z.object({
  oltName: z.string().min(1, "OLT Name is required."),
  newOltName: z.string().optional(),
  vlanId: z.preprocess(
    (a) => parseInt(z.string().parse(a), 10),
    z.number().min(1, "VLAN ID must be a positive number.")
  ),
  description: z.string().optional(),
}).refine(data => data.oltName !== 'new' || (data.newOltName && data.newOltName.length > 0), {
    message: "New OLT name is required.",
    path: ["newOltName"],
});

type FormValues = z.infer<typeof formSchema>;

interface OltVlan {
  id: string;
  oltName: string;
  vlanId: number;
  description?: string;
}

export default function OltVlanPage() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user, loading: authLoading } = useAuth();
  const [oltVlans, setOltVlans] = useState<OltVlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<OltVlan | null>(null);
  const [oltFilter, setOltFilter] = useState("all");

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      oltName: "",
      newOltName: "",
      vlanId: "" as any,
      description: "",
    },
  });

  const selectedOltName = form.watch("oltName");

  const uniqueOltNames = useMemo(() => {
    const names = new Set(oltVlans.map(item => item.oltName));
    return Array.from(names).sort();
  }, [oltVlans]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const q = query(collection(db, "oltVlans"), where("userId", "==", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as OltVlan));
      data.sort((a, b) => a.oltName.localeCompare(b.oltName) || a.vlanId - b.vlanId);
      setOltVlans(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  const filteredVlans = useMemo(() => {
    if (oltFilter === "all") {
      return oltVlans;
    }
    return oltVlans.filter(item => item.oltName === oltFilter);
  }, [oltFilter, oltVlans]);

  async function onSubmit(data: FormValues) {
    if (!user) return;
    setIsSubmitting(true);

    const finalOltName = data.oltName === 'new' ? data.newOltName : data.oltName;
    
    try {
      await addDoc(collection(db, "oltVlans"), {
        oltName: finalOltName,
        vlanId: data.vlanId,
        description: data.description,
        userId: user.uid,
      });
      toast({
        title: "OLT/VLAN Added",
        description: `Successfully added ${finalOltName} with VLAN ID ${data.vlanId}.`,
      });
      form.reset({
        oltName: "",
        newOltName: "",
        vlanId: "" as any,
        description: "",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to add OLT/VLAN.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }
  
  const openDeleteDialog = (item: OltVlan) => {
    setItemToDelete(item);
    setIsDeleteDialogOpen(true);
  };
  
  const handleDelete = async () => {
    if (!itemToDelete) return;
    try {
      await deleteDoc(doc(db, "oltVlans", itemToDelete.id));
      toast({ title: "Item Deleted" });
    } catch (error) {
      toast({ variant: "destructive", title: "Deletion Failed" });
    } finally {
      setIsDeleteDialogOpen(false);
      setItemToDelete(null);
    }
  };

  return (
    <>
      <main className="min-h-screen w-full font-body text-foreground">
        <div className="container mx-auto flex flex-col items-center p-4 py-8 md:p-12">
          <header className="mb-10 flex w-full max-w-5xl flex-col items-center text-center">
              <h1 className="text-4xl font-bold tracking-tighter md:text-5xl">
                OLT VLAN Management
              </h1>
              <p className="mt-4 max-w-3xl text-lg text-muted-foreground md:text-xl">
                Manage your Optical Line Terminal (OLT) and VLAN configurations.
              </p>
          </header>

          <div className="grid w-full max-w-5xl gap-8 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Add New OLT/VLAN</CardTitle>
                  <CardDescription>
                    Fill in the details to add a new configuration.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                      <FormField
                        control={form.control}
                        name="oltName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>OLT Name</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select an OLT or add new" />
                                </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {uniqueOltNames.map(name => (
                                        <SelectItem key={name} value={name}>{name}</SelectItem>
                                    ))}
                                    <SelectItem value="new">Add new OLT...</SelectItem>
                                </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      {selectedOltName === 'new' && (
                        <FormField
                          control={form.control}
                          name="newOltName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>New OLT Name</FormLabel>
                              <FormControl>
                                <Input placeholder="e.g., OLT-New-Site" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                      <FormField
                        control={form.control}
                        name="vlanId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>VLAN ID</FormLabel>
                            <FormControl>
                              <Input type="number" placeholder="e.g., 101" {...field} />
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
                            <FormLabel>Description (Optional)</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., For new connections" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button type="submit" className="w-full" disabled={isSubmitting || authLoading}>
                        {isSubmitting ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <PlusCircle className="mr-2 h-4 w-4" />
                        )}
                        Add Configuration
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </div>
            <div className="lg:col-span-3">
               <Card>
                  <CardHeader>
                      <CardTitle>Existing Configurations</CardTitle>
                       <div className="pt-2">
                            <Select value={oltFilter} onValueChange={setOltFilter}>
                                <SelectTrigger className="w-full sm:w-[220px]">
                                    <SelectValue placeholder="Filter by OLT" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All OLTs</SelectItem>
                                    {uniqueOltNames.map(name => (
                                        <SelectItem key={name} value={name}>{name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                       </div>
                  </CardHeader>
                  <CardContent>
                      {loading ? (
                          <div className="flex justify-center items-center h-40">
                              <Loader2 className="h-8 w-8 animate-spin" />
                          </div>
                      ) : (
                          <Table>
                              <TableHeader>
                                  <TableRow>
                                  <TableHead>OLT Name</TableHead>
                                  <TableHead>VLAN ID</TableHead>
                                  <TableHead>Description</TableHead>
                                  <TableHead>Actions</TableHead>
                                  </TableRow>
                              </TableHeader>
                              <TableBody>
                                  {filteredVlans.length > 0 ? (
                                  filteredVlans.map((item) => (
                                      <TableRow key={item.id}>
                                      <TableCell className="font-medium">{item.oltName}</TableCell>
                                      <TableCell className="font-semibold text-primary">{item.vlanId}</TableCell>
                                      <TableCell>{item.description}</TableCell>
                                      <TableCell>
                                          <Button variant="ghost" size="icon" onClick={() => openDeleteDialog(item)}>
                                              <Trash2 className="h-4 w-4 text-destructive" />
                                          </Button>
                                      </TableCell>
                                      </TableRow>
                                  ))
                                  ) : (
                                  <TableRow>
                                      <TableCell colSpan={4} className="h-24 text-center">
                                      No configurations found.
                                      </TableCell>
                                  </TableRow>
                                  )}
                              </TableBody>
                          </Table>
                      )}
                  </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
          <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this configuration.
              </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              Delete
              </AlertDialogAction>
          </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

    