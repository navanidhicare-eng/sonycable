
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
import { auth } from "@/lib/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";

const formSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email." }),
  password: z.string().min(1, { message: "Password is required." }),
});

type FormValues = z.infer<typeof formSchema>;

const staffCredentials = [
    { email: "staf@gmail.com", password: "password123"},
    { mobile: "9010737882", password: "12345678"},
]

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

  async function onSubmit(data: FormValues) {
    setIsSubmitting(true);
    
    const isAdmin = data.email.toLowerCase() === 'psdgandepalli@gmail.com';
    const isStaff = staffCredentials.some(cred => cred.email === data.email.toLowerCase() || cred.mobile === data.email);

    try {
        await signInWithEmailAndPassword(auth, data.email, data.password);
        if (typeof window !== "undefined") {
            if (isAdmin) {
              localStorage.setItem("userRole", "Admin");
            } else if (isStaff) {
              localStorage.setItem("userRole", "Staff");
            }
        }
        toast({
            title: "Login Successful",
            description: "Redirecting to dashboard...",
        });
        router.push("/dashboard");

    } catch (error: any) {
        console.error("Firebase Auth Error:", error);
        
        let errorMessage = "Invalid username or password. Please try again.";
        if(error.code === 'auth/user-not-found') {
            errorMessage = "No user found with this email.";
        } else if (error.code === 'auth/wrong-password') {
            errorMessage = "Incorrect password. Please try again.";
        } else if (error.code === 'auth/invalid-credential') {
             errorMessage = "Invalid credentials. Please check your email and password.";
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
                    <FormLabel>Email / Mobile</FormLabel>
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
