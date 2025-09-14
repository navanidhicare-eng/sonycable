
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
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { collection, query, where, getDocs, doc, updateDoc, limit } from "firebase/firestore";

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
    let customerId: string | null = null;
    let destination = "/dashboard";

    if (user.email === 'psdgandepalli@gmail.com') {
      userRole = "Admin";
    } else {
      const staffQuery = query(collection(db, "staff"), where("uid", "==", user.uid));
      const staffSnapshot = await getDocs(staffQuery);
      if (!staffSnapshot.empty) {
        const staffData = staffSnapshot.docs[0].data();
        userRole = staffData.role || "Staff";
      } else {
        const customerQuery = query(collection(db, "customers"), where("uid", "==", user.uid));
        const customerSnapshot = await getDocs(customerQuery);
        if (!customerSnapshot.empty) {
          userRole = "Customer";
          customerId = customerSnapshot.docs[0].id;
          destination = `/customer/${customerId}`;
        }
      }
    }

    if (typeof window !== "undefined") {
      if (userRole) {
        localStorage.setItem("userRole", userRole);
      } else {
        auth.signOut();
        throw new Error("auth/unauthorized-user");
      }
    }

    toast({
      title: "Login Successful",
      description: "Redirecting...",
    });
    router.push(destination);
  }

  async function onSubmit(data: FormValues) {
    setIsSubmitting(true);
    
    const isMobile = /^\d{10}$/.test(data.email);
    const loginEmail = isMobile ? `${data.email}@sonycable.local` : data.email;

    try {
      await handleLogin(loginEmail, data);
    } catch (error: any) {
      // JIT Account Creation for old customers
      if (error.code === 'auth/user-not-found' && isMobile && data.password === '12345678') {
        try {
          const customerQuery = query(
            collection(db, "customers"),
            where("mobile", "==", data.email),
            limit(1)
          );
          const customerSnapshot = await getDocs(customerQuery);

          if (!customerSnapshot.empty) {
            const customerDoc = customerSnapshot.docs[0];
            const customerData = customerDoc.data();
            
            // Check if customer already has a UID
            if (!customerData.uid) {
              const userCredential = await createUserWithEmailAndPassword(auth, loginEmail, data.password);
              const newCustomerUser = userCredential.user;

              await updateDoc(doc(db, "customers", customerDoc.id), {
                uid: newCustomerUser.uid
              });
              
              // Now that the account is created, try logging in again
              await handleLogin(loginEmail, data);
              return; // Exit after successful JIT login
            }
          }
        } catch (jitError: any) {
            // Fall through to the generic error handler if JIT creation fails
            console.error("JIT Creation/Login Error:", jitError);
        }
      }

      console.error("Firebase Auth Error:", error);
      let errorMessage = "An error occurred during login.";
      if(error.code === 'auth/user-not-found' || error.message === 'auth/unauthorized-user') {
          errorMessage = "No authorized user found with this email or mobile number.";
      } else if (error.code === 'auth/wrong-password') {
          errorMessage = "Incorrect password. Please try again.";
      } else if (error.code === 'auth/invalid-credential') {
           errorMessage = "Invalid credentials. Please check your details and password.";
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
          <CardDescription>Admin, Staff & Customer Login</CardDescription>
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
