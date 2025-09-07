
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
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { PlusCircle, Loader2 } from "lucide-react";
import { useState } from "react";
import { db } from "@/lib/firebase";
import { addDoc, collection } from "firebase/firestore";
import { useAuth } from "@/hooks/useAuth";

const formSchema = z.object({
  roleName: z.string().min(1, "Role name is required."),
});

type FormValues = z.infer<typeof formSchema>;

export default function AddRolePage() {
  const { toast } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user, loading: authLoading } = useAuth();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      roleName: "",
    },
  });

  async function onSubmit(data: FormValues) {
    if (!user) {
        toast({
            variant: "destructive",
            title: "Authentication Error",
            description: "You must be logged in to add a role.",
        });
        return;
    }
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "roles"), {
        name: data.roleName,
        createdAt: new Date(),
        userId: user.uid,
      });
      toast({
        title: "Role Added",
        description: `The role "${data.roleName}" has been successfully added.`,
      });
      router.push("/dashboard/roles");
    } catch (error) {
      console.error("Error adding role: ", error);
      toast({
        variant: "destructive",
        title: "Failed to add role",
        description: "An error occurred while saving the role data.",
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
            <CardTitle className="text-2xl">Add New Role</CardTitle>
            <CardDescription>
              Create a new role to assign to your staff members.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="roleName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Collection Agent, Technician" {...field} />
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
                  {isSubmitting ? "Adding Role..." : "Add Role"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
