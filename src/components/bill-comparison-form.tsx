"use client";

import { useState, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getComparisonAction } from "@/app/actions";
import { ComparisonResults } from "./comparison-results";
import { useToast } from "@/hooks/use-toast";
import type { CompareCableBillsOutput } from "@/ai/flows/compare-cable-bills";
import { Loader2, Plus, Sparkles, Trash2, Settings, Link as LinkIcon } from "lucide-react";

const formSchema = z.object({
  urls: z.array(z.object({ value: z.string().url({ message: "Please enter a valid URL." }) })).min(1, "Please add at least one URL."),
  preferences: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const PREFERENCES_STORAGE_KEY = "cable_comparator_preferences";

export function BillComparisonForm() {
  const [result, setResult] = useState<CompareCableBillsOutput | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      urls: [{ value: "" }],
      preferences: "",
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "urls",
  });

  useEffect(() => {
    const savedPreferences = localStorage.getItem(PREFERENCES_STORAGE_KEY);
    if (savedPreferences) {
      form.setValue("preferences", savedPreferences);
    }
  }, [form]);

  const handlePreferencesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    form.setValue("preferences", e.target.value);
    localStorage.setItem(PREFERENCES_STORAGE_KEY, e.target.value);
  };

  async function onSubmit(data: FormValues) {
    setIsSubmitting(true);
    setResult(null);
    try {
      const response = await getComparisonAction({
        urls: data.urls.map(u => u.value),
        preferences: data.preferences,
      });
      setResult(response);
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "An error occurred",
        description: error instanceof Error ? error.message : "Please try again later.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="w-full max-w-4xl space-y-12">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-2xl">Start Your Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <div>
                <FormLabel className="flex items-center gap-2 mb-4 text-lg font-semibold">
                  <LinkIcon className="h-5 w-5" />
                  Cable Bill URLs
                </FormLabel>
                <div className="space-y-4">
                  {fields.map((field, index) => (
                    <FormField
                      key={field.id}
                      control={form.control}
                      name={`urls.${index}.value`}
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex items-center gap-2">
                            <FormControl>
                              <Input placeholder="https://example.com/your-bill.pdf" {...field} />
                            </FormControl>
                            <Button
                              type="button"
                              variant="destructive"
                              size="icon"
                              onClick={() => remove(index)}
                              disabled={fields.length <= 1}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ))}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => append({ value: "" })}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add another URL
                </Button>
              </div>

              <FormField
                control={form.control}
                name="preferences"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2 text-lg font-semibold">
                      <Settings className="h-5 w-5" />
                      Your Preferences (Optional)
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="e.g., 'I need at least 100 Mbps internet speed', 'My budget is $80/month', 'I want sports channels like ESPN'"
                        className="min-h-[120px]"
                        {...field}
                        onChange={handlePreferencesChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" size="lg" className="w-full bg-accent text-accent-foreground hover:bg-accent/90" disabled={isSubmitting}>
                {isSubmitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                Analyze and Recommend
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {isSubmitting && (
        <div className="space-y-8">
            <Card>
              <CardHeader>
                <Skeleton className="h-8 w-1/2" />
              </CardHeader>
              <CardContent className="space-y-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                 <Skeleton className="h-8 w-1/3" />
              </CardHeader>
              <CardContent className="space-y-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
              </CardContent>
            </Card>
        </div>
      )}
      
      {result && <ComparisonResults result={result} />}
    </div>
  );
}
