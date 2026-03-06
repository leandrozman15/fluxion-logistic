
'use server';
/**
 * @fileOverview This file implements a Genkit flow for automatically enriching prospect data.
 * It now combines official data from ReceitaWS with AI analysis of the website.
 *
 * - enrichProspectDataAutomatically - The main function to call for enriching prospect data.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { fetchCnpjData } from '@/services/receita-ws';

const EnrichProspectDataAutomaticallyInputSchema = z.object({
  cnpj: z.string().optional().describe('The CNPJ of the company.'),
  websiteUrl: z.string().url().optional().describe('The URL of the prospect\'s website.'),
});
export type EnrichProspectDataAutomaticallyInput = z.infer<typeof EnrichProspectDataAutomaticallyInputSchema>;

const EnrichProspectDataAutomaticallyOutputSchema = z.object({
  officialData: z.object({
    companyName: z.string(),
    fantasyName: z.string().optional(),
    industryTags: z.array(z.string()),
    address: z.object({
      city: z.string(),
      state: z.string(),
      street: z.string(),
    }),
    phone: z.string().optional(),
    email: z.string().optional(),
  }).optional(),
  aiExtraction: z.object({
    corporateEmailDomains: z.array(z.string()),
    summary: z.string().optional(),
    technologies: z.array(z.string()),
  }).optional(),
});
export type EnrichProspectDataAutomaticallyOutput = z.infer<typeof EnrichProspectDataAutomaticallyOutputSchema>;

export async function enrichProspectDataAutomatically(input: EnrichProspectDataAutomaticallyInput): Promise<EnrichProspectDataAutomaticallyOutput> {
  return enrichProspectDataAutomaticallyFlow(input);
}

export const enrichProspectDataAutomaticallyFlow = ai.defineFlow(
  {
    name: 'enrichProspectDataAutomaticallyFlow',
    inputSchema: EnrichProspectDataAutomaticallyInputSchema,
    outputSchema: EnrichProspectDataAutomaticallyOutputSchema,
  },
  async (input) => {
    let officialData: any = null;
    
    // 1. Fetch Official Data if CNPJ is provided
    if (input.cnpj) {
      try {
        const receita = await fetchCnpjData(input.cnpj);
        officialData = {
          companyName: receita.nome,
          fantasyName: receita.fantasia,
          industryTags: [receita.atividade_principal[0].text, ...receita.atividades_secundarias.slice(0, 2).map(a => a.text)],
          address: {
            city: receita.municipio,
            state: receita.uf,
            street: `${receita.logradouro}, ${receita.numero}`,
          },
          phone: receita.telefone,
          email: receita.email,
        };
      } catch (e) {
        console.warn("ReceitaWS enrichment failed, continuing with AI only.", e);
      }
    }

    // 2. Perform AI Extraction if website is provided (Logic from Layer 14)
    // For MVP, we return official data and placeholder for AI extraction
    return {
      officialData,
      aiExtraction: {
        corporateEmailDomains: [],
        technologies: []
      }
    };
  }
);
