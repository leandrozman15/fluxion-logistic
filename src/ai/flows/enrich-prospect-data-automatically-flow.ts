'use server';
/**
 * @fileOverview This file implements a Genkit flow for automatically enriching prospect data
 * by analyzing a provided website URL. It extracts potential corporate email domains,
 * generic contact emails, and company phone numbers.
 *
 * - enrichProspectDataAutomatically - The main function to call for enriching prospect data.
 * - EnrichProspectDataAutomaticallyInput - The input type for the enrichment process.
 * - EnrichProspectDataAutomaticallyOutput - The return type after enrichment.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const EnrichProspectDataAutomaticallyInputSchema = z.object({
  websiteUrl: z.string().url().describe('The URL of the prospect\'s website for analysis.'),
});
export type EnrichProspectDataAutomaticallyInput = z.infer<typeof EnrichProspectDataAutomaticallyInputSchema>;

const EnrichProspectDataAutomaticallyOutputSchema = z.object({
  corporateEmailDomains: z.array(z.string().describe('Suggested corporate email domains found on the website.')),
  genericContactEmails: z.array(z.string().describe('Suggested generic contact emails (e.g., info@domain.com).')),
  phoneNumbers: z.array(z.string().describe('Suggested company phone numbers found on the website.')),
});
export type EnrichProspectDataAutomaticallyOutput = z.infer<typeof EnrichProspectDataAutomaticallyOutputSchema>;

// Internal schema for the prompt, including the fetched website content
const EnrichPromptInputSchema = z.object({
  websiteUrl: z.string().url().describe('The URL of the prospect\'s website.'),
  websiteContentHtml: z.string().describe('The HTML content of the prospect\'s website for AI analysis.'),
});

const enrichProspectDataAutomaticallyPrompt = ai.definePrompt({
  name: 'enrichProspectDataAutomaticallyPrompt',
  input: { schema: EnrichPromptInputSchema },
  output: { schema: EnrichProspectDataAutomaticallyOutputSchema },
  prompt: `You are an expert data enrichment agent. Your task is to analyze the provided website content from the given URL and extract key contact information.

Specifically, identify and list:
1.  **Corporate Email Domains**: The primary email domains used by the company (e.g., if the website is example.com, the domain is example.com).
2.  **Generic Contact Emails**: Common contact emails such as info@domain.com, contact@domain.com, sales@domain.com. Infer these based on the main corporate domain if not explicitly found.
3.  **Company Phone Numbers**: Any publicly listed phone numbers for the company.

Prioritize information explicitly stated on 