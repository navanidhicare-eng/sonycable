'use server';
/**
 * @fileOverview This file defines a Genkit flow for recommending the most suitable cable network option based on user preferences and uploaded bills.
 *
 * - recommendOptimalCablePlan - A function that takes user preferences and bill details as input and returns a recommendation for the most suitable cable network option.
 * - RecommendOptimalCablePlanInput - The input type for the recommendOptimalCablePlan function.
 * - RecommendOptimalCablePlanOutput - The return type for the recommendOptimalCablePlan function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const RecommendOptimalCablePlanInputSchema = z.object({
  userPreferences: z
    .string()
    .describe('The user preferences for cable network features.'),
  billDetails: z.array(z.string()).describe('An array of bill details from different cable networks.'),
});
export type RecommendOptimalCablePlanInput = z.infer<typeof RecommendOptimalCablePlanInputSchema>;

const RecommendOptimalCablePlanOutputSchema = z.object({
  recommendation: z
    .string()
    .describe('The recommendation for the most suitable cable network option.'),
  reasoning: z.string().describe('The reasoning behind the recommendation.'),
});
export type RecommendOptimalCablePlanOutput = z.infer<typeof RecommendOptimalCablePlanOutputSchema>;

export async function recommendOptimalCablePlan(input: RecommendOptimalCablePlanInput): Promise<RecommendOptimalCablePlanOutput> {
  return recommendOptimalCablePlanFlow(input);
}

const prompt = ai.definePrompt({
  name: 'recommendOptimalCablePlanPrompt',
  input: {schema: RecommendOptimalCablePlanInputSchema},
  output: {schema: RecommendOptimalCablePlanOutputSchema},
  prompt: `You are an expert in cable network plans. Based on the user's preferences and the details from their current cable bills, recommend the most suitable cable network option.

User Preferences: {{{userPreferences}}}

Bill Details:
{{#each billDetails}}- {{{this}}}\n{{/each}}

Consider the user's preferences and the features offered by each cable network in the bill details. Explain your reasoning for the recommendation.
`,
});

const recommendOptimalCablePlanFlow = ai.defineFlow(
  {
    name: 'recommendOptimalCablePlanFlow',
    inputSchema: RecommendOptimalCablePlanInputSchema,
    outputSchema: RecommendOptimalCablePlanOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
