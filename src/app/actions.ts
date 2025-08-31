"use server";

import { compareCableBills, type CompareCableBillsOutput } from "@/ai/flows/compare-cable-bills";
import { z } from "zod";

const actionSchema = z.object({
  urls: z.array(z.string().url()),
});

export async function getComparisonAction(data: {
  urls: string[];
}): Promise<CompareCableBillsOutput> {
  const validation = actionSchema.safeParse(data);
  if (!validation.success) {
    throw new Error("Invalid input provided to server action.");
  }

  try {
    const result = await compareCableBills({
      urls: validation.data.urls,
    });
    return result;
  } catch (error) {
    console.error("Error in getComparisonAction:", error);
    // In a real app, you might want more specific error messages.
    throw new Error("Failed to get comparison from AI. Please check the URLs and try again.");
  }
}
