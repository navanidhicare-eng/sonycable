
"use client";

import { useState } from "react";
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
import { Calculator } from "lucide-react";

const formSchema = z.object({
  totalCollection: z.preprocess(
    (a) => parseFloat(z.string().parse(a)),
    z.number().positive("Total collection must be a positive number.")
  ),
  commissionPercentage: z.preprocess(
    (a) => parseFloat(z.string().parse(a)),
    z.number().min(0, "Commission can't be negative.").max(100, "Commission can't exceed 100%.")
  ),
});

type FormValues = z.infer<typeof formSchema>;

interface CalculationResult {
  calculatedCommission: number;
  netAmount: number;
}

export default function CommissionCalculatorPage() {
  const [result, setResult] = useState<CalculationResult | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
  });

  function onSubmit(data: FormValues) {
    const calculatedCommission = (data.totalCollection * data.commissionPercentage) / 100;
    const netAmount = data.totalCollection - calculatedCommission;
    setResult({ calculatedCommission, netAmount });
  }

  return (
    <main className="min-h-screen w-full font-body text-foreground">
      <div className="container mx-auto flex flex-col items-center p-4 py-8 md:p-12">
        <header className="mb-10 flex w-full max-w-2xl flex-col items-center text-center">
          <h1 className="text-4xl font-bold tracking-tighter md:text-5xl">
            Commission Calculator
          </h1>
          <p className="mt-4 max-w-3xl text-lg text-muted-foreground md:text-xl">
            Calculate staff commission based on total collection.
          </p>
        </header>

        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle>Calculation</CardTitle>
            <CardDescription>
              Enter the details below to calculate the commission amount.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="totalCollection"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Total Collection Amount (₹)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="e.g., 50000" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="commissionPercentage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Commission Percentage (%)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="e.g., 5" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full">
                  <Calculator className="mr-2 h-4 w-4" />
                  Calculate Commission
                </Button>
              </form>
            </Form>

            {result && (
              <div className="mt-8 rounded-lg border bg-muted p-6">
                <h3 className="mb-4 text-lg font-semibold">Calculation Result</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Collection:</span>
                    <span className="font-medium">₹{form.getValues("totalCollection").toLocaleString()}</span>
                  </div>
                   <div className="flex justify-between">
                    <span className="text-muted-foreground">Commission Percentage:</span>
                    <span className="font-medium">{form.getValues("commissionPercentage")}%</span>
                  </div>
                  <div className="flex justify-between text-base font-semibold text-primary">
                    <span >Calculated Commission:</span>
                    <span>₹{result.calculatedCommission.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between border-t pt-3 mt-3">
                    <span className="text-muted-foreground">Net Amount (after commission):</span>
                    <span className="font-medium">₹{result.netAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
