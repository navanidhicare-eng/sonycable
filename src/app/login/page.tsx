
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
import { Network, LogIn } from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { collection, query, where, getDocs } from "firebase/firestore";

const formSchema = z.object({
  email: z.string().min(1, { message: "Email or Mobile Number is required." }),
  password: z.string().min(1, { message: "Password is required." }),
});

type FormValues = z.infer<typeof formSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function handleLogin(loginEmail: string, data: FormValues) {
    const userCredential = await signInWithEmailAndPassword(auth, loginEmail, data.password);
    const user = userCredential.user;

    let userRole: string | null = null;
    let destination: string | null = null;

    // 1. Check for Admin
    if (user.email === 'psdgandepalli@gmail.com') {
      userRole = "Admin";
      destination = "/dashboard";
    } else {
      // 2. Check for Staff
      const staffQuery = query(collection(db, "staff"), where("uid", "==", user.uid));
      const staffSnapshot = await getDocs(staffQuery);
      if (!staffSnapshot.empty) {
        const staffData = staffSnapshot.docs[0].data();
        userRole = staffData.role || "Staff"; // Use the specific role from DB
        destination = "/dashboard";
      }
    }

    if (userRole && destination) {
      if (typeof window !== "undefined") {
        localStorage.setItem("userRole", userRole);
      }
      toast({
        title: "Login Successful",
        description: "Redirecting...",
      });
      router.push(destination);
    } else {
      // If no role or destination is found, it's an unauthorized user.
      // Log them out and show an error.
      await auth.signOut();
      if (typeof window !== "undefined") {
          localStorage.removeItem("userRole");
      }
      throw new Error("auth/unauthorized-user");
    }
  }

  async function onSubmit(data: FormValues) {
    setIsSubmitting(true);
    
    const isMobile = /^\d{10}$/.test(data.email);
    const loginEmail = isMobile ? `${data.email}@sonycable.local` : data.email;

    try {
      await handleLogin(loginEmail, data);
    } catch (error: any) {

      console.error("Firebase Auth Error:", error);
      let errorMessage = "An error occurred during login.";
       if(error.code === 'auth/user-not-found' || error.message === 'auth/unauthorized-user' || error.code === 'auth/invalid-credential') {
          errorMessage = "Invalid credentials. Please check your details and password.";
      } else if (error.code === 'auth/wrong-password') {
          errorMessage = "Incorrect password. Please try again.";
      }

      toast({
          variant: "destructive",
          title: "Login Failed",
          description: errorMessage,
      });

    } finally {
        setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
            <Network className="h-10 w-10 text-primary mb-2" />
          <CardTitle className="text-2xl">SONY CABLE NETWORK</CardTitle>
          <CardDescription>Admin & Staff Login</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email or Mobile Number</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter your email or mobile"
                        {...field}
                      />
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
                      <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <Button type="submit" className="w-full" disabled={isSubmitting}>
                <LogIn className="mr-2 h-4 w-4" />
                {isSubmitting ? 'Logging in...' : 'Login'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </main>
  );
}
