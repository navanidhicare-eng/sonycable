"use client";

import type { CompareCableBillsOutput } from "@/ai/flows/compare-cable-bills";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, CheckCircle, Sparkles } from "lucide-react";

interface ComparisonResultsProps {
  result: CompareCableBillsOutput;
}

export function ComparisonResults({ result }: ComparisonResultsProps) {
  const formatText = (text: string) => {
    return text.split('\n').map((paragraph, index) => (
      <p key={index} className="mb-2 last:mb-0">
        {paragraph}
      </p>
    ));
  };
  
  return (
    <div className="w-full space-y-8">
      <Card className="animate-slide-in-fade-in">
        <CardHeader>
          <div className="flex items-center gap-3">
             <BarChart3 className="h-7 w-7 text-primary" />
             <CardTitle className="text-2xl">Bill Comparison</CardTitle>
          </div>
          <CardDescription>Here's how your bills stack up against each other.</CardDescription>
        </CardHeader>
        <CardContent className="prose prose-sm dark:prose-invert max-w-none text-foreground">
          {formatText(result.comparison)}
        </CardContent>
      </Card>

      <Card className="animate-slide-in-fade-in border-accent" style={{ animationDelay: '150ms' }}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
               <CheckCircle className="h-7 w-7 text-accent" />
               <CardTitle className="text-2xl text-accent">Our Recommendation</CardTitle>
            </div>
            <Badge variant="outline" className="border-accent text-accent">
                <Sparkles className="mr-2 h-4 w-4"/>
                AI-Powered
            </Badge>
          </div>
          <CardDescription>Based on your bills and preferences, here's the best option for you.</CardDescription>
        </CardHeader>
        <CardContent className="prose prose-sm dark:prose-invert max-w-none text-foreground">
          {formatText(result.recommendation)}
        </CardContent>
      </Card>
    </div>
  );
}
