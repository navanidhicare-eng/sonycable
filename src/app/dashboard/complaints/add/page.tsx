
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { PlusCircle } from "lucide-react";

// In a real app, you might fetch this list from your customers data
const mockCustomers = [
  { id: "cust1", name: "Suresh Kumar", stbId: "STB12345" },
  { id: "cust2", name: "Rajesh Sharma", stbId: "STB67890" },
  { id: "cust3", name: "Anitha Reddy", stbId: "STB54321" },
  { id: "cust4", name: "Vijay Varma", stbId: "STB11223" },
];

const formSchema = z.object({
  customerId: z.string({ required_error: "Please select a customer." }),
  complaintDetails: z.string().min(10, "Please provide at least 10 characters for the complaint."),
});

type FormValues = z.infer<typeof formSchema>;

export default function AddComplaintPage() {
  const { toast } = useToast();
  const router = useRouter();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
  });

  function onSubmit(data: FormValues) {
    const customer = mockCustomers.find(c => c.id === data.customerId);
    console.log(data);
    toast({
      title: "Complaint Registered",
      description: `Complaint for ${customer?.name} has been successfully registered.`,
    });
    router.push("/dashboard/complaints");
  }

  return (
    <main className="min-h-screen w-full font-body text-foreground">
      <div className="container mx-auto flex flex-col items-center p-4 py-8 md:p-12">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle className="text-2xl">Register New Complaint</CardTitle>
            <CardDescription>
              Select the customer and describe the issue below.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="customerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a customer by Name or STB ID" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {mockCustomers.map(customer => (
                            <SelectItem key={customer.id} value={customer.id}>
                              {customer.name} - ({customer.stbId})
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
                  name="complaintDetails"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Complaint Details</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Describe the customer's complaint in detail..."
                          className="resize-none"
                          rows={4}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Register Complaint
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
