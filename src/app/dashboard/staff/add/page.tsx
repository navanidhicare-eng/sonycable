
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
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { PlusCircle, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { db, auth } from "@/lib/firebase";
import { collection, onSnapshot, query, where, addDoc, getDocs } from "firebase/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const formSchema = z.object({
  staffName: z.string().min(1, "Staff name is required."),
  mobileNumber: z.string().min(10, "Please enter a valid mobile number."),
  area: z.array(z.string()).refine((value) => value.some((item) => item), {
    message: "You have to select at least one area.",
  }),
  role: z.string({ required_error: "Please select a role." }),
  commission: z.string().min(1, "Commission is required."),
  email: z.string().email("Please enter a valid email address."),
  password: z.string().min(6, "Password must be at least 6 characters."),
});

type FormValues = z.infer<typeof formSchema>;

interface Role {
    id: string;
    name: string;
}

export default function AddStaffPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [areas, setAreas] = useState<{ id: string; label: string }[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
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
      area: [],
    },
  });

   useEffect(() => {
    if (authLoading || !user) return;

    const areasQuery = query(collection(db, "areas"), where("userId", "==", user.uid));
    const areasUnsubscribe = onSnapshot(areasQuery, (snapshot) => {
        const areasData = snapshot.docs.map(doc => ({ id: doc.id, label: doc.data().name }));
        setAreas(areasData);
    });

    const rolesQuery = query(collection(db, "roles"), where("userId", "==", user.uid));
    const rolesUnsubscribe = onSnapshot(rolesQuery, (snapshot) => {
        const rolesData = snapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name }));
        setRoles(rolesData);
    });


    return () => {
        areasUnsubscribe();
        rolesUnsubscribe();
    };
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
      const staffQuery = query(collection(db, "staff"), where("email", "==", data.email));
      const staffSnapshot = await getDocs(staffQuery);
      if (!staffSnapshot.empty) {
        toast({ variant: "destructive", title: "User Exists", description: "A staff member with this email already exists under some admin." });
        setIsSubmitting(false);
        return;
      }

      const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
      const newStaffUser = userCredential.user;

      await addDoc(collection(db, "staff"), {
        uid: newStaffUser.uid,
        name: data.staffName,
        mobile: data.mobileNumber,
        area: data.area,
        role: data.role,
        commission: data.commission,
        email: data.email,
        adminId: user.uid, 
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
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assign Role</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a role for the staff" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {roles.map(role => (
                            <SelectItem key={role.id} value={role.name}>
                              {role.name}
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
                  name="area"
                  render={() => (
                    <FormItem>
                      <div className="mb-4">
                        <FormLabel className="text-base">Assign Area</FormLabel>
                        <FormDescriptionComponent>
                          Select the areas this staff member will be assigned to.
                        </FormDescriptionComponent>
                      </div>
                      <div className="space-y-2">
                        {areas.map((item) => (
                          <FormField
                            key={item.id}
                            control={form.control}
                            name="area"
                            render={({ field }) => {
                              return (
                                <FormItem
                                  key={item.id}
                                  className="flex flex-row items-start space-x-3 space-y-0"
                                >
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value?.includes(item.label)}
                                      onCheckedChange={(checked) => {
                                        const fieldValue = field.value || [];
                                        return checked
                                          ? field.onChange([...fieldValue, item.label])
                                          : field.onChange(
                                              fieldValue?.filter(
                                                (value) => value !== item.label
                                              )
                                            );
                                      }}
                                    />
                                  </FormControl>
                                  <FormLabel className="font-normal">
                                    {item.label}
                                  </FormLabel>
                                </FormItem>
                              );
                            }}
                          />
                        ))}
                      </div>
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
