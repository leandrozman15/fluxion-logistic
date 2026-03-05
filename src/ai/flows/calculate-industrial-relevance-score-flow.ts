'use server';
/**
 * @fileOverview A Genkit flow to calculate the industrial relevance score of a prospect.
 *
 * - calculateIndustrialRelevanceScore - A function that handles the industrial relevance scoring process.
 * - CalculateIndustrialRelevanceScoreInput - The input type for the calculateIndustrialRelevanceScore function.
 * - CalculateIndustrialRelevanceScoreOutput - The return type for the calculateIndustrialRelevanceScore function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// Input Schema
const CalculateIndustrialRelevanceScoreInputSchema = z.object({
  companyName: z.string().describe('The name of the company prospect.'),
  industryTags: z.array(z.string()).describe('An array of industrial tags associated with the company.'),
  websiteUrl: z.string().optional().describe('The website URL of the company, if available.'),
});
export type CalculateIndustrialRelevanceScoreInput = z.infer<typeof CalculateIndustrialRelevanceScoreInputSchema>;

// Output Schema
const CalculateIndustrialRelevanceScoreOutputSchema = z.object({
  score: z.number().min(0).max(100).describe('An industrial relevance score from 0 to 100.'),
  scoreReasons: z.array(z.string()).describe('A list of reasons explaining the calculated score.'),
});
export type CalculateIndustrialRelevanceScoreOutput = z.infer<typeof CalculateIndustrialRelevanceScoreOutputSchema>;

// Prompt Definition
const industrialRelevancePrompt = ai.definePrompt({
  name: 'industrialRelevancePrompt',
  input: { schema: CalculateIndustrialRelevanceScoreInputSchema },
  output: { schema: CalculateIndustrialRelevanceScoreOutputSchema },
  prompt: `You are an expert B2B industrial sales analyst. Your task is to evaluate the industrial relevance of a prospect based on their company name, provided industry tags, and their website URL.
Rate the industrial relevance on a scale from 0 to 100, where 0 is not relevant at all and 100 is highly relevant.
Provide a clear, concise list of reasons that justify the given score.

Consider the following information:
Company Name: {{{companyName}}}
Industry Tags: {{#if industryTags}} {{#each industryTags}} - {{{this}}} {{/each}} {{else}} No specific industry tags provided. {{/if}}
Website URL: {{#if websiteUrl}} {{{websiteUrl}}} (Assume you have browsed this website and are looking for industrial products, services, or manufacturing processes. If no website is provided, base your assessment solely on the name and tags.) {{else}} No website URL provided. {{/if}}

Based on this, provide the industrial relevance score and its reasons in the specified JSON format.`,
});

// Flow Definition
const calculateIndustrialRelevanceScoreFlow = ai.defineFlow(
  {
    name: 'calculateIndustrialRelevanceScoreFlow',
    inputSchema: CalculateIndustrialRelevanceScoreInputSchema,
    outputSchema: CalculateIndustrialRelevanceScoreOutputSchema,
  },
  async (input) => {
    const { output } = await industrialRelevancePrompt(input);
    if (!output) {
      throw new Error('Failed to generate industrial relevance score.');
    }
    return output;
  }
);

// Wrapper Function
export async function calculateIndustrialRelevanceScore(
  input: CalculateIndustrialRelevanceScoreInput
): Promise<CalculateIndustrialRelevanceScoreOutput> {
  return calculateIndustrialRelevanceScoreFlow(input);
}
