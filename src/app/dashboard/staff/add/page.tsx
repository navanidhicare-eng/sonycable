
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
  FormDescription as FormDescriptionComponent,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { PlusCircle, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { db, auth } from "@/lib/firebase";
import { collection, onSnapshot, query, where, addDoc, getDocs } from "firebase/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth";

const formSchema = z.object({
  staffName: z.string().min(1, "Staff name is required."),
  mobileNumber: z.string().min(10, "Please enter a valid mobile number."),
  area: z.string({ required_error: "Please select an area." }),
  commission: z.string().min(1, "Commission is required."),
  email: z.string().email("Please enter a valid email address."),
  password: z.string().min(6, "Password must be at least 6 characters."),
});

type FormValues = z.infer<typeof formSchema>;

export default function AddStaffPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [areas, setAreas] = useState<{ value: string; label: string }[]>([]);
  const { user, loading: authLoading } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);


  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      staffName: "",
      mobileNumber: "",
      email: "",
      password: "",
      commission: "",
    },
  });

   useEffect(() => {
    if (authLoading || !user) return;

    const areasQuery = query(collection(db, "areas"), where("userId", "==", user.uid));
    const unsubscribe = onSnapshot(areasQuery, (snapshot) => {
        const areasData = snapshot.docs.map(doc => ({ value: doc.data().name, label: doc.data().name }));
        setAreas(areasData);
    }, (error) => {
        console.error("Error fetching areas: ", error);
        toast({
            variant: "destructive",
            title: "Failed to fetch areas",
            description: "Could not load areas for assignment.",
        });
    });

    return () => unsubscribe();
  }, [user, authLoading, toast]);


  async function onSubmit(data: FormValues) {
     if (!user) {
        toast({
            variant: "destructive",
            title: "Authentication Error",
            description: "You must be logged in to add staff.",
        });
        return;
    }
    setIsSubmitting(true);
    try {
       // Check if staff email already exists in Firestore 'staff' collection
      const staffQuery = query(collection(db, "staff"), where("email", "==", data.email), where("adminId", "==", user.uid));
      const staffSnapshot = await getDocs(staffQuery);
      if (!staffSnapshot.empty) {
        toast({ variant: "destructive", title: "User Exists", description: "A staff member with this email already exists." });
        setIsSubmitting(false);
        return;
      }

      // Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
      const newStaffUser = userCredential.user;

      // Add staff details to Firestore
      await addDoc(collection(db, "staff"), {
        uid: newStaffUser.uid,
        name: data.staffName,
        mobile: data.mobileNumber,
        area: data.area,
        commission: data.commission,
        email: data.email,
        adminId: user.uid, // Link to the admin who created the staff
        createdAt: new Date(),
      });

      toast({
        title: "Staff Added",
        description: `${data.staffName} has been successfully added.`,
      });
      router.push("/dashboard/staff");

    } catch (error: any) {
        console.error("Error adding staff: ", error);
        let description = "An error occurred while adding the staff member.";
        if (error.code === 'auth/email-already-in-use') {
            description = "This email address is already in use by another account.";
        }
        toast({
            variant: "destructive",
            title: "Failed to add staff",
            description,
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
            <CardTitle className="text-2xl">Add New Staff Member</CardTitle>
            <CardDescription>
              Fill in the details below to add a new staff member.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="staffName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Staff Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter staff's full name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="mobileNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mobile Number</FormLabel>
                      <FormControl>
                        <Input type="tel" placeholder="Enter mobile number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="area"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assign Area</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select an area" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="all_areas">All Areas</SelectItem>
                           {areas.map(area => (
                            <SelectItem key={area.value} value={area.value}>
                              {area.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={form.control}
                  name="commission"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Collection Commission</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., 5%" {...field} />
                      </FormControl>
                      <FormMessage />
                       <FormDescriptionComponent>
                        Enter commission as a percentage (e.g. 5%).
                      </FormDescriptionComponent>
                    </FormItem>
                  )}
                />
                 <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email (for login)</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="Enter a valid email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Enter a secure password" {...field} />
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
                  {isSubmitting ? "Adding..." : "Add Staff"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
