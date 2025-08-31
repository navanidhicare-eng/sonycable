'use server';

/**
 * @fileOverview This file defines a Genkit flow for comparing cable bills based on URLs provided by the user.
 *
 * - compareCableBills - A function that initiates the cable bill comparison process.
 * - CompareCableBillsInput - The input type for the compareCableBills function, which includes an array of URLs.
 * - CompareCableBillsOutput - The return type for the compareCableBills function, providing a comparison of cable bills.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { extractTextFromUrl } from '@/services/url-extractor';

const CompareCableBillsInputSchema = z.object({
  urls: z.array(z.string().url()).describe('An array of URLs pointing to cable bill documents.'),
  userPreferences: z.string().optional().describe('User preferences for cable services (e.g., desired features, budget limits).'),
});
export type CompareCableBillsInput = z.infer<typeof CompareCableBillsInputSchema>;

const CompareCableBillsOutputSchema = z.object({
  comparison: z.string().describe('A detailed comparison of the cable bills, highlighting key features and pricing.'),
  recommendation: z.string().describe('A recommendation of the most suitable cable network options based on user preferences and bill details.'),
});
export type CompareCableBillsOutput = z.infer<typeof CompareCableBillsOutputSchema>;

export async function compareCableBills(input: CompareCableBillsInput): Promise<CompareCableBillsOutput> {
  return compareCableBillsFlow(input);
}

const compareCableBillsPrompt = ai.definePrompt({
  name: 'compareCableBillsPrompt',
  input: {schema: CompareCableBillsInputSchema},
  output: {schema: CompareCableBillsOutputSchema},
  prompt: `You are an expert in analyzing cable bills and recommending the best options based on user preferences.

  You will receive an array of URLs, each pointing to a cable bill document. You will extract the relevant information from each bill, such as the features offered and the pricing details.

  Based on the extracted information and the user's preferences (if provided), you will compare the cable bills and recommend the most suitable options.

  URLs: {{{urls}}}
  User Preferences: {{userPreferences}}

  Comparison:
  Recommendation: `,
});

const compareCableBillsFlow = ai.defineFlow(
  {
    name: 'compareCableBillsFlow',
    inputSchema: CompareCableBillsInputSchema,
    outputSchema: CompareCableBillsOutputSchema,
  },
  async input => {
    // Extract text from URLs
    const extractedTexts = await Promise.all(
      input.urls.map(async url => {
        try {
          return await extractTextFromUrl(url);
        } catch (error) {
          console.error(`Failed to extract text from URL: ${url}`, error);
          return `Failed to extract text from ${url}.`;
        }
      })
    );

    // Call the prompt with the extracted texts and user preferences
    const {output} = await compareCableBillsPrompt({
      ...input,
      urls: extractedTexts,
    });
    return output!;
  }
);
