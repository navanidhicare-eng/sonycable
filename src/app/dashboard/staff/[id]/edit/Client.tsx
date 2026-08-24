"use client";

import { useEffect, useState } from "react";
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
import { useRouter, useParams } from "next/navigation";
import { Save, Loader2, ArrowLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc, collection, query, where, onSnapshot } from "firebase/firestore";
import { Checkbox } from "@/components/ui/checkbox";
import Link from "next/link";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const formSchema = z.object({
  staffName: z.string().min(1, "Staff name is required."),
  mobileNumber: z.string().min(10, "Please enter a valid mobile number."),
  area: z.array(z.string()).refine((value) => value.some((item) => item), {
    message: "You have to select at least one area.",
  }),
  role: z.string({ required_error: "Please select a role." }),
  commission: z.string().min(1, "Commission is required."),
  enrollmentCommission: z.preprocess(
    (val) => (val === "" || val === undefined ? "0" : val),
    z.string().transform(v => parseFloat(v)).refine(v => !isNaN(v), "Please enter a valid number.")
  ),
  collectionLimit: z.preprocess(
    (val) => (val === "" || val === undefined ? "10000" : val),
    z.string().transform(v => parseFloat(v)).refine(v => !isNaN(v) && v >= 0, "Please enter a valid collection limit.")
  ),
  email: z.string().email("Please enter a valid email address.").optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface Role {
    id: string;
    name: string;
}

export default function EditStaffClient() {
  const { toast } = useToast();
  const router = useRouter();
  const params = useParams();
  const staffId = params.id as string;
  
  const [areas, setAreas] = useState<{ id: string; label: string }[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const { user, loading: authLoading } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      staffName: "",
      mobileNumber: "",
      commission: "",
      enrollmentCommission: 0,
      collectionLimit: 10000,
      area: [],
    },
  });

  useEffect(() => {
    if (!staffId || !user) return;

    const fetchStaffData = async () => {
        setPageLoading(true);
        try {
            const staffDocRef = doc(db, "staff", staffId);
            const staffDocSnap = await getDoc(staffDocRef);

            if (staffDocSnap.exists()) {
                const staffData = staffDocSnap.data();
                form.reset({
                    staffName: staffData.name,
                    mobileNumber: staffData.mobile,
                    area: staffData.area || [],
                    role: staffData.role,
                    commission: staffData.commission,
                    enrollmentCommission: staffData.enrollmentCommission || 0,
                    collectionLimit: staffData.collectionLimit ?? 10000,
                    email: staffData.email
                });
            } else {
                toast({ variant: "destructive", title: "Not Found", description: "Staff member not found."});
                router.push("/dashboard/staff");
            }
        } catch (error) {
            console.error("Error fetching staff data: ", error);
            toast({ variant: "destructive", title: "Error", description: "Failed to fetch staff data."});
        } finally {
            setPageLoading(false);
        }
    };
    
    fetchStaffData();
  }, [staffId, user, form, router, toast]);

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
    setIsSubmitting(true);
    try {
      const staffDocRef = doc(db, "staff", staffId);
      await updateDoc(staffDocRef, {
        name: data.staffName,
        mobile: data.mobileNumber,
        area: data.area,
        role: data.role,
        commission: data.commission,
        enrollmentCommission: data.enrollmentCommission,
        collectionLimit: data.collectionLimit,
      });

      toast({
        title: "Staff Updated",
        description: `${data.staffName}'s details have been successfully updated.`,
      });
      router.push("/dashboard/staff");

    } catch (error: any) {
        console.error("Error updating staff: ", error);
        toast({
            variant: "destructive",
            title: "Update Failed",
            description: "An error occurred while updating the staff member.",
        });
    } finally {
        setIsSubmitting(false);
    }
  }

  const isLoading = authLoading || isSubmitting || pageLoading;

  return (
    <main className="min-h-screen w-full font-body text-foreground">
      <div className="container mx-auto flex flex-col items-center p-4 py-8 md:p-12">
        <div className="w-full max-w-2xl mb-4">
             <Button asChild variant="outline" size="sm">
                <Link href="/dashboard/staff" className="flex items-center gap-2">
                    <ArrowLeft className="h-4 w-4" />
                    <span>Back to Staff List</span>
                </Link>
            </Button>
        </div>
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle className="text-2xl">Edit Staff Member</CardTitle>
            <CardDescription>
              Update the details for this staff member.
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
                    name="email"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Email (Login)</FormLabel>
                        <FormControl>
                            <Input type="email" {...field} disabled />
                        </FormControl>
                        <FormDescriptionComponent>
                            The login email cannot be changed.
                        </FormDescriptionComponent>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
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
                          <Select onValueChange={field.onChange} value={field.value}>
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
                      name="enrollmentCommission"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>New Customer Enrollment Commission (₹)</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="e.g., 100" {...field} />
                          </FormControl>
                          <FormMessage />
                          <FormDescriptionComponent>
                            Fixed, one-time amount for each new customer enrolled.
                          </FormDescriptionComponent>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="collectionLimit"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Collection Limit (₹)</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="e.g., 10000" {...field} />
                          </FormControl>
                          <FormMessage />
                          <FormDescriptionComponent>
                            Max cash allowed in hand before account auto-locks (Default: ₹10,000).
                          </FormDescriptionComponent>
                        </FormItem>
                      )}
                    />
                    
                    <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <Save className="mr-2 h-4 w-4" />
                    )}
                    {isSubmitting ? "Updating..." : "Update Staff"}
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
